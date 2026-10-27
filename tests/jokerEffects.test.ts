import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, applyJoker, newGame, play } from '../src/engine'
import { placeCells } from '../src/engine/board'
import type { GameState, Tray } from '../src/engine/types'
import { JOKER_FX_MS, describeJokerFx } from '../src/fx/jokerEffects'

const fun = () => newGame(4, DEFAULT_CONFIG, { mode: 'eglence', freeJokers: { cekic: 2, yenile: 2, dondur: 2 } })
const withTray = (s: GameState, ids: (string | null)[]): GameState => ({
  ...s,
  tray: ids.map((id) => (id ? { shapeId: id, color: 2 } : null)) as unknown as Tray,
})

describe('joker efekt tanımı', () => {
  it('Çekiç: kırılan hücre ve rengi', () => {
    const base = fun()
    const s = { ...base, board: placeCells(base.board, [10], 5) }
    const r = applyJoker(s, { type: 'cekic', cell: 10 })
    if (!r.ok) throw new Error('beklenmedik')
    expect(describeJokerFx(1, r.events, s.tray)).toEqual({ id: 1, kind: 'cekic', cell: 10, color: 5 })
  })

  it('Yenile: değişen yuvalar ve önceki parçalar (boş yuva boş kalır)', () => {
    const s = withTray(fun(), ['h2', null, 'v3'])
    const r = applyJoker(s, { type: 'yenile' })
    if (!r.ok) throw new Error('beklenmedik')
    const fx = describeJokerFx(2, r.events, s.tray)
    expect(fx).toMatchObject({ id: 2, kind: 'yenile', slots: [0, 2] })
    expect(fx && fx.kind === 'yenile' && fx.before).toEqual(s.tray)
  })

  it('Döndür: ilk dönüş ödenmiş, sonraki ücretsiz dönüş de efekt üretir', () => {
    const s = withTray(fun(), ['l4-a', null, null])
    const r1 = applyJoker(s, { type: 'dondur', slot: 0 })
    if (!r1.ok) throw new Error('beklenmedik')
    expect(describeJokerFx(3, r1.events, s.tray)).toEqual({ id: 3, kind: 'dondur', slot: 0, paid: true })
    const r2 = applyJoker(r1.state, { type: 'dondur', slot: 0 })
    if (!r2.ok) throw new Error('beklenmedik')
    expect(describeJokerFx(4, r2.events, r1.state.tray)).toEqual({ id: 4, kind: 'dondur', slot: 0, paid: false })
  })

  it('geçersiz kullanım ve normal hamle efekt üretmez', () => {
    const s = withTray(fun(), ['sq2', 'h2', null])
    const bad = applyJoker(s, { type: 'dondur', slot: 0 })
    expect(bad.ok).toBe(false)
    const empty = applyJoker(s, { type: 'cekic', cell: 0 })
    expect(empty.ok).toBe(false)
    const mv = play(s, { slot: 1, row: 0, col: 0 })
    if (!mv.ok) throw new Error('beklenmedik')
    expect(describeJokerFx(5, mv.events, s.tray)).toBe(null)
  })

  it('efektler kısa (oyunu bekletmez)', () => {
    for (const ms of Object.values(JOKER_FX_MS)) expect(ms).toBeLessThanOrEqual(400)
  })
})
