/**
 * Olay → ses eşlemesi (Aşama 7.3a). Saf: ses çalmaz, DOM bilmez; Node testleriyle denenir.
 * Hangi olayda hangi sesin çalacağı yalnızca burada kararlaştırılır; çalma işi sound.ts'tedir.
 */
import type { Effect } from '../fx/effects'
import type { JokerFx } from '../fx/jokerEffects'
import type { JokerSound } from './sound'

export type SoundCue =
  | { readonly kind: 'place' }
  | { readonly kind: 'clear'; readonly lines: number; readonly combo: number }
  | { readonly kind: 'joker'; readonly joker: JokerSound }
  | { readonly kind: 'purchase' }

/**
 * Her başarılı hamlede tek ses: temizleme varsa temizleme arpeji, yoksa yerleştirme sesi.
 * Aşama 8.3: hat olmadan bomba patlarsa da temizleme sesi çalar (tek hat gibi; zincirde iki hat gibi).
 * Klasik'te patlama olmadığı için Klasik sesleri birebir aynıdır.
 */
export function moveCue(effect: Effect): SoundCue {
  if (effect.lines > 0) return { kind: 'clear', lines: effect.lines, combo: effect.combo }
  const blasts = effect.blasts?.length ?? 0
  if (blasts > 0) return { kind: 'clear', lines: blasts >= 2 ? 2 : 1, combo: 0 }
  return { kind: 'place' }
}

/** Joker sesi: yalnızca joker gerçekten uygulandığında (JokerFx yalnızca başarılı sonuçta oluşur). */
export function jokerCue(fx: JokerFx): SoundCue {
  return { kind: 'joker', joker: fx.kind }
}

/**
 * Satın alma sesi: yalnızca kalıcı kaydı yapılan başarılı alımda. Çift dokunuşun ikincisi (null),
 * yetersiz yıldız, başka sekme ya da kayıt hatası sessizdir.
 */
export function purchaseCue(result: { readonly ok: boolean } | null): SoundCue | null {
  return result?.ok ? { kind: 'purchase' } : null
}
