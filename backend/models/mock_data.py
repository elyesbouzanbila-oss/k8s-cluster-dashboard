"""Shared mock cluster data for all routers — single source of truth."""

MOCK_NODES = [
    {
        "name": "master-1",
        "role": "master",
        "ip": "192.168.1.10",
        "kubelet_version": "v1.28.2",
        "os_image": "Ubuntu 22.04 LTS",
        "capacity": {"cpu": "4", "memory": "16Gi"},
        "ready": True
    },
    {
        "name": "worker-1",
        "role": "worker",
        "ip": "192.168.1.20",
        "kubelet_version": "v1.28.2",
        "os_image": "Ubuntu 22.04 LTS",
        "capacity": {"cpu": "8", "memory": "32Gi"},
        "ready": True
    },
    {
        "name": "worker-2",
        "role": "worker",
        "ip": "192.168.1.21",
        "kubelet_version": "v1.28.2",
        "os_image": "Ubuntu 22.04 LTS",
        "capacity": {"cpu": "8", "memory": "32Gi"},
        "ready": False
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

MOCK_RBAC = [
    {
        "name": "admin-binding",
        "namespace": None,
        "binding_type": "ClusterRoleBinding",
        "role_ref": {"kind": "ClusterRole", "name": "cluster-admin", "api_group": "rbac.authorization.k8s.io"},
        "subjects": [{"kind": "User", "name": "admin@example.com", "namespace": None}]
    },
    {
        "name": "developers-edit",
        "namespace": "production",
        "binding_type": "RoleBinding",
        "role_ref": {"kind": "Role", "name": "editor", "api_group": "rbac.authorization.k8s.io"},
        "subjects": [{"kind": "Group", "name": "developers", "namespace": None}]
    },
    {
        "name": "monitoring-viewer",
        "namespace": "monitoring",
        "binding_type": "RoleBinding",
        "role_ref": {"kind": "Role", "name": "viewer", "api_group": "rbac.authorization.k8s.io"},
        "subjects": [{"kind": "ServiceAccount", "name": "prometheus", "namespace": "monitoring"}]
    }
]

MOCK_PRIVILEGED = [
    {
        "name": "prometheus-0",
        "namespace": "monitoring",
        "container": "prometheus",
        "image": "prom/prometheus:latest",
        "privileged": False,
        "run_as_user": None
    }
]


MOCK_POD_METRICS = [
    {
        "namespace": "kube-system",
        "name": "kube-apiserver",
        "node": "master-1",
        "containers": [
            {
                "name": "kube-apiserver",
                "image": "registry.k8s.io/kube-apiserver:v1.28.2",
                "cpu": {"usage": "120m", "request": "250m", "limit": "500m"},
                "memory": {"usage": "384Mi", "request": "512Mi", "limit": "1Gi"}
            }
        ],
        "pod_cpu_usage": "120m",
        "pod_memory_usage": "384Mi"
    },
    {
        "namespace": "kube-system",
        "name": "kube-scheduler",
        "node": "master-1",
        "containers": [
            {
                "name": "kube-scheduler",
                "image": "registry.k8s.io/kube-scheduler:v1.28.2",
                "cpu": {"usage": "25m", "request": "100m", "limit": "200m"},
                "memory": {"usage": "64Mi", "request": "128Mi", "limit": "256Mi"}
            }
        ],
        "pod_cpu_usage": "25m",
        "pod_memory_usage": "64Mi"
    },
    {
        "namespace": "kube-system",
        "name": "etcd-operator",
        "node": "master-1",
        "containers": [
            {
                "name": "etcd",
                "image": "registry.k8s.io/etcd:3.5.9",
                "cpu": {"usage": "40m", "request": "100m", "limit": "300m"},
                "memory": {"usage": "128Mi", "request": "256Mi", "limit": "512Mi"}
            }
        ],
        "pod_cpu_usage": "40m",
        "pod_memory_usage": "128Mi"
    },
    {
        "namespace": "kube-system",
        "name": "coredns-7d5c8f5d6f-abc12",
        "node": "master-1",
        "containers": [
            {
                "name": "coredns",
                "image": "registry.k8s.io/coredns:v1.10.1",
                "cpu": {"usage": "8m", "request": "50m", "limit": "100m"},
                "memory": {"usage": "24Mi", "request": "64Mi", "limit": "128Mi"}
            }
        ],
        "pod_cpu_usage": "8m",
        "pod_memory_usage": "24Mi"
    },
    {
        "namespace": "production",
        "name": "api-server-prod-1",
        "node": "worker-1",
        "containers": [
            {
                "name": "main",
                "image": "myapp:v2.1.0",
                "cpu": {"usage": "150m", "request": "200m", "limit": "500m"},
                "memory": {"usage": "256Mi", "request": "512Mi", "limit": "1Gi"}
            },
            {
                "name": "sidecar",
                "image": "envoyproxy:latest",
                "cpu": {"usage": "30m", "request": "100m", "limit": "200m"},
                "memory": {"usage": "48Mi", "request": "128Mi", "limit": "256Mi"}
            }
        ],
        "pod_cpu_usage": "180m",
        "pod_memory_usage": "304Mi"
    },
    {
        "namespace": "production",
        "name": "redis-cache",
        "node": "worker-1",
        "containers": [
            {
                "name": "redis",
                "image": "redis:7-alpine",
                "cpu": {"usage": "15m", "request": "50m", "limit": "100m"},
                "memory": {"usage": "8Mi", "request": "32Mi", "limit": "64Mi"}
            }
        ],
        "pod_cpu_usage": "15m",
        "pod_memory_usage": "8Mi"
    },
    {
        "namespace": "production",
        "name": "database-backup",
        "node": "worker-2",
        "containers": [
            {
                "name": "postgres-backup",
                "image": "postgres:15",
                "cpu": {"usage": "85m", "request": "100m", "limit": "250m"},
                "memory": {"usage": "192Mi", "request": "256Mi", "limit": "512Mi"}
            }
        ],
        "pod_cpu_usage": "85m",
        "pod_memory_usage": "192Mi"
    },
    {
        "namespace": "monitoring",
        "name": "prometheus-0",
        "node": "worker-2",
        "containers": [
            {
                "name": "prometheus",
                "image": "prom/prometheus:latest",
                "cpu": {"usage": "210m", "request": "300m", "limit": "1"},
                "memory": {"usage": "512Mi", "request": "1Gi", "limit": "2Gi"}
            }
        ],
        "pod_cpu_usage": "210m",
        "pod_memory_usage": "512Mi"
    }
]


def build_mock_topology():
    """Build mock topology dict from shared mock data."""
    nodes = []
    for n in MOCK_NODES:
        nodes.append({
            "id": f"node:{n['name']}",
            "type": "node",
            "name": n["name"],
            "role": n["role"],
            "ip": n["ip"],
            "kubelet_version": n.get("kubelet_version"),
            "os_image": n.get("os_image"),
            "capacity": n.get("capacity"),
            "ready": n.get("ready", True)
        })

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

    def _label_selector_matches(pod_labels, selector):
        if not selector:
            return False
        for key, value in selector.items():
            if pod_labels.get(key) != value:
                return False
        return True

    edges = []
    for svc in services_data:
        for pod in pods_data:
            if pod["namespace"] == svc["namespace"] and _label_selector_matches(pod["labels"], svc["selector"]):
                edges.append({
                    "id": f"{pod['id']}-to-{svc['id']}",
                    "source": pod["id"],
                    "target": svc["id"]
                })

    return {"nodes": nodes, "edges": edges}
