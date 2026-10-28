/**
 * Yıldız ekonomisi simülasyonu (Aşama 7.1). Botlar gerçek oyun motorunu oynar; yıldızlar gerçek
 * ekonomi defteriyle (src/economy/ledger.ts) hesaplanır: startGame → awardMove → syncUsage → finishGame.
 *
 * Çalıştırma: npm run sim:economy
 *   İsteğe bağlı: npm run sim:economy -- yeni,ortalama   (yalnızca bu profiller; diğerleri JSON'dan korunur)
 * Sonuç: docs/sim-economy.md (rapor) ve docs/sim-economy.json (ham özet).
 *
 * UYARI: Botlar gerçek oyuncu değildir. Bu sonuçlar kuralların büyüklük sırasını gösterir;
 * gerçek kullanıcı davranışını ölçmez.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  NO_JOKERS,
  applyJoker,
  createRng,
  newGame,
  play,
  type GameMode,
  type GameState,
  type JokerCharges,
  type JokerKind,
} from '../src/engine'
import { awardMove, finishGame, initialEconomy, purchase, startGame, syncUsage, type EconomyState } from '../src/economy/ledger'
import { JOKER_PRICES, linesCleared } from '../src/economy/rules'
import { greedyBot, jokerRescueAction, plannerBot, randomBot, type Bot } from './bot'

const MOVE_CAP = 3000
const KINDS: readonly JokerKind[] = ['cekic', 'yenile', 'dondur']
/** Hızlı deneme için oyun sayılarını küçültür (ör. SIM_SCALE=0.02). Rapor için 1. */
const SCALE = Number(process.env.SIM_SCALE ?? 1)
const scaled = (n: number) => Math.max(2, Math.round(n * SCALE))

interface Profile {
  readonly id: string
  readonly name: string
  readonly bot: string
  readonly make: (seed: number) => Bot
  /** Temel ölçüm (Klasik ve Eğlence) oyun sayısı, tohumlar 1…N. */
  readonly base: number
  /** Satın alınmış joker deneyleri oyun sayısı (aynı tohumlar 1…N). */
  readonly variants: number
  /** Kariyer: art arda oynanan oyun dizisi sayısı ve uzunluğu. */
  readonly careers: number
  readonly careerLength: number
}

const planner = plannerBot()
const PROFILES: readonly Profile[] = ([
  {
    id: 'yeni',
    name: 'Yeni başlayan',
    bot: 'rastgele bot: geçerli hamlelerden rastgele birini oynar',
    make: (seed) => randomBot(createRng(seed ^ 0xa5a5a5a5)),
    base: 1000,
    variants: 1000,
    careers: 20,
    careerLength: 100,
  },
  {
    id: 'ortalama',
    name: 'Ortalama',
    bot: 'greedy bot: tek hamle ileriye bakar, temizlemeyi ve boş alanı sever',
    make: () => greedyBot,
    base: 500,
    variants: 500,
    careers: 10,
    careerLength: 100,
  },
  {
    id: 'deneyimli',
    name: 'Deneyimli',
    bot: 'planlayıcı bot: tepsideki parçaların bütün sıralarını ışın aramasıyla planlar',
    make: () => planner,
    base: 100,
    variants: 50,
    careers: 1,
    careerLength: 40,
  },
] as const satisfies readonly Profile[]).map((p) => ({
  ...p,
  base: scaled(p.base),
  variants: scaled(p.variants),
  careerLength: scaled(p.careerLength),
}))

interface GameResult {
  score: number
  moves: number
  lineStars: number
  endStars: number
  clears: [number, number, number]
  freeUsed: number
  purchasedUsed: number
  hitCap: boolean
}

/** Bir oyunu baştan sona oynatır; yıldızlar ekonomi defteriyle hesaplanır. */
function runGame(
  econ: EconomyState,
  id: string,
  seed: number,
  mode: GameMode,
  bot: Bot,
): { econ: EconomyState; result: GameResult } {
  const inventory = mode === 'eglence' ? econ.inventory : NO_JOKERS
  const started = startGame(econ, id, mode, inventory)
  if (!started.ok) throw new Error(`startGame: ${started.reason}`)
  let e = started.state
  let state: GameState = newGame(seed, DEFAULT_CONFIG, mode === 'eglence' ? { mode, inventory } : {})
  const clears: [number, number, number] = [0, 0, 0]
  let hitCap = false
  while (!state.gameOver) {
    if (state.moveCount >= MOVE_CAP) {
      hitCap = true
      break
    }
    if (state.stuck) {
      const action = jokerRescueAction(state)
      if (!action) throw new Error('Sıkışık durumda kurtarma bulunamadı')
      const r = applyJoker(state, action)
      if (!r.ok) throw new Error(`Geçersiz joker: ${r.reason}`)
      state = r.state
      const s = syncUsage(e, id, state.jokers)
      if (!s.ok) throw new Error(`syncUsage: ${s.reason}`)
      e = s.state
      continue
    }
    const move = bot(state)
    if (!move) throw new Error('Bot hamle bulamadı')
    const r = play(state, move)
    if (!r.ok) throw new Error(`Geçersiz hamle: ${r.reason}`)
    state = r.state
    const lines = linesCleared(r.events)
    if (lines > 0) {
      const i = (Math.min(lines, 3) - 1) as 0 | 1 | 2
      clears[i] += 1
    }
    const a = awardMove(e, id, state.moveCount, r.events)
    if (!a.ok) throw new Error(`awardMove: ${a.reason}`)
    e = a.state
  }
  const lineStars = e.active!.lineStars
  const f = finishGame(e, id, state.score, state.jokers)
  if (!f.ok) throw new Error(`finishGame: ${f.reason}`)
  const usage = f.state.history[f.state.history.length - 1]!.usage
  const total = (c: JokerCharges) => c.cekic + c.yenile + c.dondur
  return {
    econ: f.state,
    result: {
      score: state.score,
      moves: state.moveCount,
      lineStars,
      endStars: f.stars,
      clears,
      freeUsed: total(usage.free),
      purchasedUsed: total(usage.purchased),
      hitCap,
    },
  }
}

/** Tek oyun, verilen satın alınmış envanterle (bakiye yalnızca envanteri karşılamak için). */
function single(seed: number, mode: GameMode, bot: Bot, inventory: JokerCharges = NO_JOKERS): GameResult {
  return runGame(initialEconomy(inventory), `s${seed}`, seed, mode, bot).result
}

// ---------------------------------------------------------------------------
// İstatistik
// ---------------------------------------------------------------------------

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b)
const pct = (xs: number[], p: number): number => {
  const s = sorted(xs)
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))] ?? 0
}
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const BUCKETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 9],
  [10, 24],
  [25, 49],
  [50, 99],
  [100, 199],
  [200, 499],
  [500, Infinity],
]

interface Summary {
  games: number
  meanStars: number
  medianStars: number
  p10: number
  p25: number
  p75: number
  p90: number
  meanLineStars: number
  meanEndStars: number
  meanScore: number
  medianScore: number
  meanMoves: number
  clearsPerGame: [number, number, number]
  meanFreeUsed: number
  meanPurchasedUsed: number
  usedPurchasedShare: number
  histogram: number[]
  hitCap: number
}

function summarize(games: GameResult[]): Summary {
  const stars = games.map((g) => g.lineStars + g.endStars)
  return {
    games: games.length,
    meanStars: mean(stars),
    medianStars: pct(stars, 0.5),
    p10: pct(stars, 0.1),
    p25: pct(stars, 0.25),
    p75: pct(stars, 0.75),
    p90: pct(stars, 0.9),
    meanLineStars: mean(games.map((g) => g.lineStars)),
    meanEndStars: mean(games.map((g) => g.endStars)),
    meanScore: mean(games.map((g) => g.score)),
    medianScore: pct(games.map((g) => g.score), 0.5),
    meanMoves: mean(games.map((g) => g.moves)),
    clearsPerGame: [0, 1, 2].map((i) => mean(games.map((g) => g.clears[i]!))) as [number, number, number],
    meanFreeUsed: mean(games.map((g) => g.freeUsed)),
    meanPurchasedUsed: mean(games.map((g) => g.purchasedUsed)),
    usedPurchasedShare: games.filter((g) => g.purchasedUsed > 0).length / Math.max(1, games.length),
    histogram: BUCKETS.map(([lo, hi]) => stars.filter((s) => s >= lo && s <= hi).length / Math.max(1, games.length)),
    hitCap: games.filter((g) => g.hitCap).length,
  }
}

interface CareerSummary {
  policy: string
  careers: number
  length: number
  /** Oyun numarasına göre ortalama bakiye (her 10 oyunda bir). */
  balanceCurve: Array<[number, number]>
  finalBalanceMean: number
  finalBalanceMedian: number
  earnedPerGame: number
  spentPerGame: number
  boughtPerCareer: Record<JokerKind, number>
  meanScore: number
  purchasedUsedPerGame: number
  firstHalfStars: number
  secondHalfStars: number
}

/**
 * Kariyer: aynı oyuncu art arda Eğlence oyunları oynar. Politika:
 * - "biriktir": hiç satın almaz (yalnızca ücretsiz haklar).
 * - "harca": her oyundan sonra her jokerden 2 adede tamamlar (önce Yenile, sonra Çekiç, sonra Döndür)
 *   ve sahip olduğu bütün satın alınmış jokerleri bir sonraki oyuna getirir.
 */
function runCareers(profile: Profile, policy: 'biriktir' | 'harca'): CareerSummary {
  const finals: number[] = []
  const curve = new Map<number, number[]>()
  let earned = 0
  let spent = 0
  const bought: Record<JokerKind, number> = { cekic: 0, yenile: 0, dondur: 0 }
  const scores: number[] = []
  let purchasedUsed = 0
  let firstHalf = 0
  let secondHalf = 0
  for (let c = 0; c < profile.careers; c++) {
    let econ = initialEconomy()
    let req = 0
    for (let i = 0; i < profile.careerLength; i++) {
      const seed = 100_000 + c * 1_000 + i
      const before = econ.stars
      const spentBefore = econ.totals.spent
      const { econ: after, result } = runGame(econ, `c${c}-g${i}`, seed, 'eglence', profile.make(seed))
      econ = after
      const gained = econ.stars - before
      earned += gained
      if (i < profile.careerLength / 2) firstHalf += gained
      else secondHalf += gained
      scores.push(result.score)
      purchasedUsed += result.purchasedUsed
      if (policy === 'harca') {
        for (const kind of ['yenile', 'cekic', 'dondur'] as const) {
          while (econ.inventory[kind] < 2) {
            const r = purchase(econ, kind, `r${req++}`)
            if (!r.ok) break
            econ = r.state
            bought[kind]++
          }
        }
      }
      spent += econ.totals.spent - spentBefore
      if ((i + 1) % 10 === 0) curve.set(i + 1, [...(curve.get(i + 1) ?? []), econ.stars])
    }
    finals.push(econ.stars)
  }
  const games = profile.careers * profile.careerLength
  return {
    policy,
    careers: profile.careers,
    length: profile.careerLength,
    balanceCurve: [...curve.entries()].map(([n, xs]) => [n, mean(xs)]),
    finalBalanceMean: mean(finals),
    finalBalanceMedian: pct(finals, 0.5),
    earnedPerGame: earned / games,
    spentPerGame: spent / games,
    boughtPerCareer: { cekic: bought.cekic / profile.careers, yenile: bought.yenile / profile.careers, dondur: bought.dondur / profile.careers },
    meanScore: mean(scores),
    purchasedUsedPerGame: purchasedUsed / games,
    firstHalfStars: firstHalf / (games / 2),
    secondHalfStars: secondHalf / (games / 2),
  }
}

interface VariantSummary {
  label: string
  inventory: JokerCharges
  cost: number
  summary: Summary
  /** Aynı tohumlarda satın alınmış jokersiz Eğlence ile fark. */
  deltaStars: number
  deltaScore: number
  deltaMedianScore: number
}

interface ProfileResult {
  id: string
  name: string
  bot: string
  base: number
  klasik: Summary
  eglence: Summary
  variants: VariantSummary[]
  careers: CareerSummary[]
  seconds: number
}

const VARIANTS: ReadonlyArray<readonly [string, JokerCharges]> = [
  ['+1 Çekiç', { cekic: 1, yenile: 0, dondur: 0 }],
  ['+1 Yenile', { cekic: 0, yenile: 1, dondur: 0 }],
  ['+1 Döndür', { cekic: 0, yenile: 0, dondur: 1 }],
  ['+1 / +1 / +1', { cekic: 1, yenile: 1, dondur: 1 }],
]

function runProfile(profile: Profile): ProfileResult {
  const t0 = Date.now()
  const log = (what: string) => console.log(`${profile.name}: ${what} (${((Date.now() - t0) / 1000).toFixed(0)} sn)`)
  const klasik: GameResult[] = []
  const eglence: GameResult[] = []
  for (let seed = 1; seed <= profile.base; seed++) {
    klasik.push(single(seed, 'klasik', profile.make(seed)))
    eglence.push(single(seed, 'eglence', profile.make(seed)))
  }
  log('temel ölçüm')
  const baseFun = eglence.slice(0, profile.variants)
  const baseFunSummary = summarize(baseFun)
  const variants: VariantSummary[] = VARIANTS.map(([label, inventory]) => {
    const games: GameResult[] = []
    for (let seed = 1; seed <= profile.variants; seed++) games.push(single(seed, 'eglence', profile.make(seed), inventory))
    const summary = summarize(games)
    log(label)
    return {
      label,
      inventory,
      cost: KINDS.reduce((sum, k) => sum + inventory[k] * JOKER_PRICES[k], 0),
      summary,
      deltaStars: summary.meanStars - baseFunSummary.meanStars,
      deltaScore: summary.meanScore - baseFunSummary.meanScore,
      deltaMedianScore: summary.medianScore - baseFunSummary.medianScore,
    }
  })
  const careers = (['biriktir', 'harca'] as const).map((policy) => {
    const c = runCareers(profile, policy)
    log(`kariyer ${policy}`)
    return c
  })
  return {
    id: profile.id,
    name: profile.name,
    bot: profile.bot,
    base: profile.base,
    klasik: summarize(klasik),
    eglence: summarize(eglence),
    variants,
    careers,
    seconds: Math.round((Date.now() - t0) / 1000),
  }
}

// ---------------------------------------------------------------------------
// Rapor
// ---------------------------------------------------------------------------

const n0 = (n: number) => Math.round(n).toLocaleString('tr-TR')
const n1 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const pc = (n: number) => `%${(n * 100).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
const sign = (n: number, f = n1) => (n >= 0 ? `+${f(n)}` : `−${f(-n)}`)

function report(results: ProfileResult[]): string {
  const L: string[] = []
  L.push('# POPGRID — Yıldız ekonomisi simülasyonu (Aşama 7.1)', '')
  L.push('> **Bu bir bot simülasyonudur, gerçek kullanıcı davranışı değildir.** Botlar yalnızca kuralların büyüklük sırasını gösterir.')
  L.push('> Gerçek oyuncular jokeri daha erken kullanabilir, oyunu yarıda bırakabilir, daha az ya da daha çok oynayabilir.', '')
  L.push('## Yöntem', '')
  L.push('- Oyun motoru: üretici sürümü 1, varsayılan kurtarma ayarı, hamle sınırı 3.000. Motor bu aşamada değişmedi.')
  L.push('- Yıldızlar gerçek ekonomi defteriyle hesaplandı (`src/economy/ledger.ts`): her hamlede `awardMove`, joker sonrasında `syncUsage`, oyun sonunda `finishGame`.')
  L.push('- Kurallar: tek hamlede 1 hat = 2, 2 hat = 5, 3+ hat = 10 yıldız (birikmez); oyun sonunda `Math.floor(skor / 100) * 5`. Joker yıldız vermez.')
  L.push('- Yıldız tavanı (onaylı, defterde uygulanır): Eğlence Modu\'nda bir oyunda en fazla 300 yıldız (hat + oyun sonu toplamı); Klasik\'te tavan yok.')
  L.push('- Fiyatlar: Çekiç 25, Yenile 40, Döndür 20. Ücretsiz haklar her Eğlence oyununda 1 / 1 / 2.')
  L.push('- Botlar jokeri **yalnızca sıkışınca** kullanır (Aşama 6.1 ile aynı davranış). Önce ücretsiz hak, bitince satın alınmış hak harcanır (motor kuralı).')
  L.push('- Tohumlar: temel ölçüm ve satın alma deneyleri 1…N (her deney aynı tohumlarla, fark yalnızca envanterden gelir); kariyerler `100000 + kariyer × 1000 + oyun`. Rastgele botun kendi rastgeleliği: `createRng(tohum ^ 0xa5a5a5a5)`.')
  L.push('- Belirlenimli: aynı komut aynı tabloyu üretir. Yeniden üretmek için `npm run sim:economy`.')
  L.push('- Eğlence 0/0/0 (jokersiz Eğlence) Klasik ile birebir aynı oyunu verir (docs/sim-jokers.md kontrolü); bu yüzden "ücretsiz jokerin etkisi" Klasik ile Eğlence farkıdır.', '')
  L.push('| Profil | Bot | Temel oyun | Satın alma deneyi | Kariyer |')
  L.push('|---|---|---|---|---|')
  for (const r of results) {
    const p = PROFILES.find((x) => x.id === r.id)!
    L.push(`| ${r.name} | ${r.bot} | ${n0(r.base)} Klasik + ${n0(r.base)} Eğlence | ${n0(p.variants)} oyun × 4 | ${p.careers} × ${p.careerLength} oyun × 2 politika |`)
  }
  L.push('')

  L.push('## 1. Oyun başına yıldız', '')
  L.push('| Profil · mod | Ort. yıldız | Medyan | P10 – P25 – P75 – P90 | Hat yıldızı (ort.) | Oyun sonu yıldızı (ort.) | Ort. skor | Medyan skor | Ort. hamle |')
  L.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    for (const [m, s] of [['Klasik', r.klasik], ['Eğlence', r.eglence]] as const) {
      L.push(
        `| ${r.name} · ${m} | ${n1(s.meanStars)} | ${n0(s.medianStars)} | ${n0(s.p10)} – ${n0(s.p25)} – ${n0(s.p75)} – ${n0(s.p90)} | ${n1(s.meanLineStars)} | ${n1(s.meanEndStars)} | ${n0(s.meanScore)} | ${n0(s.medianScore)} | ${n0(s.meanMoves)} |`,
      )
    }
  }
  L.push('')
  L.push('Oyun başına hat temizleme sayısı (ortalama): 1 hat / 2 hat / 3+ hat.', '')
  L.push('| Profil · mod | 1 hat | 2 hat | 3+ hat |')
  L.push('|---|---|---|---|')
  for (const r of results) {
    for (const [m, s] of [['Klasik', r.klasik], ['Eğlence', r.eglence]] as const) {
      L.push(`| ${r.name} · ${m} | ${n1(s.clearsPerGame[0])} | ${n1(s.clearsPerGame[1])} | ${n1(s.clearsPerGame[2])} |`)
    }
  }
  L.push('')

  L.push('## 2. Yıldız dağılımı (oyunların yüzdesi)', '')
  L.push(`| Profil · mod | ${BUCKETS.map(([lo, hi]) => (hi === Infinity ? `${lo}+` : lo === hi ? `${lo}` : `${lo}–${hi}`)).join(' | ')} |`)
  L.push(`|---|${BUCKETS.map(() => '---').join('|')}|`)
  for (const r of results) {
    for (const [m, s] of [['Klasik', r.klasik], ['Eğlence', r.eglence]] as const) {
      L.push(`| ${r.name} · ${m} | ${s.histogram.map(pc).join(' | ')} |`)
    }
  }
  L.push('')

  L.push('## 3. Bir joker için gereken tahmini oyun sayısı', '')
  L.push('Fiyat ÷ oyun başına yıldız. Ortalamaya ve medyana göre ayrı verildi (dağılım sağa çarpık olduğu için ortalama daha iyimser).', '')
  L.push('| Profil · mod | Çekiç (25) ort. / medyan | Yenile (40) ort. / medyan | Döndür (20) ort. / medyan |')
  L.push('|---|---|---|---|')
  const games = (price: number, per: number) => (per > 0 ? n1(price / per) : '∞')
  for (const r of results) {
    for (const [m, s] of [['Klasik', r.klasik], ['Eğlence', r.eglence]] as const) {
      L.push(
        `| ${r.name} · ${m} | ${KINDS.map((k) => `${games(JOKER_PRICES[k], s.meanStars)} / ${games(JOKER_PRICES[k], s.medianStars)}`).join(' | ')} |`,
      )
    }
  }
  L.push('')

  L.push('## 4. Ücretsiz jokerlerin etkisi (Eğlence ÷ Klasik, aynı tohumlar)', '')
  L.push('| Profil | Ort. yıldız Klasik → Eğlence | Oran | Ort. skor oranı | Kullanılan ücretsiz hak / oyun |')
  L.push('|---|---|---|---|---|')
  for (const r of results) {
    L.push(
      `| ${r.name} | ${n1(r.klasik.meanStars)} → ${n1(r.eglence.meanStars)} | ×${(r.eglence.meanStars / Math.max(1e-9, r.klasik.meanStars)).toFixed(2).replace('.', ',')} | ×${(r.eglence.meanScore / Math.max(1e-9, r.klasik.meanScore)).toFixed(2).replace('.', ',')} | ${n1(r.eglence.meanFreeUsed)} |`,
    )
  }
  L.push('')

  L.push('## 5. Satın alınmış jokerin Eğlence skoruna ve yıldıza etkisi', '')
  L.push('Aynı tohumlarla, ücretsiz 1/1/2 hakka EK olarak satın alınmış joker getirilen oyunlar. **Geri ödeme** = ek kazanılan yıldız ÷ jokerin fiyatı; 1’in üzerindeyse joker kendi parasını çıkarıyor demektir (enflasyon riski).', '')
  L.push('| Profil | Envanter | Fiyat | Kullanılma oranı | Ort. skor farkı | Medyan skor farkı | Ort. yıldız farkı | Geri ödeme |')
  L.push('|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    for (const v of r.variants) {
      L.push(
        `| ${r.name} | ${v.label} | ${v.cost} | ${pc(v.summary.usedPurchasedShare)} | ${sign(v.deltaScore, n0)} | ${sign(v.deltaMedianScore, n0)} | ${sign(v.deltaStars)} | ${(v.deltaStars / v.cost).toFixed(2).replace('.', ',')} |`,
      )
    }
  }
  L.push('')

  L.push('## 6. Yıldız birikimi ve enflasyon (kariyer)', '')
  L.push('Aynı oyuncu art arda Eğlence oynar. **biriktir:** hiç satın almaz. **harca:** her oyundan sonra her jokerden 2 adede tamamlar (önce Yenile, sonra Çekiç, sonra Döndür) ve hepsini sonraki oyuna getirir.', '')
  L.push('| Profil · politika | Kazanılan / oyun | Harcanan / oyun | Son bakiye ort. (medyan) | Alınan Ç / Y / D (kariyer başına) | Kullanılan satın alınmış / oyun | Ort. skor | İlk yarı → ikinci yarı yıldız / oyun |')
  L.push('|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    for (const c of r.careers) {
      L.push(
        `| ${r.name} · ${c.policy} | ${n1(c.earnedPerGame)} | ${n1(c.spentPerGame)} | ${n0(c.finalBalanceMean)} (${n0(c.finalBalanceMedian)}) | ${KINDS.map((k) => n1(c.boughtPerCareer[k])).join(' / ')} | ${n1(c.purchasedUsedPerGame)} | ${n0(c.meanScore)} | ${n1(c.firstHalfStars)} → ${n1(c.secondHalfStars)} |`,
      )
    }
  }
  L.push('')
  L.push('Ortalama bakiye eğrisi (her 10 oyunda bir):', '')
  for (const r of results) {
    for (const c of r.careers) {
      L.push(`- ${r.name} · ${c.policy}: ${c.balanceCurve.map(([g, b]) => `${g}. oyun ${n0(b)}`).join(' · ')}`)
    }
  }
  L.push('')
  const capped = results.flatMap((r) => [r.klasik, r.eglence].map((s) => s.hitCap)).reduce((a, b) => a + b, 0)
  L.push('Yorum ve öneriler: docs/asama-7.1-ekonomi.md.', '')
  L.push(`Hamle sınırına ulaşan temel ölçüm oyunu: ${capped}. Süre: ${results.map((r) => `${r.name} ${r.seconds} sn`).join(', ')}.`, '')
  return L.join('\n')
}

// ---------------------------------------------------------------------------

const DOCS = join(import.meta.dirname, '..', 'docs')
const JSON_OUT = join(DOCS, 'sim-economy.json')
const only = process.argv[2]?.split(',').filter(Boolean)
const selected = PROFILES.filter((p) => !only || only.includes(p.id))
const fresh = selected.map(runProfile)

// Seçilmeyen profillerin önceki sonuçları korunur (profiller ayrı ayrı çalıştırılabilsin diye).
const previous: ProfileResult[] = existsSync(JSON_OUT) ? (JSON.parse(readFileSync(JSON_OUT, 'utf8')) as ProfileResult[]) : []
const merged = PROFILES.map((p) => fresh.find((r) => r.id === p.id) ?? previous.find((r) => r.id === p.id)).filter(
  (r): r is ProfileResult => !!r,
)
writeFileSync(JSON_OUT, JSON.stringify(merged, null, 1) + '\n')
writeFileSync(join(DOCS, 'sim-economy.md'), report(merged) + '\n')
console.log(`Yazıldı: docs/sim-economy.md (${merged.map((r) => r.name).join(', ')})`)
