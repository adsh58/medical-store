from pydantic_settings import BaseSettings
from pydantic import Field
import os

class Settings(BaseSettings):
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://medical_user:medical_password@localhost:5432/medical_store",
        description="Async PostgreSQL connection string"
    )
    SYNC_DATABASE_URL: str = Field(
        default="postgresql://medical_user:medical_password@localhost:5432/medical_store",
        description="Sync PostgreSQL connection string (useful for migrations)"
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for caching and broker tasks"
    )
    JWT_SECRET_KEY: str = Field(
        default="9a622543e498c4f9f2579dfd9e29ee872b7a9505c8d6df022b7a9de0ea8e4c76",
        description="Secret key for signing access tokens"
    )
    JWT_REFRESH_SECRET_KEY: str = Field(
        default="51bca4db51c8a14a3f5aef346d03cf873e35a3bb4bb5ef91de4a3dfb4e9fcf01",
        description="Secret key for signing refresh tokens"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=15)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    GEMINI_API_KEY: str = Field(default="mock_key")
    LOG_LEVEL: str = Field(default="INFO")
    FRONTEND_ORIGIN: str = Field(
        default="http://localhost:3000",
        description="Allowed frontend origin for CORS (set to your Vercel URL in production)"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
