import type { PointerEvent, ReactNode } from 'react'
import { canPlaceAnywhere, getShape } from '../engine'
import type { Board, Slot, Tray as TrayState } from '../engine/types'
import type { JokerFx } from '../fx/jokerEffects'
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
  /** Eğlence Modu: Döndür seçili; dokunulan parça döner. */
  rotateMode?: boolean
  /** Döndür'ün uygulanabileceği yuvalar. */
  rotatable?: readonly Slot[]
  /** Ücretsiz dönüşü olan (ödenmiş) yuvalar. */
  rotatePaid?: readonly boolean[]
  /** Son başarılı jokerin efekti: Yenile (eski parça küçülür, yenisi belirir) ve Döndür (dönüş). */
  jokerFx?: JokerFx | null
  reducedMotion?: boolean
}

const SLOTS: readonly Slot[] = [0, 1, 2]


export function Tray({
  tray,
  board,
  selected,
  dragging,
  disabled,
  slotHandlers,
  onKeyboardSelect,
  rotateMode = false,
  rotatable = [],
  rotatePaid = [false, false, false],
  jokerFx = null,
  reducedMotion = false,
}: Props) {
  /** Efekt olan yuvada parça, animasyonu yeniden başlatan anahtarlı bir sarmalayıcıya alınır. */
  const pieceWithFx = (slot: Slot, node: ReactNode) => {
    if (jokerFx?.kind === 'yenile' && jokerFx.slots.includes(slot)) {
      return (
        <span key={`in-${jokerFx.id}`} className="jk-in">
          {node}
        </span>
      )
    }
    if (jokerFx?.kind === 'dondur' && jokerFx.slot === slot) {
      return (
        <span key={`rot-${jokerFx.id}`} className="jk-rot">
          {node}
        </span>
      )
    }
    return node
  }

  return (
    <div className="tray" role="group" aria-label="Parçalar">
      {SLOTS.map((slot) => {
        const piece = tray[slot]
        if (!piece) return <div key={slot} className="slot slot-empty" aria-hidden="true" />
        const fits = canPlaceAnywhere(board, getShape(piece.shapeId))
        const isSelected = selected === slot && dragging === null
        const canRotate = rotatable.includes(slot)
        const free = !!rotatePaid[slot]
        const blocks = getShape(piece.shapeId).cells.length
        let label = `Parça ${slot + 1}, ${blocks} blok${fits ? '' : ', hiçbir yere sığmıyor'}`
        if (rotateMode) label += canRotate ? (free ? ', döndürmek için seç (ücretsiz)' : ', döndürmek için seç') : ', döndürülemez'
        return (
          <button
            key={slot}
            type="button"
            className="slot"
            data-selected={isSelected || undefined}
            data-dragging={dragging === slot || undefined}
            data-stuck={(!fits && !rotateMode) || undefined}
            data-rotatable={(rotateMode && canRotate) || undefined}
            data-norotate={(rotateMode && !canRotate) || undefined}
            aria-pressed={isSelected}
            aria-label={label}
            disabled={disabled}
            {...slotHandlers(slot)}
            onClick={(e) => {
              // detail === 0: klavyeyle etkinleştirme. Dokunma/fare dokunuşları useDrag'de işlenir.
              if (e.detail === 0) onKeyboardSelect(slot)
            }}
          >
            {pieceWithFx(slot, <PieceView piece={piece} />)}
            {!reducedMotion && jokerFx?.kind === 'yenile' && jokerFx.slots.includes(slot) && jokerFx.before[slot] && (
              // Yenilenen yuvada eski parça küçülerek kaybolur (dokunmayı engellemez).
              <span key={`out-${jokerFx.id}`} className="jk-out" aria-hidden="true">
                <PieceView piece={jokerFx.before[slot]!} />
              </span>
            )}
            {free && (
              <span className="free-rot" aria-hidden="true" title="Ücretsiz dönüş">
                ↻
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
