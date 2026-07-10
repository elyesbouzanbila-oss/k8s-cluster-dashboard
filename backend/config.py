from functools import lru_cache
from typing import Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER = "your-secret-api-key-change-this"


class Settings(BaseSettings):
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_PASSWORD: Optional[str] = None
    API_KEY: str
    FRONTEND_URL: str = "http://localhost:5173"

    # Separate secret for the Falco webhook (not exposed to browsers)
    FALCO_WEBHOOK_SECRET: Optional[str] = None

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

    @field_validator("API_KEY")
    @classmethod
    def reject_placeholder(cls, v: str) -> str:
        if v == _PLACEHOLDER:
            raise ValueError(
                f"API_KEY is still the placeholder {_PLACEHOLDER!r} — set a real value "
                "via the API_KEY environment variable or .env file"
            )
        return v

    @model_validator(mode="after")
    def _embed_redis_password(self) -> "Settings":
        """Embed REDIS_PASSWORD into REDIS_URL so the redis client doesn't need
        separate password handling. No-op if REDIS_PASSWORD is not set or if
        the URL already contains credentials (has '@' before the host)."""
        if self.REDIS_PASSWORD and "@" not in self.REDIS_URL:
            self.REDIS_URL = self.REDIS_URL.replace(
                "redis://", f"redis://:{self.REDIS_PASSWORD}@"
            )
        return self

    model_config = SettingsConfigDict(env_file=".env")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()