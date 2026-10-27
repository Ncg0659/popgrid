/**
 * İlk açılış eğitiminin "tamamlandı/atlandı" kaydı. Rekor ve ses anahtarlarından ayrı tutulur.
 * localStorage kapalıysa (gizli pencere vb.) kayıt yalnızca bu oturum boyunca bellekte kalır.
 */
export const TUTORIAL_KEY = 'popgrid:v1:tutorial'

export interface TutorialStore {
  isDone(): boolean
  markDone(): void
  /** Yalnızca yeni oyunculara (rekoru 0) ve eğitimi henüz görmemişlere kendiliğinden gösterilir. */
  shouldAutoShow(best: number): boolean
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
    shouldAutoShow: (best) => best === 0 && !isDone(),
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
