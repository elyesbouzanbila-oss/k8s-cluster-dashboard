import { useState, useMemo, useCallback } from 'react'
import type { Pod, TopologyNode, TopologyEdge, DataSourceStatus } from '../types'
import { Topology } from '../Topology'
import { DataSourceBadge } from './DataSourceBadge'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'
import { copyToClipboard, showCopiedFeedback, getNsColor } from '../utils'
import { Icon } from './Icon'

interface NetworkPanelProps {
  pods: Pod[]
  topology: { nodes: TopologyNode[]; edges: TopologyEdge[] }
  podsStatus?: DataSourceStatus
  topologyStatus?: DataSourceStatus
  loading?: boolean
}

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

// ─── Copy Button ───────────────────────────────────────────────────
function CopyButton({ value, label, title }: { value: string; label: string; title?: string }) {
  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await copyToClipboard(value)
    if (ok) {
      showCopiedFeedback(e.currentTarget as HTMLElement)
    }
  }, [value])

  return (
    <span style={{ position: 'relative', display: 'inline' }}>
      <span
        title={title || label}
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          borderBottom: '1px dashed var(--border)',
          transition: 'border-color 0.2s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        {label}
      </span>
      <Icon name="copy" size={12} style={{ marginLeft: '4px', opacity: 0.4, verticalAlign: 'middle', flexShrink: 0 }} />
    </span>
  )
}

// ─── Namespace Section Component ────────────────────────────────
function NsSection({ name, pods, defaultOpen }: { name: string; pods: Pod[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const color = getNsColor(name)

  return (
    <div className="ns-section" style={{ '--ns-color': color }}>
      {/* Collapsible header */}
      <button
        className="ns-section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ '--ns-color': color }}
      >
        <Icon
          name="chevron-right"
          size={16}
          className="ns-chevron"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="ns-section-title">{name}</span>
        <span className="ns-section-count">{pods.length} pod{pods.length !== 1 ? 's' : ''}</span>
      </button>

      {/* Pod cards grid */}
      {open && (
        <div className="pod-list">
          {pods.map(pod => (
            <div key={`${pod.namespace}/${pod.name}`} className="pod-card">
              <div className="pod-header">
                <h4 title={pod.name}>{pod.name}</h4>
                <span className={`status ${pod.phase.toLowerCase()}`}>{pod.phase}</span>
              </div>
              <div className="pod-info">
                <p>
                  <strong>IP:</strong>{' '}
                  <CopyButton
                    value={pod.pod_ip || '-'}
                    label={pod.pod_ip || '-'}
                    title={pod.pod_ip || '-'}
                  />
                </p>
                <p>
                  <strong>Node:</strong>{' '}
                  <CopyButton
                    value={pod.node_name || '-'}
                    label={pod.node_name || '-'}
                    title={pod.node_name || '-'}
                  />
                </p>
                <p><strong>Namespace:</strong> <CopyButton value={pod.namespace} label={pod.namespace} title={pod.namespace} /></p>
              </div>
              {Object.keys(pod.labels).length > 0 && (
                <div className="pod-labels">
                  {Object.entries(pod.labels).map(([k, v]) => (
                    <span key={k} className="label" title={`${k}=${v}`}>{k}={v}</span>
                  ))}
                </div>
              )}
              <div className="containers">
                <strong>Containers:</strong>
                {pod.containers.map(c => (
                  <div key={c.name} className="container-item">
                    <CopyButton value={c.image} label={`${c.name}: ${c.image.split('/').pop()}`} title={c.image} />
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
export function NetworkPanel({ pods, topology, podsStatus, topologyStatus, loading }: NetworkPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPods = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return pods
    return pods.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.namespace.toLowerCase().includes(q) ||
      p.pod_ip.toLowerCase().includes(q) ||
      p.node_name.toLowerCase().includes(q)
    )
  }, [pods, searchQuery])

  const nsGroups = groupByNamespace(filteredPods)

  const showSearch = pods.length > 10

  return (
    <div className="section network-section">
      <h2>Network Discovery</h2>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Pods ({filteredPods.length})</h3>
          <DataSourceBadge status={podsStatus} label="Pod data" />
        </div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton variant="card" count={4} />
          </div>
        ) : pods.length === 0 ? (
          <EmptyState
            icon={<Icon name="pod" size={48} />}
            message="No pods found"
            submessage="Ensure your K8s cluster is configured and accessible."
          />
        ) : (
          <>
            {showSearch && (
              <div className="security-toolbar" style={{ marginBottom: '16px' }}>
                <div className="security-search">
                  <Icon name="search" className="security-search-icon" />
                  <input
                    type="text"
                    className="security-search-input"
                    placeholder="Search pods by name, namespace, IP..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label="Search pods"
                  />
                  {searchQuery && (
                    <button
                      className="security-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="ns-sections">
              {nsGroups.length === 0 ? (
                <EmptyState
                  icon={<Icon name="search" size={48} />}
                  message="No matching pods"
                  submessage="Try adjusting your search."
                />
              ) : (
                nsGroups.map(([ns, nsPods], i) => (
                  <NsSection key={ns} name={ns} pods={nsPods} defaultOpen={i === 0} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Topology</h3>
          <DataSourceBadge status={topologyStatus} label="Topology data" />
        </div>
        {topology.nodes.length === 0 ? (
          <EmptyState
            icon={<Icon name="network" size={48} />}
            message="No topology data"
            submessage="Ensure your K8s cluster is configured and accessible."
          />
        ) : (
          <Topology nodes={topology.nodes} edges={topology.edges} />
        )}
      </div>
    </div>
  )
}
