import { useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react'
import type { GameMode } from '../engine/types'
import { fmtStars, type GameStars } from './economyUi'
import { StarIcon } from './StarIcon'

const fmt = (n: number) => n.toLocaleString('tr-TR')

/** Oyun sonu penceresi açıldıktan sonra dokunuşların yok sayıldığı süre (ms). */
export const TAP_THROUGH_GUARD_MS = 450

interface Props {
  score: number
  isNewBest: boolean
  best: number
  onRestart(): void
  /** Mod seçimi penceresini açar (yeni oyun başlarken mod seçilir). */
  onChooseMode(): void
  mode: GameMode
  /** Bu oyunda kazanılan yıldız (oyun deftere kayıtlı değilse null). */
  stars?: GameStars | null
  /** Rekor satırı, oyunun rekor kategorisine göre (ör. "Yeni rekor!", "Satın alınmış jokerli rekor: 1.234"). */
  recordLine?: string
  /** Bu oyunda satın alınmış joker kullanıldı (ayrı rekor kategorisi). */
  boughtCategory?: boolean
}

export function GameOver({ score, isNewBest, best, onRestart, onChooseMode, mode, stars = null, recordLine, boughtCategory = false }: Props) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => button.current?.focus(), [])
  // Oyunu bitiren son dokunuşun ardından tarayıcının gönderdiği tıklama, yeni açılan bu pencerenin
  // düğmesine denk gelebilir ve oyuncu sonucu görmeden yeni oyun başlar. Açılıştan sonraki kısa süre
  // içinde gelen dokunma/fare tıklamaları yok sayılır; klavye (detail === 0) hemen çalışır.
  // Süre pencere ekrana yerleştiği anda başlar (çizim anında değil): yoğun anlarda çizim ile ekrana
  // yerleşme arasında geçen süre korumayı kısaltmasın (Aşama 7.2'de oyun sonu kaydı aynı dokunuşta yapılıyor).
  const shownAt = useRef(Infinity)
  useLayoutEffect(() => {
    shownAt.current = performance.now()
  }, [])
  const guarded = (fn: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail > 0 && performance.now() - shownAt.current < TAP_THROUGH_GUARD_MS) return
    fn()
  }

  return (
    <div className="gameover" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
      <div className="gameover-card">
        <h2 id="gameover-title">Yer kalmadı</h2>
        <p className="gameover-score">{fmt(score)}</p>
        <p className="gameover-best" data-bought={boughtCategory || undefined}>
          {recordLine ?? (isNewBest ? 'Yeni rekor!' : `${mode === 'eglence' ? 'Eğlence rekoru' : 'Rekor'}: ${fmt(best)}`)}
        </p>
        {boughtCategory && (
          <p className="gameover-tag">Satın alınmış joker kullanıldı: bu skor ayrı rekor kategorisinde.</p>
        )}
        {stars && (
          <p className="gameover-stars">
            <StarIcon />
            <span>
              +{fmtStars(stars.earned)} yıldız{stars.capped ? ' (oyun sınırı)' : ''}
            </span>
          </p>
        )}
        <button ref={button} type="button" className="cta" onClick={guarded(onRestart)}>
          Yeniden oyna
        </button>
        <button type="button" className="btn-quiet gameover-mode" onClick={guarded(onChooseMode)}>
          {mode === 'eglence' ? 'Mod değiştir (Eğlence)' : 'Mod değiştir (Klasik)'}
        </button>
      </div>
    </div>
  )
}
