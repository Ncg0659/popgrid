/**
 * Yıldız ekonomisinin kalıcı kaydı (Aşama 7.1). Bakiye, satın alınmış envanter, etkin oyunun ödül
 * defteri ve oyun özetleri TEK anahtarda, TEK JSON olarak saklanır: her işlem tek bir setItem ile
 * yazılır, böylece "yıldız düştü ama joker eklenmedi" gibi yarım bir durum oluşamaz.
 *
 * Her işlem önce kaydı depolamadan YENİDEN okur (bayat bellek kopyası üzerine yazılmaz), kuralı
 * uygular (src/economy/ledger.ts) ve sonucu yazar.
 *
 * ÖNEMLİ — güvenlik sınırı: localStorage oyuncunun kendi tarayıcısındadır. Geliştirici araçlarıyla
 * değiştirilebilir, silinebilir, başka cihaza taşınmaz. Bu kayıt hile koruması ya da sunucu güvenliği
 * SAĞLAMAZ; yalnızca dürüst oyunda çift ödül, yarım satın alma ve bozuk kayıtla çökme hatalarını önler.
 *
 * Henüz oyun içinden çağrılmıyor (arayüz bağlantısı Aşama 7.2'de). Mevcut kayıtlara dokunmaz:
 * rekorlar, mod, eğitim, ses ve eski envanter anahtarı aynen kalır; eski envanter yalnızca OKUNUR.
 */
import type { GameEvent, GameMode, JokerCharges, JokerKind, JokerWallet } from '../engine/types'
import {
  awardMove,
  finishGame,
  purchase,
  startGame,
  syncUsage,
  type EconomyFailure,
  type EconomyResult,
  type EconomyState,
} from '../economy/ledger'
import { parseEconomy, serializeEconomy, type EconomyLoad } from '../economy/schema'
import { INVENTORY_KEY } from './inventory'
import { browserStorage } from './mode'

export const ECONOMY_KEY = 'popgrid:v1:economy'
/** Bozuk bulunan kaydın ham hali buraya kopyalanır (inceleme ya da elle kurtarma için). */
export const ECONOMY_BACKUP_KEY = 'popgrid:v1:economy:corrupt'

type KeyValue = Pick<Storage, 'getItem' | 'setItem'>

export type StoreFailure = EconomyFailure | 'readOnly'

export type StoreResult =
  | { readonly ok: true; readonly state: EconomyState; readonly stars: number; readonly persisted: boolean }
  | { readonly ok: false; readonly state: EconomyState; readonly reason: StoreFailure }

export interface EconomyStore {
  /** Kaydı okur. Bozuk ya da daha yeni sürümün kaydı oyunu çökertmez. */
  load(): EconomyLoad
  startGame(id: string, mode: GameMode, inventoryAtStart?: JokerCharges, freeAtStart?: JokerCharges): StoreResult
  awardMove(gameId: string, moveCount: number, events: readonly GameEvent[]): StoreResult
  syncUsage(gameId: string, wallet: JokerWallet | null): StoreResult
  finishGame(gameId: string, finalScore: number, wallet: JokerWallet | null): StoreResult
  purchase(kind: JokerKind, requestId: string): StoreResult
}

export function createEconomyStore(storage: KeyValue | null): EconomyStore {
  // Depolama yoksa ya da yazma hata verirse: bu oturum boyunca bellekte devam edilir.
  let memory: EconomyState | null = null

  const read = (key: string): string | null => {
    try {
      return storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  const load = (): EconomyLoad => {
    if (memory) return { state: memory, status: 'ok' }
    const raw = read(ECONOMY_KEY)
    const result = parseEconomy(raw, raw === null ? read(INVENTORY_KEY) : null)
    if (result.status === 'corrupt' && raw !== null) {
      try {
        storage?.setItem(ECONOMY_BACKUP_KEY, raw)
      } catch {
        // Yedek yazılamadıysa da oyun devam eder.
      }
    }
    return result
  }

  const run = (op: (state: EconomyState) => EconomyResult): StoreResult => {
    const current = load()
    // Daha yeni bir sürümün kaydını eski sürüm bozmasın: hiçbir şey yazılmaz.
    if (current.status === 'future') return { ok: false, state: current.state, reason: 'readOnly' }
    const result = op(current.state)
    if (!result.ok) return result
    if (result.state === current.state) return { ...result, persisted: memory === null }
    if (memory === null && storage) {
      try {
        storage.setItem(ECONOMY_KEY, serializeEconomy(result.state))
        return { ...result, persisted: true }
      } catch {
        // Kota dolu / gizli pencere: değişiklik bu oturumda bellekte geçerli.
      }
    }
    memory = result.state
    return { ...result, persisted: false }
  }

  return {
    load,
    startGame: (id, mode, inventoryAtStart, freeAtStart) => run((s) => startGame(s, id, mode, inventoryAtStart, freeAtStart)),
    awardMove: (gameId, moveCount, events) => run((s) => awardMove(s, gameId, moveCount, events)),
    syncUsage: (gameId, wallet) => run((s) => syncUsage(s, gameId, wallet)),
    finishGame: (gameId, finalScore, wallet) => run((s) => finishGame(s, gameId, finalScore, wallet)),
    purchase: (kind, requestId) => run((s) => purchase(s, kind, requestId)),
  }
}

export const economyStore: EconomyStore = createEconomyStore(browserStorage())
