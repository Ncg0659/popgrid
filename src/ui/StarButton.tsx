import { useEffect, useRef, useState } from 'react'
import { STAR_CHIP_MS, STAR_COUNT_MS } from '../fx/fxTiming'
import { fmtStars, fmtStarsShort } from './economyUi'
import { StarIcon } from './StarIcon'
import { chipTimeLeft, tweenStars, type StarPulse } from './starFeedback'

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
  const [shown, setShown] = useState(stars)
  const shownRef = useRef(stars)
  const lastPulse = useRef<number | null>(pulse?.id ?? null)
  const [chip, setChip] = useState<StarPulse | null>(null)

  useEffect(() => {
    const show = (n: number) => {
      shownRef.current = n
      setShown(n)
    }
    // Yeni olay: sayım tamamlanana kadar "yeni" sayılır (StrictMode'un çift çalıştırmasında da sayım başlar).
    const fresh = pulse !== null && pulse.id !== lastPulse.current
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (!fresh || reducedMotion || hidden) {
      if (pulse) lastPulse.current = pulse.id
      show(stars)
      return
    }
    // Önceki sayım (varsa) bu efektin temizliğinde durdu; yeni sayım ekranda görünen değerden başlar.
    const from = shownRef.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const v = tweenStars(from, stars, now - start, false, STAR_COUNT_MS)
      show(v)
      if (v !== stars) raf = requestAnimationFrame(tick)
      else lastPulse.current = pulse.id
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stars, pulse, reducedMotion])

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
      <span className="star-count" aria-hidden="true">
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
