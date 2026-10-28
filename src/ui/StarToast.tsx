import { useEffect, useRef, useState } from 'react'
import type { EconomyBanner } from './economyUi'

interface Props {
  /** Kısa yıldız bilgisi (ör. 300 sınırı); id değişince gösterilir. */
  notice: { id: number; text: string } | null
  /** Sahiplik / kayıt uyarısı: ortaya çıktığında (ve değiştiğinde) bir kez, daha uzun gösterilir. */
  banner: EconomyBanner | null
}

/** Alt satırın üstünde beliren, dokunmayı engellemeyen kısa bilgi. Oyun aynen sürer. */
export function StarToast({ notice, banner }: Props) {
  const [shown, setShown] = useState<{ key: string; text: string; warn: boolean } | null>(null)
  const lastBanner = useRef<string | null>(null)

  useEffect(() => {
    if (!notice) return
    setShown({ key: `n${notice.id}`, text: notice.text, warn: false })
    const t = window.setTimeout(() => setShown(null), 3500)
    return () => window.clearTimeout(t)
  }, [notice])

  useEffect(() => {
    const text = banner?.text ?? null
    if (text === lastBanner.current) return
    lastBanner.current = text
    if (!text) return
    setShown({ key: `b${text}`, text, warn: true })
    const t = window.setTimeout(() => setShown(null), 6000)
    return () => window.clearTimeout(t)
  }, [banner])

  return (
    <p className="star-toast" role="status" aria-live="polite" data-shown={shown ? '' : undefined} data-warn={shown?.warn || undefined}>
      {shown && <span key={shown.key}>{shown.text}</span>}
    </p>
  )
}
