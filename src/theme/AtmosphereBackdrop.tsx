import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { ATMOSPHERE_FADE_MS, ATMOSPHERE_LEVELS, atmosphereGradient } from './atmosphere'

/** Geçiş süresi yapılandırmadan gelir (CSS değişkeni olarak). */
const FADE_STYLE = { '--atmos-fade': `${ATMOSPHERE_FADE_MS}ms` } as CSSProperties

/**
 * Dinamik Atmosfer katmanları. `.game`'in kendi arka planı ilk seviyedir ("Sakin"); üst seviyeler bunun
 * üzerine birer katman olarak serilir ve yalnızca opaklıkları değişir (CSS geçişi, ekran kartında yapılır;
 * gradient'in kendisi canlandırılmaz, JavaScript animasyon döngüsü yoktur).
 *
 * "Sakin" seviyesinde katmanlar sayfada HİÇ YOKTUR: ekran ve maliyet önceki sürümle birebir aynıdır
 * (katmanların yalnızca varlığı bile tarayıcının köşe yumuşatmasını değiştirebiliyor). İlk eşikte eklenir,
 * önce görünmez çizilir, sonra yumuşakça belirir; yeni oyunda yumuşakça kaybolur ve geçiş bitince kaldırılır.
 *
 * memo: puan her hamlede değişir ama bu bileşen yalnızca SEVİYE değişince yeniden çizilir.
 * Katmanlar dekoratiftir: ekran okuyucudan gizli, dokunmaya kapalı.
 */
export const AtmosphereBackdrop = memo(function AtmosphereBackdrop({ level, instant }: { level: number; instant: boolean }) {
  // mounted: katmanlar sayfada mı; shown: hedef opaklıklar uygulanabilir mi (ilk çizim görünmez yapılır).
  const [mounted, setMounted] = useState(level > 0)
  const [shown, setShown] = useState(level > 0)
  const ref = useRef<HTMLDivElement>(null)
  const levelRef = useRef(level)
  levelRef.current = level

  useLayoutEffect(() => {
    if (level > 0 && !mounted) setMounted(true)
    // Hareketi Azalt: geçiş yok, beklemeden kaldır.
    if (level === 0 && mounted && instant) {
      setMounted(false)
      setShown(false)
    }
  }, [level, mounted, instant])

  useLayoutEffect(() => {
    if (!mounted || shown) return
    // Görünmez ilk hâlin tarayıcıda hesaplandığından emin ol; ardından hedef opaklık bir geçiş başlatır.
    const first = ref.current?.firstElementChild
    if (first) getComputedStyle(first).getPropertyValue('opacity')
    setShown(true)
  }, [mounted, shown])

  if (!mounted) return null

  /** Kaybolma geçişi bitince (yeni oyun) katmanları kaldır. */
  const onTransitionEnd = () => {
    if (levelRef.current !== 0) return
    setMounted(false)
    setShown(false)
  }

  return (
    <div
      ref={ref}
      className="atmos"
      aria-hidden="true"
      data-instant={instant ? '' : undefined}
      style={FADE_STYLE}
      onTransitionEnd={onTransitionEnd}
      onTransitionCancel={onTransitionEnd}
    >
      {ATMOSPHERE_LEVELS.slice(1).map((l, i) => (
        <div
          key={l.id}
          className="atmos-layer"
          data-atmos={l.id}
          style={{ backgroundImage: atmosphereGradient(l), opacity: shown && i + 1 <= level ? 1 : 0 }}
        />
      ))}
    </div>
  )
})
