import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.threat_service import ThreatService
from backend.models.threat import FalcoEvent
from backend.config import Settings

@pytest.fixture
def mock_settings():
    return Settings(REDIS_URL="redis://localhost:6379/0")

@pytest.mark.asyncio
@patch("backend.services.threat_service.redis")
async def test_publish_falco_event(mock_redis, mock_settings):
    mock_redis_instance = MagicMock()
    mock_redis_instance.publish = AsyncMock()
    mock_redis.from_url.return_value = mock_redis_instance
    
    service = ThreatService(mock_settings)
    
    event = FalcoEvent(
        output="A shell was spawned",
        priority="Emergency",
        rule="Terminal shell in container",
        time="2023-01-01T00:00:00Z"
    )
    
    await service.publish_falco_event(event)
    
    mock_redis.from_url.assert_called_once_with(mock_settings.REDIS_URL)
    mock_redis_instance.publish.assert_called_once_with("falco:events", event.model_dump_json())

@pytest.mark.asyncio
@patch("backend.services.threat_service.redis")
async def test_subscribe_events(mock_redis, mock_settings):
    mock_redis_instance = MagicMock()
    mock_pubsub = MagicMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_redis_instance.pubsub.return_value = mock_pubsub
    mock_redis.from_url.return_value = mock_redis_instance
    
    service = ThreatService(mock_settings)
    pubsub = await service.subscribe_events()
    
    mock_pubsub.subscribe.assert_called_once_with("falco:events")
    assert pubsub == mock_pubsub

