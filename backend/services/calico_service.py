"""Service layer for Calico CNI resources accessed via Kubernetes CustomObjectsApi."""

from typing import Any, Dict, List, Optional
from collections import defaultdict
from datetime import datetime, timezone
from kubernetes_asyncio import client as k8s_client

# Calico CRD API group and version (Tigera operator installation)
CALICO_GROUP = "crd.projectcalico.org"
CALICO_VERSION = "v1"


async def get_calico_nodes(api_client) -> List[Dict[str, Any]]:
    """Return per-node Calico agent status from calico-node pods."""
    v1 = k8s_client.CoreV1Api(api_client)
    pods = await v1.list_pod_for_all_namespaces(
        label_selector="k8s-app=calico-node",
        watch=False,
    )

    nodes = []
    for p in pods.items:
        node_name = getattr(p.spec, "node_name", None)
        pod_ip = getattr(p.status, "pod_ip", None)
        felix_ready = False
        bird_ready = False

        # Check container statuses for readiness
        for c in (p.status.container_statuses or []):
            if c.ready:
                if c.name == "calico-node":
                    felix_ready = c.ready
                    bird_ready = c.ready

        # Compute uptime from the earliest running container
        uptime_seconds = None
        for c in (p.status.container_statuses or []):
            if c.state and c.state.running and c.state.running.started_at:
                started = c.state.running.started_at
                uptime_seconds = int(
                    (datetime.now(timezone.utc) - started).total_seconds()
                )
                break

        nodes.append({
            "node": node_name,
            "felix_ready": felix_ready,
            "bird_ready": bird_ready,
            "ip": pod_ip,
            "uptime_seconds": uptime_seconds,
            "last_reported": None,
        })

    return nodes


async def get_bgp_peers(api_client) -> List[Dict[str, Any]]:
    """List BGPPeer CRDs."""
    custom_api = k8s_client.CustomObjectsApi(api_client)
    peers = await custom_api.list_cluster_custom_object(
        group=CALICO_GROUP,
        version=CALICO_VERSION,
        plural="bgppeers",
    )

    result = []
    for item in (peers.get("items") or []):
        spec = item.get("spec", {})
        result.append({
            "name": item["metadata"]["name"],
            "node": spec.get("node"),
            "peer_ip": spec.get("peerIP"),
            "peer_as_number": spec.get("asNumber"),
            "node_as_number": spec.get("nodeASNumber"),
            "session_state": spec.get("sessionState", "unknown"),
        })
    return result


async def get_ip_pools(api_client) -> List[Dict[str, Any]]:
    """List IPPool CRDs."""
    custom_api = k8s_client.CustomObjectsApi(api_client)
    pools = await custom_api.list_cluster_custom_object(
        group=CALICO_GROUP,
        version=CALICO_VERSION,
        plural="ippools",
    )

    result = []
    for item in (pools.get("items") or []):
        spec = item.get("spec", {})
        # Determine encapsulation mode
        mode = "none"
        if spec.get("ipipMode") and spec["ipipMode"] not in ("Never", "Disabled"):
            mode = "ipip"
        elif spec.get("vxlanMode") and spec["vxlanMode"] not in ("Never", "Disabled"):
            mode = "vxlan"

        result.append({
            "name": item["metadata"]["name"],
            "cidr": spec.get("cidr", ""),
            "nat_outgoing": spec.get("natOutgoing", True),
            "disabled": spec.get("disabled", False),
            "mode": mode,
            "node_selector": spec.get("nodeSelector"),
        })
    return result


async def get_ipam_utilization(api_client) -> List[Dict[str, Any]]:
    """Aggregate IPAMBlock allocations per pool."""
    custom_api = k8s_client.CustomObjectsApi(api_client)

    # Fetch pools first to get pool names
    pools_raw = await custom_api.list_cluster_custom_object(
        group=CALICO_GROUP,
        version=CALICO_VERSION,
        plural="ippools",
    )
    pool_cidrs: Dict[str, str] = {}
    for item in (pools_raw.get("items") or []):
        cidr = item.get("spec", {}).get("cidr", "")
        pool_cidrs[item["metadata"]["name"]] = cidr

    # Fetch all IPAM blocks
    blocks_raw = await custom_api.list_cluster_custom_object(
        group=CALICO_GROUP,
        version=CALICO_VERSION,
        plural="ipamblocks",
    )
    blocks = blocks_raw.get("items") or []

    # Aggregate blocks per pool
    pool_blocks = defaultdict(list)
    for block in blocks:
        spec = block.get("spec", {})
        pool_name = spec.get("pool", "unknown")
        pool_blocks[pool_name].append(block)

    result = []
    for pool_name, pool_block_list in pool_blocks.items():
        total = 0
        allocated_count = 0
        for block in pool_block_list:
            allocations = block.get("spec", {}).get("allocations", [])
            total += len(allocations)
            allocated_count += sum(1 for a in allocations if a is not None)

        utilization_pct = (allocated_count / total * 100) if total > 0 else 0.0
        result.append({
            "pool": pool_name,
            "blocks": len(pool_block_list),
            "allocated": allocated_count,
            "total": total,
            "utilization_pct": round(utilization_pct, 1),
        })

    # Include pools with no blocks
    for pname in pool_cidrs:
        if not any(r["pool"] == pname for r in result):
            result.append({
                "pool": pname,
                "blocks": 0,
                "allocated": 0,
                "total": 0,
                "utilization_pct": 0.0,
            })

    return result


async def get_cni_policies(api_client) -> List[Dict[str, Any]]:
    """List Calico NetworkPolicy and GlobalNetworkPolicy CRDs."""
    custom_api = k8s_client.CustomObjectsApi(api_client)
    result = []

    # GlobalNetworkPolicies (cluster-scoped)
    try:
        gnp_raw = await custom_api.list_cluster_custom_object(
            group=CALICO_GROUP,
            version=CALICO_VERSION,
            plural="globalnetworkpolicies",
        )
        for item in (gnp_raw.get("items") or []):
            spec = item.get("spec", {})
            result.append({
                "name": item["metadata"]["name"],
                "namespace": None,
                "type": "GlobalNetworkPolicy",
                "policy_type": spec.get("types", []),
                "selector": spec.get("selector"),
                "order": spec.get("order"),
                "rules_count": _count_policy_rules(spec),
                "rule_actions": _extract_rule_actions(spec),
            })
    except Exception:
        pass

    # NetworkPolicies (namespaced — need to list across all namespaces)
    try:
        v1 = k8s_client.CoreV1Api(api_client)
        namespaces = await v1.list_namespace()
        for ns in (namespaces.items or []):
            ns_name = ns.metadata.name
            try:
                np_raw = await custom_api.list_namespaced_custom_object(
                    group=CALICO_GROUP,
                    version=CALICO_VERSION,
                    namespace=ns_name,
                    plural="networkpolicies",
                )
                for item in (np_raw.get("items") or []):
                    spec = item.get("spec", {})
                    result.append({
                        "name": item["metadata"]["name"],
                        "namespace": ns_name,
                        "type": "NetworkPolicy",
                        "policy_type": spec.get("types", []),
                        "selector": spec.get("selector"),
                        "order": spec.get("order"),
                        "rules_count": _count_policy_rules(spec),
                        "rule_actions": _extract_rule_actions(spec),
                    })
            except Exception:
                continue
    except Exception:
        pass

    return result


def _count_policy_rules(spec: Dict[str, Any]) -> int:
    """Count total ingress + egress rules in a Calico policy spec."""
    count = 0
    for direction in ("ingress", "egress"):
        rules = spec.get(direction, [])
        if isinstance(rules, list):
            count += len(rules)
    return count


def _extract_rule_actions(spec: Dict[str, Any]) -> List[str]:
    """Extract unique action values (Allow, Deny, Log, Pass) from all rules."""
    actions: set[str] = set()
    for direction in ("ingress", "egress"):
        rules = spec.get(direction, [])
        if isinstance(rules, list):
            for rule in rules:
                if isinstance(rule, dict):
                    action = rule.get("action", "Allow")
                    actions.add(action)
    return sorted(actions)


async def get_cni_topology(api_client) -> Dict[str, Any]:
    """Build CNI-aware topology: nodes with their BGP peers and overlay connections."""
    # Reuse the existing node discovery from the pods API
    v1 = k8s_client.CoreV1Api(api_client)

    # Get nodes
    node_list = await v1.list_node()
    custom_api = k8s_client.CustomObjectsApi(api_client)

    # Get BGP peers for edge creation
    bgp_edges = []
    try:
        peers_raw = await custom_api.list_cluster_custom_object(
            group=CALICO_GROUP,
            version=CALICO_VERSION,
            plural="bgppeers",
        )
        for peer in (peers_raw.get("items") or []):
            spec = peer.get("spec", {})
            peer_node = spec.get("node", "")
            peer_ip = spec.get("peerIP", "")
            if peer_node and peer_ip:
                bgp_edges.append({
                    "source": f"node:{peer_node}",
                    "target": f"bgp:{peer_ip}",
                    "type": "bgp",
                })
    except Exception:
        pass

    # Build node entries
    nodes = []
    for n in node_list.items:
        labels = n.metadata.labels or {}
        role = "worker"
        if labels.get("node-role.kubernetes.io/control-plane") == "" or \
           labels.get("node-role.kubernetes.io/master") == "":
            role = "master"

        ip = None
        for addr in n.status.addresses or []:
            if addr.type == "InternalIP":
                ip = addr.address
                break

        nodes.append({
            "id": f"node:{n.metadata.name}",
            "name": n.metadata.name,
            "role": role,
            "ip": ip,
        })

    # Get pod overlay edges (pods-to-pods on different nodes)
    pods = await v1.list_pod_for_all_namespaces(watch=False)
    overlay_edges = []
    pod_sets: Dict[str, List[str]] = {}
    for p in pods.items:
        node_name = getattr(p.spec, "node_name", None)
        if node_name:
            pod_sets.setdefault(node_name, []).append(p.metadata.name)

    # Create overlay edges between different nodes (simplified mesh)
    node_names = list(pod_sets.keys())
    for i in range(len(node_names)):
        for j in range(i + 1, len(node_names)):
            overlay_edges.append({
                "source": f"node:{node_names[i]}",
                "target": f"node:{node_names[j]}",
                "type": "overlay",
            })

    return {
        "nodes": nodes,
        "edges": bgp_edges + overlay_edges,
    }
