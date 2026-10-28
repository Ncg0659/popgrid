/**
 * Yıldız geri bildirimi (Aşama 7.3b). Saf: DOM ve zamanlayıcı bilmez, Node testleriyle denenir.
 * Geri bildirim yalnızca BU sekmenin işlem sonucundan (ödül, satın alma) üretilir; başka sekmenin
 * yazdığı değişiklik bakiyeyi sessizce günceller.
 */
import type { EconomyState } from '../economy/ledger'
import { STAR_COUNT_MS } from '../fx/fxTiming'

/** Yıldız düğmesine giden tek olay: id her olayda artar (aynı olay iki kez oynamaz). */
export interface StarPulse {
  readonly id: number
  /** gain: kazanım (çip + sayım), spend: harcama (sayım + mercan renk). */
  readonly kind: 'gain' | 'spend'
  /** Kazanılan ya da harcanan yıldız (pozitif). */
  readonly amount: number
  /** Olay anı (performance.now, ms): düğme yeniden kurulursa (mod değişimi) eski olay tekrar oynamaz. */
  readonly at: number
}

/** Kazanım çipi bu an hâlâ gösterilmeli mi; gösterilmeliyse kalan süre (ms), değilse 0. */
export function chipTimeLeft(pulse: StarPulse | null, now: number, totalMs: number): number {
  if (!pulse || pulse.kind !== 'gain' || pulse.amount <= 0) return 0
  return Math.max(0, totalMs - (now - pulse.at))
}

/** Bu işlemde gerçekten kazanılan yıldız (300 sınırında yalnızca verilen kısım). Kazanım yoksa 0. */
export function starsGained(before: EconomyState, after: EconomyState): number {
  return Math.max(0, after.stars - before.stars)
}

/**
 * Bakiye sayımının o anki değeri: başta hızlı, sonda yavaş (ease-out), en çok STAR_COUNT_MS.
 * Hareketi azalt'ta ya da süre dolunca doğrudan hedef.
 */
export function tweenStars(from: number, to: number, elapsedMs: number, reduced = false, durationMs = STAR_COUNT_MS): number {
  if (reduced || durationMs <= 0 || elapsedMs >= durationMs || from === to) return to
  const t = Math.max(0, elapsedMs) / durationMs
  const eased = 1 - (1 - t) ** 3
  return Math.round(from + (to - from) * eased)
}
