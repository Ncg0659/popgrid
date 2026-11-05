import { describe, expect, it } from 'vitest'
import { cellIndex, emptyBoard, placeCells } from '../src/engine/board'
import { DEFAULT_CONFIG, GENERATOR_VERSION, SHARED_SEQUENCE_CONFIG, generateTriple } from '../src/engine/generator'
import { fingerprint, newGame, play } from '../src/engine/game'
import { applyJoker, rotateShapeId } from '../src/engine/jokers'
import { SHAPES, getShape } from '../src/engine/shapes'
import {
  BOMB_FUSE,
  BOMB_PER_MILLE,
  FUN_RULES_VERSION,
  LUCKY_PER_MILLE,
  assignSpecials,
  blastArea,
  centerBlock,
  rotateSpecial,
} from '../src/engine/specials'
import type { Board, BoardSpecial, GameEvent, GameState, JokerCharges, LuckyReward, Piece, PieceSpecial, Tray } from '../src/engine/types'
import { awardMove, initialEconomy, startGame } from '../src/economy/ledger'
import { FUN_STAR_CAP, starsForMove } from '../src/economy/rules'
import { greedyBot } from '../scripts/bot'

const FREE: JokerCharges = { cekic: 2, yenile: 2, dondur: 3 }
const NONE: JokerCharges = { cekic: 0, yenile: 0, dondur: 0 }

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`beklenmeyen geçersiz sonuç: ${JSON.stringify((r as { reason?: string }).reason)}`)
  return r as Extract<T, { ok: true }>
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}
const dot = (special?: PieceSpecial, color = 1): Piece => (special ? { shapeId: 'dot', color, special } : { shapeId: 'dot', color })
const BOMB: PieceSpecial = { kind: 'bomba', block: [0, 0] }
const lucky = (reward: LuckyReward): PieceSpecial => ({ kind: 'sansli', block: [0, 0], reward })
const STAR5: LuckyReward = { type: 'stars', amount: 5 }
const STAR10: LuckyReward = { type: 'stars', amount: 10 }

/** Özel bloklu Eğlence durumu: tahta, tepsi ve tahtadaki özel bloklar elle verilir. */
function funState(board: Board, tray: Array<Piece | null>, specials: BoardSpecial[] = [], free = FREE): GameState {
  const base = newGame(5, SHARED_SEQUENCE_CONFIG, { mode: 'eglence', freeJokers: free })
  return { ...base, board, tray: tray as unknown as Tray, specials }
}
const filled = (cells: number[], color = 2): Board => placeCells(emptyBoard(), cells, color)
const ev = <K extends GameEvent['type']>(events: readonly GameEvent[], type: K) =>
  events.filter((e): e is Extract<GameEvent, { type: K }> => e.type === type)
/** Tepsiyi her hamleden sonra tek karelerle doldurur (yeni üçlü üretimini atlamak için). */
const refill = (s: GameState): GameState => ({ ...s, tray: [dot(), dot(), dot()] as unknown as Tray })

// ---------------------------------------------------------------------------
describe('Aşama 8: Klasik ve sürümler değişmedi', () => {
  it('GENERATOR_VERSION 1; özel blok kural sürümü ayrı (FUN_RULES_VERSION 1)', () => {
    expect(GENERATOR_VERSION).toBe(1)
    expect(FUN_RULES_VERSION).toBe(1)
  })

  it('Klasik oyunda hiçbir zaman özel blok, özel alan ya da yeni olay yok (tam oyunlar)', () => {
    for (const seed of [1, 7, 42, 99, 2026]) {
      let s = newGame(seed)
      expect('specials' in s || 'funRulesVersion' in s).toBe(false)
      while (!s.gameOver) {
        const r = ok(play(s, greedyBot(s)!))
        for (const e of r.events) expect(['specialPlaced', 'bombTick', 'exploded', 'luckyReward', 'specialDefused']).not.toContain(e.type)
        s = r.state
        expect(s.tray.every((p) => p === null || p.special === undefined)).toBe(true)
        expect('specials' in s).toBe(false)
      }
    }
  })

  it('özel bloksuz Eğlence (specials: false) Aşama 8 öncesiyle aynı: alan ve özel blok yok', () => {
    const s = newGame(9, DEFAULT_CONFIG, { mode: 'eglence', specials: false })
    expect('specials' in s || 'funRulesVersion' in s).toBe(false)
    expect(s.tray.every((p) => p?.special === undefined)).toBe(true)
  })

  it('özel bloklu Eğlence: parça şekil/renk sırası Klasik ile aynı; yalnızca özel blok eklenir', () => {
    // Ortak sıra ayarı: kurtarma kapalı, üçlü tahtadan bağımsız → her üçlü generateTriple ile karşılaştırılabilir.
    for (const seed of [3, 42, 777]) {
      let s = newGame(seed, SHARED_SEQUENCE_CONFIG, { mode: 'eglence', freeJokers: NONE })
      expect(s.funRulesVersion).toBe(1)
      const strip = (t: Tray) => t.map((p) => (p ? { shapeId: p.shapeId, color: p.color } : null))
      expect(strip(s.tray)).toEqual(generateTriple(seed, 0, emptyBoard(), 0, SHARED_SEQUENCE_CONFIG).tray)
      let checked = 0
      while (!s.gameOver && s.moveCount < 300) {
        const move = greedyBot(s)
        if (!move) break
        const r = ok(play(s, move))
        for (const e of r.events) {
          if (e.type !== 'newTriple') continue
          expect(strip(e.tray)).toEqual(generateTriple(seed, e.tripleIndex, emptyBoard(), 0, SHARED_SEQUENCE_CONFIG).tray)
          checked++
        }
        s = r.state
      }
      expect(checked).toBeGreaterThan(5)
    }
  })
})

// ---------------------------------------------------------------------------
describe('özel blok üretimi', () => {
  const plain: Tray = [{ shapeId: 'l4-a', color: 1 }, { shapeId: 'h2', color: 2 }, { shapeId: 'sq3', color: 3 }]

  it('tepside en fazla 1 özel blok; oranlar bomba %12, şanslı %10 (10.000 tepsi)', () => {
    let bombs = 0
    let luckies = 0
    const rewards = { stars5: 0, stars10: 0, joker: 0 }
    const jokers = { dondur: 0, cekic: 0, yenile: 0 }
    for (let seed = 1; seed <= 2000; seed++) {
      for (let t = 0; t < 5; t++) {
        const tray = assignSpecials(seed, t, plain)
        const specials = tray.filter((p) => p?.special)
        expect(specials.length).toBeLessThanOrEqual(1)
        const sp = specials[0]?.special
        if (sp?.kind === 'bomba') bombs++
        if (sp?.kind === 'sansli') {
          luckies++
          const r = sp.reward!
          if (r.type === 'stars') rewards[r.amount === 5 ? 'stars5' : 'stars10']++
          else {
            rewards.joker++
            jokers[r.joker]++
          }
        }
      }
    }
    expect(BOMB_PER_MILLE).toBe(120)
    expect(LUCKY_PER_MILLE).toBe(100)
    expect(Math.abs(bombs / 10000 - 0.12)).toBeLessThan(0.01)
    expect(Math.abs(luckies / 10000 - 0.1)).toBeLessThan(0.01)
    expect(Math.abs(rewards.stars5 / luckies - 0.55)).toBeLessThan(0.05)
    expect(Math.abs(rewards.stars10 / luckies - 0.25)).toBeLessThan(0.05)
    expect(Math.abs(rewards.joker / luckies - 0.2)).toBeLessThan(0.05)
    expect(Math.abs(jokers.dondur / rewards.joker - 0.5)).toBeLessThan(0.1)
    expect(Math.abs(jokers.cekic / rewards.joker - 0.3)).toBeLessThan(0.1)
    expect(Math.abs(jokers.yenile / rewards.joker - 0.2)).toBeLessThan(0.1)
  })

  it('aynı tohum + aynı üçlü = aynı özel blok (deterministik); parçanın şekli ve rengi değişmez', () => {
    for (let t = 0; t < 30; t++) {
      expect(assignSpecials(42, t, plain)).toEqual(assignSpecials(42, t, plain))
      assignSpecials(42, t, plain).forEach((p, i) => expect({ shapeId: p!.shapeId, color: p!.color }).toEqual(plain[i]))
    }
  })

  it('özel blok her şekilde şeklin kendi bloklarından birinde (merkeze en yakın)', () => {
    for (const shape of SHAPES) {
      const [r, c] = centerBlock(shape)
      expect(shape.cells.some(([a, b]) => a === r && b === c)).toBe(true)
    }
    expect(centerBlock(getShape('sq3'))).toEqual([1, 1])
  })
})

// ---------------------------------------------------------------------------
describe('bombalı blok', () => {
  const ring = [18, 19, 20, 26, 28, 34, 35, 36] // (3,3)=27 çevresindeki 8 hücre

  it('yerleştiği hamle sayılmaz; sonraki 3 başarılı yerleştirmede 3×3 patlar, dolu hücre başına +1 puan', () => {
    let s = funState(filled(ring), [dot(BOMB), dot(), dot()])
    let r = ok(play(s, { slot: 0, row: 3, col: 3 }))
    expect(ev(r.events, 'specialPlaced')).toEqual([{ type: 'specialPlaced', kind: 'bomba', cell: 27, timer: BOMB_FUSE }])
    expect(ev(r.events, 'bombTick')).toEqual([])
    s = refill(r.state)
    const timers: number[] = []
    for (const col of [0, 2]) {
      r = ok(play(s, { slot: 0, row: 7, col }))
      timers.push(...ev(r.events, 'bombTick').flatMap((e) => e.bombs.map((b) => b.timer)))
      expect(ev(r.events, 'exploded')).toEqual([])
      s = refill(r.state)
    }
    expect(timers).toEqual([2, 1])
    const before = s.score
    r = ok(play(s, { slot: 0, row: 7, col: 4 }))
    const [boom] = ev(r.events, 'exploded')
    expect(boom!.bombs).toEqual([27])
    expect([...boom!.cells].sort((a, b) => a - b)).toEqual([18, 19, 20, 26, 27, 28, 34, 35, 36])
    expect(boom!.points).toBe(9)
    expect(r.state.score).toBe(before + 1 + 9) // yerleştirme 1 + patlama 9
    expect(boom!.score).toBe(r.state.score)
    for (const c of [18, 19, 20, 26, 27, 28, 34, 35, 36]) expect(r.state.board[c]).toBe(0)
    expect(r.state.specials).toEqual([])
    // Patlama hat değildir: temizleme olayı yok, kombo sıfır, hat yıldızı yok.
    expect(ev(r.events, 'cleared')).toEqual([])
    expect(r.state.combo).toBe(0)
    expect(starsForMove(r.events)).toBe(0)
  })

  it('joker kullanımı sayacı ilerletmez (yalnızca başarılı yerleştirme sayılır)', () => {
    let s = funState(filled([0]), [dot(BOMB), dot(), dot()])
    s = refill(ok(play(s, { slot: 0, row: 3, col: 3 })).state)
    s = ok(applyJoker(s, { type: 'cekic', cell: 0 })).state
    s = ok(applyJoker(s, { type: 'yenile' })).state
    expect(s.specials).toEqual([{ kind: 'bomba', cell: 27, timer: 3 }])
  })

  it('kenardaki bomba: alan tahta dışına taşmaz', () => {
    expect(blastArea(0).sort((a, b) => a - b)).toEqual([0, 1, 8, 9])
    expect(blastArea(63).sort((a, b) => a - b)).toEqual([54, 55, 62, 63])
  })

  it('satır/sütunla erken kaldırılan bomba hemen patlar; hat yıldızı yalnızca hattan, patlama ayrıca +1/hücre', () => {
    const row3 = [24, 25, 26, 28, 29, 30, 31] // (3,3) hariç satır 3
    const extra = [18, 20, 34, 36] // satır 2 ve 4'te alan içinde
    const s = funState(filled([...row3, ...extra]), [dot(BOMB), dot(), dot()])
    const r = ok(play(s, { slot: 0, row: 3, col: 3 }))
    const [line] = ev(r.events, 'cleared')
    expect(line!.rows).toEqual([3])
    const [boom] = ev(r.events, 'exploded')
    expect(boom!.bombs).toEqual([27])
    expect([...boom!.cells].sort((a, b) => a - b)).toEqual(extra) // satır 3 zaten hatla temizlendi
    expect(boom!.points).toBe(4)
    expect(starsForMove(r.events)).toBe(2) // yalnızca 1 hat → 2 yıldız
    expect(r.state.combo).toBe(1)
    expect(r.state.specials).toEqual([])
  })

  it('zincirleme patlama: alandaki bomba aynı hamlede patlar; her bomba bir kez, her hücre bir kez sayılır', () => {
    const board = filled([27, 28, 18, 19, 20, 21, 26, 29, 34, 35, 36, 37])
    const specials: BoardSpecial[] = [
      { kind: 'bomba', cell: 27, timer: 1 },
      { kind: 'bomba', cell: 28, timer: 3 },
    ]
    const r = ok(play(funState(board, [dot(), dot(), dot()], specials), { slot: 0, row: 7, col: 7 }))
    const booms = ev(r.events, 'exploded')
    expect(booms).toHaveLength(1)
    expect(booms[0]!.bombs).toEqual([27, 28])
    const cells = booms[0]!.cells
    expect(new Set(cells).size).toBe(cells.length)
    expect([...cells].sort((a, b) => a - b)).toEqual([18, 19, 20, 21, 26, 27, 28, 29, 34, 35, 36, 37])
    expect(booms[0]!.points).toBe(12)
    expect(r.state.specials).toEqual([])
    expect(ev(r.events, 'bombTick')).toEqual([]) // zincirde patlayan bomba "sayaç azaldı" diye bildirilmez
  })

  it('Çekiç bombayı söndürür: patlamaz', () => {
    let s = funState(filled([]), [dot(BOMB), dot(), dot()])
    s = refill(ok(play(s, { slot: 0, row: 3, col: 3 })).state)
    const h = ok(applyJoker(s, { type: 'cekic', cell: 27 }))
    expect(ev(h.events, 'specialDefused')).toEqual([{ type: 'specialDefused', kind: 'bomba', cell: 27 }])
    s = h.state
    for (const col of [0, 2, 4, 6]) {
      const r = ok(play(s, { slot: 0, row: 7, col }))
      expect(ev(r.events, 'exploded')).toEqual([])
      s = refill(r.state)
    }
    expect(s.specials).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('parlayan şanslı blok', () => {
  const row3 = [24, 25, 26, 28, 29, 30, 31]

  it('satır/sütunla kaldırılınca tek ödül (yıldız) verir; yıldız ekonomiye aynı hamlenin ödülüyle gider', () => {
    const r = ok(play(funState(filled(row3), [dot(lucky(STAR10)), dot(), dot()]), { slot: 0, row: 3, col: 3 }))
    expect(ev(r.events, 'luckyReward')).toEqual([{ type: 'luckyReward', cell: 27, reward: STAR10, cause: 'line' }])
    expect(starsForMove(r.events)).toBe(2 + 10)
    expect(r.state.specials).toEqual([])
  })

  it('bomba patlamasıyla kaldırılınca ödül (cause: bomb); hat + patlama aynı hamlede olsa da tek ödül', () => {
    const board = filled([...row3, 19])
    const specials: BoardSpecial[] = [
      { kind: 'bomba', cell: 26, timer: 3 }, // satır 3'te: hatla erken patlar
      { kind: 'sansli', cell: 19, reward: STAR5 }, // patlama alanında
      { kind: 'sansli', cell: 25, reward: STAR10 }, // hem hatta hem alanda: yalnızca bir kez
    ]
    const r = ok(play(funState(board, [dot(), dot(), dot()], specials), { slot: 0, row: 3, col: 3 }))
    const rewards = ev(r.events, 'luckyReward')
    expect(rewards).toHaveLength(2)
    expect(rewards.find((e) => e.cell === 25)!.cause).toBe('line')
    expect(rewards.find((e) => e.cell === 19)!.cause).toBe('bomb')
    expect(starsForMove(r.events)).toBe(2 + 5 + 10)
  })

  it('+1 ücretsiz joker: bu oyunun ücretsiz hakkına eklenir, kalıcı envanter (inventory) değişmez', () => {
    const s = funState(filled(row3), [dot(lucky({ type: 'joker', joker: 'cekic' })), dot(), dot()], [], NONE)
    const r = ok(play(s, { slot: 0, row: 3, col: 3 }))
    expect(r.state.jokers!.free).toEqual({ cekic: 1, yenile: 0, dondur: 0 })
    expect(r.state.jokers!.inventory).toEqual(s.jokers!.inventory)
    expect(starsForMove(r.events)).toBe(2) // joker ödülü yıldız değil
  })

  it('Çekiçle kaldırılınca ödül vermez', () => {
    let s = funState(filled([]), [dot(lucky(STAR10)), dot(), dot()])
    s = ok(play(s, { slot: 0, row: 3, col: 3 })).state
    const h = ok(applyJoker(s, { type: 'cekic', cell: 27 }))
    expect(ev(h.events, 'luckyReward')).toEqual([])
    expect(ev(h.events, 'specialDefused')).toEqual([{ type: 'specialDefused', kind: 'sansli', cell: 27 }])
    expect(h.state.specials).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('jokerlerle birlikte', () => {
  it('Döndür: özel blok aynı fiziksel blokta kalır (her döndürülebilir şekil, 4 tur)', () => {
    for (const shape of SHAPES) {
      if (rotateShapeId(shape.id) === shape.id) continue
      for (const block of shape.cells) {
        let id = shape.id
        let sp: PieceSpecial = { kind: 'bomba', block: [block[0], block[1]] }
        for (let k = 0; k < 4; k++) {
          sp = rotateSpecial(sp, getShape(id))
          id = rotateShapeId(id)
          expect(getShape(id).cells.some(([r, c]) => r === sp.block[0] && c === sp.block[1])).toBe(true)
        }
        expect(id).toBe(shape.id)
        expect(sp.block).toEqual([block[0], block[1]])
      }
    }
  })

  it('Döndür jokeri tepsideki özel bloğu taşır', () => {
    const s = funState(emptyBoard(), [{ shapeId: 'h3', color: 1, special: { kind: 'bomba', block: [0, 0] } }, dot(), dot()])
    const r = ok(applyJoker(s, { type: 'dondur', slot: 0 }))
    expect(r.state.tray[0]).toEqual({ shapeId: rotateShapeId('h3'), color: 1, special: { kind: 'bomba', block: [0, 0] } })
  })

  it('Yenile: yuvadaki özel blok yeni parçaya geçer; özel bloksuz yuvalar eskisi gibi', () => {
    const s = funState(emptyBoard(), [dot(lucky(STAR5)), dot(), null])
    const r = ok(applyJoker(s, { type: 'yenile' }))
    const [a, b] = r.state.tray
    expect(a!.special?.kind).toBe('sansli')
    expect(a!.special?.reward).toEqual(STAR5)
    expect(centerBlock(getShape(a!.shapeId))).toEqual(a!.special!.block)
    expect(b!.special).toBe(undefined)
  })
})

// ---------------------------------------------------------------------------
describe('belirlenim ve bütünlük', () => {
  function playFun(seed: number): { state: GameState; log: GameEvent[][] } {
    let s = newGame(seed, DEFAULT_CONFIG, { mode: 'eglence', freeJokers: NONE })
    const log: GameEvent[][] = []
    while (!s.gameOver && s.moveCount < 400) {
      const move = greedyBot(s)
      if (!move) break
      const r = ok(play(s, move))
      log.push([...r.events])
      s = r.state
    }
    return { state: s, log }
  }

  it('aynı seed + aynı hamleler = aynı oyun (özel bloklarla); JSON\'dan geri yüklenen durum aynı devam eder', () => {
    for (const seed of [4, 42, 1234]) {
      expect(fingerprint(playFun(seed).state)).toBe(fingerprint(playFun(seed).state))
    }
    let s = newGame(8, DEFAULT_CONFIG, { mode: 'eglence' })
    for (let i = 0; i < 12 && !s.gameOver; i++) s = ok(play(s, greedyBot(s)!)).state
    const restored = JSON.parse(JSON.stringify(s)) as GameState
    const m = greedyBot(s)!
    expect(fingerprint(ok(play(restored, m)).state)).toBe(fingerprint(ok(play(s, m)).state))
  })

  it('gerçek oyunlarda özel bloklar oluşur ve kurallar tutarlı: puan = olayların toplamı, şanslı ödül tek', () => {
    let explosions = 0
    let luckyCount = 0
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { state, log } = playFun(seed)
      let score = 0
      const rewardedCells = new Set<string>()
      log.forEach((events, move) => {
        for (const e of events) {
          if (e.type === 'scored') score = e.score
          if (e.type === 'exploded') {
            expect(e.score).toBe(score + e.points)
            score = e.score
            expect(new Set(e.bombs).size).toBe(e.bombs.length)
            expect(new Set(e.cells).size).toBe(e.cells.length)
            explosions++
          }
          if (e.type === 'luckyReward') {
            const key = `${move}:${e.cell}`
            expect(rewardedCells.has(key)).toBe(false)
            rewardedCells.add(key)
            luckyCount++
          }
        }
      })
      expect(score).toBe(state.score)
      // Tahtadaki her özel blok dolu bir hücrede; hücre başına en fazla bir özel blok.
      for (const sp of state.specials ?? []) expect(state.board[sp.cell]).not.toBe(0)
      expect(new Set((state.specials ?? []).map((sp) => sp.cell)).size).toBe((state.specials ?? []).length)
    }
    expect(explosions).toBeGreaterThan(0)
    expect(luckyCount).toBeGreaterThan(0)
  })

  it('hamle eski durumu değiştirmez (dondurulmuş durum + özel bloklar)', () => {
    const s = deepFreeze(funState(filled([24, 25, 26, 28, 29, 30, 31]), [dot(BOMB), dot(), dot()], [{ kind: 'sansli', cell: 24, reward: STAR5 }]))
    const before = JSON.stringify(s)
    ok(play(s, { slot: 0, row: 3, col: 3 }))
    expect(JSON.stringify(s)).toBe(before)
  })

  it('cellIndex ile bomba hücresi tutarlı', () => {
    expect(cellIndex(3, 3)).toBe(27)
  })
})

// ---------------------------------------------------------------------------
describe('ekonomi: şanslı yıldız tek yoldan, tavan korunur', () => {
  const luckyEvents: GameEvent[] = [{ type: 'luckyReward', cell: 1, reward: STAR10, cause: 'line' }]

  it('aynı hamle iki kez ödüllendirilmez', () => {
    let e = ok(startGame(initialEconomy(), 'g', 'eglence')).state
    const first = awardMove(e, 'g', 1, luckyEvents)
    expect(first.ok && first.stars).toBe(10)
    e = ok(first).state
    expect(awardMove(e, 'g', 1, luckyEvents).ok).toBe(false)
  })

  it('Eğlence 300 tavanı şanslı yıldızı da kapsar', () => {
    let e = ok(startGame(initialEconomy(), 'g', 'eglence')).state
    let total = 0
    for (let m = 1; m <= 40; m++) {
      const r = ok(awardMove(e, 'g', m, luckyEvents))
      total += r.stars
      e = r.state
    }
    expect(total).toBe(FUN_STAR_CAP)
  })

  it('Klasik olaylarında şanslı ödül yok: hat yıldızı kuralları aynen', () => {
    const cleared: GameEvent = { type: 'cleared', rows: [0], cols: [], cells: [] }
    expect(starsForMove([cleared])).toBe(2)
    expect(starsForMove([])).toBe(0)
  })
})
