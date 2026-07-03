import type { CalicoNodeStatus, DataSourceStatus } from '../types'
import { DataSourceBadge } from './DataSourceBadge'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'

interface CniHealthPanelProps {
  nodes: CalicoNodeStatus[]
  status?: DataSourceStatus
}

function formatUptime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 60)}m`
}

function getHealthColor(felix: boolean, bird: boolean): string {
  if (felix && bird) return 'var(--success)'
  if (!felix && !bird) return 'var(--danger)'
  return 'var(--warning)'
}

function getHealthLabel(felix: boolean, bird: boolean): string {
  if (felix && bird) return 'Healthy'
  if (!felix && !bird) return 'Down'
  return 'Degraded'
}

export function CniHealthPanel({ nodes, status }: CniHealthPanelProps) {
  const healthy = nodes.filter(n => n.felix_ready && n.bird_ready)
  const degraded = nodes.filter(n => n.felix_ready !== n.bird_ready)
  const down = nodes.filter(n => !n.felix_ready && !n.bird_ready)

  return (
    <div className="cni-health-section">
      <div className="subsection">
        <div className="subsection-header">
          <h3>Calico Node Agents</h3>
          <DataSourceBadge status={status} label="CNI nodes" />
        </div>

        {/* Summary stats */}
        <div className="security-stats" style={{ marginBottom: '20px' }}>
          <div className="security-stat-card">
            <div className="security-stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
              <Icon name="check" size={24} />
            </div>
            <div className="security-stat-content">
              <span className="security-stat-value" style={{ color: 'var(--success)' }}>{healthy.length}</span>
              <span className="security-stat-label">Healthy Nodes</span>
            </div>
          </div>
          <div className="security-stat-card">
            <div className="security-stat-icon stat-icon-admin">
              <Icon name="alert-triangle" size={24} />
            </div>
            <div className="security-stat-content">
              <span className="security-stat-value" style={{ color: 'var(--warning)' }}>{degraded.length}</span>
              <span className="security-stat-label">Degraded</span>
            </div>
          </div>
          <div className="security-stat-card">
            <div className="security-stat-icon" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
              <Icon name="x" size={24} />
            </div>
            <div className="security-stat-content">
              <span className="security-stat-value" style={{ color: 'var(--danger)' }}>{down.length}</span>
              <span className="security-stat-label">Down</span>
            </div>
          </div>
        </div>

        {/* Node cards */}
        {nodes.length === 0 ? (
          <EmptyState
            icon={<Icon name="activity" size={48} />}
            message="No Calico node data"
            submessage="Ensure calico-node pods are running in kube-system."
          />
        ) : (
          <div className="cni-health-grid">
            {nodes.map(n => {
              const healthColor = getHealthColor(n.felix_ready, n.bird_ready)
              const healthLabel = getHealthLabel(n.felix_ready, n.bird_ready)
              return (
                <div
                  key={n.node}
                  className="cni-health-card"
                  style={{ '--health-color': healthColor } as React.CSSProperties}
                >
                  <div className="cni-health-card-header">
                    <div className="cni-health-card-name">
                      <span className="cni-health-indicator" style={{ backgroundColor: healthColor }} />
                      <span>{n.node}</span>
                    </div>
                    <span className="cni-health-badge" style={{ backgroundColor: healthColor, color: healthColor === 'var(--warning)' ? '#000' : '#fff' }}>
                      {healthLabel}
                    </span>
                  </div>
                  <div className="cni-health-card-body">
                    <div className="cni-health-detail">
                      <span className="cni-health-detail-label">IP</span>
                      <span className="cni-health-detail-value">{n.ip || '-'}</span>
                    </div>
                    <div className="cni-health-detail">
                      <span className="cni-health-detail-label">Felix</span>
                      <span className="cni-health-detail-value" style={{ color: n.felix_ready ? 'var(--success)' : 'var(--danger)' }}>
                        {n.felix_ready ? 'Ready' : 'Down'}
                      </span>
                    </div>
                    <div className="cni-health-detail">
                      <span className="cni-health-detail-label">BIRD/BGP</span>
                      <span className="cni-health-detail-value" style={{ color: n.bird_ready ? 'var(--success)' : 'var(--danger)' }}>
                        {n.bird_ready ? 'Ready' : 'Down'}
                      </span>
                    </div>
                    <div className="cni-health-detail">
                      <span className="cni-health-detail-label">Uptime</span>
                      <span className="cni-health-detail-value">{formatUptime(n.uptime_seconds)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
