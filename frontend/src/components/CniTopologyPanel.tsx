import { useMemo } from 'react'
import type { CniTopologyNode, CniTopologyEdge, Pod, DataSourceStatus, TopologyNode, TopologyEdge as TopologyEdgeType } from '../types'
import { DataSourceBadge } from './DataSourceBadge'
import { Topology } from '../Topology'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'

interface CniTopologyPanelProps {
  pods: Pod[]
  cniTopology: { nodes: CniTopologyNode[]; edges: CniTopologyEdge[] } | null
  topologyStatus?: DataSourceStatus
}

export function CniTopologyPanel({ pods, cniTopology, topologyStatus }: CniTopologyPanelProps) {
  // Convert CNI topology to the format expected by Topology component
  const adaptedTopology = useMemo(() => {
    const nodes: TopologyNode[] = []
    const edges: TopologyEdgeType[] = []

    if (cniTopology) {
      // Add all nodes from the topology (cluster nodes, pods, services)
      for (const n of cniTopology.nodes) {
        const nodeType = n.type || 'node'
        if (nodeType === 'node') {
          nodes.push({
            id: n.id,
            type: 'node' as const,
            name: n.name,
            role: (n.role as 'master' | 'worker') || 'worker',
            ip: n.ip || undefined,
            ready: n.ready ?? true,
          })
        } else if (nodeType === 'pod') {
          nodes.push({
            id: n.id,
            type: 'pod' as const,
            namespace: n.namespace || undefined,
            name: n.name,
            ip: n.ip || undefined,
            labels: n.labels || undefined,
            node_name: n.node_name || undefined,
          })
        } else if (nodeType === 'service') {
          nodes.push({
            id: n.id,
            type: 'service' as const,
            namespace: n.namespace || undefined,
            name: n.name,
            ip: n.ip || undefined,
          })
        }
      }

      // Add edges - convert to TopologyEdge format
      for (const e of cniTopology.edges) {
        if (e.type === 'bgp') {
          // BGP edges get a label and may need synthetic BGP peer nodes
          const edgeId = e.id || `cni-${e.source}-to-${e.target}-bgp`
          edges.push({
            id: edgeId,
            source: e.source,
            target: e.target,
            label: 'BGP',
          })

          // If BGP peer target is a bgp:IP address, add it as a node so it renders
          if (e.target.startsWith('bgp:')) {
            const ip = e.target.replace('bgp:', '')
            if (!nodes.some(n => n.id === e.target)) {
              nodes.push({
                id: e.target,
                type: 'service' as const,
                name: `BGP ${ip}`,
                ip,
              })
            }
          }
        } else if (e.type === 'overlay') {
          const edgeId = e.id || `cni-${e.source}-to-${e.target}-overlay`
          edges.push({
            id: edgeId,
            source: e.source,
            target: e.target,
            label: 'Overlay',
          })
        } else {
          // Pod-to-service edges (no type field) — use the edge's id directly
          edges.push({
            id: e.id || `${e.source}-to-${e.target}`,
            source: e.source,
            target: e.target,
          })
        }
      }
    }

    return { nodes, edges }
  }, [cniTopology])

  const bgpPeerCount = cniTopology?.edges.filter(e => e.type === 'bgp').length || 0
  const overlayCount = cniTopology?.edges.filter(e => e.type === 'overlay').length || 0
  const nodeCount = cniTopology?.nodes.length || 0

  return (
    <div className="section cni-topology-section">
      <h2>CNI Topology</h2>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Network Map</h3>
          <DataSourceBadge status={topologyStatus} label="Topology data" />
        </div>

        {/* Extended stats bar */}
        <div className="cni-topology-stats" style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div className="cni-topology-stat">
            <span className="cni-topology-stat-value">{nodeCount}</span>
            <span className="cni-topology-stat-label">Nodes</span>
          </div>
          <div className="cni-topology-stat">
            <span className="cni-topology-stat-value">{pods.length}</span>
            <span className="cni-topology-stat-label">Pods</span>
          </div>
          <div className="cni-topology-stat">
            <span className="cni-topology-stat-value">{bgpPeerCount}</span>
            <span className="cni-topology-stat-label">BGP Peers</span>
          </div>
          <div className="cni-topology-stat">
            <span className="cni-topology-stat-value">{overlayCount}</span>
            <span className="cni-topology-stat-label">Overlay Links</span>
          </div>
        </div>

        {!cniTopology || (adaptedTopology.nodes.length === 0) ? (
          <EmptyState
            icon={<Icon name="network" size={48} />}
            message="No topology data available"
            submessage="Ensure Calico is configured and the backend can access the K8s API."
          />
        ) : (
          <Topology
            nodes={adaptedTopology.nodes}
            edges={adaptedTopology.edges}
          />
        )}
      </div>
    </div>
  )
}
