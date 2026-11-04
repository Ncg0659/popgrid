/**
 * Aşama 8.2 — Bombalı ve Parlayan Şanslı Bloklar simülasyonu.
 * Her tohum iki kez oynanır: Aşama 8 öncesi Eğlence (specials: false) ve özel bloklu Eğlence. Aynı bot,
 * aynı tohum, aynı joker davranışı (yalnızca sıkışınca: scripts/bot.ts jokerRescueAction). Yıldızlar gerçek
 * ekonomi defteriyle hesaplanır (startGame → awardMove → syncUsage → finishGame), 300 tavanı dahil.
 *
 * Çalıştırma: npx vite-node scripts/simulate-specials.ts   (hızlı deneme: SIM_SCALE=0.05)
 * Sonuç: docs/sim-specials.md (rapor) ve docs/sim-specials.json (ham özet).
 *
 * UYARI: Botlar gerçek oyuncu değildir ve özel blokları hedeflemez; sonuçlar büyüklük sırasını gösterir.
 * Süre ölçümleri bu bilgisayarda Node.js ile motor süresidir; telefon performansını ölçmez.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { DEFAULT_CONFIG, applyJoker, createRng, newGame, play, type GameEvent, type GameState, type JokerKind, type Tray } from '../src/engine'
import { awardMove, finishGame, initialEconomy, startGame, syncUsage } from '../src/economy/ledger'
import { FUN_STAR_CAP, linesCleared, luckyStars, starsForLines } from '../src/economy/rules'
import { greedyBot, jokerRescueAction, plannerBot, randomBot, type Bot } from './bot'

const MOVE_CAP = 3000
const SCALE = Number(process.env.SIM_SCALE ?? 1)
const scaled = (n: number) => Math.max(2, Math.round(n * SCALE))
const KINDS: readonly JokerKind[] = ['cekic', 'yenile', 'dondur']

const planner = plannerBot()
const PROFILES = [
  { id: 'yeni', name: 'Yeni başlayan (rastgele bot)', make: (seed: number): Bot => randomBot(createRng(seed ^ 0xa5a5a5a5)), games: scaled(1000) },
  { id: 'ortalama', name: 'Ortalama (greedy bot)', make: (): Bot => greedyBot, games: scaled(500) },
  { id: 'deneyimli', name: 'Deneyimli (planlayıcı bot)', make: (): Bot => planner, games: scaled(100) },
] as const

interface Game {
  moves: number
  score: number
  trays: number
  bombTrays: number
  luckyTrays: number
  bombsPlaced: number
  bombsExploded: number
  earlyBombs: number
  chainBombs: number
  blastPoints: number
  luckyPlaced: number
  luckyRewarded: number
  luckyByLine: number
  luckyByBomb: number
  defused: number
  rewardStars: number
  jokerGrants: Record<JokerKind, number>
  lineStars: number
  luckyStarsRaw: number
  endStars: number
  totalStars: number
  capHit: boolean
  freeUsedActual: number
  freeUsedLedger: number
  purchasedUsedLedger: number
  playMicros: number[]
  moveCapHit: boolean
}

function traySpecials(tray: Tray, g: Game) {
  g.trays++
  const s = tray.find((p) => p?.special)?.special
  if (s?.kind === 'bomba') g.bombTrays++
  if (s?.kind === 'sansli') g.luckyTrays++
}

function runGame(seed: number, bot: Bot, specials: boolean): Game {
  const g: Game = {
    moves: 0, score: 0, trays: 0, bombTrays: 0, luckyTrays: 0, bombsPlaced: 0, bombsExploded: 0, earlyBombs: 0, chainBombs: 0,
    blastPoints: 0, luckyPlaced: 0, luckyRewarded: 0, luckyByLine: 0, luckyByBomb: 0, defused: 0, rewardStars: 0,
    jokerGrants: { cekic: 0, yenile: 0, dondur: 0 }, lineStars: 0, luckyStarsRaw: 0, endStars: 0, totalStars: 0, capHit: false,
    freeUsedActual: 0, freeUsedLedger: 0, purchasedUsedLedger: 0, playMicros: [], moveCapHit: false,
  }
  const id = `g${seed}`
  let e = startGame(initialEconomy(), id, 'eglence').state
  let state: GameState = newGame(seed, DEFAULT_CONFIG, { mode: 'eglence', specials })
  traySpecials(state.tray, g)
  while (!state.gameOver) {
    if (state.moveCount >= MOVE_CAP) {
      g.moveCapHit = true
      break
    }
    if (state.stuck) {
      const action = jokerRescueAction(state)
      if (!action) throw new Error('kurtarma bulunamadı')
      const r = applyJoker(state, action)
      if (!r.ok) throw new Error(`joker: ${r.reason}`)
      for (const ev of r.events) {
        if (ev.type === 'jokerUsed' && ev.source === 'free') g.freeUsedActual++
        if (ev.type === 'specialDefused') g.defused++
        if (ev.type === 'refreshed') traySpecialsNoCount(ev.tray)
      }
      state = r.state
      const s = syncUsage(e, id, state.jokers)
      if (!s.ok) throw new Error(`syncUsage: ${s.reason}`)
      e = s.state
      continue
    }
    const move = bot(state)
    if (!move) throw new Error('bot hamle bulamadı')
    const t0 = performance.now()
    const r = play(state, move)
    g.playMicros.push((performance.now() - t0) * 1000)
    if (!r.ok) throw new Error(`hamle: ${r.reason}`)
    count(r.events, g)
    state = r.state
    const a = awardMove(e, id, state.moveCount, r.events)
    if (!a.ok) throw new Error(`awardMove: ${a.reason}`)
    e = a.state
  }
  const usage = e.active!.usage
  g.freeUsedLedger = KINDS.reduce((n, k) => n + usage.free[k], 0)
  g.purchasedUsedLedger = KINDS.reduce((n, k) => n + usage.purchased[k], 0)
  const lineStarsAwarded = e.active!.lineStars
  const end = finishGame(e, id, state.score, state.jokers)
  if (!end.ok) throw new Error(`finishGame: ${end.reason}`)
  g.endStars = end.stars
  g.totalStars = lineStarsAwarded + end.stars
  g.capHit = g.totalStars >= FUN_STAR_CAP
  g.moves = state.moveCount
  g.score = state.score
  return g
}
function traySpecialsNoCount(_tray: Tray) {
  // Yenile özel bloğu taşır; yeni tepsi sayılmaz (oran yalnızca üretilen üçlülerden ölçülür).
}

function count(events: readonly GameEvent[], g: Game) {
  const lineCells = new Set<number>()
  for (const ev of events) if (ev.type === 'cleared') ev.cells.forEach((c) => lineCells.add(c))
  g.lineStars += starsForLines(linesCleared(events))
  g.luckyStarsRaw += luckyStars(events)
  for (const ev of events) {
    switch (ev.type) {
      case 'newTriple':
        traySpecials(ev.tray, g)
        break
      case 'specialPlaced':
        if (ev.kind === 'bomba') g.bombsPlaced++
        else g.luckyPlaced++
        break
      case 'exploded':
        g.bombsExploded += ev.bombs.length
        g.chainBombs += ev.bombs.filter((b, i) => i > 0 && !lineCells.has(b)).length
        g.earlyBombs += ev.bombs.filter((b) => lineCells.has(b)).length
        g.blastPoints += ev.points
        break
      case 'luckyReward':
        g.luckyRewarded++
        if (ev.cause === 'line') g.luckyByLine++
        else g.luckyByBomb++
        if (ev.reward.type === 'stars') g.rewardStars += ev.reward.amount
        else g.jokerGrants[ev.reward.joker]++
        break
    }
  }
}

// ---------------------------------------------------------------------------
const pct = (xs: number[], p: number) => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const f1 = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const f0 = (n: number) => Math.round(n).toLocaleString('tr-TR')
const pc = (n: number) => `%${f1(n * 100)}`

interface Summary {
  profile: string
  name: string
  games: number
  base: Record<string, number>
  spec: Record<string, number>
}

function summarize(games: Game[]): Record<string, number> {
  const sum = (f: (g: Game) => number) => games.reduce((a, g) => a + f(g), 0)
  const trays = sum((g) => g.trays)
  const micros = games.flatMap((g) => g.playMicros)
  return {
    moves: mean(games.map((g) => g.moves)),
    movesP10: pct(games.map((g) => g.moves), 10),
    movesP50: pct(games.map((g) => g.moves), 50),
    movesP90: pct(games.map((g) => g.moves), 90),
    score: mean(games.map((g) => g.score)),
    scoreP10: pct(games.map((g) => g.score), 10),
    scoreP50: pct(games.map((g) => g.score), 50),
    scoreP90: pct(games.map((g) => g.score), 90),
    blastPoints: mean(games.map((g) => g.blastPoints)),
    blastShare: sum((g) => g.blastPoints) / Math.max(1, sum((g) => g.score)),
    trays,
    bombTrayRate: sum((g) => g.bombTrays) / Math.max(1, trays),
    luckyTrayRate: sum((g) => g.luckyTrays) / Math.max(1, trays),
    bombTrays: mean(games.map((g) => g.bombTrays)),
    luckyTrays: mean(games.map((g) => g.luckyTrays)),
    bombsPlaced: mean(games.map((g) => g.bombsPlaced)),
    bombsExploded: mean(games.map((g) => g.bombsExploded)),
    earlyShare: sum((g) => g.earlyBombs) / Math.max(1, sum((g) => g.bombsExploded)),
    chainShare: sum((g) => g.chainBombs) / Math.max(1, sum((g) => g.bombsExploded)),
    luckyPlaced: mean(games.map((g) => g.luckyPlaced)),
    luckyRewarded: mean(games.map((g) => g.luckyRewarded)),
    luckyPayRate: sum((g) => g.luckyRewarded) / Math.max(1, sum((g) => g.luckyPlaced)),
    luckyByBombShare: sum((g) => g.luckyByBomb) / Math.max(1, sum((g) => g.luckyRewarded)),
    defused: mean(games.map((g) => g.defused)),
    rewardStars: mean(games.map((g) => g.rewardStars)),
    jokerGrants: mean(games.map((g) => KINDS.reduce((n, k) => n + g.jokerGrants[k], 0))),
    grantsCekic: sum((g) => g.jokerGrants.cekic),
    grantsYenile: sum((g) => g.jokerGrants.yenile),
    grantsDondur: sum((g) => g.jokerGrants.dondur),
    lineStars: mean(games.map((g) => g.lineStars)),
    luckyStars: mean(games.map((g) => g.luckyStarsRaw)),
    endStars: mean(games.map((g) => g.endStars)),
    totalStars: mean(games.map((g) => g.totalStars)),
    starsP10: pct(games.map((g) => g.totalStars), 10),
    starsP50: pct(games.map((g) => g.totalStars), 50),
    starsP90: pct(games.map((g) => g.totalStars), 90),
    starsMax: Math.max(...games.map((g) => g.totalStars)),
    capRate: games.filter((g) => g.capHit).length / games.length,
    overCap: games.filter((g) => g.totalStars > FUN_STAR_CAP).length,
    freeUsedActual: mean(games.map((g) => g.freeUsedActual)),
    freeUsedLedger: mean(games.map((g) => g.freeUsedLedger)),
    undercountGames: games.filter((g) => g.freeUsedLedger < g.freeUsedActual).length,
    purchasedUsedLedger: sum((g) => g.purchasedUsedLedger),
    moveCapGames: games.filter((g) => g.moveCapHit).length,
    playP50: pct(micros, 50),
    playP99: pct(micros, 99),
    playMax: micros.length ? Math.max(...micros) : 0,
    playMean: mean(micros),
  }
}

const started = performance.now()
const results: Summary[] = []
for (const p of PROFILES) {
  const base: Game[] = []
  const spec: Game[] = []
  for (let seed = 1; seed <= p.games; seed++) {
    base.push(runGame(seed, p.make(seed), false))
    spec.push(runGame(seed, p.make(seed), true))
  }
  results.push({ profile: p.id, name: p.name, games: p.games, base: summarize(base), spec: summarize(spec) })
  console.log(`${p.name}: ${p.games} tohum × 2 tamam (${f0((performance.now() - started) / 1000)} sn)`)
}

// ---------------------------------------------------------------------------
const L: string[] = []
L.push('# Aşama 8.2 — Bombalı ve Parlayan Şanslı Bloklar simülasyonu', '')
L.push(`Kaynak: \`scripts/simulate-specials.ts\`, SIM_SCALE=${SCALE}. Her tohum iki kez oynandı: **Önce** = Aşama 8 öncesi Eğlence (\`specials: false\`), **Sonra** = özel bloklu Eğlence. Aynı bot, aynı tohum (1…N), joker yalnızca sıkışınca (\`jokerRescueAction\`), ücretsiz haklar 1/1/2, satın alınmış joker yok. Yıldızlar gerçek ekonomi defteriyle (300 tavanı dahil). Hamle sınırı ${MOVE_CAP}.`, '')
L.push('> Botlar gerçek oyuncu değildir ve özel blokları hedeflemez (bombayı bilerek doldurmaz, şanslı bloğu bilerek temizlemez). Süreler bu bilgisayarda Node.js ile ölçülen motor süresidir; telefon performansını ölçmez.', '')
for (const r of results) {
  const b = r.base
  const s = r.spec
  const d = (k: string, fmt = f1) => `${fmt(b[k]!)} | ${fmt(s[k]!)} | ${b[k] ? `%${f1(((s[k]! - b[k]!) / b[k]!) * 100)}` : '—'}`
  L.push(`## ${r.name} — ${r.games} tohum`, '')
  L.push('| Ölçü | Önce | Sonra | Fark |', '|---|---:|---:|---:|')
  L.push(`| Hamle (ortalama) | ${d('moves')} |`)
  L.push(`| Hamle p10 / p50 / p90 | ${f0(b.movesP10!)} / ${f0(b.movesP50!)} / ${f0(b.movesP90!)} | ${f0(s.movesP10!)} / ${f0(s.movesP50!)} / ${f0(s.movesP90!)} | |`)
  L.push(`| Skor (ortalama) | ${d('score', f0)} |`)
  L.push(`| Skor p10 / p50 / p90 | ${f0(b.scoreP10!)} / ${f0(b.scoreP50!)} / ${f0(b.scoreP90!)} | ${f0(s.scoreP10!)} / ${f0(s.scoreP50!)} / ${f0(s.scoreP90!)} | |`)
  L.push(`| Patlama puanı / oyun (skordaki payı) | — | ${f1(s.blastPoints!)} (${pc(s.blastShare!)}) | |`)
  L.push(`| Toplam yıldız / oyun | ${d('totalStars')} |`)
  L.push(`| Yıldız p10 / p50 / p90 / en çok | ${f0(b.starsP10!)} / ${f0(b.starsP50!)} / ${f0(b.starsP90!)} / ${f0(b.starsMax!)} | ${f0(s.starsP10!)} / ${f0(s.starsP50!)} / ${f0(s.starsP90!)} / ${f0(s.starsMax!)} | |`)
  L.push(`| — hat yıldızı | ${d('lineStars')} |`)
  L.push(`| — şanslı yıldız (tavan öncesi) | ${f1(b.luckyStars!)} | ${f1(s.luckyStars!)} | |`)
  L.push(`| — oyun sonu yıldızı | ${d('endStars')} |`)
  L.push(`| 300 tavanına ulaşan oyun | ${pc(b.capRate!)} | ${pc(s.capRate!)} | |`)
  L.push(`| 300'ü aşan oyun (olmamalı) | ${b.overCap} | ${s.overCap} | |`)
  L.push(`| Şanslıdan +1 ücretsiz joker / oyun | — | ${f1(s.jokerGrants!)} (Ç ${s.grantsCekic} · Y ${s.grantsYenile} · D ${s.grantsDondur}) | |`)
  L.push(`| Ücretsiz joker kullanımı / oyun (gerçek) | ${f1(b.freeUsedActual!)} | ${f1(s.freeUsedActual!)} | |`)
  L.push(`| Defterin saydığı ücretsiz kullanım / oyun | ${f1(b.freeUsedLedger!)} | ${f1(s.freeUsedLedger!)} | |`)
  L.push(`| Defterin eksik saydığı oyun | ${b.undercountGames} | ${s.undercountGames} | |`)
  L.push(`| Hamle sınırına takılan oyun | ${b.moveCapGames} | ${s.moveCapGames} | |`, '')
  L.push('| Özel blok | Değer |', '|---|---:|')
  L.push(`| Üretilen tepsi | ${f0(s.trays!)} |`)
  L.push(`| Bombalı tepsi oranı (hedef %12) | ${pc(s.bombTrayRate!)} |`)
  L.push(`| Şanslı tepsi oranı (hedef %10) | ${pc(s.luckyTrayRate!)} |`)
  L.push(`| Bomba / oyun: tepside · konan · patlayan | ${f1(s.bombTrays!)} · ${f1(s.bombsPlaced!)} · ${f1(s.bombsExploded!)} |`)
  L.push(`| Patlayanların erken (hatla) payı · zincir payı | ${pc(s.earlyShare!)} · ${pc(s.chainShare!)} |`)
  L.push(`| Şanslı / oyun: tepside · konan · ödül veren | ${f1(s.luckyTrays!)} · ${f1(s.luckyPlaced!)} · ${f1(s.luckyRewarded!)} |`)
  L.push(`| Konan şanslının ödüle dönüşme oranı · patlamayla gelen pay | ${pc(s.luckyPayRate!)} · ${pc(s.luckyByBombShare!)} |`)
  L.push(`| Çekiçle söndürülen özel blok / oyun | ${f1(s.defused!)} |`, '')
  L.push('| Motor süresi: play() (µs, bu bilgisayar) | Önce | Sonra |', '|---|---:|---:|')
  L.push(`| ortalama · p50 · p99 · en uzun | ${f1(b.playMean!)} · ${f1(b.playP50!)} · ${f1(b.playP99!)} · ${f0(b.playMax!)} | ${f1(s.playMean!)} · ${f1(s.playP50!)} · ${f1(s.playP99!)} · ${f0(s.playMax!)} |`, '')
}
const out = join(import.meta.dirname, '..', 'docs')
writeFileSync(join(out, 'sim-specials.md'), L.join('\n') + '\n')
writeFileSync(join(out, 'sim-specials.json'), JSON.stringify({ scale: SCALE, moveCap: MOVE_CAP, results }, null, 2) + '\n')
console.log(`bitti: ${f0((performance.now() - started) / 1000)} sn → docs/sim-specials.md`)
