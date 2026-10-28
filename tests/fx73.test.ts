import { describe, expect, it } from 'vitest'
import { jokerCue, moveCue, purchaseCue } from '../src/audio/soundCue'
import { cellCenter } from '../src/fx/boardGeometry'
import { describeEffect, type Effect } from '../src/fx/effects'
import { SHOP_TOAST_MS, STAR_BANNER_MS, STAR_CHIP_HOLD_MS, STAR_CHIP_IN_MS, STAR_CHIP_MS, STAR_CHIP_OUT_MS, STAR_COUNT_MS, STAR_NOTICE_MS } from '../src/fx/fxTiming'
import { BOARD_SIZE, type GameEvent } from '../src/engine/types'
import { awardMove, initialEconomy, startGame, type EconomyState } from '../src/economy/ledger'
import { chipTimeLeft, starsGained, tweenStars } from '../src/ui/starFeedback'
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

// ---------------------------------------------------------------------------
// 7.3b — yıldız geri bildirimi
// ---------------------------------------------------------------------------

const okState = (r: { ok: boolean; state: EconomyState }) => {
  expect(r.ok).toBe(true)
  return r.state
}
const cleared = (n: number): GameEvent => ({ type: 'cleared', rows: Array.from({ length: n }, (_, i) => i), cols: [], cells: [] })

describe('7.3b kazanım miktarı', () => {
  it('hat ödülü defterle birebir: 1 hat 2, 2 hat 5, 3 hat 10 (iki modda)', () => {
    for (const mode of ['klasik', 'eglence'] as const) {
      let s = okState(startGame(initialEconomy(), 'g', mode))
      const got: number[] = []
      for (const [m, n] of [[1, 1], [2, 2], [3, 3], [4, 0]] as const) {
        const next = okState(awardMove(s, 'g', m, n ? [cleared(n)] : []))
        got.push(starsGained(s, next))
        s = next
      }
      expect(got).toEqual([2, 5, 10, 0])
    }
  })

  it('300 sınırında yalnızca gerçekten verilen kısım; sınırdan sonra 0', () => {
    let s = okState(startGame(initialEconomy(), 'f', 'eglence'))
    for (let m = 1; m <= 29; m++) s = okState(awardMove(s, 'f', m, [cleared(3)])) // 290
    const at = okState(awardMove(s, 'f', 30, [cleared(3)]))
    expect(starsGained(s, at)).toBe(10)
    const s2 = okState(awardMove(okState(startGame(initialEconomy(), 'h', 'eglence')), 'h', 1, [cleared(1)]))
    let t = s2
    for (let m = 2; m <= 30; m++) t = okState(awardMove(t, 'h', m, [cleared(3)])) // 2 + 290 = 292
    const capped = okState(awardMove(t, 'h', 31, [cleared(3)]))
    expect(starsGained(t, capped)).toBe(8)
    expect(starsGained(capped, okState(awardMove(capped, 'h', 32, [cleared(3)])))).toBe(0)
  })

  it('harcama kazanım sayılmaz', () => {
    const a = { ...initialEconomy(), stars: 100 }
    expect(starsGained(a, { ...a, stars: 75 })).toBe(0)
  })
})

describe('7.3b bakiye sayımı', () => {
  it('başlangıç ve bitiş kesin, en çok 300 ms, tek yönlü', () => {
    expect(STAR_COUNT_MS).toBe(300)
    expect(tweenStars(100, 110, 0)).toBe(100)
    expect(tweenStars(100, 110, 300)).toBe(110)
    expect(tweenStars(100, 110, 5000)).toBe(110)
    let prev = 100
    for (let t = 0; t <= 300; t += 16) {
      const v = tweenStars(100, 110, t)
      expect(v).toBeGreaterThanOrEqual(prev)
      expect(v).toBeLessThanOrEqual(110)
      prev = v
    }
    // Düşüş (satın alma) de aynı eğri.
    expect(tweenStars(100, 75, 0)).toBe(100)
    expect(tweenStars(100, 75, 300)).toBe(75)
    expect(tweenStars(100, 75, 150)).toBeLessThan(100)
  })

  it('hareketi azalt: tek adımda hedef', () => {
    expect(tweenStars(100, 110, 0, true)).toBe(110)
  })

  it('çip süreleri: hareket 150 ms, görünür toplam 1,3 sn', () => {
    expect([STAR_CHIP_IN_MS, STAR_CHIP_HOLD_MS, STAR_CHIP_OUT_MS, STAR_CHIP_MS]).toEqual([150, 900, 250, 1300])
  })
})

describe('7.3b kazanım çipi zamanı', () => {
  const p = (kind: 'gain' | 'spend', amount: number, at = 1000) => ({ id: 1, kind, amount, at })
  it('yalnızca kazanımda, 1,3 sn boyunca; düğme sonradan yeniden kurulursa tekrar oynamaz', () => {
    expect(chipTimeLeft(p('gain', 5), 1000, STAR_CHIP_MS)).toBe(1300)
    expect(chipTimeLeft(p('gain', 5), 2000, STAR_CHIP_MS)).toBe(300)
    expect(chipTimeLeft(p('gain', 5), 2300, STAR_CHIP_MS)).toBe(0)
    expect(chipTimeLeft(p('spend', 25), 1000, STAR_CHIP_MS)).toBe(0)
    expect(chipTimeLeft(p('gain', 0), 1000, STAR_CHIP_MS)).toBe(0)
    expect(chipTimeLeft(null, 1000, STAR_CHIP_MS)).toBe(0)
  })
})

describe('7.3c satın alma sesi eşlemesi', () => {
  it('yalnızca başarılı (kalıcı) alımda ses; başarısız ya da yok sayılan dokunuşta sessiz', () => {
    expect(purchaseCue({ ok: true })).toEqual({ kind: 'purchase' })
    expect(purchaseCue({ ok: false })).toBe(null)
    expect(purchaseCue(null)).toBe(null)
  })
})
