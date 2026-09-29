import json
import logging
from elasticsearch import AsyncElasticsearch
import redis.asyncio as aioredis
from app.core.config import settings
from app.services.event_service import event_service

logger = logging.getLogger("recommendation_service")

# Views and searches no longer invalidate the cache (event_service.STRONG_SIGNALS), so this
# bounds how stale recommendations can get for someone who is only browsing.
RECOMMENDATIONS_TTL_SECONDS = 900

class RecommendationService:
    def __init__(self):
        logger.info(f"Connecting to Elasticsearch at: {settings.ELASTICSEARCH_URL}")
        self.es_client = AsyncElasticsearch(settings.ELASTICSEARCH_URL)
        self.index_name = "marad_listings"
        
        logger.info(f"Connecting to Redis at: {settings.REDIS_URL}")
        self.redis_client = aioredis.from_url(settings.REDIS_URL)

    def _map_hit(self, hit: dict) -> dict:
        source = hit.get("_source", {})
        return {
            "id": hit.get("_id"),
            "title": source.get("title"),
            "description": source.get("description"),
            "price": source.get("price"),
            "location": source.get("location"),
            "category": source.get("category"),
            "tags": source.get("tags"),
            "createdAt": source.get("createdAt"),
            "updatedAt": source.get("updatedAt"),
            "images_count": source.get("images_count"),
            "description_length": source.get("description_length"),
            "seller_average_rating": source.get("seller_average_rating")
        }

    async def get_cold_start(self, limit: int = 20) -> list:
        # Build query for recent listings
        body = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"status": "active"}}
                    ]
                }
            },
            "sort": [
                {"createdAt": {"order": "desc"}}
            ],
            "size": limit
        }
        
        try:
            res = await self.es_client.search(index=self.index_name, body=body)
            hits = res.get("hits", {}).get("hits", [])
            if hits:
                return [self._map_hit(h) for h in hits]
        except Exception as e:
            logger.warning(f"Elasticsearch search with status active failed: {str(e)}")
            
        # Fallback to match_all if no active listings found (or field status doesn't exist)
        fallback_body = {
            "query": {"match_all": {}},
            "sort": [
                {"createdAt": {"order": "desc"}}
            ],
            "size": limit
        }
        try:
            res = await self.es_client.search(index=self.index_name, body=fallback_body)
            return [self._map_hit(h) for h in res.get("hits", {}).get("hits", [])]
        except Exception as e:
            logger.error(f"Elasticsearch cold start search failed: {str(e)}")
            return []

    async def get_recommendations(self, user_id: str, limit: int = 20) -> dict:
        cache_key = f"recommendations:{user_id}"
        
        # 1. Check Redis cache
        try:
            cached = await self.redis_client.get(cache_key)
            if cached:
                logger.info(f"Returning cached recommendations for user {user_id}")
                return json.loads(cached)
        except Exception as e:
            logger.error(f"Failed to read from Redis cache: {str(e)}")

        # 2. Category scores and seen listings, aggregated in Postgres in one query
        #    (recency-decayed, weighted by signal strength: event_service.SIGNALS_SQL).
        try:
            signals = await event_service.user_signals(user_id)
        except Exception as e:
            logger.error(f"Failed to read events for user {user_id}: {str(e)}")
            signals = {"categories": [], "seen_listings": []}

        frequent_categories = signals["categories"]
        viewed_ids = signals["seen_listings"]

        if not frequent_categories:
            logger.info(f"No category events found for user {user_id}, calling cold start")
            cold_start_res = await self.get_cold_start(limit=limit)
            result = {"listings": cold_start_res, "based_on": "cold_start"}
            # Cache it
            try:
                await self.redis_client.set(cache_key, json.dumps(result), ex=RECOMMENDATIONS_TTL_SECONDS)
            except Exception as e:
                logger.error(f"Failed to write to Redis cache: {str(e)}")
            return result

        # 4. Build Elasticsearch query
        # Must match active, non-expired, and frequent categories
        must_clauses = [
            {"term": {"status": "active"}},
            {"range": {"expires_at": {"gt": "now"}}},
            {
                "bool": {
                    "should": [
                        {"terms": {"category": frequent_categories}},
                        {"terms": {"category_id": frequent_categories}}
                    ],
                    "minimum_should_match": 1
                }
            }
        ]

        must_not_clauses = []
        if viewed_ids:
            must_not_clauses.append({"terms": {"id": viewed_ids}})

        # Basic function_score ranking logic exactly like search-service
        functions = [
            # Recency Gauss decay
            {
                "gauss": {
                    "createdAt": {
                        "origin": "now",
                        "scale": "7d",
                        "offset": "1d",
                        "decay": 0.5
                    }
                },
                "weight": 1.0
            },
            # Quality script score
            {
                "script_score": {
                    "script": {
                        "source": """
                            double score = 0;
                            if (doc.containsKey('images_count') && doc['images_count'].size() > 0) {
                                score += doc['images_count'].value * 0.1;
                            }
                            if (doc.containsKey('description_length') && doc['description_length'].size() > 0) {
                                score += Math.min(doc['description_length'].value / 100.0, 1.0) * 0.1;
                            }
                            return score;
                        """
                    }
                },
                "weight": 1.0
            },
            # Seller average rating script score
            {
                "script_score": {
                    "script": {
                        "source": """
                            if (doc.containsKey('seller_average_rating') && doc['seller_average_rating'].size() > 0) {
                                return doc['seller_average_rating'].value / 5.0;
                            }
                            return 0;
                        """
                    }
                },
                "weight": 1.0
            },
            # Price competitiveness modifier
            {
                "field_value_factor": {
                    "field": "price",
                    "modifier": "reciprocal",
                    "missing": 1
                },
                "weight": 1.0
            }
        ]

        body = {
            "query": {
                "function_score": {
                    "query": {
                        "bool": {
                            "must": must_clauses,
                            "must_not": must_not_clauses
                        }
                    },
                    "functions": functions,
                    "score_mode": "sum",
                    "boost_mode": "multiply"
                }
            },
            "size": limit
        }

        listings = []
        try:
            res = await self.es_client.search(index=self.index_name, body=body)
            hits = res.get("hits", {}).get("hits", [])
            listings = [self._map_hit(h) for h in hits]
        except Exception as e:
            logger.warning(f"Elasticsearch function_score query failed: {str(e)}. Attempting fallback query.")
            
            # Fallback query: omit status and expires_at, and search by category
            fallback_must = [
                {
                    "bool": {
                        "should": [
                            {"terms": {"category": frequent_categories}},
                            {"terms": {"category_id": frequent_categories}}
                        ],
                        "minimum_should_match": 1
                    }
                }
            ]
            fallback_body = {
                "query": {
                    "bool": {
                        "must": fallback_must,
                        "must_not": must_not_clauses
                    }
                },
                "sort": [
                    {"createdAt": {"order": "desc"}}
                ],
                "size": limit
            }
            try:
                res = await self.es_client.search(index=self.index_name, body=fallback_body)
                hits = res.get("hits", {}).get("hits", [])
                listings = [self._map_hit(h) for h in hits]
            except Exception as fe:
                logger.error(f"Fallback Elasticsearch query also failed: {str(fe)}")

        # If we got no listings, trigger cold start
        if not listings:
            logger.info(f"No listings found from category query, falling back to cold start")
            listings = await self.get_cold_start(limit=limit)
            result = {"listings": listings, "based_on": "cold_start"}
        else:
            result = {"listings": listings, "based_on": "frequent_categories"}

        # 5. Cache the result
        try:
            await self.redis_client.set(cache_key, json.dumps(result), ex=RECOMMENDATIONS_TTL_SECONDS)
        except Exception as e:
            logger.error(f"Failed to cache recommendations in Redis: {str(e)}")

        return result

recommendation_service = RecommendationService()
