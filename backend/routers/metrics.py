from fastapi import APIRouter, Depends
from services.metrics_service import get_node_metrics, get_pod_metrics, get_all_pod_metrics
from dependencies import get_k8s_client, verify_api_key
from config import Settings
from models.mock_data import MOCK_POD_METRICS

router = APIRouter()

# Mock fallback data
MOCK_NODE_METRICS = [
    {
        "name": "master-1",
        "os": "Ubuntu 22.04 LTS",
        "kubeletVersion": "v1.28.2",
        "capacity": {"cpu": "4", "memory": "16Gi"},
        "usage": {"cpu": "950m", "memory": "6.5Gi"}
    },
    {
        "name": "worker-1",
        "os": "Ubuntu 22.04 LTS",
        "kubeletVersion": "v1.28.2",
        "capacity": {"cpu": "8", "memory": "32Gi"},
        "usage": {"cpu": "2.1", "memory": "12Gi"}
    },
    {
        "name": "worker-2",
        "os": "Ubuntu 22.04 LTS",
        "kubeletVersion": "v1.28.2",
        "capacity": {"cpu": "8", "memory": "32Gi"},
        "usage": {"cpu": "1.5", "memory": "8.2Gi"}
    }
]

@router.get("/metrics/nodes")
async def fetch_node_metrics(api_client=Depends(get_k8s_client), _: Settings = Depends(verify_api_key)):
    try:
        result = await get_node_metrics(api_client)
        if not result:
            print("Metrics returned empty (metrics-server likely not installed), using mock data")
            return {"status": "mock", "data": MOCK_NODE_METRICS}
        return {"status": "success", "data": result}
    except Exception as e:
        print(f"Metrics K8s connection failed: {e}, using mock data")
        return {"status": "mock", "data": MOCK_NODE_METRICS}

@router.get("/metrics/pods/{namespace}")
async def fetch_pod_metrics(namespace: str, api_client=Depends(get_k8s_client), _: Settings = Depends(verify_api_key)):
    try:
        result = await get_pod_metrics(api_client, namespace)
        if not result:
            print("Pod metrics empty, returning empty")
            return {"status": "mock", "data": []}
        return {"status": "success", "data": result}
    except Exception as e:
        print(f"Metrics K8s connection failed: {e}, returning empty")
        return {"status": "error", "data": []}


@router.get("/metrics/pods")
async def fetch_all_pod_metrics(api_client=Depends(get_k8s_client), _: Settings = Depends(verify_api_key)):
    """
    Returns per-pod resource consumption across ALL namespaces.
    Data sourced from cAdvisor via the metrics-server API, enriched
    with container resource requests/limits from pod specs.
    """
    try:
        result = await get_all_pod_metrics(api_client)
        if not result:
            print("Pod metrics returned empty (metrics-server likely not installed), using mock data")
            return {"status": "mock", "data": MOCK_POD_METRICS}
        return {"status": "success", "data": result}
    except Exception as e:
        print(f"Pod metrics K8s connection failed: {e}, using mock data")
        return {"status": "mock", "data": MOCK_POD_METRICS}
