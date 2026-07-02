import { useState, useMemo } from 'react'
import type { RbacBinding, PrivilegedPod, DataSourceStatus } from '../types'
import { DataSourceBadge } from './DataSourceBadge'

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
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="subject-icon-svg">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case 'Group':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="subject-icon-svg">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'ServiceAccount':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="subject-icon-svg">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="subject-icon-svg">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )
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
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="security-chevron"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="security-group-title">{title}</span>
        <span className="security-group-count">{count}</span>
      </button>
      {open && <div className="security-group-content">{children}</div>}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({
  icon,
  message,
  submessage,
}: {
  icon: React.ReactNode
  message: string
  submessage?: string
}) {
  return (
    <div className="security-empty">
      <div className="security-empty-icon">{icon}</div>
      <p className="security-empty-message">{message}</p>
      {submessage && <p className="security-empty-sub">{submessage}</p>}
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                </svg>
                {binding.namespace}
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <span className="cluster-wide-label">Cluster-wide</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="rbac-subjects">
        <div className="rbac-subjects-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Subjects</span>
          <span className="subject-badge">{subjectCount}</span>
        </div>
        <div className="rbac-subject-list">
          {binding.subjects.map((s, i) => (
            <div key={i} className={`rbac-subject ${subjectKindClass(s.kind)}`}>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="security-stat-content">
            <span className="security-stat-value">{rbacBindings.length}</span>
            <span className="security-stat-label">Total RBAC Bindings</span>
            <span className="security-stat-sub">{crbCount} ClusterRole · {rbCount} Role</span>
          </div>
        </div>

        <div className="security-stat-card">
          <div className="security-stat-icon stat-icon-admin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="security-stat-content">
            <span className="security-stat-value security-stat-value-danger">{adminBindings.length}</span>
            <span className="security-stat-label">Admin-Level Bindings</span>
            <span className="security-stat-sub">cluster-admin role</span>
          </div>
        </div>

        <div className="security-stat-card">
          <div className="security-stat-icon stat-icon-privileged">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="security-stat-content">
            <span className="security-stat-value security-stat-value-danger">{privilegedPods.length}</span>
            <span className="security-stat-label">Privileged Pods</span>
            <span className="security-stat-sub">High-risk containers</span>
          </div>
        </div>

        <div className="security-stat-card">
          <div className="security-stat-icon stat-icon-subjects">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="security-search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
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
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
            message="No RBAC bindings found"
            submessage="Ensure your K8s cluster is configured and accessible."
          />
        ) : filteredBindings.length === 0 ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
            message="No matching bindings"
            submessage="Try adjusting your search or filter criteria."
          />
        ) : (
          <div className="security-rbac-sections">
            {/* ClusterRoleBindings */}
            {clusterRoleBindings.length > 0 && (
              <CollapsibleSection title="ClusterRoleBindings" count={clusterRoleBindings.length} defaultOpen={true}>
                <div className="rbac-list">
                  {clusterRoleBindings.map((binding, idx) => (
                    <RbacCard key={idx} binding={binding} />
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" className="security-ns-icon">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        </svg>
                        <span className="security-ns-name">{ns}</span>
                        <span className="security-ns-count">{bindings.length}</span>
                      </div>
                      <div className="rbac-list">
                        {bindings.map((binding, idx) => (
                          <RbacCard key={idx} binding={binding} />
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
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
            message="No privileged pods found"
            submessage="Cluster is running with secure pod configurations."
          />
        ) : filteredPrivileged.length === 0 ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
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
              {filteredPrivileged.map((pod, idx) => {
                const isPrivileged = pod.privileged
                const isRoot = pod.run_as_user === 0
                const riskLevel = isPrivileged && isRoot ? 'critical' : 'high'
                return (
                  <div key={idx} className={`privileged-card risk-${riskLevel}`}>
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
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          </svg>
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
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          PRIVILEGED MODE
                        </span>
                      )}
                      {isRoot && (
                        <span className="risk-factor factor-root">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
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
