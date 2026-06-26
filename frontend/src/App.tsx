import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import { DashboardPanel } from './components/DashboardPanel'
import { NetworkPanel } from './components/NetworkPanel'
import { SecurityPanel } from './components/SecurityPanel'
import { ThreatPanel } from './components/ThreatPanel'
import { MetricsPanel } from './components/MetricsPanel'
import { StoragePanel } from './components/StoragePanel'
import type { Pod, TopologyNode, TopologyEdge, ThreatEvent, RbacBinding, PrivilegedPod, NodeMetric, StorageData } from './types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_API_KEY || 'your-secret-api-key-change-this'

const SOFT_REFRESH_MS = 15_000   // 15s — lightweight (pods only)
const HARD_REFRESH_MS = 60_000   // 60s — full data

// ─── Tab Definition ───────────────────────────────────────────────
interface TabDef {
  id: string
  label: string
  icon: () => React.ReactNode
}

const TABS: TabDef[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'network',
    label: 'Network',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="5" r="2" />
        <circle cx="19" cy="19" r="2" />
        <circle cx="5" cy="19" r="2" />
        <line x1="12" y1="9" x2="17" y2="6" />
        <line x1="12" y1="9" x2="7" y2="6" />
        <line x1="12" y1="15" x2="17" y2="18" />
        <line x1="12" y1="15" x2="7" y2="18" />
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'threats',
    label: 'Threats',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: 'metrics',
    label: 'Metrics',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
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

  // Network state
  const [pods, setPods] = useState<Pod[]>([])
  const [topology, setTopology] = useState<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>({ nodes: [], edges: [] })

  // Security state
  const [rbacBindings, setRbacBindings] = useState<RbacBinding[]>([])
  const [privilegedPods, setPrivilegedPods] = useState<PrivilegedPod[]>([])

  // Threats state
  const [threats, setThreats] = useState<ThreatEvent[]>([])
  const [wsConnected, setWsConnected] = useState(false)

  // Metrics & Storage state
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetric[]>([])
  const [storageConfig, setStorageConfig] = useState<StorageData | null>(null)

  // ── Silent Fetch Helpers (no loading/error — for intervals) ──
  const silentFetchPods = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/network/pods`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setPods(data.items || [])
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
      }
      if (rbacRes.ok) {
        const data = await rbacRes.json()
        setRbacBindings(Array.isArray(data) ? data : [])
      }
      if (privRes.ok) {
        const data = await privRes.json()
        setPrivilegedPods(Array.isArray(data) ? data : [])
      }
      if (metricsRes.ok) {
        const data = await metricsRes.json()
        setNodeMetrics(data)
      }
      if (storageRes.ok) {
        const data = await storageRes.json()
        setStorageConfig(data)
      }

      setLastUpdated(new Date())
    } catch {
      // Silently ignore background refresh errors
    }
  }, [])

  // ── Explicit Fetch Helpers (with loading/error — for initial load & manual) ──
  const fetchPods = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/network/pods`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setPods(data.items || [])
      } else {
        setError(`Failed to fetch pods: ${response.statusText}`)
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchTopology = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/network/topology`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setTopology(data)
      } else {
        setError(`Failed to fetch topology: ${response.statusText}`)
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchRbac = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/rbac`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setRbacBindings(Array.isArray(data) ? data : [])
      } else {
        setError(`Failed to fetch RBAC: ${response.statusText}`)
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchPrivilegedPods = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/privileged`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setPrivilegedPods(Array.isArray(data) ? data : [])
      } else {
        setError(`Failed to fetch privileged pods: ${response.statusText}`)
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchNodeMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/metrics/nodes`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setNodeMetrics(data)
      } else {
        setError(`Failed to fetch metrics: ${response.statusText}`)
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchStorageConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/config/storage`, {
        headers: { 'X-API-Key': API_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setStorageConfig(data)
      } else {
        setError(`Failed to fetch storage config: ${response.statusText}`)
      }
    } catch (err) {
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

    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/threats/ws/threats?api_key=${API_KEY}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const threat = JSON.parse(event.data)
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Manual refresh handler (passed to DashboardPanel)
  const handleRefresh = useCallback(() => {
    silentFetchAll()
  }, [silentFetchAll])

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
            <span className={`indicator ${wsConnected ? 'connected' : 'disconnected'}`}></span>
            <span>{wsConnected ? 'Threats Live' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <div className="error-banner-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="error-icon">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <strong>Error:</strong> {error}
          </div>
          <button className="error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <nav className="tabs" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-label={tab.label}
          >
            <span className="tab-icon">{tab.icon()}</span>
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

        <div className="tab-content">
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
            />
          )}
          {activeTab === 'network' && (
            <NetworkPanel pods={pods} topology={topology} />
          )}
          {activeTab === 'security' && (
            <SecurityPanel rbacBindings={rbacBindings} privilegedPods={privilegedPods} />
          )}
          {activeTab === 'threats' && (
            <ThreatPanel threats={threats} wsConnected={wsConnected} />
          )}
          {activeTab === 'metrics' && (
            <MetricsPanel nodeMetrics={nodeMetrics} />
          )}
          {activeTab === 'storage' && (
            <StoragePanel storageConfig={storageConfig} />
          )}
        </div>
      </main>

      <footer className="footer">
        <span>K8s Dashboard</span>
        <span className="footer-sep">·</span>
        <span>{pods.length} pods · {rbacBindings.length} RBAC bindings</span>
        <span className="footer-sep">·</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </footer>
    </div>
  )
}

export default App
