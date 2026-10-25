import { describe, expect, it } from 'vitest'
import { newGame } from '../src/engine/game'
import { getShape } from '../src/engine/shapes'
import type { GameState, Tray } from '../src/engine/types'
import { anchorOf, originFor, previewMove } from '../src/ui/placement'

function withTray(state: GameState, ids: (string | null)[]): GameState {
  return { ...state, tray: ids.map((id) => (id ? { shapeId: id, color: 2 } : null)) as unknown as Tray }
}

describe('dokunma yerleştirme yardımcıları', () => {
  it('tutma noktası her zaman şeklin dolu bir hücresidir', () => {
    for (const id of ['dot', 'h5', 'sq3', 'c3-br', 'c5-br', 't4-down', 's4-v']) {
      const shape = getShape(id)
      const [r, c] = anchorOf(shape)
      expect(shape.cells.some(([sr, sc]) => sr === r && sc === c)).toBe(true)
    }
  })

  it('tutma noktası ortaya yakındır', () => {
    expect(anchorOf(getShape('h5'))).toEqual([0, 2])
    expect(anchorOf(getShape('sq3'))).toEqual([1, 1])
    expect(anchorOf(getShape('dot'))).toEqual([0, 0])
  })

  it('dokunulan hücreye tutma noktası oturur, kenarda tahtaya yaslanır', () => {
    const h5 = getShape('h5')
    expect(originFor(h5, 4, 4)).toEqual({ row: 4, col: 2 })
    expect(originFor(h5, 0, 0)).toEqual({ row: 0, col: 0 })
    expect(originFor(h5, 7, 7)).toEqual({ row: 7, col: 3 })
    expect(originFor(getShape('v5'), 7, 0)).toEqual({ row: 3, col: 0 })
  })

  it('önizleme motorla aynı sonucu verir ve mevcut durumu değiştirmez', () => {
    const s = Object.freeze(withTray(newGame(1), ['h3', 'dot', 'dot']))
    const p = previewMove(s, 0, { row: 2, col: 1 })
    expect(p?.ok).toBe(true)
    expect(p?.cells).toEqual([17, 18, 19])
    expect(p?.next?.score).toBe(3)
    expect(s.score).toBe(0)
    expect(s.board.every((c) => c === 0)).toBe(true)
  })

  it('geçersiz konumda ok=false ve sonraki durum yok', () => {
    let s = withTray(newGame(1), ['sq2', 'sq2', 'dot'])
    s = previewMove(s, 0, { row: 0, col: 0 })!.next!
    const p = previewMove(s, 1, { row: 1, col: 1 })
    expect(p?.ok).toBe(false)
    expect(p?.next).toBe(null)
  })

  it('temizlenecek hücreleri bildirir', () => {
    let s = withTray(newGame(1), ['h4', 'h4', 'dot'])
    s = previewMove(s, 0, { row: 7, col: 0 })!.next!
    const p = previewMove(s, 1, { row: 7, col: 4 })
    expect(p?.ok).toBe(true)
    expect([...(p?.clearing ?? [])].sort((a, b) => a - b)).toEqual([56, 57, 58, 59, 60, 61, 62, 63])
  })

  it('boş yuva için önizleme yok', () => {
    expect(previewMove(withTray(newGame(1), [null, 'dot', 'dot']), 0, { row: 0, col: 0 })).toBe(null)
  })
})
