
import os

files = {
    "backend/models/network.py": """from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal

class PodNetwork(BaseModel):
    name: str
    namespace: str
    pod_ip: Optional[str] = None
    node_name: Optional[str] = None
    phase: Optional[str] = None
    labels: Dict[str, str] = Field(default_factory=dict)
    containers: List[Dict[str, str]] = Field(default_factory=list)

class TopologyNode(BaseModel):
    id: str
    type: Literal["pod", "service"]
    namespace: str
    name: str
    ip: Optional[str] = None

class TopologyEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None

class TopologyResponse(BaseModel):
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
""",

    "backend/models/security.py": """from pydantic import BaseModel
from typing import List, Optional

class RbacSubject(BaseModel):
    kind: str
    name: str
    namespace: Optional[str] = None

class RbacRoleRef(BaseModel):
    kind: str
    name: str
    api_group: str

class RbacBinding(BaseModel):
    name: str
    namespace: Optional[str] = None
    subjects: List[RbacSubject]
    role_ref: RbacRoleRef
    binding_type: str

class PrivilegedPod(BaseModel):
    name: str
    namespace: str
    container: str
    image: str
    privileged: bool
    run_as_user: Optional[int] = None
""",

    "backend/models/threat.py": """from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class FalcoEvent(BaseModel):
    output: str
    priority: str
    rule: str
    time: str
    output_fields: Dict[str, Any] = Field(default_factory=dict)
""",

    "backend/services/network_service.py": """from kubernetes_asyncio import client as k8s_client
from ..models.network import PodNetwork, TopologyNode, TopologyResponse

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
""",

    "backend/services/security_service.py": """from kubernetes_asyncio import client as k8s_client
from ..models.security import RbacBinding, RbacSubject, RbacRoleRef, PrivilegedPod

async def get_rbac(api_client) -> list[RbacBinding]:
    rbac = k8s_client.RbacAuthorizationV1Api(api_client)
    crb = await rbac.list_cluster_role_binding()
    rb = await rbac.list_role_binding_for_all_namespaces()

    bindings = []
    def parse_binding(b, btype):
        return RbacBinding(
            name=b.metadata.name,
            namespace=getattr(b.metadata, "namespace", None),
            subjects=[RbacSubject(kind=s.kind, name=s.name, namespace=getattr(s, "namespace", None)) for s in (b.subjects or [])],
            role_ref=RbacRoleRef(kind=b.role_ref.kind, name=b.role_ref.name, api_group=b.role_ref.api_group),
            binding_type=btype
        )

    bindings.extend([parse_binding(x, "ClusterRoleBinding") for x in (crb.items or [])])
    bindings.extend([parse_binding(x, "RoleBinding") for x in (rb.items or [])])
    return bindings

async def get_privileged_pods(api_client) -> list[PrivilegedPod]:
    v1 = k8s_client.CoreV1Api(api_client)
    pods = await v1.list_pod_for_all_namespaces()

    flagged = []
    for p in pods.items:
        for c in (p.spec.containers or []):
            sc = c.security_context
            if sc and (getattr(sc, "privileged", False) or getattr(sc, "run_as_user", None) == 0):
                flagged.append(PrivilegedPod(
                    name=p.metadata.name,
                    namespace=p.metadata.namespace,
                    container=c.name,
                    image=c.image,
                    privileged=getattr(sc, "privileged", False) or False,
                    run_as_user=getattr(sc, "run_as_user", None)
                ))
    return flagged
""",

    "backend/services/threat_service.py": """import redis.asyncio as redis
from ..models.threat import FalcoEvent
from ..config import Settings

class ThreatService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.redis = redis.from_url(settings.REDIS_URL)

    async def publish_falco_event(self, event: FalcoEvent):
        await self.redis.publish("falco:events", event.model_dump_json())

    async def subscribe_events(self):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("falco:events")
        return pubsub
"""
}

for filepath, content in files.items():
    with open(filepath, "w") as f:
        f.write(content)
print("Logic files created successfully.")

