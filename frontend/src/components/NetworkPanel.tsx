import { useState } from 'react'
import type { Pod, TopologyNode, TopologyEdge, DataSourceStatus } from '../types'
import { Topology } from '../Topology'
import { DataSourceBadge } from './DataSourceBadge'

interface NetworkPanelProps {
  pods: Pod[]
  topology: { nodes: TopologyNode[]; edges: TopologyEdge[] }
  podsStatus?: DataSourceStatus
  topologyStatus?: DataSourceStatus
}

// ─── Namespace color palette (consistent with topology) ─────────
const NS_COLORS: Record<string, string> = {
  'kube-system': '#F59E0B',
  'production': '#10B981',
  'monitoring': '#06B6D4',
}

const getNsColor = (ns: string): string => NS_COLORS[ns] || '#6366F1'

// ─── Group pods by namespace ────────────────────────────────────
function groupByNamespace(pods: Pod[]): [string, Pod[]][] {
  const groups: Record<string, Pod[]> = {}
  for (const pod of pods) {
    const ns = pod.namespace || 'unknown'
    if (!groups[ns]) groups[ns] = []
    groups[ns].push(pod)
  }
  // Sort namespaces: system first, then alphabetical
  const order = ['kube-system', 'production', 'monitoring']
  const sorted = Object.entries(groups).sort(([a], [b]) => {
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b)
  })
  return sorted
}

// ─── Namespace Section Component ────────────────────────────────
function NsSection({ name, pods, defaultOpen }: { name: string; pods: Pod[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const color = getNsColor(name)

  return (
    <div className="ns-section" style={{ borderLeftColor: color }}>
      {/* Collapsible header */}
      <button
        className="ns-section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ color }}
      >
        <svg
          className="ns-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          height="16"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="ns-section-title">{name}</span>
        <span className="ns-section-count">{pods.length} pod{pods.length !== 1 ? 's' : ''}</span>
      </button>

      {/* Pod cards grid */}
      {open && (
        <div className="pod-list">
          {pods.map(pod => (
            <div key={`${pod.namespace}/${pod.name}`} className="pod-card">
              <div className="pod-header">
                <h4>{pod.name}</h4>
                <span className={`status ${pod.phase.toLowerCase()}`}>{pod.phase}</span>
              </div>
              <div className="pod-info">
                <p><strong>IP:</strong> {pod.pod_ip || '-'}</p>
                <p><strong>Node:</strong> {pod.node_name || '-'}</p>
              </div>
              {Object.keys(pod.labels).length > 0 && (
                <div className="pod-labels">
                  {Object.entries(pod.labels).map(([k, v]) => (
                    <span key={k} className="label">{k}={v}</span>
                  ))}
                </div>
              )}
              <div className="containers">
                <strong>Containers:</strong>
                {pod.containers.map(c => (
                  <div key={c.name} className="container-item">
                    <code>{c.name}</code>: {c.image}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────
export function NetworkPanel({ pods, topology, podsStatus, topologyStatus }: NetworkPanelProps) {
  const nsGroups = groupByNamespace(pods)

  return (
    <div className="section network-section">
      <h2>Network Discovery</h2>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Pods ({pods.length})</h3>
          <DataSourceBadge status={podsStatus} label="Pod data" />
        </div>
        {pods.length === 0 ? (
          <p className="empty">No pods found. Ensure K8s cluster is configured.</p>
        ) : (
          <div className="ns-sections">
            {nsGroups.map(([ns, nsPods], i) => (
              <NsSection key={ns} name={ns} pods={nsPods} defaultOpen={i === 0} />
            ))}
          </div>
        )}
      </div>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Topology</h3>
          <DataSourceBadge status={topologyStatus} label="Topology data" />
        </div>
        {topology.nodes.length === 0 ? (
          <p className="empty">No topology data. Ensure K8s cluster is configured.</p>
        ) : (
          <Topology nodes={topology.nodes} edges={topology.edges} />
        )}
      </div>
    </div>
  )
}
