from ast import Return

from fastapi import APIRouter, Depends
from typing import List, Dict

from connection.models import ConnectionConfig
from dependencies import get_k8s_client, get_connection_config
from models.security import RbacBinding, PrivilegedPod
from services import security_service

router = APIRouter()

# Mock RBAC data
MOCK_RBAC = [
    {
        "name": "admin-binding",
        "namespace": None,
        "binding_type": "ClusterRoleBinding",
        "role_ref": {"kind": "ClusterRole", "name": "cluster-admin", "api_group": "rbac.authorization.k8s.io"},
        "subjects": [{"kind": "User", "name": "admin@example.com", "namespace": None}]
    },
    {
        "name": "developers-edit",
        "namespace": "production",
        "binding_type": "RoleBinding",
        "role_ref": {"kind": "Role", "name": "editor", "api_group": "rbac.authorization.k8s.io"},
        "subjects": [{"kind": "Group", "name": "developers", "namespace": None}]
    },
    {
        "name": "monitoring-viewer",
        "namespace": "monitoring",
        "binding_type": "RoleBinding",
        "role_ref": {"kind": "Role", "name": "viewer", "api_group": "rbac.authorization.k8s.io"},
        "subjects": [{"kind": "ServiceAccount", "name": "prometheus", "namespace": "monitoring"}]
    }
]

# Mock privileged pods data
MOCK_PRIVILEGED = [
    {
        "name": "prometheus-0",
        "namespace": "monitoring",
        "container": "prometheus",
        "image": "prom/prometheus:latest",
        "privileged": False,
        "run_as_user": None
    }
]

@router.get("/rbac", response_model=List[RbacBinding])
async def list_rbac(connection: ConnectionConfig = Depends(get_connection_config), api_client=Depends(get_k8s_client)):
    #Return a summary of ClusterRoleBindings and RoleBindings.
    try:
        return await security_service.get_rbac(api_client)
    except Exception as e:
        print(f"K8s connection failed: {e}, using mock RBAC data")
        return MOCK_RBAC

@router.get("/privileged", response_model=List[PrivilegedPod])
async def privileged_pods(connection: ConnectionConfig = Depends(get_connection_config), api_client=Depends(get_k8s_client)):
    #List pods that are running with privileged or runAsRoot security contexts.
    try:
        return await security_service.get_privileged_pods(api_client)
    except Exception as e:
        print(f"K8s connection failed: {e}, using mock privileged pods data")
        return MOCK_PRIVILEGED
