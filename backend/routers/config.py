from fastapi import APIRouter, Depends
from services.config_service import get_storage_config, get_network_config
from dependencies import get_k8s_client, verify_api_key
from config import Settings

router = APIRouter()

@router.get("/config/storage")
async def fetch_storage_config(api_client=Depends(get_k8s_client), _: Settings = Depends(verify_api_key)):
    try:
        return await get_storage_config(api_client)
    except Exception as e:
        print(f"Config K8s connection failed: {e}, returning empty")
        return {"storageClasses": [], "persistentVolumes": [], "persistentVolumeClaims": []}

@router.get("/config/network")
async def fetch_network_config(api_client=Depends(get_k8s_client), _: Settings = Depends(verify_api_key)):
    try:
        return await get_network_config(api_client)
    except Exception as e:
        print(f"Config K8s connection failed: {e}, returning empty")
        return []
