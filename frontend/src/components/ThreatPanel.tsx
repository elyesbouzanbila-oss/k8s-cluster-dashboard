import { useState, useMemo, useCallback, useEffect } from 'react'
import type { ThreatEvent } from '../types'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

interface ThreatPanelProps {
  threats: ThreatEvent[]
  wsConnected: boolean
  onClear?: () => void
  loading?: boolean
}

const SEVERITIES = ['Critical', 'High', 'Medium', 'Warning'] as const

const NOW = Date.now

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'Critical': return '#ff4d4d'
    case 'High': return '#ff9933'
    case 'Medium': return '#ffcc00'
    case 'Warning': return '#ffdd66'
    default: return '#666666'
  }
}

function getRelativeTime(timestamp: string, _refreshTick?: number): string {
  const now = NOW()
  const time = new Date(timestamp).getTime()
  const diff = Math.floor((now - time) / 1000)
  if (diff < 0) return 'just now'
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

export function ThreatPanel({ threats, wsConnected, onClear, loading }: ThreatPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [paused, setPaused] = useState(false)
  const [pausedSnapshots, setPausedSnapshots] = useState<ThreatEvent[][]>([])
  const [tick, setTick] = useState(0)

  // Re-render periodically to keep relative timestamps fresh
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Take snapshot when pausing
  const handlePauseToggle = useCallback(() => {
    setPaused(prev => {
      if (!prev) {
        setPausedSnapshots(prevSnap => [threats, ...prevSnap].slice(0, 1))
      }
      return !prev
    })
  }, [threats])

  const handleClear = useCallback(() => {
    setPausedSnapshots([])
    setPaused(false)
    onClear?.()
  }, [onClear])

  // Use snapshot when paused, live data otherwise
  const displayThreats = paused && pausedSnapshots.length > 0 ? pausedSnapshots[0] : threats

  const filteredThreats = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return displayThreats.filter(t => {
      if (severityFilter !== 'all' && t.priority !== severityFilter) return false
      if (!q) return true
      return (
        t.rule.toLowerCase().includes(q) ||
        t.output.toLowerCase().includes(q) ||
        t.priority.toLowerCase().includes(q)
      )
    })
  }, [displayThreats, searchQuery, severityFilter])

  const isFiltered = searchQuery.trim().length > 0 || severityFilter !== 'all'

  return (
    <div className="section threats-section">
      <h2>Threat Detection</h2>

      <div className="threat-status">
        <span className={`indicator ${wsConnected ? 'connected' : 'disconnected'}`}></span>
        {wsConnected ? (
          <span>Real-time threat monitoring active</span>
        ) : (
          <span>Connecting to threat stream...</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          {paused ? 'Stream paused' : `Showing ${filteredThreats.length} of ${displayThreats.length} events`}
        </span>
      </div>

      {/* Toolbar */}
      <div className="security-toolbar" style={{ marginBottom: '16px' }}>
        <div className="security-search" style={{ flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="security-search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="security-search-input"
            placeholder="Search by rule, output, or priority..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search threats"
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
            className={`security-chip ${severityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSeverityFilter('all')}
          >
            All
          </button>
          {SEVERITIES.map(sev => (
            <button
              key={sev}
              className={`security-chip ${severityFilter === sev ? 'active' : ''}`}
              onClick={() => setSeverityFilter(sev)}
              style={severityFilter === sev ? {
                backgroundColor: getPriorityColor(sev),
                borderColor: getPriorityColor(sev),
                color: sev === 'Warning' || sev === 'Medium' ? '#000' : '#fff'
              } : undefined}
            >
              {sev}
            </button>
          ))}
        </div>
        <button
          className="refresh-btn"
          onClick={handlePauseToggle}
          title={paused ? 'Resume threat stream' : 'Pause threat stream'}
          aria-label={paused ? 'Resume' : 'Pause'}
          style={{ color: paused ? 'var(--warning)' : undefined, borderColor: paused ? 'var(--warning)' : undefined }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            {paused ? (
              <polygon points="5 3 19 12 5 21 5 3" />
            ) : (
              <>
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </>
            )}
          </svg>
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>
        <button
          className="refresh-btn"
          onClick={handleClear}
          title="Clear all threat events"
          aria-label="Clear threats"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Clear</span>
        </button>
      </div>

      {/* Results meta */}
      {isFiltered && (
        <div className="security-results-meta">
          Found {filteredThreats.length} event{(filteredThreats.length ?? 0) !== 1 ? 's' : ''}
          {searchQuery && <span> · <strong>"{searchQuery}"</strong></span>}
          {severityFilter !== 'all' && <span> · {severityFilter} only</span>}
        </div>
      )}

      {displayThreats.length === 0 && !paused ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          message="No threats detected"
          submessage="All clear — no security events captured yet."
        />
      ) : paused && pausedSnapshots.length > 0 && displayThreats.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="12" x2="12" y2="12" />
            </svg>
          }
          message="Threat stream paused — no events captured yet"
          submessage="Resume the stream to start receiving events."
        />
      ) : filteredThreats.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          }
          message="No matching threats"
          submessage="Try adjusting your search or filter criteria."
        />
      ) : loading || (!wsConnected && threats.length === 0) ? (
        <div className="threat-list" aria-label="Loading threats">
          <Skeleton variant="threat" count={5} />
        </div>
      ) : (
        <div className="threat-list">
          {filteredThreats.map((threat) => (
            <div key={threat.id} className={`threat-card ${threat.priority.toLowerCase()}`}>
              <div className="threat-header">
                <span className="priority-dot" style={{ backgroundColor: getPriorityColor(threat.priority) }}></span>
                <span className="priority">{threat.priority}</span>
                <span className="rule" title={threat.rule}>{threat.rule}</span>
                <span className="time" title={new Date(threat.time).toLocaleString()}>{getRelativeTime(threat.time, tick)}</span>
              </div>
              <p className="output" title={threat.output}>{threat.output}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
