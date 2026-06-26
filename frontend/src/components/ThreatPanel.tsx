import type { ThreatEvent } from '../types'

interface ThreatPanelProps {
  threats: ThreatEvent[]
  wsConnected: boolean
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'Critical': return '#ff4d4d'
    case 'High': return '#ff9933'
    case 'Medium': return '#ffcc00'
    case 'Warning': return '#ffdd66'
    default: return '#666666'
  }
}

export function ThreatPanel({ threats, wsConnected }: ThreatPanelProps) {
  return (
    <div className="section threats-section">
      <h2>Threat Detection</h2>
      <div className="threat-status">
        <span className={`indicator ${wsConnected ? 'connected' : 'disconnected'}`}></span>
        {wsConnected ? (
          <span>Real-time threat monitoring active · <strong>{threats.length}</strong> events captured</span>
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
                <span className="priority-dot" style={{ backgroundColor: getPriorityColor(threat.priority) }}></span>
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
  )
}
