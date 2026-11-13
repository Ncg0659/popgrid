/**
 * Aşama 10.4 — Görevler paneli metinleri ve durumları (saf; DOM bilmez, Node testleriyle denenir).
 * Kurallar ve ödüller src/economy/'dedir; burası yalnızca "oyuncu ne görecek" sorusunu cevaplar.
 * Teknik birimler (oranlı puan görevinin iç sayacı) gösterilmez: yalnızca yüzde ve kalan puan karşılıkları.
 */
import { ACHIEVEMENTS, type Achievement } from '../economy/goalsCatalog'
import { currentStreak, metricValue, missionView, type DailyMission, type GoalsState } from '../economy/goals'
import type { EconomyState } from '../economy/ledger'
import { achievementRewardStatus, dailyRewardStatus } from '../economy/rewards'
import type { EconomyStatus } from './economyUi'

const fmt = (n: number) => n.toLocaleString('tr-TR')

export const TIER_LABEL: Readonly<Record<DailyMission['tier'], string>> = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor' }

/** Görevin oyuncuya görünen açıklaması. */
export function missionTitle(m: DailyMission): string {
  switch (m.kind) {
    case 'lines':
      return `${fmt(m.target)} hat temizle`
    case 'placed':
      return `${fmt(m.target)} parça yerleştir`
    case 'games':
      return m.target === 1 ? '1 oyun bitir' : `${m.target} oyun bitir`
    case 'combo':
      return `${m.target}× kombo yap`
    case 'multi':
      return `Tek hamlede ${m.target} hat temizle`
    case 'score':
      return `Tek oyunda ${fmt(m.target)} puan yap`
    case 'points':
      return `Puan topla: Klasik'te ${fmt(m.klasik ?? 0)} ya da Eğlence'de ${fmt(m.eglence ?? 0)}`
  }
}

/** Görevin altındaki kısa açıklama (yalnızca gerektiğinde). */
export function missionHint(m: DailyMission): string | null {
  if (m.kind === 'points') return 'İki moddaki puanların birlikte sayılır.'
  if (m.kind === 'combo') return 'Üst üste hat temizleyen hamleler.'
  return null
}

/** İlerleme satırı: "%40 · Kalan: Klasik'te 900 ya da Eğlence'de 2.400 puan", "12 / 25". */
export function missionProgressText(m: DailyMission): string {
  const v = missionView(m)
  if (v.done) return 'Tamamlandı'
  if (m.kind === 'points') {
    const r = v.remainingPoints!
    return `%${v.percent} · Kalan: Klasik'te ${fmt(r.klasik)} ya da Eğlence'de ${fmt(r.eglence)} puan`
  }
  if (m.kind === 'combo' || m.kind === 'multi' || m.kind === 'score') return `En iyi: ${fmt(m.progress)} / ${fmt(m.target)}`
  return `${fmt(m.progress)} / ${fmt(m.target)}`
}

// ---------------------------------------------------------------- başarımlar

export interface Series {
  readonly prefix: string
  readonly name: string
  readonly describe: (target: number) => string
}

export const SERIES: readonly Series[] = [
  { prefix: 'hat', name: 'Hat Ustası', describe: (n) => `Toplam ${fmt(n)} hat temizle` },
  { prefix: 'klasik', name: 'Klasik Rekoru', describe: (n) => `Klasik'te tek oyunda ${fmt(n)} puan` },
  { prefix: 'eglence', name: 'Eğlence Rekoru', describe: (n) => `Eğlence'de tek oyunda ${fmt(n)} puan` },
  { prefix: 'kombo', name: 'Kombo', describe: (n) => `${n}× kombo yap` },
  { prefix: 'bomba', name: 'Bombacı', describe: (n) => `Toplam ${fmt(n)} bomba patlat` },
  { prefix: 'sans', name: 'Şanslı', describe: (n) => `${fmt(n)} şanslı blok ödülü topla` },
  { prefix: 'duzenli', name: 'Düzenli', describe: (n) => `${n} gün üst üste günün 3 görevini bitir` },
]

/** kilitli: önceki basamak bitmedi · ilerliyor: sıradaki basamak · tamam: "Al" bekliyor · alindi: ödül verildi. */
export type AchievementState = 'kilitli' | 'ilerliyor' | 'tamam' | 'alindi'

export interface AchievementRow {
  readonly id: string
  readonly rewardId: string
  readonly step: number
  readonly title: string
  readonly reward: number
  readonly state: AchievementState
  /** Gösterilecek değer (hedefte kırpılır) ve hedef. */
  readonly value: number
  readonly target: number
  readonly percent: number
}

export interface AchievementGroup {
  readonly name: string
  readonly rows: readonly AchievementRow[]
}

export function achievementGroups(state: EconomyState): AchievementGroup[] {
  const status = new Map(achievementRewardStatus(state).map((s) => [s.id, s]))
  return SERIES.map((series) => {
    const items = ACHIEVEMENTS.filter((a) => a.id.startsWith(`${series.prefix}-`))
    let previousDone = true
    const rows = items.map((a: Achievement, i): AchievementRow => {
      const st = status.get(`ach:${a.id}`)!
      const raw = metricValue(state.goals, a.metric)
      const value = Math.min(raw, a.target)
      const kind: AchievementState = st.claimed ? 'alindi' : st.done ? 'tamam' : previousDone ? 'ilerliyor' : 'kilitli'
      previousDone = previousDone && st.done
      return {
        id: a.id,
        rewardId: st.id,
        step: i + 1,
        title: series.describe(a.target),
        reward: a.reward,
        state: kind,
        value,
        target: a.target,
        percent: st.done ? 100 : Math.min(99, Math.floor((value * 100) / a.target)),
      }
    })
    return { name: series.name, rows }
  })
}

// ---------------------------------------------------------------- rozet, süre, uyarı

/** Görevler düğmesindeki rozet: alınmayı bekleyen ödül sayısı (günlük + bonus + başarım). */
export function claimableCount(state: EconomyState): number {
  return [...dailyRewardStatus(state), ...achievementRewardStatus(state)].filter((r) => r.done && !r.claimed).length
}

/** Görev gününün ertesi gününün yerel gece yarısı (ms). */
export function nextDayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d! + 1).getTime()
}

/** "Yeni görevler 7 sa 12 dk sonra" metni. Görev günü yoksa null. */
export function nextMissionsText(goals: Pick<GoalsState, 'day'>, now: number): string | null {
  if (!goals.day) return null
  const left = nextDayStart(goals.day) - now
  if (left <= 60_000) return 'Yeni görevler birazdan'
  const totalMin = Math.floor(left / 60_000)
  const h = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return h > 0 ? `Yeni görevler ${h} sa ${min} dk sonra` : `Yeni görevler ${min} dk sonra`
}

/** Bu sekmede görev ilerlemesi ya da ödül neden kaydedilemiyor? (null: sorun yok) */
export function goalsBlockedReason(status: EconomyStatus, persistent: boolean): string | null {
  if (status === 'other') return 'Oyun başka bir sekmede açık. Bu sekmede görev ilerlemesi kaydedilmiyor ve ödül alınamıyor.'
  if (status === 'readonly') return 'Kayıt daha yeni bir sürümden. Bu sürümde görev ödülü alınamaz.'
  if (!persistent) return 'Kayıt yapılamıyor. Görev ödülü şu an alınamaz.'
  return null
}

/** "Al" sonucunun kısa mesajı. */
export function claimMessage(r: { ok: true; stars: number } | { ok: false; reason: string }): string {
  if (r.ok) return `+${fmt(r.stars)} ★ eklendi.`
  switch (r.reason) {
    case 'duplicateReward':
      return 'Bu ödül zaten alındı.'
    case 'notClaimable':
      return 'Bu görev henüz tamamlanmadı ya da günü geçti.'
    case 'otherTab':
      return 'Oyun başka bir sekmede açık; ödül orada alınabilir.'
    case 'readOnly':
      return 'Kayıt daha yeni bir sürümden; ödül alınamaz.'
    default:
      return 'Kayıt yapılamadı; ödül verilmedi.'
  }
}

export function streakText(goals: GoalsState, today: string): string | null {
  const n = currentStreak(goals, today)
  return n >= 2 ? `${n} gündür üç görevi de bitiriyorsun` : null
}

// ---------------------------------------------------------------- bildirimler

/** Alınmayı bekleyen ödüller (kimlik → kısa ad). Bildirim için önceki ve sonraki hâl karşılaştırılır. */
export function pendingRewards(state: EconomyState): Map<string, string> {
  const out = new Map<string, string>()
  const g = state.goals
  for (const r of dailyRewardStatus(state)) {
    if (!r.done || r.claimed) continue
    const slot = r.id.split(':')[2]
    out.set(r.id, slot === 'bonus' ? 'Üç görev bonusu' : missionTitle(g.daily[Number(slot)]!))
  }
  const groups = achievementGroups(state)
  for (const grp of groups) for (const row of grp.rows) if (row.state === 'tamam') out.set(row.rewardId, `${grp.name} ${row.step}`)
  return out
}

/**
 * Hamleden sonra yeni tamamlanan görev/başarım bildirimi. Gün değiştiyse (yeni görevler) ya da önceki hâl
 * bilinmiyorsa bildirim yok. Birden çok ise ilk ad + sayı.
 */
export function completionNotice(prev: EconomyState | null, next: EconomyState): string | null {
  if (!prev || prev.goals.day !== next.goals.day) return null
  const before = pendingRewards(prev)
  const fresh = [...pendingRewards(next)].filter(([id]) => !before.has(id) && !prev.rewardIds.includes(id))
  if (fresh.length === 0) return null
  const first = fresh[0]![1]
  const head = fresh[0]![0].startsWith('ach:') ? 'Başarım' : 'Görev tamam'
  return fresh.length === 1 ? `${head}: ${first}. Görevler'den al.` : `${fresh.length} ödül hazır. Görevler'den al.`
}

/** Gün değişiminde (alınmamış tamamlanmış ödüller otomatik eklendiyse) kısa bildirim. */
export function autoCreditNotice(prev: EconomyState | null, next: EconomyState): string | null {
  if (!prev || !prev.goals.day || prev.goals.day === next.goals.day) return null
  const added = next.totals.rewardEarned - prev.totals.rewardEarned
  return added > 0 ? `Dünün alınmamış görev ödülleri eklendi: +${fmt(added)} ★` : null
}
