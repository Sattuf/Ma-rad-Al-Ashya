from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """إعدادات خدمة التخصيص — Personalization Service Configuration"""

    PORT: int = 8002
    ENV: str = "development"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
