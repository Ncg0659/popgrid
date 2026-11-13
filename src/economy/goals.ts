/**
 * Aşama 10.2 — günlük görevler, seri ve başarım sayaçları: saf durum ve kurallar.
 * Depolamayı ve yıldızı bilmez (yıldız ve ödül kimlikleri src/economy/rewards.ts'tedir).
 * Motoru değiştirmez: ilerleme yalnızca motorun zaten ürettiği olaylardan okunur.
 *
 * Gün anahtarı yerel tarihtir ("YYYY-MM-DD"). Saat ileri/geri alınabilir; kurallar:
 * - Gün yalnızca İLERİ gider: bugün kayıttaki günden büyükse yeni günün görevleri üretilir.
 * - Saat geri alınırsa (bugün < kayıttaki gün) hiçbir şey yeniden üretilmez; mevcut görevler sürer.
 *   Böylece saati geri-ileri oynatarak aynı günün ödülü ikinci kez alınamaz (ödül kimlikleri günlüdür).
 * - Saat ileri alınırsa yeni gün erken başlar; her gün yine yalnızca BİR kez ödül verir. (localStorage
 *   oyuncunun cihazındadır; saat değiştirmeye karşı tam koruma mümkün değildir. Bkz. rewards.ts.)
 */
import { createRng, seedFromString } from '../engine/rng'
import type { GameEvent } from '../engine/types'
import {
  ACHIEVEMENTS,
  DAILY_REWARDS,
  DAILY_TIERS,
  GOALS_CATALOG_VERSION,
  type Achievement,
  type AchievementMetric,
  type DailyKind,
  type DailyTier,
  dailyPools,
  pointWeight,
} from './goalsCatalog'

export interface DailyMission {
  readonly tier: DailyTier
  readonly kind: DailyKind
  readonly target: number
  readonly reward: number
  /** Hedefe kadar kırpılır (en çok target). 'points' görevinde tam sayı birimdir. */
  readonly progress: number
  /** Yalnızca 'points': Klasik'te gereken puan (gösterim ve ağırlık). */
  readonly klasik?: number
  /** Yalnızca 'points': Eğlence'de gereken puan. */
  readonly eglence?: number
}

export interface GoalCounters {
  /** Toplam temizlenen hat (Aşama 10'dan itibaren). */
  readonly lines: number
  readonly placed: number
  readonly games: number
  readonly bombs: number
  readonly lucky: number
  readonly maxCombo: number
  readonly bestKlasik: number
  readonly bestEglence: number
}

export interface Streak {
  /** Son tamamlanan seri uzunluğu (lastDay'de biter). */
  readonly count: number
  /** Üç görevin hepsinin tamamlandığı son gün; yoksa null. */
  readonly lastDay: string | null
  readonly best: number
}

export interface GoalsState {
  /**
   * Şu anki günlük görevlerin üretildiği katalog sürümü. Sürüm yükseldiğinde o günün eski görevleri gün
   * sonuna kadar kalır (ilerleme ve ödül kimlikleri bozulmasın); yeni gün güncel sürümle üretilir.
   */
  readonly catalog: number
  /** Şu anki görevlerin günü (görülen en ileri gün); hiç üretilmediyse null. */
  readonly day: string | null
  /** O günün üç görevi (kolay, orta, zor). day null ise boş. */
  readonly daily: readonly DailyMission[]
  readonly streak: Streak
  readonly counters: GoalCounters
  /** Geriye dönük rekor taraması yapıldı mı (yalnızca bir kez). */
  readonly retroDone: boolean
}

export const ZERO_COUNTERS: GoalCounters = {
  lines: 0,
  placed: 0,
  games: 0,
  bombs: 0,
  lucky: 0,
  maxCombo: 0,
  bestKlasik: 0,
  bestEglence: 0,
}

export function initialGoals(): GoalsState {
  return {
    catalog: GOALS_CATALOG_VERSION,
    day: null,
    daily: [],
    streak: { count: 0, lastDay: null, best: 0 },
    counters: ZERO_COUNTERS,
    retroDone: false,
  }
}

// ---------------------------------------------------------------- gün anahtarı

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** "YYYY-MM-DD" ve gerçek bir takvim günü mü? (Sözlük sırası = tarih sırası.) */
export function isDayKey(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const m = DAY_RE.exec(v)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 2000 || y > 9999) return false
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Yerel takvim günü (oyuncunun saat dilimi). Saat dışarıdan verilir: testte sahte saat kullanılabilir. */
export function localDayKey(t: number): string {
  const d = new Date(t)
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Bir önceki takvim günü. */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d! - 1))
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** İki gün arasındaki fark (b − a, gün). */
export function dayDiff(a: string, b: string): number {
  const ms = (k: string) => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y!, m! - 1, d!)
  }
  return Math.round((ms(b) - ms(a)) / 86_400_000)
}

// ---------------------------------------------------------------- günlük görevler

/**
 * Günün görevleri: aynı gün + aynı katalog sürümü = aynı görevler (her cihazda). Oyun tohumundan bağımsızdır;
 * oyunun rastgele akışını tüketmez. Üç görev farklı türdedir ve hepsi Klasik'te de tamamlanabilir.
 */
export function dailyMissions(day: string, catalog = GOALS_CATALOG_VERSION): DailyMission[] {
  const rng = createRng(seedFromString(`popgrid-gorev-${catalog}:${day}`))
  const used = new Set<DailyKind>()
  const out: DailyMission[] = []
  for (const tier of DAILY_TIERS) {
    const pool = dailyPools(catalog)[tier].filter((t) => !used.has(t.kind))
    const pick = pool[rng.nextInt(pool.length)]!
    used.add(pick.kind)
    const pts = pick.kind === 'points' ? { klasik: pick.klasik!, eglence: pick.eglence! } : {}
    out.push({ tier, kind: pick.kind, target: pick.target, reward: DAILY_REWARDS[tier], progress: 0, ...pts })
  }
  return out
}

export const missionDone = (m: DailyMission): boolean => m.progress >= m.target
export const allDailyDone = (g: GoalsState): boolean => g.daily.length === DAILY_TIERS.length && g.daily.every(missionDone)

// ---------------------------------------------------------------- ilerleme

/** Bir hamlenin (ya da oyun sonunun) görevlere katkısı. Hepsi motor olaylarından çıkarılır. */
export interface Progress {
  readonly lines: number
  readonly placed: number
  readonly games: number
  /** Ulaşılan puan (en yüksek). */
  readonly score: number
  /** Kazanılan puan (toplam; hamle puanı + bomba patlaması). 'points' görevi bunu moda göre birime çevirir. */
  readonly scoreSum: number
  readonly combo: number
  /** Tek hamlede temizlenen hat. */
  readonly multi: number
  readonly bombs: number
  readonly lucky: number
}

export const NO_PROGRESS: Progress = { lines: 0, placed: 0, games: 0, score: 0, scoreSum: 0, combo: 0, multi: 0, bombs: 0, lucky: 0 }

/**
 * Hamle olaylarından ilerleme. Hat = 'cleared' olayındaki satır + sütun (bomba patlaması ve Çekiç hat sayılmaz;
 * Çekiç zaten bu yoldan geçmez). Şanslı blok: ödülü verilen her blok bir sayılır (yıldıza dönüşen joker dahil).
 */
export function progressFromEvents(events: readonly GameEvent[]): Progress {
  let lines = 0
  let placed = 0
  let score = 0
  let scoreSum = 0
  let combo = 0
  let multi = 0
  let bombs = 0
  let lucky = 0
  for (const e of events) {
    if (e.type === 'cleared') {
      const n = e.rows.length + e.cols.length
      lines += n
      multi = Math.max(multi, n)
    } else if (e.type === 'placed') placed += 1
    else if (e.type === 'scored') {
      score = Math.max(score, e.score)
      scoreSum += e.breakdown.total
    } else if (e.type === 'exploded') {
      bombs += e.bombs.length
      scoreSum += e.points
      score = Math.max(score, e.score)
    } else if (e.type === 'combo') combo = Math.max(combo, e.combo)
    else if (e.type === 'luckyReward') lucky += 1
    else if (e.type === 'gameOver') score = Math.max(score, e.score)
  }
  // Tek temizleme yapan hamle kombo 1'dir (motor kombo olayını 2'den itibaren yollar).
  if (lines > 0) combo = Math.max(combo, 1)
  return { lines, placed, games: 0, score, scoreSum, combo, multi, bombs, lucky }
}

const SUMMED: ReadonlySet<DailyKind> = new Set(['lines', 'placed', 'games', 'points'])

function advanceMission(m: DailyMission, p: Progress, mode: ModeInfo['mode']): DailyMission {
  // Oranlı puan: kazanılan puan × oyunun modunun birim değeri (tam sayı; yuvarlama yok).
  const value = m.kind === 'points' ? p.scoreSum * pointWeight(m, mode) : p[m.kind as Exclude<DailyKind, 'points'>]
  if (value <= 0) return m
  const next = Math.min(m.target, SUMMED.has(m.kind) ? m.progress + value : Math.max(m.progress, value))
  return next === m.progress ? m : { ...m, progress: next }
}

/** Seri: günün üç görevi tamamlanınca bir kez. Dün de tamamlandıysa seri uzar, yoksa 1'den başlar. */
function bumpStreak(s: Streak, day: string): Streak {
  if (s.lastDay === day) return s
  const count = s.lastDay !== null && s.lastDay === previousDay(day) ? s.count + 1 : 1
  return { count, lastDay: day, best: Math.max(s.best, count) }
}

export interface ModeInfo {
  readonly mode: 'klasik' | 'eglence'
  /** Özel bloklu Eğlence oyunu mu (Aşama 8 kural sürümü var). */
  readonly ozel: boolean
}

/**
 * İlerlemeyi uygular: sayaçlar, (gün seçiliyse) günlük görevler ve seri. Saf; yeni durum döndürür.
 * Hem Klasik hem Eğlence ilerlemeye sayılır (Aşama 10.1, karar 4).
 */
export function applyProgress(g: GoalsState, p: Progress, info: ModeInfo): GoalsState {
  const c = g.counters
  const counters: GoalCounters = {
    lines: c.lines + p.lines,
    placed: c.placed + p.placed,
    games: c.games + p.games,
    bombs: c.bombs + p.bombs,
    lucky: c.lucky + p.lucky,
    maxCombo: Math.max(c.maxCombo, p.combo),
    bestKlasik: info.mode === 'klasik' ? Math.max(c.bestKlasik, p.score) : c.bestKlasik,
    bestEglence: info.mode === 'eglence' && info.ozel ? Math.max(c.bestEglence, p.score) : c.bestEglence,
  }
  const daily = g.daily.map((m) => advanceMission(m, p, info.mode))
  const changed = daily.some((m, i) => m !== g.daily[i])
  let next: GoalsState = { ...g, counters, daily: changed ? daily : g.daily }
  if (next.day !== null && !allDailyDone(g) && allDailyDone(next)) next = { ...next, streak: bumpStreak(next.streak, next.day) }
  return next
}

/** Gün değişimi: bugün kayıttaki günden ilerideyse yeni görevler. Geri ya da aynı gün: değişiklik yok. */
export function advanceDay(g: GoalsState, today: string): GoalsState {
  if (!isDayKey(today)) return g
  if (g.day !== null && today <= g.day) return g
  return { ...g, catalog: GOALS_CATALOG_VERSION, day: today, daily: dailyMissions(today) }
}

/** Geriye dönük açılış (Aşama 10.1, karar 3): mevcut rekor kayıtlarından doğrulanabilen sayaçlar. Bir kez. */
export function applyRetroactive(g: GoalsState, records: { readonly bestKlasik: number; readonly bestEglence: number }): GoalsState {
  if (g.retroDone) return g
  const ok = (n: number) => (Number.isSafeInteger(n) && n > 0 ? n : 0)
  return {
    ...g,
    retroDone: true,
    counters: {
      ...g.counters,
      bestKlasik: Math.max(g.counters.bestKlasik, ok(records.bestKlasik)),
      bestEglence: Math.max(g.counters.bestEglence, ok(records.bestEglence)),
    },
  }
}

// ---------------------------------------------------------------- gösterim (arayüz için, saf)

/** Bir görevin oyuncuya gösterilecek hâli. Teknik birim gösterilmez. */
export interface MissionView {
  readonly done: boolean
  /** 0–100 tam sayı; 100 yalnızca tamamlanınca (aşağı yuvarlanır: %99,9 → %99). */
  readonly percent: number
  /** Kalan: sayı görevlerinde adet; tek oyun puanı/kombo/çoklu için hedef değeri. */
  readonly remaining: number
  /** Yalnızca 'points': kalan ilerlemenin Klasik ve Eğlence puanı karşılığı (yukarı yuvarlanır: yetecek puan). */
  readonly remainingPoints?: { readonly klasik: number; readonly eglence: number }
}

export function missionView(m: DailyMission): MissionView {
  const left = Math.max(0, m.target - m.progress)
  const done = left === 0
  const percent = done ? 100 : Math.min(99, Math.floor((m.progress * 100) / m.target))
  if (m.kind !== 'points') return { done, percent, remaining: left }
  const k = pointWeight(m, 'klasik')
  const e = pointWeight(m, 'eglence')
  return {
    done,
    percent,
    remaining: left,
    remainingPoints: { klasik: k > 0 ? Math.ceil(left / k) : 0, eglence: e > 0 ? Math.ceil(left / e) : 0 },
  }
}

// ---------------------------------------------------------------- başarımlar

export function metricValue(g: GoalsState, metric: AchievementMetric): number {
  if (metric === 'bestStreak') return g.streak.best
  return g.counters[metric]
}

/** Koşulu sağlanmış (açılmış) başarımlar. Ödülün alınıp alınmadığı rewards.ts'te (rewardIds). */
export function unlockedAchievements(g: GoalsState): Achievement[] {
  return ACHIEVEMENTS.filter((a) => metricValue(g, a.metric) >= a.target)
}

/** Görünen seri: dün ya da bugün tamamlandıysa sürer, yoksa 0. */
export function currentStreak(g: GoalsState, today: string): number {
  const s = g.streak
  if (s.lastDay === null || !isDayKey(today)) return 0
  const diff = dayDiff(s.lastDay, today)
  return diff === 0 || diff === 1 ? s.count : 0
}
