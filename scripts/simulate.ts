/**
 * Kurtarma şansı simülasyonu: farklı ayarları aynı tohumlarla karşılaştırır.
 * Çalıştırma: npm run sim  (isteğe bağlı: npm run sim -- 200 300 1000  → planlayıcı, greedy ve rastgele bot oyun sayısı)
 * Sonuç: docs/sim-results.md
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRng, newGame, play, type GameState, type GeneratorConfig } from '../src/engine'
import { greedyBot, plannerBot, randomBot, type Bot } from './bot'

const MOVE_CAP = 3000

const CONFIGS: ReadonlyArray<readonly [string, GeneratorConfig]> = [
  ['Kapalı (0→0)', { rescue: { enabled: false, startPercent: 0, endPercent: 0, rampScore: 1 } }],
  ['%30 → %10', { rescue: { enabled: true, startPercent: 30, endPercent: 10, rampScore: 3000 } }],
  ['%50 → %15', { rescue: { enabled: true, startPercent: 50, endPercent: 15, rampScore: 3000 } }],
  ['%70 → %25', { rescue: { enabled: true, startPercent: 70, endPercent: 25, rampScore: 3000 } }],
  ['%85 → %40', { rescue: { enabled: true, startPercent: 85, endPercent: 40, rampScore: 3000 } }],
  ['Kesin garanti (100)', { rescue: { enabled: true, startPercent: 100, endPercent: 100, rampScore: 1 } }],
]

interface GameStats {
  moves: number
  score: number
  triples: number
  rescues: number
  rescueDots: number
  lostAtNewTriple: boolean
  hitCap: boolean
}

function runGame(seed: number, config: GeneratorConfig, bot: Bot): GameStats {
  let state: GameState = newGame(seed, config)
  const stats: GameStats = { moves: 0, score: 0, triples: 1, rescues: 0, rescueDots: 0, lostAtNewTriple: false, hitCap: false }
  while (!state.gameOver) {
    if (state.moveCount >= MOVE_CAP) {
      stats.hitCap = true
      break
    }
    const move = bot(state)
    if (!move) break
    const result = play(state, move)
    if (!result.ok) throw new Error(`Bot geçersiz hamle yaptı: ${result.reason}`)
    for (const e of result.events) {
      if (e.type === 'newTriple') {
        stats.triples++
        if (e.rescued) {
          stats.rescues++
          // Kurtarma sonrası tepside 1×1 varsa sayılır (yaklaşık gösterge).
          if (e.tray.some((p) => p?.shapeId === 'dot')) stats.rescueDots++
        }
        if (result.events.some((x) => x.type === 'gameOver')) stats.lostAtNewTriple = true
      }
    }
    state = result.state
  }
  stats.moves = state.moveCount
  stats.score = state.score
  return stats
}

const pct = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const fmt = (n: number): string => Math.round(n).toLocaleString('tr-TR')
const pc = (n: number): string => `%${(n * 100).toFixed(1).replace('.', ',')}`

function summarize(games: GameStats[]) {
  const moves = games.map((g) => g.moves).sort((a, b) => a - b)
  const scores = games.map((g) => g.score).sort((a, b) => a - b)
  const triples = games.reduce((s, g) => s + g.triples, 0)
  const rescues = games.reduce((s, g) => s + g.rescues, 0)
  const dots = games.reduce((s, g) => s + g.rescueDots, 0)
  return {
    medianMoves: pct(moves, 0.5),
    p10Moves: pct(moves, 0.1),
    p90Moves: pct(moves, 0.9),
    meanMoves: mean(moves),
    medianScore: pct(scores, 0.5),
    meanScore: mean(scores),
    rescueRate: rescues / Math.max(1, triples),
    dotShare: dots / Math.max(1, rescues),
    lostAtNewTriple: games.filter((g) => g.lostAtNewTriple).length / games.length,
    capRate: games.filter((g) => g.hitCap).length / games.length,
  }
}

const plannerGames = Number(process.argv[2] ?? 200)
const greedyGames = Number(process.argv[3] ?? 300)
const randomGames = Number(process.argv[4] ?? 1000)
const lines: string[] = []
const started = Date.now()

lines.push('# POPGRID — Kurtarma şansı simülasyonu', '')
lines.push(`Üretici sürümü 1 · hamle sınırı ${MOVE_CAP} · her ayar aynı tohumlarla oynandı (1…N).`, '')
lines.push('- **Planlayıcı bot:** tepsideki parçaları birlikte planlayan "iyi oyuncu" yaklaşımı.')
lines.push('- **Greedy bot:** yalnızca tek hamle ileriye bakan "orta oyuncu".')
lines.push('- **Rastgele bot:** geçerli hamlelerden rastgele seçen "zayıf oyuncu".')
lines.push('- **Yeni üçlüde kayıp:** oyun, yeni üçlü geldiği anda bitti (hiçbir yeni parça sığmadı).')
lines.push('- **Kurtarma oranı:** gelen üçlülerin yüzde kaçında kurtarma bir parçayı değiştirdi.')
lines.push('- **Kurtarmada 1×1:** kurtarma olan üçlülerin yüzde kaçında tepside 1×1 vardı.', '')

const planner = plannerBot()
for (const [botName, makeBot, count] of [
  ['Planlayıcı bot', () => planner, plannerGames],
  ['Greedy bot', () => greedyBot, greedyGames],
  ['Rastgele bot', (seed: number) => randomBot(createRng(seed ^ 0xa5a5a5a5)), randomGames],
] as const) {
  lines.push(`## ${botName} — ${count} oyun`, '')
  lines.push('| Ayar | Medyan hamle | P10–P90 hamle | Medyan skor | Ort. skor | Yeni üçlüde kayıp | Kurtarma oranı | Kurtarmada 1×1 | Sınıra ulaşan |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  for (const [name, config] of CONFIGS) {
    const games: GameStats[] = []
    for (let seed = 1; seed <= count; seed++) games.push(runGame(seed, config, makeBot(seed)))
    const s = summarize(games)
    lines.push(
      `| ${name} | ${fmt(s.medianMoves)} | ${fmt(s.p10Moves)}–${fmt(s.p90Moves)} | ${fmt(s.medianScore)} | ${fmt(s.meanScore)} | ${pc(s.lostAtNewTriple)} | ${pc(s.rescueRate)} | ${pc(s.dotShare)} | ${pc(s.capRate)} |`,
    )
    console.log(`${botName} · ${name} tamam (${((Date.now() - started) / 1000).toFixed(0)} sn)`)
  }
  lines.push('')
}

lines.push(`Süre: ${((Date.now() - started) / 1000).toFixed(0)} sn.`)
const out = join(import.meta.dirname, '..', 'docs', 'sim-results.md')
writeFileSync(out, lines.join('\n') + '\n')
console.log(`Yazıldı: ${out}`)
