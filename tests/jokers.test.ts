import { describe, expect, it } from 'vitest'
import { canPlaceAnywhere, cellIndex, emptyBoard, placeCells } from '../src/engine/board'
import { DEFAULT_CONFIG, SHARED_SEQUENCE_CONFIG, generateTriple } from '../src/engine/generator'
import { fingerprint, newGame, play, type GameOptions } from '../src/engine/game'
import {
  DEFAULT_FREE_JOKERS,
  NO_JOKERS,
  applyJoker,
  canRescue,
  giveUp,
  grantJokers,
  isRotatable,
  orientationsOf,
  refreshTray,
  rotateShapeId,
  validateCharges,
} from '../src/engine/jokers'
import { createRng, type Rng } from '../src/engine/rng'
import { SHAPES, getShape } from '../src/engine/shapes'
import type { Board, GameState, JokerAction, JokerCharges, Move, Piece, Tray } from '../src/engine/types'
import { greedyBot, jokerRescueAction } from '../scripts/bot'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}

const fun = (free: JokerCharges = DEFAULT_FREE_JOKERS, inventory: JokerCharges = NO_JOKERS): GameOptions => ({
  mode: 'eglence',
  freeJokers: free,
  inventory,
})

function withTray(state: GameState, ids: (string | null)[], color = 1): GameState {
  return { ...state, tray: ids.map((id) => (id ? { shapeId: id, color } : null)) as unknown as Tray }
}

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`beklenmeyen geçersiz sonuç: ${JSON.stringify((r as { reason?: string }).reason)}`)
  return r as Extract<T, { ok: true }>
}

/** Satranç tahtası: (satır+sütun) çift olan hücreler dolu. Hiçbir 2+ blokluk parça sığmaz. */
function checkerboard(): Board {
  const cells: number[] = []
  for (let i = 0; i < 64; i++) if ((Math.floor(i / 8) + (i % 8)) % 2 === 0) cells.push(i)
  return placeCells(emptyBoard(), cells, 3)
}

const trayFits = (board: Board, tray: Tray) => tray.some((p) => p !== null && canPlaceAnywhere(board, getShape(p.shapeId)))

/**
 * Bağımsız kaba kuvvet: motorun kurtuluş analizini kullanmadan, eldeki haklarla yapılabilecek
 * BÜTÜN joker dizilerini dener (Çekiç her dolu hücreye, Döndür her yuvaya, Yenile).
 * Herhangi bir dizinin sonunda bir parça sığıyorsa true.
 */
function bruteForceRescue(start: GameState): boolean {
  interface Node {
    board: Board
    tray: Tray
    cekic: number
    yenile: number
    dondur: number
    paid: readonly boolean[]
    refreshCount: number
  }
  const w = start.jokers!
  const root: Node = {
    board: start.board,
    tray: start.tray,
    cekic: w.free.cekic + w.inventory.cekic,
    yenile: w.free.yenile + w.inventory.yenile,
    dondur: w.free.dondur + w.inventory.dondur,
    paid: start.rotatePaid,
    refreshCount: start.refreshCount,
  }
  const seen = new Set<string>()
  const stack: Node[] = [root]
  while (stack.length > 0) {
    const n = stack.pop()!
    const key = JSON.stringify(n)
    if (seen.has(key)) continue
    seen.add(key)
    if (trayFits(n.board, n.tray)) return true
    if (n.cekic > 0) {
      for (let i = 0; i < 64; i++) {
        if (n.board[i] === 0) continue
        const board = n.board.slice()
        board[i] = 0
        stack.push({ ...n, board, cekic: n.cekic - 1 })
      }
    }
    for (const slot of [0, 1, 2] as const) {
      const p = n.tray[slot]
      if (!p || (!n.paid[slot] && n.dondur === 0)) continue
      const tray = [...n.tray] as Array<Piece | null>
      tray[slot] = { ...p, shapeId: rotateShapeId(p.shapeId) }
      const paid = [...n.paid]
      paid[slot] = true
      stack.push({ ...n, tray: tray as unknown as Tray, paid, dondur: n.paid[slot] ? n.dondur : n.dondur - 1 })
    }
    if (n.yenile > 0) {
      const r = refreshTray({ ...start, board: n.board, tray: n.tray, refreshCount: n.refreshCount })
      const paid = [...n.paid]
      for (const s of r.slots) paid[s] = false
      stack.push({ ...n, tray: r.tray, yenile: n.yenile - 1, paid, refreshCount: n.refreshCount + 1 })
    }
  }
  return false
}

describe('Klasik Mod değişmedi', () => {
  it('varsayılan mod Klasik, joker yok, joker kullanılamaz', () => {
    const s = newGame(1)
    expect(s.mode).toBe('klasik')
    expect(s.jokers).toBe(null)
    expect(s.stuck).toBe(false)
    expect(applyJoker(s, { type: 'yenile' })).toMatchObject({ ok: false, reason: 'notFunMode' })
  })

  it('Klasik oyunlar hiç "sıkıştı" durumuna girmez; oyun sonu eski kuralla', () => {
    for (const seed of [3, 11, 42]) {
      let s = newGame(seed)
      while (!s.gameOver) {
        const r = ok(play(s, greedyBot(s)!))
        expect(r.events.some((e) => e.type === 'stuck')).toBe(false)
        s = r.state
      }
      expect(s.stuck).toBe(false)
    }
  })

  it('jokersiz Eğlence oyunu, Klasik ile hamle hamle aynı tahta, parça ve skoru verir', () => {
    for (const seed of [1, 7, 42, 99]) {
      let a = newGame(seed)
      let b = newGame(seed, DEFAULT_CONFIG, fun(NO_JOKERS))
      while (!a.gameOver) {
        const move = greedyBot(a)!
        expect(greedyBot(b)).toEqual(move)
        a = ok(play(a, move)).state
        b = ok(play(b, move)).state
        expect(b.board).toEqual(a.board)
        expect(b.tray).toEqual(a.tray)
        expect(b.score).toBe(a.score)
        expect(b.combo).toBe(a.combo)
        expect(b.gameOver).toBe(a.gameOver)
      }
      expect(b.gameOver).toBe(true)
    }
  })
})

describe('haklar ve envanter', () => {
  it('Eğlence varsayılan hakları 2/2/3, envanter 0', () => {
    const s = newGame(1, DEFAULT_CONFIG, { mode: 'eglence' })
    expect(s.jokers).toEqual({ free: { cekic: 2, yenile: 2, dondur: 3 }, inventory: NO_JOKERS })
  })

  it('önce ücretsiz haklar, bitince envanter harcanır; kaynak olayla bildirilir', () => {
    let s = newGame(5, DEFAULT_CONFIG, fun({ cekic: 0, yenile: 1, dondur: 0 }, { cekic: 0, yenile: 2, dondur: 0 }))
    const r1 = ok(applyJoker(s, { type: 'yenile' }))
    expect(r1.events[0]).toEqual({ type: 'jokerUsed', joker: 'yenile', source: 'free' })
    s = r1.state
    const r2 = ok(applyJoker(s, { type: 'yenile' }))
    expect(r2.events[0]).toEqual({ type: 'jokerUsed', joker: 'yenile', source: 'inventory' })
    expect(r2.state.jokers).toEqual({ free: NO_JOKERS, inventory: { cekic: 0, yenile: 1, dondur: 0 } })
  })

  it('grantJokers saf toplama yapar; geçersiz hak reddedilir', () => {
    const base = { cekic: 1, yenile: 0, dondur: 2 }
    expect(grantJokers(base, { yenile: 3 })).toEqual({ cekic: 1, yenile: 3, dondur: 2 })
    expect(base).toEqual({ cekic: 1, yenile: 0, dondur: 2 })
    expect(() => validateCharges({ cekic: -1, yenile: 0, dondur: 0 })).toThrow()
    expect(() => newGame(1, DEFAULT_CONFIG, fun({ cekic: 1.5, yenile: 0, dondur: 0 }))).toThrow()
  })
})

describe('Döndür', () => {
  it('katalogdaki her şeklin döndürülmüş hâli katalogda; 4 dönüş başa döner', () => {
    for (const shape of SHAPES) {
      const once = getShape(rotateShapeId(shape.id))
      expect(once.cells.length).toBe(shape.cells.length)
      expect(once.width).toBe(shape.height)
      let id = shape.id
      for (let i = 0; i < 4; i++) id = rotateShapeId(id)
      expect(id).toBe(shape.id)
    }
    expect(SHAPES.filter((s) => !isRotatable(s.id)).map((s) => s.id)).toEqual(['dot', 'sq2', 'sq3'])
    expect(rotateShapeId('h2')).toBe('v2')
    expect(orientationsOf('l4-a')).toEqual(['l4-a', 'l4-b', 'l4-c', 'l4-d'])
    expect(orientationsOf('t4-up')).toEqual(['t4-up', 't4-right', 't4-down', 't4-left'])
  })

  it('ilk dönüş 1 hak harcar, aynı parça yerleşene kadar sonrakiler ücretsiz; renk korunur', () => {
    let s = withTray(newGame(1, DEFAULT_CONFIG, fun({ cekic: 0, yenile: 0, dondur: 2 })), ['l4-a', 'h3', 'dot'], 4)
    const r1 = ok(applyJoker(s, { type: 'dondur', slot: 0 }))
    expect(r1.state.tray[0]).toEqual({ shapeId: 'l4-b', color: 4 })
    expect(r1.state.jokers!.free.dondur).toBe(1)
    expect(r1.events.map((e) => e.type)).toEqual(['jokerUsed', 'rotated'])
    s = r1.state
    for (const expected of ['l4-c', 'l4-d', 'l4-a']) {
      const r = ok(applyJoker(s, { type: 'dondur', slot: 0 }))
      expect(r.state.tray[0]!.shapeId).toBe(expected)
      expect(r.events.map((e) => e.type)).toEqual(['rotated'])
      s = r.state
    }
    expect(s.jokers!.free.dondur).toBe(1)
    // Parça yerleşince ödeme düşer; başka yuvadaki ilk dönüş yine hak ister.
    s = ok(play(s, { slot: 0, row: 0, col: 0 })).state
    expect(s.rotatePaid).toEqual([false, false, false])
    const r2 = ok(applyJoker(s, { type: 'dondur', slot: 1 }))
    expect(r2.state.jokers!.free.dondur).toBe(0)
  })

  it('dönmeyen şekil, boş yuva ve hak yokken reddedilir; hak harcanmaz', () => {
    const s = withTray(newGame(1, DEFAULT_CONFIG, fun({ cekic: 0, yenile: 0, dondur: 1 })), ['sq2', null, 'h2'])
    expect(applyJoker(s, { type: 'dondur', slot: 0 })).toMatchObject({ ok: false, reason: 'notRotatable' })
    expect(applyJoker(s, { type: 'dondur', slot: 1 })).toMatchObject({ ok: false, reason: 'emptySlot' })
    const none = { ...s, jokers: { free: NO_JOKERS, inventory: NO_JOKERS } }
    expect(applyJoker(none, { type: 'dondur', slot: 2 })).toMatchObject({ ok: false, reason: 'noCharge' })
  })
})

describe('Çekiç', () => {
  it('dolu hücreyi boşaltır; puan, kombo ve üçlü değişmez', () => {
    const base = newGame(1, DEFAULT_CONFIG, fun())
    const s = { ...base, board: placeCells(base.board, [cellIndex(3, 4)], 5), score: 120, combo: 2 }
    const r = ok(applyJoker(s, { type: 'cekic', cell: cellIndex(3, 4) }))
    expect(r.state.board.every((c) => c === 0)).toBe(true)
    expect(r.state.score).toBe(120)
    expect(r.state.combo).toBe(2)
    expect(r.state.tripleIndex).toBe(s.tripleIndex)
    expect(r.state.moveCount).toBe(s.moveCount)
    expect(r.state.jokers!.free.cekic).toBe(1)
    expect(r.events).toEqual([
      { type: 'jokerUsed', joker: 'cekic', source: 'free' },
      { type: 'hammered', cell: cellIndex(3, 4), color: 5 },
    ])
  })

  it('boş hücre ve tahta dışı reddedilir; hak harcanmaz', () => {
    const s = newGame(1, DEFAULT_CONFIG, fun())
    expect(applyJoker(s, { type: 'cekic', cell: 0 })).toMatchObject({ ok: false, reason: 'emptyCell' })
    expect(applyJoker(s, { type: 'cekic', cell: 64 })).toMatchObject({ ok: false, reason: 'badCell' })
    expect(applyJoker(s, { type: 'cekic', cell: 2.5 })).toMatchObject({ ok: false, reason: 'badCell' })
  })
})

describe('Yenile', () => {
  it('yalnızca dolu yuvaları değiştirir; puan, kombo, üçlü numarası aynı kalır', () => {
    const s = { ...withTray(newGame(8, DEFAULT_CONFIG, fun()), ['h2', null, 'v3']), combo: 3, score: 50 }
    const r = ok(applyJoker(s, { type: 'yenile' }))
    expect(r.state.tray[1]).toBe(null)
    expect(r.state.tray[0]).not.toBe(null)
    expect(r.state.tray[2]).not.toBe(null)
    expect(r.state.score).toBe(50)
    expect(r.state.combo).toBe(3)
    expect(r.state.tripleIndex).toBe(s.tripleIndex)
    expect(r.state.refreshCount).toBe(1)
    expect(r.events[1]).toMatchObject({ type: 'refreshed', slots: [0, 2] })
  })

  it('aynı durum her zaman aynı sonucu verir; ikinci Yenile farklı akış kullanır', () => {
    const s = newGame(1234, DEFAULT_CONFIG, fun())
    const a = ok(applyJoker(s, { type: 'yenile' }))
    const b = ok(applyJoker(s, { type: 'yenile' }))
    expect(a.state.tray).toEqual(b.state.tray)
    expect(fingerprint(a.state)).toBe(fingerprint(b.state))
    let differs = 0
    for (let seed = 1; seed <= 30; seed++) {
      const g = newGame(seed, DEFAULT_CONFIG, fun())
      const first = ok(applyJoker(g, { type: 'yenile' })).state
      const second = ok(applyJoker(first, { type: 'yenile' })).state
      if (JSON.stringify(first.tray) !== JSON.stringify(second.tray)) differs++
    }
    expect(differs).toBeGreaterThan(25)
  })

  it('boş hücre varsa en az bir yeni parça sığar (çok dolu ve tek boşluklu tahtalar)', () => {
    const rng = createRng(2026)
    for (let t = 0; t < 400; t++) {
      // 1 ile 40 arası boş hücre bırakılmış rastgele tahtalar (satır/sütun dolu olabilir; analiz için önemsiz).
      const empties = 1 + rng.nextInt(40)
      const order = Array.from({ length: 64 }, (_, i) => i)
      for (let i = 63; i > 0; i--) {
        const j = rng.nextInt(i + 1)
        ;[order[i], order[j]] = [order[j]!, order[i]!]
      }
      const board = placeCells(emptyBoard(), order.slice(empties), 2)
      const slotsUsed = 1 + rng.nextInt(3)
      const ids = ['h5', 'sq3', 'c5-tl'].map((id, i) => (i < slotsUsed ? id : null))
      const s = { ...withTray(newGame(t, DEFAULT_CONFIG, fun()), ids), board, tripleIndex: rng.nextInt(50) }
      const r = refreshTray(s)
      expect(trayFits(board, r.tray)).toBe(true)
    }
    // Tek boş hücre: sığabilecek tek şekil 1×1.
    const one = placeCells(emptyBoard(), Array.from({ length: 63 }, (_, i) => i + 1), 4)
    const r = refreshTray({ ...newGame(9, DEFAULT_CONFIG, fun()), board: one })
    expect(r.tray.some((p) => p?.shapeId === 'dot')).toBe(true)
  })

  it('normal parça sırasını kaydırmaz (ortak sıra ayarında sonraki üçlü Klasik ile aynı)', () => {
    for (const seed of [2, 31, 500]) {
      let s = withTray(newGame(seed, SHARED_SEQUENCE_CONFIG, fun()), ['dot', 'dot', 'dot'])
      s = ok(applyJoker(s, { type: 'yenile' })).state
      s = withTray(s, ['dot', 'dot', 'dot'])
      for (const slot of [0, 1, 2] as const) s = ok(play(s, { slot, row: 0, col: slot * 2 })).state
      const expected = generateTriple(seed, 1, s.board, s.score, SHARED_SEQUENCE_CONFIG).tray
      expect(s.tray).toEqual(expected)
      expect(s.tripleIndex).toBe(1)
    }
  })
})

describe('oyun sonu: sayıya değil gerçek kurtuluşa bakar', () => {
  const stuckState = (free: JokerCharges, ids: (string | null)[]) =>
    withTray({ ...newGame(1, DEFAULT_CONFIG, fun(free)), board: checkerboard() }, ids)

  it('hak var ama hiçbiri işe yaramıyorsa oyun biter', () => {
    // h2 döndürülse de (v2) satranç tahtasına sığmaz; tek Döndür hakkı kurtaramaz.
    const s = stuckState({ cekic: 0, yenile: 0, dondur: 3 }, ['h2', 'sq2', null])
    expect(canRescue(s)).toBe(false)
    expect(bruteForceRescue(s)).toBe(false)
  })

  it('tek Çekiç h2 için yeter; sq2 için 2 Çekiç gerekir', () => {
    expect(canRescue(stuckState({ cekic: 1, yenile: 0, dondur: 0 }, ['h2', null, null]))).toBe(true)
    expect(canRescue(stuckState({ cekic: 1, yenile: 0, dondur: 0 }, ['sq2', null, null]))).toBe(false)
    expect(canRescue(stuckState({ cekic: 2, yenile: 0, dondur: 0 }, ['sq2', null, null]))).toBe(true)
    expect(canRescue(stuckState({ cekic: 0, yenile: 1, dondur: 0 }, ['sq2', null, null]))).toBe(true)
  })

  it('hamleden sonra: kurtuluş varsa "sıkıştı", yoksa oyun biter', () => {
    // Satranç tahtasında 1×1 bir boşluğa konur; kalan h2 hiçbir yere sığmaz.
    const board = checkerboard()
    const base = { ...newGame(1, DEFAULT_CONFIG, fun({ cekic: 0, yenile: 0, dondur: 1 })), board }
    const s = withTray(base, ['dot', 'h2', null])
    const r = ok(play(s, { slot: 0, row: 7, col: 6 }))
    // Kalan h2: dönse de sığmaz, Çekiç yok → oyun biter.
    expect(r.state.gameOver).toBe(true)
    expect(r.events.at(-1)).toMatchObject({ type: 'gameOver' })

    const withHammer = { ...s, jokers: { free: { cekic: 1, yenile: 0, dondur: 0 }, inventory: NO_JOKERS } }
    const r2 = ok(play(withHammer, { slot: 0, row: 7, col: 6 }))
    expect(r2.state.gameOver).toBe(false)
    expect(r2.state.stuck).toBe(true)
    expect(r2.events.at(-1)).toEqual({ type: 'stuck' })
  })

  it('boşa giden son Çekiç oyunu bitirir', () => {
    // sq2 için 2 Çekiç gerekir; iki vuruş birbirinden uzak hücrelere yapılırsa kurtuluş kalmaz.
    let s = { ...stuckState({ cekic: 2, yenile: 0, dondur: 0 }, ['sq2', null, null]), stuck: true }
    const r1 = ok(applyJoker(s, { type: 'cekic', cell: cellIndex(0, 0) }))
    expect(r1.state.stuck).toBe(true)
    expect(r1.state.gameOver).toBe(false)
    s = r1.state
    const r2 = ok(applyJoker(s, { type: 'cekic', cell: cellIndex(7, 7) }))
    expect(r2.state.gameOver).toBe(true)
    expect(r2.events.at(-1)).toMatchObject({ type: 'gameOver' })
  })

  it('Bitir: sıkışınca oyuncu oyunu sonlandırabilir', () => {
    const s = { ...stuckState({ cekic: 1, yenile: 0, dondur: 0 }, ['h2', null, null]), stuck: true }
    const r = ok(giveUp(s))
    expect(r.state.gameOver).toBe(true)
    expect(r.state.stuck).toBe(false)
    expect(r.events).toEqual([{ type: 'gameOver', score: s.score }])
    expect(giveUp(r.state)).toMatchObject({ ok: false, reason: 'gameOver' })
  })

  it('döndürme kazara oyunu bitirmez (ödenmiş yuva ücretsiz geri döndürülebilir)', () => {
    // Yalnız dikey 2'lik boşluk: v2 sığar, h2 sığmaz.
    const board = placeCells(emptyBoard(), Array.from({ length: 64 }, (_, i) => i).filter((i) => i !== 0 && i !== 8), 1)
    const s = withTray({ ...newGame(1, DEFAULT_CONFIG, fun({ cekic: 0, yenile: 0, dondur: 1 })), board }, ['v2', null, null])
    const r = ok(applyJoker(s, { type: 'dondur', slot: 0 }))
    expect(r.state.tray[0]!.shapeId).toBe('h2')
    expect(r.state.gameOver).toBe(false)
    expect(r.state.stuck).toBe(true)
    const back = ok(applyJoker(r.state, { type: 'dondur', slot: 0 }))
    expect(back.state.stuck).toBe(false)
    expect(back.state.jokers!.free.dondur).toBe(0)
  })

  it('oyun boyunca: "sıkıştı" her zaman kaba kuvvetle kurtarılabilir, "oyun bitti" hiçbir zaman', () => {
    const configs: JokerCharges[] = [
      { cekic: 2, yenile: 0, dondur: 1 },
      { cekic: 1, yenile: 0, dondur: 2 },
      { cekic: 0, yenile: 0, dondur: 3 },
      { cekic: 2, yenile: 1, dondur: 1 },
    ]
    let stuckSeen = 0
    let endsWithCharges = 0
    for (const free of configs) {
      for (let seed = 1; seed <= 12; seed++) {
        const rng = createRng(seed * 7919)
        let s = newGame(seed, DEFAULT_CONFIG, fun(free))
        let steps = 0
        while (!s.gameOver && steps++ < 400) {
          const action = s.stuck ? pickJoker(s, rng) : null
          const r = action ? ok(applyJoker(s, action)) : ok(play(s, greedyBot(s)!))
          s = r.state
          if (s.stuck) {
            stuckSeen++
            expect(trayFits(s.board, s.tray)).toBe(false)
            expect(bruteForceRescue(s)).toBe(true)
          }
          if (s.gameOver) {
            const w = s.jokers!
            if (w.free.cekic + w.free.yenile + w.free.dondur > 0) endsWithCharges++
            expect(bruteForceRescue({ ...s, gameOver: false })).toBe(false)
          }
        }
      }
    }
    // Test gerçekten iki durumu da gördü.
    expect(stuckSeen).toBeGreaterThan(10)
    expect(endsWithCharges).toBeGreaterThan(3)
  }, 30_000)
})

/** Sıkışınca: bazen akıllı kurtarma, bazen rastgele (boşa gidebilecek) bir joker. */
function pickJoker(s: GameState, rng: Rng): JokerAction {
  if (rng.nextInt(2) === 0) {
    const smart = jokerRescueAction(s)
    if (smart) return smart
  }
  const options: JokerAction[] = []
  const w = s.jokers!
  if (w.free.cekic + w.inventory.cekic > 0) {
    for (let i = 0; i < 64; i++) if (s.board[i] !== 0) options.push({ type: 'cekic', cell: i })
  }
  if (w.free.yenile + w.inventory.yenile > 0) options.push({ type: 'yenile' })
  for (const slot of [0, 1, 2] as const) {
    const p = s.tray[slot]
    if (p && isRotatable(p.shapeId) && (s.rotatePaid[slot] || w.free.dondur + w.inventory.dondur > 0)) {
      options.push({ type: 'dondur', slot })
    }
  }
  return options[rng.nextInt(options.length)]!
}

describe('belirlenim ve saflık', () => {
  function playFun(seed: number, log?: Array<{ move: Move } | { joker: JokerAction }>): GameState {
    let s = newGame(seed, DEFAULT_CONFIG, fun())
    let steps = 0
    while (!s.gameOver && steps++ < 600) {
      // Ara sıra sıkışmadan da joker kullan (Yenile/Döndür), sonra normal oyna.
      if (steps % 9 === 0 && s.jokers!.free.yenile > 0) {
        const action: JokerAction = { type: 'yenile' }
        log?.push({ joker: action })
        s = ok(applyJoker(s, action)).state
        continue
      }
      const action = jokerRescueAction(s)
      if (action) {
        log?.push({ joker: action })
        s = ok(applyJoker(s, action)).state
        continue
      }
      const move = greedyBot(s)!
      log?.push({ move })
      s = ok(play(s, move)).state
    }
    return s
  }

  it('aynı seed + aynı hamleler + aynı jokerler = aynı oyun', () => {
    for (const seed of [4, 42]) {
      const log: Array<{ move: Move } | { joker: JokerAction }> = []
      const a = playFun(seed, log)
      expect(log.some((x) => 'joker' in x)).toBe(true)
      let b = newGame(seed, DEFAULT_CONFIG, fun())
      for (const step of log) b = ok('move' in step ? play(b, step.move) : applyJoker(b, step.joker)).state
      expect(fingerprint(b)).toBe(fingerprint(a))
      expect(fingerprint(playFun(seed))).toBe(fingerprint(a))
    }
  })

  it('JSON olarak kaydedilip geri yüklenen jokerli oyun aynı devam eder', () => {
    const s = newGame(77, DEFAULT_CONFIG, fun())
    const restored = JSON.parse(JSON.stringify(s)) as GameState
    const a = ok(applyJoker(s, { type: 'yenile' })).state
    const b = ok(applyJoker(restored, { type: 'yenile' })).state
    expect(fingerprint(a)).toBe(fingerprint(b))
  })

  it('joker hamleleri dondurulmuş durumu değiştirmez', () => {
    const base = newGame(3, DEFAULT_CONFIG, fun())
    const s = deepFreeze(withTray({ ...base, board: placeCells(base.board, [5], 2) }, ['l4-a', 'h2', 'dot']))
    const before = JSON.stringify(s)
    const actions: JokerAction[] = [{ type: 'cekic', cell: 5 }, { type: 'yenile' }, { type: 'dondur', slot: 0 }]
    for (const action of actions) expect(() => applyJoker(s, action)).not.toThrow()
    expect(JSON.stringify(s)).toBe(before)
  })

  it('oyun bitince joker kullanılamaz', () => {
    const s = { ...newGame(1, DEFAULT_CONFIG, fun()), gameOver: true }
    expect(applyJoker(s, { type: 'yenile' })).toMatchObject({ ok: false, reason: 'gameOver' })
  })
})
