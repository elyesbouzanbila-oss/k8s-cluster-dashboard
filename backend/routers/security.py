from fastapi import APIRouter, Depends
from typing import List, Dict

from connection.models import ConnectionConfig
from dependencies import get_k8s_client, get_connection_config
from models.security import RbacBinding, PrivilegedPod
from models.mock_data import MOCK_RBAC as _MOCK_RBAC, MOCK_PRIVILEGED as _MOCK_PRIVILEGED
from services import security_service

router = APIRouter()

MOCK_RBAC = _MOCK_RBAC
MOCK_PRIVILEGED = _MOCK_PRIVILEGED

@router.get("/rbac")
async def list_rbac(connection: ConnectionConfig = Depends(get_connection_config), api_client=Depends(get_k8s_client)):
    #Return a summary of ClusterRoleBindings and RoleBindings.
    try:
        data = await security_service.get_rbac(api_client)
        return {"status": "success", "data": [d.model_dump() for d in data]}
    except Exception as e:
        print(f"K8s connection failed: {e}, using mock RBAC data")
        return {"status": "mock", "data": MOCK_RBAC}

@router.get("/privileged")
async def privileged_pods(connection: ConnectionConfig = Depends(get_connection_config), api_client=Depends(get_k8s_client)):
    #List pods that are running with privileged or runAsRoot security contexts.
    try:
        data = await security_service.get_privileged_pods(api_client)
        return {"status": "success", "data": [d.model_dump() for d in data]}
    except Exception as e:
        print(f"K8s connection failed: {e}, using mock privileged pods data")
        return {"status": "mock", "data": MOCK_PRIVILEGED}
