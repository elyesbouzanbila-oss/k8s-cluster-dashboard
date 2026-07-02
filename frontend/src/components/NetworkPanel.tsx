import { useState, useMemo, useCallback } from 'react'
import type { Pod, TopologyNode, TopologyEdge, DataSourceStatus } from '../types'
import { Topology } from '../Topology'
import { DataSourceBadge } from './DataSourceBadge'
import { EmptyState } from './EmptyState'
import { copyToClipboard, showCopiedFeedback } from '../utils'

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
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="12"
        height="12"
        style={{
          marginLeft: '4px',
          opacity: 0.4,
          verticalAlign: 'middle',
          flexShrink: 0,
        }}
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </span>
  )
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
export function NetworkPanel({ pods, topology, podsStatus, topologyStatus }: NetworkPanelProps) {
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

  return (
    <div className="section network-section">
      <h2>Network Discovery</h2>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Pods ({filteredPods.length})</h3>
          <DataSourceBadge status={podsStatus} label="Pod data" />
        </div>
        {pods.length === 0 ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
              </svg>
            }
            message="No pods found"
            submessage="Ensure your K8s cluster is configured and accessible."
          />
        ) : (
          <>
            {pods.length > 10 && (
              <div className="security-toolbar" style={{ marginBottom: '16px' }}>
                <div className="security-search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="security-search-icon">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="ns-sections">
              {nsGroups.length === 0 ? (
                <EmptyState
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  }
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
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <circle cx="19" cy="5" r="2" />
                <circle cx="5" cy="5" r="2" />
              </svg>
            }
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
