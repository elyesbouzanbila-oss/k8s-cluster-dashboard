import type { Pod, TopologyNode, TopologyEdge } from '../types'
import { Topology } from '../Topology'

interface NetworkPanelProps {
  pods: Pod[]
  topology: { nodes: TopologyNode[]; edges: TopologyEdge[] }
}

export function NetworkPanel({ pods, topology }: NetworkPanelProps) {
  return (
    <div className="section network-section">
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
  )
}
