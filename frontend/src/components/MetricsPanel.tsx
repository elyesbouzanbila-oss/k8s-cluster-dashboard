import { useState, useMemo } from 'react'
import type { NodeMetric, PodMetric, DataSourceStatus } from '../types'
import { parseCPU, parseMemory } from '../utils'
import { DataSourceBadge } from './DataSourceBadge'
import { EmptyState } from './EmptyState'

interface MetricsPanelProps {
  nodeMetrics: NodeMetric[]
  podMetrics: PodMetric[]
  nodeMetricsStatus?: DataSourceStatus
  podMetricsStatus?: DataSourceStatus
}

// ─── Namespace Colors ──────────────────────────────────────────
const NS_COLORS: Record<string, string> = {
  'kube-system': '#ec4899',
  'production': '#3b82f6',
  'monitoring': '#10b981',
  'default': '#8b5cf6',
}

function getNsColor(ns: string): string {
  return NS_COLORS[ns] || '#6366F1'
}

// ─── Helpers ───────────────────────────────────────────────────
function parseCPUToMilli(cpuStr: string): number {
  if (!cpuStr) return 0
  if (cpuStr.endsWith('n')) return parseFloat(cpuStr.slice(0, -1)) / 1_000_000
  if (cpuStr.endsWith('m')) return parseFloat(cpuStr.slice(0, -1))
  if (cpuStr.endsWith('u')) return parseFloat(cpuStr.slice(0, -1)) / 1000
  return parseFloat(cpuStr) * 1000
}

function parseMemoryToBytes(memStr: string): number {
  if (!memStr) return 0
  if (memStr.endsWith('Ki')) return parseFloat(memStr.slice(0, -2)) * 1024
  if (memStr.endsWith('Mi')) return parseFloat(memStr.slice(0, -2)) * 1024 * 1024
  if (memStr.endsWith('Gi')) return parseFloat(memStr.slice(0, -2)) * 1024 * 1024 * 1024
  if (memStr.endsWith('Ti')) return parseFloat(memStr.slice(0, -2)) * 1024 * 1024 * 1024 * 1024
  if (memStr.endsWith('k')) return parseFloat(memStr.slice(0, -1)) * 1000
  if (memStr.endsWith('M')) return parseFloat(memStr.slice(0, -1)) * 1000 * 1000
  if (memStr.endsWith('G')) return parseFloat(memStr.slice(0, -1)) * 1000 * 1000 * 1000
  const n = parseFloat(memStr)
  return isNaN(n) ? 0 : n
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`
  return `${bytes} B`
}

function formatCPU(milli: number): string {
  if (milli >= 1000) return `${(milli / 1000).toFixed(2)} cores`
  return `${milli.toFixed(0)}m`
}

function getUsagePercent(value: number, max: number | null | undefined): number | null {
  if (max == null || max <= 0) return null
  return Math.min((value / max) * 100, 100)
}

function getBarColor(percent: number): string {
  if (percent >= 90) return '#ef4444'
  if (percent >= 70) return '#f59e0b'
  if (percent >= 50) return '#3b82f6'
  return '#10b981'
}

// ─── Container Bar Component ───────────────────────────────────
function ContainerBar({ label, usage, request, limit, formatFn }: {
  label: string
  usage: number
  request?: string | null
  limit?: string | null
  formatFn: (v: number) => string
}) {
  const requestVal = request ? (label === 'CPU' ? parseCPUToMilli(request) : parseMemoryToBytes(request)) : null
  const limitVal = limit ? (label === 'CPU' ? parseCPUToMilli(limit) : parseMemoryToBytes(limit)) : null
  const usagePct = getUsagePercent(usage, limitVal)
  const requestPct = requestVal && limitVal ? getUsagePercent(requestVal, limitVal) : null

  return (
    <div className="pod-metrics-bar">
      <div className="pod-metrics-bar-label">
        <span>{label}</span>
        <span className="pod-metrics-bar-values">
          {formatFn(usage)}
          {limitVal != null && ` / ${formatFn(limitVal)}`}
        </span>
      </div>
      <div className="pod-metrics-bar-track">
        {requestPct != null && (
          <div
            className="pod-metrics-bar-request"
            style={{ left: `${requestPct}%` }}
            title={`Request: ${request}`}
          />
        )}
        <div
          className="pod-metrics-bar-fill"
          style={{
            width: `${usagePct ?? 0}%`,
            backgroundColor: usagePct != null ? getBarColor(usagePct) : '#3b82f6',
          }}
        />
      </div>
      {usagePct != null && (
        <span className="pod-metrics-bar-pct">{usagePct.toFixed(1)}%</span>
      )}
    </div>
  )
}

// ─── Container Card ────────────────────────────────────────────
function ContainerCard({ container }: { container: PodMetric['containers'][0] }) {
  const cpuUsage = parseCPUToMilli(container.cpu.usage)
  const memUsage = parseMemoryToBytes(container.memory.usage)
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="container-metrics-card">
      <button
        className="container-metrics-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <svg
          className="container-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="14"
          height="14"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="container-metrics-name">{container.name}</span>
        <span className="container-metrics-image" title={container.image}>
          {container.image.split('/').pop()}
        </span>
      </button>
      {expanded && (
        <div className="container-metrics-bars">
          <ContainerBar
            label="CPU"
            usage={cpuUsage}
            request={container.cpu.request}
            limit={container.cpu.limit}
            formatFn={formatCPU}
          />
          <ContainerBar
            label="Memory"
            usage={memUsage}
            request={container.memory.request}
            limit={container.memory.limit}
            formatFn={formatBytes}
          />
        </div>
      )}
    </div>
  )
}

// ─── Pod Metric Card ───────────────────────────────────────────
function PodMetricCard({ pod }: { pod: PodMetric }) {
  const cpuMilli = parseCPUToMilli(pod.pod_cpu_usage)
  const memBytes = parseMemoryToBytes(pod.pod_memory_usage)

  return (
    <div className="pod-metric-card">
      <div className="pod-metric-header">
        <div className="pod-metric-name-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="pod-metric-icon">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <h4>{pod.name}</h4>
        </div>
        <div className="pod-metric-node">{pod.node}</div>
      </div>
      <div className="pod-metric-summary">
        <div className="pod-metric-summary-item">
          <span className="pod-metric-summary-label">CPU</span>
          <span className="pod-metric-summary-value">{formatCPU(cpuMilli)}</span>
        </div>
        <div className="pod-metric-summary-item">
          <span className="pod-metric-summary-label">Memory</span>
          <span className="pod-metric-summary-value">{formatBytes(memBytes)}</span>
        </div>
        <div className="pod-metric-summary-item">
          <span className="pod-metric-summary-label">Containers</span>
          <span className="pod-metric-summary-value">{pod.containers.length}</span>
        </div>
      </div>
      <div className="pod-metric-containers">
        {pod.containers.map((ctr) => (
          <ContainerCard key={ctr.name} container={ctr} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────
export function MetricsPanel({ nodeMetrics, podMetrics, nodeMetricsStatus, podMetricsStatus }: MetricsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPodMetrics = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return podMetrics
    return podMetrics.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.namespace.toLowerCase().includes(q) ||
      p.node.toLowerCase().includes(q)
    )
  }, [podMetrics, searchQuery])

  // Group pod metrics by namespace
  const podsByNs = useMemo(() => {
    const grouped: Record<string, PodMetric[]> = {}
    const nsOrder: string[] = []

    for (const pod of podMetrics) {
      const ns = pod.namespace
      if (!grouped[ns]) {
        grouped[ns] = []
        nsOrder.push(ns)
      }
      grouped[ns].push(pod)
    }

    // Sort: kube-system first, then production, monitoring, alphabetically
    const priority = ['kube-system', 'production', 'monitoring']
    nsOrder.sort((a, b) => {
      const ai = priority.indexOf(a)
      const bi = priority.indexOf(b)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.localeCompare(b)
    })

    // Sort pods within each namespace by name
    for (const ns of nsOrder) {
      grouped[ns].sort((a, b) => a.name.localeCompare(b.name))
    }

    return { grouped, nsOrder }
  }, [filteredPodMetrics])

  // Calculate cluster-wide pod resource totals
  const clusterTotalCPU = useMemo(
    () => filteredPodMetrics.reduce((acc, p) => acc + parseCPUToMilli(p.pod_cpu_usage), 0),
    [filteredPodMetrics]
  )
  const clusterTotalMem = useMemo(
    () => filteredPodMetrics.reduce((acc, p) => acc + parseMemoryToBytes(p.pod_memory_usage), 0),
    [filteredPodMetrics]
  )

  return (
    <div className="section metrics-section">
      <h2>Cluster Metrics</h2>

      {/* Node-level metrics (existing) */}
      <div className="subsection">
        <div className="subsection-header">
          <h3>Node Resource Usage</h3>
          <DataSourceBadge status={nodeMetricsStatus} label="Node metrics" />
        </div>
        {nodeMetrics.length === 0 ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            }
            message="No node metrics found"
            submessage="Ensure metrics-server is installed in your cluster."
          />
        ) : (
          <div className="metrics-grid">
            {nodeMetrics.map((node) => {
              const usedCPU = parseCPU(node.usage.cpu)
              const totalCPU = parseInt(node.capacity.cpu)
              const cpuPct = totalCPU > 0 ? (usedCPU / totalCPU) * 100 : 0
              const usedMem = parseMemory(node.usage.memory)
              const totalMem = parseMemory(node.capacity.memory)
              const memPct = totalMem > 0 ? (usedMem / totalMem) * 100 : 0

              return (
                <div key={node.name} className="metrics-card">
                  <div className="metrics-card-header">
                    <h4>{node.name}</h4>
                  </div>
                  <p className="metrics-card-sub">{node.kubeletVersion} | {node.os}</p>

                  <div className="metrics-bar-group">
                    <div className="metrics-bar-row">
                      <div className="metrics-bar-label">
                        <span>CPU Usage</span>
                        <span>{usedCPU.toFixed(2)} / {totalCPU} Cores</span>
                      </div>
                      <div className="metrics-bar-track">
                        <div className="metrics-bar-fill cpu-bar-fill" style={{ width: `${cpuPct}%` }} />
                      </div>
                    </div>

                    <div className="metrics-bar-row">
                      <div className="metrics-bar-label">
                        <span>Memory Usage</span>
                        <span>{usedMem.toFixed(2)} / {totalMem.toFixed(2)} GiB</span>
                      </div>
                      <div className="metrics-bar-track">
                        <div className="metrics-bar-fill mem-bar-fill" style={{ width: `${memPct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pod-level resource consumption (NEW — cAdvisor data) */}
      <div className="subsection">
        <div className="subsection-header">
          <h3>Per-Pod Resource Consumption</h3>
          <DataSourceBadge status={podMetricsStatus} label="Pod metrics" />
        </div>
        {podMetrics.length === 0 ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
              </svg>
            }
            message="No pod metrics found"
            submessage="cAdvisor / metrics-server may not be running."
          />
        ) : (
          <>
            {podMetrics.length > 5 && (
              <div className="security-toolbar" style={{ marginBottom: '16px' }}>
                <div className="security-search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="security-search-icon">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="security-search-input"
                    placeholder="Search pods by name, namespace, node..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label="Search pod metrics"
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
            <div className="pod-metrics-cluster-summary">
              <div className="pod-metrics-cluster-stat">
                <span className="cluster-stat-label">Total Pods Monitored</span>
                <span className="cluster-stat-value">{filteredPodMetrics.length}</span>
              </div>
              <div className="pod-metrics-cluster-stat">
                <span className="cluster-stat-label">Total CPU Usage</span>
                <span className="cluster-stat-value">{formatCPU(clusterTotalCPU)}</span>
              </div>
              <div className="pod-metrics-cluster-stat">
                <span className="cluster-stat-label">Total Memory Usage</span>
                <span className="cluster-stat-value">{formatBytes(clusterTotalMem)}</span>
              </div>
              <div className="pod-metrics-cluster-stat">
                <span className="cluster-stat-label">Namespaces</span>
                <span className="cluster-stat-value">{podsByNs.nsOrder.length}</span>
              </div>
            </div>

            <div className="pod-metrics-by-ns">
              {podsByNs.nsOrder.map((ns) => (
                <div
                  key={ns}
                  className="pod-metrics-ns-section"
                  style={{ borderLeftColor: getNsColor(ns) }}
                >
                  <div className="pod-metrics-ns-header">
                    <span className="pod-metrics-ns-name">{ns}</span>
                    <span className="pod-metrics-ns-count">
                      {podsByNs.grouped[ns].length} pod{podsByNs.grouped[ns].length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="pod-metrics-ns-grid">
                    {podsByNs.grouped[ns].map((pod) => (
                      <PodMetricCard key={`${pod.namespace}/${pod.name}`} pod={pod} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="pod-metrics-source">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Data sourced from cAdvisor via metrics-server. Usage vs limit bars show actual vs configured limits.
        </p>
      </div>
    </div>
  )
}
