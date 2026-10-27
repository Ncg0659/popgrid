/**
 * Kalıcı joker envanteri (ileride yıldızla alınacak; şimdilik herkes için 0).
 * Oyun başına verilen ücretsiz haklardan AYRIDIR: ücretsiz haklar hiçbir zaman buraya yazılmaz.
 *
 * Tutarlılık kuralı: envanter yalnızca motorun `jokerUsed` olayı `source: 'inventory'` dediğinde,
 * o olay başına TAM BİR KEZ düşülür (bkz. useGame → spendInventoryFor). Oyun başında envanterin
 * o anki değeri oyuna getirilir; oyun içinde harcanan her hak hemen kalıcı kayıttan düşülür,
 * böylece sayfa yenilense bile harcanan hak geri gelmez.
 */
import { NO_JOKERS, validateCharges } from '../engine'
import type { GameEvent, JokerCharges, JokerKind } from '../engine/types'
import { browserStorage } from './mode'

export const INVENTORY_KEY = 'popgrid:v1:inventory'

export interface InventoryStore {
  load(): JokerCharges
  /** Bir hakkı düşer (0'ın altına inmez) ve yeni değeri döndürür. */
  spend(kind: JokerKind): JokerCharges
}

type KeyValue = Pick<Storage, 'getItem' | 'setItem'>

function parse(raw: string | null): JokerCharges {
  if (!raw) return NO_JOKERS
  try {
    const value = JSON.parse(raw) as Partial<JokerCharges>
    return validateCharges({ cekic: value.cekic ?? 0, yenile: value.yenile ?? 0, dondur: value.dondur ?? 0 })
  } catch {
    // Bozuk ya da eski biçimli kayıt: güvenli varsayılan.
    return NO_JOKERS
  }
}

export function createInventoryStore(storage: KeyValue | null): InventoryStore {
  let memory: JokerCharges | null = null
  const load = (): JokerCharges => {
    if (memory) return memory
    try {
      return parse(storage?.getItem(INVENTORY_KEY) ?? null)
    } catch {
      return NO_JOKERS
    }
  }
  return {
    load,
    spend(kind) {
      const current = load()
      const next = { ...current, [kind]: Math.max(0, current[kind] - 1) }
      memory = next
      try {
        storage?.setItem(INVENTORY_KEY, JSON.stringify(next))
      } catch {
        // Depolama yoksa yalnızca bu oturumda geçerli.
      }
      return next
    },
  }
}

/** Bir joker sonucunun olaylarından envanterden harcananları kalıcı kayıttan düşer. */
export function spendInventoryFor(events: readonly GameEvent[], store: InventoryStore): number {
  let spent = 0
  for (const e of events) {
    if (e.type === 'jokerUsed' && e.source === 'inventory') {
      store.spend(e.joker)
      spent++
    }
  }
  return spent
}

export const inventoryStore: InventoryStore = createInventoryStore(browserStorage())
