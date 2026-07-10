from fastapi import Depends, HTTPException
from typing import AsyncGenerator

from connection.models import ConnectionConfig
from connection.factory import create_api_client
from config import get_settings, Settings


async def get_settings_dep() -> Settings:
	return get_settings()


async def get_connection_config() -> ConnectionConfig:
	"""Get Kubernetes connection configuration from environment."""
	return ConnectionConfig.from_env()


async def get_k8s_client(
	connection: ConnectionConfig = Depends(get_connection_config),
) -> AsyncGenerator:
	"""FastAPI dependency that yields a configured Kubernetes ApiClient.

	No longer requires X-API-Key header — the frontend no longer ships
	the API key to the browser. In production, put the backend behind an
	authenticating reverse proxy (nginx + OIDC/mTLS, Istio, or similar).

	Usage in a router:
		async def handler(api_client = Depends(get_k8s_client)):
			v1 = kubernetes_asyncio.client.CoreV1Api(api_client)
	"""
	try:
		api_client = await create_api_client(connection)
		yield api_client
		try:
			await api_client.close()
		except Exception:
			pass
	except Exception as exc:
		raise HTTPException(status_code=500, detail=str(exc))
