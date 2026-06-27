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
