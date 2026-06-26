from typing import List, Dict, Any

async def get_storage_config(api_client) -> Dict[str, Any]:
    """Fetches StorageClasses, PVs, and PVCs."""
    try:
        from kubernetes_asyncio import client as k8s_client
        
        core_api = k8s_client.CoreV1Api(api_client)
        storage_api = k8s_client.StorageV1Api(api_client)
        
        storage_classes = await storage_api.list_storage_class()
        pvs = await core_api.list_persistent_volume()
        pvcs = await core_api.list_persistent_volume_claim_for_all_namespaces()
        
        # Format storage classes
        sc_list = []
        for sc in storage_classes.items:
            sc_list.append({
                "metadata": {
                    "name": sc.metadata.name,
                    "annotations": sc.metadata.annotations or {}
                },
                "provisioner": sc.provisioner
            })
        
        # Format PVCs
        pvc_list = []
        for pvc in pvcs.items:
            pvc_list.append({
                "metadata": {
                    "uid": pvc.metadata.uid,
                    "name": pvc.metadata.name,
                    "namespace": pvc.metadata.namespace
                },
                "status": {
                    "phase": pvc.status.phase if pvc.status else "Unknown"
                },
                "spec": {
                    "resources": {
                        "requests": {
                            "storage": pvc.spec.resources.requests.get('storage', 'N/A') if pvc.spec.resources and pvc.spec.resources.requests else 'N/A'
                        }
                    }
                }
            })
        
        return {
            "storageClasses": sc_list,
            "persistentVolumes": [pv.to_dict() for pv in pvs.items],
            "persistentVolumeClaims": pvc_list
        }
    except Exception as e:
        print(f"Error fetching storage config: {e}")
        return {"storageClasses": [], "persistentVolumes": [], "persistentVolumeClaims": []}

async def get_network_config(api_client) -> List[Dict[str, Any]]:
    """Fetches NetworkPolicies across all namespaces."""
    try:
        from kubernetes_asyncio import client as k8s_client
        
        net_api = k8s_client.NetworkingV1Api(api_client)
        
        policies = await net_api.list_network_policy_for_all_namespaces()
        formatted = []
        for np in policies.items:
            formatted.append({
                "name": np.metadata.name,
                "namespace": np.metadata.namespace,
                "podSelector": np.spec.pod_selector.to_dict() if np.spec.pod_selector else {},
                "policyTypes": np.spec.policy_types or [],
                "ingress": [i.to_dict() for i in np.spec.ingress] if np.spec.ingress else [],
                "egress": [e.to_dict() for e in np.spec.egress] if np.spec.egress else []
            })
        return formatted
    except Exception as e:
        print(f"Error fetching network config: {e}")
        return []
