from fastapi import APIRouter, Depends
from typing import List, Dict, Any

from connection.models import ConnectionConfig
from dependencies import get_k8s_client, get_connection_config

router = APIRouter()


@router.get("/pods")
async def list_pods(
	connection: ConnectionConfig = Depends(get_connection_config),
	api_client=Depends(get_k8s_client),
) -> Dict[str, Any]:
	"""Return a lightweight list of pods across namespaces."""
	from kubernetes_asyncio import client as k8s_client

	v1 = k8s_client.CoreV1Api(api_client)
	pods = await v1.list_pod_for_all_namespaces(watch=False)

	items: List[Dict[str, Any]] = []
	for p in pods.items:
		items.append(
			{
				"name": p.metadata.name,
				"namespace": p.metadata.namespace,
				"pod_ip": getattr(p.status, "pod_ip", None),
				"node_name": getattr(p.spec, "node_name", None),
				"phase": getattr(p.status, "phase", None),
				"labels": p.metadata.labels or {},
				"containers": [
					{"name": c.name, "image": c.image} for c in (p.spec.containers or [])
				],
			}
		)

	return {"items": items}


@router.get("/topology")
async def get_topology(
	connection: ConnectionConfig = Depends(get_connection_config), api_client=Depends(get_k8s_client)
):
	"""Return a simple topology: nodes (pods + services) and edges placeholder.

	This is a minimal implementation; frontend can enrich further.
	"""
	from kubernetes_asyncio import client as k8s_client

	v1 = k8s_client.CoreV1Api(api_client)
	svc_list = await v1.list_service_for_all_namespaces()
	pod_list = await v1.list_pod_for_all_namespaces()

	nodes = []
	for s in svc_list.items:
		nodes.append({"id": f"svc:{s.metadata.namespace}/{s.metadata.name}", "type": "service", "namespace": s.metadata.namespace, "name": s.metadata.name})

	for p in pod_list.items:
		nodes.append({"id": f"pod:{p.metadata.namespace}/{p.metadata.name}", "type": "pod", "namespace": p.metadata.namespace, "name": p.metadata.name, "ip": getattr(p.status, "pod_ip", None)})

	# Edges are left empty for now — network flow detection will populate these later.
	edges = []

	return {"nodes": nodes, "edges": edges}
