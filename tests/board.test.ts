import { describe, expect, it } from 'vitest'
import { canPlace, canPlaceAnywhere, cellIndex, clearLines, emptyBoard, findFullLines, placeCells, shapeCellsAt } from '../src/engine/board'
import { SHAPES, getShape } from '../src/engine/shapes'
import { BOARD_SIZE, type Board } from '../src/engine/types'

function fillRow(board: Board, row: number, except: number[] = []): Board {
  const cells: number[] = []
  for (let c = 0; c < BOARD_SIZE; c++) if (!except.includes(c)) cells.push(cellIndex(row, c))
  return placeCells(board, cells, 1)
}

describe('şekil kataloğu', () => {
  it('kimlikler benzersiz, şekiller sınırlar içinde ve sol üstten başlıyor', () => {
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(SHAPES.length)
    for (const s of SHAPES) {
      expect(s.cells.length).toBeGreaterThan(0)
      expect(s.weight).toBeGreaterThan(0)
      expect(Number.isInteger(s.weight)).toBe(true)
      expect(Math.min(...s.cells.map(([r]) => r))).toBe(0)
      expect(Math.min(...s.cells.map(([, c]) => c))).toBe(0)
      for (const [r, c] of s.cells) {
        expect(r).toBeLessThan(s.height)
        expect(c).toBeLessThan(s.width)
      }
    }
  })

  it('aynı desen iki kez tanımlanmamış', () => {
    const keys = SHAPES.map((s) => JSON.stringify(s.cells))
    expect(new Set(keys).size).toBe(SHAPES.length)
  })
})

describe('yerleştirme', () => {
  it('tahta dışına taşan yerleşimi reddeder', () => {
    const h3 = getShape('h3')
    expect(canPlace(emptyBoard(), h3, 0, 5)).toBe(true)
    expect(canPlace(emptyBoard(), h3, 0, 6)).toBe(false)
    expect(canPlace(emptyBoard(), h3, -1, 0)).toBe(false)
    expect(shapeCellsAt(h3, 8, 0)).toBe(null)
  })

  it('dolu hücreyle çakışan yerleşimi reddeder', () => {
    const board = placeCells(emptyBoard(), [cellIndex(2, 2)], 3)
    expect(canPlace(board, getShape('sq2'), 1, 1)).toBe(false)
    expect(canPlace(board, getShape('sq2'), 3, 3)).toBe(true)
  })

  it('yerleştirme eski tahtayı değiştirmez', () => {
    const board = emptyBoard()
    const next = placeCells(board, [0, 1], 2)
    expect(board[0]).toBe(0)
    expect(next[0]).toBe(2)
  })

  it('canPlaceAnywhere dolu tahtada false döner', () => {
    const full = placeCells(emptyBoard(), Array.from({ length: 64 }, (_, i) => i), 1)
    expect(canPlaceAnywhere(full, getShape('dot'))).toBe(false)
  })
})

describe('satır ve sütun temizleme', () => {
  it('dolu satırı bulur ve temizler', () => {
    const board = fillRow(emptyBoard(), 3)
    const lines = findFullLines(board)
    expect(lines).toEqual({ rows: [3], cols: [] })
    const result = clearLines(board, lines)
    expect(result.cells).toHaveLength(8)
    expect(result.board.every((c) => c === 0)).toBe(true)
  })

  it('satır ve sütun aynı anda temizlenir, kesişen hücre bir kez sayılır', () => {
    let board = fillRow(emptyBoard(), 0)
    const col: number[] = []
    for (let r = 1; r < BOARD_SIZE; r++) col.push(cellIndex(r, 4))
    board = placeCells(board, col, 2)
    const lines = findFullLines(board)
    expect(lines).toEqual({ rows: [0], cols: [4] })
    const result = clearLines(board, lines)
    expect(result.cells).toHaveLength(15)
    expect(result.board.every((c) => c === 0)).toBe(true)
  })

  it('eksik satır temizlenmez', () => {
    const board = fillRow(emptyBoard(), 5, [7])
    expect(findFullLines(board)).toEqual({ rows: [], cols: [] })
  })
})
