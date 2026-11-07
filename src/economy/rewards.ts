/**
 * Aşama 10.2 — görev ve başarım ödülleri: yıldız deftere tek kez, kimlikle.
 * Saf ve değişmez; depolama src/storage/economy.ts'te (tek anahtar, tek yazma, sahip sekme).
 *
 * Ödül kimlikleri:
 * - "daily:<gün>:<0|1|2>"  günlük görev (kolay, orta, zor)
 * - "daily:<gün>:bonus"   günün üç görevi birden (+20 ★)
 * - "ach:<başarım>"       başarım (tek seferlik)
 *
 * Çift ödül koruması: verilen her ödülün kimliği rewardIds'e AYNI yazmada eklenir; kimlik oradaysa ödül
 * ikinci kez verilmez (çift dokunuş, iki sekme, sayfa yenileme, saat oynatma). Başarım kimlikleri kalıcıdır
 * (en çok 21); günlük kimlikler yalnızca son günler için tutulur — geçmiş günlerin ödülü zaten verilemez,
 * çünkü yalnızca kayıttaki günün görevleri alınabilir ve gün yalnızca ileri gider.
 *
 * Gün sonu: bir gün kapanırken (ilk işlemde yeni gün görülünce) tamamlanmış ama "Al"a basılmamış günlük
 * ödüller otomatik eklenir; aynı kimlik kuralıyla, yalnızca bir kez.
 *
 * Görev/başarım ödülleri Eğlence'nin oyun başına 300 ★ tavanının DIŞINDADIR (oyun ödülü değildir).
 *
 * Gerçek atomiklik sınırı: localStorage'ta işlem (transaction) yoktur. Güvence tek yazıcı kuralından
 * (sahip sekme, ownership.ts) ve kaydın tek setItem ile bütün olarak yazılmasından gelir. En kötü durum
 * (zorla devralma anında yarışan iki yazma) bir güncellemenin KAYBOLMASIDIR; aynı ödülün iki kez verilmesi
 * değil — çünkü her yazma, ödül kimliğini ve yıldızı birlikte taşır.
 */
import { ACHIEVEMENTS, DAILY_BONUS, DAILY_REWARDS, DAILY_TIERS } from './goalsCatalog'
import { advanceDay, allDailyDone, dayDiff, isDayKey, metricValue, missionDone, type GoalsState } from './goals'
import { MAX_STARS, type EconomyResult, type EconomyState } from './ledger'

/** Günlük ödül kimliklerinin tutulduğu gün sayısı (bugün dahil). */
export const DAILY_ID_DAYS = 7

export type RewardRef =
  | { readonly kind: 'daily'; readonly day: string; readonly slot: 0 | 1 | 2 }
  | { readonly kind: 'bonus'; readonly day: string }
  | { readonly kind: 'ach'; readonly id: string }

export const dailyRewardId = (day: string, slot: number): string => `daily:${day}:${slot}`
export const bonusRewardId = (day: string): string => `daily:${day}:bonus`
export const achievementRewardId = (id: string): string => `ach:${id}`

/** Kimliği çözer; geçersizse null. */
export function parseRewardId(v: unknown): RewardRef | null {
  if (typeof v !== 'string' || v.length > 64) return null
  const parts = v.split(':')
  if (parts[0] === 'ach' && parts.length === 2) return ACHIEVEMENTS.some((a) => a.id === parts[1]) ? { kind: 'ach', id: parts[1]! } : null
  if (parts[0] === 'daily' && parts.length === 3 && isDayKey(parts[1])) {
    if (parts[2] === 'bonus') return { kind: 'bonus', day: parts[1] }
    const slot = Number(parts[2])
    if (parts[2] === '0' || parts[2] === '1' || parts[2] === '2') return { kind: 'daily', day: parts[1], slot: slot as 0 | 1 | 2 }
  }
  return null
}

export interface RewardStatus {
  readonly id: string
  readonly stars: number
  /** Koşul sağlandı. */
  readonly done: boolean
  /** Ödülü verildi (elle ya da gün sonunda). */
  readonly claimed: boolean
}

/** Kayıttaki günün görevleri ve bonus için ödül durumu (arayüz bunu gösterecek, Aşama 10.3). */
export function dailyRewardStatus(state: EconomyState): RewardStatus[] {
  const g = state.goals
  if (g.day === null) return []
  const day = g.day
  const out: RewardStatus[] = g.daily.map((m, i) => {
    const id = dailyRewardId(day, i)
    return { id, stars: m.reward, done: missionDone(m), claimed: state.rewardIds.includes(id) }
  })
  const bonus = bonusRewardId(day)
  out.push({ id: bonus, stars: DAILY_BONUS, done: allDailyDone(g), claimed: state.rewardIds.includes(bonus) })
  return out
}

export function achievementRewardStatus(state: EconomyState): RewardStatus[] {
  return ACHIEVEMENTS.map((a) => {
    const id = achievementRewardId(a.id)
    return { id, stars: a.reward, done: metricValue(state.goals, a.metric) >= a.target, claimed: state.rewardIds.includes(id) }
  })
}

/** Ödülün yıldızı; ödül şu an verilebilir değilse null (koşul yok, gün geçmiş ya da gelecek). */
function claimableStars(goals: GoalsState, ref: RewardRef): number | null {
  if (ref.kind === 'ach') {
    const a = ACHIEVEMENTS.find((x) => x.id === ref.id)!
    return metricValue(goals, a.metric) >= a.target ? a.reward : null
  }
  if (goals.day === null || ref.day !== goals.day) return null
  if (ref.kind === 'bonus') return allDailyDone(goals) ? DAILY_BONUS : null
  const m = goals.daily[ref.slot]
  return m && missionDone(m) ? m.reward : null
}

/** Günlük kimlikleri yalnızca son DAILY_ID_DAYS gün için tutar; başarım kimlikleri hep kalır. */
export function pruneRewardIds(ids: readonly string[], today: string | null): string[] {
  return ids.filter((id) => {
    const ref = parseRewardId(id)
    if (!ref) return false
    if (ref.kind === 'ach' || today === null) return true
    return dayDiff(ref.day, today) < DAILY_ID_DAYS
  })
}

function credit(state: EconomyState, ids: readonly string[], stars: number): EconomyState {
  const added = Math.min(MAX_STARS, state.stars + stars) - state.stars
  return {
    ...state,
    stars: state.stars + added,
    rewardIds: [...state.rewardIds, ...ids],
    totals: { ...state.totals, earned: state.totals.earned + added, rewardEarned: state.totals.rewardEarned + added },
  }
}

/**
 * "Al": ödülü TEK KEZ verir. Aynı kimlik ikinci kez gelirse 'duplicateReward'; koşul sağlanmadıysa ya da
 * gün kayıttaki gün değilse 'notClaimable'. Yıldız ve kimlik aynı yeni durumda.
 */
export function claimReward(state: EconomyState, rewardId: string): EconomyResult {
  const ref = parseRewardId(rewardId)
  if (!ref) return { ok: false, state, reason: 'invalidInput' }
  if (state.rewardIds.includes(rewardId)) return { ok: false, state, reason: 'duplicateReward' }
  const stars = claimableStars(state.goals, ref)
  if (stars === null) return { ok: false, state, reason: 'notClaimable' }
  const next = credit(state, [rewardId], stars)
  return { ok: true, state: next, stars: next.stars - state.stars }
}

export interface RolloverResult {
  readonly state: EconomyState
  /** Gün sonunda otomatik eklenen ödüller (kimlik) ve toplam yıldız. */
  readonly autoCredited: readonly string[]
  readonly autoStars: number
}

/**
 * Gün değişimi: bugün kayıttaki günden ilerideyse önce eski günün tamamlanmış ama alınmamış ödüllerini
 * (bonus dahil) ekler, sonra yeni günün görevlerini üretir. Saat geri alınmışsa ya da aynı günse aynen döner.
 */
export function rollover(state: EconomyState, today: string): RolloverResult {
  const same: RolloverResult = { state, autoCredited: [], autoStars: 0 }
  if (!isDayKey(today)) return same
  const g = state.goals
  if (g.day !== null && today <= g.day) return same
  let s = state
  const ids: string[] = []
  let stars = 0
  if (g.day !== null) {
    for (const r of dailyRewardStatus(state)) {
      if (r.done && !r.claimed) {
        ids.push(r.id)
        stars += r.stars
      }
    }
    if (ids.length > 0) s = credit(s, ids, stars)
  }
  const goals = advanceDay(s.goals, today)
  s = { ...s, goals, rewardIds: pruneRewardIds(s.rewardIds, today) }
  return { state: s, autoCredited: ids, autoStars: s.stars - state.stars }
}

/** Testler ve arayüz için: günün en çok verebileceği yıldız (3 görev + bonus). */
export const MAX_DAILY_STARS = DAILY_TIERS.reduce((n, t) => n + DAILY_REWARDS[t], 0) + DAILY_BONUS
