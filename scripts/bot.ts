/**
 * Simülasyon ve testler için otomatik oyuncular. Oyunun parçası değildir.
 * Botların kendi rastgeleliği oyunun tohumundan ayrıdır.
 */
import {
  SHAPES,
  canPlace,
  canPlaceAnywhere,
  getShape,
  jokerCount,
  minHammersToFit,
  orientationsOf,
  play,
  type GameState,
  type JokerAction,
  type Move,
  type Rng,
  type Slot,
} from '../src/engine'
import { shapeCellsAt } from '../src/engine/board'
import { BOARD_SIZE, type Board } from '../src/engine/types'

export type Bot = (state: GameState) => Move | null

function legalMoves(state: GameState): Move[] {
  const moves: Move[] = []
  state.tray.forEach((piece, i) => {
    if (!piece) return
    const shape = getShape(piece.shapeId)
    for (let row = 0; row <= BOARD_SIZE - shape.height; row++) {
      for (let col = 0; col <= BOARD_SIZE - shape.width; col++) {
        if (canPlace(state.board, shape, row, col)) moves.push({ slot: i as Slot, row, col })
      }
    }
  })
  return moves
}

/** Zayıf oyuncu: geçerli hamlelerden rastgele birini seçer. */
export function randomBot(rng: Rng): Bot {
  return (state) => {
    const moves = legalMoves(state)
    return moves.length === 0 ? null : (moves[rng.nextInt(moves.length)] ?? null)
  }
}

const BIG = ['sq3', 'h5', 'v5'].map(getShape)

/** Kapalı boşluk: dört komşusu dolu ya da kenar olan boş hücre. */
function isolatedHoles(board: Board): number {
  let holes = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r * BOARD_SIZE + c] !== 0) continue
      const blocked = (rr: number, cc: number) =>
        rr < 0 || cc < 0 || rr >= BOARD_SIZE || cc >= BOARD_SIZE || board[rr * BOARD_SIZE + cc] !== 0
      if (blocked(r - 1, c) && blocked(r + 1, c) && blocked(r, c - 1) && blocked(r, c + 1)) holes++
    }
  }
  return holes
}

const WEIGHTED = SHAPES

/** Tahtanın "rahatlığı": hangi parçaların hâlâ sığdığı (ağırlıklı), kapalı boşluklar, doluluk. */
function evaluateBoard(board: Board): number {
  let mobility = 0
  for (const shape of WEIGHTED) if (canPlaceAnywhere(board, shape)) mobility += shape.weight * shape.cells.length
  const filled = board.filter((cell) => cell !== 0).length
  return mobility * 3 - isolatedHoles(board) * 40 - filled * 2
}

/**
 * Planlayıcı bot ("iyi oyuncu" yaklaşımı): tepsideki kalan parçaların bütün sıralarını
 * dener, her adımda en iyi birkaç yerleşimi tutar (ışın araması) ve en iyi planın ilk hamlesini oynar.
 */
export function plannerBot(beamWidth = 6): Bot {
  return (state) => {
    interface Node {
      state: GameState
      first: Move | null
      cleared: number
    }
    let best: Move | null = null
    let bestValue = -Infinity
    const slots = state.tray.map((p, i) => (p ? (i as Slot) : null)).filter((s): s is Slot => s !== null)
    const orders = permutations(slots)
    for (const order of orders) {
      let frontier: Node[] = [{ state, first: null, cleared: 0 }]
      for (const slot of order) {
        const children: Array<Node & { quick: number }> = []
        for (const node of frontier) {
          if (node.state.tripleIndex !== state.tripleIndex) continue
          for (const move of legalMoves(node.state).filter((m) => m.slot === slot)) {
            const result = play(node.state, move)
            if (!result.ok) continue
            let lines = 0
            for (const e of result.events) if (e.type === 'cleared') lines += e.rows.length + e.cols.length
            const cleared = node.cleared + lines
            const quick = cleared * 200 - isolatedHoles(result.state.board) * 40 - result.state.board.filter((c) => c !== 0).length
            children.push({ state: result.state, first: node.first ?? move, cleared, quick })
          }
        }
        if (children.length === 0) {
          frontier = []
          break
        }
        children.sort((a, b) => b.quick - a.quick)
        frontier = children.slice(0, beamWidth)
      }
      for (const leaf of frontier) {
        const value = leaf.state.gameOver ? -1e9 + leaf.cleared : leaf.cleared * 200 + evaluateBoard(leaf.state.board)
        if (value > bestValue && leaf.first) {
          bestValue = value
          best = leaf.first
        }
      }
    }
    // Hiçbir sıra bütün parçaları yerleştiremiyorsa: yerleştirebildiği ilk hamleyi oyna.
    return best ?? legalMoves(state)[0] ?? null
  }
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]))
}

/** Basit iyi oyuncu: tek hamle ileriye bakar; temizlemeyi, boş alanı ve büyük parça yerini sever. */
export const greedyBot: Bot = (state) => {
  let best: Move | null = null
  let bestValue = -Infinity
  for (const move of legalMoves(state)) {
    const result = play(state, move)
    if (!result.ok) continue
    const next = result.state
    let value = 0
    for (const e of result.events) if (e.type === 'cleared') value += (e.rows.length + e.cols.length) * 100
    value -= isolatedHoles(next.board) * 25
    value -= next.board.filter((cell) => cell !== 0).length
    for (const shape of BIG) if (canPlaceAnywhere(next.board, shape)) value += 30
    if (next.gameOver) value -= 10000
    if (value > bestValue) {
      bestValue = value
      best = move
    }
  }
  return best
}

/**
 * Joker kullanan oyuncu davranışı (simülasyon ve testler için). Yalnızca sıkışınca joker kullanır:
 * 1. Bir parçayı döndürmek tek başına yetiyorsa Döndür (ödenmiş yuva önce).
 * 2. Tek bir Çekiç yetiyorsa Çekiç.
 * 3. Yenile hakkı varsa Yenile.
 * 4. Yoksa Döndür + Çekiç birleşimi: gereken en az Çekiç'le sığan parça/yön seçilir;
 *    yön farklıysa önce döndürülür, sonra o yerleşimin altındaki dolu hücreler kırılır.
 * Kurtuluş yoksa null (oyun zaten bitmiş olur).
 */
export function jokerRescueAction(state: GameState): JokerAction | null {
  if (!state.stuck || !state.jokers) return null
  const hammers = jokerCount(state.jokers, 'cekic')
  const canRotate = (slot: Slot) => state.rotatePaid[slot] || jokerCount(state.jokers, 'dondur') > 0
  const slots = ([0, 1, 2] as const)
    .filter((s) => state.tray[s] !== null)
    .sort((a, b) => Number(state.rotatePaid[b]) - Number(state.rotatePaid[a]))

  // 1. Yalnız döndürme
  for (const slot of slots) {
    if (!canRotate(slot)) continue
    const ids = orientationsOf(state.tray[slot]!.shapeId).slice(1)
    if (ids.some((id) => canPlaceAnywhere(state.board, getShape(id)))) return { type: 'dondur', slot }
  }
  // 2. Tek Çekiç
  if (hammers >= 1) {
    for (const slot of slots) {
      const shape = getShape(state.tray[slot]!.shapeId)
      if (minHammersToFit(state.board, shape) === 1) return { type: 'cekic', cell: firstBlockingCell(state, shape) }
    }
  }
  // 3. Yenile
  if (jokerCount(state.jokers, 'yenile') > 0) return { type: 'yenile' }
  // 4. Döndür + Çekiç
  let best: { slot: Slot; id: string; need: number } | null = null
  for (const slot of slots) {
    const current = state.tray[slot]!.shapeId
    const ids = canRotate(slot) ? orientationsOf(current) : [current]
    for (const id of ids) {
      const need = minHammersToFit(state.board, getShape(id))
      if (need <= hammers && (!best || need < best.need)) best = { slot, id, need }
    }
  }
  if (!best) return null
  if (best.id !== state.tray[best.slot]!.shapeId) return { type: 'dondur', slot: best.slot }
  return { type: 'cekic', cell: firstBlockingCell(state, getShape(best.id)) }
}

/** Şeklin en az dolu hücreyle örtüştüğü yerleşimdeki ilk dolu hücre. */
function firstBlockingCell(state: GameState, shape: (typeof SHAPES)[number]): number {
  let bestCells: number[] | null = null
  let bestFilled = Infinity
  for (let row = 0; row <= BOARD_SIZE - shape.height; row++) {
    for (let col = 0; col <= BOARD_SIZE - shape.width; col++) {
      const cells = shapeCellsAt(shape, row, col)
      if (!cells) continue
      const filled = cells.filter((i) => state.board[i] !== 0).length
      if (filled > 0 && filled < bestFilled) {
        bestFilled = filled
        bestCells = cells
      }
    }
  }
  const cell = bestCells?.find((i) => state.board[i] !== 0)
  if (cell === undefined) throw new Error('firstBlockingCell: kırılacak hücre yok')
  return cell
}
