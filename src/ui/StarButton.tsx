import { useEffect, useRef, useState } from 'react'
import { fmtStars, fmtStarsShort } from './economyUi'
import { StarIcon } from './StarIcon'

interface Props {
  stars: number
  /** Sahiplik ya da kayıt sorunu: düğmede "!" rozeti; açıklama mağazada. */
  warn: boolean
  onOpenShop(): void
}

/**
 * Yıldız bakiyesi ve mağaza düğmesi. Klasik'te ipucu satırının sağında, Eğlence'de joker çubuğunun
 * son hücresinde durur (yeni satır açmaz; tahta küçülmez). Yıldız kazanılınca sayı kısa bir an zıplar.
 */
export function StarButton({ stars, warn, onOpenShop }: Props) {
  const prev = useRef(stars)
  const [bump, setBump] = useState(0)

  useEffect(() => {
    if (stars > prev.current) setBump((n) => n + 1)
    prev.current = stars
  }, [stars])

  const label = `Yıldızların ${fmtStars(stars)}. Mağazayı aç${warn ? '. Uyarı: yıldızlar şu an kaydedilmiyor' : ''}`
  return (
    <button type="button" className="star-btn" data-warn={warn || undefined} onClick={onOpenShop} aria-label={label} title="Yıldız Mağazası">
      <StarIcon />
      <span key={bump} className={bump ? 'star-count fx-star' : 'star-count'} aria-hidden="true">
        {fmtStarsShort(stars)}
      </span>
      {warn && (
        <span className="star-warn" aria-hidden="true">
          !
        </span>
      )}
    </button>
  )
}
