import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8002
    ENV: str = "development"
    
    MONGODB_URI: str = "mongodb://marad_user:marad_dev_password@localhost:27017/marad_db?authSource=admin"
    REDIS_URL: str = ""
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    JWT_ACCESS_SECRET: str = "dev-jwt-secret-change-in-production"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }

    def __init__(self, **values):
        super().__init__(**values)
        
        # Detect if running in a Docker environment
        in_docker = os.path.exists('/.dockerenv') or os.getenv("REDIS_HOST") == "redis"
        
        # Adapt defaults for Docker container running on the marad network
        if in_docker:
            if "localhost" in self.MONGODB_URI:
                self.MONGODB_URI = self.MONGODB_URI.replace("localhost", "mongodb")
            if "localhost" in self.ELASTICSEARCH_URL:
                self.ELASTICSEARCH_URL = self.ELASTICSEARCH_URL.replace("localhost", "elasticsearch")

        # Check for ELASTICSEARCH_NODE environment variable commonly used in NestJS services
        es_node = os.getenv("ELASTICSEARCH_NODE")
        if es_node:
            self.ELASTICSEARCH_URL = es_node

        # Build REDIS_URL if not explicitly provided
        if not self.REDIS_URL:
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = os.getenv("REDIS_PORT", "6379")
            self.REDIS_URL = f"redis://{redis_host}:{redis_port}"

settings = Settings()
