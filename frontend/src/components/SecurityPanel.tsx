import { useState, useMemo } from 'react'
import type { RbacBinding, PrivilegedPod, DataSourceStatus } from '../types'
import { DataSourceBadge } from './DataSourceBadge'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'

interface SecurityPanelProps {
  rbacBindings: RbacBinding[]
  privilegedPods: PrivilegedPod[]
  rbacStatus?: DataSourceStatus
  privilegedStatus?: DataSourceStatus
}

// ─── Subject Type Icons ───────────────────────────────────────────
function SubjectIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'User':
      return <Icon name="users" size={16} className="subject-icon-svg" />
    case 'Group':
      return <Icon name="users" size={16} className="subject-icon-svg" />
    case 'ServiceAccount':
      return <Icon name="lock" size={16} className="subject-icon-svg" />
    default:
      return <Icon name="info" size={16} className="subject-icon-svg" />
  }
}

// ─── Subject Kind Label Color ────────────────────────────────────
function subjectKindClass(kind: string): string {
  switch (kind) {
    case 'User': return 'subject-user'
    case 'Group': return 'subject-group'
    case 'ServiceAccount': return 'subject-sa'
    default: return 'subject-other'
  }
}

// ─── Collapsible Section ─────────────────────────────────────────
function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`security-group ${open ? 'is-open' : ''}`}>
      <button
        className="security-group-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Icon
          name="chevron-right"
          size={16}
          className="security-chevron"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="security-group-title">{title}</span>
        <span className="security-group-count">{count}</span>
      </button>
      {open && <div className="security-group-content">{children}</div>}
    </div>
  )
}

// ─── Rbac Binding Card ───────────────────────────────────────────
function RbacCard({ binding }: { binding: RbacBinding }) {
  const isAdmin = binding.role_ref.name === 'cluster-admin'
  const subjectCount = binding.subjects.length

  return (
    <div className={`rbac-card ${isAdmin ? 'admin' : ''}`}>
      <div className="rbac-header">
        <div className="rbac-name-row">
          <h4>{binding.name}</h4>
          {isAdmin && (
            <span className="admin-badge">
              <Icon name="shield" size={12} style={{ strokeWidth: 2.5 }} />
              ADMIN
            </span>
          )}
        </div>
        <span className="binding-type">{binding.binding_type}</span>
      </div>

      <div className="rbac-details">
        <div className="rbac-detail-row">
          <span className="rbac-detail-label">Role</span>
          <span className="rbac-detail-value">
            <span className="role-kind">{binding.role_ref.kind}</span>
            <span className="role-name">{binding.role_ref.name}</span>
          </span>
        </div>
        <div className="rbac-detail-row">
          <span className="rbac-detail-label">Scope</span>
          <span className="rbac-detail-value">
            {binding.namespace ? (
              <>
                <Icon name="square" size={14} />
                {binding.namespace}
              </>
            ) : (
              <>
                <Icon name="circle" size={14} />
                <span className="cluster-wide-label">Cluster-wide</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="rbac-subjects">
        <div className="rbac-subjects-header">
          <Icon name="users" size={14} />
          <span>Subjects</span>
          <span className="subject-badge">{subjectCount}</span>
        </div>
        <div className="rbac-subject-list">
          {binding.subjects.map((s) => (
            <div key={`${s.kind}-${s.name}-${s.namespace || ''}`} className={`rbac-subject ${subjectKindClass(s.kind)}`}>
              <SubjectIcon kind={s.kind} />
              <span className="subject-kind">{s.kind}</span>
              <span className="subject-name">{s.name}</span>
              {s.namespace && <span className="subject-ns">{s.namespace}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────
export function SecurityPanel({ rbacBindings, privilegedPods, rbacStatus, privilegedStatus }: SecurityPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'cluster-admin'>('all')

  // Filter data based on search
  const filteredBindings = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return rbacBindings.filter(b => {
      if (filterType === 'cluster-admin' && b.role_ref.name !== 'cluster-admin') {
        return false
      }
      if (!q) return true
      return (
        b.name.toLowerCase().includes(q) ||
        (b.namespace || '').toLowerCase().includes(q) ||
        b.role_ref.name.toLowerCase().includes(q) ||
        b.binding_type.toLowerCase().includes(q) ||
        b.subjects.some(s => s.name.toLowerCase().includes(q) || s.kind.toLowerCase().includes(q))
      )
    })
  }, [rbacBindings, searchQuery, filterType])

  const filteredPrivileged = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return privilegedPods
    return privilegedPods.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.namespace.toLowerCase().includes(q) ||
      p.container.toLowerCase().includes(q) ||
      p.image.toLowerCase().includes(q)
    )
  }, [privilegedPods, searchQuery])

  // Group RBAC bindings
  const clusterRoleBindings = useMemo(
    () => filteredBindings.filter(b => b.binding_type === 'ClusterRoleBinding'),
    [filteredBindings]
  )

  const roleBindingsByNs = useMemo(() => {
    const map = new Map<string, RbacBinding[]>()
    for (const b of filteredBindings.filter(b => b.binding_type === 'RoleBinding')) {
      const ns = b.namespace || 'default'
      if (!map.has(ns)) map.set(ns, [])
      map.get(ns)!.push(b)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredBindings])

  // Stats
  const adminBindings = rbacBindings.filter(b => b.role_ref.name === 'cluster-admin')
  const crbCount = rbacBindings.filter(b => b.binding_type === 'ClusterRoleBinding').length
  const rbCount = rbacBindings.filter(b => b.binding_type === 'RoleBinding').length
  const hasAnyData = rbacBindings.length > 0 || privilegedPods.length > 0
  const isFiltered = searchQuery.trim().length > 0 || filterType !== 'all'

  return (
    <div className="section security-section">
      <h2>Security Audit</h2>

      {/* ── Summary Stats ───────────────────────────────────── */}
      <div className="security-stats">
        <div className="security-stat-card">
          <div className="security-stat-icon stat-icon-bindings">
            <Icon name="shield" size={24} />
          </div>
          <div className="security-stat-content">
            <span className="security-stat-value">{rbacBindings.length}</span>
            <span className="security-stat-label">Total RBAC Bindings</span>
            <span className="security-stat-sub">{crbCount} ClusterRole · {rbCount} Role</span>
          </div>
        </div>

        <div className="security-stat-card">
          <div className="security-stat-icon stat-icon-admin">
            <Icon name="shield" size={24} />
          </div>
          <div className="security-stat-content">
            <span className="security-stat-value security-stat-value-danger">{adminBindings.length}</span>
            <span className="security-stat-label">Admin-Level Bindings</span>
            <span className="security-stat-sub">cluster-admin role</span>
          </div>
        </div>

        <div className="security-stat-card">
          <div className="security-stat-icon stat-icon-privileged">
            <Icon name="lock" size={24} />
          </div>
          <div className="security-stat-content">
            <span className="security-stat-value security-stat-value-danger">{privilegedPods.length}</span>
            <span className="security-stat-label">Privileged Pods</span>
            <span className="security-stat-sub">High-risk containers</span>
          </div>
        </div>

        <div className="security-stat-card">
          <div className="security-stat-icon stat-icon-subjects">
            <Icon name="users" size={24} />
          </div>
          <div className="security-stat-content">
            <span className="security-stat-value">
              {rbacBindings.reduce((acc, b) => acc + b.subjects.length, 0)}
            </span>
            <span className="security-stat-label">Total Subjects</span>
            <span className="security-stat-sub">Across all bindings</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter ────────────────────────────────── */}
      <div className="security-toolbar">
        <div className="security-search">
          <Icon name="search" className="security-search-icon" />
          <input
            type="text"
            className="security-search-input"
            placeholder="Search by name, namespace, role, or subject..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search security data"
          />
          {searchQuery && (
            <button
              className="security-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
        <div className="security-filter-chips">
          <button
            className={`security-chip ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
          <button
            className={`security-chip chip-danger ${filterType === 'cluster-admin' ? 'active' : ''}`}
            onClick={() => setFilterType('cluster-admin')}
          >
            <Icon name="shield" size={14} />
            Admin Only
          </button>
        </div>
      </div>

      {/* ── Results Meta ────────────────────────────────────── */}
      {isFiltered && (
        <div className="security-results-meta">
          Found {filteredBindings.length} RBAC binding{(filteredBindings.length ?? 0) !== 1 ? 's' : ''}
          {searchQuery && <span> · <strong>"{searchQuery}"</strong></span>}
          {filterType !== 'all' && <span> · Admin only</span>}
          {privilegedPods.length > 0 && (
            <span> · {filteredPrivileged.length} privileged pod{(filteredPrivileged.length ?? 0) !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* ── RBAC Bindings Section ───────────────────────────── */}
      <div className="subsection">
        <div className="subsection-header">
          <h3>RBAC Bindings ({rbacBindings.length})</h3>
          <DataSourceBadge status={rbacStatus} label="RBAC data" />
        </div>

        {!hasAnyData ? (
          <EmptyState
            icon={<Icon name="shield" size={48} />}
            message="No RBAC bindings found"
            submessage="Ensure your K8s cluster is configured and accessible."
          />
        ) : filteredBindings.length === 0 ? (
          <EmptyState
            icon={<Icon name="search" size={48} />}
            message="No matching bindings"
            submessage="Try adjusting your search or filter criteria."
          />
        ) : (
          <div className="security-rbac-sections">
            {/* ClusterRoleBindings */}
            {clusterRoleBindings.length > 0 && (
              <CollapsibleSection title="ClusterRoleBindings" count={clusterRoleBindings.length} defaultOpen={true}>
                <div className="rbac-list">
                  {clusterRoleBindings.map((binding) => (
                    <RbacCard key={`${binding.binding_type}-${binding.name}`} binding={binding} />
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* RoleBindings by Namespace */}
            {roleBindingsByNs.length > 0 && (
              <CollapsibleSection
                title="RoleBindings"
                count={roleBindingsByNs.reduce((acc, [, bindings]) => acc + bindings.length, 0)}
                defaultOpen={true}
              >
                <div className="security-ns-groups">
                  {roleBindingsByNs.map(([ns, bindings]) => (
                    <div key={ns} className="security-ns-group">
                      <div className="security-ns-group-header">
                        <Icon name="square" size={14} className="security-ns-icon" />
                        <span className="security-ns-name">{ns}</span>
                        <span className="security-ns-count">{bindings.length}</span>
                      </div>
                      <div className="rbac-list">
                        {bindings.map((binding) => (
                          <RbacCard key={`${binding.binding_type}-${binding.name}`} binding={binding} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}
      </div>

      {/* ── Privileged Pods Section ─────────────────────────── */}
      <div className="subsection">
        <div className="subsection-header">
          <h3>Privileged Pods ({privilegedPods.length})</h3>
          <DataSourceBadge status={privilegedStatus} label="Privileged data" />
        </div>

        {privilegedPods.length === 0 ? (
          <EmptyState
            icon={<Icon name="lock" size={48} />}
            message="No privileged pods found"
            submessage="Cluster is running with secure pod configurations."
          />
        ) : filteredPrivileged.length === 0 ? (
          <EmptyState
            icon={<Icon name="search" size={48} />}
            message="No matching privileged pods"
            submessage="Try adjusting your search."
          />
        ) : (
          <>
            {/* Severity distribution */}
            <div className="security-privileged-summary">
              <div className="security-privileged-stat">
                <span className="security-privileged-stat-value">
                  {filteredPrivileged.filter(p => p.privileged).length}
                </span>
                <span className="security-privileged-stat-label">Privileged Mode</span>
              </div>
              <div className="security-privileged-stat">
                <span className="security-privileged-stat-value">
                  {filteredPrivileged.filter(p => p.run_as_user === 0).length}
                </span>
                <span className="security-privileged-stat-label">Running as Root</span>
              </div>
              <div className="security-privileged-stat">
                <span className="security-privileged-stat-value">
                  {filteredPrivileged.length}
                </span>
                <span className="security-privileged-stat-label">Total Issues</span>
              </div>
            </div>

            <div className="privileged-list">
              {filteredPrivileged.map((pod) => {
                const isPrivileged = pod.privileged
                const isRoot = pod.run_as_user === 0
                const riskLevel = isPrivileged && isRoot ? 'critical' : 'high'
                return (
                  <div key={`${pod.namespace}-${pod.name}-${pod.container}`} className={`privileged-card risk-${riskLevel}`}>
                    <div className="pod-header">
                      <h4>{pod.name}</h4>
                      <span className={`risk-badge risk-${riskLevel}`}>
                        {riskLevel === 'critical' ? 'CRITICAL' : 'HIGH RISK'}
                      </span>
                    </div>
                    <div className="rbac-details">
                      <div className="rbac-detail-row">
                        <span className="rbac-detail-label">Namespace</span>
                        <span className="rbac-detail-value">
                          <Icon name="square" size={14} />
                          {pod.namespace}
                        </span>
                      </div>
                      <div className="rbac-detail-row">
                        <span className="rbac-detail-label">Container</span>
                        <span className="rbac-detail-value mono">{pod.container}</span>
                      </div>
                      <div className="rbac-detail-row">
                        <span className="rbac-detail-label">Image</span>
                        <span className="rbac-detail-value mono">{pod.image}</span>
                      </div>
                    </div>
                    <div className="risk-factors">
                      {isPrivileged && (
                        <span className="risk-factor factor-privileged">
                          <Icon name="lock" size={12} />
                          PRIVILEGED MODE
                        </span>
                      )}
                      {isRoot && (
                        <span className="risk-factor factor-root">
                          <Icon name="shield" size={12} />
                          RUNNING AS ROOT
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
