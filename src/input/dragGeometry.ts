/**
 * Sürükleme geometrisi. Saf fonksiyonlar: DOM okumaz, Node testleriyle denenir.
 * Bütün ölçüler ekran pikselidir (clientX / clientY ile aynı koordinat sistemi).
 */
import { BOARD_SIZE, type Shape } from '../engine/types'
import type { Origin } from '../ui/placement'

/** Tahta ızgarasının ekrandaki ölçüleri. pitch = bir hücre + bir boşluk. */
export interface GridMetrics {
  readonly left: number
  readonly top: number
  readonly cell: number
  readonly gap: number
  readonly pitch: number
}

/** Dokunmada parçanın alt kenarı parmağın bu kadar hücre üzerinde durur (parmak parçayı kapatmasın). */
export const TOUCH_LIFT_CELLS = 1.25

/** Sürüklemenin başlaması için gereken en küçük hareket (px). Daha azı "dokunma" sayılır. */
export const DRAG_THRESHOLD_PX = 6

/** Izgara genişliği ve boşluktan ölçüleri hesaplar: genişlik = 8 hücre + 7 boşluk. */
export function gridMetrics(left: number, top: number, width: number, gap: number): GridMetrics {
  const cell = (width - (BOARD_SIZE - 1) * gap) / BOARD_SIZE
  return { left, top, cell, gap, pitch: cell + gap }
}

/** Parçanın tahta ölçeğindeki piksel boyutu. */
export function pieceSize(shape: Shape, m: GridMetrics): { width: number; height: number } {
  return { width: shape.width * m.pitch - m.gap, height: shape.height * m.pitch - m.gap }
}

/**
 * Yüzen parçanın sol üst köşesi.
 * Dokunma/kalem: yatayda parmağa ortalanır, alt kenarı parmağın TOUCH_LIFT_CELLS hücre üstündedir.
 * Fare: imleç parçanın ortasındadır (imleç parçayı kapatmaz).
 */
export function floatPosition(px: number, py: number, shape: Shape, m: GridMetrics, pointerType: string): { x: number; y: number } {
  const { width, height } = pieceSize(shape, m)
  if (pointerType === 'mouse') return { x: px - width / 2, y: py - height / 2 }
  return { x: px - width / 2, y: py - TOUCH_LIFT_CELLS * m.pitch - height }
}

/** Yüzen parçanın oturacağı hücre (sol üst köşe). Parça tahtanın dışına taşıyorsa null. */
export function snapOrigin(x: number, y: number, shape: Shape, m: GridMetrics): Origin | null {
  // "+ 0" eksi sıfırı (-0) sıfıra çevirir.
  const col = Math.round((x - m.left) / m.pitch) + 0
  const row = Math.round((y - m.top) / m.pitch) + 0
  if (row < 0 || col < 0 || row > BOARD_SIZE - shape.height || col > BOARD_SIZE - shape.width) return null
  return { row, col }
}
