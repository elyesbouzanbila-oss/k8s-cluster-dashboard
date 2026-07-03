import type { IPPool, IPAMBlockSummary, DataSourceStatus } from '../types'
import { DataSourceBadge } from './DataSourceBadge'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'

interface IpamPanelProps {
  pools: IPPool[]
  blocks: IPAMBlockSummary[]
  poolsStatus?: DataSourceStatus
  ipamStatus?: DataSourceStatus
}

function getUtilColor(pct: number): string {
  if (pct >= 90) return 'var(--danger)'
  if (pct >= 70) return 'var(--warning)'
  if (pct >= 40) return 'var(--primary)'
  return 'var(--success)'
}

function formatCIDR(cidr: string): string {
  return cidr || '-'
}

function getModeLabel(mode: string): string {
  switch (mode) {
    case 'ipip': return 'IPIP'
    case 'vxlan': return 'VXLAN'
    case 'none': return 'Direct'
    default: return mode.toUpperCase()
  }
}

export function IpamPanel({ pools, blocks, poolsStatus, ipamStatus }: IpamPanelProps) {
  const totalPools = pools.length
  const totalBlocks = blocks.reduce((acc, b) => acc + b.blocks, 0)
  const totalAllocated = blocks.reduce((acc, b) => acc + b.allocated, 0)
  const totalCapacity = blocks.reduce((acc, b) => acc + b.total, 0)
  const overallPct = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0

  return (
    <div className="section ipam-section">
      <h2>IP Address Management</h2>

      {/* Summary stats */}
      <div className="pod-metrics-cluster-summary">
        <div className="pod-metrics-cluster-stat">
          <span className="cluster-stat-label">IP Pools</span>
          <span className="cluster-stat-value">{totalPools}</span>
        </div>
        <div className="pod-metrics-cluster-stat">
          <span className="cluster-stat-label">Allocated IPs</span>
          <span className="cluster-stat-value">{totalAllocated}</span>
        </div>
        <div className="pod-metrics-cluster-stat">
          <span className="cluster-stat-label">Total Capacity</span>
          <span className="cluster-stat-value">{totalCapacity}</span>
        </div>
        <div className="pod-metrics-cluster-stat">
          <span className="cluster-stat-label">Utilization</span>
          <span className="cluster-stat-value" style={{ color: getUtilColor(overallPct) }}>
            {overallPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Per-pool utilization */}
      <div className="subsection">
        <div className="subsection-header">
          <h3>Pool Utilization</h3>
          <DataSourceBadge status={ipamStatus} label="IPAM data" />
        </div>

        {blocks.length === 0 ? (
          <EmptyState
            icon={<Icon name="bar-chart" size={48} />}
            message="No IPAM data"
            submessage="Ensure Calico is installed and IP pools are configured."
          />
        ) : (
          <div className="ipam-pool-list">
            {blocks.map(b => {
              const color = getUtilColor(b.utilization_pct)
              return (
                <div key={b.pool} className="dashboard-card dashboard-card-wide" style={{ display: 'block' }}>
                  <div className="ipam-pool-header">
                    <div className="ipam-pool-name">{b.pool}</div>
                    <div className="ipam-pool-stats">
                      <span>{b.allocated} / {b.total} IPs</span>
                      <span className="ipam-blocks-badge">{b.blocks} block{b.blocks !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="ipam-pool-bar-track">
                    <div
                      className="ipam-pool-bar-fill"
                      style={{
                        width: `${b.utilization_pct}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <div className="ipam-pool-pct" style={{ color }}>
                    {b.utilization_pct.toFixed(1)}% utilized
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* IP Pool Definitions */}
      <div className="subsection">
        <div className="subsection-header">
          <h3>Pool Definitions</h3>
          <DataSourceBadge status={poolsStatus} label="IPPool CRDs" />
        </div>

        {pools.length === 0 ? (
          <EmptyState
            icon={<Icon name="hard-drive" size={48} />}
            message="No IP pools defined"
            submessage="Create IPPool CRDs in your Calico configuration."
          />
        ) : (
          <div className="storage-table-wrapper">
            <table className="storage-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>CIDR</th>
                  <th>Mode</th>
                  <th>NAT</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pools.map(p => (
                  <tr key={p.name}>
                    <td className="cell-mono">{p.name}</td>
                    <td className="cell-mono">{formatCIDR(p.cidr)}</td>
                    <td><span className="badge badge-muted">{getModeLabel(p.mode)}</span></td>
                    <td>
                      {p.nat_outgoing ? (
                        <span className="badge badge-success">Enabled</span>
                      ) : (
                        <span className="badge badge-muted">Disabled</span>
                      )}
                    </td>
                    <td>
                      {p.disabled ? (
                        <span className="badge badge-warning">Disabled</span>
                      ) : (
                        <span className="badge badge-success">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
