import redis.asyncio as redis
from models.threat import FalcoEvent
from config import Settings

class ThreatService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.redis = redis.from_url(settings.REDIS_URL)

    async def publish_falco_event(self, event: FalcoEvent):
        await self.redis.publish("falco:events", event.model_dump_json())

    async def subscribe_events(self):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("falco:events")
        return pubsub
