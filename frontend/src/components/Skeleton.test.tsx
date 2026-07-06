import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders one skeleton by default', () => {
    const { container } = render(<Skeleton />)
    expect(container.querySelector('.skeleton-card')).toBeInTheDocument()
  })

  it('renders correct count', () => {
    const { container } = render(<Skeleton count={3} />)
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(3)
  })

  it('applies variant class', () => {
    const { container } = render(<Skeleton variant="threat" />)
    expect(container.querySelector('.skeleton-threat')).toBeInTheDocument()
  })

  it('applies custom width and height when provided', () => {
    const { container } = render(<Skeleton width="200px" height="100px" variant="custom" />)
    const el = container.querySelector('.skeleton-pulse')
    expect(el).toHaveStyle({ width: '200px', height: '100px' })
  })

  it('renders multiple skeletons with variant', () => {
    const { container } = render(<Skeleton variant="table-row" count={5} />)
    expect(container.querySelectorAll('.skeleton-table-row')).toHaveLength(5)
  })
})
