/**
 * İlk açılış eğitiminin "tamamlandı/atlandı" kaydı. Rekor ve ses anahtarlarından ayrı tutulur.
 * localStorage kapalıysa (gizli pencere vb.) kayıt yalnızca bu oturum boyunca bellekte kalır.
 */
export const TUTORIAL_KEY = 'popgrid:v1:tutorial'

export interface TutorialStore {
  isDone(): boolean
  markDone(): void
  /**
   * Yalnızca yeni oyunculara kendiliğinden gösterilir: eğitimi görmemiş, bu modda rekoru 0 ve bu cihazda
   * daha önce oynadığına dair iz yok (Aşama 7.4: hiçbir rekor, joker tanıtımı ya da yıldız kaydı).
   */
  shouldAutoShow(best: number): boolean
}

/** Bu cihazda daha önce oynandığını gösteren kayıtlar (yalnızca okunur, hiçbiri değiştirilmez). */
export const PRIOR_USE_KEYS = {
  best: 'popgrid:v1:best',
  bestFun: 'popgrid:v1:best:eglence',
  jokerIntro: 'popgrid:v1:joker-intro',
  economy: 'popgrid:v1:economy',
} as const

/**
 * Daha önce oynamış oyuncu mu? Herhangi bir rekor, görülmüş joker tanıtımı ya da yıldız kaydında
 * biten oyun / yıldız / satın alma varsa evet. Açılışta oluşan boş ekonomi kaydı iz sayılmaz.
 */
export function hasPriorUse(storage: Pick<Storage, 'getItem'> | null): boolean {
  const read = (k: string): string | null => {
    try {
      return storage?.getItem(k) ?? null
    } catch {
      return null // Depolama kapalı (gizli pencere vb.): iz yok sayılır, eski davranış korunur.
    }
  }
  const num = (k: string) => Number(read(k) ?? '0') || 0
  if (num(PRIOR_USE_KEYS.best) > 0 || num(PRIOR_USE_KEYS.bestFun) > 0) return true
  if (read(PRIOR_USE_KEYS.jokerIntro) === 'done') return true
  const raw = read(PRIOR_USE_KEYS.economy)
  if (!raw) return false
  try {
    const e = JSON.parse(raw) as { stars?: number; history?: unknown[]; totals?: { earned?: number; spent?: number; gamesFinished?: number } }
    const t = e.totals ?? {}
    return (e.stars ?? 0) > 0 || (e.history?.length ?? 0) > 0 || (t.earned ?? 0) > 0 || (t.spent ?? 0) > 0 || (t.gamesFinished ?? 0) > 0
  } catch {
    return true // Okunamayan (bozuk) yıldız kaydı: biri oynamış; mevcut oyuncuyu rahatsız etme.
  }
}

export function createTutorialStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null): TutorialStore {
  let doneThisSession = false
  const isDone = () => {
    if (doneThisSession) return true
    try {
      return storage?.getItem(TUTORIAL_KEY) === 'done'
    } catch {
      return false
    }
  }
  return {
    isDone,
    markDone() {
      doneThisSession = true
      try {
        storage?.setItem(TUTORIAL_KEY, 'done')
      } catch {
        // Depolama yoksa kayıt yalnızca bu oturumda geçerli.
      }
    },
    shouldAutoShow: (best) => best === 0 && !isDone() && !hasPriorUse(storage),
  }
}

export const tutorialStore: TutorialStore = createTutorialStore(
  (() => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage
    } catch {
      return null
    }
  })(),
)
