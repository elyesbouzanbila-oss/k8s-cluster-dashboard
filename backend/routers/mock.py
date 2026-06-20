"""Mock Kubernetes API endpoints for testing without real cluster"""

from fastapi import APIRouter, Depends
from dependencies import verify_api_key
from config import Settings

router = APIRouter(tags=["mock"])

# Mock data
MOCK_PODS = [
    {
        "name": "api-server-prod-1",
        "namespace": "production",
        "pod_ip": "10.244.1.10",
        "node_name": "docker-desktop",
        "phase": "Running",
        "labels": {"app": "api-server", "version": "v2.1.0"},
        "containers": [
            {"name": "main", "image": "myapp:v2.1.0"},
            {"name": "sidecar", "image": "envoyproxy:latest"}
        ]
    },
    {
        "name": "database-backup",
        "namespace": "production",
        "pod_ip": "10.244.2.15",
        "node_name": "docker-desktop",
        "phase": "Running",
        "labels": {"app": "database", "job": "backup"},
        "containers": [{"name": "postgres-backup", "image": "postgres:15"}]
    },
    {
        "name": "prometheus-0",
        "namespace": "monitoring",
        "pod_ip": "10.244.3.20",
        "node_name": "docker-desktop",
        "phase": "Running",
        "labels": {"app": "prometheus"},
        "containers": [{"name": "prometheus", "image": "prom/prometheus:latest"}]
    },
    {
        "name": "redis-cache",
        "namespace": "production",
        "pod_ip": "10.244.2.25",
        "node_name": "docker-desktop",
        "phase": "Running",
        "labels": {"app": "redis"},
        "containers": [{"name": "redis", "image": "redis:7-alpine"}]
    }
]

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

@router.get("/mock/pods")
async def get_pods_mock(settings: str = Depends(verify_api_key)):
    """Return mock pods"""
    return {"items": MOCK_PODS}

@router.get("/mock/topology")
async def get_topology_mock(settings: str = Depends(verify_api_key)):
    """Return mock topology"""
    nodes = []
    services = [
        {"namespace": "production", "name": "api-service"},
        {"namespace": "production", "name": "database-service"},
        {"namespace": "monitoring", "name": "prometheus"}
    ]
    
    for svc in services:
        nodes.append({
            "id": f"svc:{svc['namespace']}/{svc['name']}",
            "type": "service",
            "namespace": svc['namespace'],
            "name": svc['name']
        })
    
    for pod in MOCK_PODS:
        nodes.append({
            "id": f"pod:{pod['namespace']}/{pod['name']}",
            "type": "pod",
            "namespace": pod['namespace'],
            "name": pod['name'],
            "ip": pod['pod_ip']
        })
    
    return {"nodes": nodes, "edges": []}

@router.get("/mock/rbac")
async def get_rbac_mock(settings: str = Depends(verify_api_key)):
    """Return mock RBAC"""
    return MOCK_RBAC

@router.get("/mock/privileged")
async def get_privileged_mock(settings: str = Depends(verify_api_key)):
    """Return mock privileged pods"""
    return MOCK_PRIVILEGED
