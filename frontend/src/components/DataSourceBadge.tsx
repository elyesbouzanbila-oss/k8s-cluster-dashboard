import type { DataSourceStatus } from '../types'

interface DataSourceBadgeProps {
  status?: DataSourceStatus | string
  label: string
}

const LIVE_MOCK_MAP: Record<string, DataSourceStatus> = {
  success: 'live',
  mock: 'mock',
  error: 'error',
}

export function DataSourceBadge({ status, label }: DataSourceBadgeProps) {
  const resolvedStatus: DataSourceStatus = LIVE_MOCK_MAP[status ?? ''] ?? (status as DataSourceStatus) ?? 'unknown'
  const color = resolvedStatus === 'live' ? 'var(--success)' : resolvedStatus === 'mock' ? 'var(--warning)' : 'var(--text-tertiary)'
  const text = resolvedStatus === 'live' ? 'Live Data' : resolvedStatus === 'mock' ? 'Mock Data' : resolvedStatus === 'error' ? 'Error' : 'Unknown'

  return (
    <span
      className="data-source-badge"
      style={{
        '--badge-color': color,
        borderColor: color,
        color: color,
      } as React.CSSProperties}
      title={`${label}: ${text}`}
    >
      {resolvedStatus === 'live' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )}
      <span className="data-source-badge-label">{text}</span>
    </span>
  )
}
