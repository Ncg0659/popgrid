/**
 * Ekonomi kaydının sürümlü biçimi: okuma, doğrulama ve eski kayıtlardan geçiş. Saf: depolamayı bilmez.
 *
 * Okuma sonuçları:
 * - 'empty'   : kayıt yok (yeni ya da Aşama 7 öncesi oyuncu). Eski envanter anahtarı varsa içeriği taşınır.
 * - 'ok'      : geçerli kayıt.
 * - 'corrupt' : JSON bozuk ya da alanlar geçersiz. Oyun çökmez; varsayılanla devam edilir
 *               (depolama katmanı bozuk kaydı silmeden önce yedekler).
 * - 'future'  : daha yeni bir sürümün kaydı (eski sürüm açıldı). Okunmaz ve ÜZERİNE YAZILMAZ.
 *
 * Sürüm geçişleri (sürümlü migrasyon):
 * - 1 → 2: sahiplik alanı (owner) eklendi; eski kayıtta yoktur, null olarak okunur. Diğer bütün alanlar
 *   (bakiye, envanter, etkin oyun, geçmiş, rekorlar, toplamlar) aynen taşınır. İlk yazmada kayıt 2 olur.
 */
import { JOKER_KINDS, NO_JOKERS } from '../engine/jokers'
import type { GameMode, JokerCharges } from '../engine/types'
import {
  ECONOMY_SCHEMA_VERSION,
  HISTORY_LIMIT,
  MAX_INVENTORY_PER_KIND,
  MAX_STARS,
  PURCHASE_ID_LIMIT,
  initialEconomy,
  type ActiveGame,
  type EconomyState,
  type FinishedGame,
  type JokerUsage,
  type Ownership,
} from './ledger'

export type EconomyLoadStatus = 'empty' | 'ok' | 'migrated' | 'corrupt' | 'future'

export interface EconomyLoad {
  readonly state: EconomyState
  readonly status: EconomyLoadStatus
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const count = (v: unknown, max = Number.MAX_SAFE_INTEGER): number | null =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max ? v : null
const id = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null)
const mode = (v: unknown): GameMode | null => (v === 'klasik' || v === 'eglence' ? v : null)

function charges(v: unknown, max = MAX_INVENTORY_PER_KIND): JokerCharges | null {
  if (!isObj(v)) return null
  const out = { cekic: 0, yenile: 0, dondur: 0 }
  for (const k of JOKER_KINDS) {
    const n = count(v[k], max)
    if (n === null) return null
    out[k] = n
  }
  return out
}

function usage(v: unknown): JokerUsage | null {
  if (!isObj(v)) return null
  const free = charges(v.free)
  const purchased = charges(v.purchased)
  return free && purchased ? { free, purchased } : null
}

function active(v: unknown): ActiveGame | null | undefined {
  if (v === null) return null
  if (!isObj(v)) return undefined
  const a = {
    id: id(v.id),
    mode: mode(v.mode),
    lastAwardedMove: count(v.lastAwardedMove),
    lineStars: count(v.lineStars, MAX_STARS),
    freeAtStart: charges(v.freeAtStart),
    inventoryAtStart: charges(v.inventoryAtStart),
    usage: usage(v.usage),
  }
  return Object.values(a).some((x) => x === null) ? undefined : (a as ActiveGame)
}

function finished(v: unknown): FinishedGame | null {
  if (!isObj(v)) return null
  const g = {
    id: id(v.id),
    mode: mode(v.mode),
    score: count(v.score),
    lineStars: count(v.lineStars, MAX_STARS),
    endStars: count(v.endStars, MAX_STARS),
    usage: usage(v.usage),
    usedPurchased: typeof v.usedPurchased === 'boolean' ? v.usedPurchased : null,
  }
  return Object.values(g).some((x) => x === null) ? null : (g as FinishedGame)
}

/** Sahiplik: null ya da { tabId, until }. Geçersizse undefined. */
function owner(v: unknown): Ownership | null | undefined {
  if (v === null) return null
  if (!isObj(v)) return undefined
  const tabId = id(v.tabId)
  const until = count(v.until)
  return tabId !== null && until !== null ? { tabId, until } : undefined
}

/** Eski (Aşama 6.2) envanter anahtarının içeriği. Bozuksa 0. */
export function parseLegacyInventory(raw: string | null): JokerCharges {
  if (!raw) return NO_JOKERS
  try {
    const v: unknown = JSON.parse(raw)
    if (!isObj(v)) return NO_JOKERS
    return charges({ cekic: v.cekic ?? 0, yenile: v.yenile ?? 0, dondur: v.dondur ?? 0 }) ?? NO_JOKERS
  } catch {
    return NO_JOKERS
  }
}

/** Kaydı doğrular. Herhangi bir alan geçersizse 'corrupt' (kısmi, tahminî onarım yapılmaz). */
export function parseEconomy(raw: string | null, legacyInventoryRaw: string | null = null): EconomyLoad {
  if (raw === null) return { status: 'empty', state: initialEconomy(parseLegacyInventory(legacyInventoryRaw)) }
  const corrupt = (): EconomyLoad => ({ status: 'corrupt', state: initialEconomy() })
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return corrupt()
  }
  if (!isObj(v)) return corrupt()
  const version = count(v.schemaVersion)
  if (version === null || version === 0) return corrupt()
  if (version > ECONOMY_SCHEMA_VERSION) return { status: 'future', state: initialEconomy() }

  const stars = count(v.stars, MAX_STARS)
  const inventory = charges(v.inventory)
  const act = active(v.active)
  const history = Array.isArray(v.history) ? v.history.map(finished) : null
  const fb = isObj(v.funBests) ? v.funBests : null
  const funBests = fb && { withoutPurchased: count(fb.withoutPurchased), withPurchased: count(fb.withPurchased) }
  const t = isObj(v.totals) ? v.totals : null
  const totals = t && {
    earned: count(t.earned),
    spent: count(t.spent),
    gamesFinished: count(t.gamesFinished),
    gamesAbandoned: count(t.gamesAbandoned),
  }
  const purchaseIds = Array.isArray(v.purchaseIds) ? v.purchaseIds.map(id) : null
  // Sürüm 1'de sahiplik alanı yoktu: null olarak taşınır.
  const own = version === 1 ? null : owner(v.owner)

  if (
    stars === null ||
    !inventory ||
    act === undefined ||
    !history ||
    history.some((g) => g === null) ||
    !funBests ||
    Object.values(funBests).some((x) => x === null) ||
    !totals ||
    Object.values(totals).some((x) => x === null) ||
    !purchaseIds ||
    purchaseIds.some((x) => x === null) ||
    own === undefined
  ) {
    return corrupt()
  }
  return {
    status: version < ECONOMY_SCHEMA_VERSION ? 'migrated' : 'ok',
    state: {
      schemaVersion: ECONOMY_SCHEMA_VERSION,
      stars,
      inventory,
      active: act,
      history: (history as FinishedGame[]).slice(-HISTORY_LIMIT),
      funBests: funBests as EconomyState['funBests'],
      totals: totals as EconomyState['totals'],
      purchaseIds: (purchaseIds as string[]).slice(-PURCHASE_ID_LIMIT),
      owner: own,
    },
  }
}

export function serializeEconomy(state: EconomyState): string {
  return JSON.stringify(state)
}
