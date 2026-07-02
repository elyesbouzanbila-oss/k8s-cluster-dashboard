import { useState, useEffect, useMemo, useCallback } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { PodMetric, PrometheusResponse, PromSeries } from '../types'
import { getNsColor, CONTAINER_COLORS } from '../utils'
import { DataSourceBadge } from './DataSourceBadge'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface MonitoringPanelProps {
  podMetrics: PodMetric[]
}

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const API_KEY = import.meta.env.VITE_API_KEY || 'your-secret-api-key-change-this'

// ─── Helpers ───────────────────────────────────────────────────
function parsePromResult(result: PrometheusResponse['data']): PromSeries[] {
  if (!result || !result.result) return []
  return result.result.map((r) => ({
    label: r.metric
      ? Object.values(r.metric).filter(Boolean).join(' / ') || 'series'
      : 'series',
    values: (r.values || []).map(([ts, val]) => ({
      timestamp: ts,
      value: parseFloat(val),
    })),
  }))
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`
  return `${bytes} B`
}

function formatCPU(cpu: number): string {
  if (cpu >= 1) return `${cpu.toFixed(2)} cores`
  return `${(cpu * 1000).toFixed(0)}m`
}

// ─── Time-Series Chart ─────────────────────────────────────────
function TimeSeriesChart({ series, title, unit }: {
  series: PromSeries[]
  title: string
  unit: 'cpu' | 'memory'
}) {
  if (!series.length || !series[0].values.length) {
    return (
      <div className="monitoring-chart-empty">
        <Icon name="info" size={20} />
        <span>{title} — no data</span>
      </div>
    )
  }

  const labels = series[0].values.map((p) => {
    const d = new Date(p.timestamp * 1000)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  })

  const datasets = series.map((s, i) => ({
    label: s.label,
    data: s.values.map((p) => p.value),
    borderColor: CONTAINER_COLORS[i % CONTAINER_COLORS.length],
    backgroundColor: CONTAINER_COLORS[i % CONTAINER_COLORS.length] + '20',
    fill: true,
    tension: 0.3,
    pointRadius: 1,
    pointHoverRadius: 4,
    borderWidth: 2,
  }))

  const formatValue = unit === 'cpu' ? formatCPU : formatBytes

  return (
    <div className="monitoring-chart">
      <h4 className="monitoring-chart-title">{title}</h4>
      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 0 },
          resizeDelay: 100,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          scales: {
            x: {
              display: true,
              ticks: {
                color: '#8b949e',
                font: { size: 10 },
                maxTicksLimit: 8,
                maxRotation: 0,
              },
              grid: { display: false },
            },
            y: {
              display: true,
              beginAtZero: true,
              ticks: {
                color: '#8b949e',
                font: { size: 10 },
                callback: (val: number | string) => formatValue(typeof val === 'number' ? val : 0),
              },
              grid: {
                color: 'rgba(255,255,255,0.05)',
              },
            },
          },
          plugins: {
            legend: {
              display: series.length > 1,
              position: 'bottom',
              labels: {
                color: '#8b949e',
                font: { size: 11 },
                boxWidth: 12,
                padding: 12,
              },
            },
            tooltip: {
              backgroundColor: '#1c2333',
              borderColor: '#30363d',
              borderWidth: 1,
              titleColor: '#e6edf3',
              bodyColor: '#8b949e',
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatValue(ctx.parsed.y ?? 0)}`,
              },
            },
          },
        }}
      />
    </div>
  )
}

// ─── Pod Detail Charts ─────────────────────────────────────────
function PodDetailCharts({ namespace, pod }: { namespace: string; pod: string }) {
  const [cpuSeries, setCpuSeries] = useState<PromSeries[]>([])
  const [memSeries, setMemSeries] = useState<PromSeries[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promStatus, setPromStatus] = useState<string>('unknown')

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [cpuRes, memRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/prometheus/pod/cpu?namespace=${encodeURIComponent(namespace)}&pod=${encodeURIComponent(pod)}&duration=60`, {
            headers: { 'X-API-Key': API_KEY },
          }),
          fetch(`${API_BASE_URL}/api/prometheus/pod/memory?namespace=${encodeURIComponent(namespace)}&pod=${encodeURIComponent(pod)}&duration=60`, {
            headers: { 'X-API-Key': API_KEY },
          }),
        ])
        if (cancelled) return

        if (cpuRes.ok) {
          const data: PrometheusResponse = await cpuRes.json()
          if (!cancelled) {
            setCpuSeries(parsePromResult(data.data))
            setPromStatus(prev => {
              const newStatus = data.status === 'success' ? 'success' : data.status === 'mock' ? 'mock' : 'error'
              return prev === 'unknown' ? newStatus : prev
            })
          }
        }
        if (memRes.ok) {
          const data: PrometheusResponse = await memRes.json()
          if (!cancelled) {
            setMemSeries(parsePromResult(data.data))
            if (data.status !== 'success') {
              setPromStatus(data.status === 'mock' ? 'mock' : 'error')
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [namespace, pod])

  if (loading) {
    return <div className="monitoring-chart-loading"><div className="spinner" /> Loading...</div>
  }

  if (error) {
    return <div className="monitoring-chart-empty">{error}</div>
  }

  return (
    <>
      <div className="monitoring-status-bar">
        <DataSourceBadge status={promStatus} label="Prometheus" />
      </div>
      <div className="monitoring-pod-charts">
        <TimeSeriesChart series={cpuSeries} title="CPU Usage" unit="cpu" />
        <TimeSeriesChart series={memSeries} title="Memory Usage" unit="memory" />
      </div>
    </>
  )
}

// ─── Namespace Overview Charts ──────────────────────────────────
function NamespaceOverviewCharts({ namespace }: { namespace: string }) {
  const [cpuSeries, setCpuSeries] = useState<PromSeries[]>([])
  const [memSeries, setMemSeries] = useState<PromSeries[]>([])
  const [loading, setLoading] = useState(false)
  const [promStatus, setPromStatus] = useState<string>('unknown')
  const [duration, setDuration] = useState(60)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const [cpuRes, memRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/prometheus/namespace/cpu?namespace=${encodeURIComponent(namespace)}&duration=${duration}`, {
            headers: { 'X-API-Key': API_KEY },
          }),
          fetch(`${API_BASE_URL}/api/prometheus/namespace/memory?namespace=${encodeURIComponent(namespace)}&duration=${duration}`, {
            headers: { 'X-API-Key': API_KEY },
          }),
        ])
        if (cancelled) return

        if (cpuRes.ok) {
          const data: PrometheusResponse = await cpuRes.json()
          if (!cancelled) {
            setCpuSeries(parsePromResult(data.data))
            setPromStatus(prev => {
              const newStatus = data.status === 'success' ? 'success' : data.status === 'mock' ? 'mock' : 'error'
              return prev === 'unknown' ? newStatus : prev
            })
          }
        }
        if (memRes.ok) {
          const data: PrometheusResponse = await memRes.json()
          if (!cancelled) {
            setMemSeries(parsePromResult(data.data))
            if (data.status !== 'success') {
              setPromStatus(data.status === 'mock' ? 'mock' : 'error')
            }
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [namespace, duration])

  return (
    <div className="monitoring-ns-charts">
      <div className="monitoring-ns-charts-header">
        <div className="monitoring-ns-charts-title">
          <Icon name="bar-chart" size={16} style={{ '--ns-color': getNsColor(namespace) } as React.CSSProperties} />
          <span style={{ '--ns-color': getNsColor(namespace) } as React.CSSProperties}>{namespace}</span>
        </div>
        <div className="monitoring-duration-picker">
          {[15, 30, 60, 180].map((m) => (
            <button
              key={m}
              className={`duration-btn ${duration === m ? 'active' : ''}`}
              onClick={() => setDuration(m)}
            >
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </button>
          ))}
        </div>
      </div>
      <div className="monitoring-status-bar">
        <DataSourceBadge status={promStatus} label="Prometheus" />
      </div>
      {loading ? (
        <div className="monitoring-chart-loading"><div className="spinner" /></div>
      ) : (
        <div className="monitoring-ns-charts-grid">
          <TimeSeriesChart series={cpuSeries} title="CPU by Pod" unit="cpu" />
          <TimeSeriesChart series={memSeries} title="Memory by Pod" unit="memory" />
        </div>
      )}
    </div>
  )
}

// ─── Selected Pod Detail ───────────────────────────────────────
function PodDetailView({ pod, namespace, onClose }: {
  pod: string
  namespace: string
  onClose: () => void
}) {
  return (
    <div className="monitoring-detail-panel">
      <div className="monitoring-detail-header">
        <button className="monitoring-detail-back" onClick={onClose}>
          <Icon name="arrow-left" size={16} />
          Back to overview
        </button>
        <h3>
          <Icon name="pod" size={16} />
          {pod}
          <span className="monitoring-detail-ns">{namespace}</span>
        </h3>
      </div>
      <PodDetailCharts namespace={namespace} pod={pod} />
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────
export function MonitoringPanel({ podMetrics }: MonitoringPanelProps) {
  const [selectedPod, setSelectedPod] = useState<{ name: string; namespace: string } | null>(null)
  const [expandedNs, setExpandedNs] = useState<Set<string>>(new Set(['production']))

  // Collect unique namespaces from pod metrics
  const namespaces = useMemo(() => {
    const nsSet = new Set(podMetrics.map((p) => p.namespace))
    const priority = ['kube-system', 'production', 'monitoring']
    return Array.from(nsSet).sort((a, b) => {
      const ai = priority.indexOf(a)
      const bi = priority.indexOf(b)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.localeCompare(b)
    })
  }, [podMetrics])

  const toggleNs = useCallback((ns: string) => {
    setExpandedNs((prev) => {
      const next = new Set(prev)
      if (next.has(ns)) next.delete(ns)
      else next.add(ns)
      return next
    })
  }, [])

  if (selectedPod) {
    return (
      <PodDetailView
        pod={selectedPod.name}
        namespace={selectedPod.namespace}
        onClose={() => setSelectedPod(null)}
      />
    )
  }

  if (podMetrics.length === 0) {
    return (
      <div className="section monitoring-section">
        <h2>Monitoring</h2>
        <EmptyState
          icon={<Icon name="activity" size={48} />}
          message="No pod metrics available"
          submessage="Ensure metrics-server and Prometheus are installed in your cluster."
        />
      </div>
    )
  }

  return (
    <div className="section monitoring-section">
      <h2>Monitoring</h2>
      <p className="monitoring-subtitle">
        <Icon name="info" size={14} />
        Time-series CPU and memory usage for the last hour. Data sourced from Prometheus. Click a pod name for per-container breakdown.
      </p>

      <div className="monitoring-ns-list">
        {namespaces.map((ns) => {
          const nsPods = podMetrics.filter((p) => p.namespace === ns)
          const isExpanded = expandedNs.has(ns)

          return (
            <div
              key={ns}
              className="monitoring-ns-block"
              style={{ '--ns-color': getNsColor(ns) } as React.CSSProperties}
            >
              <button
                className="monitoring-ns-toggle"
                onClick={() => toggleNs(ns)}
                aria-expanded={isExpanded}
              >
                <Icon
                  name="chevron-right"
                  size={14}
                  className="monitoring-chevron"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                />
                <span className="monitoring-ns-name">{ns}</span>
                <span className="monitoring-ns-count">{nsPods.length} pods</span>
              </button>
              {isExpanded && (
                <div className="monitoring-ns-content">
                  <NamespaceOverviewCharts namespace={ns} />
                  <div className="monitoring-pod-list">
                    {nsPods.map((p) => (
                      <button
                        key={p.name}
                        className="monitoring-pod-chip"
                        onClick={() => setSelectedPod({ name: p.name, namespace: ns })}
                      >
                        <Icon name="pod" size={12} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
