import type { PointerEvent } from 'react'
import { canPlaceAnywhere, getShape } from '../engine'
import type { Board, Slot, Tray as TrayState } from '../engine/types'
import { PieceView } from './PieceView'

/** useDrag'in her yuva için verdiği olay işleyicileri. */
export interface SlotHandlers {
  ref(el: HTMLElement | null): void
  onPointerDown(e: PointerEvent<HTMLElement>): void
  onPointerMove(e: PointerEvent<HTMLElement>): void
  onPointerUp(e: PointerEvent<HTMLElement>): void
  onPointerCancel(e: PointerEvent<HTMLElement>): void
  onLostPointerCapture(e: PointerEvent<HTMLElement>): void
}

interface Props {
  tray: TrayState
  board: Board
  selected: Slot | null
  dragging: Slot | null
  disabled: boolean
  slotHandlers(slot: Slot): SlotHandlers
  /** Klavye ile seçme (Enter/Boşluk). Dokunma ve fare useDrag üzerinden gelir. */
  onKeyboardSelect(slot: Slot): void
}

const SLOTS: readonly Slot[] = [0, 1, 2]

export function Tray({ tray, board, selected, dragging, disabled, slotHandlers, onKeyboardSelect }: Props) {
  return (
    <div className="tray" role="group" aria-label="Parçalar">
      {SLOTS.map((slot) => {
        const piece = tray[slot]
        if (!piece) return <div key={slot} className="slot slot-empty" aria-hidden="true" />
        const fits = canPlaceAnywhere(board, getShape(piece.shapeId))
        const isSelected = selected === slot && dragging === null
        return (
          <button
            key={slot}
            type="button"
            className="slot"
            data-selected={isSelected || undefined}
            data-dragging={dragging === slot || undefined}
            data-stuck={!fits || undefined}
            aria-pressed={isSelected}
            aria-label={`Parça ${slot + 1}, ${getShape(piece.shapeId).cells.length} blok${fits ? '' : ', hiçbir yere sığmıyor'}`}
            disabled={disabled}
            {...slotHandlers(slot)}
            onClick={(e) => {
              // detail === 0: klavyeyle etkinleştirme. Dokunma/fare dokunuşları useDrag'de işlenir.
              if (e.detail === 0) onKeyboardSelect(slot)
            }}
          >
            <PieceView piece={piece} />
          </button>
        )
      })}
    </div>
  )
}
