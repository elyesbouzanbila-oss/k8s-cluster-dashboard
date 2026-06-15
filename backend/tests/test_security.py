import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.security_service import get_rbac, get_privileged_pods

@pytest.fixture
def mock_k8s_rbac():
    with patch("backend.services.security_service.k8s_client.RbacAuthorizationV1Api") as mock_rbac_v1:
        mock_instance = MagicMock()
        mock_rbac_v1.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_k8s_v1():
    with patch("backend.services.security_service.k8s_client.CoreV1Api") as mock_core_v1:
        mock_instance = MagicMock()
        mock_core_v1.return_value = mock_instance
        yield mock_instance

@pytest.mark.asyncio
async def test_get_rbac(mock_k8s_rbac):
    mock_crb = MagicMock()
    mock_crb.metadata.name = "cluster-admin"
    mock_crb.metadata.namespace = None
    mock_subj = MagicMock()
    mock_subj.kind = "User"
    mock_subj.name = "admin"
    mock_subj.namespace = None
    mock_crb.subjects = [mock_subj]
    mock_crb.role_ref.kind = "ClusterRole"
    mock_crb.role_ref.name = "cluster-admin"
    mock_crb.role_ref.api_group = "rbac.authorization.k8s.io"
    
    mock_crb_response = MagicMock()
    mock_crb_response.items = [mock_crb]
    mock_k8s_rbac.list_cluster_role_binding = AsyncMock(return_value=mock_crb_response)
    
    mock_rb_response = MagicMock()
    mock_rb_response.items = []
    mock_k8s_rbac.list_role_binding_for_all_namespaces = AsyncMock(return_value=mock_rb_response)
    
    bindings = await get_rbac(MagicMock())
    assert len(bindings) == 1
    assert bindings[0].name == "cluster-admin"
    assert bindings[0].binding_type == "ClusterRoleBinding"
    assert len(bindings[0].subjects) == 1
    assert bindings[0].subjects[0].name == "admin"

@pytest.mark.asyncio
async def test_get_privileged_pods(mock_k8s_v1):
    mock_pod = MagicMock()
    mock_pod.metadata.name = "priv-pod"
    mock_pod.metadata.namespace = "kube-system"
    mock_container = MagicMock()
    mock_container.name = "priv-container"
    mock_container.image = "nginx"
    mock_container.security_context.privileged = True
    mock_container.security_context.run_as_user = 0
    mock_pod.spec.containers = [mock_container]
    
    mock_response = MagicMock()
    mock_response.items = [mock_pod]
    mock_k8s_v1.list_pod_for_all_namespaces = AsyncMock(return_value=mock_response)
    
    pods = await get_privileged_pods(MagicMock())
    assert len(pods) == 1
    assert pods[0].name == "priv-pod"
    assert pods[0].container == "priv-container"
    assert pods[0].privileged is True
    assert pods[0].run_as_user == 0

