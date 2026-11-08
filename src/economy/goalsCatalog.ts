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
 *
 * Sürüm 2 (Aşama 10.3 simülasyonu, kullanıcı onayı): puan görevleri tek oyun yerine GÜN İÇİNDE TOPLAM puan
 * (Klasik + Eğlence birlikte): orta 1.500, zor 4.000; zor kombo 5 → 4. Başarım: Kombo-3 8 → 7, Klasik
 * 1.000 / 2.500 / 5.000. Ödüller aynı (günlük 10/20/30 + 20, başarımlar toplam 1.775 ★).
 * Sürüm geçişi (src/economy/goals.ts, schema.ts): o günün sürüm 1 görevleri ilerlemesiyle gün sonuna kadar
 * aynen kalır; ertesi gün sürüm 2 görevleri üretilir. Sayaçlar, seri ve verilmiş ödüller korunur.
 */

export const GOALS_CATALOG_VERSION = 2
/** Okunabilen (kayıtta bulunabilecek) katalog sürümleri. */
export const KNOWN_CATALOG_VERSIONS: readonly number[] = [1, 2]

/** Görev türleri: hepsi motorun mevcut olaylarından ve oyun durumundan sayılır (motor değişmez). */
export type DailyKind =
  /** Gün içinde temizlenen satır+sütun sayısı (Çekiç ve bomba patlaması hat sayılmaz). */
  | 'lines'
  /** Gün içinde yerleştirilen parça sayısı. */
  | 'placed'
  /** Gün içinde bitirilen oyun sayısı (yarıda bırakılan sayılmaz). */
  | 'games'
  /** Tek oyunda ulaşılan puan (yalnızca katalog sürüm 1; geçiş günü için okunur). */
  | 'score'
  /** Gün içinde kazanılan toplam puan (bütün oyunlar, Klasik + Eğlence; yarıda kalan oyunun puanı da). Sürüm 2. */
  | 'scoreSum'
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

/** Sürüm 1 havuzları (Aşama 10.2). Yalnızca kayıttaki eski günün görevlerini doğrulamak için tutulur. */
export const DAILY_POOLS_V1: Readonly<Record<DailyTier, readonly DailyTemplate[]>> = {
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

/** Zorluk havuzları (güncel sürüm). Bir günün üç görevi birbirinden farklı türde seçilir. */
export const DAILY_POOLS: Readonly<Record<DailyTier, readonly DailyTemplate[]>> = {
  kolay: [
    { kind: 'lines', target: 10 },
    { kind: 'placed', target: 25 },
    { kind: 'games', target: 1 },
  ],
  orta: [
    { kind: 'lines', target: 25 },
    { kind: 'scoreSum', target: 1500 },
    { kind: 'combo', target: 3 },
    { kind: 'games', target: 2 },
  ],
  zor: [
    { kind: 'lines', target: 50 },
    { kind: 'scoreSum', target: 4000 },
    { kind: 'multi', target: 3 },
    { kind: 'combo', target: 4 },
  ],
}

/** Katalog sürümüne göre havuz. */
export function dailyPools(catalog: number): Readonly<Record<DailyTier, readonly DailyTemplate[]>> {
  return catalog === 1 ? DAILY_POOLS_V1 : DAILY_POOLS
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
    [2500, 75],
    [5000, 150],
  ]),
  ...series('eglence', 'bestEglence', [
    [1000, 25],
    [3000, 75],
    [6000, 150],
  ]),
  ...series('kombo', 'maxCombo', [
    [3, 25],
    [5, 50],
    [7, 100],
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
