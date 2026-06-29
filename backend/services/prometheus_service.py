"""Prometheus query service — executes PromQL against Prometheus HTTP API."""

import datetime
from typing import Any, Dict, List, Optional
import httpx
from config import Settings


async def query_prometheus(
    settings: Settings,
    query: str,
    time: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Execute an instant PromQL query.

    Returns the parsed JSON response body on success, or None on failure.
    """
    try:
        params: Dict[str, str] = {"query": query}
        if time:
            params["time"] = time

        async with httpx.AsyncClient(timeout=settings.PROMETHEUS_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.PROMETHEUS_URL}/api/v1/query",
                params=params,
            )
            resp.raise_for_status()
            body = resp.json()
            if body.get("status") == "success":
                return body["data"]
            print(f"Prometheus query returned non-success status: {body.get('status')}")
            return None
    except httpx.TimeoutException:
        print(f"Prometheus query timed out: {query[:80]}...")
        return None
    except httpx.HTTPError as e:
        print(f"Prometheus HTTP error: {e}")
        return None
    except Exception as e:
        print(f"Prometheus query error: {e}")
        return None


async def query_range_prometheus(
    settings: Settings,
    query: str,
    start: str,
    end: str,
    step: str = "15s",
) -> Optional[Dict[str, Any]]:
    """Execute a range PromQL query.

    Returns the parsed JSON response body on success, or None on failure.
    """
    try:
        params = {
            "query": query,
            "start": start,
            "end": end,
            "step": step,
        }

        async with httpx.AsyncClient(timeout=settings.PROMETHEUS_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.PROMETHEUS_URL}/api/v1/query_range",
                params=params,
            )
            resp.raise_for_status()
            body = resp.json()
            if body.get("status") == "success":
                return body["data"]
            print(f"Prometheus range query returned non-success: {body.get('status')}")
            return None
    except httpx.TimeoutException:
        print(f"Prometheus range query timed out: {query[:80]}...")
        return None
    except httpx.HTTPError as e:
        print(f"Prometheus range HTTP error: {e}")
        return None
    except Exception as e:
        print(f"Prometheus range query error: {e}")
        return None


async def get_pod_cpu_range(
    settings: Settings,
    namespace: str,
    pod: str,
    duration_minutes: int = 60,
) -> Optional[Dict[str, Any]]:
    """Get CPU usage over time for a specific pod (as a rate)."""
    step_val = "15s"
    end = datetime.datetime.utcnow()
    start = end - datetime.timedelta(minutes=duration_minutes)

    query = (
        f'sum(rate(container_cpu_usage_seconds_total{{namespace="{namespace}",'
        f'pod="{pod}",container!=""}}[{step_val}])) by (container)'
    )
    return await query_range_prometheus(
        settings,
        query,
        start=start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        end=end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        step=step_val,
    )


async def get_pod_memory_range(
    settings: Settings,
    namespace: str,
    pod: str,
    duration_minutes: int = 60,
) -> Optional[Dict[str, Any]]:
    """Get memory usage over time for a specific pod."""
    step_val = "15s"
    end = datetime.datetime.utcnow()
    start = end - datetime.timedelta(minutes=duration_minutes)

    query = (
        f'sum(container_memory_usage_bytes{{namespace="{namespace}",'
        f'pod="{pod}",container!=""}}) by (container)'
    )
    return await query_range_prometheus(
        settings,
        query,
        start=start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        end=end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        step=step_val,
    )


async def get_namespace_cpu_range(
    settings: Settings,
    namespace: str,
    duration_minutes: int = 60,
) -> Optional[Dict[str, Any]]:
    """Aggregate CPU usage for all pods in a namespace over time."""
    step_val = "30s"
    end = datetime.datetime.utcnow()
    start = end - datetime.timedelta(minutes=duration_minutes)

    query = (
        f'sum(rate(container_cpu_usage_seconds_total{{namespace="{namespace}",'
        f'container!=""}}[{step_val}])) by (pod)'
    )
    return await query_range_prometheus(
        settings,
        query,
        start=start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        end=end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        step=step_val,
    )


async def get_namespace_memory_range(
    settings: Settings,
    namespace: str,
    duration_minutes: int = 60,
) -> Optional[Dict[str, Any]]:
    """Aggregate memory usage for all pods in a namespace over time."""
    step_val = "30s"
    end = datetime.datetime.utcnow()
    start = end - datetime.timedelta(minutes=duration_minutes)

    query = (
        f'sum(container_memory_usage_bytes{{namespace="{namespace}",'
        f'container!=""}}) by (pod)'
    )
    return await query_range_prometheus(
        settings,
        query,
        start=start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        end=end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        step=step_val,
    )


# ─── Mock data for when Prometheus is not reachable ──────────────

MOCK_POD_CPU_SERIES = [
    {"container": "main", "values": [
        [t, str(0.08 + 0.04 * (t % 20) / 20 + 0.02 * (t % 7) / 7)]
        for t in range(int(datetime.datetime.utcnow().timestamp()) - 3600,
                       int(datetime.datetime.utcnow().timestamp()), 30)
    ]},
    {"container": "sidecar", "values": [
        [t, str(0.02 + 0.01 * (t % 15) / 15)]
        for t in range(int(datetime.datetime.utcnow().timestamp()) - 3600,
                       int(datetime.datetime.utcnow().timestamp()), 30)
    ]},
]

MOCK_POD_MEM_SERIES = [
    {"container": "main", "values": [
        [t, str(250 + 10 * (t % 30) / 30)]
        for t in range(int(datetime.datetime.utcnow().timestamp()) - 3600,
                       int(datetime.datetime.utcnow().timestamp()), 30)
    ]},
    {"container": "sidecar", "values": [
        [t, str(45 + 5 * (t % 20) / 20)]
        for t in range(int(datetime.datetime.utcnow().timestamp()) - 3600,
                       int(datetime.datetime.utcnow().timestamp()), 30)
    ]},
]

MOCK_NS_CPU_SERIES = [
    {"pod": "api-server-prod-1", "values": [
        [t, str(0.15 + 0.05 * (t % 25) / 25)]
        for t in range(int(datetime.datetime.utcnow().timestamp()) - 3600,
                       int(datetime.datetime.utcnow().timestamp()), 30)
    ]},
    {"pod": "redis-cache", "values": [
        [t, str(0.01 + 0.005 * (t % 10) / 10)]
        for t in range(int(datetime.datetime.utcnow().timestamp()) - 3600,
                       int(datetime.datetime.utcnow().timestamp()), 30)
    ]},
]

MOCK_NS_MEM_SERIES = [
    {"pod": "api-server-prod-1", "values": [
        [t, str(300 + 20 * (t % 35) / 35)]
        for t in range(int(datetime.datetime.utcnow().timestamp()) - 3600,
                       int(datetime.datetime.utcnow().timestamp()), 30)
    ]},
    {"pod": "redis-cache", "values": [
        [t, str(8 + 2 * (t % 15) / 15)]
        for t in range(int(datetime.datetime.utcnow().timestamp()) - 3600,
                       int(datetime.datetime.utcnow().timestamp()), 30)
    ]},
]
