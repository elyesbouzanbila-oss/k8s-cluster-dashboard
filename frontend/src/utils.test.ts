import { describe, it, expect } from 'vitest'
import {
  parseCPU,
  parseCPUToMilli,
  parseMemory,
  parseMemoryToBytes,
  formatBytes,
  formatCPU,
  getNsColor,
  getPriorityColor,
  getBarColor,
  NS_COLORS,
  CONTAINER_COLORS,
} from './utils'

// ───── parseCPU ───────────────────────────────────────────────────
describe('parseCPU', () => {
  it('parses millicores (m suffix)', () => {
    expect(parseCPU('500m')).toBe(0.5)
    expect(parseCPU('100m')).toBe(0.1)
    expect(parseCPU('0m')).toBe(0)
  })

  it('parses whole cores (no suffix)', () => {
    expect(parseCPU('2')).toBe(2)
    expect(parseCPU('0.5')).toBe(0.5)
  })

  it('parses nanocores (n suffix)', () => {
    expect(parseCPU('100000000n')).toBe(0.1)
  })

  it('parses microcores (u suffix)', () => {
    expect(parseCPU('500000u')).toBe(0.5)
  })

  it('returns 0 for empty input', () => {
    expect(parseCPU('')).toBe(0)
  })
})

// ───── parseCPUToMilli ───────────────────────────────────────────
describe('parseCPUToMilli', () => {
  it('returns millicores directly for m suffix', () => {
    expect(parseCPUToMilli('500m')).toBe(500)
    expect(parseCPUToMilli('1m')).toBe(1)
  })

  it('converts whole cores to millicores', () => {
    expect(parseCPUToMilli('2')).toBe(2000)
    expect(parseCPUToMilli('0.5')).toBe(500)
  })

  it('handles nano and micro suffixes', () => {
    expect(parseCPUToMilli('1000n')).toBe(0.001)
    expect(parseCPUToMilli('1000u')).toBe(1)
  })

  it('returns 0 for empty input', () => {
    expect(parseCPUToMilli('')).toBe(0)
  })
})

// ───── parseMemory ────────────────────────────────────────────────
describe('parseMemory', () => {
  it('parses GiB values', () => {
    expect(parseMemory('2Gi')).toBe(2)
    expect(parseMemory('1Gi')).toBe(1)
  })

  it('parses MiB values to fractional GiB', () => {
    expect(parseMemory('512Mi')).toBe(0.5)
    expect(parseMemory('1024Mi')).toBe(1)
  })

  it('parses KiB values to fractional GiB', () => {
    expect(parseMemory('1048576Ki')).toBeCloseTo(1, 5)
  })

  it('parses TiB values', () => {
    expect(parseMemory('1Ti')).toBe(1024)
    expect(parseMemory('0.5Ti')).toBe(512)
  })

  it('parses plain byte numbers', () => {
    expect(parseMemory('1073741824')).toBe(1073741824)
  })

  it('returns 0 for empty input', () => {
    expect(parseMemory('')).toBe(0)
  })
})

// ───── parseMemoryToBytes ──────────────────────────────────────────
describe('parseMemoryToBytes', () => {
  it('converts Ki to bytes', () => {
    expect(parseMemoryToBytes('1Ki')).toBe(1024)
  })

  it('converts Mi to bytes', () => {
    expect(parseMemoryToBytes('1Mi')).toBe(1024 * 1024)
  })

  it('converts Gi to bytes', () => {
    expect(parseMemoryToBytes('1Gi')).toBe(1024 * 1024 * 1024)
  })

  it('converts Ti to bytes', () => {
    expect(parseMemoryToBytes('1Ti')).toBe(1024 * 1024 * 1024 * 1024)
  })

  it('converts decimal k/M/G to bytes', () => {
    expect(parseMemoryToBytes('1k')).toBe(1000)
    expect(parseMemoryToBytes('1M')).toBe(1000 * 1000)
    expect(parseMemoryToBytes('1G')).toBe(1000 * 1000 * 1000)
  })

  it('returns 0 for NaN input', () => {
    expect(parseMemoryToBytes('not-a-number')).toBe(0)
  })
})

// ───── formatBytes ─────────────────────────────────────────────────
describe('formatBytes', () => {
  it('formats GiB values', () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.0 GiB')
  })

  it('formats MiB values', () => {
    expect(formatBytes(512 * 1024 * 1024)).toBe('512 MiB')
  })

  it('formats KiB values', () => {
    expect(formatBytes(1024)).toBe('1 KiB')
  })

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(0)).toBe('0 B')
  })
})

// ───── formatCPU ──────────────────────────────────────────────────
describe('formatCPU', () => {
  it('formats millicores', () => {
    expect(formatCPU(500)).toBe('500m')
    expect(formatCPU(0)).toBe('0m')
  })

  it('formats whole cores', () => {
    expect(formatCPU(2000)).toBe('2.00 cores')
    expect(formatCPU(1500)).toBe('1.50 cores')
  })
})

// ───── getNsColor ─────────────────────────────────────────────────
describe('getNsColor', () => {
  it('returns known namespace colors', () => {
    expect(getNsColor('kube-system')).toBe('#ec4899')
    expect(getNsColor('production')).toBe('#10B981')
    expect(getNsColor('monitoring')).toBe('#06B6D4')
    expect(getNsColor('default')).toBe('#8b5cf6')
  })

  it('returns fallback color for unknown namespaces', () => {
    expect(getNsColor('unknown')).toBe('#6366F1')
    expect(getNsColor('staging')).toBe('#6366F1')
    expect(getNsColor('')).toBe('#6366F1')
  })

  it('has NS_COLORS entries matching getNsColor', () => {
    for (const [ns, color] of Object.entries(NS_COLORS)) {
      expect(getNsColor(ns)).toBe(color)
    }
  })
})

// ───── getPriorityColor ────────────────────────────────────────────
describe('getPriorityColor', () => {
  it('maps each priority to a distinct color', () => {
    expect(getPriorityColor('Critical')).toBe('#ff4d4d')
    expect(getPriorityColor('High')).toBe('#ff9933')
    expect(getPriorityColor('Medium')).toBe('#ffcc00')
    expect(getPriorityColor('Warning')).toBe('#ffdd66')
  })

  it('returns fallback for unknown priority', () => {
    expect(getPriorityColor('Info')).toBe('#666666')
    expect(getPriorityColor('')).toBe('#666666')
  })
})

// ───── getBarColor ─────────────────────────────────────────────────
describe('getBarColor', () => {
  it('returns red for >= 90%', () => {
    expect(getBarColor(90)).toBe('#ef4444')
    expect(getBarColor(100)).toBe('#ef4444')
  })

  it('returns amber for 70-89%', () => {
    expect(getBarColor(70)).toBe('#f59e0b')
    expect(getBarColor(89)).toBe('#f59e0b')
  })

  it('returns blue for 50-69%', () => {
    expect(getBarColor(50)).toBe('#3b82f6')
    expect(getBarColor(69)).toBe('#3b82f6')
  })

  it('returns green for < 50%', () => {
    expect(getBarColor(0)).toBe('#10b981')
    expect(getBarColor(49)).toBe('#10b981')
  })
})

// ───── CONTAINER_COLORS ────────────────────────────────────────────
describe('CONTAINER_COLORS', () => {
  it('has 7 distinct colors', () => {
    expect(CONTAINER_COLORS).toHaveLength(7)
  })
})
