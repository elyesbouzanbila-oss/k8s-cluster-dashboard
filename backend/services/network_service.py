from kubernetes_asyncio import client as k8s_client
from models.network import PodNetwork, TopologyNode, TopologyEdge, TopologyResponse

def label_selector_matches(pod_labels: dict, selector: dict) -> bool:
    """Check if pod labels match service selector."""
    if not selector:
        return False
    for key, value in selector.items():
        if pod_labels.get(key) != value:
            return False
    return True

async def get_pods(api_client) -> list[PodNetwork]:
    v1 = k8s_client.CoreV1Api(api_client)
    pods = await v1.list_pod_for_all_namespaces(watch=False)
    
    items = []
    for p in pods.items:
        items.append(PodNetwork(
            name=p.metadata.name,
            namespace=p.metadata.namespace,
            pod_ip=getattr(p.status, "pod_ip", None),
            node_name=getattr(p.spec, "node_name", None),
            phase=getattr(p.status, "phase", None),
            labels=p.metadata.labels or {},
            containers=[{"name": c.name, "image": c.image} for c in (p.spec.containers or [])]
        ))
    return items

async def get_topology(api_client) -> TopologyResponse:
    v1 = k8s_client.CoreV1Api(api_client)
    svc_list = await v1.list_service_for_all_namespaces()
    pod_list = await v1.list_pod_for_all_namespaces()
    node_list = await v1.list_node()

    nodes = []

    # Add cluster nodes
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

        nodes.append(TopologyNode(
            id=f"node:{n.metadata.name}",
            type="node",
            name=n.metadata.name,
            role=role,
            ip=ip,
            capacity={
                "cpu": str(n.status.capacity.get("cpu", "")),
                "memory": str(n.status.capacity.get("memory", ""))
            } if n.status.capacity else None
        ))

    # Add services
    services_data = []
    for s in svc_list.items:
        if s.metadata.namespace == "default" and s.metadata.name == "kubernetes":
            continue

        svc_ip = s.spec.cluster_ip if s.spec.cluster_ip and s.spec.cluster_ip != "None" else None
        nodes.append(TopologyNode(
            id=f"svc:{s.metadata.namespace}/{s.metadata.name}",
            type="service",
            namespace=s.metadata.namespace,
            name=s.metadata.name,
            ip=svc_ip
        ))
        services_data.append({
            "id": f"svc:{s.metadata.namespace}/{s.metadata.name}",
            "namespace": s.metadata.namespace,
            "selector": s.spec.selector or {}
        })

    # Add pods with node reference
    pods_data = []
    for p in pod_list.items:
        node_name = getattr(p.spec, "node_name", None)
        nodes.append(TopologyNode(
            id=f"pod:{p.metadata.namespace}/{p.metadata.name}",
            type="pod",
            namespace=p.metadata.namespace,
            name=p.metadata.name,
            ip=getattr(p.status, "pod_ip", None),
            labels=p.metadata.labels or {},
            node_name=node_name
        ))
        pods_data.append({
            "id": f"pod:{p.metadata.namespace}/{p.metadata.name}",
            "namespace": p.metadata.namespace,
            "labels": p.metadata.labels or {},
            "node_name": node_name
        })

    # Build edges
    edges = []
    for svc in services_data:
        for pod in pods_data:
            if pod["namespace"] == svc["namespace"] and label_selector_matches(pod["labels"], svc["selector"]):
                edges.append(TopologyEdge(
                    id=f"{pod['id']}-to-{svc['id']}",
                    source=pod["id"],
                    target=svc["id"]
                ))

    return TopologyResponse(nodes=nodes, edges=edges)
