"""
Tests for mock_data.py — validates build_mock_topology consistency.
"""

from models.mock_data import (
    build_mock_topology,
    MOCK_NODES,
    MOCK_PODS,
    MOCK_SERVICES,
)


class TestBuildMockTopology:
    def test_returns_expected_structure(self):
        topology = build_mock_topology()
        assert "nodes" in topology
        assert "edges" in topology
        assert isinstance(topology["nodes"], list)
        assert isinstance(topology["edges"], list)

    def test_node_count_includes_all_types(self):
        topology = build_mock_topology()
        # Nodes: 3 cluster nodes + 4 services + 8 pods = 15
        # Plus the topology includes kube-system nodes that aren't in MOCK_NODES...
        # Let's calculate:
        # 3 cluster nodes = MOCK_NODES
        # 4 services = MOCK_SERVICES
        # 8 pods = MOCK_PODS
        expected = len(MOCK_NODES) + len(MOCK_SERVICES) + len(MOCK_PODS)
        assert len(topology["nodes"]) == expected

    def test_cluster_nodes_have_correct_types(self):
        topology = build_mock_topology()
        cluster_nodes = [n for n in topology["nodes"] if n["type"] == "node"]
        assert len(cluster_nodes) == len(MOCK_NODES)

        names = {n["name"] for n in cluster_nodes}
        for mock_node in MOCK_NODES:
            assert mock_node["name"] in names

    def test_pods_have_correct_types(self):
        topology = build_mock_topology()
        pod_nodes = [n for n in topology["nodes"] if n["type"] == "pod"]
        assert len(pod_nodes) == len(MOCK_PODS)

    def test_services_have_correct_types(self):
        topology = build_mock_topology()
        svc_nodes = [n for n in topology["nodes"] if n["type"] == "service"]
        assert len(svc_nodes) == len(MOCK_SERVICES)

    def test_every_pod_has_node_name(self):
        topology = build_mock_topology()
        pod_nodes = [n for n in topology["nodes"] if n["type"] == "pod"]
        for pod in pod_nodes:
            assert pod.get("node_name") is not None, f"Pod {pod['name']} missing node_name"

    def test_pod_to_service_edges_exist(self):
        topology = build_mock_topology()
        edges = topology["edges"]
        assert len(edges) > 0

        # Verify specific expected edges exist by ID pattern
        edge_ids = {e["id"] for e in edges}
        # api-service matches api-server-prod-1 (same ns "production", app=api-server)
        assert "pod:production/api-server-prod-1-to-svc:production/api-service" in edge_ids
        # database-service matches database-backup (same ns "production", app=database)
        assert "pod:production/database-backup-to-svc:production/database-service" in edge_ids
        # prometheus matches prometheus-0 (same ns "monitoring", app=prometheus)
        assert "pod:monitoring/prometheus-0-to-svc:monitoring/prometheus" in edge_ids
        # kube-dns matches coredns (same ns "kube-system", k8s-app=kube-dns)
        assert "pod:kube-system/coredns-7d5c8f5d6f-abc12-to-svc:kube-system/kube-dns" in edge_ids

    def test_node_ids_format(self):
        topology = build_mock_topology()
        for node in topology["nodes"]:
            ntype = node["type"]
            nid = node["id"]
            if ntype == "node":
                assert nid.startswith("node:")
            elif ntype == "pod":
                assert nid.startswith("pod:")
            elif ntype == "service":
                assert nid.startswith("svc:")

    def test_topology_is_reproducible(self):
        """Calling build_mock_topology twice should produce identical results."""
        t1 = build_mock_topology()
        t2 = build_mock_topology()
        assert t1 == t2
