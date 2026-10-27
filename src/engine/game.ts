import { canPlaceAnywhere, clearLines, emptyBoard, findFullLines, placeCells, shapeCellsAt } from './board'
import { DEFAULT_CONFIG, GENERATOR_VERSION, generateTriple } from './generator'
import { scoreMove } from './scoring'
import { DEFAULT_FREE_JOKERS, NO_JOKERS, initialRotatePaid, nextRotatePaid, resolveEnd, validateCharges } from './jokers'
import { getShape } from './shapes'
import type { Board, GameEvent, GameMode, GameState, GeneratorConfig, JokerCharges, Move, PlayResult, Tray } from './types'

/** Tepside kalan hiçbir parça tahtaya sığmıyorsa true. */
export function isStuck(board: Board, tray: Tray): boolean {
  return tray.every((piece) => piece === null || !canPlaceAnywhere(board, getShape(piece.shapeId)))
}

export interface GameOptions {
  /** Varsayılan: 'klasik' (jokersiz). */
  readonly mode?: GameMode
  /** Eğlence Modu: oyun başına ücretsiz haklar. Varsayılan DEFAULT_FREE_JOKERS. */
  readonly freeJokers?: JokerCharges
  /** Eğlence Modu: kalıcı envanterden bu oyuna getirilen haklar. Varsayılan 0. */
  readonly inventory?: JokerCharges
}

export function newGame(seed: number, config: GeneratorConfig = DEFAULT_CONFIG, options: GameOptions = {}): GameState {
  const board = emptyBoard()
  const { tray } = generateTriple(seed >>> 0, 0, board, 0, config)
  const mode: GameMode = options.mode ?? 'klasik'
  return {
    generatorVersion: GENERATOR_VERSION,
    mode,
    jokers:
      mode === 'eglence'
        ? {
            free: validateCharges(options.freeJokers ?? DEFAULT_FREE_JOKERS),
            inventory: validateCharges(options.inventory ?? NO_JOKERS),
          }
        : null,
    refreshCount: 0,
    rotatePaid: initialRotatePaid(),
    stuck: false,
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

  const next: GameState = {
    ...state,
    board,
    tray,
    score,
    combo,
    tripleIndex,
    moveCount: state.moveCount + 1,
    rotatePaid: nextRotatePaid(state.rotatePaid ?? initialRotatePaid(), move.slot, tripleIndex !== state.tripleIndex),
  }

  if (state.mode !== 'eglence') {
    // Klasik Mod: bugünkü kural, değişmedi.
    const gameOver = isStuck(board, tray)
    if (gameOver) events.push({ type: 'gameOver', score })
    return { ok: true, events, state: { ...next, stuck: false, gameOver } }
  }

  // Eğlence Modu: parçalar sığmasa bile jokerle kurtuluş varsa oyun bitmez.
  const end = resolveEnd(next)
  if (end.gameOver) events.push({ type: 'gameOver', score })
  else if (end.stuck) events.push({ type: 'stuck' })
  return { ok: true, events, state: { ...next, ...end } }
}

/** Durumun kısa parmak izi (FNV-1a). Tekrar oynatma testlerinde kullanılır. */
export function fingerprint(state: GameState): string {
  const parts: unknown[] = [state.board, state.tray, state.score, state.combo, state.tripleIndex, state.moveCount, state.gameOver]
  // Klasik parmak izi eskisiyle birebir aynı kalır; Eğlence Modu joker durumunu da ekler.
  if (state.mode === 'eglence') parts.push(state.jokers, state.refreshCount, state.rotatePaid, state.stuck)
  const text = JSON.stringify(parts)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
