// ─── Namespace Colors (canonical palette) ──────────────────────
export const NS_COLORS: Record<string, string> = {
  'kube-system': '#ec4899',
  'production': '#10B981',
  'monitoring': '#06B6D4',
  'default': '#8b5cf6',
}

const NS_FALLBACK_COLOR = '#6366F1'

export function getNsColor(ns: string): string {
  return NS_COLORS[ns] || NS_FALLBACK_COLOR
}

// ─── CPU Parsing ────────────────────────────────────────────────
/** Parse CPU string to fractional cores (e.g. '500m' → 0.5, '2' → 2) */
export function parseCPU(cpuStr: string): number {
  if (!cpuStr) return 0
  if (cpuStr.endsWith('n')) return parseFloat(cpuStr.slice(0, -1)) / 1_000_000_000
  if (cpuStr.endsWith('m')) return parseFloat(cpuStr.slice(0, -1)) / 1000
  if (cpuStr.endsWith('u')) return parseFloat(cpuStr.slice(0, -1)) / 1_000_000
  return parseFloat(cpuStr)
}

/** Parse CPU string to millicores (e.g. '500m' → 500, '2' → 2000) */
export function parseCPUToMilli(cpuStr: string): number {
  if (!cpuStr) return 0
  if (cpuStr.endsWith('n')) return parseFloat(cpuStr.slice(0, -1)) / 1_000_000
  if (cpuStr.endsWith('m')) return parseFloat(cpuStr.slice(0, -1))
  if (cpuStr.endsWith('u')) return parseFloat(cpuStr.slice(0, -1)) / 1000
  return parseFloat(cpuStr) * 1000
}

// ─── Memory Parsing ──────────────────────────────────────────────
/** Parse memory string to GiB (e.g. '2Gi' → 2, '512Mi' → 0.5) */
export function parseMemory(memStr: string): number {
  if (!memStr) return 0
  if (memStr.endsWith('Ki')) return parseFloat(memStr.slice(0, -2)) / (1024 * 1024)
  if (memStr.endsWith('Mi')) return parseFloat(memStr.slice(0, -2)) / 1024
  if (memStr.endsWith('Gi')) return parseFloat(memStr.slice(0, -2))
  if (memStr.endsWith('Ti')) return parseFloat(memStr.slice(0, -2)) * 1024
  return parseFloat(memStr)
}

/** Parse memory string to bytes */
export function parseMemoryToBytes(memStr: string): number {
  if (!memStr) return 0
  if (memStr.endsWith('Ki')) return parseFloat(memStr.slice(0, -2)) * 1024
  if (memStr.endsWith('Mi')) return parseFloat(memStr.slice(0, -2)) * 1024 * 1024
  if (memStr.endsWith('Gi')) return parseFloat(memStr.slice(0, -2)) * 1024 * 1024 * 1024
  if (memStr.endsWith('Ti')) return parseFloat(memStr.slice(0, -2)) * 1024 * 1024 * 1024 * 1024
  if (memStr.endsWith('k')) return parseFloat(memStr.slice(0, -1)) * 1000
  if (memStr.endsWith('M')) return parseFloat(memStr.slice(0, -1)) * 1000 * 1000
  if (memStr.endsWith('G')) return parseFloat(memStr.slice(0, -1)) * 1000 * 1000 * 1000
  const n = parseFloat(memStr)
  return isNaN(n) ? 0 : n
}

// ─── Formatting ──────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`
  return `${bytes} B`
}

/** Format millicores for display */
export function formatCPU(cpu: number): string {
  if (cpu >= 1000) return `${(cpu / 1000).toFixed(2)} cores`
  return `${cpu.toFixed(0)}m`
}

/** Get severity color by priority name */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'Critical': return '#ff4d4d'
    case 'High': return '#ff9933'
    case 'Medium': return '#ffcc00'
    case 'Warning': return '#ffdd66'
    default: return '#666666'
  }
}

/** Get bar fill color based on usage percentage */
export function getBarColor(percent: number): string {
  if (percent >= 90) return '#ef4444'
  if (percent >= 70) return '#f59e0b'
  if (percent >= 50) return '#3b82f6'
  return '#10b981'
}

// ─── Chart Colors (canonical palette for time-series) ────────────
export const CONTAINER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

// ─── Copy to Clipboard ────────────────────────────────────────────
let copyTimeoutId: ReturnType<typeof setTimeout> | null = null

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

export function showCopiedFeedback(element: HTMLElement) {
  if (copyTimeoutId) clearTimeout(copyTimeoutId)
  const existing = element.parentElement?.querySelector('.copy-feedback')
  if (existing) existing.remove()
  const feedback = document.createElement('span')
  feedback.className = 'copy-feedback'
  feedback.textContent = 'Copied!'
  feedback.style.cssText = `
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary, #3b82f6);
    color: #fff;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    animation: fadeSlideIn 0.2s ease;
    z-index: 20;
  `
  element.parentElement!.style.position = 'relative'
  element.parentElement!.appendChild(feedback)
  copyTimeoutId = setTimeout(() => {
    feedback.remove()
    copyTimeoutId = null
  }, 1200)
}
