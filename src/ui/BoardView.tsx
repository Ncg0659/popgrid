import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { getShape } from '../engine'
import { BOARD_SIZE, CELL_COUNT, type GameState, type Slot } from '../engine/types'
import type { Origin, Preview } from './placement'

interface Props {
  game: GameState
  selected: Slot | null
  preview: Preview | null
  rejectCount: number
  onAimCell(row: number, col: number): void
  onAim(origin: Origin): void
  onPlaceCell(row: number, col: number): void
  onConfirm(): void
  onCancel(): void
}

const INDICES = Array.from({ length: CELL_COUNT }, (_, i) => i)

/**
 * 8×8 tahta.
 * Fare: üzerinde gezinince önizleme, tıklayınca yerleştirme.
 * Dokunma: ilk dokunuş önizler, önizlemenin üstüne ikinci dokunuş yerleştirir.
 * Klavye: oklar önizlemeyi taşır, Enter/Boşluk yerleştirir, Esc vazgeçer.
 */
export function BoardView({ game, selected, preview, rejectCount, onAimCell, onAim, onPlaceCell, onConfirm, onCancel }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const pointerType = useRef<string>('mouse')

  const cellAt = (e: PointerEvent): [number, number] | null => {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * BOARD_SIZE)
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * BOARD_SIZE)
    if (row < 0 || col < 0 || row >= BOARD_SIZE || col >= BOARD_SIZE) return null
    return [row, col]
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || selected === null) return
    const cell = cellAt(e)
    if (cell) onAimCell(cell[0], cell[1])
  }

  const handlePointerUp = (e: PointerEvent) => {
    pointerType.current = e.pointerType
    if (selected === null || game.gameOver) return
    const cell = cellAt(e)
    if (!cell) return
    const [row, col] = cell
    if (e.pointerType === 'mouse') {
      onPlaceCell(row, col)
      return
    }
    // Dokunma: önizlemenin üstüne dokunulduysa yerleştir, değilse önizlemeyi oraya taşı.
    if (preview && preview.cells.includes(row * BOARD_SIZE + col)) onConfirm()
    else onAimCell(row, col)
  }

  const handleKey = (e: KeyboardEvent) => {
    if (selected === null) return
    const piece = game.tray[selected]
    if (!piece) return
    const shape = getShape(piece.shapeId)
    const current = preview?.origin ?? {
      row: Math.floor((BOARD_SIZE - shape.height) / 2),
      col: Math.floor((BOARD_SIZE - shape.width) / 2),
    }
    const move = (dr: number, dc: number) => {
      e.preventDefault()
      onAim({
        row: Math.min(BOARD_SIZE - shape.height, Math.max(0, current.row + (preview ? dr : 0))),
        col: Math.min(BOARD_SIZE - shape.width, Math.max(0, current.col + (preview ? dc : 0))),
      })
    }
    if (e.key === 'ArrowUp') move(-1, 0)
    else if (e.key === 'ArrowDown') move(1, 0)
    else if (e.key === 'ArrowLeft') move(0, -1)
    else if (e.key === 'ArrowRight') move(0, 1)
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (preview) onConfirm()
      else move(0, 0)
    } else if (e.key === 'Escape') onCancel()
  }

  const ghost = new Set(preview?.cells ?? [])
  const ghostColor = selected !== null ? game.tray[selected]?.color : undefined
  const filledCount = game.board.filter((c) => c !== 0).length

  return (
    <div className="board-frame">
      <div
        ref={gridRef}
        className="board"
        role="application"
        aria-label={`Oyun tahtası, ${filledCount} dolu hücre. ${selected === null ? 'Önce bir parça seç.' : 'Oklarla konum seç, Enter ile yerleştir.'}`}
        tabIndex={0}
        data-aiming={selected !== null || undefined}
        onPointerDown={(e) => {
          // Dokunmada tarayıcının sonradan gönderdiği uyumluluk "mousedown"unu engeller;
          // aksi hâlde açılan pencerenin odağı çalınır ve çift dokunma yakınlaştırması tetiklenebilir.
          if (e.pointerType !== 'mouse') e.preventDefault()
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onCancel()}
        onKeyDown={handleKey}
      >
        {INDICES.map((i) => {
          const color = game.board[i] ?? 0
          const isGhost = ghost.has(i)
          const clearing = preview?.ok && preview.clearing.has(i)
          return (
            <div key={i} className="cell" data-clearing={clearing || undefined}>
              {color !== 0 && <span className="blk" data-c={color} />}
              {isGhost && (
                <span
                  key={preview?.ok ? 'ok' : `bad-${rejectCount}`}
                  className="blk ghost"
                  data-c={ghostColor}
                  data-bad={!preview?.ok || undefined}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
