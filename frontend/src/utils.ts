export const parseCPU = (cpuStr: string): number => {
  if (!cpuStr) return 0
  if (cpuStr.endsWith('n')) return parseInt(cpuStr.slice(0, -1)) / 1000000000
  if (cpuStr.endsWith('m')) return parseInt(cpuStr.slice(0, -1)) / 1000
  return parseInt(cpuStr)
}

export const parseMemory = (memStr: string): number => {
  if (!memStr) return 0
  if (memStr.endsWith('Ki')) return parseInt(memStr.slice(0, -2)) / (1024 * 1024)
  if (memStr.endsWith('Mi')) return parseInt(memStr.slice(0, -2)) / 1024
  if (memStr.endsWith('Gi')) return parseInt(memStr.slice(0, -2))
  return parseInt(memStr)
}

let copyTimeoutId: ReturnType<typeof setTimeout> | null = null

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
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

// Show a brief "Copied!" tooltip near the element
export function showCopiedFeedback(element: HTMLElement) {
  if (copyTimeoutId) {
    clearTimeout(copyTimeoutId)
  }
  const existing = element.parentElement?.querySelector('.copy-feedback')
  if (existing) {
    existing.remove()
  }
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
