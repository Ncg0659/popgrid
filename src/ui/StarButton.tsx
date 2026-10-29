import { useEffect, useState } from 'react'
import { STAR_CHIP_MS } from '../fx/fxTiming'
import { fmtStars, fmtStarsShort } from './economyUi'
import { StarIcon } from './StarIcon'
import { chipTimeLeft, type StarPulse } from './starFeedback'
import { useStarCount } from './useStarCount'

interface Props {
  stars: number
  /** Sahiplik ya da kayıt sorunu: düğmede "!" rozeti; açıklama mağazada. */
  warn: boolean
  onOpenShop(): void
  /** Bu sekmedeki kazanım / harcama olayı (Aşama 7.3b). Yoksa bakiye sessizce güncellenir. */
  pulse?: StarPulse | null
  reducedMotion?: boolean
}

/**
 * Yıldız bakiyesi ve mağaza düğmesi. Klasik'te ipucu satırının sağında, Eğlence'de joker çubuğunun
 * son hücresinde durur (yeni satır açmaz; tahta küçülmez).
 *
 * Aşama 7.3b: bu sekmede yıldız kazanılınca düğmenin üst kenarında küçük "+N" çipi belirir (1,3 sn) ve
 * sayı 300 ms içinde yeni değere sayılır. Başka sekmenin yazdığı değişiklikte animasyon yoktur.
 * Ekran okuyucu etiketi her an gerçek bakiyeyi söyler; animasyon yalnızca gösterimdir.
 */
export function StarButton({ stars, warn, onOpenShop, pulse = null, reducedMotion = false }: Props) {
  const { shown, spending } = useStarCount(stars, pulse, reducedMotion)
  const [chip, setChip] = useState<StarPulse | null>(null)

  // Kazanım çipi: yeni kazanımda öncekinin yerini alır, 1,3 sn sonra kaldırılır.
  useEffect(() => {
    const left = chipTimeLeft(pulse, performance.now(), STAR_CHIP_MS)
    if (!pulse || left <= 0) return
    setChip(pulse)
    const t = window.setTimeout(() => setChip((c) => (c?.id === pulse.id ? null : c)), left)
    return () => window.clearTimeout(t)
  }, [pulse])

  const label = `Yıldızların ${fmtStars(stars)}. Mağazayı aç${warn ? '. Uyarı: yıldızlar şu an kaydedilmiyor' : ''}`
  return (
    <button type="button" className="star-btn" data-warn={warn || undefined} onClick={onOpenShop} aria-label={label} title="Yıldız Mağazası">
      <StarIcon />
      <span className="star-count" data-spend={spending || undefined} aria-hidden="true">
        {fmtStarsShort(shown)}
      </span>
      {chip && (
        <span key={chip.id} className="star-gain" aria-hidden="true">
          +{fmtStars(chip.amount)}
        </span>
      )}
      {warn && (
        <span className="star-warn" aria-hidden="true">
          !
        </span>
      )}
    </button>
  )
}
