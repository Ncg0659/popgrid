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
 *   (bakiye, envanter, etkin oyun, geçmiş, rekorlar, toplamlar) aynen taşınır.
 * - 2 → 3 (Aşama 8): özel bloklu Eğlence alanları — etkin oyunda funRules ve freeGranted, biten oyunda funRules,
 *   ayrı rekorlar funBestsOzel. Eski kayıtta yoktur: etkin/biten oyun "Aşama 8 öncesi" sayılır, funBestsOzel 0'dır.
 *   Diğer bütün alanlar aynen taşınır. İlk yazmada kayıt 3 olur.
 * - 3 → 4 (Aşama 10.2): goals (görevler, seri, sayaçlar), rewardIds, totals.rewardEarned. Eski kayıtta yoktur:
 *   boş görev durumu, boş kimlik listesi ve 0 olarak taşınır (geriye dönük rekor taraması ilk işlemde yapılır).
 *   Diğer bütün alanlar aynen taşınır.
 *
 * Şema 4'te bozuk goals alanı: YALNIZCA görev durumu sıfırlanır (goalsReset: true); bakiye, envanter ve
 * rewardIds korunur. Verilmiş ödüller rewardIds'te kaldığı için sıfırlama çift ödüle yol açmaz.
 * Bozuk rewardIds ya da rewardEarned ise bütün kayıt 'corrupt' sayılır (çift ödül koruması tahminle onarılmaz).
 */
import { JOKER_KINDS, NO_JOKERS } from '../engine/jokers'
import type { GameMode, JokerCharges } from '../engine/types'
import { DAILY_REWARDS, DAILY_TIERS, GOALS_CATALOG_VERSION, KNOWN_CATALOG_VERSIONS, dailyPools, type DailyKind } from './goalsCatalog'
import { initialGoals, isDayKey, type DailyMission, type GoalCounters, type GoalsState } from './goals'
import { parseRewardId } from './rewards'
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
  /** Aşama 10.2: kayıt geçerliydi ama görev durumu bozuktu ve yalnızca o sıfırlandı. */
  readonly goalsReset?: boolean
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

/** Aşama 8 alanı: yoksa undefined (Aşama 8 öncesi), varsa 1 veya üstü tamsayı olmalı; geçersizse null. */
const funRulesField = (v: unknown): number | undefined | null => (v === undefined ? undefined : typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 && v <= 999 ? v : null)

function active(v: unknown, version: number): ActiveGame | null | undefined {
  if (v === null) return null
  if (!isObj(v)) return undefined
  // Şema 1–2'de Aşama 8 alanları yoktur: oyun "Aşama 8 öncesi" sayılır.
  const funRules = version >= 3 ? funRulesField(v.funRules) : undefined
  const freeGranted = version >= 3 && v.freeGranted !== undefined ? charges(v.freeGranted) : undefined
  if (funRules === null || freeGranted === null) return undefined
  const a = {
    id: id(v.id),
    mode: mode(v.mode),
    lastAwardedMove: count(v.lastAwardedMove),
    lineStars: count(v.lineStars, MAX_STARS),
    freeAtStart: charges(v.freeAtStart),
    inventoryAtStart: charges(v.inventoryAtStart),
    usage: usage(v.usage),
  }
  if (Object.values(a).some((x) => x === null)) return undefined
  return { ...(a as ActiveGame), ...(funRules !== undefined ? { funRules } : {}), ...(freeGranted ? { freeGranted } : {}) }
}

function finished(v: unknown, version: number): FinishedGame | null {
  if (!isObj(v)) return null
  const funRules = version >= 3 ? funRulesField(v.funRules) : undefined
  if (funRules === null) return null
  const g = {
    id: id(v.id),
    mode: mode(v.mode),
    score: count(v.score),
    lineStars: count(v.lineStars, MAX_STARS),
    endStars: count(v.endStars, MAX_STARS),
    usage: usage(v.usage),
    usedPurchased: typeof v.usedPurchased === 'boolean' ? v.usedPurchased : null,
  }
  if (Object.values(g).some((x) => x === null)) return null
  return funRules !== undefined ? { ...(g as FinishedGame), funRules } : (g as FinishedGame)
}

/** Sahiplik: null ya da { tabId, until }. Geçersizse undefined. */
function owner(v: unknown): Ownership | null | undefined {
  if (v === null) return null
  if (!isObj(v)) return undefined
  const tabId = id(v.tabId)
  const until = count(v.until)
  return tabId !== null && until !== null ? { tabId, until } : undefined
}

const COUNTER_KEYS: readonly (keyof GoalCounters)[] = ['lines', 'placed', 'games', 'bombs', 'lucky', 'maxCombo', 'bestKlasik', 'bestEglence']

function mission(v: unknown, i: number, catalog: number): DailyMission | null {
  if (!isObj(v)) return null
  const tier = DAILY_TIERS[i]
  if (!tier || v.tier !== tier) return null
  const kind = v.kind as DailyKind
  // Hedef ve tür katalogdaki bir şablonla eşleşmeli; ödül kataloğun ödülü olmalı (kayıttan ödül şişirilemez).
  if (!dailyPools(catalog)[tier].some((t) => t.kind === kind && t.target === v.target)) return null
  if (v.reward !== DAILY_REWARDS[tier]) return null
  const progress = count(v.progress, v.target as number)
  return progress === null ? null : { tier, kind, target: v.target as number, reward: DAILY_REWARDS[tier], progress }
}

/** Görev durumu; geçersizse null (çağıran yalnızca görevleri sıfırlar). */
function goals(v: unknown): GoalsState | null {
  if (!isObj(v)) return null
  // Katalog sürümü: o günün görevleri hangi sürümle üretildiyse onunla doğrulanır (sürüm 1 görevleri
  // geçiş gününün sonuna kadar kalır). Bilinmeyen sürüm: görevler sıfırlanır (daha yeni sürüm için bkz. parseEconomy).
  const catalog = v.catalog
  if (typeof catalog !== 'number' || !KNOWN_CATALOG_VERSIONS.includes(catalog)) return null
  const day = v.day === null ? null : isDayKey(v.day) ? v.day : undefined
  if (day === undefined) return null
  if (!Array.isArray(v.daily) || v.daily.length !== (day === null ? 0 : DAILY_TIERS.length)) return null
  const daily = v.daily.map((m, i) => mission(m, i, catalog))
  if (daily.some((m) => m === null)) return null
  if (new Set(daily.map((m) => m!.kind)).size !== daily.length) return null
  const st = isObj(v.streak) ? v.streak : null
  const streak = st && {
    count: count(st.count),
    lastDay: st.lastDay === null ? null : isDayKey(st.lastDay) ? st.lastDay : undefined,
    best: count(st.best),
  }
  if (!streak || streak.count === null || streak.best === null || streak.lastDay === undefined || streak.count > streak.best) return null
  const c = isObj(v.counters) ? v.counters : null
  if (!c) return null
  const counters = {} as Record<keyof GoalCounters, number>
  for (const k of COUNTER_KEYS) {
    const n = count(c[k])
    if (n === null) return null
    counters[k] = n
  }
  if (typeof v.retroDone !== 'boolean') return null
  return {
    // Gün seçilmemişse eski sürüm numarası taşınmaz: ilk görevler zaten güncel sürümle üretilecek.
    catalog: day === null ? GOALS_CATALOG_VERSION : catalog,
    day,
    daily: daily as DailyMission[],
    streak: { count: streak.count, lastDay: streak.lastDay, best: streak.best },
    counters,
    retroDone: v.retroDone,
  }
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
  // Aşama 10.3: daha yeni bir görev kataloğuyla yazılmış kayıt (eski sürüme dönülmüş): sayaçları ve seriyi
  // kaybetmemek için kayıt salt okunur kalır, görevler sıfırlanmaz.
  if (version >= 4 && isObj(v.goals) && typeof v.goals.catalog === 'number' && v.goals.catalog > GOALS_CATALOG_VERSION)
    return { status: 'future', state: initialEconomy() }

  const stars = count(v.stars, MAX_STARS)
  const inventory = charges(v.inventory)
  const act = active(v.active, version)
  const history = Array.isArray(v.history) ? v.history.map((g) => finished(g, version)) : null
  const bests = (x: unknown) => (isObj(x) ? { withoutPurchased: count(x.withoutPurchased), withPurchased: count(x.withPurchased) } : null)
  const funBests = bests(v.funBests)
  // Şema 3: özel bloklu Eğlence rekorları zorunlu. Şema 1–2'de yoktur: 0 olarak taşınır.
  const funBestsOzel = version >= 3 ? bests(v.funBestsOzel) : { withoutPurchased: 0, withPurchased: 0 }
  const t = isObj(v.totals) ? v.totals : null
  const totals = t && {
    earned: count(t.earned),
    spent: count(t.spent),
    gamesFinished: count(t.gamesFinished),
    gamesAbandoned: count(t.gamesAbandoned),
    // Şema 4: zorunlu. Şema 1–3'te yoktur: 0.
    rewardEarned: version >= 4 ? count(t.rewardEarned) : 0,
  }
  // Şema 4: verilmiş ödül kimlikleri (çift ödül koruması) — bozuksa bütün kayıt bozuk sayılır.
  const rewardIds = version >= 4 ? (Array.isArray(v.rewardIds) ? v.rewardIds.map((x) => (parseRewardId(x) ? (x as string) : null)) : null) : []
  const parsedGoals = version >= 4 ? goals(v.goals) : initialGoals()
  const goalsReset = version >= 4 && parsedGoals === null
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
    !funBestsOzel ||
    Object.values(funBestsOzel).some((x) => x === null) ||
    !totals ||
    Object.values(totals).some((x) => x === null) ||
    !purchaseIds ||
    purchaseIds.some((x) => x === null) ||
    own === undefined ||
    !rewardIds ||
    rewardIds.some((x) => x === null) ||
    new Set(rewardIds).size !== rewardIds.length
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
      funBestsOzel: funBestsOzel as EconomyState['funBestsOzel'],
      totals: totals as EconomyState['totals'],
      purchaseIds: (purchaseIds as string[]).slice(-PURCHASE_ID_LIMIT),
      owner: own,
      goals: parsedGoals ?? initialGoals(),
      rewardIds: rewardIds as string[],
    },
    ...(goalsReset ? { goalsReset: true } : {}),
  }
}

export function serializeEconomy(state: EconomyState): string {
  return JSON.stringify(state)
}
