"""CNI (Calico) diagnostic endpoints."""

from fastapi import APIRouter, Depends, Query
from typing import Any, Dict, Optional

from config import Settings
from dependencies import get_k8s_client, get_settings_dep, verify_api_key
from models.mock_data import (
    MOCK_CALICO_NODES,
    MOCK_BGP_PEERS,
    MOCK_IP_POOLS,
    MOCK_IPAM_BLOCKS,
    MOCK_CNI_POLICIES,
    MOCK_FELIX_METRICS,
)
from services import calico_service
from services.felix_metrics_service import get_felix_metrics, get_felix_metrics_time_series

router = APIRouter(prefix="/api/cni", tags=["CNI / Calico"])


@router.get("/nodes")
async def list_cni_nodes(
    api_client=Depends(get_k8s_client),
    _: Settings = Depends(verify_api_key),
) -> Dict[str, Any]:
    """Per-node Calico agent status (Felix ready, BIRD/BGP ready, IP, uptime)."""
    try:
        data = await calico_service.get_calico_nodes(api_client)
        return {"status": "success", "data": data}
    except Exception as e:
        print(f"CNI nodes failed: {e}, using mock data")
        return {"status": "mock", "data": MOCK_CALICO_NODES}


@router.get("/bgp-peers")
async def list_bgp_peers(
    api_client=Depends(get_k8s_client),
    _: Settings = Depends(verify_api_key),
) -> Dict[str, Any]:
    """BGP peer list with session state per node."""
    try:
        data = await calico_service.get_bgp_peers(api_client)
        return {"status": "success", "data": data}
    except Exception as e:
        print(f"CNI BGP peers failed: {e}, using mock data")
        return {"status": "mock", "data": MOCK_BGP_PEERS}


@router.get("/ippools")
async def list_ip_pools(
    api_client=Depends(get_k8s_client),
    _: Settings = Depends(verify_api_key),
) -> Dict[str, Any]:
    """IP pool definitions (CIDR, mode, disabled, NAT outgoing)."""
    try:
        data = await calico_service.get_ip_pools(api_client)
        return {"status": "success", "data": data}
    except Exception as e:
        print(f"CNI IP pools failed: {e}, using mock data")
        return {"status": "mock", "data": MOCK_IP_POOLS}


@router.get("/ipam/utilization")
async def ipam_utilization(
    api_client=Depends(get_k8s_client),
    _: Settings = Depends(verify_api_key),
) -> Dict[str, Any]:
    """Allocated vs. free IPs per pool / per node block."""
    try:
        data = await calico_service.get_ipam_utilization(api_client)
        return {"status": "success", "data": data}
    except Exception as e:
        print(f"CNI IPAM utilization failed: {e}, using mock data")
        return {"status": "mock", "data": MOCK_IPAM_BLOCKS}


@router.get("/policies")
async def list_cni_policies(
    api_client=Depends(get_k8s_client),
    _: Settings = Depends(verify_api_key),
) -> Dict[str, Any]:
    """All NetworkPolicy + GlobalNetworkPolicy, which pods/namespaces they select."""
    try:
        data = await calico_service.get_cni_policies(api_client)
        return {"status": "success", "data": data}
    except Exception as e:
        print(f"CNI policies failed: {e}, using mock data")
        return {"status": "mock", "data": MOCK_CNI_POLICIES}


@router.get("/topology")
async def cni_topology(
    api_client=Depends(get_k8s_client),
    _: Settings = Depends(verify_api_key),
) -> Dict[str, Any]:
    """Node-to-node BGP mesh + pod overlay topology."""
    try:
        data = await calico_service.get_cni_topology(api_client)
        return {"status": "success", "data": data}
    except Exception as e:
        print(f"CNI topology failed: {e}, using mock data")
        from models.mock_data import MOCK_NODES
        nodes = [{"id": f"node:{n['name']}", "name": n["name"], "role": n["role"], "ip": n["ip"]} for n in MOCK_NODES]
        return {
            "status": "mock",
            "data": {
                "nodes": nodes,
                "edges": [
                    {"source": "node:master-1", "target": "bgp:10.0.0.1", "type": "bgp"},
                    {"source": "node:worker-1", "target": "bgp:10.0.0.1", "type": "bgp"},
                    {"source": "node:master-1", "target": "node:worker-1", "type": "overlay"},
                    {"source": "node:master-1", "target": "node:worker-2", "type": "overlay"},
                ],
            },
        }


@router.get("/metrics/felix")
async def felix_metrics(
    include_series: bool = Query(False, description="Include time-series data for the past hour"),
    settings: Settings = Depends(get_settings_dep),
    _: Settings = Depends(verify_api_key),
) -> Dict[str, Any]:
    """Felix performance counters: policy evaluations, dropped packets, denied connections, BGP sessions."""
    try:
        gauges = await get_felix_metrics(settings)
        response: Dict[str, Any] = {"status": "success", "data": gauges}

        if include_series:
            series = await get_felix_metrics_time_series(settings)
            response["time_series"] = series

        return response
    except Exception as e:
        print(f"Felix metrics query failed: {e}, using mock data")
        response: Dict[str, Any] = {"status": "mock", "data": MOCK_FELIX_METRICS}
        if include_series:
            response["time_series"] = {}
        return response


@router.post("/diagnostics/connectivity")
async def connectivity_diagnostics(
    source_pod: str = Query(..., description="Source pod name"),
    source_namespace: str = Query("default", description="Source pod namespace"),
    target_pod: Optional[str] = Query(None, description="Target pod name"),
    target_service: Optional[str] = Query(None, description="Target service name"),
    target_namespace: str = Query("default", description="Target namespace"),
    _: Settings = Depends(verify_api_key),
) -> Dict[str, Any]:
    """On-demand connectivity test between pods / services.

    NOTE: Full implementation planned for Phase 4. Currently returns a placeholder.
    """
    # Placeholder response — real implementation will spawn a diagnostic job
    return {
        "status": "mock",
        "data": {
            "source": f"{source_namespace}/{source_pod}",
            "target": (
                f"{target_namespace}/{target_service}" if target_service
                else f"{target_namespace}/{target_pod}"
            ),
            "reachable": None,
            "latency_ms": None,
            "note": "Connectivity diagnostics are not yet implemented. Phase 4 will add on-demand reachability tests via ephemeral diagnostic jobs.",
        },
    }
