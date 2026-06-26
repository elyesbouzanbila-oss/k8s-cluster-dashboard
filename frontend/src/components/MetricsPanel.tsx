import type { NodeMetric } from '../types'
import { parseCPU, parseMemory } from '../utils'

interface MetricsPanelProps {
  nodeMetrics: NodeMetric[]
}

export function MetricsPanel({ nodeMetrics }: MetricsPanelProps) {
  return (
    <div className="section metrics-section">
      <h2>Cluster Metrics</h2>
      <div className="subsection">
        <h3>Node Resource Usage</h3>
        {nodeMetrics.length === 0 ? (
          <p className="empty">No metrics found. Ensure metrics-server is installed in your cluster.</p>
        ) : (
          <div className="metrics-grid">
            {nodeMetrics.map((node) => {
              const usedCPU = parseCPU(node.usage.cpu)
              const totalCPU = parseInt(node.capacity.cpu)
              const cpuPercent = (usedCPU / totalCPU) * 100

              const usedMem = parseMemory(node.usage.memory)
              const totalMem = parseMemory(node.capacity.memory)
              const memPercent = (usedMem / totalMem) * 100

              return (
                <div key={node.name} className="metrics-card">
                  <div className="metrics-card-header">
                    <h4>{node.name}</h4>
                  </div>
                  <p className="metrics-card-sub">{node.kubeletVersion} | {node.os}</p>

                  <div className="metrics-bar-group">
                    <div className="metrics-bar-row">
                      <div className="metrics-bar-label">
                        <span>CPU Usage</span>
                        <span>{usedCPU.toFixed(2)} / {totalCPU} Cores</span>
                      </div>
                      <div className="metrics-bar-track">
                        <div className="metrics-bar-fill cpu-bar-fill" style={{ width: `${cpuPercent}%` }}></div>
                      </div>
                    </div>

                    <div className="metrics-bar-row">
                      <div className="metrics-bar-label">
                        <span>Memory Usage</span>
                        <span>{usedMem.toFixed(2)} / {totalMem.toFixed(2)} GiB</span>
                      </div>
                      <div className="metrics-bar-track">
                        <div className="metrics-bar-fill mem-bar-fill" style={{ width: `${memPercent}%` }}></div>
                      </div>
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
