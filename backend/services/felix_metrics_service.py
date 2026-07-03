"""Felix metrics service — queries Prometheus for calico-node Felix metrics."""

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from config import Settings
from services.prometheus_service import query_prometheus


FELIX_METRICS_QUERIES = {
    "active_local_endpoints": "felix_active_local_endpoints",
    "cluster_network_policies": "felix_cluster_network_policies",
    "iptables_restore_errors": "felix_iptables_restore_errors",
    "bgp_sessions_active": "felix_bgp_sessions_active",
    "int_dataplane_failures": "felix_int_dataplane_failures",
}


async def get_felix_metrics(settings: Settings) -> Dict[str, Any]:
    """Fetch current Felix gauge metrics from Prometheus.

    Returns a dict mapping metric names to their scalar values.
    For any metric that fails or returns no data, the value is omitted.
    """
    result: Dict[str, Any] = {}

    for key, promql in FELIX_METRICS_QUERIES.items():
        try:
            data = await query_prometheus(settings, promql)
            if data and data.get("result"):
                # Expecting a vector result: [{ "metric": {...}, "value": [ts, val] }]
                values = []
                for r in data["result"]:
                    val = float(r.get("value", [0, 0])[1])
                    values.append(val)

                if values:
                    # For single-value aggregations, sum across all calico-node instances
                    result[key] = sum(values)
            else:
                result[key] = 0
        except Exception as e:
            print(f"Felix metric '{key}' query failed: {e}")
            result[key] = 0

    return result


async def get_felix_metrics_time_series(
    settings: Settings,
    duration_minutes: int = 60,
) -> Dict[str, List[Dict[str, Any]]]:
    """Fetch Felix Prometheus metrics as time-series data.

    Returns a dict mapping metric names to lists of {timestamp, value} points.
    """
    from services.prometheus_service import query_range_prometheus

    end = datetime.utcnow()
    step = "30s"
    start = end - timedelta(minutes=duration_minutes)

    series: Dict[str, List[Dict[str, Any]]] = {}
    for key, promql in FELIX_METRICS_QUERIES.items():
        try:
            data = await query_range_prometheus(
                settings,
                promql,
                start=start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                end=end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                step=step,
            )
            if data and data.get("result"):
                points = []
                for r in data["result"]:
                    for ts_str, val_str in r.get("values", []):
                        points.append({
                            "timestamp": datetime.utcfromtimestamp(float(ts_str)).isoformat() + "Z",
                            "value": float(val_str),
                        })
                series[key] = points
            else:
                series[key] = []
        except Exception as e:
            print(f"Felix time-series '{key}' query failed: {e}")
            series[key] = []

    return series
