import { BOARD_SIZE } from '../engine/types'
import type { JokerFx } from './jokerEffects'

interface Props {
  fx: JokerFx | null
  reducedMotion: boolean
}

/**
 * Çekiç efekti (tahtanın üstünde, dokunmayı engellemez): kırılan bloğun kopyası önce ezilir
 * (darbe), sonra küçülerek dağılır; altında kısa bir şok halkası açılır. Gerçek hücre zaten boştur.
 * Hareketi azalt tercihinde hiç çizilmez (blok anında kaybolur).
 */
export function JokerBoardFx({ fx, reducedMotion }: Props) {
  if (!fx || fx.kind !== 'cekic' || reducedMotion) return null
  const pos = { gridRow: Math.floor(fx.cell / BOARD_SIZE) + 1, gridColumn: (fx.cell % BOARD_SIZE) + 1 }
  return (
    <div key={`jk-${fx.id}`} className="fx-grid" aria-hidden="true">
      <span className="fx-shock" style={pos} />
      <span className="blk fx-hammer" data-c={fx.color} style={pos} />
    </div>
  )
}
