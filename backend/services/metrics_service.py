from typing import List, Dict, Any

async def get_node_metrics(api_client) -> List[Dict[str, Any]]:
    """Fetches real-time CPU/Memory usage for nodes and combines with capacity."""
    try:
        from kubernetes_asyncio import client as k8s_client
        
        custom_api = k8s_client.CustomObjectsApi(api_client)
        core_api = k8s_client.CoreV1Api(api_client)
        
        # 1. Get raw node metrics (usage)
        metrics = await custom_api.list_cluster_custom_object("metrics.k8s.io", "v1beta1", "nodes")
        # 2. Get node capacities
        nodes = await core_api.list_node()
        
        result = []
        for node in nodes.items:
            node_name = node.metadata.name
            metric = next((m for m in metrics.get('items', []) if m['metadata']['name'] == node_name), None)
            
            capacity_cpu = node.status.capacity.get('cpu', '0') if node.status.capacity else '0'
            capacity_mem = node.status.capacity.get('memory', '0Ki') if node.status.capacity else '0Ki'
            
            usage_cpu = metric['usage']['cpu'] if metric else '0'
            usage_mem = metric['usage']['memory'] if metric else '0'
            
            result.append({
                "name": node_name,
                "os": node.status.node_info.os_image if node.status and node.status.node_info else "N/A",
                "kubeletVersion": node.status.node_info.kubelet_version if node.status and node.status.node_info else "N/A",
                "capacity": {"cpu": capacity_cpu, "memory": capacity_mem},
                "usage": {"cpu": usage_cpu, "memory": usage_mem}
            })
        return result
    except Exception as e:
        print(f"Error fetching node metrics: {e}")
        return []

async def get_pod_metrics(api_client, namespace: str = "default") -> List[Dict[str, Any]]:
    """Fetches real-time CPU/Memory usage for pods in a namespace."""
    try:
        from kubernetes_asyncio import client as k8s_client
        
        custom_api = k8s_client.CustomObjectsApi(api_client)
        
        metrics = await custom_api.list_namespaced_custom_object(
            "metrics.k8s.io", "v1beta1", namespace, "pods"
        )
        return metrics.get('items', [])
    except Exception as e:
        print(f"Error fetching pod metrics: {e}")
        return []


async def get_all_pod_metrics(api_client) -> List[Dict[str, Any]]:
    """Fetches real-time CPU/Memory usage for ALL pods across all namespaces
    and enriches with container resource requests/limits from pod specs.
    Data sourced from cAdvisor via the metrics-server API."""
    try:
        from kubernetes_asyncio import client as k8s_client

        custom_api = k8s_client.CustomObjectsApi(api_client)
        core_api = k8s_client.CoreV1Api(api_client)

        # 1. Get pod resource usage from metrics-server (sourced from cAdvisor)
        usage_data = await custom_api.list_cluster_custom_object(
            "metrics.k8s.io", "v1beta1", "pods"
        )
        usage_by_pod = {}
        for item in usage_data.get('items', []):
            ns = item['metadata']['namespace']
            name = item['metadata']['name']
            usage_by_pod[(ns, name)] = item

        # 2. Get pod specs for resource requests/limits
        all_pods = await core_api.list_pod_for_all_namespaces()

        result = []
        for pod in all_pods.items:
            ns = pod.metadata.namespace
            name = pod.metadata.name
            node_name = pod.spec.node_name or ""

            usage_item = usage_by_pod.get((ns, name))

            containers = []
            total_cpu_milli = 0
            total_mem_bytes = 0

            for ctr in pod.spec.containers:
                ctr_name = ctr.name
                ctr_image = ctr.image

                # Get resource spec (requests / limits)
                cpu_request = None
                cpu_limit = None
                mem_request = None
                mem_limit = None
                if ctr.resources:
                    if ctr.resources.requests:
                        req = ctr.resources.requests
                        cpu_request = req.get('cpu', None)
                        mem_request = req.get('memory', None)
                    if ctr.resources.limits:
                        lim = ctr.resources.limits
                        cpu_limit = lim.get('cpu', None)
                        mem_limit = lim.get('memory', None)

                # Get usage from metrics-server
                cpu_usage = "0"
                mem_usage = "0"
                if usage_item:
                    for c in usage_item.get('containers', []):
                        if c['name'] == ctr_name:
                            usage = c.get('usage', {})
                            cpu_usage = usage.get('cpu', '0')
                            mem_usage = usage.get('memory', '0')
                            break

                # Accumulate pod totals (in millicores / bytes for sorting)
                total_cpu_milli += _parse_cpu_to_milli(cpu_usage)
                total_mem_bytes += _parse_memory_to_bytes(mem_usage)

                containers.append({
                    "name": ctr_name,
                    "image": ctr_image,
                    "cpu": {
                        "usage": cpu_usage,
                        "request": cpu_request,
                        "limit": cpu_limit
                    },
                    "memory": {
                        "usage": mem_usage,
                        "request": mem_request,
                        "limit": mem_limit
                    }
                })

            result.append({
                "namespace": ns,
                "name": name,
                "node": node_name,
                "containers": containers,
                "pod_cpu_usage": _format_cpu(total_cpu_milli),
                "pod_memory_usage": _format_memory(total_mem_bytes)
            })

        return result
    except Exception as e:
        print(f"Error fetching all pod metrics: {e}")
        return []


def _parse_cpu_to_milli(cpu_str: str) -> float:
    """Parse a Kubernetes CPU string to millicores."""
    if not cpu_str:
        return 0
    if cpu_str.endswith('n'):
        return float(cpu_str[:-1]) / 1_000_000
    if cpu_str.endswith('m'):
        return float(cpu_str[:-1])
    if cpu_str.endswith('u'):
        return float(cpu_str[:-1]) / 1000
    return float(cpu_str) * 1000


def _format_cpu(milli: float) -> str:
    """Format millicores to a human-readable K8s-style CPU string."""
    if milli >= 1000:
        return f"{milli / 1000:.2f}"
    return f"{milli:.0f}m"


def _parse_memory_to_bytes(mem_str: str) -> int:
    """Parse a Kubernetes memory string to bytes."""
    if not mem_str:
        return 0
    mem_str = mem_str.strip()
    if mem_str.endswith('Ki'):
        return int(float(mem_str[:-2]) * 1024)
    elif mem_str.endswith('Mi'):
        return int(float(mem_str[:-2]) * 1024 * 1024)
    elif mem_str.endswith('Gi'):
        return int(float(mem_str[:-2]) * 1024 * 1024 * 1024)
    elif mem_str.endswith('Ti'):
        return int(float(mem_str[:-2]) * 1024 * 1024 * 1024 * 1024)
    elif mem_str.endswith('k'):
        return int(float(mem_str[:-1]) * 1000)
    elif mem_str.endswith('M'):
        return int(float(mem_str[:-1]) * 1000 * 1000)
    elif mem_str.endswith('G'):
        return int(float(mem_str[:-1]) * 1000 * 1000 * 1000)
    elif mem_str.endswith('T'):
        return int(float(mem_str[:-1]) * 1000 * 1000 * 1000 * 1000)
    elif mem_str.endswith('m'):
        # millibytes — edge case, treat as bytes
        return int(float(mem_str[:-1]) / 1000)
    return int(float(mem_str))


def _format_memory(bytes_val: int) -> str:
    """Format bytes to a human-readable Mi/Gi string."""
    if bytes_val >= 1024 * 1024 * 1024:
        return f"{bytes_val / (1024 * 1024 * 1024):.1f}Gi"
    elif bytes_val >= 1024 * 1024:
        return f"{bytes_val / (1024 * 1024):.0f}Mi"
    elif bytes_val >= 1024:
        return f"{bytes_val / 1024:.0f}Ki"
    return f"{bytes_val}B"
