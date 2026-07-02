interface SkeletonProps {
  variant?: 'card' | 'threat' | 'table-row' | 'custom'
  width?: string
  height?: string
  style?: React.CSSProperties
  count?: number
}

export function Skeleton({ variant = 'card', width, height, style, count = 1 }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i)

  return (
    <>
      {items.map(i => (
        <div
          key={i}
          className={`skeleton-pulse ${variant !== 'custom' ? `skeleton-${variant}` : ''}`}
          style={{
            ...(width ? { width } : {}),
            ...(height ? { height } : {}),
            ...style,
          }}
          aria-hidden="true"
        />
      ))}
    </>
  )
}
