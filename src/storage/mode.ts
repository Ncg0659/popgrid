/**
 * Son seçilen oyun modu (Klasik / Eğlence). Uygulama bir sonraki açılışta bu modla başlar.
 * localStorage kapalıysa tercih yalnızca bu oturumda bellekte kalır.
 */
import type { GameMode } from '../engine/types'

export const MODE_KEY = 'popgrid:v1:mode'

export interface ModeStore {
  load(): GameMode
  save(mode: GameMode): void
}

type KeyValue = Pick<Storage, 'getItem' | 'setItem'>

export function createModeStore(storage: KeyValue | null): ModeStore {
  let session: GameMode | null = null
  return {
    load() {
      if (session) return session
      try {
        return storage?.getItem(MODE_KEY) === 'eglence' ? 'eglence' : 'klasik'
      } catch {
        return 'klasik'
      }
    },
    save(mode) {
      session = mode
      try {
        storage?.setItem(MODE_KEY, mode)
      } catch {
        // Depolama yoksa tercih yalnızca bu oturumda geçerli.
      }
    },
  }
}

export function browserStorage(): KeyValue | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const modeStore: ModeStore = createModeStore(browserStorage())
