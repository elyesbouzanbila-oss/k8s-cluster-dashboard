import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThreatPanel } from './ThreatPanel'
import type { ThreatEvent } from '../types'

const makeThreat = (overrides: Partial<ThreatEvent>): ThreatEvent => ({
  id: `threat-${Math.random().toString(36).slice(2, 8)}`,
  priority: 'Warning',
  rule: 'Test rule',
  output: 'Test output',
  time: new Date().toISOString(),
  ...overrides,
})

const THREATS: ThreatEvent[] = [
  makeThreat({ id: 't1', priority: 'Critical', rule: 'Shell spawned', output: 'Process started' }),
  makeThreat({ id: 't2', priority: 'High', rule: 'File write to /etc', output: 'Sensitive file modified' }),
  makeThreat({ id: 't3', priority: 'Medium', rule: 'Network connection', output: 'Outbound connection' }),
  makeThreat({ id: 't4', priority: 'Warning', rule: 'CPU spike', output: 'High CPU usage detected' }),
]

describe('ThreatPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders threat count', () => {
    render(<ThreatPanel threats={THREATS} wsConnected={true} />)
    expect(screen.getByText(/Showing 4 of 4 events/i)).toBeInTheDocument()
  })

  it('renders empty state when no threats', () => {
    render(<ThreatPanel threats={[]} wsConnected={true} />)
    expect(screen.getByText('No threats detected')).toBeInTheDocument()
  })

  it('filters threats by search query', () => {
    render(<ThreatPanel threats={THREATS} wsConnected={true} />)
    const searchInput = screen.getByPlaceholderText(/Search by rule, output, or priority/i)
    fireEvent.change(searchInput, { target: { value: 'shell' } })
    expect(screen.getByText('Shell spawned')).toBeInTheDocument()
    expect(screen.queryByText('CPU spike')).not.toBeInTheDocument()
  })

  it('filters threats by severity', () => {
    render(<ThreatPanel threats={THREATS} wsConnected={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }))
    expect(screen.getByText('Shell spawned')).toBeInTheDocument()
    expect(screen.queryByText('CPU spike')).not.toBeInTheDocument()
  })

  it('pauses and resumes the threat stream', () => {
    const { rerender } = render(<ThreatPanel threats={THREATS} wsConnected={true} />)

    // Click Pause - button text changes to "Resume", status shows "Stream paused"
    fireEvent.click(screen.getByText('Pause'))
    expect(screen.getByText('Resume')).toBeInTheDocument()
    expect(screen.getByText('Stream paused')).toBeInTheDocument()

    // Rerender with new threats - paused snapshot keeps old data (4 items, not 5)
    const newThreat = makeThreat({ id: 't5', priority: 'Critical', rule: 'New threat' })
    rerender(<ThreatPanel threats={[...THREATS, newThreat]} wsConnected={true} />)

    // While paused, status shows "Stream paused" (not the live count)
    expect(screen.getByText('Stream paused')).toBeInTheDocument()
    // Verify old threats are still visible (snapshot preserved 4 threats)
    expect(screen.getByText('Shell spawned')).toBeInTheDocument()
    expect(screen.getByText('CPU spike')).toBeInTheDocument()

    // Resume - should show new data including the 5th threat
    fireEvent.click(screen.getByText('Resume'))
    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(screen.getByText(/Showing 5 of 5 events/i)).toBeInTheDocument()
    expect(screen.getByText('New threat')).toBeInTheDocument()
  })

  it('clears all threats and resets pause state', () => {
    render(<ThreatPanel threats={THREATS} wsConnected={true} onClear={vi.fn()} />)

    // Pause first
    fireEvent.click(screen.getByText('Pause'))
    expect(screen.getByText('Resume')).toBeInTheDocument()

    // Clear: unpauses, onClear is called, status reverts to showing count
    fireEvent.click(screen.getByText('Clear'))
    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(screen.getByText(/Showing 4 of 4 events/i)).toBeInTheDocument()
  })

  it('shows connected status when wsConnected is true', () => {
    render(<ThreatPanel threats={THREATS} wsConnected={true} />)
    expect(screen.getByText(/Real-time threat monitoring active/i)).toBeInTheDocument()
  })

  it('shows disconnected status when wsConnected is false', () => {
    render(<ThreatPanel threats={THREATS} wsConnected={false} />)
    expect(screen.getByText(/Connecting to threat stream/i)).toBeInTheDocument()
  })

  it('displays "No matching threats" when filter yields empty results', () => {
    render(<ThreatPanel threats={THREATS} wsConnected={true} />)
    const searchInput = screen.getByPlaceholderText(/Search by rule, output, or priority/i)
    fireEvent.change(searchInput, { target: { value: 'zzz_nonexistent' } })
    expect(screen.getByText('No matching threats')).toBeInTheDocument()
  })
})
