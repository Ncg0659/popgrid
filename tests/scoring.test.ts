import { describe, expect, it } from 'vitest'
import { clearBasePoints, scoreMove } from '../src/engine/scoring'

describe('puan', () => {
  it('temizleme tablosu 10 × n × n', () => {
    expect(clearBasePoints(0)).toBe(0)
    expect(clearBasePoints(1)).toBe(10)
    expect(clearBasePoints(2)).toBe(40)
    expect(clearBasePoints(3)).toBe(90)
    expect(clearBasePoints(4)).toBe(160)
  })

  it('temizlemesiz hamle yalnızca blok puanı verir ve komboyu sıfırlar', () => {
    const { breakdown, combo } = scoreMove(4, 0, 3)
    expect(breakdown.total).toBe(4)
    expect(combo).toBe(0)
  })

  it('kombo serisi temizleme puanını çarpar', () => {
    const first = scoreMove(3, 1, 0)
    expect(first.combo).toBe(1)
    expect(first.breakdown.total).toBe(3 + 10)
    const second = scoreMove(2, 2, first.combo)
    expect(second.combo).toBe(2)
    expect(second.breakdown.clear).toBe(40 * 2)
    expect(second.breakdown.total).toBe(2 + 80)
  })
})
