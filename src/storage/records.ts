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

export function saveBest(score: number, mode: GameMode = 'klasik'): void {
  try {
    window.localStorage.setItem(bestKey(mode), String(score))
  } catch {
    // Depolama yoksa rekor yalnızca bu oturumda kalır.
  }
}
