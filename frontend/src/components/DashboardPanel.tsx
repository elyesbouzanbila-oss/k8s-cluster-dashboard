import type { CalicoNodeStatus, IPAMBlockSummary, CniPolicy, FelixMetrics, DataSourceStatus } from '../types'
import { DataSourceBadge } from './DataSourceBadge'
import { Skeleton } from './Skeleton'
import { Icon } from './Icon'

interface DashboardPanelProps {
  cniNodes: CalicoNodeStatus[]
  bgpPeers: number
  ipPools: number
  ipamBlocks: IPAMBlockSummary[]
  policies: CniPolicy[]
  felixMetrics: FelixMetrics | null
  cniTopologyEdges: number
  cniTopologyNodes: number
  cniNodesStatus?: DataSourceStatus
  ipamStatus?: DataSourceStatus
  policiesStatus?: DataSourceStatus
  felixStatus?: DataSourceStatus
  loading?: boolean
}

function isStatusLoading(status: DataSourceStatus | undefined): boolean {
  return status === 'unknown' || status === undefined
}

export function DashboardPanel({
  cniNodes, bgpPeers, ipPools, ipamBlocks, policies, felixMetrics,
  cniTopologyEdges, cniTopologyNodes,
  cniNodesStatus, ipamStatus, policiesStatus, felixStatus, loading,
}: DashboardPanelProps) {
  const isLoading = loading ||
    isStatusLoading(cniNodesStatus) ||
    isStatusLoading(ipamStatus) ||
    isStatusLoading(policiesStatus)

  const healthyNodes = cniNodes.filter(n => n.felix_ready && n.bird_ready)
  const totalIPs = ipamBlocks.reduce((acc, b) => acc + b.total, 0)
  const allocatedIPs = ipamBlocks.reduce((acc, b) => acc + b.allocated, 0)
  const ipamPct = totalIPs > 0 ? (allocatedIPs / totalIPs) * 100 : 0
  const globalPolicies = policies.filter(p => p.type === 'GlobalNetworkPolicy').length

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>CNI Command Center</h2>
        <div className="dashboard-header-actions">
          <div className="dashboard-source-status">
            <DataSourceBadge status={cniNodesStatus} label="CNI nodes" />
            <DataSourceBadge status={ipamStatus} label="IPAM" />
            <DataSourceBadge status={policiesStatus} label="Policies" />
            <DataSourceBadge status={felixStatus} label="Felix" />
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ position: 'relative' }}>
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={`dashboard-card ${i >= 4 ? 'dashboard-card-wide' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Skeleton variant="custom" width="44px" height="44px" style={{ borderRadius: '8px' }} />
                <Skeleton variant="custom" width="60%" height="28px" />
                <Skeleton variant="custom" width="40%" height="14px" />
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Calico Nodes */}
            <div className="dashboard-card">
              <div className="dashboard-card-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                <Icon name="check" size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value" style={{ color: 'var(--success)' }}>{healthyNodes.length}/{cniNodes.length}</span>
                <span className="dashboard-card-label">Healthy Nodes</span>
                <span className="dashboard-card-sub">
                  {cniNodes.filter(n => !n.felix_ready || !n.bird_ready).length > 0
                    ? <span className="threat-badge high">{cniNodes.filter(n => !n.felix_ready || !n.bird_ready).length} degraded</span>
                    : <span style={{ color: 'var(--success)' }}>All healthy</span>
                  }
                </span>
              </div>
            </div>

            {/* BGP Peers */}
            <div className="dashboard-card">
              <div className="dashboard-card-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Icon name="network" size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value" style={{ color: 'var(--primary)' }}>{bgpPeers}</span>
                <span className="dashboard-card-label">BGP Peers</span>
                <span className="dashboard-card-sub">{cniTopologyNodes} nodes in mesh</span>
              </div>
            </div>

            {/* IP Pools */}
            <div className="dashboard-card">
              <div className="dashboard-card-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' }}>
                <Icon name="hard-drive" size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value" style={{ color: '#8B5CF6' }}>{ipPools}</span>
                <span className="dashboard-card-label">IP Pools</span>
                <span className="dashboard-card-sub">{ipamBlocks.length} blocks</span>
              </div>
            </div>

            {/* IPAM Utilization */}
            <div className="dashboard-card">
              <div className="dashboard-card-icon" style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', color: 'var(--info)' }}>
                <Icon name="bar-chart" size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value" style={{ color: 'var(--info)' }}>{ipamPct.toFixed(1)}%</span>
                <span className="dashboard-card-label">IPAM Utilized</span>
                <span className="dashboard-card-sub">{allocatedIPs}/{totalIPs} IPs</span>
              </div>
            </div>

            {/* Network Policies */}
            <div className="dashboard-card dashboard-card-wide">
              <div className="dashboard-card-header">
                <Icon name="shield" size={16} className="card-header-icon" />
                <span>Network Policies</span>
              </div>
              <div className="rbac-summary">
                <div className="rbac-summary-item">
                  <span className="rbac-summary-label">Total Policies</span>
                  <span className="rbac-summary-value">{policies.length}</span>
                </div>
                <div className="rbac-summary-item">
                  <span className="rbac-summary-label">Global</span>
                  <span className="rbac-summary-value warning">{globalPolicies}</span>
                </div>
                <div className="rbac-summary-item">
                  <span className="rbac-summary-label">Namespaced</span>
                  <span className="rbac-summary-value">{policies.length - globalPolicies}</span>
                </div>
                <div className="rbac-summary-item">
                  <span className="rbac-summary-label">With Rules</span>
                  <span className="rbac-summary-value">{policies.filter(p => p.rules_count > 0).length}</span>
                </div>
              </div>
            </div>

            {/* Felix Metrics */}
            <div className="dashboard-card dashboard-card-wide">
              <div className="dashboard-card-header">
                <Icon name="activity" size={16} className="card-header-icon" />
                <span>Felix Performance</span>
              </div>
              {felixMetrics ? (
                <div className="rbac-summary">
                  <div className="rbac-summary-item">
                    <span className="rbac-summary-label">Active Endpoints</span>
                    <span className="rbac-summary-value">{felixMetrics.active_local_endpoints ?? '-'}</span>
                  </div>
                  <div className="rbac-summary-item">
                    <span className="rbac-summary-label">Cluster Policies</span>
                    <span className="rbac-summary-value">{felixMetrics.cluster_network_policies ?? '-'}</span>
                  </div>
                  <div className="rbac-summary-item">
                    <span className="rbac-summary-label">BGP Sessions Active</span>
                    <span className="rbac-summary-value">{felixMetrics.bgp_sessions_active ?? '-'}</span>
                  </div>
                  <div className="rbac-summary-item">
                    <span className="rbac-summary-label">Dataplane Failures</span>
                    <span className="rbac-summary-value" style={{ color: (felixMetrics.int_dataplane_failures ?? 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {felixMetrics.int_dataplane_failures ?? 0}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="dashboard-empty">Install Prometheus and enable Felix metrics scraping to see performance data.</p>
              )}
            </div>

            {/* Connectivity Summary */}
            <div className="dashboard-card dashboard-card-wide">
              <div className="dashboard-card-header">
                <Icon name="network" size={16} className="card-header-icon" />
                <span>Topology Summary</span>
              </div>
              <div className="rbac-summary">
                <div className="rbac-summary-item">
                  <span className="rbac-summary-label">Nodes in Topology</span>
                  <span className="rbac-summary-value">{cniTopologyNodes}</span>
                </div>
                <div className="rbac-summary-item">
                  <span className="rbac-summary-label">BGP + Overlay Edges</span>
                  <span className="rbac-summary-value">{cniTopologyEdges}</span>
                </div>
                <div className="rbac-summary-item">
                  <span className="rbac-summary-label">Felix Status</span>
                  <span className="rbac-summary-value" style={{ color: 'var(--success)' }}>
                    {felixStatus === 'live' ? 'Active' : felixStatus === 'mock' ? 'Mock' : 'Unknown'}
                  </span>
                </div>
                <div className="rbac-summary-item">
                  <span className="rbac-summary-label">Data Source</span>
                  <span className="rbac-summary-value">
                    {cniNodesStatus === 'live' ? 'Live' : cniNodesStatus === 'mock' ? 'Mock' : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
