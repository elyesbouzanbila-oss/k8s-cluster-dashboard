from fastapi import APIRouter, Depends
from typing import List, Dict, Any

from connection.models import ConnectionConfig
from dependencies import get_k8s_client, get_connection_config

router = APIRouter()

# Mock data — realistic cluster with master + worker nodes
MOCK_NODES = [
    {
        "name": "master-1",
        "role": "master",
        "ip": "192.168.1.10",
        "kubelet_version": "v1.28.2",
        "os_image": "Ubuntu 22.04 LTS",
        "capacity": {"cpu": "4", "memory": "16Gi"}
    },
    {
        "name": "worker-1",
        "role": "worker",
        "ip": "192.168.1.20",
        "kubelet_version": "v1.28.2",
        "os_image": "Ubuntu 22.04 LTS",
        "capacity": {"cpu": "8", "memory": "32Gi"}
    },
    {
        "name": "worker-2",
        "role": "worker",
        "ip": "192.168.1.21",
        "kubelet_version": "v1.28.2",
        "os_image": "Ubuntu 22.04 LTS",
        "capacity": {"cpu": "8", "memory": "32Gi"}
    }
]

MOCK_PODS = [
    {
        "name": "kube-apiserver",
        "namespace": "kube-system",
        "pod_ip": "10.244.0.10",
        "node_name": "master-1",
        "phase": "Running",
        "labels": {"app": "kube-apiserver", "component": "control-plane"},
        "containers": [{"name": "kube-apiserver", "image": "registry.k8s.io/kube-apiserver:v1.28.2"}]
    },
    {
        "name": "kube-scheduler",
        "namespace": "kube-system",
        "pod_ip": "10.244.0.11",
        "node_name": "master-1",
        "phase": "Running",
        "labels": {"app": "kube-scheduler", "component": "control-plane"},
        "containers": [{"name": "kube-scheduler", "image": "registry.k8s.io/kube-scheduler:v1.28.2"}]
    },
    {
        "name": "etcd-operator",
        "namespace": "kube-system",
        "pod_ip": "10.244.0.12",
        "node_name": "master-1",
        "phase": "Running",
        "labels": {"app": "etcd", "component": "control-plane"},
        "containers": [{"name": "etcd", "image": "registry.k8s.io/etcd:3.5.9"}]
    },
    {
        "name": "coredns-7d5c8f5d6f-abc12",
        "namespace": "kube-system",
        "pod_ip": "10.244.0.13",
        "node_name": "master-1",
        "phase": "Running",
        "labels": {"app": "coredns", "k8s-app": "kube-dns"},
        "containers": [{"name": "coredns", "image": "registry.k8s.io/coredns:v1.10.1"}]
    },
    {
        "name": "api-server-prod-1",
        "namespace": "production",
        "pod_ip": "10.244.1.10",
        "node_name": "worker-1",
        "phase": "Running",
        "labels": {"app": "api-server", "version": "v2.1.0"},
        "containers": [
            {"name": "main", "image": "myapp:v2.1.0"},
            {"name": "sidecar", "image": "envoyproxy:latest"}
        ]
    },
    {
        "name": "redis-cache",
        "namespace": "production",
        "pod_ip": "10.244.1.20",
        "node_name": "worker-1",
        "phase": "Running",
        "labels": {"app": "redis"},
        "containers": [{"name": "redis", "image": "redis:7-alpine"}]
    },
    {
        "name": "database-backup",
        "namespace": "production",
        "pod_ip": "10.244.2.15",
        "node_name": "worker-2",
        "phase": "Running",
        "labels": {"app": "database", "job": "backup"},
        "containers": [{"name": "postgres-backup", "image": "postgres:15"}]
    },
    {
        "name": "prometheus-0",
        "namespace": "monitoring",
        "pod_ip": "10.244.2.20",
        "node_name": "worker-2",
        "phase": "Running",
        "labels": {"app": "prometheus"},
        "containers": [{"name": "prometheus", "image": "prom/prometheus:latest"}]
    }
]

MOCK_SERVICES = [
    {"namespace": "kube-system", "name": "kube-dns", "cluster_ip": "10.100.0.10", "selector": {"k8s-app": "kube-dns"}},
    {"namespace": "production", "name": "api-service", "cluster_ip": "10.100.1.1", "selector": {"app": "api-server"}},
    {"namespace": "production", "name": "database-service", "cluster_ip": "10.100.1.2", "selector": {"app": "database"}},
    {"namespace": "monitoring", "name": "prometheus", "cluster_ip": "10.100.2.1", "selector": {"app": "prometheus"}}
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


def _build_mock_topology() -> dict:
	"""Build mock topology including cluster nodes, pods, services, and edges."""
	nodes = []

	# Add cluster nodes (master + workers)
	for n in MOCK_NODES:
		nodes.append({
			"id": f"node:{n['name']}",
			"type": "node",
			"name": n["name"],
			"role": n["role"],
			"ip": n["ip"],
			"kubelet_version": n.get("kubelet_version"),
			"os_image": n.get("os_image"),
			"capacity": n.get("capacity")
		})

	# Add services
	services_data = []
	for svc in MOCK_SERVICES:
		svc_id = f"svc:{svc['namespace']}/{svc['name']}"
		nodes.append({
			"id": svc_id,
			"type": "service",
			"namespace": svc["namespace"],
			"name": svc["name"],
			"ip": svc.get("cluster_ip")
		})
		services_data.append({
			"id": svc_id,
			"namespace": svc["namespace"],
			"selector": svc.get("selector", {})
		})

	# Add pods
	pods_data = []
	for pod in MOCK_PODS:
		pod_id = f"pod:{pod['namespace']}/{pod['name']}"
		nodes.append({
			"id": pod_id,
			"type": "pod",
			"namespace": pod["namespace"],
			"name": pod["name"],
			"ip": pod["pod_ip"],
			"node_name": pod["node_name"]
		})
		pods_data.append({
			"id": pod_id,
			"namespace": pod["namespace"],
			"labels": pod.get("labels", {}),
			"node_name": pod["node_name"]
		})

	# Build edges: connect pods to services based on label matching
	edges = []
	for svc in services_data:
		for pod in pods_data:
			if pod["namespace"] == svc["namespace"] and label_selector_matches(pod["labels"], svc["selector"]):
				edges.append({
					"id": f"{pod['id']}-to-{svc['id']}",
					"source": pod["id"],
					"target": svc["id"]
				})

	return {"nodes": nodes, "edges": edges}


@router.get("/topology")
async def get_topology(
	connection: ConnectionConfig = Depends(get_connection_config), api_client=Depends(get_k8s_client)
):
	"""Return topology with cluster nodes (master + worker), pods, services, and smart edges."""
	try:
		from kubernetes_asyncio import client as k8s_client

		v1 = k8s_client.CoreV1Api(api_client)
		svc_list = await v1.list_service_for_all_namespaces()
		pod_list = await v1.list_pod_for_all_namespaces()
		node_list = await v1.list_node()

		nodes = []
		services_data = []

		# Add cluster nodes (master + workers) with their network info
		node_name_to_role = {}
		for n in node_list.items:
			name = n.metadata.name
			# Determine role from labels
			labels = n.metadata.labels or {}
			role = "worker"
			if labels.get("node-role.kubernetes.io/control-plane") == "" or \
			   labels.get("node-role.kubernetes.io/master") == "":
				role = "master"
			node_name_to_role[name] = role

			# Get internal IP
			ip = None
			for addr in n.status.addresses or []:
				if addr.type == "InternalIP":
					ip = addr.address
					break

			nodes.append({
				"id": f"node:{name}",
				"type": "node",
				"name": name,
				"role": role,
				"ip": ip,
				"capacity": {
					"cpu": str(n.status.capacity.get("cpu", "")),
					"memory": str(n.status.capacity.get("memory", ""))
				} if n.status.capacity else None
			})

		# Add services
		for s in svc_list.items:
			if s.metadata.namespace == "default" and s.metadata.name == "kubernetes":
				continue

			service_id = f"svc:{s.metadata.namespace}/{s.metadata.name}"
			nodes.append({
				"id": service_id,
				"type": "service",
				"namespace": s.metadata.namespace,
				"name": s.metadata.name,
				"ip": s.spec.cluster_ip if s.spec.cluster_ip and s.spec.cluster_ip != "None" else None
			})
			services_data.append({
				"id": service_id,
				"namespace": s.metadata.namespace,
				"selector": s.spec.selector or {}
			})

		# Add pods
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
				"node_name": node_name
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
				if pod["namespace"] == svc["namespace"] and label_selector_matches(pod["labels"], svc["selector"]):
					edges.append({
						"id": f"{pod['id']}-to-{svc['id']}",
						"source": pod["id"],
						"target": svc["id"]
					})

		return {"nodes": nodes, "edges": edges}
	except Exception as e:
		# Fall back to rich mock data if K8s not available
		print(f"K8s connection failed: {e}, using mock topology")
		return _build_mock_topology()
