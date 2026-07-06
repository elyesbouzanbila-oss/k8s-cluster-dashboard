import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders message', () => {
    render(<EmptyState icon={<span>🔔</span>} message="No data found" />)
    expect(screen.getByText('No data found')).toBeInTheDocument()
  })

  it('renders submessage when provided', () => {
    render(
      <EmptyState
        icon={<span>🔔</span>}
        message="No data"
        submessage="Try adjusting your filters."
      />
    )
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument()
  })

  it('renders icon', () => {
    render(<EmptyState icon={<span data-testid="test-icon">🔔</span>} message="Test" />)
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
  })

  it('does not render submessage when not provided', () => {
    const { container } = render(<EmptyState icon={<span>🔔</span>} message="No data" />)
    expect(container.querySelector('.empty-state-sub')).not.toBeInTheDocument()
  })
})
