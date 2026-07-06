"""
Tests for Pydantic models — validates construction, defaults, and serialization.
"""

from datetime import datetime
from models.cni_models import (
    CalicoNodeStatus,
    BGPPeer,
    IPPool,
    IPAMBlockSummary,
    CniPolicy,
    FelixMetricsResponse,
)
from models.network import PodNetwork, TopologyNode, TopologyResponse
from models.threat import FalcoEvent


# ───── Calico Mocks ────────────────────────────────────────────────

class TestCalicoNodeStatus:
    def test_defaults(self):
        node = CalicoNodeStatus(node="test-node")
        assert node.node == "test-node"
        assert node.felix_ready is True
        assert node.bird_ready is True
        assert node.ip is None
        assert node.uptime_seconds is None

    def test_serialization(self):
        node = CalicoNodeStatus(
            node="master-1",
            felix_ready=True,
            bird_ready=False,
            ip="10.0.0.1",
            uptime_seconds=3600,
            last_reported="2025-07-03T12:00:00Z",
        )
        d = node.model_dump()
        assert d["node"] == "master-1"
        assert d["felix_ready"] is True
        assert d["bird_ready"] is False
        assert d["uptime_seconds"] == 3600


class TestBGPPeer:
    def test_minimal(self):
        peer = BGPPeer(name="bgppeer-test")
        assert peer.name == "bgppeer-test"
        assert peer.node is None
        assert peer.session_state is None

    def test_full(self):
        peer = BGPPeer(
            name="bgppeer-worker-1",
            node="worker-1",
            peer_ip="10.0.0.1",
            peer_as_number=64512,
            node_as_number=64513,
            session_state="up",
        )
        assert peer.session_state == "up"
        assert peer.peer_as_number == 64512

    def test_model_dump(self):
        peer = BGPPeer(name="test", node="n1", peer_ip="1.2.3.4")
        d = peer.model_dump()
        assert d["name"] == "test"
        assert d["peer_ip"] == "1.2.3.4"


class TestIPPool:
    def test_default_mode(self):
        pool = IPPool(name="test-pool", cidr="10.0.0.0/16")
        assert pool.mode == "ipip"  # default
        assert pool.nat_outgoing is True
        assert pool.disabled is False

    def test_vxlan_mode(self):
        pool = IPPool(name="vxlan-pool", cidr="10.1.0.0/16", mode="vxlan")
        assert pool.mode == "vxlan"

    def test_model_dump_keys(self):
        pool = IPPool(name="p", cidr="10.0.0.0/24")
        d = pool.model_dump()
        assert set(d.keys()) >= {"name", "cidr", "mode", "nat_outgoing", "disabled"}


class TestIPAMBlockSummary:
    def test_defaults(self):
        summary = IPAMBlockSummary(pool="default-ipv4-ippool")
        assert summary.blocks == 0
        assert summary.allocated == 0
        assert summary.total == 0
        assert summary.utilization_pct == 0.0

    def test_custom_values(self):
        summary = IPAMBlockSummary(
            pool="infra-pool",
            blocks=3,
            allocated=24,
            total=256,
            utilization_pct=9.4,
        )
        assert summary.blocks == 3
        assert summary.utilization_pct == 9.4

    def test_utilization_float_precision(self):
        summary = IPAMBlockSummary(pool="p", allocated=1, total=3, utilization_pct=33.3)
        assert summary.utilization_pct == 33.3


class TestCniPolicy:
    def test_default_type(self):
        policy = CniPolicy(name="default-deny")
        assert policy.type == "GlobalNetworkPolicy"
        assert policy.rules_count == 0

    def test_namespaced_policy(self):
        policy = CniPolicy(
            name="allow-frontend",
            type="NetworkPolicy",
            namespace="production",
            selector="app == 'frontend'",
            rules_count=3,
        )
        assert policy.namespace == "production"
        assert policy.type == "NetworkPolicy"
        assert policy.selector == "app == 'frontend'"

    def test_model_dump(self):
        policy = CniPolicy(name="test", rules_count=5, type="GlobalNetworkPolicy")
        d = policy.model_dump()
        assert d["rules_count"] == 5


# ─── Network Models ───────────────────────────────────────────────

class TestPodNetwork:
    def test_minimal(self):
        pod = PodNetwork(name="test-pod", namespace="default")
        assert pod.name == "test-pod"
        assert pod.namespace == "default"
        assert pod.pod_ip is None
        assert pod.phase is None
        assert pod.labels == {}
        assert pod.containers == []

    def test_with_containers(self):
        pod = PodNetwork(
            name="web-1",
            namespace="prod",
            pod_ip="10.0.0.5",
            phase="Running",
            containers=[{"name": "nginx", "image": "nginx:latest"}],
        )
        assert len(pod.containers) == 1
        assert pod.containers[0]["name"] == "nginx"


class TestTopologyNode:
    def test_node_type_master(self):
        node = TopologyNode(id="node:m1", type="node", name="m1", role="master")
        assert node.id == "node:m1"
        assert node.role == "master"

    def test_pod_type(self):
        node = TopologyNode(
            id="pod:default/web-1",
            type="pod",
            name="web-1",
            namespace="default",
            labels={"app": "nginx"},
        )
        assert node.type == "pod"
        assert node.labels == {"app": "nginx"}

    def test_service_type(self):
        node = TopologyNode(
            id="svc:default/my-svc",
            type="service",
            name="my-svc",
            namespace="default",
            ip="10.100.0.1",
        )
        assert node.type == "service"
        assert node.namespace == "default"


class TestTopologyResponse:
    def test_empty_topology(self):
        resp = TopologyResponse(nodes=[], edges=[])
        assert resp.nodes == []
        assert resp.edges == []

    def test_with_elements(self):
        node = TopologyNode(id="n1", type="node", name="n1")
        resp = TopologyResponse(nodes=[node], edges=[])
        assert len(resp.nodes) == 1


# ─── Threat Models ─────────────────────────────────────────────────

class TestFalcoEvent:
    def test_minimal(self):
        event = FalcoEvent(
            output="File opened for writing",
            priority="Warning",
            rule="Write below binary dir",
            time="2025-07-03T12:00:00Z",
        )
        assert event.output_fields == {}

    def test_with_output_fields(self):
        event = FalcoEvent(
            output="Shell spawned",
            priority="Critical",
            rule="Terminal shell",
            time="2025-07-03T12:00:00Z",
            output_fields={"proc.name": "bash", "user.name": "root"},
        )
        assert event.output_fields["proc.name"] == "bash"

    def test_serialization(self):
        event = FalcoEvent(
            output="test",
            priority="High",
            rule="test-rule",
            time="2025-07-03T12:00:00Z",
        )
        d = event.model_dump()
        assert d["priority"] == "High"
        assert d["output_fields"] == {}


# ─── Felix Metrics ─────────────────────────────────────────────────

class TestFelixMetricsResponse:
    def test_all_defaults(self):
        resp = FelixMetricsResponse()
        assert resp.active_local_endpoints is None
        assert resp.cluster_network_policies is None
        assert resp.time_series is None

    def test_with_values(self):
        resp = FelixMetricsResponse(
            active_local_endpoints=14,
            bgp_sessions_active=2,
        )
        assert resp.active_local_endpoints == 14
        assert resp.bgp_sessions_active == 2
        assert resp.iptables_restore_errors is None  # not set
