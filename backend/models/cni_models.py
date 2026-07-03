from pydantic import BaseModel
from typing import List, Dict, Optional, Literal
from datetime import datetime


class CalicoNodeStatus(BaseModel):
    """Per-node Calico agent status."""
    node: str
    felix_ready: bool = True
    bird_ready: bool = True
    ip: Optional[str] = None
    uptime_seconds: Optional[int] = None
    last_reported: Optional[str] = None


class BGPPeer(BaseModel):
    name: str
    node: Optional[str] = None
    peer_ip: Optional[str] = None
    peer_as_number: Optional[int] = None
    node_as_number: Optional[int] = None
    session_state: Optional[str] = None


class IPPool(BaseModel):
    name: str
    cidr: str
    nat_outgoing: bool = True
    disabled: bool = False
    mode: str = "ipip"  # ipip, vxlan, none
    node_selector: Optional[str] = None


class IPAMBlockSummary(BaseModel):
    """Aggregated per-pool IPAM utilization."""
    pool: str
    blocks: int = 0
    allocated: int = 0
    total: int = 0
    utilization_pct: float = 0.0


class CniPolicy(BaseModel):
    name: str
    namespace: Optional[str] = None
    type: Literal["NetworkPolicy", "GlobalNetworkPolicy"] = "GlobalNetworkPolicy"
    policy_type: Optional[List[str]] = None
    selector: Optional[str] = None
    order: Optional[float] = None
    rules_count: int = 0


class CniTopologyEdge(BaseModel):
    source: str
    target: str
    type: Literal["bgp", "overlay"] = "overlay"


class CniTopology(BaseModel):
    nodes: List[Dict[str, str]]
    edges: List[CniTopologyEdge]


class FelixMetricPoint(BaseModel):
    timestamp: datetime
    value: float


class FelixMetricsResponse(BaseModel):
    active_local_endpoints: Optional[int] = None
    cluster_network_policies: Optional[int] = None
    iptables_restore_errors: Optional[int] = None
    bgp_sessions_active: Optional[int] = None
    int_dataplane_failures: Optional[int] = None
    time_series: Optional[Dict[str, List[FelixMetricPoint]]] = None
