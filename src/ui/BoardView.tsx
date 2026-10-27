import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { getShape } from '../engine'
import { BoardFx } from '../fx/BoardFx'
import { JokerBoardFx } from '../fx/JokerBoardFx'
import type { JokerFx } from '../fx/jokerEffects'
import type { Effect } from '../fx/effects'
import { BOARD_SIZE, CELL_COUNT, type GameState, type Slot } from '../engine/types'
import type { Origin, Preview } from './placement'

interface Props {
  /** Izgara öğesi; sürükleme ölçüleri de buradan okunur. */
  gridRef: RefObject<HTMLDivElement | null>
  game: GameState
  selected: Slot | null
  preview: Preview | null
  rejectCount: number
  /** Tepsiden sürükleme sürüyor. */
  dragging: boolean
  /** Son hamlenin efektleri (yerleştirme zıplaması, patlama, kutlama). */
  effect: Effect | null
  reducedMotion: boolean
  onAimCell(row: number, col: number): void
  onAim(origin: Origin): void
  onPlaceCell(row: number, col: number): void
  onConfirm(): void
  onCancel(): void
  /** Eğlence Modu: Çekiç seçili; dokunulan dolu blok kırılır. */
  hammer?: boolean
  onHammerCell?(cell: number): void
  onCancelJoker?(): void
  /** Son başarılı jokerin efekti (Çekiç kırılması tahtada çizilir). */
  jokerFx?: JokerFx | null
}

const INDICES = Array.from({ length: CELL_COUNT }, (_, i) => i)

/**
 * 8×8 tahta.
 * Fare: üzerinde gezinince önizleme, tıklayınca yerleştirme.
 * Dokunma: ilk dokunuş önizler, önizlemenin üstüne ikinci dokunuş yerleştirir.
 * Klavye: oklar önizlemeyi taşır, Enter/Boşluk yerleştirir, Esc vazgeçer.
 * Ana mobil oynanış tepsiden sürükle-bırak'tır (useDrag); buradaki dokunma yöntemi alternatif olarak kalır.
 */
export function BoardView({
  gridRef,
  game,
  selected,
  preview,
  rejectCount,
  dragging,
  effect,
  reducedMotion,
  onAimCell,
  onAim,
  onPlaceCell,
  onConfirm,
  onCancel,
  hammer = false,
  onHammerCell,
  onCancelJoker,
  jokerFx = null,
}: Props) {
  const pointerType = useRef<string>('mouse')
  // Çekiç hedefi: fareyle üzerine gelinen ya da klavye imlecinin olduğu hücre.
  const [target, setTarget] = useState<number | null>(null)
  useEffect(() => {
    if (!hammer) setTarget(null)
  }, [hammer])

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
    if (hammer) {
      if (e.pointerType !== 'mouse') return
      const cell = cellAt(e)
      setTarget(cell ? cell[0] * BOARD_SIZE + cell[1] : null)
      return
    }
    if (e.pointerType !== 'mouse' || selected === null) return
    const cell = cellAt(e)
    if (cell) onAimCell(cell[0], cell[1])
  }

  const handlePointerUp = (e: PointerEvent) => {
    pointerType.current = e.pointerType
    if (hammer) {
      const cell = cellAt(e)
      if (cell && !game.gameOver) onHammerCell?.(cell[0] * BOARD_SIZE + cell[1])
      return
    }
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

  const handleHammerKey = (e: KeyboardEvent) => {
    const current = target ?? 3 * BOARD_SIZE + 3
    const r = Math.floor(current / BOARD_SIZE)
    const c = current % BOARD_SIZE
    const to = (dr: number, dc: number) => {
      e.preventDefault()
      const nr = Math.min(BOARD_SIZE - 1, Math.max(0, r + (target === null ? 0 : dr)))
      const nc = Math.min(BOARD_SIZE - 1, Math.max(0, c + (target === null ? 0 : dc)))
      setTarget(nr * BOARD_SIZE + nc)
    }
    if (e.key === 'ArrowUp') to(-1, 0)
    else if (e.key === 'ArrowDown') to(1, 0)
    else if (e.key === 'ArrowLeft') to(0, -1)
    else if (e.key === 'ArrowRight') to(0, 1)
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (target === null) to(0, 0)
      else onHammerCell?.(target)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancelJoker?.()
    }
  }

  const handleKey = (e: KeyboardEvent) => {
    if (hammer) {
      handleHammerKey(e)
      return
    }
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
  const justPlaced = new Set(effect?.placed ?? [])

  return (
    <div className="board-frame">
      <div
        ref={gridRef}
        className="board"
        role="application"
        aria-label={
          hammer
            ? `Çekiç: kırılacak bloğu seç. ${filledCount} dolu hücre. Oklarla gez, Enter ile kır, Esc ile vazgeç.`
            : `Oyun tahtası, ${filledCount} dolu hücre. ${selected === null ? 'Önce bir parça seç.' : 'Oklarla konum seç, Enter ile yerleştir.'}`
        }
        tabIndex={0}
        data-aiming={selected !== null || undefined}
        data-dragging={dragging || undefined}
        data-hammer={hammer || undefined}
        onPointerDown={(e) => {
          // Dokunmada tarayıcının sonradan gönderdiği uyumluluk "mousedown"unu engeller;
          // aksi hâlde açılan pencerenin odağı çalınır ve çift dokunma yakınlaştırması tetiklenebilir.
          if (e.pointerType !== 'mouse') e.preventDefault()
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'mouse') return
          if (hammer) setTarget(null)
          else onCancel()
        }}
        onKeyDown={handleKey}
      >
        {INDICES.map((i) => {
          const color = game.board[i] ?? 0
          const isGhost = ghost.has(i)
          const clearing = preview?.ok && preview.clearing.has(i)
          return (
            <div
              key={i}
              className="cell"
              data-clearing={clearing || undefined}
              data-target={(hammer && target === i) || undefined}
              // Çekiç modunda boş hücreler geri çekilir (:has() yerine doğrudan işaret: tahtadaki her
              // değişiklikte ek stil hesabı yapılmasın).
              data-empty={(hammer && color === 0) || undefined}
            >
              {color !== 0 && (
                <span
                  // Yeni yerleşen bloğun anahtarı her hamlede değişir; zıplama animasyonu yeniden başlar.
                  key={justPlaced.has(i) ? `placed-${effect?.id}` : 'block'}
                  className={justPlaced.has(i) ? 'blk fx-place' : 'blk'}
                  data-c={color}
                />
              )}
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
      <BoardFx effect={effect} reducedMotion={reducedMotion} />
      <JokerBoardFx fx={jokerFx} reducedMotion={reducedMotion} />
    </div>
  )
}
