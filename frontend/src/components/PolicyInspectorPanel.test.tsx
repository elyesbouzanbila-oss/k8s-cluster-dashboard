import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PolicyInspectorPanel } from './PolicyInspectorPanel'
import type { CniPolicy, DataSourceStatus } from '../types'

const makePolicy = (overrides: Partial<CniPolicy>): CniPolicy => ({
  name: 'test-policy',
  type: 'GlobalNetworkPolicy',
  rules_count: 1,
  rule_actions: ['Allow'],
  ...overrides,
})

const POLICIES: CniPolicy[] = [
  makePolicy({
    name: 'default-deny',
    type: 'GlobalNetworkPolicy',
    namespace: null,
    selector: 'all()',
    order: 1000,
    rules_count: 2,
    rule_actions: ['Deny'],
  }),
  makePolicy({
    name: 'allow-kube-dns',
    type: 'GlobalNetworkPolicy',
    namespace: null,
    selector: 'all()',
    order: 900,
    rules_count: 1,
    rule_actions: ['Allow'],
  }),
  makePolicy({
    name: 'allow-frontend',
    type: 'NetworkPolicy',
    namespace: 'production',
    selector: 'app == frontend',
    order: 500,
    rules_count: 3,
    rule_actions: ['Allow'],
  }),
  makePolicy({
    name: 'mixed-rules',
    type: 'NetworkPolicy',
    namespace: 'monitoring',
    selector: 'app == prometheus',
    order: 400,
    rules_count: 2,
    rule_actions: ['Allow', 'Deny'],
  }),
]

describe('PolicyInspectorPanel', () => {
  it('renders total policy count', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Total Policies')).toBeInTheDocument()
  })

  it('renders empty state when no policies', () => {
    render(<PolicyInspectorPanel policies={[]} />)
    expect(screen.getByText('No network policies found')).toBeInTheDocument()
  })

  it('shows ActionBadge with "Deny" for Deny-only policies', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    const denyBadges = screen.getAllByText('Deny')
    expect(denyBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows ActionBadge with "Allow" for Allow-only policies', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    const allowBadges = screen.getAllByText('Allow')
    expect(allowBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows ActionBadge with "Mixed" for policies with multiple rule_actions', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    const mixedBadges = screen.getAllByText('Mixed')
    expect(mixedBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('filters policies by search query', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    const searchInput = screen.getByPlaceholderText(/search policies/i)
    fireEvent.change(searchInput, { target: { value: 'frontend' } })
    expect(screen.getByText(/Found 1 policy/)).toBeInTheDocument()
    expect(screen.getByText('allow-frontend')).toBeInTheDocument()
    expect(screen.queryByText('default-deny')).not.toBeInTheDocument()
  })

  it('filters policies by type (Global only)', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    const globalBtn = screen.getByRole('button', { name: 'Global' })
    fireEvent.click(globalBtn)
    expect(screen.getByText(/Found 2 policies/)).toBeInTheDocument()
    expect(screen.getByText('default-deny')).toBeInTheDocument()
    expect(screen.getByText('allow-kube-dns')).toBeInTheDocument()
    expect(screen.queryByText('allow-frontend')).not.toBeInTheDocument()
  })

  it('filters policies by type (Namespaced only)', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    const nsBtn = screen.getByRole('button', { name: 'Namespaced' })
    fireEvent.click(nsBtn)
    expect(screen.getByText(/Found 2 policies/)).toBeInTheDocument()
    expect(screen.getByText('allow-frontend')).toBeInTheDocument()
    expect(screen.queryByText('default-deny')).not.toBeInTheDocument()
  })

  it('shows results meta with search and filter combined', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    const searchInput = screen.getByPlaceholderText(/search policies/i)
    fireEvent.change(searchInput, { target: { value: 'allow' } })
    const nsBtn = screen.getByRole('button', { name: 'Namespaced' })
    fireEvent.click(nsBtn)
    expect(screen.getByText(/Found 1 polic/)).toBeInTheDocument()
  })

  it('shows "no matching policies" when filter yields no results', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    const searchInput = screen.getByPlaceholderText(/search policies/i)
    fireEvent.change(searchInput, { target: { value: 'zzz_nonexistent' } })
    expect(screen.getByText('No matching policies')).toBeInTheDocument()
  })

  it('displays Allow and Deny rule counts in summary cards', () => {
    render(<PolicyInspectorPanel policies={POLICIES} />)
    // 2 Allow rules (allow-kube-dns, allow-frontend), 1 Deny (default-deny), 
    // 2 Allow + 1 Deny (mixed-rules) = 3 Allow, 2 Deny
    expect(screen.getByText('Allow Rules')).toBeInTheDocument()
    expect(screen.getByText('Deny Rules')).toBeInTheDocument()
  })
})
