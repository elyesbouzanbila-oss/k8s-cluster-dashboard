from typing import Optional

import redis.asyncio as redis
from config import Settings
from models.threat import FalcoEvent
from services.logging_service import get_logger

logger = get_logger(__name__)


class ThreatService:
    """Redis-backed threat event pub/sub with shared connection pool."""

    _pool: Optional[redis.ConnectionPool] = None

    @classmethod
    def get_pool(cls, settings: Settings) -> redis.ConnectionPool:
        if cls._pool is None:
            cls._pool = redis.ConnectionPool.from_url(settings.REDIS_URL, max_connections=20)
        return cls._pool

    def __init__(self, settings: Settings):
        self.settings = settings
        self.redis = redis.Redis(connection_pool=self.get_pool(settings))

    async def publish_falco_event(self, event: FalcoEvent):
        await self.redis.publish("falco:events", event.model_dump_json())

    async def subscribe_events(self):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("falco:events")
        return pubsub
