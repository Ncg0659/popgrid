/**
 * Motorun olaylarını (placed, cleared, scored, combo) görsel ve ses efekti tanımına çevirir.
 * Saf fonksiyon: motoru değiştirmez, DOM bilmez, Node testleriyle denenir.
 */
import { BOARD_SIZE, type Board, type Cell, type GameEvent } from '../engine/types'

export interface ClearedBlock {
  readonly cell: number
  readonly color: Cell
  /** Patlama gecikmesi (ms): yerleştirilen parçadan uzaklaştıkça dalga gibi gecikir. */
  readonly delay: number
}

export interface Effect {
  /** Her hamlede artan kimlik; animasyonları yeniden başlatmak için anahtar. */
  readonly id: number
  readonly placed: readonly number[]
  readonly placedColor: Cell
  readonly cleared: readonly ClearedBlock[]
  /** Aynı hamlede temizlenen satır + sütun sayısı. */
  readonly lines: number
  readonly combo: number
  /** Bu hamlede kazanılan puan. */
  readonly gained: number
}

/** Dalga gecikmesi: hücre başına adım ve üst sınır. */
export const WAVE_STEP_MS = 22
export const WAVE_MAX_MS = 160

/**
 * @param prevBoard hamleden ÖNCEKİ tahta (temizlenen blokların renkleri için)
 * @param events play() sonucunun olayları
 */
export function describeEffect(id: number, prevBoard: Board, events: readonly GameEvent[]): Effect {
  let placed: readonly number[] = []
  let placedColor: Cell = 0
  let clearedCells: readonly number[] = []
  let lines = 0
  let combo = 0
  let gained = 0
  for (const e of events) {
    if (e.type === 'placed') {
      placed = e.cells
      placedColor = e.color
    } else if (e.type === 'cleared') {
      clearedCells = e.cells
      lines = e.rows.length + e.cols.length
    } else if (e.type === 'scored') {
      gained = e.breakdown.total
      combo = lines > 0 ? e.breakdown.comboMultiplier : 0
    }
  }

  // Yerleştirilen parçanın ortası: dalga buradan yayılır.
  const cr = placed.reduce((s, i) => s + Math.floor(i / BOARD_SIZE), 0) / Math.max(1, placed.length)
  const cc = placed.reduce((s, i) => s + (i % BOARD_SIZE), 0) / Math.max(1, placed.length)
  const placedSet = new Set(placed)

  const cleared = clearedCells.map((cell) => {
    const r = Math.floor(cell / BOARD_SIZE)
    const c = cell % BOARD_SIZE
    const dist = Math.hypot(r - cr, c - cc)
    return {
      cell,
      color: placedSet.has(cell) ? placedColor : (prevBoard[cell] ?? 0),
      delay: Math.min(WAVE_MAX_MS, Math.round(dist) * WAVE_STEP_MS),
    }
  })

  return { id, placed, placedColor, cleared, lines, combo, gained }
}

/** Çoklu temizleme ve kombo için kısa kutlama metni; gerekmiyorsa null. */
export function celebrationText(effect: Effect): { title: string | null; combo: string | null } | null {
  const title = effect.lines >= 4 ? 'Muhteşem!' : effect.lines === 3 ? 'Harika!' : effect.lines === 2 ? 'Süper!' : null
  const combo = effect.combo >= 2 ? `Kombo ×${effect.combo}` : null
  return title || combo ? { title, combo } : null
}
