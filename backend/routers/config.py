from fastapi import APIRouter, Depends
from services.config_service import get_storage_config, get_network_config
from dependencies import get_k8s_client, verify_api_key
from config import Settings

router = APIRouter()

# Mock fallback data for when K8s storage is unavailable
MOCK_STORAGE = {
    "storageClasses": [
        {
            "metadata": {
                "name": "standard",
                "annotations": {
                    "storageclass.kubernetes.io/is-default-class": "true"
                }
            },
            "provisioner": "kubernetes.io/aws-ebs"
        },
        {
            "metadata": {
                "name": "fast-ssd",
                "annotations": {}
            },
            "provisioner": "kubernetes.io/aws-ebs"
        },
        {
            "metadata": {
                "name": "slow-hdd",
                "annotations": {}
            },
            "provisioner": "kubernetes.io/aws-ebs"
        }
    ],
    "persistentVolumes": [
        {
            "metadata": {"name": "pv-logs-001"},
            "spec": {
                "capacity": {"storage": "50Gi"},
                "accessModes": ["ReadWriteOnce"],
                "persistentVolumeReclaimPolicy": "Retain",
                "claimRef": None
            },
            "status": {"phase": "Available"}
        },
        {
            "metadata": {"name": "pv-data-002"},
            "spec": {
                "capacity": {"storage": "100Gi"},
                "accessModes": ["ReadWriteMany"],
                "persistentVolumeReclaimPolicy": "Delete",
                "claimRef": {"name": "data-pvc"}
            },
            "status": {"phase": "Bound"}
        }
    ],
    "persistentVolumeClaims": [
        {
            "metadata": {
                "uid": "mock-pvc-001",
                "name": "data-pvc",
                "namespace": "production"
            },
            "status": {"phase": "Bound"},
            "spec": {
                "resources": {
                    "requests": {"storage": "100Gi"}
                }
            }
        },
        {
            "metadata": {
                "uid": "mock-pvc-002",
                "name": "logs-pvc",
                "namespace": "default"
            },
            "status": {"phase": "Pending"},
            "spec": {
                "resources": {
                    "requests": {"storage": "10Gi"}
                }
            }
        }
    ]
}

@router.get("/config/storage")
async def fetch_storage_config(api_client=Depends(get_k8s_client), _: Settings = Depends(verify_api_key)):
    try:
        result = await get_storage_config(api_client)
        if not result or not result.get("storageClasses"):
            print("Storage config empty, using mock data")
            return {"status": "mock", "data": MOCK_STORAGE}
        return {"status": "success", "data": result}
    except Exception as e:
        print(f"Config K8s connection failed: {e}, using mock data")
        return {"status": "mock", "data": MOCK_STORAGE}

@router.get("/config/network")
async def fetch_network_config(api_client=Depends(get_k8s_client), _: Settings = Depends(verify_api_key)):
    try:
        result = await get_network_config(api_client)
        if not result:
            print("Network config empty, using mock data")
            return []
        return result
    except Exception as e:
        print(f"Config K8s connection failed: {e}, returning empty")
        return []
