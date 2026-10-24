/**
 * DENEY: "Üçlünün tamamı bir sırayla yerleştirilebilir mi?"
 * Oyun kurallarını DEĞİŞTİRMEZ. Varsayımsal kural yalnızca bu betikte, motorun dışında uygulanır.
 *
 * Ölçülenler:
 *  A) Mevcut kurallarda gelen üçlülerin yüzde kaçı tam yerleştirilebilir?
 *     Oyun bittiğinde, o üçlü geldiği anda tam yerleştirilebilir miydi? (evet = kaçınılabilir kayıp)
 *  B) Varsayımsal "tam üçlü kurtarma": üçlü tam yerleştirilemiyorsa, şans tutarsa
 *     aynı dağılımdan yeni aday üçlüler çekilir ve tam yerleştirilebilen ilki verilir.
 *
 * Çalıştırma: npx vite-node scripts/simulate-full-triple.ts -- 100 300
 * Sonuç: docs/sim-full-triple.md
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  SHARED_SEQUENCE_CONFIG,
  canPlace,
  createRng,
  generateTriple,
  getShape,
  isStuck,
  mixSeed,
  newGame,
  play,
  type Board,
  type GameState,
  type GeneratorConfig,
  type Shape,
  type Tray,
} from '../src/engine'
import { clearLines, findFullLines, placeCells, shapeCellsAt } from '../src/engine/board'
import { BOARD_SIZE } from '../src/engine/types'
import { greedyBot, plannerBot, type Bot } from './bot'

const MOVE_CAP = 3000
const CANDIDATES = 24

/** Parçaların hepsi, bir sırayla (satır/sütun temizlemeleri dahil) tahtaya yerleştirilebilir mi? */
export function fullyPlaceable(board: Board, shapes: readonly Shape[]): boolean {
  if (shapes.length === 0) return true
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i]!
    const rest = [...shapes.slice(0, i), ...shapes.slice(i + 1)]
    for (let row = 0; row <= BOARD_SIZE - shape.height; row++) {
      for (let col = 0; col <= BOARD_SIZE - shape.width; col++) {
        if (!canPlace(board, shape, row, col)) continue
        const cells = shapeCellsAt(shape, row, col)!
        let next = placeCells(board, cells, 1)
        const lines = findFullLines(next)
        if (lines.rows.length + lines.cols.length > 0) next = clearLines(next, lines).board
        if (fullyPlaceable(next, rest)) return true
      }
    }
  }
  return false
}

const trayShapes = (tray: Tray): Shape[] => tray.filter((p) => p !== null).map((p) => getShape(p!.shapeId))

interface Variant {
  name: string
  engineConfig: GeneratorConfig
  /** Tam üçlü kurtarma şansı (yüzde). null = varsayımsal kural yok. */
  fullChance: number | null
}

const VARIANTS: Variant[] = [
  { name: 'Kurtarma kapalı', engineConfig: SHARED_SEQUENCE_CONFIG, fullChance: null },
  { name: 'Mevcut (≥1 sığar, %70→%25)', engineConfig: DEFAULT_CONFIG, fullChance: null },
  { name: 'Tam üçlü %10', engineConfig: SHARED_SEQUENCE_CONFIG, fullChance: 10 },
  { name: 'Tam üçlü %25', engineConfig: SHARED_SEQUENCE_CONFIG, fullChance: 25 },
  { name: 'Tam üçlü %50', engineConfig: SHARED_SEQUENCE_CONFIG, fullChance: 50 },
  { name: 'Tam üçlü %75', engineConfig: SHARED_SEQUENCE_CONFIG, fullChance: 75 },
  { name: 'Tam üçlü %100', engineConfig: SHARED_SEQUENCE_CONFIG, fullChance: 100 },
]

interface Stats {
  moves: number
  score: number
  triples: number
  fullAtArrival: number
  applied: number
  blocks: number
  pieces: number
  endedAvoidable: boolean
}

/** Varsayımsal kuralı uygular (yalnızca simülasyonda). Kendi tohumlu rastgeleliğini kullanır. */
function applyFullTriple(state: GameState, chance: number): { state: GameState; applied: boolean } {
  const roll = createRng(mixSeed(state.seed ^ 0x5eed, state.tripleIndex)).nextInt(100)
  if (roll >= chance) return { state, applied: false }
  for (let k = 1; k <= CANDIDATES; k++) {
    const alt = generateTriple(mixSeed(state.seed, 0xc0ffee + k), state.tripleIndex, state.board, state.score, SHARED_SEQUENCE_CONFIG).tray
    if (fullyPlaceable(state.board, trayShapes(alt))) {
      return { state: { ...state, tray: alt, gameOver: isStuck(state.board, alt) }, applied: true }
    }
  }
  return { state, applied: false }
}

function runGame(seed: number, variant: Variant, bot: Bot): Stats {
  let state = newGame(seed, variant.engineConfig)
  const stats: Stats = { moves: 0, score: 0, triples: 0, fullAtArrival: 0, applied: 0, blocks: 0, pieces: 0, endedAvoidable: false }
  let arrivalFull = true

  const onArrival = () => {
    stats.triples++
    arrivalFull = fullyPlaceable(state.board, trayShapes(state.tray))
    if (!arrivalFull && variant.fullChance !== null) {
      const r = applyFullTriple(state, variant.fullChance)
      state = r.state
      if (r.applied) {
        stats.applied++
        arrivalFull = true
      }
    }
    if (arrivalFull) stats.fullAtArrival++
    for (const s of trayShapes(state.tray)) {
      stats.blocks += s.cells.length
      stats.pieces++
    }
  }

  onArrival()
  while (!state.gameOver && state.moveCount < MOVE_CAP) {
    const move = bot(state)
    if (!move) break
    const result = play(state, move)
    if (!result.ok) throw new Error(`Bot geçersiz hamle yaptı: ${result.reason}`)
    state = result.state
    if (result.events.some((e) => e.type === 'newTriple')) onArrival()
  }
  stats.moves = state.moveCount
  stats.score = state.score
  stats.endedAvoidable = state.gameOver && arrivalFull
  return stats
}

const pct = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0
const fmt = (n: number): string => Math.round(n).toLocaleString('tr-TR')
const pc = (n: number): string => `%${(n * 100).toFixed(1).replace('.', ',')}`

const plannerGames = Number(process.argv[2] ?? 100)
const greedyGames = Number(process.argv[3] ?? 300)
const started = Date.now()
const lines: string[] = [
  '# POPGRID — Deney: üçlünün tamamı yerleştirilebilir mi?',
  '',
  'Bu deney oyun kurallarını değiştirmez. "Tam üçlü" satırları varsayımsal bir kuralı yalnızca simülasyonda dener.',
  `Üretici sürümü 1 · hamle sınırı ${MOVE_CAP} · her satır aynı tohumlarla (1…N) oynandı.`,
  '',
  '- **Tam yerleştirilebilir üçlü:** üç parçanın hepsini, bir sırayla (temizlemeler dahil) koyabilmenin mümkün olduğu üçlü.',
  '- **Kaçınılabilir kayıp:** oyunu bitiren üçlü, geldiği anda tam yerleştirilebilirdi; yani kayıp oyuncu hatası.',
  '- **Kural uygulandı:** varsayımsal kural gelen üçlüyü değiştirdi.',
  '',
]

const planner = plannerBot()
for (const [botName, bot, count] of [
  ['Planlayıcı bot', planner, plannerGames],
  ['Greedy bot', greedyBot, greedyGames],
] as const) {
  lines.push(`## ${botName} — ${count} oyun`, '')
  lines.push('| Ayar | Medyan hamle | P10–P90 hamle | Medyan skor | Tam yerleştirilebilir üçlü | Kaçınılabilir kayıp | Kural uygulandı | Ort. parça boyu |')
  lines.push('|---|---|---|---|---|---|---|---|')
  for (const variant of VARIANTS) {
    const games: Stats[] = []
    for (let seed = 1; seed <= count; seed++) games.push(runGame(seed, variant, bot))
    const moves = games.map((g) => g.moves).sort((a, b) => a - b)
    const scores = games.map((g) => g.score).sort((a, b) => a - b)
    const triples = games.reduce((s, g) => s + g.triples, 0)
    const ended = games.filter((g) => g.moves < MOVE_CAP)
    lines.push(
      [
        variant.name,
        fmt(pct(moves, 0.5)),
        `${fmt(pct(moves, 0.1))}–${fmt(pct(moves, 0.9))}`,
        fmt(pct(scores, 0.5)),
        pc(games.reduce((s, g) => s + g.fullAtArrival, 0) / triples),
        pc(ended.filter((g) => g.endedAvoidable).length / Math.max(1, ended.length)),
        pc(games.reduce((s, g) => s + g.applied, 0) / triples),
        (games.reduce((s, g) => s + g.blocks, 0) / games.reduce((s, g) => s + g.pieces, 0)).toFixed(2).replace('.', ','),
      ].join(' | ').replace(/^/, '| ') + ' |',
    )
    console.log(`${botName} · ${variant.name} tamam (${((Date.now() - started) / 1000).toFixed(0)} sn)`)
  }
  lines.push('')
}

lines.push(`Süre: ${((Date.now() - started) / 1000).toFixed(0)} sn.`)
const out = join(import.meta.dirname, '..', 'docs', 'sim-full-triple.md')
writeFileSync(out, lines.join('\n') + '\n')
console.log(`Yazıldı: ${out}`)
