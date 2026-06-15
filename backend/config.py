from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    AI_PROVIDER: str = "claude"
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    OLLAMA_HOST: Optional[str] = None
    REDIS_URL: str = "redis://redis:6379/0"
    API_KEY: str 
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

def get_settings() -> Settings:
    return Settings()