import { useEffect, useRef, useState } from 'react'
import { fmtStars, type EconomyBanner } from './economyUi'
import { StarIcon } from './StarIcon'

interface Props {
  stars: number
  onOpenShop(): void
  /** Kısa yıldız bilgisi (ör. 300 sınırı); id değişince gösterilir, kendiliğinden kaybolur. */
  notice: { id: number; text: string } | null
  /** Sahiplik / kayıt uyarısı: rafta kısa hâliyle gösterilir; oyun aynen sürer. */
  banner: EconomyBanner | null
  onTakeOver(): void
}

/**
 * Ekranın altındaki yıldız rafı: bakiye ve mağaza düğmesi. Yıldız kazanılınca sayı kısa bir an zıplar.
 * Başka sekme sahipse ya da kayıt yazılamıyorsa raf, kısa bir açıklama (ve "Devam et") gösterir.
 */
export function StarDock({ stars, onOpenShop, notice, banner, onTakeOver }: Props) {
  const prev = useRef(stars)
  const [bump, setBump] = useState(0)
  const [shown, setShown] = useState<{ id: number; text: string } | null>(null)

  useEffect(() => {
    if (stars > prev.current) setBump((n) => n + 1)
    prev.current = stars
  }, [stars])

  useEffect(() => {
    if (!notice) return
    setShown(notice)
    const t = window.setTimeout(() => setShown(null), 3500)
    return () => window.clearTimeout(t)
  }, [notice])

  return (
    <div className="star-dock" data-warn={banner ? '' : undefined}>
      {shown && (
        <p key={shown.id} className="star-toast" role="status">
          {shown.text}
        </p>
      )}
      <button
        type="button"
        className="star-btn"
        onClick={onOpenShop}
        aria-label={`Yıldızların ${fmtStars(stars)}. Mağazayı aç`}
      >
        <StarIcon />
        <span key={bump} className={bump ? 'star-count fx-star' : 'star-count'}>
          {fmtStars(stars)}
        </span>
        {!banner && <span className="star-shop">Mağaza</span>}
      </button>
      {banner && (
        <div className="eco-note" role="status" aria-label={banner.text}>
          <p aria-hidden="true">{banner.short}</p>
          {banner.canTakeOver && (
            <button type="button" className="btn-soft eco-takeover" onClick={onTakeOver}>
              Devam et
            </button>
          )}
        </div>
      )}
    </div>
  )
}
