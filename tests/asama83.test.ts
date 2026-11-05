/**
 * Aşama 8.3 — bombalı/şanslı blokların arayüz davranışı (saf fonksiyonlar):
 * efekt tanımı (patlama, zincir, sayaç, ödül), bildirim metinleri, konumlar, ses eşlemesi, rekor satırları.
 * Motor kuralları tests/specials.test.ts'te; burası yalnızca motorun olaylarının arayüze nasıl çevrildiğini sınar.
 */
import { describe, expect, it } from 'vitest'
import { emptyBoard, placeCells } from '../src/engine/board'
import { SHARED_SEQUENCE_CONFIG } from '../src/engine/generator'
import { newGame, play } from '../src/engine/game'
import { BOMB_FUSE, LUCKY_JOKER_CAP, blastArea } from '../src/engine/specials'
import type { Board, BoardSpecial, GameEvent, GameState, JokerCharges, LuckyReward, Piece, PieceSpecial, Tray } from '../src/engine/types'
import { moveCue } from '../src/audio/soundCue'
import { BLAST_START_MS, CHAIN_MAX_STEPS, CHAIN_STEP_MS, blastText, celebrationText, chainSteps, describeEffect, type Effect } from '../src/fx/effects'
import {
  legacyRecordLines,
  luckyChip,
  luckyJokerKinds,
  luckyNotice,
  pieceSpecialAt,
  previewSpecialCell,
  specialLabel,
  specialsByCell,
  specialsSummary,
} from '../src/ui/specialUi'
import { HELP_SECTIONS } from '../src/help/content'

const FREE: JokerCharges = { cekic: 2, yenile: 2, dondur: 3 }
const dot = (special?: PieceSpecial, color = 1): Piece => (special ? { shapeId: 'dot', color, special } : { shapeId: 'dot', color })
const BOMB: PieceSpecial = { kind: 'bomba', block: [0, 0] }
const lucky = (reward: LuckyReward): PieceSpecial => ({ kind: 'sansli', block: [0, 0], reward })
const filled = (cells: number[], color = 2): Board => placeCells(emptyBoard(), cells, color)
function funState(board: Board, tray: Array<Piece | null>, specials: BoardSpecial[] = [], extra: Partial<GameState> = {}): GameState {
  const base = newGame(5, SHARED_SEQUENCE_CONFIG, { mode: 'eglence', freeJokers: FREE })
  return { ...base, board, tray: tray as unknown as Tray, specials, ...extra }
}
function move(s: GameState, slot: 0 | 1 | 2, row: number, col: number) {
  const r = play(s, { slot, row, col })
  if (!r.ok) throw new Error('geçersiz hamle')
  return { state: r.state, events: r.events, effect: describeEffect(7, s.board, r.events) }
}

describe('Aşama 8.3: efekt tanımı — bomba', () => {
  it('Klasik/özel bloksuz hamlede yeni alanlar boş; eski alanlar aynen', () => {
    const s = newGame(1)
    const r = play({ ...s, tray: [dot(), dot(), dot()] as unknown as Tray }, { slot: 0, row: 0, col: 0 })
    if (!r.ok) throw new Error('geçersiz')
    const e = describeEffect(1, s.board, r.events)
    expect(e.blasts).toEqual([])
    expect(e.blasted).toEqual([])
    expect(e.blastPoints).toBe(0)
    expect(e.ticks).toEqual([])
    expect(e.lucky).toEqual([])
    expect(e.gained).toBe(1)
    expect(celebrationText(e)).toBe(null)
    expect(moveCue(e)).toEqual({ kind: 'place' })
  })

  it('sayaç azalan bomba: ticks içinde, patlama yok', () => {
    const s = funState(emptyBoard(), [dot(), dot(), dot()], [{ kind: 'bomba', cell: 27, timer: 3 }], { board: filled([27]) })
    const { effect } = move(s, 0, 7, 7)
    expect(effect.ticks).toEqual([27])
    expect(effect.blasts).toEqual([])
  })

  it('patlama: hücre renkleri önceki tahtadan, puan gained içinde, kutlama "Bomba! +N", ses temizleme', () => {
    const cells = blastArea(27).filter((c) => c !== 27)
    const board = placeCells(filled(cells, 4), [27], 5)
    const s = funState(board, [dot(), dot(), dot()], [{ kind: 'bomba', cell: 27, timer: 1 }])
    const { effect, events } = move(s, 0, 7, 7)
    const boom = events.find((e) => e.type === 'exploded') as Extract<GameEvent, { type: 'exploded' }>
    expect(effect.blasts.map((b) => b.cell)).toEqual([27])
    expect(effect.blasts[0]!.step).toBe(0)
    expect(effect.blasted.map((b) => b.cell)).toEqual(boom.cells)
    expect(effect.blasted.find((b) => b.cell === 27)!.color).toBe(5)
    expect(effect.blasted.filter((b) => b.cell !== 27).every((b) => b.color === 4)).toBe(true)
    expect(effect.blastPoints).toBe(9)
    expect(effect.gained).toBe(1 + 9) // yerleştirme + patlama (eskiden yalnızca 1 görünüyordu)
    expect(blastText(effect)).toBe('Bomba! +9')
    expect(celebrationText(effect)).toEqual({ title: null, combo: null, blast: 'Bomba! +9' })
    expect(moveCue(effect)).toEqual({ kind: 'clear', lines: 1, combo: 0 })
    expect(effect.blasted.every((b) => b.delay === BLAST_START_MS)).toBe(true)
  })

  it('zincir: ikinci bomba bir adım sonra; hücre ilk kapsayan bombanın adımında; "Zincir ×2!"', () => {
    const board = filled([27, 28, 18, 19, 20, 21, 26, 29, 34, 35, 36, 37])
    const specials: BoardSpecial[] = [
      { kind: 'bomba', cell: 27, timer: 1 },
      { kind: 'bomba', cell: 28, timer: 3 },
    ]
    const { effect } = move(funState(board, [dot(), dot(), dot()], specials), 0, 7, 7)
    expect(effect.blasts.map((b) => [b.cell, b.step])).toEqual([
      [27, 0],
      [28, 1],
    ])
    expect(effect.blasts[1]!.delay - effect.blasts[0]!.delay).toBe(CHAIN_STEP_MS)
    const delayOf = (cell: number) => effect.blasted.find((b) => b.cell === cell)!.delay
    expect(delayOf(26)).toBe(BLAST_START_MS) // yalnızca ilk bombanın alanında
    expect(delayOf(21)).toBe(BLAST_START_MS + CHAIN_STEP_MS) // yalnızca ikincinin alanında
    expect(blastText(effect)).toBe('Zincir ×2! +12')
    expect(moveCue(effect)).toEqual({ kind: 'clear', lines: 2, combo: 0 })
  })

  it('chainSteps: ayrı ayrı patlayan bombalar 0. adım; zincir derinliği birikir; gecikme sınırlı', () => {
    expect(chainSteps([0, 63])).toEqual([
      { cell: 0, step: 0 },
      { cell: 63, step: 0 },
    ])
    // 0 → 1 → 2 → 3 … satır boyunca zincir
    const row = [0, 1, 2, 3, 4, 5, 6, 7]
    expect(chainSteps(row).map((b) => b.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    const board = filled(row)
    const specials: BoardSpecial[] = row.map((cell, i) => ({ kind: 'bomba', cell, timer: i === 0 ? 1 : 3 }))
    const { effect } = move(funState(board, [dot(), dot(), dot()], specials), 0, 7, 7)
    expect(Math.max(...effect.blasts.map((b) => b.delay))).toBe(BLAST_START_MS + CHAIN_MAX_STEPS * CHAIN_STEP_MS)
  })

  it('satırla erken patlayan bomba: hat dalgası + patlama aynı efektte, kutlama ikisini de söyler', () => {
    const row3 = [24, 25, 26, 28, 29, 30, 31]
    const extra = [18, 20, 34, 36]
    const s = funState(filled([...row3, ...extra]), [dot(BOMB), dot(), dot()])
    const { effect } = move(s, 0, 3, 3)
    expect(effect.lines).toBe(1)
    expect(effect.cleared).toHaveLength(8)
    expect(effect.blasted.map((b) => b.cell).sort((a, b) => a - b)).toEqual(extra)
    expect(effect.gained).toBe(1 + 10 + 4)
    expect(celebrationText(effect)?.blast).toBe('Bomba! +4')
    expect(moveCue(effect)).toEqual({ kind: 'clear', lines: 1, combo: 1 }) // hat varsa hat sesi
  })
})

describe('Aşama 8.3: efekt tanımı ve bildirim — şanslı blok', () => {
  it('hatla kaldırılan şanslı: lucky çipi, gecikme 0; bildirim "+10 ★"', () => {
    const s = funState(filled([0, 1, 2, 3, 4, 5, 6]), [dot(lucky({ type: 'stars', amount: 10 })), dot(), dot()])
    const { effect } = move(s, 0, 0, 7)
    expect(effect.lucky).toEqual([{ cell: 7, reward: { type: 'stars', amount: 10 }, cause: 'line', delay: 0 }])
    expect(luckyChip(effect.lucky[0]!)).toBe('+10 ★')
    expect(luckyNotice(effect.lucky, true)).toBe('Şanslı blok: +10 ★')
    expect(luckyJokerKinds(effect.lucky)).toEqual([])
  })

  it('joker ödülü: "bu oyun için" yazar; hak sayısı zıplasın diye tür döner', () => {
    const s = funState(filled([0, 1, 2, 3, 4, 5, 6]), [dot(lucky({ type: 'joker', joker: 'cekic' })), dot(), dot()])
    const { effect } = move(s, 0, 0, 7)
    expect(luckyNotice(effect.lucky, true)).toBe('Şanslı blok: +1 Çekiç (bu oyuna)')
    expect(luckyChip(effect.lucky[0]!)).toBe('+1 Çekiç')
    expect(luckyJokerKinds(effect.lucky)).toEqual(['cekic'])
  })

  it(`joker sınırı (${LUCKY_JOKER_CAP}) doluyken: +5 ★ ve nedeni açıkça; joker zıplaması yok`, () => {
    const s = funState(filled([0, 1, 2, 3, 4, 5, 6]), [dot(lucky({ type: 'joker', joker: 'yenile' })), dot(), dot()], [], {
      luckyJokers: LUCKY_JOKER_CAP,
    })
    const { effect } = move(s, 0, 0, 7)
    expect(effect.lucky[0]!.convertedFrom).toBe('yenile')
    expect(luckyNotice(effect.lucky, true)).toBe(`Şanslı blok: +5 ★ (${LUCKY_JOKER_CAP} joker sınırı doldu)`)
    expect(luckyJokerKinds(effect.lucky)).toEqual([])
    expect(luckyChip(effect.lucky[0]!)).toBe('+5 ★')
  })

  it('patlamayla kaldırılan şanslı: gecikme patlamanın adımıyla aynı', () => {
    const board = filled([27, 28])
    const specials: BoardSpecial[] = [
      { kind: 'bomba', cell: 27, timer: 1 },
      { kind: 'sansli', cell: 28, reward: { type: 'stars', amount: 5 } },
    ]
    const { effect } = move(funState(board, [dot(), dot(), dot()], specials), 0, 7, 7)
    expect(effect.lucky).toEqual([{ cell: 28, reward: { type: 'stars', amount: 5 }, cause: 'bomb', delay: BLAST_START_MS }])
  })

  it('kayıtsız oyunda (yıldız defterde değil) yıldız sözü verilmez; joker yine söylenir', () => {
    const l = [
      { cell: 1, reward: { type: 'stars', amount: 10 } as const, cause: 'line' as const, delay: 0 },
      { cell: 2, reward: { type: 'joker', joker: 'dondur' } as const, cause: 'line' as const, delay: 0 },
    ]
    expect(luckyNotice(l.slice(0, 1), false)).toBe(null)
    expect(luckyNotice(l, false)).toBe('Şanslı bloklar: +1 Döndür (bu oyuna)')
    expect(luckyNotice(l, true)).toBe('Şanslı bloklar: +10 ★, +1 Döndür (bu oyuna)')
    expect(luckyNotice([], true)).toBe(null)
    // Tek ödüllü bildirimler en dar ekranda (320 px, 14 px yazı) tek satıra sığacak kadar kısa.
    for (const t of [luckyNotice(l.slice(1), true)!, luckyNotice([{ ...l[0]!, reward: { type: 'stars', amount: 5 }, convertedFrom: 'yenile' }], true)!]) {
      expect(t.length).toBeLessThan(42)
    }
    expect(luckyNotice(undefined, true)).toBe(null)
  })
})

describe('Aşama 8.3: tahta ve parça işaretleri', () => {
  it('specialsByCell / specialLabel: renk yerine sözlü ve sayılı bilgi', () => {
    const m = specialsByCell([
      { kind: 'bomba', cell: 3, timer: 2 },
      { kind: 'sansli', cell: 9, reward: { type: 'stars', amount: 5 } },
    ])
    expect(m.get(3)).toEqual({ kind: 'bomba', timer: 2 })
    expect(m.get(9)).toEqual({ kind: 'sansli' })
    expect(specialLabel(m.get(3)!)).toBe('bomba, 2 hamle sonra patlar')
    expect(specialLabel(m.get(9)!)).toBe('şanslı blok')
    expect(specialsByCell(undefined).size).toBe(0)
  })

  it('specialsSummary: tahta etiketi için kısa özet; özel blok yoksa boş', () => {
    expect(specialsSummary({ specials: undefined })).toBe('')
    expect(specialsSummary({ specials: [] })).toBe('')
    expect(
      specialsSummary({
        specials: [
          { kind: 'bomba', cell: 3, timer: 2 },
          { kind: 'bomba', cell: 4, timer: 1 },
          { kind: 'sansli', cell: 9, reward: { type: 'stars', amount: 5 } },
        ],
      }),
    ).toBe('2 bomba (en yakını 1 hamle sonra), 1 şanslı blok')
  })

  it('pieceSpecialAt / previewSpecialCell: işaret parçanın kendi bloğunda ve hayalette doğru hücrede', () => {
    const piece: Piece = { shapeId: 'h3', color: 2, special: { kind: 'bomba', block: [0, 1] } }
    expect(pieceSpecialAt(piece, 0, 1)).toBe('bomba')
    expect(pieceSpecialAt(piece, 0, 0)).toBe(null)
    expect(previewSpecialCell(piece, { row: 4, col: 2 })).toBe(4 * 8 + 3)
    expect(previewSpecialCell({ shapeId: 'h3', color: 2 }, { row: 4, col: 2 })).toBe(null)
    expect(previewSpecialCell(piece, null)).toBe(null)
    // Tepsideki bomba henüz konmadı: sayacı tam (BOMB_FUSE); tahtaya konunca motor da aynı sayıyla başlatır.
    const s = funState(emptyBoard(), [piece, dot(), dot()])
    const r = play(s, { slot: 0, row: 4, col: 2 })
    if (!r.ok) throw new Error('geçersiz')
    expect(r.state.specials).toEqual([{ kind: 'bomba', cell: previewSpecialCell(piece, { row: 4, col: 2 }), timer: BOMB_FUSE }])
  })
})

describe('Aşama 8.3: rekorlar ve rehber', () => {
  it('önceki (özel bloksuz) Eğlence rekorları ayrı adla; 0 olanlar gösterilmez', () => {
    expect(legacyRecordLines({ eglence: 0, eglenceSatin: 0 })).toEqual([])
    expect(legacyRecordLines({ eglence: 12345, eglenceSatin: 0 })).toEqual(['Önceki Eğlence rekoru (özel bloksuz): 12.345'])
    expect(legacyRecordLines({ eglence: 0, eglenceSatin: 900 })).toEqual(['Önceki satın alınmış jokerli (özel bloksuz): 900'])
  })

  it('rehberdeki özel blok bölümü motorun sayılarıyla yazılır', () => {
    const sec = HELP_SECTIONS.find((s) => s.id === 'ozelbloklar')
    expect(sec?.availability).toBe('oyunda')
    const text = JSON.stringify(sec)
    expect(text.includes(`${BOMB_FUSE} hamle sonra patlar`)).toBe(true)
    expect(text.includes(`en çok ${LUCKY_JOKER_CAP} joker`)).toBe(true)
    expect(text.includes('Klasik Mod’da özel blok yoktur')).toBe(true)
  })

  it('eski biçimli efekt tanımı (yeni alanlar yok) hâlâ geçerli: kutlama ve ses eskisi gibi', () => {
    const old: Effect = { id: 1, placed: [0], placedColor: 1, cleared: [], lines: 2, combo: 1, gained: 0 }
    expect(celebrationText(old)).toEqual({ title: 'Süper!', combo: null })
    expect(blastText(old)).toBe(null)
    expect(moveCue(old)).toEqual({ kind: 'clear', lines: 2, combo: 1 })
  })
})
