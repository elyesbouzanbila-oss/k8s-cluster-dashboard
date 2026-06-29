"""REST endpoints for Prometheus-powered time-series metrics."""

from fastapi import APIRouter, Depends, Query
from typing import Any, Dict, List, Optional
import datetime

from dependencies import get_settings_dep, verify_api_key
from config import Settings
from services.prometheus_service import (
    query_prometheus,
    query_range_prometheus,
    get_pod_cpu_range,
    get_pod_memory_range,
    get_namespace_cpu_range,
    get_namespace_memory_range,
    MOCK_POD_CPU_SERIES,
    MOCK_POD_MEM_SERIES,
    MOCK_NS_CPU_SERIES,
    MOCK_NS_MEM_SERIES,
)

router = APIRouter(prefix="/api/prometheus", tags=["Prometheus"])


@router.get("/query")
async def promql_query(
    q: str = Query(..., description="PromQL query string"),
    time: Optional[str] = Query(None, description="Evaluation timestamp (RFC3339 or Unix)"),
    _: Settings = Depends(verify_api_key),
    settings: Settings = Depends(get_settings_dep),
) -> Dict[str, Any]:
    """Execute an arbitrary instant PromQL query."""
    result = await query_prometheus(settings, q, time)
    if result is None:
        return {"status": "error", "error": "Prometheus not reachable", "data": None}
    return {"status": "success", "data": result}


@router.get("/query-range")
async def promql_query_range(
    q: str = Query(..., description="PromQL query string"),
    start: str = Query(..., description="Start time (RFC3339)"),
    end: str = Query(..., description="End time (RFC3339)"),
    step: str = Query("15s", description="Resolution step"),
    _: Settings = Depends(verify_api_key),
    settings: Settings = Depends(get_settings_dep),
) -> Dict[str, Any]:
    """Execute an arbitrary range PromQL query."""
    result = await query_range_prometheus(settings, q, start, end, step)
    if result is None:
        return {"status": "error", "error": "Prometheus not reachable", "data": None}
    return {"status": "success", "data": result}


@router.get("/pod/cpu")
async def pod_cpu_history(
    namespace: str = Query(..., description="Pod namespace"),
    pod: str = Query(..., description="Pod name"),
    duration: int = Query(60, description="Lookback window in minutes"),
    _: Settings = Depends(verify_api_key),
    settings: Settings = Depends(get_settings_dep),
) -> Dict[str, Any]:
    """CPU usage over time for a specific pod (per container)."""
    try:
        result = await get_pod_cpu_range(settings, namespace, pod, duration)
        if result and result.get("result"):
            return {"status": "success", "data": result}
    except Exception as e:
        print(f"Pod CPU query failed: {e}")
    return {
        "status": "mock",
        "data": {"resultType": "matrix", "result": MOCK_POD_CPU_SERIES},
    }


@router.get("/pod/memory")
async def pod_memory_history(
    namespace: str = Query(..., description="Pod namespace"),
    pod: str = Query(..., description="Pod name"),
    duration: int = Query(60, description="Lookback window in minutes"),
    _: Settings = Depends(verify_api_key),
    settings: Settings = Depends(get_settings_dep),
) -> Dict[str, Any]:
    """Memory usage over time for a specific pod (per container)."""
    try:
        result = await get_pod_memory_range(settings, namespace, pod, duration)
        if result and result.get("result"):
            return {"status": "success", "data": result}
    except Exception as e:
        print(f"Pod memory query failed: {e}")
    return {
        "status": "mock",
        "data": {"resultType": "matrix", "result": MOCK_POD_MEM_SERIES},
    }


@router.get("/namespace/cpu")
async def namespace_cpu_history(
    namespace: str = Query(..., description="Namespace"),
    duration: int = Query(60, description="Lookback window in minutes"),
    _: Settings = Depends(verify_api_key),
    settings: Settings = Depends(get_settings_dep),
) -> Dict[str, Any]:
    """Aggregated CPU usage for all pods in a namespace over time."""
    try:
        result = await get_namespace_cpu_range(settings, namespace, duration)
        if result and result.get("result"):
            return {"status": "success", "data": result}
    except Exception as e:
        print(f"Namespace CPU query failed: {e}")
    return {
        "status": "mock",
        "data": {"resultType": "matrix", "result": MOCK_NS_CPU_SERIES},
    }


@router.get("/namespace/memory")
async def namespace_memory_history(
    namespace: str = Query(..., description="Namespace"),
    duration: int = Query(60, description="Lookback window in minutes"),
    _: Settings = Depends(verify_api_key),
    settings: Settings = Depends(get_settings_dep),
) -> Dict[str, Any]:
    """Aggregated memory usage for all pods in a namespace over time."""
    try:
        result = await get_namespace_memory_range(settings, namespace, duration)
        if result and result.get("result"):
            return {"status": "success", "data": result}
    except Exception as e:
        print(f"Namespace memory query failed: {e}")
    return {
        "status": "mock",
        "data": {"resultType": "matrix", "result": MOCK_NS_MEM_SERIES},
    }
