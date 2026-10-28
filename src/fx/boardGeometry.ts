/**
 * Efekt katmanı için tahta ölçüsü (Aşama 7.3a). Saf: DOM okumaz; ölçüler çağıran taraftan gelir.
 * Yalnızca efektler kullanır. Sürükle-bırak (useDrag) ve tahta çizimi (BoardView) kendi ölçülerini
 * değiştirmeden kullanmaya devam eder.
 */
import { BOARD_SIZE } from '../engine/types'

/** Tahtanın ekrandaki kutusu (getBoundingClientRect) ve hücreler arası boşluk (columnGap). */
export interface BoardBox {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly gap: number
}

export interface CellCenter {
  readonly x: number
  readonly y: number
  /** Bir hücrenin kenar uzunluğu (px). */
  readonly size: number
}

/** Hücrenin (0–63) ekrandaki merkezi ve boyu. */
export function cellCenter(box: BoardBox, cell: number): CellCenter {
  const size = (box.width - (BOARD_SIZE - 1) * box.gap) / BOARD_SIZE
  const pitch = size + box.gap
  const r = Math.floor(cell / BOARD_SIZE)
  const c = cell % BOARD_SIZE
  return { x: box.left + c * pitch + size / 2, y: box.top + r * pitch + size / 2, size }
}
