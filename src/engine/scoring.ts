import type { ScoreBreakdown } from './types'

/** Her temizlenen hat için taban puan. */
export const LINE_POINTS = 10

/** Aynı hamlede n hat temizlemenin taban puanı: 10 × n × n (1→10, 2→40, 3→90). */
export function clearBasePoints(lines: number): number {
  return LINE_POINTS * lines * lines
}

/**
 * Bir hamlenin puanı.
 * @param blocks yerleştirilen parçanın blok sayısı
 * @param lines aynı hamlede temizlenen satır + sütun sayısı
 * @param previousCombo hamleden önceki kombo serisi
 */
export function scoreMove(blocks: number, lines: number, previousCombo: number): { breakdown: ScoreBreakdown; combo: number } {
  const combo = lines > 0 ? previousCombo + 1 : 0
  const clearBase = clearBasePoints(lines)
  const comboMultiplier = lines > 0 ? combo : 0
  const clear = clearBase * comboMultiplier
  return {
    combo,
    breakdown: {
      placement: blocks,
      lines,
      clearBase,
      comboMultiplier,
      clear,
      total: blocks + clear,
    },
  }
}
