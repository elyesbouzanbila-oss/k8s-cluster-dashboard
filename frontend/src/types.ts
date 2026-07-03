export interface Pod {
  name: string
  namespace: string
  pod_ip: string
  node_name: string
  phase: string
  labels: Record<string, string>
  containers: Array<{ name: string; image: string }>
}

export interface TopologyNode {
  id: string
  type: 'pod' | 'service' | 'node'
  namespace?: string
  name: string
  ip?: string
  labels?: Record<string, string>
  node_name?: string
  role?: 'master' | 'worker'
  capacity?: Record<string, string>
}

export interface TopologyEdge {
  id: string
  source: string
  target: string
}

export interface ThreatEvent {
  id: string
  priority: 'Critical' | 'High' | 'Medium' | 'Warning'
  rule: string
  output: string
  time: string
}

export interface RbacBinding {
  name: string
  namespace?: string
  binding_type: string
  role_ref: { kind: string; name: string; api_group: string }
  subjects: Array<{ kind: string; name: string; namespace?: string }>
}

export interface PrivilegedPod {
  name: string
  namespace: string
  container: string
  image: string
  privileged: boolean
  run_as_user?: number
}

export interface NodeMetric {
  name: string
  os: string
  kubeletVersion: string
  capacity: { cpu: string; memory: string }
  usage: { cpu: string; memory: string }
}

export interface ContainerMetric {
  name: string
  image: string
  cpu: {
    usage: string
    request?: string
    limit?: string
  }
  memory: {
    usage: string
    request?: string
    limit?: string
  }
}

export interface PodMetric {
  namespace: string
  name: string
  node: string
  containers: ContainerMetric[]
  pod_cpu_usage: string
  pod_memory_usage: string
}

export interface StorageClass {
  metadata: { name: string; annotations?: Record<string, string> }
  provisioner: string
}

export interface PVC {
  metadata: { uid: string; name: string; namespace: string }
  status: { phase: string }
  spec: { resources: { requests: { storage: string } } }
}

export interface StorageData {
  storageClasses: StorageClass[]
  persistentVolumeClaims: PVC[]
}

export interface PromSeriesPoint {
  timestamp: number  // Unix seconds
  value: number
}

export interface PromSeries {
  label: string         // container name or pod name
  values: PromSeriesPoint[]
}

export interface PrometheusResponse {
  status: 'success' | 'mock' | 'error'
  data: {
    resultType: string
    result: Array<{
      metric: Record<string, string>
      values: Array<[number, string]>
    }>
  } | null
}

export type DataSourceStatus = 'live' | 'mock' | 'error' | 'unknown'

export interface MetricsResponse<T> {
  status: 'success' | 'mock' | 'error'
  data: T
}

// ─── CNI (Calico) Types ──────────────────────────────────────────

export interface CalicoNodeStatus {
  node: string
  felix_ready: boolean
  bird_ready: boolean
  ip?: string | null
  uptime_seconds?: number | null
  last_reported?: string | null
}

export interface BGPPeer {
  name: string
  node?: string | null
  peer_ip?: string | null
  peer_as_number?: number | null
  node_as_number?: number | null
  session_state?: string | null
}

export interface IPPool {
  name: string
  cidr: string
  nat_outgoing: boolean
  disabled: boolean
  mode: string
  node_selector?: string | null
}

export interface IPAMBlockSummary {
  pool: string
  blocks: number
  allocated: number
  total: number
  utilization_pct: number
}

export interface CniPolicy {
  name: string
  namespace?: string | null
  type: 'NetworkPolicy' | 'GlobalNetworkPolicy'
  policy_type?: string[] | null
  selector?: string | null
  order?: number | null
  rules_count: number
}

export interface CniTopologyNode {
  id: string
  name: string
  role: string
  ip?: string | null
}

export interface CniTopologyEdge {
  source: string
  target: string
  type: 'bgp' | 'overlay'
}

export interface CniTopologyResponse {
  nodes: CniTopologyNode[]
  edges: CniTopologyEdge[]
}

export interface FelixMetrics {
  active_local_endpoints?: number
  cluster_network_policies?: number
  iptables_restore_errors?: number
  bgp_sessions_active?: number
  int_dataplane_failures?: number
}

export interface ApiResponse<T> {
  status: 'success' | 'mock' | 'error'
  data: T
}
