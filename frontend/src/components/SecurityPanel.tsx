import type { RbacBinding, PrivilegedPod } from '../types'

interface SecurityPanelProps {
  rbacBindings: RbacBinding[]
  privilegedPods: PrivilegedPod[]
}

export function SecurityPanel({ rbacBindings, privilegedPods }: SecurityPanelProps) {
  return (
    <div className="section security-section">
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
  )
}
