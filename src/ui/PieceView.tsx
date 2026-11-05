import { getShape } from '../engine'
import { BOMB_FUSE } from '../engine/specials'
import type { Piece } from '../engine/types'
import { SpecialMark } from './SpecialMark'
import { pieceSpecialAt } from './specialUi'

/** Tepsideki küçük parça: blokları CSS grid ile şeklin kendi boyutunda çizer. Özel blok (Aşama 8) işaretiyle çizilir. */
export function PieceView({ piece }: { piece: Piece }) {
  const shape = getShape(piece.shapeId)
  return (
    <span
      className="piece"
      style={{ gridTemplateColumns: `repeat(${shape.width}, var(--u))`, gridTemplateRows: `repeat(${shape.height}, var(--u))` }}
      aria-hidden="true"
    >
      {shape.cells.map(([r, c]) => {
        const sp = pieceSpecialAt(piece, r, c)
        return (
          <span key={`${r}-${c}`} className="blk" data-c={piece.color} data-sp={sp ?? undefined} style={{ gridRow: r + 1, gridColumn: c + 1 }}>
            {sp && <SpecialMark special={sp === 'bomba' ? { kind: 'bomba', timer: BOMB_FUSE } : { kind: 'sansli' }} />}
          </span>
        )
      })}
    </span>
  )
}
