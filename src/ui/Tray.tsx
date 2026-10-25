import { canPlaceAnywhere, getShape } from '../engine'
import type { Board, Slot, Tray as TrayState } from '../engine/types'
import { PieceView } from './PieceView'

interface Props {
  tray: TrayState
  board: Board
  selected: Slot | null
  disabled: boolean
  onSelect(slot: Slot): void
}

const SLOTS: readonly Slot[] = [0, 1, 2]

export function Tray({ tray, board, selected, disabled, onSelect }: Props) {
  return (
    <div className="tray" role="group" aria-label="Parçalar">
      {SLOTS.map((slot) => {
        const piece = tray[slot]
        if (!piece) return <div key={slot} className="slot slot-empty" aria-hidden="true" />
        const fits = canPlaceAnywhere(board, getShape(piece.shapeId))
        const isSelected = selected === slot
        return (
          <button
            key={slot}
            type="button"
            className="slot"
            data-selected={isSelected || undefined}
            data-stuck={!fits || undefined}
            aria-pressed={isSelected}
            aria-label={`Parça ${slot + 1}, ${getShape(piece.shapeId).cells.length} blok${fits ? '' : ', hiçbir yere sığmıyor'}`}
            disabled={disabled}
            onClick={() => onSelect(slot)}
          >
            <PieceView piece={piece} />
          </button>
        )
      })}
    </div>
  )
}
