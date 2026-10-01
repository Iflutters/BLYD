import { describe, expect, it } from 'vitest'
import { durationParts, periodRange, share } from './reports'

describe('reports', () => {
  const now = new Date(2026, 8, 30, 15, 20) // 30/09/2026 15:20 (local)

  it('atalhos de período cobrem dias inteiros no fuso local, terminando hoje', () => {
    const last7 = periodRange('7d', now)
    expect(last7?.from).toEqual(new Date(2026, 8, 24, 0, 0, 0, 0))
    expect(last7?.to).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999))
    expect(periodRange('30d', now)?.from).toEqual(new Date(2026, 8, 1))
    expect(periodRange('month', now)?.from).toEqual(new Date(2026, 8, 1))
  })

  it('período personalizado: datas válidas e fim não antes do início', () => {
    expect(periodRange('custom', now, { from: '2026-09-01', to: '2026-09-10' })).toEqual({ from: new Date(2026, 8, 1), to: new Date(2026, 8, 10, 23, 59, 59, 999) })
    expect(periodRange('custom', now, { from: '2026-09-10', to: '2026-09-01' })).toBeNull()
    expect(periodRange('custom', now, { from: '', to: '2026-09-01' })).toBeNull()
  })

  it('tempo legível e proporções', () => {
    expect(durationParts(null)).toBeNull()
    expect(durationParts(5.25)).toEqual({ value: 5.3, unit: 'hours' })
    expect(durationParts(72)).toEqual({ value: 3, unit: 'days' })
    expect(share(1, 4)).toBe(25)
    expect(share(3, 0)).toBe(0)
  })
})
