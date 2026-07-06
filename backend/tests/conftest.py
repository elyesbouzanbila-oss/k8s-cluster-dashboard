"""
Pytest configuration and shared fixtures for CNI Command Center tests.

Provides reusable fixtures to avoid duplicating mock setup across
async service tests, router tests, and unit tests.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from typing import AsyncGenerator, Tuple

import pytest

from config import Settings


# ─── Settings ─────────────────────────────────────────────────────

@pytest.fixture
def test_settings() -> Settings:
    """Shared Settings instance with a known API key.

    All tests that need a Settings object should use this fixture
    rather than constructing Settings() directly, since the latter may
    attempt to read environment variables.
    """
    return Settings(API_KEY="test-key")


# ─── Mock K8s API client ─────────────────────────────────────────

@pytest.fixture
def mock_k8s_client() -> AsyncMock:
    """Return a bare AsyncMock suitable as a kubernetes_asyncio ApiClient.

    Usage in async service tests:

        async def test_something(mock_k8s_client):
            mock_custom = AsyncMock()
            with patch("services.calico_service.k8s_client.CustomObjectsApi",
                       return_value=mock_custom):
                mock_custom.list_cluster_custom_object.return_value = {"items": []}
                ...
    """
    return AsyncMock()


@pytest.fixture
def mock_k8s_custom_api() -> AsyncMock:
    """Patch ``services.calico_service.k8s_client.CustomObjectsApi`` and yield
    a prepared ``CustomObjectsApi`` mock.

    The fixture activates the patch at test start and tears it down
    automatically.  The returned ``custom_api`` AsyncMock has
    ``list_cluster_custom_object`` pre-configured so tests can set
    ``side_effect`` or ``return_value``.
    """
    custom_api = AsyncMock()
    custom_api.list_cluster_custom_object = AsyncMock()
    with patch(
        "services.calico_service.k8s_client.CustomObjectsApi",
        return_value=custom_api,
    ):
        yield custom_api
