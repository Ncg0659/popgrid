import { BOARD_SIZE } from '../engine/types'
import { celebrationText, type Effect } from './effects'

interface Props {
  effect: Effect | null
  reducedMotion: boolean
}

/**
 * Tahtanın üstündeki efekt katmanı (dokunmayı engellemez):
 * - Temizlenen blokların "pop" kopyaları (gerçek hücreler zaten boşalmıştır)
 * - Çoklu temizleme / kombo kutlama yazısı
 * Animasyonlar bitince öğeler görünmez kalır; bir sonraki hamlede yenileriyle değişir.
 */
export function BoardFx({ effect, reducedMotion }: Props) {
  if (!effect) return null
  const text = celebrationText(effect)
  return (
    <>
      {!reducedMotion && effect.cleared.length > 0 && (
        <div key={`pop-${effect.id}`} className="fx-grid" aria-hidden="true">
          {effect.cleared.map((b) => (
            <span
              key={b.cell}
              className="blk fx-pop"
              data-c={b.color}
              style={{
                gridRow: Math.floor(b.cell / BOARD_SIZE) + 1,
                gridColumn: (b.cell % BOARD_SIZE) + 1,
                animationDelay: `${b.delay}ms`,
              }}
            />
          ))}
        </div>
      )}
      {text && (
        <div key={`cheer-${effect.id}`} className="cheer" data-big={effect.lines >= 3 || undefined} role="status">
          {text.title && <span className="cheer-title">{text.title}</span>}
          {text.combo && <span className="cheer-combo">{text.combo}</span>}
        </div>
      )}
    </>
  )
}
