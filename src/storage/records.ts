/**
 * Rekor saklama. localStorage gizli pencerede veya kapalıyken hata verebilir;
 * her erişim try/catch içindedir ve oyun depolama olmadan da çalışır.
 */
import type { GameMode } from '../engine/types'

/**
 * Mod başına rekor anahtarı. Klasik, Aşama 6 öncesindeki anahtarı kullanır; mevcut rekorlar korunur.
 * Eğlence (jokerli) skorları Klasik ile karşılaştırılamayacağı için ayrı tutulur.
 */
export function bestKey(mode: GameMode = 'klasik'): string {
  return mode === 'klasik' ? 'popgrid:v1:best' : 'popgrid:v1:best:eglence'
}

export function loadBest(mode: GameMode = 'klasik'): number {
  try {
    const raw = window.localStorage.getItem(bestKey(mode))
    const value = raw === null ? 0 : Number(raw)
    return Number.isSafeInteger(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

/**
 * Aşama 7.2: Eğlence oyununda satın alınmış joker kullanılınca o oyun ayrı rekor kategorisine geçer;
 * oyun sırasında normal Eğlence rekoruna yazılmış değer oyunun başındaki değerine geri alınır.
 * Hiçbir zaman başlangıçtaki rekorun altına inmez; başlangıçta rekor yoksa anahtar silinir (eski hâl).
 */
export function restoreBest(value: number, mode: GameMode = 'klasik'): void {
  try {
    if (value > 0) window.localStorage.setItem(bestKey(mode), String(value))
    else window.localStorage.removeItem(bestKey(mode))
  } catch {
    // Depolama yoksa yalnızca bu oturumda.
  }
}

export function saveBest(score: number, mode: GameMode = 'klasik'): void {
  try {
    window.localStorage.setItem(bestKey(mode), String(score))
  } catch {
    // Depolama yoksa rekor yalnızca bu oturumda kalır.
  }
}
