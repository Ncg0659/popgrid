/**
 * Aşama 10 — günlük görevler ve başarımlar: katalog (saf veri).
 *
 * Kurallar (kullanıcı kararları, Aşama 10.1):
 * - Günlük 3 görev: kolay 10 ★, orta 20 ★, zor 30 ★; üçü birden tamamlanınca +20 ★ (günde en çok 80 ★).
 * - Günlük görevlerin HEPSİ Klasik Mod'da da tamamlanabilir (Eğlence'ye özel görev türü yok).
 * - Başarımlar tek seferliktir; 7 seri × 3 basamak = 21 başarım, toplam 1.775 ★ (tests/goals.test.ts sınar).
 * - Ödüller elle "Al" ile toplanır; gün biterken alınmamış tamamlanmış günlük ödüller otomatik eklenir.
 *
 * Katalog değişirse GOALS_CATALOG_VERSION artırılır: aynı gün + aynı sürüm = aynı görevler.
 */

export const GOALS_CATALOG_VERSION = 1

/** Görev türleri: hepsi motorun mevcut olaylarından ve oyun durumundan sayılır (motor değişmez). */
export type DailyKind =
  /** Gün içinde temizlenen satır+sütun sayısı (Çekiç ve bomba patlaması hat sayılmaz). */
  | 'lines'
  /** Gün içinde yerleştirilen parça sayısı. */
  | 'placed'
  /** Gün içinde bitirilen oyun sayısı (yarıda bırakılan sayılmaz). */
  | 'games'
  /** Tek oyunda ulaşılan puan (oyun sürerken de sayılır). */
  | 'score'
  /** Üst üste hat temizleyen hamle sayısı (kombo). */
  | 'combo'
  /** Tek hamlede temizlenen hat sayısı. */
  | 'multi'

export type DailyTier = 'kolay' | 'orta' | 'zor'

export interface DailyTemplate {
  readonly kind: DailyKind
  readonly target: number
}

export const DAILY_REWARDS: Readonly<Record<DailyTier, number>> = { kolay: 10, orta: 20, zor: 30 }
/** Günün üç görevi birden tamamlanınca. */
export const DAILY_BONUS = 20
export const DAILY_TIERS: readonly DailyTier[] = ['kolay', 'orta', 'zor']

/** Zorluk havuzları. Bir günün üç görevi birbirinden farklı türde seçilir. Hedefler Aşama 10.3 simülasyonuyla gözden geçirilecek. */
export const DAILY_POOLS: Readonly<Record<DailyTier, readonly DailyTemplate[]>> = {
  kolay: [
    { kind: 'lines', target: 10 },
    { kind: 'placed', target: 25 },
    { kind: 'games', target: 1 },
  ],
  orta: [
    { kind: 'lines', target: 25 },
    { kind: 'score', target: 1000 },
    { kind: 'combo', target: 3 },
    { kind: 'games', target: 2 },
  ],
  zor: [
    { kind: 'lines', target: 50 },
    { kind: 'score', target: 2500 },
    { kind: 'multi', target: 3 },
    { kind: 'combo', target: 5 },
  ],
}

/** Başarım sayaçları (toplam ya da en iyi değer). */
export type AchievementMetric =
  /** Toplam temizlenen hat (Aşama 10'dan itibaren; öncesi kayıtlı değildi). */
  | 'lines'
  /** Klasik en yüksek puan (geriye dönük: popgrid:v1:best). */
  | 'bestKlasik'
  /** Özel bloklu Eğlence en yüksek puan (geriye dönük: popgrid:v1:best:eglence-ozel ve ekonomi kaydındaki funBestsOzel). */
  | 'bestEglence'
  /** Ulaşılan en yüksek kombo. */
  | 'maxCombo'
  /** Toplam patlayan bomba (Eğlence). */
  | 'bombs'
  /** Toplam ödülü alınan şanslı blok (Eğlence). */
  | 'lucky'
  /** En uzun seri: günün üç görevinin hepsinin tamamlandığı ardışık günler. */
  | 'bestStreak'

export interface Achievement {
  readonly id: string
  readonly metric: AchievementMetric
  readonly target: number
  readonly reward: number
}

const series = (prefix: string, metric: AchievementMetric, steps: ReadonlyArray<readonly [number, number]>): Achievement[] =>
  steps.map(([target, reward], i) => ({ id: `${prefix}-${i + 1}`, metric, target, reward }))

export const ACHIEVEMENTS: readonly Achievement[] = [
  ...series('hat', 'lines', [
    [100, 25],
    [1000, 75],
    [5000, 200],
  ]),
  ...series('klasik', 'bestKlasik', [
    [1000, 25],
    [3000, 75],
    [6000, 150],
  ]),
  ...series('eglence', 'bestEglence', [
    [1000, 25],
    [3000, 75],
    [6000, 150],
  ]),
  ...series('kombo', 'maxCombo', [
    [3, 25],
    [5, 50],
    [8, 100],
  ]),
  ...series('bomba', 'bombs', [
    [10, 25],
    [100, 75],
    [500, 150],
  ]),
  ...series('sans', 'lucky', [
    [10, 25],
    [50, 75],
    [200, 150],
  ]),
  ...series('duzenli', 'bestStreak', [
    [3, 25],
    [7, 75],
    [30, 200],
  ]),
]

/** Mevcut kayıtlardan doğrulanabildiği için geriye dönük açılabilen sayaçlar (Aşama 10.1, karar 3). */
export const RETROACTIVE_METRICS: readonly AchievementMetric[] = ['bestKlasik', 'bestEglence']
