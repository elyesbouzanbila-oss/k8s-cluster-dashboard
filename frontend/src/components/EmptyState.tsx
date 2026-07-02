interface EmptyStateProps {
  icon: React.ReactNode
  message: string
  submessage?: string
}

export function EmptyState({ icon, message, submessage }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <p className="empty-state-message">{message}</p>
      {submessage && <p className="empty-state-sub">{submessage}</p>}
    </div>
  )
}
