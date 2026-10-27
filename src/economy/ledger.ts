/**
 * Yıldız bakiyesi, satın alınmış joker envanteri ve oyun başına ödül defteri (Aşama 7.1).
 * Saf ve değişmez: her işlem yeni bir EconomyState döndürür, eskisini değiştirmez.
 * Depolamayı bilmez; kalıcı kayıt src/storage/economy.ts'tedir (tek anahtar, tek yazma = atomik).
 *
 * Çift ödül koruması:
 * - Hamle ödülü yalnızca ETKİN oyuna ve yalnızca daha önce ödüllendirilmemiş hamle numarasına verilir
 *   (GameState.moveCount her hamlede 1 artar; aynı hamle ikinci kez gelirse reddedilir).
 * - Oyun sonu ödülü yalnızca etkin oyuna verilir ve oyun hemen kapatılır (active = null);
 *   aynı oyun için ikinci çağrı reddedilir.
 * - Satın alma, istek kimliğiyle tekrar edilemez (aynı dokunuş iki kez işlenmez).
 *
 * Joker kullanımı idempotent sayılır: kullanılan hak sayısı olay sayılarak değil, oyunun cüzdanının
 * oyun başındaki değerle farkından hesaplanır. Aynı durum iki kez bildirilse de envanter bir kez düşer.
 */
import { DEFAULT_FREE_JOKERS, JOKER_KINDS, NO_JOKERS } from '../engine/jokers'
import type { GameEvent, GameMode, JokerCharges, JokerKind, JokerWallet } from '../engine/types'
import { JOKER_PRICES, starsForFinalScore, starsForMove } from './rules'

export const ECONOMY_SCHEMA_VERSION = 1

/** Taşma ve bozuk kayıtlara karşı üst sınırlar (oyun içinde ulaşılması beklenmez). */
export const MAX_STARS = 99_999_999
export const MAX_INVENTORY_PER_KIND = 9_999
/** Saklanan son oyun özeti ve son satın alma kimliği sayısı (kayıt küçük kalsın). */
export const HISTORY_LIMIT = 20
export const PURCHASE_ID_LIMIT = 20

export interface JokerUsage {
  /** Oyun başına verilen ücretsiz haklardan kullanılanlar. */
  readonly free: JokerCharges
  /** Satın alınmış envanterden kullanılanlar. */
  readonly purchased: JokerCharges
}

export interface ActiveGame {
  readonly id: string
  readonly mode: GameMode
  /** Ödülü verilmiş son hamle numarası (GameState.moveCount). Başta 0. */
  readonly lastAwardedMove: number
  /** Bu oyunda hat temizlemeden kazanılan yıldız. */
  readonly lineStars: number
  readonly freeAtStart: JokerCharges
  /** Oyuna getirilen satın alınmış haklar (oyun başındaki envanter). Klasik'te hep 0. */
  readonly inventoryAtStart: JokerCharges
  readonly usage: JokerUsage
}

/** Biten oyunun özeti: ileride liderlik tablosu için "ücretsiz" ve "satın alınmış" kullanım ayrımı. */
export interface FinishedGame {
  readonly id: string
  readonly mode: GameMode
  readonly score: number
  readonly lineStars: number
  readonly endStars: number
  readonly usage: JokerUsage
  /** Eğlence Modu'nda satın alınmış en az bir joker kullanıldı. */
  readonly usedPurchased: boolean
}

/**
 * Eğlence Modu'nun ek rekorları. Mevcut Eğlence rekoru (popgrid:v1:best:eglence) AYRI kalır ve
 * bunlardan etkilenmez; bunlar yalnızca ileride ayrımlı sıralama için hazırlanır.
 */
export interface FunBests {
  readonly withoutPurchased: number
  readonly withPurchased: number
}

export interface EconomyTotals {
  readonly earned: number
  readonly spent: number
  readonly gamesFinished: number
  /** Bitmeden bırakılan (sayfa kapandı, yeni oyun açıldı) oyunlar: oyun sonu ödülü verilmedi. */
  readonly gamesAbandoned: number
}

export interface EconomyState {
  readonly schemaVersion: typeof ECONOMY_SCHEMA_VERSION
  readonly stars: number
  /** Satın alınmış jokerler (oyunlar arasında korunur). */
  readonly inventory: JokerCharges
  readonly active: ActiveGame | null
  readonly history: readonly FinishedGame[]
  readonly funBests: FunBests
  readonly totals: EconomyTotals
  /** Son işlenen satın alma istek kimlikleri (çift dokunuş koruması). */
  readonly purchaseIds: readonly string[]
}

export type EconomyFailure =
  | 'noActiveGame'
  | 'wrongGame'
  | 'staleMove'
  | 'duplicateGame'
  | 'invalidInput'
  | 'insufficientStars'
  | 'duplicatePurchase'
  | 'inventoryFull'

export type EconomyResult =
  | { readonly ok: true; readonly state: EconomyState; readonly stars: number }
  | { readonly ok: false; readonly state: EconomyState; readonly reason: EconomyFailure }

const ZERO_USAGE: JokerUsage = { free: NO_JOKERS, purchased: NO_JOKERS }

export function initialEconomy(inventory: JokerCharges = NO_JOKERS): EconomyState {
  return {
    schemaVersion: ECONOMY_SCHEMA_VERSION,
    stars: 0,
    inventory: { ...inventory },
    active: null,
    history: [],
    funBests: { withoutPurchased: 0, withPurchased: 0 },
    totals: { earned: 0, spent: 0, gamesFinished: 0, gamesAbandoned: 0 },
    purchaseIds: [],
  }
}

const fail = (state: EconomyState, reason: EconomyFailure): EconomyResult => ({ ok: false, state, reason })
const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64
const chargesOk = (c: JokerCharges): boolean => JOKER_KINDS.every((k) => isCount(c[k]))
const sum = (c: JokerCharges): number => c.cekic + c.yenile + c.dondur
const addStars = (stars: number, add: number): number => Math.min(MAX_STARS, stars + add)

/**
 * Yeni oyunu etkin oyun yapar. Önceki oyun bitmeden yenisi başlarsa önceki "bırakılmış" sayılır:
 * o ana kadar kazanılan hat yıldızları kalır, oyun sonu ödülü verilmez (oyun devam kaydı yok).
 * Aynı kimlikle ikinci çağrı (çift başlatma) hiçbir şeyi değiştirmez.
 */
export function startGame(
  state: EconomyState,
  id: string,
  mode: GameMode,
  inventoryAtStart: JokerCharges = NO_JOKERS,
  freeAtStart: JokerCharges = DEFAULT_FREE_JOKERS,
): EconomyResult {
  if (!validId(id) || (mode !== 'klasik' && mode !== 'eglence')) return fail(state, 'invalidInput')
  if (state.active?.id === id) return { ok: true, state, stars: 0 }
  if (state.history.some((g) => g.id === id)) return fail(state, 'duplicateGame')
  const fun = mode === 'eglence'
  const brought = fun ? inventoryAtStart : NO_JOKERS
  if (!chargesOk(brought) || !chargesOk(freeAtStart)) return fail(state, 'invalidInput')
  // Oyuna, sahip olunandan fazla satın alınmış joker getirilemez.
  if (JOKER_KINDS.some((k) => brought[k] > state.inventory[k])) return fail(state, 'invalidInput')
  const active: ActiveGame = {
    id,
    mode,
    lastAwardedMove: 0,
    lineStars: 0,
    freeAtStart: fun ? { ...freeAtStart } : NO_JOKERS,
    inventoryAtStart: { ...brought },
    usage: ZERO_USAGE,
  }
  const abandoned = state.active ? 1 : 0
  return {
    ok: true,
    stars: 0,
    state: { ...state, active, totals: { ...state.totals, gamesAbandoned: state.totals.gamesAbandoned + abandoned } },
  }
}

/**
 * Bir hamlenin hat ödülünü verir. moveCount = hamleden SONRAKİ GameState.moveCount.
 * Aynı ya da daha eski hamle numarası reddedilir: aynı hamle iki kez yıldız kazandıramaz.
 */
export function awardMove(state: EconomyState, gameId: string, moveCount: number, events: readonly GameEvent[]): EconomyResult {
  const active = state.active
  if (!active) return fail(state, 'noActiveGame')
  if (active.id !== gameId) return fail(state, 'wrongGame')
  if (!isCount(moveCount)) return fail(state, 'invalidInput')
  if (moveCount <= active.lastAwardedMove) return fail(state, 'staleMove')
  const stars = starsForMove(events)
  const added = addStars(state.stars, stars) - state.stars
  return {
    ok: true,
    stars: added,
    state: {
      ...state,
      stars: state.stars + added,
      active: { ...active, lastAwardedMove: moveCount, lineStars: active.lineStars + added },
      totals: { ...state.totals, earned: state.totals.earned + added },
    },
  }
}

/** Etkin oyunun joker kullanımını cüzdandan hesaplar (idempotent). Satın alınmış hak kullanıldıysa envanterden düşer. */
function usageFromWallet(active: ActiveGame, wallet: JokerWallet | null): JokerUsage | null {
  if (active.mode !== 'eglence' || !wallet) return active.usage
  if (!chargesOk(wallet.free) || !chargesOk(wallet.inventory)) return null
  const used = (start: JokerCharges, now: JokerCharges, before: JokerCharges): JokerCharges => {
    const out: Record<JokerKind, number> = { ...NO_JOKERS }
    for (const k of JOKER_KINDS) out[k] = Math.max(before[k], Math.max(0, start[k] - now[k]))
    return out
  }
  return {
    free: used(active.freeAtStart, wallet.free, active.usage.free),
    purchased: used(active.inventoryAtStart, wallet.inventory, active.usage.purchased),
  }
}

/**
 * Oyunun cüzdanını deftere işler: satın alınmış jokerden yeni harcanan kadar kalıcı envanter düşer.
 * Aynı cüzdan tekrar gelirse hiçbir şey değişmez. Klasik Mod'da hiçbir şey yapmaz.
 */
export function syncUsage(state: EconomyState, gameId: string, wallet: JokerWallet | null): EconomyResult {
  const active = state.active
  if (!active) return fail(state, 'noActiveGame')
  if (active.id !== gameId) return fail(state, 'wrongGame')
  const usage = usageFromWallet(active, wallet)
  if (!usage) return fail(state, 'invalidInput')
  const inventory: Record<JokerKind, number> = { ...state.inventory }
  let changed = false
  for (const k of JOKER_KINDS) {
    const delta = usage.purchased[k] - active.usage.purchased[k]
    if (delta > 0) {
      inventory[k] = Math.max(0, inventory[k] - delta)
      changed = true
    }
    if (usage.free[k] !== active.usage.free[k]) changed = true
  }
  if (!changed) return { ok: true, state, stars: 0 }
  return { ok: true, stars: 0, state: { ...state, inventory, active: { ...active, usage } } }
}

/**
 * Oyun sonu: önce son joker kullanımını işler, sonra Math.floor(skor / 100) * 5 yıldızı TEK KEZ verir
 * ve oyunu kapatır. Aynı oyun için ikinci çağrı 'noActiveGame' ya da 'wrongGame' ile reddedilir.
 */
export function finishGame(state: EconomyState, gameId: string, finalScore: number, wallet: JokerWallet | null): EconomyResult {
  if (!isCount(finalScore)) return fail(state, 'invalidInput')
  const synced = syncUsage(state, gameId, wallet)
  if (!synced.ok) return synced
  const s = synced.state
  const active = s.active!
  const endStars = addStars(s.stars, starsForFinalScore(finalScore)) - s.stars
  const usedPurchased = active.mode === 'eglence' && sum(active.usage.purchased) > 0
  const summary: FinishedGame = {
    id: active.id,
    mode: active.mode,
    score: finalScore,
    lineStars: active.lineStars,
    endStars,
    usage: active.usage,
    usedPurchased,
  }
  const funBests =
    active.mode !== 'eglence'
      ? s.funBests
      : usedPurchased
        ? { ...s.funBests, withPurchased: Math.max(s.funBests.withPurchased, finalScore) }
        : { ...s.funBests, withoutPurchased: Math.max(s.funBests.withoutPurchased, finalScore) }
  return {
    ok: true,
    stars: endStars,
    state: {
      ...s,
      stars: s.stars + endStars,
      active: null,
      history: [...s.history, summary].slice(-HISTORY_LIMIT),
      funBests,
      totals: { ...s.totals, earned: s.totals.earned + endStars, gamesFinished: s.totals.gamesFinished + 1 },
    },
  }
}

/**
 * Mağazadan joker satın alır: bakiyeden fiyatı düşer ve envantere 1 ekler — ikisi birlikte, tek yeni durumda.
 * Aynı istek kimliği ikinci kez gelirse (çift dokunuş) reddedilir; bakiye yetmezse hiçbir şey değişmez.
 */
export function purchase(state: EconomyState, kind: JokerKind, requestId: string): EconomyResult {
  if (!JOKER_KINDS.includes(kind) || !validId(requestId)) return fail(state, 'invalidInput')
  if (state.purchaseIds.includes(requestId)) return fail(state, 'duplicatePurchase')
  const price = JOKER_PRICES[kind]
  if (state.stars < price) return fail(state, 'insufficientStars')
  if (state.inventory[kind] >= MAX_INVENTORY_PER_KIND) return fail(state, 'inventoryFull')
  return {
    ok: true,
    stars: -price,
    state: {
      ...state,
      stars: state.stars - price,
      inventory: { ...state.inventory, [kind]: state.inventory[kind] + 1 },
      totals: { ...state.totals, spent: state.totals.spent + price },
      purchaseIds: [...state.purchaseIds, requestId].slice(-PURCHASE_ID_LIMIT),
    },
  }
}
