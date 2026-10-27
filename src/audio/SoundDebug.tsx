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
 * Ses tanı paneli — yalnızca adres ?debug=ses ile açıldığında görünür.
 * iPhone'da ses motorunun durumunu okumak içindir; oyuna etkisi yoktur.
 */
export function SoundDebug() {
  const [show] = useState(wanted)
  const [status, setStatus] = useState<SoundStatus | null>(null)

  useEffect(() => {
    if (!show) return
    const id = window.setInterval(() => setStatus(soundStatus()), 400)
    return () => window.clearInterval(id)
  }, [show])

  if (!show) return null
  return (
    <aside className="sound-debug" aria-label="Ses tanı paneli">
      <strong>Ses tanı</strong>
      <span>Açılış: {displayMode()}</span>
      <span>Ses tercihi: {status ? (status.enabled ? 'açık' : 'kapalı') : '…'}</span>
      <span>Web Audio: {status ? (status.supported ? 'var' : 'YOK') : '…'}</span>
      <span>Motor durumu: {status?.state ?? '…'}</span>
      <span>Kurulan motor: {status?.contexts ?? 0}</span>
      <span>Son etkileşim: {status?.lastGesture ?? '-'}</span>
      <span>Ses oturumu: {status?.audioSession ?? '-'}</span>
      <span>Son hata: {status?.lastError ?? '-'}</span>
      <button type="button" onClick={() => playPlace()}>
        Test sesi çal
      </button>
    </aside>
  )
}
