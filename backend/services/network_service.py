from kubernetes_asyncio import client as k8s_client
from models.network import PodNetwork, TopologyNode, TopologyEdge, TopologyResponse

from services.utils import label_selector_matches

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

        # Format service ports
        svc_ports_str = None
        if s.spec.ports:
            port_strs = []
            for p in s.spec.ports:
                proto = p.protocol or "TCP"
                if p.target_port and p.target_port != p.port:
                    if p.name:
                        port_strs.append(f"{p.name}:{p.port}:{p.target_port}/{proto}")
                    else:
                        port_strs.append(f"{p.port}:{p.target_port}/{proto}")
                else:
                    if p.name:
                        port_strs.append(f"{p.name}:{p.port}/{proto}")
                    else:
                        port_strs.append(f"{p.port}/{proto}")
            if port_strs:
                svc_ports_str = ", ".join(port_strs)

        nodes.append(TopologyNode(
            id=f"svc:{s.metadata.namespace}/{s.metadata.name}",
            type="service",
            namespace=s.metadata.namespace,
            name=s.metadata.name,
            ip=svc_ip,
            ports=svc_ports_str,
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

        # Collect container ports
        pod_ports_str = None
        ports_list = []
        for c in (p.spec.containers or []):
            if c.ports:
                for cp in c.ports:
                    proto = cp.protocol or "TCP"
                    if cp.name:
                        ports_list.append(f"{cp.name}:{cp.container_port}/{proto}")
                    else:
                        ports_list.append(f"{cp.container_port}/{proto}")
        if ports_list:
            pod_ports_str = ", ".join(ports_list)

        nodes.append(TopologyNode(
            id=f"pod:{p.metadata.namespace}/{p.metadata.name}",
            type="pod",
            namespace=p.metadata.namespace,
            name=p.metadata.name,
            ip=getattr(p.status, "pod_ip", None),
            labels=p.metadata.labels or {},
            node_name=node_name,
            ports=pod_ports_str,
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
