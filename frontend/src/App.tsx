import { useState, useEffect } from 'react'
import './App.css'
import { Topology } from './Topology'

interface Pod {
  name: string
  namespace: string
  pod_ip: string
  node_name: string
  phase: string
  labels: Record<string, string>
  containers: Array<{ name: string; image: string }>
}

interface TopologyNode {
  id: string
  type: 'pod' | 'service'
  namespace: string
  name: string
  ip?: string
}

interface ThreatEvent {
  priority: 'Critical' | 'High' | 'Medium' | 'Warning'
  rule: string
  output: string
  time: string
}

interface RbacBinding {
  name: string
  namespace?: string
  binding_type: string
  role_ref: { kind: string; name: string; api_group: string }
  subjects: Array<{ kind: string; name: string; namespace?: string }>
}

interface PrivilegedPod {
  name: string
  namespace: string
  container: string
  image: string
  privileged: boolean
  run_as_user?: number
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_API_KEY || 'your-secret-api-key-change-this'

function App() {
  const [activeTab, setActiveTab] = useState<'network' | 'security' | 'threats'>('network')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Network state
  const [pods, setPods] = useState<Pod[]>([])
  const [topology, setTopology] = useState<{ nodes: TopologyNode[]; edges: Array<any> }>({ nodes: [], edges: [] })
  
  // Security state
  const [rbacBindings, setRbacBindings] = useState<RbacBinding[]>([])
  const [privilegedPods, setPrivilegedPods] = useState<PrivilegedPod[]>([])
  
  // Threats state
  const [threats, setThreats] = useState<ThreatEvent[]>([])
  const [wsConnected, setWsConnected] = useState(false)

  // Fetch pods
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

  // Fetch topology
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

  // Fetch RBAC
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

  // Fetch privileged pods
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

  // Connect to WebSocket for threats
  const connectWebSocket = () => {
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/threats/ws/threats?api_key=${API_KEY}`
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      setWsConnected(true)
      setError(null)
    }
    
    ws.onmessage = (event) => {
      try {
        const threat = JSON.parse(event.data)
        setThreats(prev => [threat, ...prev].slice(0, 50)) // Keep last 50
      } catch (err) {
        console.error('Failed to parse threat event:', err)
      }
    }
    
    ws.onerror = () => {
      setWsConnected(false)
      setError('WebSocket connection failed')
    }
    
    ws.onclose = () => {
      setWsConnected(false)
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000)
    }
  }

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'network') {
      fetchPods()
      fetchTopology()
    } else if (activeTab === 'security') {
      fetchRbac()
      fetchPrivilegedPods()
    } else if (activeTab === 'threats') {
      connectWebSocket()
    }
  }, [activeTab])

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'Critical': return '#ff0000'
      case 'High': return '#ff6600'
      case 'Medium': return '#ffaa00'
      case 'Warning': return '#ffcc00'
      default: return '#666666'
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>K8s Dashboard</h1>
        <div className="status">
          <span className={`indicator ${wsConnected ? 'connected' : 'disconnected'}`}></span>
          <span>{wsConnected ? 'Threats Live' : 'Disconnected'}</span>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          Network
        </button>
        <button
          className={`tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Security
        </button>
        <button
          className={`tab ${activeTab === 'threats' ? 'active' : ''}`}
          onClick={() => setActiveTab('threats')}
        >
          Threats
        </button>
      </nav>

      <main className="content">
        {loading && <div className="loading">Loading...</div>}

        {activeTab === 'network' && (
          <div className="section">
            <h2>Network Discovery</h2>
            
            <div className="subsection">
              <h3>Pods ({pods.length})</h3>
              {pods.length === 0 ? (
                <p className="empty">No pods found. Ensure K8s cluster is configured.</p>
              ) : (
                <div className="pod-list">
                  {pods.map(pod => (
                    <div key={`${pod.namespace}/${pod.name}`} className="pod-card">
                      <div className="pod-header">
                        <h4>{pod.name}</h4>
                        <span className={`status ${pod.phase.toLowerCase()}`}>{pod.phase}</span>
                      </div>
                      <div className="pod-info">
                        <p><strong>Namespace:</strong> {pod.namespace}</p>
                        <p><strong>IP:</strong> {pod.pod_ip}</p>
                        <p><strong>Node:</strong> {pod.node_name}</p>
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

            <div className="subsection">
              <h3>Topology</h3>
              {topology.nodes.length === 0 ? (
                <p className="empty">No topology data. Ensure K8s cluster is configured.</p>
              ) : (
                <Topology nodes={topology.nodes} edges={topology.edges} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="section">
            <h2>Security Audit</h2>

            <div className="subsection">
              <h3>RBAC Bindings ({rbacBindings.length})</h3>
              {rbacBindings.length === 0 ? (
                <p className="empty">No RBAC bindings found. Ensure K8s cluster is configured.</p>
              ) : (
                <div className="rbac-list">
                  {rbacBindings.map((binding, idx) => {
                    const isAdmin = binding.role_ref.name === 'cluster-admin'
                    return (
                      <div key={idx} className={`rbac-card ${isAdmin ? 'admin' : ''}`}>
                        <div className="rbac-header">
                          <h4>{binding.name}</h4>
                          {isAdmin && <span className="admin-badge">ADMIN</span>}
                          <span className="binding-type">{binding.binding_type}</span>
                        </div>
                        <p><strong>Role:</strong> {binding.role_ref.kind} / {binding.role_ref.name}</p>
                        <p><strong>Namespace:</strong> {binding.namespace || 'cluster-wide'}</p>
                        <div className="subjects">
                          <strong>Subjects:</strong>
                          {binding.subjects.map((s, i) => (
                            <div key={i} className="subject">
                              {s.kind}: {s.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="subsection">
              <h3>Privileged Pods ({privilegedPods.length})</h3>
              {privilegedPods.length === 0 ? (
                <p className="empty">No privileged pods found or K8s not configured.</p>
              ) : (
                <div className="privileged-list">
                  {privilegedPods.map((pod, idx) => (
                    <div key={idx} className="privileged-card">
                      <div className="pod-header">
                        <h4>{pod.name}</h4>
                        <span className="risk-badge">HIGH RISK</span>
                      </div>
                      <p><strong>Namespace:</strong> {pod.namespace}</p>
                      <p><strong>Container:</strong> {pod.container}</p>
                      <p><strong>Image:</strong> {pod.image}</p>
                      <div className="risk-factors">
                        {pod.privileged && <span className="risk-factor">PRIVILEGED MODE</span>}
                        {pod.run_as_user === 0 && <span className="risk-factor">RUNNING AS ROOT</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'threats' && (
          <div className="section">
            <h2>Threat Detection</h2>
            <div className="threat-status">
              <span className={`indicator ${wsConnected ? 'connected' : 'disconnected'}`}></span>
              {wsConnected ? (
                <span>Real-time threat monitoring active</span>
              ) : (
                <span>Connecting to threat stream...</span>
              )}
            </div>

            {threats.length === 0 ? (
              <p className="empty">No threats detected</p>
            ) : (
              <div className="threat-list">
                {threats.map((threat, idx) => (
                  <div key={idx} className={`threat-card ${threat.priority.toLowerCase()}`}>
                    <div className="threat-header">
                      <span
                        className="priority-dot"
                        style={{ backgroundColor: getPriorityColor(threat.priority) }}
                      ></span>
                      <span className="priority">{threat.priority}</span>
                      <span className="rule">{threat.rule}</span>
                      <span className="time">{new Date(threat.time).toLocaleTimeString()}</span>
                    </div>
                    <p className="output">{threat.output}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>K8s Dashboard • {new Date().toLocaleTimeString()}</p>
      </footer>
    </div>
  )
}

export default App
