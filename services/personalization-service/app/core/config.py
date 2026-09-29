import os
from urllib.parse import quote
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8002
    ENV: str = "development"
    
    # Postgres (db/migrations/0003: user_events). DATABASE_URL, or built from DB_* like the
    # Node services (common/database.ts).
    DATABASE_URL: str = ""
    DB_POOL_MAX: int = 10
    DB_STATEMENT_TIMEOUT_MS: int = 5000
    REDIS_URL: str = ""
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    # Required: no default, a committed secret is a public secret.
    JWT_ACCESS_SECRET: str

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
            if "localhost" in self.ELASTICSEARCH_URL:
                self.ELASTICSEARCH_URL = self.ELASTICSEARCH_URL.replace("localhost", "elasticsearch")

        # Check for ELASTICSEARCH_NODE environment variable commonly used in NestJS services
        es_node = os.getenv("ELASTICSEARCH_NODE")
        if es_node:
            self.ELASTICSEARCH_URL = es_node

        if not self.DATABASE_URL:
            user = os.getenv("DB_USER") or os.getenv("DATABASE_USER") or "postgres"
            password = os.getenv("DB_PASSWORD") or os.getenv("DATABASE_PASSWORD") or ""
            host = os.getenv("DB_HOST") or os.getenv("DATABASE_HOST") or ("postgres" if in_docker else "localhost")
            port = os.getenv("DB_PORT") or os.getenv("DATABASE_PORT") or "5432"
            name = os.getenv("DB_NAME") or os.getenv("DATABASE_NAME") or "marad_db"
            auth = f"{quote(user)}:{quote(password)}@" if password else f"{quote(user)}@"
            self.DATABASE_URL = f"postgresql://{auth}{host}:{port}/{name}"

        # Build REDIS_URL if not explicitly provided
        if not self.REDIS_URL:
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = os.getenv("REDIS_PORT", "6379")
            self.REDIS_URL = f"redis://{redis_host}:{redis_port}"

settings = Settings()
