/**
 * Yıldız ekonomisinin kuralları (Aşama 7.1). Saf TypeScript: tarayıcı, React, zamanlayıcı yok.
 * Oyun motorunu DEĞİŞTİRMEZ; yalnızca motorun olaylarını ve son skorunu okur.
 *
 * DENEYSEL — ilk simülasyon değerleri (docs/sim-economy.md). Kullanıcı onayı olmadan değiştirilmez.
 */
import type { GameEvent, JokerCharges, JokerKind } from '../engine/types'

/** Tek hamlede temizlenen hat sayısına göre yıldız: 1 → 2, 2 → 5, 3 ve üstü → 10. Birikmez. */
export const LINE_CLEAR_STARS: Readonly<{ one: number; two: number; threePlus: number }> = {
  one: 2,
  two: 5,
  threePlus: 10,
}

/** Oyun sonu: her tam 100 puan için 5 yıldız. */
export const STARS_PER_HUNDRED_POINTS = 5

/** Mağaza fiyatları (yıldız). */
export const JOKER_PRICES: JokerCharges = { cekic: 25, yenile: 40, dondur: 20 }

/** Bir hamlenin hat ödülü. Aynı hamlede ödüller toplanmaz: 2 hat = yalnızca 5 yıldız. */
export function starsForLines(lines: number): number {
  if (!Number.isSafeInteger(lines) || lines <= 0) return 0
  if (lines === 1) return LINE_CLEAR_STARS.one
  if (lines === 2) return LINE_CLEAR_STARS.two
  return LINE_CLEAR_STARS.threePlus
}

/** Oyun sonu ödülü: Math.floor(finalScore / 100) * 5. Geçersiz skor 0 verir. */
export function starsForFinalScore(finalScore: number): number {
  if (!Number.isSafeInteger(finalScore) || finalScore <= 0) return 0
  return Math.floor(finalScore / 100) * STARS_PER_HUNDRED_POINTS
}

/**
 * Bir hamlenin olaylarından temizlenen hat sayısı. Jokerler hat temizlemez (motor kuralı),
 * bu yüzden joker sonuçlarının olayları her zaman 0 verir: joker kullanmak yıldız kazandırmaz.
 */
export function linesCleared(events: readonly GameEvent[]): number {
  let lines = 0
  for (const e of events) if (e.type === 'cleared') lines += e.rows.length + e.cols.length
  return lines
}

/** Bir hamlenin yıldız ödülü (yalnızca hat temizleme). */
export function starsForMove(events: readonly GameEvent[]): number {
  return starsForLines(linesCleared(events))
}

export function priceOf(kind: JokerKind): number {
  return JOKER_PRICES[kind]
}
