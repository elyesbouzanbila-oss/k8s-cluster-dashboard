from fastapi import APIRouter, Depends
from typing import List, Dict, Any

from connection.models import ConnectionConfig
from dependencies import get_k8s_client, get_connection_config

router = APIRouter()

# Mock data fallback
MOCK_PODS = [
    {
        "name": "api-server-prod-1",
        "namespace": "production",
        "pod_ip": "10.244.1.10",
        "node_name": "docker-desktop",
        "phase": "Running",
        "labels": {"app": "api-server", "version": "v2.1.0"},
        "containers": [
            {"name": "main", "image": "myapp:v2.1.0"},
            {"name": "sidecar", "image": "envoyproxy:latest"}
        ]
    },
    {
        "name": "database-backup",
        "namespace": "production",
        "pod_ip": "10.244.2.15",
        "node_name": "docker-desktop",
        "phase": "Running",
        "labels": {"app": "database", "job": "backup"},
        "containers": [{"name": "postgres-backup", "image": "postgres:15"}]
    },
    {
        "name": "prometheus-0",
        "namespace": "monitoring",
        "pod_ip": "10.244.3.20",
        "node_name": "docker-desktop",
        "phase": "Running",
        "labels": {"app": "prometheus"},
        "containers": [{"name": "prometheus", "image": "prom/prometheus:latest"}]
    },
    {
        "name": "redis-cache",
        "namespace": "production",
        "pod_ip": "10.244.2.25",
        "node_name": "docker-desktop",
        "phase": "Running",
        "labels": {"app": "redis"},
        "containers": [{"name": "redis", "image": "redis:7-alpine"}]
    }
]


@router.get("/pods")
async def list_pods(
	connection: ConnectionConfig = Depends(get_connection_config),
	api_client=Depends(get_k8s_client),
) -> Dict[str, Any]:
	"""Return a lightweight list of pods across namespaces."""
	try:
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
	except Exception as e:
		# Fall back to mock data if K8s not available
		print(f"K8s connection failed: {e}, using mock data")
		return {"items": MOCK_PODS}


def label_selector_matches(pod_labels: Dict[str, str], selector: Dict[str, str]) -> bool:
	"""Check if pod labels match service selector."""
	if not selector:
		return False
	for key, value in selector.items():
		if pod_labels.get(key) != value:
			return False
	return True


@router.get("/topology")
async def get_topology(
	connection: ConnectionConfig = Depends(get_connection_config), api_client=Depends(get_k8s_client)
):
	"""Return topology with nodes and smart edges based on label matching."""
	try:
		from kubernetes_asyncio import client as k8s_client

		v1 = k8s_client.CoreV1Api(api_client)
		svc_list = await v1.list_service_for_all_namespaces()
		pod_list = await v1.list_pod_for_all_namespaces()

		# Build nodes
		nodes = []
		services_data = []
		
		for s in svc_list.items:
			# Skip kubernetes service (system internal)
			if s.metadata.namespace == "default" and s.metadata.name == "kubernetes":
				continue
				
			service_id = f"svc:{s.metadata.namespace}/{s.metadata.name}"
			nodes.append({
				"id": service_id,
				"type": "service",
				"namespace": s.metadata.namespace,
				"name": s.metadata.name
			})
			services_data.append({
				"id": service_id,
				"namespace": s.metadata.namespace,
				"selector": s.spec.selector or {}
			})

		pods_data = []
		for p in pod_list.items:
			pod_id = f"pod:{p.metadata.namespace}/{p.metadata.name}"
			node_name = getattr(p.spec, "node_name", None)
			nodes.append({
				"id": pod_id,
				"type": "pod",
				"namespace": p.metadata.namespace,
				"name": p.metadata.name,
				"ip": getattr(p.status, "pod_ip", None),
				"labels": p.metadata.labels or {},
				"node_name": node_name  # Include node_name in topology
			})
			pods_data.append({
				"id": pod_id,
				"namespace": p.metadata.namespace,
				"labels": p.metadata.labels or {},
				"node_name": node_name
			})

		# Build edges: connect pods to services based on label matching
		edges = []
		for svc in services_data:
			for pod in pods_data:
				# Only connect pods in same namespace that match service selector
				if pod["namespace"] == svc["namespace"] and label_selector_matches(pod["labels"], svc["selector"]):
					edges.append({
						"id": f"{pod['id']}-to-{svc['id']}",
						"source": pod["id"],
						"target": svc["id"]
					})

		return {"nodes": nodes, "edges": edges}
	except Exception as e:
		# Fall back to mock data if K8s not available
		print(f"K8s connection failed: {e}, using mock topology")
		nodes = []
		services = [
			{"namespace": "production", "name": "api-service"},
			{"namespace": "production", "name": "database-service"},
			{"namespace": "monitoring", "name": "prometheus"}
		]
		
		for svc in services:
			nodes.append({
				"id": f"svc:{svc['namespace']}/{svc['name']}",
				"type": "service",
				"namespace": svc['namespace'],
				"name": svc['name']
			})
		
		for pod in MOCK_PODS:
			nodes.append({
				"id": f"pod:{pod['namespace']}/{pod['name']}",
				"type": "pod",
				"namespace": pod['namespace'],
				"name": pod['name'],
				"ip": pod['pod_ip'],
				"node_name": pod['node_name']
			})
		
		return {"nodes": nodes, "edges": []}
