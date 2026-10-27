/**
 * "Jokerlerle tanış!" tanıtımının "görüldü" kaydı. Eğitim, rekor ve ses anahtarlarından ayrıdır.
 * Yalnızca Eğlence Modu'na ilk girişte kendiliğinden gösterilir; Klasik oyuncuları hiç etkilemez.
 * localStorage kapalıysa (gizli pencere vb.) kayıt yalnızca bu oturum boyunca bellekte kalır:
 * aynı oturumda tekrar açılmaz, hata da vermez.
 */
import type { GameMode } from '../engine/types'

export const JOKER_INTRO_KEY = 'popgrid:v1:joker-intro'

export interface JokerIntroStore {
  isDone(): boolean
  markDone(): void
  /** Eğlence Modu'na girerken ve tanıtım henüz görülmemişse true. */
  shouldAutoShow(mode: GameMode): boolean
}

export function createJokerIntroStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null): JokerIntroStore {
  let doneThisSession = false
  const isDone = () => {
    if (doneThisSession) return true
    try {
      return storage?.getItem(JOKER_INTRO_KEY) === 'done'
    } catch {
      return false
    }
  }
  return {
    isDone,
    markDone() {
      doneThisSession = true
      try {
        storage?.setItem(JOKER_INTRO_KEY, 'done')
      } catch {
        // Depolama yoksa kayıt yalnızca bu oturumda geçerli.
      }
    },
    shouldAutoShow: (mode) => mode === 'eglence' && !isDone(),
  }
}

export const jokerIntroStore: JokerIntroStore = createJokerIntroStore(
  (() => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage
    } catch {
      return null
    }
  })(),
)
