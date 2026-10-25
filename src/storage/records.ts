/**
 * Rekor saklama. localStorage gizli pencerede veya kapalıyken hata verebilir;
 * her erişim try/catch içindedir ve oyun depolama olmadan da çalışır.
 */
const BEST_KEY = 'popgrid:v1:best'

export function loadBest(): number {
  try {
    const raw = window.localStorage.getItem(BEST_KEY)
    const value = raw === null ? 0 : Number(raw)
    return Number.isSafeInteger(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function saveBest(score: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(score))
  } catch {
    // Depolama yoksa rekor yalnızca bu oturumda kalır.
  }
}
