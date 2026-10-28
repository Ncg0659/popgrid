import { describe, expect, it } from 'vitest'
import { jokerCue, moveCue } from '../src/audio/soundCue'
import { cellCenter } from '../src/fx/boardGeometry'
import { describeEffect, type Effect } from '../src/fx/effects'
import { SHOP_TOAST_MS, STAR_BANNER_MS, STAR_NOTICE_MS } from '../src/fx/fxTiming'
import { BOARD_SIZE } from '../src/engine/types'
import { newGame, play } from '../src/engine/game'
import { greedyBot } from '../scripts/bot'

/** 7.2'deki FxCanvas hesabının birebir kopyası (karşılaştırma için). */
function oldCenter(rect: { left: number; top: number; width: number }, gap: number, cellIndex: number) {
  const cell = (rect.width - (BOARD_SIZE - 1) * gap) / BOARD_SIZE
  const pitch = cell + gap
  const r = Math.floor(cellIndex / BOARD_SIZE)
  const c = cellIndex % BOARD_SIZE
  return { x: rect.left + c * pitch + cell / 2, y: rect.top + r * pitch + cell / 2, size: cell }
}

describe('7.3a tahta ölçüsü yardımcısı', () => {
  it('64 hücrenin hepsinde, farklı ekran boylarında eski hesapla birebir aynı', () => {
    const boxes = [
      { left: 16, top: 120, width: 288, gap: 4 }, // 320 genişlik
      { left: 12.5, top: 98.25, width: 350, gap: 5 },
      { left: 0, top: 0, width: 398, gap: 6 }, // 430 genişlik
      { left: 3, top: 7, width: 256, gap: 0 },
    ]
    for (const b of boxes) {
      for (let cell = 0; cell < BOARD_SIZE * BOARD_SIZE; cell++) {
        expect(cellCenter(b, cell)).toEqual(oldCenter(b, b.gap, cell))
      }
    }
  })
})

describe('7.3a ses eşlemesi (soundCue)', () => {
  const fx = (lines: number, combo: number): Effect => ({ id: 1, placed: [0], placedColor: 1, cleared: [], lines, combo, gained: 0 })

  it('temizleme yoksa yerleştirme sesi, varsa temizleme arpeji (hat ve kombo aynen)', () => {
    expect(moveCue(fx(0, 0))).toEqual({ kind: 'place' })
    expect(moveCue(fx(1, 1))).toEqual({ kind: 'clear', lines: 1, combo: 1 })
    expect(moveCue(fx(3, 4))).toEqual({ kind: 'clear', lines: 3, combo: 4 })
  })

  it('gerçek hamlelerde eski kuralla aynı karar: her hamleye tek ses', () => {
    let s = newGame(21)
    let n = 0
    while (!s.gameOver && n < 80) {
      const before = s.board
      const r = play(s, greedyBot(s)!)
      if (!r.ok) throw new Error(r.reason)
      const e = describeEffect(++n, before, r.events)
      const cue = moveCue(e)
      // 7.2'deki App.tsx kuralı: effect.lines > 0 ise playClear(lines, combo), değilse playPlace().
      if (e.lines > 0) expect(cue).toEqual({ kind: 'clear', lines: e.lines, combo: e.combo })
      else expect(cue).toEqual({ kind: 'place' })
      s = r.state
    }
    expect(n).toBeGreaterThan(10)
  })

  it('joker sesi joker türünü aynen taşır', () => {
    expect(jokerCue({ id: 1, kind: 'cekic', cell: 3, color: 2 })).toEqual({ kind: 'joker', joker: 'cekic' })
    expect(jokerCue({ id: 2, kind: 'yenile', slots: [0], before: [null, null, null] })).toEqual({ kind: 'joker', joker: 'yenile' })
    expect(jokerCue({ id: 3, kind: 'dondur', slot: 1, paid: true })).toEqual({ kind: 'joker', joker: 'dondur' })
  })
})

describe('7.3a süre sabitleri', () => {
  it('bildirim süreleri 7.2 ile aynı', () => {
    expect([SHOP_TOAST_MS, STAR_NOTICE_MS, STAR_BANNER_MS]).toEqual([2200, 3500, 6000])
  })
})
