import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.network_service import get_pods, get_topology

@pytest.fixture
def mock_k8s_v1():
    with patch("backend.services.network_service.k8s_client.CoreV1Api") as mock_core_v1:
        mock_instance = MagicMock()
        mock_core_v1.return_value = mock_instance
        yield mock_instance

@pytest.mark.asyncio
async def test_get_pods(mock_k8s_v1):
    mock_pod = MagicMock()
    mock_pod.metadata.name = "test-pod"
    mock_pod.metadata.namespace = "default"
    mock_pod.status.pod_ip = "10.0.0.1"
    mock_pod.spec.node_name = "node-1"
    mock_pod.status.phase = "Running"
    mock_pod.metadata.labels = {"app": "test"}
    
    mock_container = MagicMock()
    mock_container.name = "test-container"
    mock_container.image = "nginx:latest"
    mock_pod.spec.containers = [mock_container]
    
    mock_response = MagicMock()
    mock_response.items = [mock_pod]
    mock_k8s_v1.list_pod_for_all_namespaces = AsyncMock(return_value=mock_response)
    
    pods = await get_pods(MagicMock())
    assert len(pods) == 1
    assert pods[0].name == "test-pod"
    assert pods[0].pod_ip == "10.0.0.1"
    assert len(pods[0].containers) == 1

@pytest.mark.asyncio
async def test_get_topology(mock_k8s_v1):
    mock_svc = MagicMock()
    mock_svc.metadata.name = "test-svc"
    mock_svc.metadata.namespace = "default"
    
    mock_svc_response = MagicMock()
    mock_svc_response.items = [mock_svc]
    mock_k8s_v1.list_service_for_all_namespaces = AsyncMock(return_value=mock_svc_response)
    
    mock_pod = MagicMock()
    mock_pod.metadata.name = "test-pod"
    mock_pod.metadata.namespace = "default"
    mock_pod.status.pod_ip = "10.0.0.1"
    
    mock_pod_response = MagicMock()
    mock_pod_response.items = [mock_pod]
    mock_k8s_v1.list_pod_for_all_namespaces = AsyncMock(return_value=mock_pod_response)
    
    topology = await get_topology(MagicMock())
    assert len(topology.nodes) == 2
    assert topology.nodes[0].id == "svc:default/test-svc"
    assert topology.nodes[1].id == "pod:default/test-pod"
    assert len(topology.edges) == 0

