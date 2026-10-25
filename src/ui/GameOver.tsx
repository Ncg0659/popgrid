import { useEffect, useRef } from 'react'

const fmt = (n: number) => n.toLocaleString('tr-TR')

interface Props {
  score: number
  isNewBest: boolean
  best: number
  onRestart(): void
}

export function GameOver({ score, isNewBest, best, onRestart }: Props) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => button.current?.focus(), [])

  return (
    <div className="gameover" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
      <div className="gameover-card">
        <h2 id="gameover-title">Yer kalmadı</h2>
        <p className="gameover-score">{fmt(score)}</p>
        <p className="gameover-best">{isNewBest ? 'Yeni rekor!' : `Rekor: ${fmt(best)}`}</p>
        <button ref={button} type="button" className="cta" onClick={onRestart}>
          Yeniden oyna
        </button>
      </div>
    </div>
  )
}
