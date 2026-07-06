import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DataSourceBadge } from './DataSourceBadge'

describe('DataSourceBadge', () => {
  it('displays "Live Data" for status "success"', () => {
    render(<DataSourceBadge status="success" label="test" />)
    expect(screen.getByText('Live Data')).toBeInTheDocument()
  })

  it('displays "Mock Data" for status "mock"', () => {
    render(<DataSourceBadge status="mock" label="test" />)
    expect(screen.getByText('Mock Data')).toBeInTheDocument()
  })

  it('displays "Error" for status "error"', () => {
    render(<DataSourceBadge status="error" label="test" />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('displays "Unknown" for unknown status', () => {
    render(<DataSourceBadge status="unknown" label="test" />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('displays "Unknown" for undefined status', () => {
    render(<DataSourceBadge label="test" />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('sets the title attribute', () => {
    render(<DataSourceBadge status="live" label="Policy data" />)
    expect(screen.getByTitle('Policy data: Live Data')).toBeInTheDocument()
  })
})
