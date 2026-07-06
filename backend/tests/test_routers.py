"""
Integration tests for all FastAPI routers.

Tests request parsing, response envelope, error handling, and mock fallback
behavior by overriding Kubernetes client and auth dependencies with controlled mocks.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any, Dict, List, Tuple

import pytest
from fastapi.testclient import TestClient

from main import app
from config import Settings
from fastapi import Header, HTTPException
from typing import Optional

from dependencies import get_k8s_client, get_settings_dep
from models.mock_data import (
    MOCK_CALICO_NODES,
    MOCK_BGP_PEERS,
    MOCK_IP_POOLS,
    MOCK_IPAM_BLOCKS,
    MOCK_CNI_POLICIES,
    MOCK_FELIX_METRICS,
    MOCK_PODS,
    MOCK_RBAC,
    MOCK_PRIVILEGED,
)

# ─── Test configuration ──────────────────────────────────────────
TEST_SETTINGS = Settings(API_KEY="test-key")
HEADERS = {"X-API-Key": "test-key"}

# ─── Override FastAPI dependencies ───────────────────────────────

async def _override_get_k8s_client(
    x_api_key: Optional[str] = Header(None),
) -> AsyncMock:
    """Override that checks auth and returns a mock K8s ApiClient.

    This is simpler than patching the internal create_api_client function:
    the override checks the X-API-Key header directly (same logic as the
    original verify_api_key), so auth is correctly enforced for all endpoints
    including /api/network/* which only have auth through get_k8s_client.
    """
    if not x_api_key or x_api_key != TEST_SETTINGS.API_KEY:
        raise HTTPException(status_code=401, detail="Missing or invalid API key")
    return AsyncMock()

def _override_settings() -> Settings:
    return TEST_SETTINGS

app.dependency_overrides.clear()
app.dependency_overrides[get_settings_dep] = _override_settings
app.dependency_overrides[get_k8s_client] = _override_get_k8s_client

client = TestClient(app)


# ─── Response helpers ─────────────────────────────────────────────

def assert_ok(resp, expected_status: str = "success") -> Dict[str, Any]:
    """Assert 200 and return parsed body with the expected top-level status."""
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    body = resp.json()
    assert body.get("status") == expected_status, (
        f"Expected status={expected_status!r}, got {body.get('status')!r}"
    )
    return body


# ─── CNI Router — /api/cni/ ───────────────────────────────────────

class TestCniNodes:
    PATCH_TARGET = "services.calico_service.get_calico_nodes"

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_success(self, mock_fn):
        mock_fn.return_value = [{"node": "n1", "felix_ready": True}]
        body = assert_ok(client.get("/api/cni/nodes", headers=HEADERS))
        assert body["data"] == [{"node": "n1", "felix_ready": True}]

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_mock_fallback(self, mock_fn):
        mock_fn.side_effect = RuntimeError("no cluster")
        body = assert_ok(client.get("/api/cni/nodes", headers=HEADERS), "mock")
        for expected, actual in zip(MOCK_CALICO_NODES, body["data"]):
            assert expected["node"] == actual["node"]
            assert expected["felix_ready"] == actual["felix_ready"]


class TestCniBgpPeers:
    PATCH_TARGET = "services.calico_service.get_bgp_peers"

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_success(self, mock_fn):
        mock_fn.return_value = [{"name": "peer-1", "session_state": "up"}]
        body = assert_ok(client.get("/api/cni/bgp-peers", headers=HEADERS))
        assert body["data"][0]["name"] == "peer-1"
        assert body["data"][0]["session_state"] == "up"

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_mock_fallback(self, mock_fn):
        mock_fn.side_effect = RuntimeError("no cluster")
        body = assert_ok(client.get("/api/cni/bgp-peers", headers=HEADERS), "mock")
        assert body["data"] == MOCK_BGP_PEERS


class TestCniIpPools:
    PATCH_TARGET = "services.calico_service.get_ip_pools"

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_success(self, mock_fn):
        mock_fn.return_value = [{"name": "pool-1", "cidr": "10.0.0.0/16"}]
        body = assert_ok(client.get("/api/cni/ippools", headers=HEADERS))
        assert body["data"] == [{"name": "pool-1", "cidr": "10.0.0.0/16"}]

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_mock_fallback(self, mock_fn):
        mock_fn.side_effect = RuntimeError("no cluster")
        body = assert_ok(client.get("/api/cni/ippools", headers=HEADERS), "mock")
        assert body["data"] == MOCK_IP_POOLS


class TestCniIpamUtilization:
    PATCH_TARGET = "services.calico_service.get_ipam_utilization"

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_success(self, mock_fn):
        mock_fn.return_value = [{"pool": "default-ipv4-ippool", "utilization_pct": 9.4}]
        body = assert_ok(client.get("/api/cni/ipam/utilization", headers=HEADERS))
        assert body["data"][0]["utilization_pct"] == 9.4

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_mock_fallback(self, mock_fn):
        mock_fn.side_effect = RuntimeError("no cluster")
        body = assert_ok(client.get("/api/cni/ipam/utilization", headers=HEADERS), "mock")
        assert body["data"] == MOCK_IPAM_BLOCKS


class TestCniPolicies:
    PATCH_TARGET = "services.calico_service.get_cni_policies"

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_success(self, mock_fn):
        mock_fn.return_value = [{"name": "default-deny", "rules_count": 2}]
        body = assert_ok(client.get("/api/cni/policies", headers=HEADERS))
        assert body["data"][0]["rules_count"] == 2

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_mock_fallback(self, mock_fn):
        mock_fn.side_effect = RuntimeError("no cluster")
        body = assert_ok(client.get("/api/cni/policies", headers=HEADERS), "mock")
        assert body["data"] == MOCK_CNI_POLICIES


class TestCniTopology:
    PATCH_TARGET = "services.calico_service.get_cni_topology"

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_success(self, mock_fn):
        mock_fn.return_value = {
            "nodes": [{"id": "node:m1", "type": "node", "name": "m1"}],
            "edges": [],
        }
        body = assert_ok(client.get("/api/cni/topology", headers=HEADERS))
        assert len(body["data"]["nodes"]) == 1

    @patch(PATCH_TARGET, new_callable=AsyncMock)
    def test_mock_fallback(self, mock_fn):
        mock_fn.side_effect = RuntimeError("no cluster")
        body = assert_ok(client.get("/api/cni/topology", headers=HEADERS), "mock")
        assert len(body["data"]["nodes"]) > 0
        assert "edges" in body["data"]


class TestCniFelixMetrics:
    # NOTE: imported directly in cni.py:
    #   from services.felix_metrics_service import get_felix_metrics
    # Patch the local reference in the router module.
    PATCH_GAUGES = "routers.cni.get_felix_metrics"
    PATCH_SERIES = "routers.cni.get_felix_metrics_time_series"

    @patch(PATCH_GAUGES, new_callable=AsyncMock)
    def test_success(self, mock_gauges):
        mock_gauges.return_value = {"active_local_endpoints": 14, "bgp_sessions_active": 2}
        body = assert_ok(client.get("/api/cni/metrics/felix", headers=HEADERS))
        assert body["data"]["active_local_endpoints"] == 14

    @patch(PATCH_GAUGES, new_callable=AsyncMock)
    def test_success_with_time_series(self, mock_gauges):
        mock_gauges.return_value = {"active_local_endpoints": 14}
        with patch(self.PATCH_SERIES, new_callable=AsyncMock) as mock_series:
            mock_series.return_value = {
                "active_local_endpoints": [
                    {"timestamp": "2025-07-03T12:00:00Z", "value": 14.0}
                ]
            }
            body = assert_ok(
                client.get("/api/cni/metrics/felix?include_series=true", headers=HEADERS)
            )
            assert "time_series" in body
            assert len(body["time_series"]["active_local_endpoints"]) == 1

    @patch(PATCH_GAUGES, new_callable=AsyncMock)
    def test_mock_fallback(self, mock_gauges):
        mock_gauges.side_effect = RuntimeError("Prometheus unreachable")
        body = assert_ok(client.get("/api/cni/metrics/felix", headers=HEADERS), "mock")
        assert body["data"] == MOCK_FELIX_METRICS


class TestCniConnectivityDiagnostics:
    def test_requires_target(self):
        """POST without target_pod or target_service returns 400."""
        resp = client.post(
            "/api/cni/diagnostics/connectivity",
            params={"source_pod": "my-pod"},
            headers=HEADERS,
        )
        assert resp.status_code == 400

    @patch("kubernetes_asyncio.client.CoreV1Api")
    def test_mock_fallback(self, mock_core_v1):
        """When K8s is unavailable, the endpoint falls back to mock data."""
        mock_core_v1.side_effect = RuntimeError("no cluster")
        body = assert_ok(
            client.post(
                "/api/cni/diagnostics/connectivity",
                params={
                    "source_pod": "my-pod",
                    "source_namespace": "default",
                    "target_service": "my-svc",
                    "target_namespace": "default",
                    "target_port": 80,
                },
                headers=HEADERS,
            ),
            "mock",
        )
        assert body["data"]["reachable"] is True
        assert body["data"]["latency_ms"] == 2.3


# ─── Network Router — /api/network/ ───────────────────────────────

class TestNetworkPods:
    @patch("kubernetes_asyncio.client.CoreV1Api")
    def test_mock_fallback(self, mock_core_v1):
        """When K8s is unavailable, the endpoint falls back to mock data."""
        mock_core_v1.side_effect = RuntimeError("no cluster")
        body = assert_ok(client.get("/api/network/pods", headers=HEADERS), "mock")
        assert "items" in body
        assert len(body["items"]) > 0
        assert body["items"][0] == MOCK_PODS[0]

    def test_requires_auth(self):
        resp = client.get("/api/network/pods")  # no API key
        assert resp.status_code == 401


class TestNetworkTopology:
    @patch("kubernetes_asyncio.client.CoreV1Api")
    def test_mock_fallback(self, mock_core_v1):
        mock_core_v1.side_effect = RuntimeError("no cluster")
        body = assert_ok(client.get("/api/network/topology", headers=HEADERS), "mock")
        assert "nodes" in body
        assert "edges" in body
        assert len(body["nodes"]) > 0


# ─── Mock Router — /mock/ ─────────────────────────────────────────

class TestMockEndpoints:
    def test_mock_pods(self):
        body = client.get("/mock/pods", headers=HEADERS).json()
        assert body["items"] == MOCK_PODS

    def test_mock_topology(self):
        body = client.get("/mock/topology", headers=HEADERS).json()
        assert "nodes" in body
        assert "edges" in body

    def test_mock_rbac(self):
        body = client.get("/mock/rbac", headers=HEADERS).json()
        assert body == MOCK_RBAC

    def test_mock_privileged(self):
        body = client.get("/mock/privileged", headers=HEADERS).json()
        assert body == MOCK_PRIVILEGED


# ─── Threat Router — /api/threats/ ───────────────────────────────

class TestFalcoWebhook:
    @patch("routers.threats.ThreatService")
    def test_publish_falco_event(self, mock_service_cls):
        mock_instance = MagicMock()
        mock_service_cls.return_value = mock_instance
        mock_instance.publish_falco_event = AsyncMock()

        payload = {
            "output": "File opened for writing",
            "priority": "Warning",
            "rule": "Write below binary dir",
            "time": "2025-07-03T12:00:00Z",
        }
        body = client.post("/api/threats/falco", json=payload, headers=HEADERS).json()
        assert body["status"] == "ok"
        mock_instance.publish_falco_event.assert_awaited_once()


# ─── Auth Failure (global) ────────────────────────────────────────

class TestAuth:
    auth_endpoints: List[Tuple[str, str]] = [
        ("GET", "/api/cni/nodes"),
        ("GET", "/api/cni/bgp-peers"),
        ("GET", "/api/cni/ippools"),
        ("GET", "/api/cni/ipam/utilization"),
        ("GET", "/api/cni/policies"),
        ("GET", "/api/cni/topology"),
        ("GET", "/api/cni/metrics/felix"),
        ("GET", "/api/network/pods"),
        ("GET", "/api/network/topology"),
        ("GET", "/mock/pods"),
        ("GET", "/mock/topology"),
        ("GET", "/mock/rbac"),
        ("GET", "/mock/privileged"),
        ("POST", "/api/threats/falco"),
    ]

    @pytest.mark.parametrize("method,path", auth_endpoints)
    def test_missing_api_key_returns_401(self, method: str, path: str) -> None:
        """All protected endpoints should return 401 without an API key."""
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(path, json={})
        assert resp.status_code == 401, (
            f"Expected 401 for {method} {path}, got {resp.status_code}"
        )
