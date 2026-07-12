from pydantic import BaseModel, Field
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
    type: Literal["node", "pod", "service"]
    namespace: Optional[str] = None
    name: str
    ip: Optional[str] = None
    labels: Optional[Dict[str, str]] = None
    node_name: Optional[str] = None
    role: Optional[Literal["master", "worker"]] = None
    capacity: Optional[Dict[str, str]] = None
    ports: Optional[str] = None

class TopologyEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None

class TopologyResponse(BaseModel):
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
