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
