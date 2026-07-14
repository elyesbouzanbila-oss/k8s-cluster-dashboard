from fastapi import Depends
from typing import AsyncGenerator

from connection.models import ConnectionConfig
from connection.factory import create_api_client
from config import get_settings, Settings
from services.logging_service import get_logger

logger = get_logger(__name__)


async def get_settings_dep() -> Settings:
	return get_settings()


async def get_connection_config() -> ConnectionConfig:
	"""Get Kubernetes connection configuration from environment."""
	return ConnectionConfig.from_env()


async def get_k8s_client(
	connection: ConnectionConfig = Depends(get_connection_config),
) -> AsyncGenerator:
	"""FastAPI dependency that yields a configured Kubernetes ApiClient.

	If the Kubernetes API is unreachable, yields None instead of raising
	HTTPException 500 — this lets endpoint handlers fall through to their
	mock-data fallback logic.

	No longer requires X-API-Key header — the frontend no longer ships
	the API key to the browser. In production, put the backend behind an
	authenticating reverse proxy (nginx + OIDC/mTLS, Istio, or similar).

	Usage in a router:
		async def handler(api_client = Depends(get_k8s_client)):
			if api_client is None:
				return {"status": "mock", "data": MOCK_DATA}
			v1 = kubernetes_asyncio.client.CoreV1Api(api_client)
	"""
	api_client = None
	try:
		api_client = await create_api_client(connection)
	except Exception as exc:
		logger.warning(f"Kubernetes API connection failed: {exc} — endpoints will return mock data")

	try:
		yield api_client
	finally:
		if api_client is not None:
			try:
				await api_client.close()
			except Exception:
				pass
