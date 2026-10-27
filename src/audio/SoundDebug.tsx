import { useEffect, useState } from 'react'
import { playPlace, soundStatus, type SoundStatus } from './sound'

function wanted(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('debug') === 'ses'
  } catch {
    return false
  }
}

function displayMode(): string {
  try {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    return standalone ? 'ana ekran uygulaması' : 'tarayıcı'
  } catch {
    return 'bilinmiyor'
  }
}

/**
 * Ses tanı paneli — yalnızca adres ?debug=ses ile açıldığında görünür; oyuna etkisi yoktur.
 * Ekranın üstünde durur ve dokunuşları alttaki oyuna geçirir (düğmeleri hariç), böylece
 * panel açıkken de sürükleyerek test edilebilir.
 */
export function SoundDebug() {
  const [show] = useState(wanted)
  const [open, setOpen] = useState(true)
  const [status, setStatus] = useState<SoundStatus | null>(null)

  useEffect(() => {
    if (!show) return
    const id = window.setInterval(() => setStatus(soundStatus()), 400)
    return () => window.clearInterval(id)
  }, [show])

  if (!show) return null
  const s = status
  return (
    <aside className="sound-debug" data-open={open || undefined} aria-label="Ses tanı paneli">
      <div className="sound-debug-head">
        <strong>Ses tanı</strong>
        <span>
          {s ? `${s.state} · saat ${s.clock.toFixed(1)} sn · motor ${s.contexts}` : '…'}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? 'Küçült' : 'Aç'}
        </button>
      </div>
      {open && (
        <>
          <span>Açılış: {displayMode()}</span>
          <span>
            Ses tercihi: {s ? (s.enabled ? 'açık' : 'kapalı') : '…'} · Web Audio: {s ? (s.supported ? 'var' : 'YOK') : '…'}
          </span>
          <span>
            Kilit açıldı mı: {s ? (s.unlocked ? 'evet' : 'hayır') : '…'} · Arka plana gidiş: {s?.backgrounds ?? 0}
          </span>
          <span>Son etkileşim: {s?.lastGesture ?? '-'}</span>
          <span>Ses oturumu: {s?.audioSession ?? '-'}</span>
          <span>Son hata: {s?.lastError ?? '-'}</span>
          <ol className="sound-debug-log">
            {(s?.log ?? []).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
          <button type="button" onClick={() => playPlace()}>
            Test sesi çal
          </button>
        </>
      )}
    </aside>
  )
}
