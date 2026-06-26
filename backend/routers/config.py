from fastapi import APIRouter, Depends
from services.config_service import get_storage_config, get_network_config
from dependencies import get_k8s_client

router = APIRouter()

@router.get("/config/storage")
async def fetch_storage_config(api_client=Depends(get_k8s_client)):
    return await get_storage_config(api_client)

@router.get("/config/network")
async def fetch_network_config(api_client=Depends(get_k8s_client)):
    return await get_network_config(api_client)
