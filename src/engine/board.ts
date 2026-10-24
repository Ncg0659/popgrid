import { BOARD_SIZE, CELL_COUNT, type Board, type Cell, type Shape } from './types'

export function emptyBoard(): Board {
  return new Array<Cell>(CELL_COUNT).fill(0)
}

export const cellIndex = (row: number, col: number): number => row * BOARD_SIZE + col

/** Parçanın sol üst köşesi (row, col) olacak şekilde kapladığı hücre indeksleri; taşarsa null. */
export function shapeCellsAt(shape: Shape, row: number, col: number): number[] | null {
  if (row < 0 || col < 0 || row + shape.height > BOARD_SIZE || col + shape.width > BOARD_SIZE) return null
  return shape.cells.map(([r, c]) => cellIndex(row + r, col + c))
}

export function canPlace(board: Board, shape: Shape, row: number, col: number): boolean {
  const cells = shapeCellsAt(shape, row, col)
  return cells !== null && cells.every((i) => board[i] === 0)
}

export function canPlaceAnywhere(board: Board, shape: Shape): boolean {
  for (let row = 0; row <= BOARD_SIZE - shape.height; row++) {
    for (let col = 0; col <= BOARD_SIZE - shape.width; col++) {
      if (canPlace(board, shape, row, col)) return true
    }
  }
  return false
}

/** Yeni bir tahta döndürür; eskisini değiştirmez. Geçerliliği çağıran kontrol eder. */
export function placeCells(board: Board, cells: readonly number[], color: Cell): Board {
  const next = board.slice()
  for (const i of cells) next[i] = color
  return next
}

export interface FullLines {
  readonly rows: number[]
  readonly cols: number[]
}

export function findFullLines(board: Board): FullLines {
  const rows: number[] = []
  const cols: number[] = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true
    for (let c = 0; c < BOARD_SIZE && full; c++) full = board[cellIndex(r, c)] !== 0
    if (full) rows.push(r)
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true
    for (let r = 0; r < BOARD_SIZE && full; r++) full = board[cellIndex(r, c)] !== 0
    if (full) cols.push(c)
  }
  return { rows, cols }
}

/** Dolu satır ve sütunları aynı anda temizler. Kesişen hücre bir kez sayılır. */
export function clearLines(board: Board, lines: FullLines): { board: Board; cells: number[] } {
  const set = new Set<number>()
  for (const r of lines.rows) for (let c = 0; c < BOARD_SIZE; c++) set.add(cellIndex(r, c))
  for (const c of lines.cols) for (let r = 0; r < BOARD_SIZE; r++) set.add(cellIndex(r, c))
  const cells = [...set].sort((a, b) => a - b)
  const next = board.slice()
  for (const i of cells) next[i] = 0
  return { board: next, cells }
}
