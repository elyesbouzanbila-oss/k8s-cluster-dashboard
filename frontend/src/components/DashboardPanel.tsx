import { useState, useEffect, useCallback } from 'react'
import type { Pod, ThreatEvent, RbacBinding, PrivilegedPod, NodeMetric, DataSourceStatus } from '../types'
import { parseCPU, parseMemory } from '../utils'
import { DataSourceBadge } from './DataSourceBadge'
import { Skeleton } from './Skeleton'

interface DashboardPanelProps {
  pods: Pod[]
  threats: ThreatEvent[]
  rbacBindings: RbacBinding[]
  privilegedPods: PrivilegedPod[]
  nodeMetrics: NodeMetric[]
  wsConnected: boolean
  lastUpdated: Date | null
  onRefresh: () => void
  podsStatus?: DataSourceStatus
  rbacStatus?: DataSourceStatus
  privilegedStatus?: DataSourceStatus
  nodeMetricsStatus?: DataSourceStatus
  loading?: boolean
}

export function DashboardPanel({ pods, threats, rbacBindings, privilegedPods, nodeMetrics, wsConnected, lastUpdated, onRefresh, podsStatus, rbacStatus, privilegedStatus, nodeMetricsStatus, loading }: DashboardPanelProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [timeUntilNext, setTimeUntilNext] = useState(15)

  // Countdown timer for next soft refresh — synced to actual interval
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilNext(prev => (prev <= 1 ? 15 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setTimeUntilNext(15)
    try {
      await Promise.resolve(onRefresh())
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh])

  const adminBindings = rbacBindings.filter(b => b.role_ref?.name === 'cluster-admin')
  const criticalThreats = threats.filter(t => t.priority === 'Critical')
  const highThreats = threats.filter(t => t.priority === 'High')
  const runningPods = pods.filter(p => p.phase === 'Running')
  const uniqueNodes = new Set(pods.map(p => p.node_name).filter(Boolean))

  // Aggregate resource usage
  const totalCPU = nodeMetrics.reduce((acc, n) => acc + parseCPU(n.capacity.cpu), 0)
  const usedCPU = nodeMetrics.reduce((acc, n) => acc + parseCPU(n.usage.cpu), 0)
  const totalMem = nodeMetrics.reduce((acc, n) => acc + parseMemory(n.capacity.memory), 0)
  const usedMem = nodeMetrics.reduce((acc, n) => acc + parseMemory(n.usage.memory), 0)
  const cpuPercent = totalCPU > 0 ? (usedCPU / totalCPU) * 100 : 0
  const memPercent = totalMem > 0 ? (usedMem / totalMem) * 100 : 0

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'Critical': return '#ff4d4d'
      case 'High': return '#ff9933'
      case 'Medium': return '#ffcc00'
      case 'Warning': return '#ffdd66'
      default: return '#666666'
    }
  }

  return (
    <div className="dashboard">        <div className="dashboard-header">
        <h2>Cluster Overview</h2>
        <div className="dashboard-header-actions">
          <div className="dashboard-source-status">
            <DataSourceBadge status={podsStatus} label="Pods" />
            <DataSourceBadge status={nodeMetricsStatus} label="Metrics" />
            <DataSourceBadge status={rbacStatus} label="RBAC" />
            <DataSourceBadge status={privilegedStatus} label="Privileged" />
          </div>
          <div className="dashboard-header-status">
            <span className={`indicator ${wsConnected ? 'connected' : 'disconnected'}`}></span>
            <span>{wsConnected ? 'Threat Stream Active' : 'Threat Stream Disconnected'}</span>
          </div>
          <div className="dashboard-meta">
            {lastUpdated && (
              <span className="last-updated" title={`Last full refresh: ${lastUpdated.toLocaleTimeString()}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <span className="auto-refresh-indicator" title="Auto-refreshes pods every 15s, full data every 60s">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Auto-refresh in {timeUntilNext}s
            </span>
            <button
              className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh all data now"
              aria-label="Refresh dashboard data"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ position: 'relative' }}>
        {loading ? (
          <>
            <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton variant="custom" width="44px" height="44px" style={{ borderRadius: '8px' }} />
              <Skeleton variant="custom" width="60%" height="28px" />
              <Skeleton variant="custom" width="40%" height="14px" />
              <Skeleton variant="custom" width="55%" height="12px" />
            </div>
            <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton variant="custom" width="44px" height="44px" style={{ borderRadius: '8px' }} />
              <Skeleton variant="custom" width="60%" height="28px" />
              <Skeleton variant="custom" width="40%" height="14px" />
              <Skeleton variant="custom" width="55%" height="12px" />
            </div>
            <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton variant="custom" width="44px" height="44px" style={{ borderRadius: '8px' }} />
              <Skeleton variant="custom" width="60%" height="28px" />
              <Skeleton variant="custom" width="40%" height="14px" />
              <Skeleton variant="custom" width="55%" height="12px" />
            </div>
            <div className="dashboard-card dashboard-card-wide" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton variant="custom" width="50%" height="18px" />
              <Skeleton variant="custom" width="100%" height="12px" count={4} style={{ marginBottom: '4px' }} />
            </div>
            <div className="dashboard-card dashboard-card-wide" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton variant="custom" width="50%" height="18px" />
              <Skeleton variant="custom" width="100%" height="40px" />
              <Skeleton variant="custom" width="100%" height="40px" />
            </div>
            <div className="dashboard-card dashboard-card-wide" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton variant="custom" width="50%" height="18px" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Skeleton variant="custom" width="100%" height="48px" />
                <Skeleton variant="custom" width="100%" height="48px" />
                <Skeleton variant="custom" width="100%" height="48px" />
                <Skeleton variant="custom" width="100%" height="48px" />
              </div>
            </div>
          </>
        ) : (<>
        {/* Pods Card */}
        <div className="dashboard-card">
          <div className="dashboard-card-icon pods-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div className="dashboard-card-content">
            <span className="dashboard-card-value">{pods.length}</span>
            <span className="dashboard-card-label">Total Pods</span>
            <span className="dashboard-card-sub">{runningPods.length} running · {uniqueNodes.size} node{(uniqueNodes.size ?? 0) !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Threats Card */}
        <div className="dashboard-card">
          <div className="dashboard-card-icon threats-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="dashboard-card-content">
            <span className="dashboard-card-value">{threats.length}</span>
            <span className="dashboard-card-label">Threat Events</span>
            <span className="dashboard-card-sub">
              {criticalThreats.length > 0 && <span className="threat-badge critical">{criticalThreats.length} critical</span>}
              {highThreats.length > 0 && <span className="threat-badge high">{highThreats.length} high</span>}
            </span>
          </div>
        </div>

        {/* Security Card */}
        <div className="dashboard-card">
          <div className="dashboard-card-icon security-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="dashboard-card-content">
            <span className="dashboard-card-value">{privilegedPods.length}</span>
            <span className="dashboard-card-label">Privileged Pods</span>
            <span className="dashboard-card-sub">{adminBindings.length} admin binding{(adminBindings.length ?? 0) !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Threat Severity Breakdown */}
        <div className="dashboard-card dashboard-card-wide">
          <div className="dashboard-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="card-header-icon">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Threat Severity Breakdown</span>
          </div>
          <div className="severity-bars">
            {['Critical', 'High', 'Medium', 'Warning'].map(sev => {
              const count = threats.filter(t => t.priority === sev).length
              const max = threats.length || 1
              const pct = (count / max) * 100
              return (
                <div key={sev} className="severity-bar-row">
                  <span className="severity-label">{sev}</span>
                  <div className="severity-bar-track">
                    <div
                      className="severity-bar-fill"
                      style={{ width: `${pct}%`, backgroundColor: getPriorityColor(sev) }}
                    />
                  </div>
                  <span className="severity-count">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resource Usage Card */}
        <div className="dashboard-card dashboard-card-wide">
          <div className="dashboard-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="card-header-icon">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Cluster Resource Usage</span>
          </div>
          {nodeMetrics.length > 0 ? (
            <div className="resource-bars">
              <div className="resource-bar-row">
                <span className="resource-label">CPU</span>
                <div className="resource-bar-track">
                  <div className="resource-bar-fill cpu-fill" style={{ width: `${cpuPercent}%` }} />
                </div>
                <span className="resource-value">{usedCPU.toFixed(2)} / {totalCPU.toFixed(2)} cores</span>
              </div>
              <div className="resource-bar-row">
                <span className="resource-label">Memory</span>
                <div className="resource-bar-track">
                  <div className="resource-bar-fill mem-fill" style={{ width: `${memPercent}%` }} />
                </div>
                <span className="resource-value">{usedMem.toFixed(1)} / {totalMem.toFixed(1)} GiB</span>
              </div>
            </div>
          ) : (
            <p className="dashboard-empty">Install metrics-server to see resource usage</p>
          )}
        </div>

        {/* RBAC Summary */}
        <div className="dashboard-card dashboard-card-wide">
          <div className="dashboard-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="card-header-icon">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>RBAC & Security Summary</span>
          </div>
          <div className="rbac-summary">
            <div className="rbac-summary-item">
              <span className="rbac-summary-label">Total RBAC Bindings</span>
              <span className="rbac-summary-value">{rbacBindings.length}</span>
            </div>
            <div className="rbac-summary-item">
              <span className="rbac-summary-label">Admin Bindings</span>
              <span className="rbac-summary-value warning">{adminBindings.length}</span>
            </div>
            <div className="rbac-summary-item">
              <span className="rbac-summary-label">Privileged Pods</span>
              <span className="rbac-summary-value danger">{privilegedPods.length}</span>
            </div>
            <div className="rbac-summary-item">
              <span className="rbac-summary-label">Binding Types</span>
              <span className="rbac-summary-value">
                {rbacBindings.filter(b => b.binding_type === 'ClusterRoleBinding').length} CRB / {rbacBindings.filter(b => b.binding_type === 'RoleBinding').length} RB
              </span>
            </div>
          </div>
        </div>
        </>)}
      </div>
    </div>
  )
}
