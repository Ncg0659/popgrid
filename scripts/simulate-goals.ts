/**
 * Aşama 10.3 — günlük görev ve başarım ekonomisi simülasyonu (365 gün). Oyunun parçası değildir; değer DEĞİŞTİRMEZ.
 *
 * İki adım:
 *   1) Oyun havuzu (gerçek motor + botlar; paralel çalıştırılabilir):
 *        vite-node scripts/simulate-goals.ts collect <beceri> <mod> <adet>
 *        beceri: zayif | orta | guclu     mod: klasik | eglence0 | eglence111
 *   2) Yıllık oyuncu simülasyonu ve rapor:
 *        vite-node scripts/simulate-goals.ts report
 * Ara veri: .sim-cache/goals/ (git'e girmez). Rapor: docs/sim-goals.md
 *
 * Yıllık simülasyon üretim kodunu kullanır: src/economy/ledger.ts (startGame, awardMove, syncUsage, finishGame,
 * purchase), src/economy/rewards.ts (rollover, claimReward). Depolama katmanı (tek anahtar, sahiplik) bunların
 * üstünde yalnızca okuma/yazma ekler; `report` bir oyuncu-yılını ayrıca gerçek depoyla (createEconomyStore) koşturup
 * sonucun birebir aynı olduğunu denetler.
 *
 * UYARI: Botlar gerçek oyuncu değildir. Sonuçlar kuralların büyüklük sırasını ve birbirine göre etkisini gösterir.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  NO_JOKERS,
  applyJoker,
  canRescue,
  createRng,
  newGame,
  play,
  type GameEvent,
  type GameState,
  type JokerCharges,
  type JokerKind,
  type JokerWallet,
  type Rng,
} from '../src/engine'
import { FUN_RULES_VERSION } from '../src/engine/specials'
import { ACHIEVEMENTS, DAILY_POOLS } from '../src/economy/goalsCatalog'
import { awardMove, finishGame, initialEconomy, purchase, startGame, syncUsage, type EconomyResult, type EconomyState } from '../src/economy/ledger'
import { JOKER_PRICES } from '../src/economy/rules'
import { achievementRewardStatus, claimReward, dailyRewardStatus, rollover } from '../src/economy/rewards'
import { createEconomyStore } from '../src/storage/economy'
import { progressFromEvents } from '../src/economy/goals'
import { greedyBot, jokerRescueAction, plannerBot, randomBot, type Bot } from './bot'

const ROOT = join(import.meta.dirname, '..')
const CACHE = join(process.env.SIM_CACHE ?? join(ROOT, '.sim-cache'), 'goals')
const MOVE_CAP = 3000
const KINDS: readonly JokerKind[] = ['cekic', 'yenile', 'dondur']
const SET_111: JokerCharges = { cekic: 1, yenile: 1, dondur: 1 }
const SET_PRICE = KINDS.reduce((n, k) => n + JOKER_PRICES[k], 0)

type Skill = 'zayif' | 'orta' | 'guclu'
type PoolMode = 'klasik' | 'eglence0' | 'eglence111'

// ---------------------------------------------------------------------------- 1) havuz

/** Kaydedilen adım: hamle (defterin gördüğü olaylar) ya da joker (cüzdan). */
type Step = { m: number; e: GameEvent[] } | { w: JokerWallet }
interface Recorded {
  readonly seed: number
  readonly mode: PoolMode
  readonly score: number
  readonly moves: number
  readonly steps: Step[]
  /** Oyun sonundaki cüzdan (Klasik: null). */
  readonly wallet: JokerWallet | null
}

/** Defter ve görevlerin okuduğu olaylar; büyük hücre dizileri boşaltılır (sayımları etkilemez). */
function compact(events: readonly GameEvent[]): GameEvent[] {
  const out: GameEvent[] = []
  for (const e of events) {
    if (e.type === 'cleared') out.push({ ...e, cells: [] })
    else if (e.type === 'placed') out.push({ ...e, cells: [] })
    else if (e.type === 'exploded') out.push({ ...e, cells: [] })
    else if (e.type === 'scored' || e.type === 'combo' || e.type === 'luckyReward' || e.type === 'gameOver') out.push(e)
  }
  return out
}

function botFor(skill: Skill, seed: number): Bot {
  if (skill === 'zayif') return randomBot(createRng(seed ^ 0x5eed1234))
  if (skill === 'orta') return greedyBot
  return plannerBot(3)
}

function record(skill: Skill, mode: PoolMode, seed: number): Recorded {
  const bot = botFor(skill, seed)
  let state: GameState =
    mode === 'klasik' ? newGame(seed) : newGame(seed, DEFAULT_CONFIG, { mode: 'eglence', inventory: mode === 'eglence111' ? SET_111 : NO_JOKERS })
  const steps: Step[] = []
  while (!state.gameOver && state.moveCount < MOVE_CAP) {
    if (state.stuck) {
      const action = jokerRescueAction(state)
      if (!action) {
        state = { ...state, stuck: false, gameOver: true }
        break
      }
      const r = applyJoker(state, action)
      if (!r.ok) throw new Error(`joker: ${r.reason}`)
      state = r.state
      steps.push({ w: state.jokers! })
      continue
    }
    const move = bot(state)
    if (!move) break
    const r = play(state, move)
    if (!r.ok) throw new Error(`hamle: ${r.reason}`)
    state = r.state
    if (state.stuck && !canRescue(state)) state = { ...state, stuck: false, gameOver: true }
    steps.push({ m: state.moveCount, e: compact(r.events) })
  }
  return { seed, mode, score: state.score, moves: state.moveCount, steps, wallet: state.jokers }
}

function collect(skill: Skill, mode: PoolMode, n: number) {
  mkdirSync(CACHE, { recursive: true })
  const t0 = Date.now()
  const games: Recorded[] = []
  for (let seed = 1; seed <= n; seed++) games.push(record(skill, mode, 10_000 + seed))
  writeFileSync(join(CACHE, `${skill}-${mode}.json`), JSON.stringify(games))
  const avg = (f: (g: Recorded) => number) => Math.round(games.reduce((s, g) => s + f(g), 0) / games.length)
  console.log(`${skill}/${mode}: ${n} oyun, ort. skor ${avg((g) => g.score)}, ort. hamle ${avg((g) => g.moves)}, ${((Date.now() - t0) / 1000).toFixed(1)} sn`)
}

// ---------------------------------------------------------------------------- 2) oyuncu-yılı

interface Profile {
  readonly id: string
  readonly name: string
  /** Bir günde oynama olasılığı. */
  readonly playProb: number
  /** Oynanan günde oyun sayısı [en az, en çok]. */
  readonly games: readonly [number, number]
  /** Oyunların Eğlence oranı. */
  readonly funShare: number
  /** Oturum sonunda "Al"a basma olasılığı (basmazsa gün sonunda otomatik eklenir). */
  readonly claimProb: number
}

const PROFILES: readonly Profile[] = [
  { id: 'az', name: 'Az oynayan', playProb: 0.3, games: [1, 2], funShare: 0.5, claimProb: 0.6 },
  { id: 'duzenli', name: 'Düzenli oynayan', playProb: 0.85, games: [3, 5], funShare: 0.5, claimProb: 0.9 },
  { id: 'yogun', name: 'Yoğun oynayan', playProb: 0.98, games: [8, 12], funShare: 0.6, claimProb: 1 },
]
const SKILLS: readonly Skill[] = ['zayif', 'orta', 'guclu']
const SKILL_NAME: Record<Skill, string> = { zayif: 'zayıf (rastgele bot)', orta: 'orta (greedy bot)', guclu: 'güçlü (planlayıcı bot)' }

/** Harcama davranışı. harcayan: her Eğlence oyununa 1/1/1 joker setiyle girer (parası yeterse). biriktiren: hiç almaz. */
type Spend = 'harcayan' | 'biriktiren'

interface YearResult {
  stars: number
  gameStars: number
  rewardStars: number
  dailyStars: number
  autoStars: number
  achStars: number
  spent: number
  jokersBought: number
  purchasedUsed: number
  playDays: number
  gamesPlayed: number
  fullDays: number
  bestStreak: number
  achUnlocked: number
  /** Gün → o gün sonu bakiye (grafik/eşik için). */
  balanceByDay: number[]
  /** Günlük görev ödülü alınan gün sayısı (en az bir görev). */
  daysWithDaily: number
  /** Başarımların açıldığı gün. */
  achDay: Record<string, number>
  /** "kademe:tür" → [tamamlanan gün, oynanan gün]. */
  missions: Record<string, [number, number]>
  /** Oynanan her günün görev ölçüleri (alternatif hedeflerin değerlendirmesi için). */
  dayStats: Array<{ lines: number; placed: number; games: number; score: number; combo: number; multi: number; scoreSum: number }>
}

interface Pools {
  klasik: Recorded[]
  eglence0: Recorded[]
  eglence111: Recorded[]
}

const okState = (r: EconomyResult, what: string): EconomyState => {
  if (!r.ok) throw new Error(`${what}: ${r.reason}`)
  return r.state
}
const DAY0 = Date.UTC(2027, 0, 1, 18) // 2027 bir yıl (365 gün); oturum saati 18:00 UTC
const dayKey = (d: number) => new Date(DAY0 + d * 86_400_000).toISOString().slice(0, 10)

interface Backend {
  state(): EconomyState
  rollover(day: string): number
  start(id: string, mode: 'klasik' | 'eglence', inv: JokerCharges): void
  move(id: string, mc: number, ev: GameEvent[]): void
  sync(id: string, w: JokerWallet): void
  finish(id: string, score: number, w: JokerWallet | null): void
  buy(kind: JokerKind, req: string): void
  claim(id: string): number
}

/** Saf defter üzerinde (üretim kuralları). */
function pureBackend(): Backend {
  let s = initialEconomy()
  return {
    state: () => s,
    rollover(day) {
      const r = rollover(s, day)
      s = r.state
      return r.autoStars
    },
    start: (id, mode, inv) => void (s = okState(startGame(s, id, mode, inv, undefined, mode === 'eglence' ? FUN_RULES_VERSION : undefined), 'start')),
    move: (id, mc, ev) => void (s = okState(awardMove(s, id, mc, ev), 'move')),
    sync: (id, w) => void (s = okState(syncUsage(s, id, w), 'sync')),
    finish: (id, score, w) => void (s = okState(finishGame(s, id, score, w), 'finish')),
    buy: (kind, req) => void (s = okState(purchase(s, kind, req), 'buy')),
    claim(id) {
      const r = claimReward(s, id)
      if (!r.ok) throw new Error(`claim ${id}: ${r.reason}`)
      s = r.state
      return r.stars
    },
  }
}

/** Gerçek depo üzerinde (bellek localStorage, sahte saat): saf sonuçla birebir aynı olmalı. */
function storeBackend(clock: { t: number }): Backend {
  const data = new Map<string, string>()
  const st = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
  const store = createEconomyStore(st, { tabId: 'sim', now: () => clock.t, day: (t) => new Date(t).toISOString().slice(0, 10) })
  const need = <T extends { ok: boolean }>(r: T, what: string): T => {
    if (!r.ok) throw new Error(`depo ${what}: ${(r as unknown as { reason: string }).reason}`)
    return r
  }
  const strip = (s: EconomyState): EconomyState => ({ ...s, owner: null })
  return {
    state: () => strip(store.load().state),
    rollover() {
      const before = store.load().state.stars
      need(store.claim(), 'claim')
      need(store.heartbeat(), 'heartbeat')
      return store.load().state.stars - before
    },
    start: (id, mode, inv) => void need(store.startGame(id, mode, inv, undefined, mode === 'eglence' ? FUN_RULES_VERSION : undefined), 'start'),
    move: (id, mc, ev) => void need(store.awardMove(id, mc, ev), 'move'),
    sync: (id, w) => void need(store.syncUsage(id, w), 'sync'),
    finish: (id, score, w) => void need(store.finishGame(id, score, w), 'finish'),
    buy: (kind, req) => void need(store.purchase(kind, req), 'buy'),
    claim: (id) => {
      const r = need(store.claimReward(id), `ödül ${id}`)
      return r.ok ? r.stars : 0
    },
  }
}

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[rng.nextInt(xs.length)]!

function simulateYear(
  profile: Profile,
  pools: Pools,
  playerSeed: number,
  opts: { goals: boolean; spend: Spend; backend?: Backend; clock?: { t: number } },
): YearResult {
  const rng = createRng(playerSeed)
  const be = opts.backend ?? pureBackend()
  const res: YearResult = {
    stars: 0, gameStars: 0, rewardStars: 0, dailyStars: 0, autoStars: 0, achStars: 0, spent: 0, jokersBought: 0, purchasedUsed: 0,
    playDays: 0, gamesPlayed: 0, fullDays: 0, bestStreak: 0, achUnlocked: 0, balanceByDay: [], daysWithDaily: 0, achDay: {}, missions: {}, dayStats: [],
  }
  let gameSeq = 0
  let reqSeq = 0
  for (let d = 0; d < 365; d++) {
    if (opts.clock) opts.clock.t = DAY0 + d * 86_400_000
    const plays = rng.nextInt(1_000_000) < profile.playProb * 1_000_000
    if (!plays) {
      res.balanceByDay.push(be.state().stars)
      continue
    }
    // Oturum açılışı: gün değişimi (görev açıksa). Kapalı senaryoda gün hiç ilerlemez → görev/otomatik ödül yok.
    if (opts.goals) res.autoStars += be.rollover(dayKey(d))
    res.playDays++
    const n = profile.games[0] + rng.nextInt(profile.games[1] - profile.games[0] + 1)
    const ds = { lines: 0, placed: 0, games: 0, score: 0, combo: 0, multi: 0, scoreSum: 0 }
    for (let i = 0; i < n; i++) {
      const fun = rng.nextInt(1000) < profile.funShare * 1000
      let inv = NO_JOKERS
      let pool = fun ? pools.eglence0 : pools.klasik
      if (fun && opts.spend === 'harcayan') {
        const s = be.state()
        const missing = KINDS.filter((k) => s.inventory[k] < 1)
        const cost = missing.reduce((c, k) => c + JOKER_PRICES[k], 0)
        if (s.stars >= cost) {
          for (const k of missing) {
            be.buy(k, `r${++reqSeq}`)
            res.jokersBought++
            res.spent += JOKER_PRICES[k]
          }
          inv = SET_111
          pool = pools.eglence111
        }
      }
      const g = pick(rng, pool)
      const id = `g${++gameSeq}`
      be.start(id, fun ? 'eglence' : 'klasik', inv)
      for (const st of g.steps) {
        if ('w' in st) be.sync(id, st.w)
        else {
          be.move(id, st.m, st.e)
          const p = progressFromEvents(st.e)
          ds.lines += p.lines
          ds.placed += p.placed
          ds.combo = Math.max(ds.combo, p.combo)
          ds.multi = Math.max(ds.multi, p.multi)
        }
      }
      ds.games++
      ds.score = Math.max(ds.score, g.score)
      ds.scoreSum += g.score
      const wallet = g.wallet
      if (fun && wallet) res.purchasedUsed += KINDS.reduce((n2, k) => n2 + inv[k] - wallet.inventory[k], 0)
      be.finish(id, g.score, wallet)
      res.gamesPlayed++
    }
    res.dayStats.push(ds)
    // Oturum sonu: oyuncu "Al"a basar (tamamlanmış, alınmamış her şey).
    if (opts.goals) {
      const s = be.state()
      for (const m of s.goals.daily) {
        const k = `${m.tier}:${m.kind}`
        const c = (res.missions[k] ??= [0, 0])
        c[1]++
        if (m.progress >= m.target) c[0]++
      }
    }
    if (opts.goals && rng.nextInt(1000) < profile.claimProb * 1000) {
      const s = be.state()
      let gotDaily = false
      for (const r of dailyRewardStatus(s)) if (r.done && !r.claimed) {
        res.dailyStars += be.claim(r.id)
        gotDaily = true
      }
      if (gotDaily) res.daysWithDaily++
      for (const r of achievementRewardStatus(s)) if (r.done && !r.claimed) {
        res.achStars += be.claim(r.id)
      }
    }
    if (opts.goals && be.state().goals.streak.lastDay === dayKey(d)) res.fullDays++
    if (opts.goals) for (const r of achievementRewardStatus(be.state())) if (r.done && res.achDay[r.id] === undefined) res.achDay[r.id] = d
    res.balanceByDay.push(be.state().stars)
  }
  // Yıl sonu: son günün tamamlanmış ama alınmamış ödülleri ertesi gün açılışta otomatik eklenir.
  if (opts.goals) res.autoStars += be.rollover(dayKey(365))
  const s = be.state()
  res.stars = s.stars
  res.rewardStars = s.totals.rewardEarned
  res.gameStars = s.totals.earned - s.totals.rewardEarned
  res.bestStreak = s.goals.streak.best
  res.achUnlocked = Object.keys(res.achDay).length
  return res
}

// ---------------------------------------------------------------------------- rapor

function loadPools(skill: Skill): Pools {
  const read = (m: PoolMode): Recorded[] => JSON.parse(readFileSync(join(CACHE, `${skill}-${m}.json`), 'utf8')) as Recorded[]
  return { klasik: read('klasik'), eglence0: read('eglence0'), eglence111: read('eglence111') }
}

const quant = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]!
}
const med = (xs: number[]) => quant(xs, 0.5)
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR')
const pct = (a: number, b: number) => (b === 0 ? '–' : `%${Math.round((100 * a) / b)}`)

const PLAYERS = Number(process.env.PLAYERS ?? 30)

function report() {
  const files = existsSync(CACHE) ? readdirSync(CACHE) : []
  const lines: string[] = []
  const log = (s = '') => {
    lines.push(s)
    console.log(s)
  }
  log('# POPGRID — Görev ve başarım ekonomisi simülasyonu (Aşama 10.3)')
  log()
  log('Üretim kodu (defter, görevler, ödüller) 365 günlük oyuncu yılları üzerinde çalıştırıldı. Oyunlar gerçek motorla')
  log('botlar tarafından oynanıp kaydedildi (`scripts/simulate-goals.ts collect`), yıl simülasyonunda bu havuzdan tohumlu')
  log(`rastgele seçildi. Her satır ${PLAYERS} oyuncu-yılının medyanıdır (ayrıca %10 / %90 dilimleri). Değerler DEĞİŞTİRİLMEDİ.`)
  log()
  log('**Botlar gerçek oyuncu değildir.** Sonuçlar büyüklük sırasını ve kuralların birbirine etkisini gösterir.')
  log()
  log('## Oyun havuzu')
  log()
  log('| Beceri | Mod | Oyun | Ort. skor | Ort. hamle |')
  log('|---|---|---:|---:|---:|')
  for (const skill of SKILLS) {
    for (const m of ['klasik', 'eglence0', 'eglence111'] as PoolMode[]) {
      if (!files.includes(`${skill}-${m}.json`)) continue
      const g = JSON.parse(readFileSync(join(CACHE, `${skill}-${m}.json`), 'utf8')) as Recorded[]
      const avg = (f: (x: Recorded) => number) => g.reduce((s, x) => s + f(x), 0) / g.length
      log(`| ${SKILL_NAME[skill]} | ${m} | ${g.length} | ${fmt(avg((x) => x.score))} | ${fmt(avg((x) => x.moves))} |`)
    }
  }
  log()

  // Doğrulama: saf defter = gerçek depo (bir oyuncu-yılı).
  {
    const pools = loadPools('orta')
    const clock = { t: DAY0 }
    const a = simulateYear(PROFILES[1]!, pools, 4242, { goals: true, spend: 'harcayan' })
    const b = simulateYear(PROFILES[1]!, pools, 4242, { goals: true, spend: 'harcayan', backend: storeBackend(clock), clock })
    const same = JSON.stringify(a) === JSON.stringify(b)
    log(`Doğrulama — aynı oyuncu-yılı saf defterle ve gerçek depoyla (createEconomyStore, bellek localStorage): **${same ? 'birebir aynı' : 'FARKLI'}**`)
    log(`(bakiye ${fmt(a.stars)} / ${fmt(b.stars)}, ödül ${fmt(a.rewardStars)} / ${fmt(b.rewardStars)}).`)
    if (!same) throw new Error('saf ve depo sonuçları farklı')
    log()
  }

  const table = (title: string, rows: Array<[string, (r: YearResult[]) => string]>, runs: Array<{ label: string; res: YearResult[] }>) => {
    log(`### ${title}`)
    log()
    log(`| | ${runs.map((r) => r.label).join(' | ')} |`)
    log(`|---|${runs.map(() => '---:').join('|')}|`)
    for (const [name, f] of rows) log(`| ${name} | ${runs.map((r) => f(r.res)).join(' | ')} |`)
    log()
  }

  const M = (f: (r: YearResult) => number) => (rs: YearResult[]) => fmt(med(rs.map(f)))
  const R = (f: (r: YearResult) => number) => (rs: YearResult[]) => `${fmt(med(rs.map(f)))} (${fmt(quant(rs.map(f), 0.1))}–${fmt(quant(rs.map(f), 0.9))})`

  const summary: string[] = []
  for (const skill of SKILLS) {
    if (!files.includes(`${skill}-eglence111.json`)) continue
    const pools = loadPools(skill)
    log(`## Beceri: ${SKILL_NAME[skill]}`)
    log()
    for (const spend of ['harcayan', 'biriktiren'] as Spend[]) {
      const runs: Array<{ label: string; res: YearResult[] }> = []
      for (const p of PROFILES) {
        const on: YearResult[] = []
        const off: YearResult[] = []
        for (let i = 0; i < PLAYERS; i++) {
          const seed = 1000 * (PROFILES.indexOf(p) + 1) + i
          on.push(simulateYear(p, pools, seed, { goals: true, spend }))
          off.push(simulateYear(p, pools, seed, { goals: false, spend }))
        }
        runs.push({ label: `${p.name} · görevli`, res: on }, { label: `${p.name} · görevsiz`, res: off })
        if (spend === 'harcayan') {
          const perDay = (r: YearResult) => r.playDays === 0 ? 0 : (r.gameStars + r.rewardStars) / r.playDays
          summary.push(
            `| ${SKILL_NAME[skill]} | ${p.name} | ${fmt(med(on.map((r) => r.gameStars / Math.max(1, r.playDays))))} | ${fmt(med(on.map((r) => r.rewardStars / Math.max(1, r.playDays))))} | ${pct(med(on.map((r) => r.rewardStars)), med(on.map((r) => r.gameStars + r.rewardStars)))} | ${fmt(med(on.map(perDay)))} | ${fmt(med(on.map((r) => r.stars)))} | ${fmt(med(off.map((r) => r.stars)))} | ${fmt(med(on.map((r) => r.jokersBought)))} / ${fmt(med(off.map((r) => r.jokersBought)))} |`,
          )
        }
      }
      table(spend === 'harcayan' ? 'Harcayan oyuncu (her Eğlence oyununa 1/1/1 joker setiyle girer, parası yetiyorsa)' : 'Biriktiren oyuncu (hiç joker almaz)', [
        ['Oynanan gün', M((r) => r.playDays)],
        ['Oyun', M((r) => r.gamesPlayed)],
        ['Oyun yıldızı (hat + oyun sonu + şanslı)', M((r) => r.gameStars)],
        ['Görev ödülü (elle "Al")', M((r) => r.dailyStars)],
        ['Görev ödülü (gün sonu otomatik)', M((r) => r.autoStars)],
        ['Başarım ödülü', M((r) => r.achStars)],
        ['Ödül payı (toplam kazancın)', (rs) => pct(med(rs.map((r) => r.rewardStars)), med(rs.map((r) => r.gameStars + r.rewardStars)))],
        ['Açılan başarım (21)', M((r) => r.achUnlocked)],
        ['Üç görevi tamamlanan gün', M((r) => r.fullDays)],
        ['En uzun seri (gün)', M((r) => r.bestStreak)],
        ['Satın alınan joker', M((r) => r.jokersBought)],
        ['Harcanan yıldız', M((r) => r.spent)],
        ['Kullanılan satın alınmış joker', M((r) => r.purchasedUsed)],
        ['Yıl sonu bakiye (medyan, %10–%90)', R((r) => r.stars)],
      ], runs)
    }
    // Başarımların ne zaman açıldığı ve görev türlerinin tamamlanma oranı (harcayan oyuncu).
    const ach: Record<string, number[]> = {}
    const mis: Record<string, [number, number]> = {}
    for (const p of PROFILES) {
      for (let i = 0; i < PLAYERS; i++) {
        const r = simulateYear(p, pools, 1000 * (PROFILES.indexOf(p) + 1) + i, { goals: true, spend: 'harcayan' })
        for (const a of ACHIEVEMENTS) (ach[`${p.id}:${a.id}`] ??= []).push(r.achDay[`ach:${a.id}`] ?? 999)
        for (const [k, [done, all]] of Object.entries(r.missions)) {
          const c = (mis[`${p.id}|${k}`] ??= [0, 0])
          c[0] += done
          c[1] += all
        }
      }
    }
    log('### Günlük görev türlerinin tamamlanma oranı (oynanan günlerde)')
    log()
    log(`| Görev | ${PROFILES.map((p) => p.name).join(' | ')} |`)
    log(`|---|${PROFILES.map(() => '---:').join('|')}|`)
    for (const tier of ['kolay', 'orta', 'zor'] as const) {
      for (const t of DAILY_POOLS[tier]) {
        const k = `${tier}:${t.kind}`
        log(`| ${tier} · ${t.kind} ${fmt(t.target)} | ${PROFILES.map((p) => { const c = mis[`${p.id}|${k}`]; return c && c[1] > 0 ? pct(c[0], c[1]) : '–' }).join(' | ')} |`)
      }
    }
    log()
    // Alternatif hedefler: oynanan günlerin ölçülerinden doğrudan tamamlanma oranı (görev seçiminden bağımsız).
    const days: Record<string, YearResult['dayStats']> = {}
    for (const p of PROFILES) {
      for (let i = 0; i < Math.min(PLAYERS, 10); i++) {
        const r = simulateYear(p, pools, 1000 * (PROFILES.indexOf(p) + 1) + i, { goals: true, spend: 'harcayan' })
        ;(days[p.id] ??= []).push(...r.dayStats)
      }
    }
    const CANDIDATES: Array<[string, (d: YearResult['dayStats'][number]) => number, number[]]> = [
      ['tek oyunda puan', (d) => d.score, [500, 750, 800, 1000, 1500, 2000, 2500]],
      ['gün içinde toplam puan', (d) => d.scoreSum, [1000, 2000, 3000, 5000]],
      ['kombo', (d) => d.combo, [2, 3, 4, 5, 6]],
      ['tek hamlede hat', (d) => d.multi, [2, 3, 4]],
      ['günlük hat', (d) => d.lines, [10, 20, 25, 40, 50]],
    ]
    log('### Hedef adaylarının tamamlanma oranı (bir günde, oynanan günlerde)')
    log()
    log(`| Ölçü | Hedef | ${PROFILES.map((p) => p.name).join(' | ')} |`)
    log(`|---|---:|${PROFILES.map(() => '---:').join('|')}|`)
    for (const [name, f, targets] of CANDIDATES) {
      for (const t of targets) log(`| ${name} | ${fmt(t)} | ${PROFILES.map((p) => pct(days[p.id]!.filter((d) => f(d) >= t).length, days[p.id]!.length)).join(' | ')} |`)
    }
    log()
    log('### Başarımın açıldığı gün (medyan; "—" = oyuncuların yarısından azı bir yılda açıyor)')
    log()
    log(`| Başarım | Hedef | ★ | ${PROFILES.map((p) => p.name).join(' | ')} |`)
    log(`|---|---:|---:|${PROFILES.map(() => '---:').join('|')}|`)
    for (const a of ACHIEVEMENTS) {
      const cells = PROFILES.map((p) => {
        const days = ach[`${p.id}:${a.id}`]!
        const m = med(days)
        const share = days.filter((x) => x < 999).length / days.length
        return m >= 999 ? `— (%${Math.round(share * 100)})` : `${m + 1}. gün`
      })
      log(`| ${a.id} | ${fmt(a.target)} | ${a.reward} | ${cells.join(' | ')} |`)
    }
    log()
  }
  log('## Özet (harcayan oyuncu, medyan)')
  log()
  log('| Beceri | Profil | Oyun ★ / oynanan gün | Ödül ★ / oynanan gün | Ödül payı | Toplam ★ / oynanan gün | Yıl sonu bakiye (görevli) | Yıl sonu bakiye (görevsiz) | Alınan joker (görevli / görevsiz) |')
  log('|---|---|---:|---:|---:|---:|---:|---:|---:|')
  for (const s of summary) log(s)
  log()
  log(`Joker seti (1 Çekiç + 1 Yenile + 1 Döndür) = ${SET_PRICE} ★.`)
  const out = join(ROOT, 'docs', 'sim-goals.md')
  writeFileSync(out, lines.join('\n') + '\n')
  console.log(`\nRapor: ${out}`)
}

// ---------------------------------------------------------------------------- giriş

const [cmd, a1, a2, a3] = process.argv.slice(2)
if (cmd === 'collect') collect(a1 as Skill, a2 as PoolMode, Number(a3 ?? 100))
else if (cmd === 'report') report()
else console.log('Kullanım: collect <zayif|orta|guclu> <klasik|eglence0|eglence111> <adet>  |  report')
