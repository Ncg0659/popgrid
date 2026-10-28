import { useEffect, useRef, useState } from 'react'
import { STAR_COUNT_MS, STAR_SPEND_HOLD_MS } from '../fx/fxTiming'
import { tweenStars, type StarPulse } from './starFeedback'

/**
 * Ekranda gösterilecek yıldız sayısı (Aşama 7.3b–c). Yıldız düğmesi ve mağazadaki bakiye aynı kancayı kullanır.
 * - Bu sekmenin yeni olayında (pulse) sayı 300 ms içinde yeni değere sayılır.
 * - Harcamada (satın alma) sayı sayım boyunca ve 300 ms daha mercan renkte kalır (spending).
 * - Olay yoksa (başka sekme, ilk açılış) ya da hareketi azalt / arka planda: sayı hemen yeni değer.
 * Gerçek değer hiçbir zaman beklemez; ekran okuyucu etiketleri doğrudan `stars` kullanır.
 */
export function useStarCount(stars: number, pulse: StarPulse | null, reducedMotion: boolean): { shown: number; spending: boolean } {
  const [shown, setShown] = useState(stars)
  const shownRef = useRef(stars)
  // Bileşen sonradan kurulursa (mod değişimi, mağaza açılışı) eski olay yeniden oynamaz.
  const lastPulse = useRef<number | null>(pulse?.id ?? null)
  const [spending, setSpending] = useState(false)

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

  // Harcama rengi: sayım (300 ms) + 300 ms sabit; dönüş CSS geçişiyle 250 ms.
  useEffect(() => {
    if (!pulse || pulse.kind !== 'spend') return
    const left = STAR_COUNT_MS + STAR_SPEND_HOLD_MS - (performance.now() - pulse.at)
    if (left <= 0) return
    setSpending(true)
    const t = window.setTimeout(() => setSpending(false), left)
    return () => {
      window.clearTimeout(t)
      setSpending(false)
    }
  }, [pulse])

  return { shown, spending }
}
