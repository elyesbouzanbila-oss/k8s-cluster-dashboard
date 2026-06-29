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
    
    # K8s connection settings
    K8S_MODE: str = "kubeconfig"
    K8S_SERVER: Optional[str] = None
    K8S_TOKEN: Optional[str] = None
    K8S_CA_CERT: Optional[str] = None
    K8S_KUBECONFIG: Optional[str] = None
    K8S_KUBECONFIG_PATH: Optional[str] = None

    # Prometheus connection settings
    PROMETHEUS_URL: str = "http://prometheus-k8s.monitoring.svc:9090"
    PROMETHEUS_TIMEOUT: int = 10

    class Config:
        env_file = ".env"

def get_settings() -> Settings:
    return Settings()