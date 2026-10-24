import { canPlaceAnywhere, clearLines, emptyBoard, findFullLines, placeCells, shapeCellsAt } from './board'
import { DEFAULT_CONFIG, GENERATOR_VERSION, generateTriple } from './generator'
import { scoreMove } from './scoring'
import { getShape } from './shapes'
import type { Board, GameEvent, GameState, GeneratorConfig, Move, PlayResult, Tray } from './types'

/** Tepside kalan hiçbir parça tahtaya sığmıyorsa true. */
export function isStuck(board: Board, tray: Tray): boolean {
  return tray.every((piece) => piece === null || !canPlaceAnywhere(board, getShape(piece.shapeId)))
}

export function newGame(seed: number, config: GeneratorConfig = DEFAULT_CONFIG): GameState {
  const board = emptyBoard()
  const { tray } = generateTriple(seed >>> 0, 0, board, 0, config)
  return {
    generatorVersion: GENERATOR_VERSION,
    seed: seed >>> 0,
    config,
    board,
    tray,
    score: 0,
    combo: 0,
    tripleIndex: 0,
    moveCount: 0,
    gameOver: isStuck(board, tray),
  }
}

/**
 * Tek hamle oynar. Eski durumu değiştirmez; yeni durum ve olayları döndürür.
 * Geçersiz hamlede durum aynen geri döner ve sebep bildirilir.
 */
export function play(state: GameState, move: Move): PlayResult {
  if (state.gameOver) return { ok: false, state, reason: 'gameOver' }
  const piece = state.tray[move.slot]
  if (!piece) return { ok: false, state, reason: 'emptySlot' }
  const shape = getShape(piece.shapeId)
  const cells = shapeCellsAt(shape, move.row, move.col)
  if (!cells || cells.some((i) => state.board[i] !== 0)) return { ok: false, state, reason: 'doesNotFit' }

  const events: GameEvent[] = []
  let board = placeCells(state.board, cells, piece.color)
  events.push({ type: 'placed', slot: move.slot, shapeId: piece.shapeId, color: piece.color, cells })

  const lines = findFullLines(board)
  const lineCount = lines.rows.length + lines.cols.length
  if (lineCount > 0) {
    const cleared = clearLines(board, lines)
    board = cleared.board
    events.push({ type: 'cleared', rows: lines.rows, cols: lines.cols, cells: cleared.cells })
  }

  const { breakdown, combo } = scoreMove(shape.cells.length, lineCount, state.combo)
  const score = state.score + breakdown.total
  events.push({ type: 'scored', breakdown, score })
  if (combo >= 2) events.push({ type: 'combo', combo })

  const nextTray = state.tray.map((p, i) => (i === move.slot ? null : p)) as unknown as Tray
  let tray: Tray = nextTray
  let tripleIndex = state.tripleIndex
  if (tray.every((p) => p === null)) {
    tripleIndex += 1
    const triple = generateTriple(state.seed, tripleIndex, board, score, state.config)
    tray = triple.tray
    events.push({ type: 'newTriple', tripleIndex, tray, rescued: triple.rescued })
  }

  const gameOver = isStuck(board, tray)
  if (gameOver) events.push({ type: 'gameOver', score })

  return {
    ok: true,
    events,
    state: {
      ...state,
      board,
      tray,
      score,
      combo,
      tripleIndex,
      moveCount: state.moveCount + 1,
      gameOver,
    },
  }
}

/** Durumun kısa parmak izi (FNV-1a). Tekrar oynatma testlerinde kullanılır. */
export function fingerprint(state: GameState): string {
  const text = JSON.stringify([state.board, state.tray, state.score, state.combo, state.tripleIndex, state.moveCount, state.gameOver])
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
