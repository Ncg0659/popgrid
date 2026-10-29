/**
 * Dinamik Atmosfer — oyun ekranının arka plan renkleri, MEVCUT oyunun puanına göre.
 *
 * Tek yapılandırma burasıdır: eşikleri ve renkleri yalnızca bu dosyada değiştir.
 * - Seviyeyi yalnızca bu oyunun puanı belirler (rekor, yıldız bakiyesi etkilemez).
 * - İlk seviye ("Sakin"), game.css'teki `.game` arka planıyla birebir aynıdır; o seviyede ek katman çizilmez.
 * - Renkler açık pastel kalır: oyun ekranındaki ikincil yazı rengi (#6a5a96) her renk durağında en az 4.5:1
 *   kontrast verir (tests/atmosphere.test.ts denetler).
 *
 * Saf modül: React, DOM ve zamanlayıcı içermez.
 */

export interface AtmosphereLevel {
  /** CSS ve testlerde kullanılan kısa ad. */
  readonly id: 'sakin' | 'isiniyor' | 'yuksek' | 'zirve'
  /** Oyuncuya dönük ad (yalnızca belgelerde ve testlerde; ekranda yazmaz). */
  readonly name: string
  /** Bu seviyenin başladığı puan (dahil). */
  readonly minScore: number
  /** Yukarıdan aşağıya dört renk durağı: %0, %24, %58, %100 (mevcut arka planın yapısı). */
  readonly stops: readonly [string, string, string, string]
}

/** Renk duraklarının konumları (yüzde). Mevcut `.game` arka planıyla aynı. */
export const ATMOSPHERE_STOP_POSITIONS = [0, 24, 58, 100] as const

/** Geçiş süresi (ms). Hareketi Azalt açıkken geçiş anında olur. */
export const ATMOSPHERE_FADE_MS = 1000

export const ATMOSPHERE_LEVELS: readonly AtmosphereLevel[] = [
  // Mevcut görünüm: gökyüzü mavisinden kremaya, tereyağı sarısına.
  { id: 'sakin', name: 'Sakin', minScore: 0, stops: ['#c6efff', '#e8f8ff', '#fff3cf', '#ffe3a6'] },
  // Şeftali / mercan.
  { id: 'isiniyor', name: 'Isınıyor', minScore: 1000, stops: ['#ffe0d2', '#fff1e8', '#ffe6d6', '#ffd8c6'] },
  // Pembe / turuncu.
  { id: 'yuksek', name: 'Yüksek enerji', minScore: 2500, stops: ['#ffd9ea', '#ffeef4', '#ffe4cc', '#ffd9b5'] },
  // Mor / mercan.
  { id: 'zirve', name: 'Zirve', minScore: 5000, stops: ['#e8dcff', '#f3eaff', '#ffe0e6', '#ffd6dc'] },
]

/** Puanın düştüğü seviyenin sırası (0 = Sakin). Negatif ya da geçersiz puan 0 sayılır. */
export function atmosphereIndex(score: number, levels: readonly AtmosphereLevel[] = ATMOSPHERE_LEVELS): number {
  if (!Number.isFinite(score)) return 0
  let index = 0
  for (let i = 0; i < levels.length; i++) {
    if (score >= levels[i]!.minScore) index = i
  }
  return index
}

/** Bir seviyenin CSS gradient'i (mevcut `.game` arka planıyla aynı yapı). */
export function atmosphereGradient(level: AtmosphereLevel): string {
  const parts = level.stops.map((c, i) => `${c} ${ATMOSPHERE_STOP_POSITIONS[i]}%`)
  return `linear-gradient(180deg, ${parts.join(', ')})`
}
