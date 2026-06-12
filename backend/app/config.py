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

    def __init__(self, **values):
        super().__init__(**values)
        
        # 1. Resolve DATABASE_URL from environment if set
        db_env = os.environ.get("DATABASE_URL")
        if db_env:
            self.DATABASE_URL = db_env
            
        # 2. Resolve SYNC_DATABASE_URL from environment if set, otherwise derive from DATABASE_URL
        sync_env = os.environ.get("SYNC_DATABASE_URL")
        if sync_env:
            self.SYNC_DATABASE_URL = sync_env
        elif db_env:
            self.SYNC_DATABASE_URL = db_env
            
        # 3. Clean and prepare async DATABASE_URL (for asyncpg)
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            
        if "sslmode=" in url:
            import re
            url = re.sub(r'sslmode=[^&]+', 'ssl=require', url)
        elif "ssl=" not in url and "neon.tech" in url:
            url = url + ("&" if "?" in url else "?") + "ssl=require"
            
        self.DATABASE_URL = url
        
        # 4. Clean and prepare sync SYNC_DATABASE_URL (for psycopg2)
        sync_url = self.SYNC_DATABASE_URL
        if sync_url.startswith("postgresql+asyncpg://"):
            sync_url = sync_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        elif sync_url.startswith("postgres://"):
            sync_url = sync_url.replace("postgres://", "postgresql://", 1)
            
        if "ssl=" in sync_url:
            import re
            sync_url = re.sub(r'ssl=[^&]+', 'sslmode=require', sync_url)
        elif "sslmode=" not in sync_url and "neon.tech" in sync_url:
            sync_url = sync_url + ("&" if "?" in sync_url else "?") + "sslmode=require"
            
        self.SYNC_DATABASE_URL = sync_url

settings = Settings()

