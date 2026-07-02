import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'
import { Icon } from './components/Icon'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DashboardPanel } from './components/DashboardPanel'
import { NetworkPanel } from './components/NetworkPanel'
import { SecurityPanel } from './components/SecurityPanel'
import { ThreatPanel } from './components/ThreatPanel'
import { MetricsPanel } from './components/MetricsPanel'
import { StoragePanel } from './components/StoragePanel'
import { MonitoringPanel } from './components/MonitoringPanel'
import type { Pod, TopologyNode, TopologyEdge, ThreatEvent, RbacBinding, PrivilegedPod, NodeMetric, PodMetric, StorageData, DataSourceStatus, MetricsResponse } from './types'

// Use relative URLs (nginx proxies /api/*, /metrics/*, /config/* to backend in-cluster)
// For local dev, set VITE_API_URL=http://localhost:8000
const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const API_KEY = import.meta.env.VITE_API_KEY || 'your-secret-api-key-change-this'

const SOFT_REFRESH_MS = 15_000   // 15s — lightweight (pods only)
const HARD_REFRESH_MS = 60_000   // 60s — full data

// ─── Tab Definition ───────────────────────────────────────────────
interface TabDef {
  id: string
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Icon name="layout-dashboard" /> },
  { id: 'network', label: 'Network', icon: <Icon name="network" /> },
  { id: 'security', label: 'Security', icon: <Icon name="shield" /> },
  { id: 'threats', label: 'Threats', icon: <Icon name="alert-triangle" /> },
  { id: 'metrics', label: 'Metrics', icon: <Icon name="bar-chart" /> },
  { id: 'storage', label: 'Storage', icon: <Icon name="hard-drive" /> },
  { id: 'monitoring', label: 'Monitoring', icon: <Icon name="activity" /> },
]

// ─── App Component ────────────────────────────────────────────────
function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Refs for interval cleanup and WebSocket
  const softIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hardIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fetchAbortRef = useRef<AbortController | null>(null)

  // Network state
  const [pods, setPods] = useState<Pod[]>([])
  const [topology, setTopology] = useState<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>({ nodes: [], edges: [] })

  // Security state
  const [rbacBindings, setRbacBindings] = useState<RbacBinding[]>([])
  const [privilegedPods, setPrivilegedPods] = useState<PrivilegedPod[]>([])

  // Threats state
  const [threats, setThreats] = useState<ThreatEvent[]>([])
  const [wsConnected, setWsConnected] = useState(false)

  // Data source status tracking
  const [nodeMetricsStatus, setNodeMetricsStatus] = useState<DataSourceStatus>('unknown')
  const [podMetricsStatus, setPodMetricsStatus] = useState<DataSourceStatus>('unknown')
  const [podsStatus, setPodsStatus] = useState<DataSourceStatus>('unknown')
  const [topologyStatus, setTopologyStatus] = useState<DataSourceStatus>('unknown')
  const [rbacStatus, setRbacStatus] = useState<DataSourceStatus>('unknown')
  const [privilegedStatus, setPrivilegedStatus] = useState<DataSourceStatus>('unknown')
  const [storageStatus, setStorageStatus] = useState<DataSourceStatus>('unknown')

  // Metrics & Storage state
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetric[]>([])
  const [podMetrics, setPodMetrics] = useState<PodMetric[]>([])
  const [storageConfig, setStorageConfig] = useState<StorageData | null>(null)

  const [currentTime, setCurrentTime] = useState(new Date())
  const threatIdRef = useRef(1)

  // ── Live footer clock ──
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Silent Fetch Helpers (no loading/error — for intervals) ──
  const silentFetchPods = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/network/pods`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setPods(data.items || [])
        setPodsStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      }
    } catch {
      // Silently ignore — errors shown via explicit fetches
    }
  }, [])

  const silentFetchAll = useCallback(async () => {
    try {
      const [podsRes, rbacRes, privRes, metricsRes, storageRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/network/pods`, { headers: { 'X-API-Key': API_KEY } }),
        fetch(`${API_BASE_URL}/api/security/rbac`, { headers: { 'X-API-Key': API_KEY } }),
        fetch(`${API_BASE_URL}/api/security/privileged`, { headers: { 'X-API-Key': API_KEY } }),
        fetch(`${API_BASE_URL}/metrics/nodes`, { headers: { 'X-API-Key': API_KEY } }),
        fetch(`${API_BASE_URL}/config/storage`, { headers: { 'X-API-Key': API_KEY } }),
      ])

      if (podsRes.ok) {
        const data = await podsRes.json()
        setPods(data.items || [])
        setPodsStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      }
      if (rbacRes.ok) {
        const data = await rbacRes.json()
        setRbacBindings(Array.isArray(data.data) ? data.data : [])
        setRbacStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      }
      if (privRes.ok) {
        const data = await privRes.json()
        setPrivilegedPods(Array.isArray(data.data) ? data.data : [])
        setPrivilegedStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      }
      if (metricsRes.ok) {
        const body: MetricsResponse<NodeMetric[]> = await metricsRes.json()
        setNodeMetrics(body.data || [])
        setNodeMetricsStatus(body.status === 'success' ? 'live' : body.status === 'mock' ? 'mock' : 'error')
      }
      // Also fetch pod metrics silently
      try {
        const podMetricsRes = await fetch(`${API_BASE_URL}/metrics/pods`, {
          headers: { 'X-API-Key': API_KEY }
        })
        if (podMetricsRes.ok) {
          const body: MetricsResponse<PodMetric[]> = await podMetricsRes.json()
          setPodMetrics(body.data || [])
          setPodMetricsStatus(body.status === 'success' ? 'live' : body.status === 'mock' ? 'mock' : 'error')
        }
      } catch { /* ignore */ }
      if (storageRes.ok) {
        const data = await storageRes.json()
        setStorageConfig(data.data || null)
        setStorageStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      }

      setLastUpdated(new Date())
    } catch {
      // Silently ignore background refresh errors
    }
  }, [])

  function fetchWithSignal(url: string, options?: RequestInit): Promise<Response> {
    // Abort any previous explicit fetch
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort()
    }
    const controller = new AbortController()
    fetchAbortRef.current = controller
    return fetch(url, { ...options, signal: controller.signal })
  }

  // ── Explicit Fetch Helpers (with loading/error — for initial load & manual) ──
  const fetchPods = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWithSignal(`${API_BASE_URL}/api/network/pods`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setPods(data.items || [])
        setPodsStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      } else {
        setError(`Failed to fetch pods: ${response.statusText}`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchTopology = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWithSignal(`${API_BASE_URL}/api/network/topology`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setTopology({ nodes: data.nodes || [], edges: data.edges || [] })
        setTopologyStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      } else {
        setError(`Failed to fetch topology: ${response.statusText}`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchRbac = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWithSignal(`${API_BASE_URL}/api/security/rbac`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setRbacBindings(Array.isArray(data.data) ? data.data : [])
        setRbacStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      } else {
        setError(`Failed to fetch RBAC: ${response.statusText}`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchPrivilegedPods = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWithSignal(`${API_BASE_URL}/api/security/privileged`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setPrivilegedPods(Array.isArray(data.data) ? data.data : [])
        setPrivilegedStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      } else {
        setError(`Failed to fetch privileged pods: ${response.statusText}`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchNodeMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      // Use a single controller so parallel fetches don't abort each other
      const controller = new AbortController()
      fetchAbortRef.current = controller
      const [nodeRes, podRes] = await Promise.all([
        fetch(`${API_BASE_URL}/metrics/nodes`, {
          headers: { 'X-API-Key': API_KEY },
          signal: controller.signal
        }),
        fetch(`${API_BASE_URL}/metrics/pods`, {
          headers: { 'X-API-Key': API_KEY },
          signal: controller.signal
        })
      ])
      if (nodeRes.ok) {
        const body: MetricsResponse<NodeMetric[]> = await nodeRes.json()
        setNodeMetrics(body.data || [])
        setNodeMetricsStatus(body.status === 'success' ? 'live' : body.status === 'mock' ? 'mock' : 'error')
      } else {
        setError(`Failed to fetch metrics: ${nodeRes.statusText}`)
      }
      if (podRes.ok) {
        const body: MetricsResponse<PodMetric[]> = await podRes.json()
        setPodMetrics(body.data || [])
        setPodMetricsStatus(body.status === 'success' ? 'live' : body.status === 'mock' ? 'mock' : 'error')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchStorageConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWithSignal(`${API_BASE_URL}/config/storage`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setStorageConfig(data.data || null)
        setStorageStatus(data.status === 'success' ? 'live' : data.status === 'mock' ? 'mock' : 'error')
      } else {
        setError(`Failed to fetch storage config: ${response.statusText}`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // WebSocket for threats — stored in ref to avoid leaks
  const connectWebSocket = () => {
    // Close any existing connection first
    if (wsRef.current) {
      wsRef.current.onclose = null  // prevent reconnect loop
      wsRef.current.close()
      wsRef.current = null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/threats/ws/threats`
    const ws = new WebSocket(wsUrl, [API_KEY])
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const threat = JSON.parse(event.data)
        threat.id = `threat-${threatIdRef.current++}`
        setThreats(prev => [threat, ...prev].slice(0, 50))
      } catch (err) {
        console.error('Failed to parse threat event:', err)
      }
    }

    ws.onerror = () => {
      setWsConnected(false)
      setError('WebSocket connection failed')
    }

    ws.onclose = () => {
      // Only reconnect if this is still the active connection
      if (wsRef.current === ws) {
        wsRef.current = null
        setWsConnected(false)
        setTimeout(connectWebSocket, 3000)
      }
    }
  }

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  // ── Start / stop intervals based on active tab ──
  useEffect(() => {
    // Clear any previous intervals
    if (softIntervalRef.current) clearInterval(softIntervalRef.current)
    if (hardIntervalRef.current) clearInterval(hardIntervalRef.current)
    softIntervalRef.current = null
    hardIntervalRef.current = null

    // Only run intervals when dashboard is active
    if (activeTab === 'dashboard') {
      // Soft refresh: lightweight — pods only (15s)
      softIntervalRef.current = setInterval(() => {
        silentFetchPods()
      }, SOFT_REFRESH_MS)

      // Hard refresh: full data (60s)
      hardIntervalRef.current = setInterval(() => {
        silentFetchAll()
      }, HARD_REFRESH_MS)
    }

    return () => {
      if (softIntervalRef.current) clearInterval(softIntervalRef.current)
      if (hardIntervalRef.current) clearInterval(hardIntervalRef.current)
    }
  }, [activeTab, silentFetchPods, silentFetchAll])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort()
        fetchAbortRef.current = null
      }
    }
  }, [])

  // Load data on tab change
  useEffect(() => {
    switch (activeTab) {
      case 'dashboard':
        silentFetchAll()
        break
      case 'network':
        fetchPods()
        fetchTopology()
        break
      case 'security':
        fetchRbac()
        fetchPrivilegedPods()
        break
      case 'threats':
        connectWebSocket()
        break
      case 'metrics':
        fetchNodeMetrics()
        break
      case 'storage':
        fetchStorageConfig()
        break
      case 'monitoring':
        fetchNodeMetrics()  // pod metrics are fetched here
        break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Manual refresh handler (passed to DashboardPanel)
  const handleRefresh = useCallback(() => {
    silentFetchAll()
  }, [silentFetchAll])

  // ── Keyboard navigation for tablist ──
  const tabIndexMap = useMemo(() => Object.fromEntries(TABS.map((t, i) => [t.id, i])), [])

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIdx = tabIndexMap[activeTab]
    let nextIdx: number | null = null

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        nextIdx = (currentIdx + 1) % TABS.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        nextIdx = (currentIdx - 1 + TABS.length) % TABS.length
        break
      case 'Home':
        e.preventDefault()
        nextIdx = 0
        break
      case 'End':
        e.preventDefault()
        nextIdx = TABS.length - 1
        break
      case 'Enter':
      case ' ':
        // Activate the currently focused tab (already happens via click)
        break
      default:
        return
    }

    if (nextIdx !== null) {
      const nextTab = TABS[nextIdx]
      setActiveTab(nextTab.id)
      // Focus the newly activated tab button
      setTimeout(() => {
        const btn = document.getElementById(`tab-${nextTab.id}`)
        btn?.focus()
      }, 0)
    }
  }, [activeTab, tabIndexMap])

  // ── Render ──
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>K8s Dashboard</h1>
          <span className="header-subtitle">Cluster Monitoring</span>
        </div>
        <div className="header-right">
          <div className={`status ${wsConnected ? 'status-ok' : 'status-warn'}`}>
            <span className={`indicator ${wsConnected ? 'connected' : 'disconnected'}`} role="img" aria-label={wsConnected ? 'Connected' : 'Disconnected'}></span>
            <span>{wsConnected ? 'Threats Live' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <div className="error-banner-content">
            <Icon name="x" size={20} className="error-icon" aria-hidden="true" style={{ strokeWidth: 2 }} />
            <strong>Error:</strong> {error}
          </div>
          <button className="error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">
            <Icon name="x" size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <nav className="tabs" role="tablist" aria-label="Dashboard tabs" onKeyDown={handleTabKeyDown}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
          >
            <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="content">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <span>Loading data...</span>
          </div>
        )}

        <ErrorBoundary>
          {TABS.map(tab => (
            <div
              key={tab.id}
              id={`tabpanel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              className="tab-content"
              hidden={activeTab !== tab.id}
            >
              {activeTab === 'dashboard' && (
              <DashboardPanel
                pods={pods}
                threats={threats}
                rbacBindings={rbacBindings}
                privilegedPods={privilegedPods}
                nodeMetrics={nodeMetrics}
                wsConnected={wsConnected}
                lastUpdated={lastUpdated}
                onRefresh={handleRefresh}
                podsStatus={podsStatus}
                rbacStatus={rbacStatus}
                privilegedStatus={privilegedStatus}
                nodeMetricsStatus={nodeMetricsStatus}
                loading={loading}
              />
              )}
              {activeTab === 'network' && (
                <NetworkPanel pods={pods} topology={topology} podsStatus={podsStatus} topologyStatus={topologyStatus} loading={loading} />
              )}
              {activeTab === 'security' && (
                <SecurityPanel rbacBindings={rbacBindings} privilegedPods={privilegedPods} rbacStatus={rbacStatus} privilegedStatus={privilegedStatus} />
              )}
              {activeTab === 'threats' && (
                <ThreatPanel threats={threats} wsConnected={wsConnected} onClear={() => setThreats([])} loading={loading} />
              )}
              {activeTab === 'metrics' && (
                <MetricsPanel
                  nodeMetrics={nodeMetrics}
                  podMetrics={podMetrics}
                  nodeMetricsStatus={nodeMetricsStatus}
                  podMetricsStatus={podMetricsStatus}
                />
              )}
              {activeTab === 'monitoring' && (
                <MonitoringPanel podMetrics={podMetrics} />
              )}
              {activeTab === 'storage' && (
                <StoragePanel storageConfig={storageConfig} storageStatus={storageStatus} loading={loading} />
              )}
            </div>
          ))}
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <span>K8s Dashboard</span>
        <span className="footer-sep">·</span>
        <span>{pods.length} pods · {rbacBindings.length} RBAC bindings</span>
        <span className="footer-sep">·</span>
        <span>{currentTime.toLocaleTimeString()}</span>
      </footer>
    </div>
  )
}

export default App
