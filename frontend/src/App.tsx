import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'
import { Icon } from './components/Icon'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DashboardPanel } from './components/DashboardPanel'
import { CniHealthPanel } from './components/CniHealthPanel'
import { IpamPanel } from './components/IpamPanel'
import { PolicyInspectorPanel } from './components/PolicyInspectorPanel'
import { PolicyCoveragePanel } from './components/PolicyCoveragePanel'
import { CniTopologyPanel } from './components/CniTopologyPanel'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'
import { ThreatPanel } from './components/ThreatPanel'
import { SecurityPanel } from './components/SecurityPanel'
import type {
  Pod, ThreatEvent, CalicoNodeStatus, BGPPeer, IPPool, IPAMBlockSummary,
  CniPolicy, CniTopologyNode, CniTopologyEdge, FelixMetrics,
  DataSourceStatus, ApiResponse, PodCoverageItem,
  RbacBinding, PrivilegedPod,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const REFRESH_MS = 30_000  // 30s background refresh

interface TabDef {
  id: string
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Icon name="layout-dashboard" /> },
  { id: 'cni-health', label: 'CNI Health', icon: <Icon name="activity" /> },
  { id: 'ipam', label: 'IPAM', icon: <Icon name="bar-chart" /> },
  { id: 'policies', label: 'Policies', icon: <Icon name="shield" /> },
  { id: 'topology', label: 'Topology', icon: <Icon name="network" /> },
  { id: 'diagnostics', label: 'Diagnostics', icon: <Icon name="play" /> },
  { id: 'threats', label: 'Threats', icon: <Icon name="alert-triangle" /> },
  { id: 'security', label: 'Security', icon: <Icon name="shield" /> },
]

function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('k8s-dashboard-tab') || 'dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Persistent tab state ──
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId)
    localStorage.setItem('k8s-dashboard-tab', tabId)
  }, [])
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const threatIdRef = useRef(1)
  const hasInitialData = useRef(false) // tracks whether initial fetch has completed

  // Shared state
  const [pods, setPods] = useState<Pod[]>([])

  // Security state
  const [rbacBindings, setRbacBindings] = useState<RbacBinding[]>([])
  const [privilegedPods, setPrivilegedPods] = useState<PrivilegedPod[]>([])
  const [rbacBindingsStatus, setRbacBindingsStatus] = useState<DataSourceStatus>('unknown')
  const [privilegedPodsStatus, setPrivilegedPodsStatus] = useState<DataSourceStatus>('unknown')

  // CNI state
  const [cniNodes, setCniNodes] = useState<CalicoNodeStatus[]>([])
  const [bgpPeers, setBgpPeers] = useState<BGPPeer[]>([])
  const [ipPools, setIpPools] = useState<IPPool[]>([])
  const [ipamBlocks, setIpamBlocks] = useState<IPAMBlockSummary[]>([])
  const [cniPolicies, setCniPolicies] = useState<CniPolicy[]>([])
  const [cniTopology, setCniTopology] = useState<{ nodes: CniTopologyNode[]; edges: CniTopologyEdge[] } | null>(null)
  const [felixMetrics, setFelixMetrics] = useState<FelixMetrics | null>(null)
  const [policyCoverage, setPolicyCoverage] = useState<PodCoverageItem[]>([])
  // L5: policies tab sub-view toggle (not reset on tab switch — intentional;
  // user preference persists across tab switches)
  const [policyCoverageView, setPolicyCoverageView] = useState<'definitions' | 'coverage'>('definitions')

  // Threats state
  const [threats, setThreats] = useState<ThreatEvent[]>([])
  const [wsConnected, setWsConnected] = useState(false)

  // Data source status tracking
  const [cniNodesStatus, setCniNodesStatus] = useState<DataSourceStatus>('unknown')
  const [ipamStatus, setIpamStatus] = useState<DataSourceStatus>('unknown')
  const [policiesStatus, setPoliciesStatus] = useState<DataSourceStatus>('unknown')
  const [felixStatus, setFelixStatus] = useState<DataSourceStatus>('unknown')
  const [topologyStatus, setTopologyStatus] = useState<DataSourceStatus>('unknown')

  const [currentTime, setCurrentTime] = useState(new Date())

  // Live footer clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Helper: fetch with retry ──
  const fetchWithRetry = useCallback(async (url: string, retries = 2): Promise<Response | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url)
        if (res.ok || attempt === retries) return res
        // Wait briefly before retry (100ms, 200ms)
        await new Promise(r => setTimeout(r, 100 * 2 ** attempt))
      } catch {
        if (attempt === retries) return null
        await new Promise(r => setTimeout(r, 100 * 2 ** attempt))
      }
    }
    return null
  }, [])

  // ── Silent refresh (background) ──
  const silentRefresh = useCallback(async () => {
    try {
      // Always fetch pods and CNI data
      const [podsRes, nodesRes, poolsRes, ipamRes, policiesRes, bgpRes] = await Promise.all([
        fetchWithRetry(`${API_BASE_URL}/api/network/pods`),
        fetchWithRetry(`${API_BASE_URL}/api/cni/nodes`),
        fetchWithRetry(`${API_BASE_URL}/api/cni/ippools`),
        fetchWithRetry(`${API_BASE_URL}/api/cni/ipam/utilization`),
        fetchWithRetry(`${API_BASE_URL}/api/cni/policies`),
        fetchWithRetry(`${API_BASE_URL}/api/cni/bgp-peers`),
      ])

      if (podsRes?.ok) {
        const d = await podsRes.json()
        setPods(d.items || [])
      }
      if (nodesRes?.ok) {
        const d: ApiResponse<CalicoNodeStatus[]> = await nodesRes.json()
        setCniNodes(d.data || [])
        setCniNodesStatus(d.status === 'success' ? 'live' : d.status === 'mock' ? 'mock' : 'error')
      } else {
        setCniNodesStatus('error')
      }
      if (poolsRes?.ok) {
        const d: ApiResponse<IPPool[]> = await poolsRes.json()
        setIpPools(d.data || [])
      }
      if (ipamRes?.ok) {
        const d: ApiResponse<IPAMBlockSummary[]> = await ipamRes.json()
        setIpamBlocks(d.data || [])
        setIpamStatus(d.status === 'success' ? 'live' : d.status === 'mock' ? 'mock' : 'error')
      } else {
        setIpamStatus('error')
      }
      if (policiesRes?.ok) {
        const d: ApiResponse<CniPolicy[]> = await policiesRes.json()
        setCniPolicies(d.data || [])
        setPoliciesStatus(d.status === 'success' ? 'live' : d.status === 'mock' ? 'mock' : 'error')
      } else {
        setPoliciesStatus('error')
      }
      if (bgpRes?.ok) {
        const d: ApiResponse<BGPPeer[]> = await bgpRes.json()
        setBgpPeers(d.data || [])
      }

      // Fetch topology
      const topoRes = await fetchWithRetry(`${API_BASE_URL}/api/cni/topology`)
      if (topoRes?.ok) {
        const d: ApiResponse<{ nodes: CniTopologyNode[]; edges: CniTopologyEdge[] }> = await topoRes.json()
        setCniTopology(d.data || null)
        setTopologyStatus(d.status === 'success' ? 'live' : d.status === 'mock' ? 'mock' : 'error')
      } else {
        setTopologyStatus('error')
      }

      // Fetch Felix metrics
      const felixRes = await fetchWithRetry(`${API_BASE_URL}/api/cni/metrics/felix`)
      if (felixRes?.ok) {
        const d: ApiResponse<FelixMetrics> = await felixRes.json()
        setFelixMetrics(d.data || null)
        setFelixStatus(d.status === 'success' ? 'live' : d.status === 'mock' ? 'mock' : 'error')
      } else {
        setFelixStatus('error')
      }

      // Fetch policy coverage
      const coverageRes = await fetchWithRetry(`${API_BASE_URL}/api/cni/policies/coverage`)
      if (coverageRes?.ok) {
        const d: ApiResponse<PodCoverageItem[]> = await coverageRes.json()
        setPolicyCoverage(d.data || [])
      }

      // Fetch RBAC bindings & privileged pods (live API with mock fallback)
      const [rbacRes, privRes] = await Promise.all([
        fetchWithRetry(`${API_BASE_URL}/api/security/rbac`),
        fetchWithRetry(`${API_BASE_URL}/api/security/privileged-pods`),
      ])
      if (rbacRes?.ok) {
        const d: ApiResponse<RbacBinding[]> = await rbacRes.json()
        setRbacBindings(d.data || [])
        setRbacBindingsStatus(d.status === 'success' ? 'live' : d.status === 'mock' ? 'mock' : 'error')
      } else {
        setRbacBindingsStatus('error')
      }
      if (privRes?.ok) {
        const d: ApiResponse<PrivilegedPod[]> = await privRes.json()
        setPrivilegedPods(d.data || [])
        setPrivilegedPodsStatus(d.status === 'success' ? 'live' : d.status === 'mock' ? 'mock' : 'error')
      } else {
        setPrivilegedPodsStatus('error')
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection lost'
      setError(`Data fetch failed: ${msg}`)
      setCniNodesStatus('error')
      setIpamStatus('error')
      setPoliciesStatus('error')
      setFelixStatus('error')
      setTopologyStatus('error')
    }
  }, [])

  // ── Explicit fetches with loading state ──
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await silentRefresh()
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }, [silentRefresh])

  // ── WebSocket for threats ──
  const reconnectRef = useRef(0)
  const MAX_RECONNECT_ATTEMPTS = 10

  const connectWebSocket = useCallback(() => {
    // Don't reconnect if already connected
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }
    reconnectRef.current = 0
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/threats/ws/threats`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => { reconnectRef.current = 0; setWsConnected(true); setError(null) }
    ws.onmessage = (event) => {
      try {
        const threat = JSON.parse(event.data)
        threat.id = `threat-${threatIdRef.current++}`
        setThreats(prev => [threat, ...prev].slice(0, 50))
      } catch { /* ignore parse errors */ }
    }
    ws.onerror = () => { setWsConnected(false); setError('WebSocket connection failed') }
    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null
        setWsConnected(false)
        const attempt = reconnectRef.current
        if (attempt < MAX_RECONNECT_ATTEMPTS) {
          reconnectRef.current = attempt + 1
          // Exponential backoff with jitter: 1s, 2s, 4s, 8s, ... up to ~30s
          const delay = Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 500
          setTimeout(connectWebSocket, delay)
        }
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  // ── Interval for background refresh ──
  useEffect(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    refreshIntervalRef.current = setInterval(silentRefresh, REFRESH_MS)
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [silentRefresh])

  // Load data on initial mount
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On tab switch: silently refresh data (no loading overlay),
  // preserving existing tab state. Only threats connect WebSocket.
  useEffect(() => {
    // Mark initial data as loaded after first fetch completes
    if (!hasInitialData.current) return

    // Background refresh — never show loading overlay on tab switch
    silentRefresh()

    if (activeTab === 'threats') {
      connectWebSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Mark initial data as loaded when silentRefresh completes
  useEffect(() => {
    if (!hasInitialData.current && (cniNodes.length > 0 || cniNodesStatus !== 'unknown')) {
      hasInitialData.current = true
    }
  }, [cniNodes, cniNodesStatus])

  // ── Keyboard navigation for tabs ──
  const tabIndexMap = useMemo(() => Object.fromEntries(TABS.map((t, i) => [t.id, i])), [])

  // ── Export data as JSON ──────────────────────────────────────
  const handleExport = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      dashboard: {
        pods,
        cniNodes,
        bgpPeers,
        ipPools,
        ipamBlocks,
        cniPolicies,
        cniTopology,
        felixMetrics,
        policyCoverage,
        rbacBindings,
        privilegedPods,
      },
      threats,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `k8s-dashboard-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [pods, cniNodes, bgpPeers, ipPools, ipamBlocks, cniPolicies, cniTopology, felixMetrics, policyCoverage, rbacBindings, privilegedPods, threats])

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
      default:
        return
    }

    if (nextIdx !== null) {
      const nextTab = TABS[nextIdx]
      setActiveTab(nextTab.id)
      setTimeout(() => {
        document.getElementById(`tab-${nextTab.id}`)?.focus()
      }, 0)
    }
  }, [activeTab, tabIndexMap])

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>CNI Command Center</h1>
          <span className="header-subtitle">Calico Network Diagnostics</span>
        </div>
        <div className="header-right">
          <div className={`status ${wsConnected ? 'status-ok' : 'status-warn'}`}>
            <span className={`indicator ${wsConnected ? 'connected' : 'disconnected'}`} role="img" aria-label={wsConnected ? 'Connected' : 'Disconnected'} />
            <span>{wsConnected ? 'Threats Live' : 'Disconnected'}</span>
          </div>
          <button className="refresh-btn" onClick={handleExport} title="Export all data as JSON" aria-label="Export data">
            <Icon name="download" size={16} />
            <span>Export</span>
          </button>
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

      <nav className="tabs" role="tablist" aria-label="CNI Command Center tabs" onKeyDown={handleTabKeyDown}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
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
              {tab.id === 'dashboard' && (
                <DashboardPanel
                  cniNodes={cniNodes}
                  bgpPeers={bgpPeers.length}
                  ipPools={ipPools.length}
                  ipamBlocks={ipamBlocks}
                  policies={cniPolicies}
                  felixMetrics={felixMetrics}
                  cniTopologyEdges={cniTopology?.edges.length || 0}
                  cniTopologyNodes={cniTopology?.nodes.length || 0}
                  cniNodesStatus={cniNodesStatus}
                  ipamStatus={ipamStatus}
                  policiesStatus={policiesStatus}
                  felixStatus={felixStatus}
                  loading={loading}
                  onNavigate={setActiveTab}
                  threatsCount={threats.length}
                  threatsCritical={threats.filter(t => t.priority === 'Critical').length}
                  wsConnected={wsConnected}
                />
              )}
              {tab.id === 'cni-health' && (
                <CniHealthPanel nodes={cniNodes} status={cniNodesStatus} />
              )}
              {tab.id === 'ipam' && (
                <IpamPanel
                  pools={ipPools}
                  blocks={ipamBlocks}
                  poolsStatus={cniNodesStatus}
                  ipamStatus={ipamStatus}
                />
              )}
              {tab.id === 'policies' && (
                <>
                  {/* Sub-view toggle */}
                  <div className="coverage-view-toggle" style={{ marginBottom: '20px' }}>
                    <button
                      className={`coverage-view-btn ${policyCoverageView === 'definitions' ? 'active' : ''}`}
                      onClick={() => setPolicyCoverageView('definitions')}
                    >
                      <Icon name="list" size={16} /> Definitions
                    </button>
                    <button
                      className={`coverage-view-btn ${policyCoverageView === 'coverage' ? 'active' : ''}`}
                      onClick={() => setPolicyCoverageView('coverage')}
                    >
                      <Icon name="shield" size={16} /> Coverage
                    </button>
                  </div>

                  {policyCoverageView === 'definitions' ? (
                    <PolicyInspectorPanel policies={cniPolicies} status={policiesStatus} />
                  ) : (
                    <PolicyCoveragePanel coverage={policyCoverage} status={policiesStatus} />
                  )}
                </>
              )}
              {tab.id === 'topology' && (
                <CniTopologyPanel
                  pods={pods}
                  cniTopology={cniTopology}
                  topologyStatus={topologyStatus}
                />
              )}
              {tab.id === 'diagnostics' && (
                <DiagnosticsPanel pods={pods} cniTopology={cniTopology} />
              )}
              {tab.id === 'threats' && (
                <ThreatPanel threats={threats} wsConnected={wsConnected} onClear={() => setThreats([])} loading={loading} />
              )}
              {tab.id === 'security' && (
                <SecurityPanel
                  rbacBindings={rbacBindings}
                  privilegedPods={privilegedPods}
                  rbacBindingsStatus={rbacBindingsStatus}
                  privilegedPodsStatus={privilegedPodsStatus}
                />
              )}
            </div>
          ))}
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <span>CNI Command Center</span>
        <span className="footer-sep">·</span>
        <span>{cniNodes.length} agents · {bgpPeers.length} BGP peers</span>
        <span className="footer-sep">·</span>
        <span>{currentTime.toLocaleTimeString()}</span>
      </footer>
    </div>
  )
}

export default App
