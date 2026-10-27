/**
 * Ekonomi dengeleme karşılaştırması (Aşama 7.1 ek). Onaylı değerler DEĞİŞMEZ; senaryolar
 * scripts/economy-policy.ts'teki prototip kurallarla, AYNI tohumlar ve AYNI oyunlar üzerinde hesaplanır.
 *
 * İki adım:
 *   1) Oyunları oynat (paralel çalıştırılabilir):
 *        vite-node scripts/simulate-economy-balance.ts collect <profil> <parça> <parça sayısı>
 *      ör. ... collect deneyimli 0 2   ve   ... collect deneyimli 1 2
 *   2) Rapor:  vite-node scripts/simulate-economy-balance.ts report
 * Kısayol: npm run sim:balance  (bütün profiller tek süreçte, sonra rapor)
 * Ara veriler: .sim-cache/ (git'e girmez). Rapor: docs/sim-economy-balance.md
 *
 * UYARI: Botlar gerçek oyuncu değildir; sonuçlar kuralların birbirine göre etkisini gösterir.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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
import { JOKER_PRICES, starsForMove } from '../src/economy/rules'
import { greedyBot, jokerRescueAction, plannerBot, randomBot, type Bot } from './bot'
import { POLICIES, gameStars, hitCap, type StarPolicy } from './economy-policy'

const MOVE_CAP = 3000
const CAREER_LENGTH = 100
const KINDS: readonly JokerKind[] = ['cekic', 'yenile', 'dondur']
const ROOT = join(import.meta.dirname, '..')
const CACHE = process.env.SIM_CACHE ?? join(ROOT, '.sim-cache')

interface Profile {
  readonly id: string
  readonly name: string
  readonly bot: string
  readonly make: (seed: number) => Bot
  /** Kariyer sayısı; temel ölçüm tohumları 1 … kariyer × 100 (kariyerler bu tohumları sırayla oynar). */
  readonly careers: number
  /** Satın alma deneyi oyun sayısı (tohum 1 … N), her deney türü için. */
  readonly variants: number
}

const planner = plannerBot()
const PROFILES: readonly Profile[] = [
  { id: 'yeni', name: 'Yeni başlayan', bot: 'rastgele bot', make: (s) => randomBot(createRng(s ^ 0xa5a5a5a5)), careers: 20, variants: 2000 },
  { id: 'ortalama', name: 'Ortalama', bot: 'greedy bot', make: () => greedyBot, careers: 10, variants: 500 },
  { id: 'deneyimli', name: 'Deneyimli', bot: 'planlayıcı bot', make: () => planner, careers: 2, variants: 100 },
]

const VARIANTS: ReadonlyArray<readonly [string, JokerCharges]> = [
  ['+1 Çekiç', { cekic: 1, yenile: 0, dondur: 0 }],
  ['+1 Yenile', { cekic: 0, yenile: 1, dondur: 0 }],
  ['+1 Döndür', { cekic: 0, yenile: 0, dondur: 1 }],
  ['+1/+1/+1', { cekic: 1, yenile: 1, dondur: 1 }],
]

// ---------------------------------------------------------------------------
// Oyun oynatma
// ---------------------------------------------------------------------------

interface RawGame {
  seed: number
  score: number
  moves: number
  lineStars: number
  lineAtPurchase: number
  scoreAtPurchase: number
  usedPurchased: boolean
  /** Oyun sonunda kalan satın alınmış haklar. */
  left: JokerCharges
  purchasedUsed: number
}

const invKey = (c: JokerCharges) => `${c.cekic}.${c.yenile}.${c.dondur}`

function playRaw(seed: number, mode: GameMode, inventory: JokerCharges, bot: Bot): RawGame {
  let state: GameState = newGame(seed, DEFAULT_CONFIG, mode === 'eglence' ? { mode, inventory } : {})
  let lineStars = 0
  let lineAtPurchase = -1
  let scoreAtPurchase = -1
  while (!state.gameOver && state.moveCount < MOVE_CAP) {
    if (state.stuck) {
      const action = jokerRescueAction(state)
      if (!action) throw new Error('kurtarma yok')
      const r = applyJoker(state, action)
      if (!r.ok) throw new Error(r.reason)
      if (lineAtPurchase < 0 && r.events.some((e) => e.type === 'jokerUsed' && e.source === 'inventory')) {
        lineAtPurchase = lineStars
        scoreAtPurchase = state.score
      }
      state = r.state
      continue
    }
    const r = play(state, bot(state)!)
    if (!r.ok) throw new Error(r.reason)
    lineStars += starsForMove(r.events)
    state = r.state
  }
  const left = state.jokers?.inventory ?? NO_JOKERS
  const used = mode === 'eglence' ? KINDS.reduce((s, k) => s + inventory[k] - left[k], 0) : 0
  return {
    seed,
    score: state.score,
    moves: state.moveCount,
    lineStars,
    lineAtPurchase: lineAtPurchase < 0 ? lineStars : lineAtPurchase,
    scoreAtPurchase: scoreAtPurchase < 0 ? state.score : scoreAtPurchase,
    usedPurchased: used > 0,
    left: { ...left },
    purchasedUsed: used,
  }
}

interface CareerGame {
  stars: number
  capped: boolean
  score: number
  purchasedUsed: number
  balance: number
  spent: number
}

interface CareerRun {
  career: number
  policy: string
  games: CareerGame[]
  bought: Record<JokerKind, number>
}

/**
 * "harca" kariyeri: her oyundan sonra her jokerden 2 adede tamamlar (Yenile, Çekiç, Döndür sırasıyla;
 * bakiye yettiği kadar) ve hepsini sonraki oyuna getirir. Senaryo yalnızca yıldız hesabını değiştirir;
 * bakiye kısıtlanırsa alınan jokerler, dolayısıyla oyunlar da değişir.
 */
function runCareer(profile: Profile, career: number, p: StarPolicy, memo: Map<string, RawGame>): CareerRun {
  let balance = 0
  let inventory: JokerCharges = NO_JOKERS
  const games: CareerGame[] = []
  const bought: Record<JokerKind, number> = { cekic: 0, yenile: 0, dondur: 0 }
  for (let i = 0; i < CAREER_LENGTH; i++) {
    const seed = career * CAREER_LENGTH + i + 1
    const key = `${seed}|${invKey(inventory)}`
    let raw = memo.get(key)
    if (!raw) {
      raw = playRaw(seed, 'eglence', inventory, profile.make(seed))
      memo.set(key, raw)
    }
    const stars = gameStars(p, raw)
    balance += stars
    const inv = { ...raw.left }
    let spent = 0
    for (const kind of ['yenile', 'cekic', 'dondur'] as const) {
      while (inv[kind] < 2 && balance >= JOKER_PRICES[kind]) {
        balance -= JOKER_PRICES[kind]
        spent += JOKER_PRICES[kind]
        inv[kind]++
        bought[kind]++
      }
    }
    inventory = inv
    games.push({ stars, capped: hitCap(p, raw), score: raw.score, purchasedUsed: raw.purchasedUsed, balance, spent })
  }
  return { career, policy: p.id, games, bought }
}

interface Shard {
  profile: string
  base: { klasik: RawGame[]; eglence: RawGame[] }
  variants: Record<string, RawGame[]>
  careers: CareerRun[]
  seconds: number
}

function collect(profileId: string, shard: number, shards: number): void {
  const profile = PROFILES.find((p) => p.id === profileId)
  if (!profile) throw new Error(`Profil yok: ${profileId}`)
  const t0 = Date.now()
  const out: Shard = { profile: profile.id, base: { klasik: [], eglence: [] }, variants: {}, careers: [], seconds: 0 }
  type Unit = () => void
  const units: Unit[] = []
  const memo = new Map<string, RawGame>()
  for (let c = 0; c < profile.careers; c++) {
    units.push(() => {
      for (const p of POLICIES) out.careers.push(runCareer(profile, c, p, memo))
      console.log(`${profile.name} [${shard}] kariyer ${c + 1}/${profile.careers} (${((Date.now() - t0) / 1000).toFixed(0)} sn)`)
    })
  }
  const seeds = profile.careers * CAREER_LENGTH
  for (let s = 1; s <= seeds; s++) {
    units.push(() => {
      out.base.klasik.push(playRaw(s, 'klasik', NO_JOKERS, profile.make(s)))
      const fun = playRaw(s, 'eglence', NO_JOKERS, profile.make(s))
      out.base.eglence.push(fun)
      memo.set(`${s}|0.0.0`, fun)
    })
  }
  for (const [label, inv] of VARIANTS) {
    for (let s = 1; s <= profile.variants; s++) {
      units.push(() => {
        ;(out.variants[label] ??= []).push(playRaw(s, 'eglence', inv, profile.make(s)))
      })
    }
  }
  // Kariyerler en sona: önce temel oyunlar belleğe alınır (aynı parçadaki 0 envanterli oyunlar tekrar oynanmaz).
  const mine = units.map((u, i) => [u, i] as const).filter(([, i]) => i % shards === shard)
  const careerUnits = mine.filter(([, i]) => i < profile.careers)
  for (const [u] of mine.filter(([, i]) => i >= profile.careers)) u()
  console.log(`${profile.name} [${shard}] temel ve deney oyunları bitti (${((Date.now() - t0) / 1000).toFixed(0)} sn)`)
  for (const [u] of careerUnits) u()
  out.seconds = Math.round((Date.now() - t0) / 1000)
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(join(CACHE, `${profile.id}-${shard}-of-${shards}.json`), JSON.stringify(out))
  console.log(`${profile.name} [${shard}/${shards}] yazıldı (${out.seconds} sn)`)
}

// ---------------------------------------------------------------------------
// Rapor
// ---------------------------------------------------------------------------

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length === 0 ? 0 : s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2
}
/** Ortalamanın %95 güven aralığının yarı genişliği (normal yaklaşım). */
const ci = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
  return (1.96 * sd) / Math.sqrt(xs.length)
}
const n0 = (n: number) => Math.round(n).toLocaleString('tr-TR')
const n1 = (n: number) => (Math.abs(n) < 0.05 ? 0 : n).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const n2 = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pc = (n: number) => `%${(n * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`
const signed = (n: number, f: (x: number) => string) => (n > 0 ? `+${f(n)}` : n < 0 ? `−${f(-n)}` : f(0))

interface Merged {
  profile: Profile
  klasik: RawGame[]
  eglence: RawGame[]
  variants: Record<string, RawGame[]>
  careers: CareerRun[]
  seconds: number
  shards: number
}

function load(): Merged[] {
  if (!existsSync(CACHE)) throw new Error(`Önbellek yok: ${CACHE}. Önce collect çalıştır.`)
  const files = readdirSync(CACHE).filter((f) => f.endsWith('.json'))
  return PROFILES.flatMap((profile) => {
    const shards = files.filter((f) => f.startsWith(`${profile.id}-`)).map((f) => JSON.parse(readFileSync(join(CACHE, f), 'utf8')) as Shard)
    if (shards.length === 0) return []
    const bySeed = (xs: RawGame[]) => xs.sort((a, b) => a.seed - b.seed)
    const variants: Record<string, RawGame[]> = {}
    for (const [label] of VARIANTS) variants[label] = bySeed(shards.flatMap((s) => s.variants[label] ?? []))
    return [
      {
        profile,
        klasik: bySeed(shards.flatMap((s) => s.base.klasik)),
        eglence: bySeed(shards.flatMap((s) => s.base.eglence)),
        variants,
        careers: shards.flatMap((s) => s.careers),
        seconds: Math.max(...shards.map((s) => s.seconds)),
        shards: shards.length,
      },
    ]
  })
}

interface Row {
  p: StarPolicy
  funMean: number
  funCi: number
  funMedian: number
  funCapped: number
  klasikMean: number
  klasikMedian: number
  klasikCapped: number
  /** Satın almayan oyuncunun Eğlence yıldızındaki değişim (A'ya göre). */
  nonBuyerFun: number
  nonBuyerKlasik: number
  payback: Record<string, { ratio: number; ci: number }>
  gamesPerJoker: Record<JokerKind, number>
  save: [number, number, number]
  spend: [number, number, number]
  spendEarned: number
  spendSpent: number
  spendScore: number
  saveScore: number
  spendCapped: number
  spendPurchasedUsed: number
}

function rows(m: Merged): Row[] {
  const A = POLICIES[0]!
  const fun = (p: StarPolicy) => m.eglence.map((g) => gameStars(p, g))
  const kl = (p: StarPolicy) => m.klasik.map((g) => gameStars(p, g))
  const funA = mean(fun(A))
  const klA = mean(kl(A))
  return POLICIES.map((p) => {
    const f = fun(p)
    const k = kl(p)
    const payback: Row['payback'] = {}
    for (const [label, inv] of VARIANTS) {
      const games = m.variants[label] ?? []
      const cost = KINDS.reduce((s, kind) => s + inv[kind] * JOKER_PRICES[kind], 0)
      const deltas = games.map((g) => {
        const base = m.eglence[g.seed - 1]
        if (!base || base.seed !== g.seed) throw new Error('tohum eşleşmedi')
        return gameStars(p, g) - gameStars(p, base)
      })
      payback[label] = { ratio: mean(deltas) / cost, ci: ci(deltas) / cost }
    }
    // Biriktiren oyuncu: kariyer c, temel Eğlence oyunlarını sırayla oynar (satın alma yok).
    const saveCurves: number[][] = []
    for (let c = 0; c < m.profile.careers; c++) {
      let b = 0
      saveCurves.push(m.eglence.slice(c * CAREER_LENGTH, (c + 1) * CAREER_LENGTH).map((g) => (b += gameStars(p, g))))
    }
    const spendRuns = m.careers.filter((r) => r.policy === p.id)
    const at = (curves: number[][], n: number) => mean(curves.map((c) => c[n - 1] ?? 0))
    const spendCurves = spendRuns.map((r) => r.games.map((g) => g.balance))
    const spendGames = spendRuns.flatMap((r) => r.games)
    return {
      p,
      funMean: mean(f),
      funCi: ci(f),
      funMedian: median(f),
      funCapped: m.eglence.filter((g) => hitCap(p, g)).length / m.eglence.length,
      klasikMean: mean(k),
      klasikMedian: median(k),
      klasikCapped: m.klasik.filter((g) => hitCap(p, g)).length / m.klasik.length,
      nonBuyerFun: mean(f) / funA - 1,
      nonBuyerKlasik: mean(k) / klA - 1,
      payback,
      gamesPerJoker: {
        cekic: JOKER_PRICES.cekic / Math.max(1e-9, median(f)),
        yenile: JOKER_PRICES.yenile / Math.max(1e-9, median(f)),
        dondur: JOKER_PRICES.dondur / Math.max(1e-9, median(f)),
      },
      save: [at(saveCurves, 10), at(saveCurves, 40), at(saveCurves, 100)],
      spend: [at(spendCurves, 10), at(spendCurves, 40), at(spendCurves, 100)],
      spendEarned: mean(spendGames.map((g) => g.stars)),
      spendSpent: mean(spendGames.map((g) => g.spent)),
      spendScore: mean(spendGames.map((g) => g.score)),
      saveScore: mean(m.eglence.slice(0, m.profile.careers * CAREER_LENGTH).map((g) => g.score)),
      spendCapped: spendGames.filter((g) => g.capped).length / Math.max(1, spendGames.length),
      spendPurchasedUsed: mean(spendGames.map((g) => g.purchasedUsed)),
    }
  })
}

function report(): void {
  const all = load()
  const L: string[] = []
  L.push('# POPGRID — Ekonomi dengeleme karşılaştırması (Aşama 7.1 ek)', '')
  L.push('> **Bot simülasyonudur, gerçek kullanıcı davranışı değildir.** Tablolar senaryoların birbirine göre etkisini gösterir.')
  L.push('> Onaylı değerler (hat 2/5/10, oyun sonu ⌊skor/100⌋×5, fiyatlar 25/40/20) DEĞİŞMEDİ; senaryolar yalnızca simülasyonda hesaplandı.', '')
  L.push('## Yöntem', '')
  L.push('- Her profilde bütün senaryolar **aynı oyunlar** üzerinde hesaplanır: oyunlar bir kez oynanır, her senaryonun yıldız kuralı aynı ham veriye uygulanır (`scripts/economy-policy.ts` → `gameStars`).')
  L.push('- Tavan, oyunun **hat + oyun sonu toplamına** uygulanır (oyun içinde adım adım uygulaması `policyMove` / `policyEnd`; kapalı biçimle eşitliği testli).')
  L.push('- Temel ölçüm: tohum 1 … (kariyer × 100), Klasik ve Eğlence, satın alınmış joker yok. Satın alma deneyi: aynı tohumlar 1 … N, ücretsiz 1/1/2 hakka ek envanter; geri ödeme **eşleştirilmiş** farklardan (aynı tohum, envanterli − envantersiz) hesaplanır, ± %95 güven aralığı.')
  L.push('- Kariyer: kariyer c, tohum c×100+1 … c×100+100 oyunlarını sırayla oynar. **Biriktir:** hiç almaz (temel Eğlence oyunlarının aynısı). **Harca:** her oyundan sonra her jokerden 2 adede tamamlar (Yenile → Çekiç → Döndür, bakiye yettiği kadar) ve hepsini sonraki oyuna getirir.')
  L.push('- Botlar jokeri yalnızca sıkışınca kullanır; ücretsiz hak önce harcanır (motor kuralı). Belirlenimli: aynı komut aynı tabloyu verir.')
  L.push('- Senaryolar: **A** mevcut · **B** satın alınmış joker kullanılan oyunda oyun sonu yıldızı yok · **C** oyun başı tavan · **D** B + tavan · **E** dondurma: satın alınmış ilk joker kullanıldığı anda o oyunun yıldız hesabı kapanır (o ana kadarki hat yıldızı + o anki skora göre oyun sonu; sonrası yıldız vermez) · **E200y** E + yumuşak tavan (200 üstü %25).', '')
  L.push('| Profil | Bot | Temel oyun (Klasik + Eğlence) | Deney oyunu (her tür) | Kariyer (harca, her senaryo) |')
  L.push('|---|---|---|---|---|')
  for (const m of all) L.push(`| ${m.profile.name} | ${m.profile.bot} | ${n0(m.eglence.length)} + ${n0(m.eglence.length)} | ${n0(m.variants['+1 Yenile']?.length ?? 0)} | ${m.profile.careers} × ${CAREER_LENGTH} |`)
  L.push('')
  const exp = all.find((m) => m.profile.id === 'deneyimli')
  if (exp) {
    L.push(`**Deneyimli profilin örneklem sınırı:** planlayıcı bot hamle başına yaklaşık 9 ms harcıyor; bu yüzden ${exp.eglence.length} temel oyun, deney başına ${exp.variants['+1 Yenile']?.length ?? 0} oyun ve yalnızca ${exp.profile.careers} kariyer (${exp.profile.careers * CAREER_LENGTH} oyun) çalıştırıldı (7.1 raporunun iki katı). Ortalamalar için ± aralıkları verildi; kariyer bakiyeleri 2 dizinin ortalamasıdır ve kesin değer gibi okunmamalıdır.`, '')
  }

  for (const m of all) {
    const R = rows(m)
    L.push(`## ${m.profile.name} (${m.profile.bot})`, '')
    L.push('### Oyun başına yıldız (satın alınmış joker yok)', '')
    L.push('| Senaryo | Eğlence ort. ± %95 | Eğlence medyan | Eğlence tavana ulaşan | Klasik ort. | Klasik medyan | Klasik tavana ulaşan | Satın almayan oyuncuya etki (Eğlence / Klasik) | Bir joker için oyun Ç / Y / D (medyan) |')
    L.push('|---|---|---|---|---|---|---|---|---|')
    for (const r of R) {
      L.push(
        `| ${r.p.label} | ${n1(r.funMean)} ± ${n1(r.funCi)} | ${n1(r.funMedian)} | ${pc(r.funCapped)} | ${n1(r.klasikMean)} | ${n1(r.klasikMedian)} | ${pc(r.klasikCapped)} | ${signed(r.nonBuyerFun * 100, n1)}% / ${signed(r.nonBuyerKlasik * 100, n1)}% | ${n2(r.gamesPerJoker.cekic)} / ${n2(r.gamesPerJoker.yenile)} / ${n2(r.gamesPerJoker.dondur)} |`,
      )
    }
    L.push('')
    L.push('### Joker maliyetini geri kazanma oranı (ek yıldız ÷ fiyat; 1 üstü = joker kendini finanse ediyor)', '')
    L.push(`| Senaryo | ${VARIANTS.map(([l]) => l).join(' | ')} |`)
    L.push(`|---|${VARIANTS.map(() => '---').join('|')}|`)
    for (const r of R) L.push(`| ${r.p.label} | ${VARIANTS.map(([l]) => `${n2(r.payback[l]!.ratio)} ± ${n2(r.payback[l]!.ci)}`).join(' | ')} |`)
    L.push('')
    L.push('### Bakiye eğilimi ve kariyer', '')
    L.push('| Senaryo | Biriktir bakiye 10 / 40 / 100 oyun | Harca bakiye 10 / 40 / 100 oyun | Harca: kazanılan / harcanan yıldız (oyun başı) | Harca: kullanılan satın alınmış / oyun | Harca: tavana ulaşan | Ort. skor biriktir → harca |')
    L.push('|---|---|---|---|---|---|---|')
    for (const r of R) {
      L.push(
        `| ${r.p.label} | ${r.save.map(n0).join(' / ')} | ${r.spend.map(n0).join(' / ')} | ${n1(r.spendEarned)} / ${n1(r.spendSpent)} | ${n1(r.spendPurchasedUsed)} | ${pc(r.spendCapped)} | ${n0(r.saveScore)} → ${n0(r.spendScore)} |`,
      )
    }
    L.push('')
  }
  L.push('Yorum ve öneri: docs/asama-7.1-dengeleme.md.', '')
  L.push(`Süre (en uzun parça): ${all.map((m) => `${m.profile.name} ${m.seconds} sn / ${m.shards} parça`).join(', ')}.`, '')
  writeFileSync(join(ROOT, 'docs', 'sim-economy-balance.md'), L.join('\n'))
  console.log('Yazıldı: docs/sim-economy-balance.md')
}

const [cmd, a, b, c] = process.argv.slice(2)
if (cmd === 'collect') collect(a ?? '', Number(b ?? 0), Number(c ?? 1))
else if (cmd === 'report') report()
else if (cmd === 'all') {
  for (const p of PROFILES) collect(p.id, 0, 1)
  report()
} else {
  console.log('Kullanım: collect <profil> <parça> <parça sayısı> | report | all')
}
