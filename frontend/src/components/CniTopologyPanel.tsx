import { useState, useMemo } from 'react'
import type { CniTopologyNode, CniTopologyEdge, Pod, DataSourceStatus, TopologyNode, TopologyEdge as TopologyEdgeType } from '../types'
import { DataSourceBadge } from './DataSourceBadge'
import { Topology } from '../Topology'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { getNsColor } from '../utils'

interface CniTopologyPanelProps {
  pods: Pod[]
  cniTopology: { nodes: CniTopologyNode[]; edges: CniTopologyEdge[] } | null
  topologyStatus?: DataSourceStatus
}

export function CniTopologyPanel({ pods, cniTopology, topologyStatus }: CniTopologyPanelProps) {
  const [inventoryFilter, setInventoryFilter] = useState('')
  const [showPods, setShowPods] = useState(true)
  const [showServices, setShowServices] = useState(true)

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

  // ── Derive services from topology nodes ───────────────────────
  const services = useMemo(() => {
    if (!cniTopology) return []
    return cniTopology.nodes.filter(n => n.type === 'service' && !n.id.startsWith('bgp:')).map(s => ({
      id: s.id,
      namespace: s.namespace || 'unknown',
      name: s.name,
      clusterIp: s.ip || '-',
    }))
  }, [cniTopology])

  // Compute matched pod count per service from edges
  const servicePodCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (cniTopology) {
      for (const e of cniTopology.edges) {
        if (!e.type && e.target.startsWith('svc:')) {
          counts[e.target] = (counts[e.target] || 0) + 1
        }
      }
    }
    return counts
  }, [cniTopology])

  // ── Filtered inventories ──────────────────────────────────────
  const filterLower = inventoryFilter.toLowerCase()

  const filteredPods = useMemo(() => {
    if (!filterLower) return pods
    return pods.filter(p =>
      p.name.toLowerCase().includes(filterLower) ||
      p.namespace.toLowerCase().includes(filterLower) ||
      p.node_name.toLowerCase().includes(filterLower) ||
      p.pod_ip.toLowerCase().includes(filterLower) ||
      p.phase.toLowerCase().includes(filterLower)
    )
  }, [pods, filterLower])

  const filteredServices = useMemo(() => {
    if (!filterLower) return services
    return services.filter(s =>
      s.name.toLowerCase().includes(filterLower) ||
      s.namespace.toLowerCase().includes(filterLower) ||
      s.clusterIp.toLowerCase().includes(filterLower)
    )
  }, [services, filterLower])

  // ── Namespace grouping ────────────────────────────────────────
  const nsCounts = useMemo(() => {
    const counts: Record<string, { pods: number; services: number }> = {}
    for (const p of pods) {
      if (!counts[p.namespace]) counts[p.namespace] = { pods: 0, services: 0 }
      counts[p.namespace].pods++
    }
    for (const s of services) {
      if (!counts[s.namespace]) counts[s.namespace] = { pods: 0, services: 0 }
      counts[s.namespace].services++
    }
    return counts
  }, [pods, services])

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

      {/* ── Pod & Service Inventory ────────────────────────────────── */}
      <div className="subsection" style={{ marginTop: '24px' }}>
        <div className="subsection-header">
          <h3>Cluster Inventory</h3>
          <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            {Object.keys(nsCounts).length} namespaces · {pods.length} pods · {services.length} services
          </span>
        </div>

        {/* Search filter */}
        <div className="inventory-search">
          <input
            type="text"
            placeholder="Filter pods and services by name, namespace, IP, or node…"
            value={inventoryFilter}
            onChange={e => setInventoryFilter(e.target.value)}
            className="inventory-filter-input"
            aria-label="Filter pods and services"
          />
          {inventoryFilter && (
            <button
              className="inventory-filter-clear"
              onClick={() => setInventoryFilter('')}
              aria-label="Clear filter"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        {/* ── Namespace summary chips ──────────────────────────── */}
        <div className="namespace-chips">
          {Object.entries(nsCounts).sort().map(([ns, counts]) => (
            <span
              key={ns}
              className="namespace-chip"
              style={{
                backgroundColor: getNsColor(ns),
                color: '#fff',
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
              title={`${counts.pods} pods · ${counts.services} services`}
            >
              {ns} ({counts.pods}p / {counts.services}s)
            </span>
          ))}
        </div>

        {/* ── Pods table ───────────────────────────────────────── */}
        <div className="inventory-section">
          <button
            className="inventory-toggle"
            onClick={() => setShowPods(!showPods)}
            aria-expanded={showPods}
            style={{
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text)',
              padding: '8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
            }}
          >
            <span style={{ transform: showPods ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
            <span>Pods</span>
            <span className="inventory-count" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {filteredPods.length}{inventoryFilter ? ` / ${pods.length}` : ''}
            </span>
          </button>

          {showPods && filteredPods.length > 0 && (
            <div className="inventory-table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="inventory-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Namespace</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>IP</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Node</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Phase</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPods.map(p => (
                    <tr key={`${p.namespace}/${p.name}`} className="inventory-row" style={{ transition: 'background 0.1s' }}>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: '12px' }}>{p.name}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{
                          backgroundColor: getNsColor(p.namespace),
                          color: '#fff',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}>{p.namespace}</span>
                      </td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{p.pod_ip}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{p.node_name}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <PhaseBadge phase={p.phase} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showPods && filteredPods.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              {inventoryFilter ? 'No pods match your filter.' : 'No pod data available.'}
            </div>
          )}
        </div>

        {/* ── Services table ───────────────────────────────────── */}
        <div className="inventory-section">
          <button
            className="inventory-toggle"
            onClick={() => setShowServices(!showServices)}
            aria-expanded={showServices}
            style={{
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text)',
              padding: '8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
            }}
          >
            <span style={{ transform: showServices ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
            <span>Services</span>
            <span className="inventory-count" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {filteredServices.length}{inventoryFilter ? ` / ${services.length}` : ''}
            </span>
          </button>

          {showServices && filteredServices.length > 0 && (
            <div className="inventory-table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="inventory-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Namespace</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Cluster IP</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Endpoints</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map(s => (
                    <tr key={s.id} className="inventory-row" style={{ transition: 'background 0.1s' }}>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: '12px' }}>{s.name}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{
                          backgroundColor: getNsColor(s.namespace),
                          color: '#fff',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}>{s.namespace}</span>
                      </td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{s.clusterIp}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{
                          backgroundColor: servicePodCounts[s.id] ? 'var(--accent-bg, rgba(59,130,246,0.12))' : 'transparent',
                          color: servicePodCounts[s.id] ? 'var(--accent, #3B82F6)' : 'var(--text-tertiary)',
                          padding: '1px 8px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}>
                          {servicePodCounts[s.id] ?? 0} pods
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showServices && filteredServices.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              {inventoryFilter ? 'No services match your filter.' : 'No service data available.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PhaseBadge({ phase }: { phase: string }) {
  const colorMap: Record<string, string> = {
    Running: 'var(--success, #22C55E)',
    Pending: 'var(--warning, #F59E0B)',
    Succeeded: 'var(--text-tertiary, #94A3B8)',
    Failed: 'var(--danger, #EF4444)',
    Unknown: 'var(--text-tertiary, #94A3B8)',
  }
  const bgMap: Record<string, string> = {
    Running: 'rgba(34, 197, 94, 0.1)',
    Pending: 'rgba(245, 158, 11, 0.1)',
    Succeeded: 'rgba(148, 163, 184, 0.1)',
    Failed: 'rgba(239, 68, 68, 0.1)',
    Unknown: 'rgba(148, 163, 184, 0.1)',
  }
  const color = colorMap[phase] || colorMap.Unknown
  const bg = bgMap[phase] || bgMap.Unknown
  return (
    <span style={{
      backgroundColor: bg,
      color: color,
      padding: '1px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 600,
    }}>
      {phase}
    </span>
  )
}
