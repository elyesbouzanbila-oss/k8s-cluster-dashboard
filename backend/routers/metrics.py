from fastapi import APIRouter, Depends
from services.metrics_service import get_node_metrics, get_pod_metrics
from dependencies import get_k8s_client

router = APIRouter()

@router.get("/metrics/nodes")
async def fetch_node_metrics(api_client=Depends(get_k8s_client)):
    return await get_node_metrics(api_client)

@router.get("/metrics/pods/{namespace}")
async def fetch_pod_metrics(namespace: str, api_client=Depends(get_k8s_client)):
    return await get_pod_metrics(api_client, namespace)
