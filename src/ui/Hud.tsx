import { useEffect, useRef, useState } from 'react'

const fmt = (n: number) => n.toLocaleString('tr-TR')

interface Props {
  score: number
  best: number
  canRestartFreely: boolean
  onRestart(): void
}

/** Logo, rekor, yeniden başlat ve büyük skor. */
export function Hud({ score, best, canRestartFreely, onRestart }: Props) {
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

  return (
    <header className="hud">
      <div className="pill best" aria-label={`Rekor ${fmt(best)}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8z" />
        </svg>
        <span>{fmt(best)}</span>
      </div>
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
      <output className="score" aria-label={`Skor ${fmt(score)}`} aria-live="polite">
        {fmt(score)}
      </output>
    </header>
  )
}
