from fastapi import APIRouter, Depends
from typing import List, Dict

from connection.models import ConnectionConfig
from dependencies import get_k8s_client
from models.security import RbacBinding, PrivilegedPod
from services import security_service

router = APIRouter()

@router.get("/rbac", response_model=List[RbacBinding])
async def list_rbac(connection: ConnectionConfig = Depends(), api_client=Depends(get_k8s_client)):
    """Return a summary of ClusterRoleBindings and RoleBindings."""
    return await security_service.get_rbac(api_client)

@router.get("/privileged", response_model=List[PrivilegedPod])
async def privileged_pods(connection: ConnectionConfig = Depends(), api_client=Depends(get_k8s_client)):
    """List pods that are running with privileged or runAsRoot security contexts."""
    return await security_service.get_privileged_pods(api_client)
