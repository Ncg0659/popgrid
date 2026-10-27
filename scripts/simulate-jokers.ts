/**
 * Joker simülasyonu: oyun başına hak sayılarının oyun uzunluğuna ve skora etkisi.
 * Botlar jokeri yalnızca sıkışınca kullanır (bkz. jokerRescueAction).
 * Çalıştırma: npm run sim:jokers  (isteğe bağlı: npm run sim:jokers -- 100 300 500 → planlayıcı, greedy, rastgele oyun sayısı)
 * Sonuç: docs/sim-jokers.md
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  applyJoker,
  createRng,
  newGame,
  play,
  type GameOptions,
  type GameState,
  type JokerKind,
} from '../src/engine'
import { greedyBot, jokerRescueAction, plannerBot, randomBot, type Bot } from './bot'

const MOVE_CAP = 3000

const SETUPS: ReadonlyArray<readonly [string, GameOptions]> = [
  ['Klasik', { mode: 'klasik' }],
  ['Eğlence 0/0/0 (kontrol)', { mode: 'eglence', freeJokers: { cekic: 0, yenile: 0, dondur: 0 } }],
  ['Yalnız Çekiç 2', { mode: 'eglence', freeJokers: { cekic: 2, yenile: 0, dondur: 0 } }],
  ['Yalnız Yenile 2', { mode: 'eglence', freeJokers: { cekic: 0, yenile: 2, dondur: 0 } }],
  ['Yalnız Döndür 3', { mode: 'eglence', freeJokers: { cekic: 0, yenile: 0, dondur: 3 } }],
  ['1/1/1', { mode: 'eglence', freeJokers: { cekic: 1, yenile: 1, dondur: 1 } }],
  ['1/1/2', { mode: 'eglence', freeJokers: { cekic: 1, yenile: 1, dondur: 2 } }],
  ['2/2/3 (onaylı başlangıç)', { mode: 'eglence', freeJokers: { cekic: 2, yenile: 2, dondur: 3 } }],
  ['3/3/5', { mode: 'eglence', freeJokers: { cekic: 3, yenile: 3, dondur: 5 } }],
]

interface GameStats {
  moves: number
  score: number
  used: Record<JokerKind, number>
  rescues: number
  endedWithCharges: boolean
  hitCap: boolean
}

function runGame(seed: number, options: GameOptions, bot: Bot): GameStats {
  let state: GameState = newGame(seed, DEFAULT_CONFIG, options)
  const stats: GameStats = {
    moves: 0,
    score: 0,
    used: { cekic: 0, yenile: 0, dondur: 0 },
    rescues: 0,
    endedWithCharges: false,
    hitCap: false,
  }
  while (!state.gameOver) {
    if (state.moveCount >= MOVE_CAP) {
      stats.hitCap = true
      break
    }
    if (state.stuck) {
      const action = jokerRescueAction(state)
      if (!action) throw new Error('Sıkışık durumda kurtarma bulunamadı (motor ve bot çelişiyor)')
      const r = applyJoker(state, action)
      if (!r.ok) throw new Error(`Bot geçersiz joker kullandı: ${r.reason}`)
      for (const e of r.events) if (e.type === 'jokerUsed') stats.used[e.joker]++
      const wasStuck = state.stuck
      state = r.state
      if (wasStuck && !state.stuck && !state.gameOver) stats.rescues++
      continue
    }
    const move = bot(state)
    if (!move) throw new Error('Bot hamle bulamadı ama oyun bitmedi')
    const r = play(state, move)
    if (!r.ok) throw new Error(`Bot geçersiz hamle yaptı: ${r.reason}`)
    state = r.state
  }
  const w = state.jokers
  stats.endedWithCharges = !!w && w.free.cekic + w.free.yenile + w.free.dondur > 0
  stats.moves = state.moveCount
  stats.score = state.score
  return stats
}

const pct = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const fmt = (n: number): string => Math.round(n).toLocaleString('tr-TR')
const dec = (n: number): string => n.toFixed(2).replace('.', ',')
const pc = (n: number): string => `%${(n * 100).toFixed(1).replace('.', ',')}`
const ratio = (n: number): string => `×${n.toFixed(2).replace('.', ',')}`

const plannerGames = Number(process.argv[2] ?? 100)
const greedyGames = Number(process.argv[3] ?? 300)
const randomGames = Number(process.argv[4] ?? 500)
const lines: string[] = []
const started = Date.now()

lines.push('# POPGRID — Joker simülasyonu', '')
lines.push(`Üretici sürümü 1 · varsayılan kurtarma ayarı · hamle sınırı ${MOVE_CAP} · her ayar aynı tohumlarla (1…N).`, '')
lines.push('- Botlar jokeri **yalnızca sıkışınca** kullanır: önce yalnız döndürme, sonra tek Çekiç, sonra Yenile, en son Döndür + Çekiç.')
lines.push('- Gerçek oyuncular jokeri daha erken (ör. kötü tepsi gelince Yenile) kullanabilir; bu tablo "son çare" kullanımını ölçer.')
lines.push('- **Uzama:** medyan hamle sayısının Klasik medyanına oranı.')
lines.push('- **Kurtarma / oyun:** oyun başına kaç kez sıkışmadan jokerle çıkıldı.')
lines.push('- **Hak kalmış bitiş:** oyun bittiğinde kullanılmamış hak vardı (o haklar o anda işe yaramıyordu).', '')

const planner = plannerBot()
for (const [botName, makeBot, count] of [
  ['Planlayıcı bot', () => planner, plannerGames],
  ['Greedy bot', () => greedyBot, greedyGames],
  ['Rastgele bot', (seed: number) => randomBot(createRng(seed ^ 0xa5a5a5a5)), randomGames],
] as const) {
  if (count <= 0) continue
  lines.push(`## ${botName} — ${count} oyun`, '')
  lines.push(
    '| Ayar (Çekiç/Yenile/Döndür) | Medyan hamle | Uzama | P10–P90 hamle | Medyan skor | Ort. skor | Kurtarma / oyun | Kullanılan Ç / Y / D (ort.) | Hak kalmış bitiş | Sınıra ulaşan |',
  )
  lines.push('|---|---|---|---|---|---|---|---|---|---|')
  let classicMedian = 0
  for (const [name, options] of SETUPS) {
    const games: GameStats[] = []
    for (let seed = 1; seed <= count; seed++) games.push(runGame(seed, options, makeBot(seed)))
    const moves = games.map((g) => g.moves).sort((a, b) => a - b)
    const scores = games.map((g) => g.score).sort((a, b) => a - b)
    const median = pct(moves, 0.5)
    if (name === 'Klasik') classicMedian = median
    const used = (k: JokerKind) => dec(mean(games.map((g) => g.used[k])))
    lines.push(
      `| ${name} | ${fmt(median)} | ${ratio(median / Math.max(1, classicMedian))} | ${fmt(pct(moves, 0.1))}–${fmt(pct(moves, 0.9))} | ${fmt(pct(scores, 0.5))} | ${fmt(mean(scores))} | ${dec(mean(games.map((g) => g.rescues)))} | ${used('cekic')} / ${used('yenile')} / ${used('dondur')} | ${pc(games.filter((g) => g.endedWithCharges).length / games.length)} | ${pc(games.filter((g) => g.hitCap).length / games.length)} |`,
    )
    console.log(`${botName} · ${name} tamam (${((Date.now() - started) / 1000).toFixed(0)} sn)`)
  }
  lines.push('')
}

lines.push(`Süre: ${((Date.now() - started) / 1000).toFixed(0)} sn.`)
const out = join(import.meta.dirname, '..', 'docs', 'sim-jokers.md')
writeFileSync(out, lines.join('\n') + '\n')
console.log(`Yazıldı: ${out}`)

