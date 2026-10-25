/**
 * Dokunma ile yerleştirme yardımcıları. Arayüz katmanıdır; motoru değiştirmez, yalnızca kullanır.
 * Saf fonksiyonlar: tarayıcı gerektirmez, Node testleriyle denenir.
 */
import { getShape, play } from '../engine'
import { BOARD_SIZE, type GameEvent, type GameState, type Shape, type Slot } from '../engine/types'

export interface Origin {
  readonly row: number
  readonly col: number
}

/** Parçanın "tutma noktası": şeklin ortasına en yakın dolu hücre. Dokunulan hücreye bu hücre oturur. */
export function anchorOf(shape: Shape): readonly [number, number] {
  const cr = (shape.height - 1) / 2
  const cc = (shape.width - 1) / 2
  let best = shape.cells[0] ?? ([0, 0] as const)
  let bestDist = Infinity
  for (const cell of shape.cells) {
    const d = (cell[0] - cr) ** 2 + (cell[1] - cc) ** 2
    if (d < bestDist) {
      bestDist = d
      best = cell
    }
  }
  return best
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Dokunulan hücreye göre parçanın sol üst köşesi; tahta dışına taşmasın diye kenarlara yaslanır. */
export function originFor(shape: Shape, row: number, col: number): Origin {
  const [ar, ac] = anchorOf(shape)
  return {
    row: clamp(row - ar, 0, BOARD_SIZE - shape.height),
    col: clamp(col - ac, 0, BOARD_SIZE - shape.width),
  }
}

export interface Preview {
  readonly origin: Origin
  /** Parçanın kaplayacağı hücre indeksleri. */
  readonly cells: readonly number[]
  readonly ok: boolean
  /** Yerleşimle temizlenecek hücreler (yalnızca ok ise). */
  readonly clearing: ReadonlySet<number>
  /** Yerleşim sonrası durum (yalnızca ok ise). */
  readonly next: GameState | null
  /** Motorun bu hamle için verdiği olaylar (efektler için; yalnızca ok ise dolu). */
  readonly events: readonly GameEvent[]
}

/** Hamleyi motorda "deneyerek" önizler. Motor saf olduğu için mevcut durum değişmez. */
export function previewMove(state: GameState, slot: Slot, origin: Origin): Preview | null {
  const piece = state.tray[slot]
  if (!piece) return null
  const shape = getShape(piece.shapeId)
  const cells = shape.cells.map(([r, c]) => (origin.row + r) * BOARD_SIZE + origin.col + c)
  const result = play(state, { slot, row: origin.row, col: origin.col })
  if (!result.ok) return { origin, cells, ok: false, clearing: new Set(), next: null, events: [] }
  const clearing = new Set<number>()
  for (const e of result.events) if (e.type === 'cleared') for (const i of e.cells) clearing.add(i)
  return { origin, cells, ok: true, clearing, next: result.state, events: result.events }
}
