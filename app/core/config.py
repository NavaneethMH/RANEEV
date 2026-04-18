from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str = "sqlite:///./raneev.db"
    REDIS_URL: str = "redis://localhost:6379"
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    SMS_API_KEY: Optional[str] = None
    SMS_API_SECRET: Optional[str] = None
    SECRET_KEY: str = "raneev-dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

settings = Settings()
