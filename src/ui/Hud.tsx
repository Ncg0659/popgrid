import { useEffect, useRef, useState } from 'react'
import type { GameMode } from '../engine/types'
import type { Effect } from '../fx/effects'

const fmt = (n: number) => n.toLocaleString('tr-TR')

interface Props {
  score: number
  best: number
  canRestartFreely: boolean
  effect: Effect | null
  soundOn: boolean
  onToggleSound(): void
  onRestart(): void
  /** "Nasıl Oynanır?" ekranını açar. */
  onHelp(): void
  /** Rekor bu modun rekorudur; Eğlence'de farklı simge ve etiket. */
  mode?: GameMode
}

/** Ses, logo, yeniden başlat; altında rekor ve büyük skor. */
export function Hud({ score, best, canRestartFreely, effect, soundOn, onToggleSound, onRestart, onHelp, mode = 'klasik' }: Props) {
  const base = import.meta.env.BASE_URL
  const [confirming, setConfirming] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const handleRestart = () => {
    // Oyun sürerken yanlışlıkla sıfırlamayı önlemek için ikinci dokunuş istenir.
    if (canRestartFreely || confirming) {
      window.clearTimeout(timer.current)
      setConfirming(false)
      onRestart()
      return
    }
    setConfirming(true)
    timer.current = window.setTimeout(() => setConfirming(false), 3000)
  }

  // Temizleme olan hamlede skor hafifçe zıplar ve kazanılan puan yukarı süzülür.
  const celebrate = effect && effect.cleared.length > 0 ? effect : null

  return (
    <header className="hud">
      <button
        type="button"
        className="pill sound"
        aria-pressed={soundOn}
        aria-label={soundOn ? 'Ses açık' : 'Ses kapalı'}
        title={soundOn ? 'Sesi kapat' : 'Sesi aç'}
        onClick={onToggleSound}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {soundOn ? (
            <path className="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
          ) : (
            <path className="wave" d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
          )}
        </svg>
      </button>
      <h1 className="logo">
        <img
          src={`${base}logo-360.webp`}
          srcSet={`${base}logo-360.webp 360w, ${base}logo-720.webp 720w`}
          sizes="(max-width: 400px) 150px, 190px"
          width={360}
          height={120}
          alt="POPGRID"
        />
      </h1>
      <div className="restart-wrap">
        <button
          type="button"
          className="pill restart"
          data-confirming={confirming || undefined}
          aria-label={confirming ? 'Yeni oyunu onayla' : 'Yeni oyun'}
          onClick={handleRestart}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4a8 8 0 1 0 7.4 5h-2.2A6 6 0 1 1 12 6v3l4-4-4-4z" />
          </svg>
        </button>
        {confirming && (
          <span className="bubble" role="status">
            Yeni oyun için tekrar dokun
          </span>
        )}
      </div>
      <div
        className="pill best"
        data-mode={mode}
        aria-label={mode === 'eglence' ? `Eğlence rekoru ${fmt(best)}` : `Rekor ${fmt(best)}`}
      >
        {mode === 'eglence' ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8z" />
          </svg>
        )}
        <span>{fmt(best)}</span>
      </div>
      <div className="score-wrap">
        <output
          key={celebrate ? `s-${celebrate.id}` : 'score'}
          className={celebrate ? 'score fx-bump' : 'score'}
          aria-label={`Skor ${fmt(score)}`}
          aria-live="polite"
        >
          {fmt(score)}
        </output>
        {celebrate && (
          <span key={`g-${celebrate.id}`} className="gain" aria-hidden="true">
            +{fmt(celebrate.gained)}
          </span>
        )}
      </div>
      <button type="button" className="pill help-btn" aria-label="Nasıl oynanır?" title="Nasıl oynanır?" onClick={onHelp}>
        <span aria-hidden="true">?</span>
      </button>
    </header>
  )
}
