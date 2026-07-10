"""Mock Kubernetes API endpoints for testing without real cluster"""

from fastapi import APIRouter
from models.mock_data import MOCK_PODS, MOCK_RBAC, MOCK_PRIVILEGED, build_mock_topology

router = APIRouter(tags=["mock"])

@router.get("/mock/pods")
async def get_pods_mock():
    """Return mock pods with consistent status envelope."""
    return {"status": "mock", "items": MOCK_PODS}

@router.get("/mock/topology")
async def get_topology_mock():
    """Return mock topology with cluster nodes, pods, and services"""
    return build_mock_topology()

@router.get("/mock/rbac")
async def get_rbac_mock():
    """Return mock RBAC"""
    return MOCK_RBAC

@router.get("/mock/privileged")
async def get_privileged_mock():
    """Return mock privileged pods"""
    return MOCK_PRIVILEGED
