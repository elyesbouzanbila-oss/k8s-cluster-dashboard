import { useState, useRef, useMemo, useCallback } from 'react'
import type { Pod } from '../types'
import { Icon } from './Icon'

interface DiagnosticsPanelProps {
  pods: Pod[]
}

interface LogEntry {
  id: number
  type: 'info' | 'success' | 'error' | 'command'
  message: string
  timestamp: Date
}

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const API_KEY = import.meta.env.VITE_API_KEY || 'your-secret-api-key-change-this'

export function DiagnosticsPanel({ pods }: DiagnosticsPanelProps) {
  const [sourceNs, setSourceNs] = useState('default')
  const [sourcePod, setSourcePod] = useState('')
  const [targetType, setTargetType] = useState<'pod' | 'service'>('pod')
  const [targetNs, setTargetNs] = useState('default')
  const [targetPod, setTargetPod] = useState('')
  const [targetService, setTargetService] = useState('')
  const [targetPort, setTargetPort] = useState(80)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef(0)
  const logEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { id: logIdRef.current++, type, message, timestamp: new Date() }])
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const uniqueNamespaces = useMemo(() => [...new Set(pods.map(p => p.namespace))].sort(), [pods])

  const podsInSourceNs = pods.filter(p => p.namespace === sourceNs)
  const podsInTargetNs = pods.filter(p => p.namespace === targetNs)

  const handleRunTest = useCallback(async () => {
    if (!sourcePod) {
      addLog('error', 'Please select a source pod.')
      return
    }
    if (targetType === 'pod' && !targetPod) {
      addLog('error', 'Please select a target pod.')
      return
    }
    if (targetType === 'service' && !targetService) {
      addLog('error', 'Please enter a target service name.')
      return
    }
    if (!targetPort || targetPort < 1 || targetPort > 65535) {
      addLog('error', 'Please enter a valid target port (1-65535).')
      return
    }

    setRunning(true)
    addLog('info', `Initiating connectivity test from ${sourceNs}/${sourcePod} to ${targetType === 'pod' ? `${targetNs}/${targetPod}:${targetPort}` : `${targetNs}/${targetService}:${targetPort}`}...`)

    try {
      const params = new URLSearchParams({
        source_pod: sourcePod,
        source_namespace: sourceNs,
        target_namespace: targetNs,
      })
      params.set('target_port', String(targetPort))
      if (targetType === 'pod') {
        params.set('target_pod', targetPod)
      } else {
        params.set('target_service', targetService)
        params.delete('target_pod')
      }

      addLog('command', `POST /api/cni/diagnostics/connectivity?${params.toString()}`)

      const response = await fetch(`${API_BASE_URL}/api/cni/diagnostics/connectivity?${params.toString()}`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
      })

      if (response.ok) {
        const data = await response.json()
        addLog('info', `Response status: ${data.status}`)
        const d = data.data
        if (d?.reachable === true) {
          const targetDisplay = targetType === 'pod' ? `${targetNs}/${targetPod}:${targetPort}` : `${targetNs}/${targetService}:${targetPort}`
          addLog('success', `✓ ${sourceNs}/${sourcePod} → ${targetDisplay} REACHABLE (${d.latency_ms || '?'}ms)`)
          if (d.dns_result?.trim()) {
            addLog('info', `DNS: ${d.dns_result.split('\n')[0]}`)
          }
        } else if (d?.reachable === false) {
          const targetDisplay = targetType === 'pod' ? `${targetNs}/${targetPod}:${targetPort}` : `${targetNs}/${targetService}:${targetPort}`
          addLog('error', `✗ ${sourceNs}/${sourcePod} → ${targetDisplay} NOT REACHABLE`)
        } else {
          addLog('info', `Result: ${d?.note || 'No result'}`)
        }
        // Show log preview
        if (d?.log_preview && d.log_preview !== 'No output from diagnostic pod') {
          const preview = d.log_preview.substring(0, 300)
          addLog('command', preview)
        }
      } else {
        addLog('error', `HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      addLog('error', `Network error: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setRunning(false)
      addLog('info', 'Connectivity test completed.')
    }
  }, [sourceNs, sourcePod, targetNs, targetPod, targetService, targetType, addLog])

  const handleClearLogs = useCallback(() => {
    setLogs([])
    logIdRef.current = 0
  }, [])

  const logTimeFormatter = useCallback((d: Date) => {
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, [])

  return (
    <div className="section diagnostics-section">
      <h2>Connectivity Diagnostics</h2>

      <div className="diagnostics-layout">
        {/* Left column: Form */}
        <div className="diagnostics-form">
          <div className="dashboard-card dashboard-card-wide" style={{ display: 'block', marginBottom: '16px' }}>
            <div className="dashboard-card-header">
              <Icon name="play" size={16} className="card-header-icon" />
              <span>Test Configuration</span>
            </div>

            {/* Source */}
            <div className="diagnostics-form-section">
              <h4 className="diagnostics-form-label">Source</h4>
              <div className="diagnostics-form-row">
                <div className="diagnostics-form-field">
                  <label className="diagnostics-field-label">Namespace</label>
                  <select
                    className="diagnostics-select"
                    value={sourceNs}
                    onChange={e => { setSourceNs(e.target.value); setSourcePod('') }}
                  >
                    {uniqueNamespaces.map(ns => (
                      <option key={ns} value={ns}>{ns}</option>
                    ))}
                  </select>
                </div>
                <div className="diagnostics-form-field">
                  <label className="diagnostics-field-label">Pod</label>
                  <select
                    className="diagnostics-select"
                    value={sourcePod}
                    onChange={e => setSourcePod(e.target.value)}
                  >
                    <option value="">— Select pod —</option>
                    {podsInSourceNs.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Target */}
            <div className="diagnostics-form-section">
              <h4 className="diagnostics-form-label">Target</h4>
              <div className="diagnostics-target-type">
                <button
                  className={`security-chip ${targetType === 'pod' ? 'active' : ''}`}
                  onClick={() => setTargetType('pod')}
                >
                  <Icon name="pod" size={14} />
                  Pod
                </button>
                <button
                  className={`security-chip ${targetType === 'service' ? 'active' : ''}`}
                  onClick={() => setTargetType('service')}
                >
                  <Icon name="network" size={14} />
                  Service
                </button>
              </div>
              <div className="diagnostics-form-row">
                <div className="diagnostics-form-field">
                  <label className="diagnostics-field-label">Namespace</label>
                  <select
                    className="diagnostics-select"
                    value={targetNs}
                    onChange={e => { setTargetNs(e.target.value); setTargetPod(''); setTargetService('') }}
                  >
                    {uniqueNamespaces.map(ns => (
                      <option key={ns} value={ns}>{ns}</option>
                    ))}
                  </select>
                </div>
                <div className="diagnostics-form-field">
                  <label className="diagnostics-field-label">Port</label>
                  <input
                    type="number"
                    className="diagnostics-input"
                    min={1}
                    max={65535}
                    value={targetPort}
                    onChange={e => setTargetPort(parseInt(e.target.value) || 80)}
                    placeholder="e.g. 80"
                  />
                </div>
              </div>
              <div className="diagnostics-form-row">
                <div className="diagnostics-form-field">
                  {targetType === 'pod' ? (
                    <>
                      <label className="diagnostics-field-label">Pod</label>
                      <select
                        className="diagnostics-select"
                        value={targetPod}
                        onChange={e => setTargetPod(e.target.value)}
                      >
                        <option value="">— Select pod —</option>
                        {podsInTargetNs.map(p => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="diagnostics-field-label">Service Name</label>
                      <input
                        type="text"
                        className="diagnostics-input"
                        placeholder="e.g. my-service"
                        value={targetService}
                        onChange={e => setTargetService(e.target.value)}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              className="diagnostics-run-btn"
              onClick={handleRunTest}
              disabled={running}
            >
              {running ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  Running...
                </>
              ) : (
                <>
                  <Icon name="play" size={16} />
                  Run Test
                </>
              )}
            </button>
          </div>

          {pods.length === 0 && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic' }}>
              No pods loaded. Some features may be limited.
            </p>
          )}
        </div>

        {/* Right column: Log */}
        <div className="diagnostics-log">
          <div className="diagnostics-log-header">
            <div className="dashboard-card-header" style={{ marginBottom: 0 }}>
              <Icon name="activity" size={16} className="card-header-icon" />
              <span>Test Results</span>
            </div>
            <button className="refresh-btn" onClick={handleClearLogs} title="Clear log">
              <Icon name="trash-2" size={16} />
              <span>Clear</span>
            </button>
          </div>

          <div className="diagnostics-log-content">
            {logs.length === 0 ? (
              <div className="diagnostics-log-empty">
                <Icon name="info" size={24} />
                <span>Run a connectivity test to see results here.</span>
              </div>
            ) : (
              logs.map(entry => (
                <div key={entry.id} className={`diagnostics-log-entry diagnostics-log-${entry.type}`}>
                  <span className="diagnostics-log-time">{logTimeFormatter(entry.timestamp)}</span>
                  <span className="diagnostics-log-msg">{entry.message}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
