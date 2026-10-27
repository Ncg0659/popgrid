import { useEffect, useRef } from 'react'
import type { GameMode } from '../engine/types'

const fmt = (n: number) => n.toLocaleString('tr-TR')

interface Props {
  score: number
  isNewBest: boolean
  best: number
  onRestart(): void
  /** Mod seçimi penceresini açar (yeni oyun başlarken mod seçilir). */
  onChooseMode(): void
  mode: GameMode
}

export function GameOver({ score, isNewBest, best, onRestart, onChooseMode, mode }: Props) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => button.current?.focus(), [])

  return (
    <div className="gameover" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
      <div className="gameover-card">
        <h2 id="gameover-title">Yer kalmadı</h2>
        <p className="gameover-score">{fmt(score)}</p>
        <p className="gameover-best">
          {isNewBest ? 'Yeni rekor!' : `${mode === 'eglence' ? 'Eğlence rekoru' : 'Rekor'}: ${fmt(best)}`}
        </p>
        <button ref={button} type="button" className="cta" onClick={onRestart}>
          Yeniden oyna
        </button>
        <button type="button" className="btn-quiet gameover-mode" onClick={onChooseMode}>
          {mode === 'eglence' ? 'Mod değiştir (Eğlence)' : 'Mod değiştir (Klasik)'}
        </button>
      </div>
    </div>
  )
}
