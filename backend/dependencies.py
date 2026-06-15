from fastapi import Depends, HTTPException, Header, status
from typing import AsyncGenerator, Optional

from connection.models import ConnectionConfig
from connection.factory import create_api_client
from config import get_settings, Settings


async def get_settings_dep() -> Settings:
	return get_settings()


async def verify_api_key(
	x_api_key: Optional[str] = Header(None),
	settings: Settings = Depends(get_settings_dep)
) -> Settings:
	"""Verify API key from X-API-Key header."""
	if not x_api_key:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Missing X-API-Key header",
			headers={"WWW-Authenticate": "Bearer"},
		)
	if x_api_key != settings.API_KEY:
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="Invalid API key",
		)
	return settings


async def get_k8s_client(
	connection: ConnectionConfig = Depends(),
	_: Settings = Depends(verify_api_key)
) -> AsyncGenerator:
	"""FastAPI dependency that yields a configured Kubernetes ApiClient.
	
	Requires valid X-API-Key header.

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
