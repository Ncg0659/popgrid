import { describe, expect, it } from 'vitest'
import { cellIndex, placeCells } from '../src/engine/board'
import { newGame, play } from '../src/engine/game'
import type { GameState, Tray } from '../src/engine/types'
import { WAVE_MAX_MS, celebrationText, describeEffect } from '../src/fx/effects'

function withTray(state: GameState, ids: (string | null)[], color = 3): GameState {
  return { ...state, tray: ids.map((id) => (id ? { shapeId: id, color } : null)) as unknown as Tray }
}

function run(state: GameState, slot: 0 | 1 | 2, row: number, col: number) {
  const r = play(state, { slot, row, col })
  if (!r.ok) throw new Error('geçersiz')
  return { state: r.state, effect: describeEffect(1, state.board, r.events) }
}

describe('efekt tanımı', () => {
  it('yalnızca yerleştirme: bounce hücreleri var, temizleme ve kombo yok', () => {
    const { effect } = run(withTray(newGame(1), ['h3', 'dot', 'dot']), 0, 2, 2)
    expect(effect.placed).toEqual([18, 19, 20])
    expect(effect.placedColor).toBe(3)
    expect(effect.cleared).toEqual([])
    expect(effect.lines).toBe(0)
    expect(effect.combo).toBe(0)
    expect(effect.gained).toBe(3)
    expect(celebrationText(effect)).toBe(null)
  })

  it('temizlenen blokların rengi önceki tahtadan, yerleştirilen kısmınki parçadan gelir', () => {
    const base = newGame(1)
    const board = placeCells(base.board, Array.from({ length: 6 }, (_, c) => cellIndex(7, c)), 5)
    const { effect } = run(withTray({ ...base, board }, ['h2', 'dot', 'dot'], 2), 0, 7, 6)
    expect(effect.lines).toBe(1)
    expect(effect.combo).toBe(1)
    expect(effect.cleared.map((b) => b.color)).toEqual([5, 5, 5, 5, 5, 5, 2, 2])
    expect(effect.gained).toBe(2 + 10)
    expect(celebrationText(effect)).toBe(null)
  })

  it('patlama dalgası yerleştirilen parçadan uzaklaştıkça gecikir ve sınırlıdır', () => {
    const base = newGame(1)
    const board = placeCells(base.board, Array.from({ length: 7 }, (_, c) => cellIndex(0, c + 1)), 1)
    const { effect } = run(withTray({ ...base, board }, ['dot', 'dot', 'dot']), 0, 0, 0)
    const delays = effect.cleared.map((b) => b.delay)
    expect(delays[0]).toBe(0)
    for (let i = 1; i < delays.length; i++) expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]!)
    expect(Math.max(...delays)).toBeLessThanOrEqual(WAVE_MAX_MS)
  })

  it('çoklu temizleme ve kombo kutlama metni üretir; puanlama motordan aynen gelir', () => {
    const base = newGame(1)
    const cells: number[] = []
    for (let c = 0; c < 8; c++) if (c !== 0) cells.push(cellIndex(0, c))
    for (let r = 0; r < 8; r++) if (r !== 0) cells.push(cellIndex(r, 0))
    const board = placeCells(base.board, cells, 4)
    const s = withTray({ ...base, board, combo: 1 }, ['dot', 'dot', 'dot'])
    const { effect } = run(s, 0, 0, 0)
    expect(effect.lines).toBe(2)
    expect(effect.combo).toBe(2)
    expect(effect.gained).toBe(1 + 40 * 2)
    expect(celebrationText(effect)).toEqual({ title: 'Süper!', combo: 'Kombo ×2' })
  })

  it('kutlama metinleri', () => {
    const e = (lines: number, combo: number) => ({ id: 1, placed: [], placedColor: 1, cleared: [], lines, combo, gained: 0 })
    expect(celebrationText(e(1, 1))).toBe(null)
    expect(celebrationText(e(1, 3))).toEqual({ title: null, combo: 'Kombo ×3' })
    expect(celebrationText(e(3, 1))).toEqual({ title: 'Harika!', combo: null })
    expect(celebrationText(e(4, 1))?.title).toBe('Muhteşem!')
  })
})
