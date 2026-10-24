import { describe, expect, it } from 'vitest'
import { cellIndex, placeCells } from '../src/engine/board'
import { DEFAULT_CONFIG, GENERATOR_VERSION } from '../src/engine/generator'
import { fingerprint, isStuck, newGame, play } from '../src/engine/game'
import { getShape } from '../src/engine/shapes'
import type { GameState, Slot, Tray } from '../src/engine/types'
import { greedyBot } from '../scripts/bot'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}

/** Testler için elle tepsi kurar. */
function withTray(state: GameState, ids: (string | null)[]): GameState {
  const tray = ids.map((id) => (id ? { shapeId: id, color: 1 } : null)) as unknown as Tray
  return { ...state, tray }
}

function playOut(seed: number, maxMoves: number): GameState {
  let state = newGame(seed)
  while (!state.gameOver && state.moveCount < maxMoves) {
    const move = greedyBot(state)
    if (!move) break
    const result = play(state, move)
    if (!result.ok) throw new Error('bot geçersiz hamle yaptı')
    state = result.state
  }
  return state
}

describe('yeni oyun', () => {
  it('boş tahta, üç parça, sıfır skor', () => {
    const s = newGame(1)
    expect(s.board.every((c) => c === 0)).toBe(true)
    expect(s.tray.every((p) => p !== null)).toBe(true)
    expect(s.score).toBe(0)
    expect(s.gameOver).toBe(false)
    expect(s.generatorVersion).toBe(GENERATOR_VERSION)
  })
})

describe('hamle', () => {
  it('geçerli hamle parçayı yerleştirir, yuvayı boşaltır, puan verir', () => {
    const s = withTray(newGame(1), ['sq2', 'dot', 'h3'])
    const r = play(s, { slot: 0, row: 0, col: 0 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.board[cellIndex(1, 1)]).toBe(1)
    expect(r.state.tray[0]).toBe(null)
    expect(r.state.score).toBe(4)
    expect(r.events.map((e) => e.type)).toEqual(['placed', 'scored'])
  })

  it('geçersiz hamleler reddedilir ve durum değişmez', () => {
    const s = deepFreeze(withTray(newGame(1), ['sq2', null, 'h3']))
    expect(play(s, { slot: 1, row: 0, col: 0 })).toEqual({ ok: false, state: s, reason: 'emptySlot' })
    expect(play(s, { slot: 2, row: 0, col: 6 })).toEqual({ ok: false, state: s, reason: 'doesNotFit' })
    const over = { ...s, gameOver: true }
    expect(play(over, { slot: 0, row: 0, col: 0 })).toMatchObject({ ok: false, reason: 'gameOver' })
  })

  it('motor durumu yerinde değiştirmez (dondurulmuş durumla oynanabilir)', () => {
    const s = deepFreeze(newGame(5))
    const move = greedyBot(s)
    expect(move).not.toBe(null)
    if (move) expect(() => play(s, move)).not.toThrow()
  })

  it('satır temizlenir ve olay gönderilir', () => {
    const base = newGame(1)
    const cells = Array.from({ length: 6 }, (_, c) => cellIndex(7, c))
    const s = withTray({ ...base, board: placeCells(base.board, cells, 2) }, ['h2', 'dot', 'dot'])
    const r = play(s, { slot: 0, row: 7, col: 6 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.board.every((c) => c === 0)).toBe(true)
    expect(r.state.score).toBe(2 + 10)
    expect(r.state.combo).toBe(1)
    const cleared = r.events.find((e) => e.type === 'cleared')
    expect(cleared).toMatchObject({ rows: [7], cols: [] })
  })

  it('üç parça kullanılınca yeni üçlü gelir', () => {
    let s = withTray(newGame(1), ['dot', 'dot', 'dot'])
    for (const [slot, col] of [[0, 0], [1, 2], [2, 4]] as const) {
      const r = play(s, { slot: slot as Slot, row: 0, col })
      if (!r.ok) throw new Error('beklenmeyen geçersiz hamle')
      s = r.state
      if (slot === 2) expect(r.events.some((e) => e.type === 'newTriple')).toBe(true)
    }
    expect(s.tripleIndex).toBe(1)
    expect(s.tray.every((p) => p !== null)).toBe(true)
  })

  it('hiçbir parça sığmazsa oyun biter', () => {
    // Satranç tahtası deseni: tek hücreler boş, hiçbir 2'li parça sığmaz.
    const cells: number[] = []
    for (let i = 0; i < 64; i++) if ((Math.floor(i / 8) + (i % 8)) % 2 === 0) cells.push(i)
    const board = placeCells(newGame(1).board, cells, 3)
    const tray: Tray = [{ shapeId: 'h2', color: 1 }, { shapeId: 'sq2', color: 1 }, null]
    expect(isStuck(board, tray)).toBe(true)
    expect(isStuck(board, [{ shapeId: 'dot', color: 1 }, null, null])).toBe(false)
    expect(getShape('dot').cells).toHaveLength(1)
  })
})

describe('belirlenim: aynı seed + aynı hamleler = aynı oyun', () => {
  it('iki bağımsız oynatma aynı sonucu verir', () => {
    const a = playOut(42, 150)
    const b = playOut(42, 150)
    expect(fingerprint(a)).toBe(fingerprint(b))
    expect(a.score).toBe(b.score)
  })

  it('kaydedilen hamleler tekrar oynatılınca aynı tahta ve skor çıkar', () => {
    let state = newGame(777)
    const moves = []
    while (!state.gameOver && state.moveCount < 120) {
      const move = greedyBot(state)
      if (!move) break
      moves.push(move)
      const r = play(state, move)
      if (!r.ok) throw new Error('geçersiz')
      state = r.state
    }
    let replay = newGame(777)
    for (const m of moves) {
      const r = play(replay, m)
      expect(r.ok).toBe(true)
      if (r.ok) replay = r.state
    }
    expect(fingerprint(replay)).toBe(fingerprint(state))
  })

  it('JSON olarak kaydedip geri yüklenen oyun aynı devam eder', () => {
    const mid = playOut(9, 30)
    const restored = JSON.parse(JSON.stringify(mid)) as GameState
    const m1 = greedyBot(mid)
    const m2 = greedyBot(restored)
    expect(m1).toEqual(m2)
    if (m1 && m2) {
      const r1 = play(mid, m1)
      const r2 = play(restored, m2)
      expect(r1.ok && r2.ok && fingerprint(r1.state) === fingerprint(r2.state)).toBe(true)
    }
  })

  it('altın oyun: seed 42, 150 hamle parmak izi sabit', () => {
    expect(fingerprint(playOut(42, 150))).toBe(GOLDEN_GAME_42)
  })

  it('varsayılan ayar kullanılıyor', () => {
    expect(newGame(1).config).toEqual(DEFAULT_CONFIG)
  })
})

// GENERATOR_VERSION 1 ve mevcut greedy bot ile üretilip sabitlendi.
const GOLDEN_GAME_42 = '8f8b8146'
