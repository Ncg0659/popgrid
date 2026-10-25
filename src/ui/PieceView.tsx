import { getShape } from '../engine'
import type { Piece } from '../engine/types'

/** Tepsideki küçük parça: blokları CSS grid ile şeklin kendi boyutunda çizer. */
export function PieceView({ piece }: { piece: Piece }) {
  const shape = getShape(piece.shapeId)
  return (
    <span
      className="piece"
      style={{ gridTemplateColumns: `repeat(${shape.width}, var(--u))`, gridTemplateRows: `repeat(${shape.height}, var(--u))` }}
      aria-hidden="true"
    >
      {shape.cells.map(([r, c]) => (
        <span key={`${r}-${c}`} className="blk" data-c={piece.color} style={{ gridRow: r + 1, gridColumn: c + 1 }} />
      ))}
    </span>
  )
}
