import type { CellSpecial } from './specialUi'

/**
 * Aşama 8.3 — bloğun üstündeki özel işaret (yalnızca CSS + küçük SVG; görsel dosya yok).
 * Bomba: parlak yuvarlak bomba ve üstünde kalan hamle sayısı. Şanslı: altın bloğun üstünde yıldız.
 * Renk tek başına bilgi taşımaz: bombada sayı, şanslıda yıldız şekli her zaman görünür.
 * @param tick değişince sayı bir kez zıplar (sayaç azaldığında)
 */
export function SpecialMark({ special, tick }: { special: CellSpecial; tick?: number | string }) {
  if (special.kind === 'bomba') {
    return (
      <span className="sp-bomb" data-t={special.timer} aria-hidden="true">
        <span className="sp-fuse" />
        <b key={tick ?? 'n'} className={tick !== undefined ? 'sp-timer fx-tick' : 'sp-timer'}>
          {special.timer}
        </b>
      </span>
    )
  }
  return (
    <span className="sp-star" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M12 2.6l2.75 5.75 6.3.8-4.62 4.36 1.18 6.24L12 16.7l-5.61 3.05 1.18-6.24L2.95 9.15l6.3-.8z" />
      </svg>
    </span>
  )
}
