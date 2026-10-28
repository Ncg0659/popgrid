/**
 * Yıldız ekonomisinin kalıcı kaydı (Aşama 7.1). Bakiye, satın alınmış envanter, etkin oyunun ödül
 * defteri, oyun özetleri ve sahiplik TEK anahtarda, TEK JSON olarak saklanır: her işlem tek bir setItem ile
 * yazılır, böylece "yıldız düştü ama joker eklenmedi" gibi yarım bir durum oluşamaz.
 *
 * Her işlem önce kaydı depolamadan YENİDEN okur (bayat bellek kopyası üzerine yazılmaz), sahipliği
 * denetler, kuralı uygular (src/economy/ledger.ts) ve sonucu yazar.
 *
 * Tek yazıcı (K1, K2): yalnızca sahip sekme yazabilir (src/economy/ownership.ts). Sahip olmayan sekmede
 * her değiştirici işlem 'otherTab' ile reddedilir; arayüz "POPGRID başka bir sekmede açık" açıklaması gösterir.
 *
 * Joker kullanımı (K5): `useJoker` motorun jokerini uygular ve satın alınmış hakkın düşülmesini AYNI
 * senkron çağrıda yazar. Yazma olmazsa (başka sekme sahip, kayıt yazılamıyor) motor sonucu da verilmez:
 * satın alınmış joker ya kullanılıp düşülür ya da hiç kullanılmaz; sessizce çoğalmaz, kaybolmaz.
 *
 * ÖNEMLİ — güvenlik sınırı: localStorage oyuncunun kendi tarayıcısındadır. Geliştirici araçlarıyla
 * değiştirilebilir, silinebilir, başka cihaza taşınmaz. Bu kayıt hile koruması ya da sunucu güvenliği
 * SAĞLAMAZ; yalnızca dürüst oyunda çift ödül, yarım satın alma ve bozuk kayıtla çökme hatalarını önler.
 *
 * Oyun arayüzü (Aşama 7.2) bu depoyu tek kaynak olarak kullanır: src/ui/useEconomy.ts, src/ui/useGame.ts.
 * Mevcut kayıtlara dokunmaz: rekorlar, mod, eğitim, ses ve eski envanter anahtarı aynen kalır; eski envanter
 * yalnızca ekonomi kaydı hiç yokken bir kez OKUNUR (taşınır).
 */
import { applyJoker } from '../engine/jokers'
import type { GameEvent, GameMode, GameState, JokerAction, JokerCharges, JokerKind, JokerWallet } from '../engine/types'
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
import {
  claimOwnership,
  ownershipStatus,
  releaseOwnership,
  renewOwnership,
  type OwnershipStatus,
} from '../economy/ownership'
import { parseEconomy, serializeEconomy, type EconomyLoad } from '../economy/schema'
import { INVENTORY_KEY } from './inventory'
import { browserStorage } from './mode'

export const ECONOMY_KEY = 'popgrid:v1:economy'
/** Bozuk bulunan kaydın ham hali buraya kopyalanır (inceleme ya da elle kurtarma için). */
export const ECONOMY_BACKUP_KEY = 'popgrid:v1:economy:corrupt'

type KeyValue = Pick<Storage, 'getItem' | 'setItem'>

/**
 * readOnly: daha yeni sürümün kaydı. storageError: kayıt yazılamadı ve bu işlem kalıcı olmadan
 * yapılamaz (satın alınmış joker harcamak).
 */
export type StoreFailure = EconomyFailure | 'readOnly' | 'storageError'

export type StoreResult =
  | { readonly ok: true; readonly state: EconomyState; readonly stars: number; readonly persisted: boolean }
  | { readonly ok: false; readonly state: EconomyState; readonly reason: StoreFailure }

export type JokerUseResult =
  | {
      readonly ok: true
      /** Motorun yeni oyun durumu: arayüz YALNIZCA bunu uygular. */
      readonly game: GameState
      readonly events: readonly GameEvent[]
      readonly economy: EconomyState
    }
  | { readonly ok: false; readonly reason: StoreFailure | 'jokerInvalid'; readonly jokerReason?: string }

export interface EconomyStoreOptions {
  /** Bu sekmenin kimliği (createTabId). */
  readonly tabId: string
  /** Saat (testlerde sahte). Varsayılan Date.now. */
  readonly now?: () => number
}

export interface EconomyStore {
  readonly tabId: string
  /** Kaydı okur (sahip olmayan sekme de okuyabilir). Bozuk ya da daha yeni sürümün kaydı oyunu çökertmez. */
  load(): EconomyLoad
  /** mine / free / other — arayüz "başka sekmede açık" açıklaması için. */
  ownership(): OwnershipStatus
  /** Sahipliği alır. Başka sekmenin kirası sürüyorsa yalnızca force (kullanıcı onayıyla) ile. */
  claim(force?: boolean): StoreResult
  /** Kirayı yeniler (sahip sekmede düzenli aralıkla). */
  heartbeat(): StoreResult
  /** Sahipliği bırakır (sayfa kapanırken). */
  release(): void
  startGame(id: string, mode: GameMode, inventoryAtStart?: JokerCharges, freeAtStart?: JokerCharges): StoreResult
  /** Hamle ödülü; hamle numarası doğrudan motorun durumundan alınır (K3). */
  recordMove(gameId: string, next: GameState, events: readonly GameEvent[]): StoreResult
  awardMove(gameId: string, moveCount: number, events: readonly GameEvent[]): StoreResult
  /** Jokeri uygular ve satın alınmış harcamayı aynı çağrıda kaydeder (K5). */
  useJoker(gameId: string, game: GameState, action: JokerAction): JokerUseResult
  syncUsage(gameId: string, wallet: JokerWallet | null): StoreResult
  finishGame(gameId: string, finalScore: number, wallet: JokerWallet | null): StoreResult
  purchase(kind: JokerKind, requestId: string): StoreResult
}

/** Rastgele kimlik (oyun ya da sekme). Tohumdan TÜRETİLMEZ (K4): aynı tohum tekrar oynansa da kimlik yenidir. */
export function randomId(prefix: string): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return `${prefix}-${c.randomUUID()}`
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  return `${prefix}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

export const newGameId = (): string => randomId('g')
export const createTabId = (): string => randomId('t')

export function createEconomyStore(storage: KeyValue | null, options: EconomyStoreOptions): EconomyStore {
  const { tabId } = options
  const now = options.now ?? (() => Date.now())
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

  /** Yazar. Başarılıysa true; depolama yoksa/hata verirse bellekte tutar ve false. */
  const write = (next: EconomyState): boolean => {
    if (memory === null && storage) {
      try {
        storage.setItem(ECONOMY_KEY, serializeEconomy(next))
        return true
      } catch {
        // Kota dolu / gizli pencere: bundan sonra bu oturumda bellekte.
      }
    }
    memory = next
    return false
  }

  /** Bu oturumda daha önce kalıcı yazma başarısız oldu mu (depolama var ama yazılamıyor)? */
  const lostPersistence = () => memory !== null && storage !== null

  const run = (op: (state: EconomyState) => EconomyResult, opts: { requirePersist?: boolean } = {}): StoreResult => {
    const current = load()
    // Daha yeni bir sürümün kaydını eski sürüm bozmasın: hiçbir şey yazılmaz.
    if (current.status === 'future') return { ok: false, state: current.state, reason: 'readOnly' }
    const t = now()
    // Depolama hiç yoksa (gizli pencere vb.) tek sekme vardır: sahiplik denetimi gereksiz.
    if (storage !== null && ownershipStatus(current.state, tabId, t) !== 'mine') {
      return { ok: false, state: current.state, reason: 'otherTab' }
    }
    // Kalıcı olmadan yapılmaması gereken işlem (satın alma, satın alınmış joker): kayıt yoksa ya da bozulduysa hiç yapılmaz.
    if (opts.requirePersist && (storage === null || lostPersistence())) return { ok: false, state: current.state, reason: 'storageError' }
    const result = op(current.state)
    if (!result.ok) return result
    const next = renewOwnership(result.state, tabId, t)
    if (next === current.state) return { ...result, state: next, persisted: memory === null }
    const persisted = write(next)
    if (!persisted && opts.requirePersist && storage !== null) {
      // Kalıcı olmadan yapılmaması gereken işlem: bellekteki değişikliği geri al.
      memory = current.state
      return { ok: false, state: current.state, reason: 'storageError' }
    }
    return { ...result, state: next, persisted }
  }

  const store: EconomyStore = {
    tabId,
    load,
    ownership: () => (storage === null ? 'mine' : ownershipStatus(load().state, tabId, now())),
    claim(force = false) {
      const current = load()
      if (current.status === 'future') return { ok: false, state: current.state, reason: 'readOnly' }
      const r = claimOwnership(current.state, tabId, now(), force)
      if (!r.ok) return r
      return { ...r, persisted: write(r.state) }
    },
    heartbeat: () => run((s) => ({ ok: true, state: s, stars: 0 })),
    release() {
      const current = load()
      if (current.status === 'future') return
      const next = releaseOwnership(current.state, tabId)
      if (next !== current.state) write(next)
    },
    startGame: (id, mode, inventoryAtStart, freeAtStart) => run((s) => startGame(s, id, mode, inventoryAtStart, freeAtStart)),
    recordMove: (gameId, next, events) => run((s) => awardMove(s, gameId, next.moveCount, events)),
    awardMove: (gameId, moveCount, events) => run((s) => awardMove(s, gameId, moveCount, events)),
    useJoker(gameId, game, action) {
      const applied = applyJoker(game, action)
      if (!applied.ok) return { ok: false, reason: 'jokerInvalid', jokerReason: applied.reason }
      const usesInventory = applied.events.some((e) => e.type === 'jokerUsed' && e.source === 'inventory')
      const synced = run((s) => syncUsage(s, gameId, applied.state.jokers), { requirePersist: usesInventory })
      if (!synced.ok) {
        // Satın alınmış hak harcanacaksa kayıt şart: kaydedilemiyorsa joker uygulanmaz.
        if (usesInventory) return { ok: false, reason: synced.reason }
        // Yalnızca ücretsiz hak: ekonomi kaydı olmasa da oyun etkilenmez.
        return { ok: true, game: applied.state, events: applied.events, economy: synced.state }
      }
      return { ok: true, game: applied.state, events: applied.events, economy: synced.state }
    },
    syncUsage: (gameId, wallet) => run((s) => syncUsage(s, gameId, wallet)),
    finishGame: (gameId, finalScore, wallet) => run((s) => finishGame(s, gameId, finalScore, wallet)),
    // Aşama 7.2: satın alma yalnızca kalıcı kayıt başarılıysa olur; yazılamazsa bakiye ve envanter aynen kalır.
    purchase: (kind, requestId) => run((s) => purchase(s, kind, requestId), { requirePersist: true }),
  }
  return store
}

/** Tarayıcıdaki ekonomi deposu: sekme başına bir kimlik. Arayüz (7.2) sahipliği açılışta alır. */
export const economyStore: EconomyStore = createEconomyStore(browserStorage(), { tabId: createTabId() })
