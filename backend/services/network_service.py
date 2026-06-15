from kubernetes_asyncio import client as k8s_client
from models.network import PodNetwork, TopologyNode, TopologyResponse

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

    nodes = []
    for s in svc_list.items:
        nodes.append(TopologyNode(
            id=f"svc:{s.metadata.namespace}/{s.metadata.name}",
            type="service",
            namespace=s.metadata.namespace,
            name=s.metadata.name
        ))

    for p in pod_list.items:
        nodes.append(TopologyNode(
            id=f"pod:{p.metadata.namespace}/{p.metadata.name}",
            type="pod",
            namespace=p.metadata.namespace,
            name=p.metadata.name,
            ip=getattr(p.status, "pod_ip", None)
        ))

    return TopologyResponse(nodes=nodes, edges=[])
