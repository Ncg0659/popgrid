/**
 * Aşama 10.2 — günlük görevler, başarımlar ve ödül güvenliği (saf mantık + kayıt).
 * Oyuncu kayıtlarına dokunmaz: her test kendi bellek deposunu kullanır.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, newGame, play, type GameEvent, type GameState } from '../src/engine'
import {
  ACHIEVEMENTS,
  DAILY_BONUS,
  DAILY_POOLS,
  DAILY_POOLS_V1,
  DAILY_REWARDS,
  DAILY_TIERS,
  GOALS_CATALOG_VERSION,
  pointWeight,
  pointsTemplate,
  type DailyKind,
} from '../src/economy/goalsCatalog'
import {
  NO_PROGRESS,
  allDailyDone,
  applyProgress,
  currentStreak,
  dailyMissions,
  initialGoals,
  isDayKey,
  localDayKey,
  missionView,
  previousDay,
  progressFromEvents,
  unlockedAchievements,
  type GoalsState,
} from '../src/economy/goals'
import { ECONOMY_SCHEMA_VERSION, awardMove, initialEconomy, startGame, type EconomyState } from '../src/economy/ledger'
import { LEASE_MS } from '../src/economy/ownership'
import {
  DAILY_ID_DAYS,
  MAX_DAILY_STARS,
  achievementRewardId,
  achievementRewardStatus,
  bonusRewardId,
  claimReward,
  dailyRewardId,
  dailyRewardStatus,
  parseRewardId,
  pruneRewardIds,
  rollover,
} from '../src/economy/rewards'
import { parseEconomy, serializeEconomy } from '../src/economy/schema'
import { ECONOMY_KEY, createEconomyStore, type EconomyStore } from '../src/storage/economy'
import { greedyBot, plannerBot } from '../scripts/bot'

// ------------------------------------------------------------------ yardımcılar

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  let failWrites = false
  return {
    data,
    set failWrites(v: boolean) {
      failWrites = v
    },
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failWrites) throw new Error('QuotaExceededError')
      data.set(k, v)
    },
  }
}
type Mem = ReturnType<typeof memoryStorage>

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** Sahte saat; gün anahtarı UTC (testin saat diliminden bağımsız). */
const clock = { t: Date.UTC(2026, 10, 8, 10) }
const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10)
let tabSeq = 0
const tab = (st: Mem): EconomyStore => createEconomyStore(st, { tabId: `gt-${++tabSeq}`, now: () => clock.t, day: utcDay })
function owned(st: Mem): EconomyStore {
  const s = tab(st)
  expect(s.claim().ok).toBe(true)
  return s
}
const saved = (st: Mem): EconomyState => {
  const r = parseEconomy(st.data.get(ECONOMY_KEY) ?? null)
  expect(r.status === 'ok' || r.status === 'empty').toBe(true)
  return r.state
}

const cleared = (rows: number[], cols: number[] = []): GameEvent => ({ type: 'cleared', rows, cols, cells: [] })
const placed = (): GameEvent => ({ type: 'placed', slot: 0, shapeId: 'sq1', color: 1, cells: [0] }) as GameEvent
/** Hamle puanı = toplam puan (bu yardımcıyla tek hamlelik oyun). Sürüm 2 'points' görevi hamle puanını oranlı toplar. */
const scored = (score: number, gained = score): GameEvent =>
  ({ type: 'scored', score, breakdown: { placement: 0, lines: 0, clearBase: 0, comboMultiplier: 1, clear: gained, total: gained } }) as GameEvent
const ALL8 = [0, 1, 2, 3, 4, 5, 6, 7]
/** Her görev türünü en zor hedefin üstüne taşıyan tek "hamle" (yalnızca defter testi içindir, motor üretmez). */
const BIG_MOVE: GameEvent[] = [
  ...Array.from({ length: 30 }, placed),
  cleared(ALL8, ALL8),
  cleared(ALL8, ALL8),
  cleared(ALL8, ALL8),
  cleared(ALL8, ALL8),
  scored(3000),
  { type: 'combo', combo: 6 },
]

let gameSeq = 0
/** Bugünün üç görevini (ve bonusu) tamamlar: 2 Klasik oyun bitirir, hamlede bütün sayaçları doldurur. */
function completeToday(store: EconomyStore): void {
  for (let i = 0; i < 2; i++) {
    const id = `gg-${++gameSeq}`
    expect(store.startGame(id, 'klasik').ok).toBe(true)
    expect(store.awardMove(id, 1, i === 0 ? BIG_MOVE : [placed(), scored(1500)]).ok).toBe(true)
    expect(store.finishGame(id, 3000, null).ok).toBe(true)
  }
}

// ------------------------------------------------------------------ katalog

describe('Aşama 10.2: katalog', () => {
  it('21 başarım (7 seri × 3), tekil kimlik, toplam 1.775 ★', () => {
    expect(ACHIEVEMENTS.length).toBe(21)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(21)
    expect(new Set(ACHIEVEMENTS.map((a) => a.metric)).size).toBe(7)
    expect(ACHIEVEMENTS.reduce((n, a) => n + a.reward, 0)).toBe(1775)
    const bySeries = (p: string) => ACHIEVEMENTS.filter((a) => a.id.startsWith(`${p}-`)).reduce((n, a) => n + a.reward, 0)
    expect([bySeries('hat'), bySeries('klasik'), bySeries('eglence'), bySeries('kombo'), bySeries('bomba'), bySeries('sans'), bySeries('duzenli')]).toEqual([
      300, 250, 250, 175, 250, 250, 300,
    ])
    // Her seride hedefler ve ödüller artan.
    for (const m of new Set(ACHIEVEMENTS.map((a) => a.metric))) {
      const s = ACHIEVEMENTS.filter((a) => a.metric === m)
      expect(s.length).toBe(3)
      expect(s[0]!.target < s[1]!.target && s[1]!.target < s[2]!.target).toBe(true)
    }
  })

  it('günlük ödüller 10 / 20 / 30 + 20 bonus = günde en çok 80 ★', () => {
    expect(DAILY_TIERS.map((t) => DAILY_REWARDS[t])).toEqual([10, 20, 30])
    expect(DAILY_BONUS).toBe(20)
    expect(MAX_DAILY_STARS).toBe(80)
  })
})

// ------------------------------------------------------------------ gün ve görev üretimi

describe('Aşama 10.2: gün anahtarı ve günlük görevler', () => {
  it('gün anahtarı doğrulama ve önceki gün (ay/yıl/artık yıl geçişi)', () => {
    expect(isDayKey('2026-11-08')).toBe(true)
    for (const bad of ['2026-02-30', '2026-13-01', '26-11-08', '2026-1-8', '', null, 20261108, '1999-12-31']) expect(isDayKey(bad)).toBe(false)
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2028-03-01')).toBe('2028-02-29')
    expect(previousDay('2027-01-01')).toBe('2026-12-31')
    expect(localDayKey(new Date(2026, 10, 8, 23, 59).getTime())).toBe('2026-11-08')
    expect(localDayKey(new Date(2026, 10, 9, 0, 0).getTime())).toBe('2026-11-09')
  })

  it('aynı gün = aynı görevler (belirlenimli); 3 farklı tür, kolay/orta/zor, hepsi katalogdan', () => {
    expect(dailyMissions('2026-11-08')).toEqual(dailyMissions('2026-11-08'))
    const seen = new Set<string>()
    let d = '2027-01-01'
    for (let i = 0; i < 365; i++) {
      const ms = dailyMissions(d)
      expect(ms.map((m) => m.tier)).toEqual(['kolay', 'orta', 'zor'])
      expect(new Set(ms.map((m) => m.kind)).size).toBe(3)
      ms.forEach((m, j) => {
        const tier = DAILY_TIERS[j]!
        expect(m.reward).toBe(DAILY_REWARDS[tier])
        expect(m.progress).toBe(0)
        expect(DAILY_POOLS[tier].some((t) => t.kind === m.kind && t.target === m.target)).toBe(true)
        seen.add(`${tier}:${m.kind}`)
      })
      seen.add(ms.map((m) => m.kind).join(','))
      d = previousDay(d)
    }
    // Bir yılda her havuzun her şablonu en az bir kez çıkar (ağırlıksız seçim, tek tür takılmaz).
    for (const tier of DAILY_TIERS) for (const t of DAILY_POOLS[tier]) expect(seen.has(`${tier}:${t.kind}`)).toBe(true)
  })

  it('görev üretimi oyunun rastgele akışından bağımsız (oyun aynı tohumla aynı kalır)', () => {
    const a = newGame(12345, DEFAULT_CONFIG, { mode: 'klasik' })
    dailyMissions('2026-11-08')
    const b = newGame(12345, DEFAULT_CONFIG, { mode: 'klasik' })
    expect(b).toEqual(a)
  })

  it('bütün görev türleri Klasik Mod\'da tamamlanabilir (botla gerçek motor oyunu)', () => {
    // Karar: Eğlence'ye özel tür yok. Her şablonun hedefine Klasik oyunlarda ulaşıldığı gösterilir.
    // 'points': Klasik puanı (yalnızca Klasik oynanır) Klasik hedefiyle karşılaştırılır.
    const best: Record<DailyKind, number> = { lines: 0, placed: 0, games: 0, score: 0, points: 0, combo: 0, multi: 0 }
    const playOut = (seed: number, bot: (s: GameState) => ReturnType<typeof greedyBot>) => {
      let s = newGame(seed, DEFAULT_CONFIG, { mode: 'klasik' })
      let lines = 0
      let pl = 0
      while (!s.gameOver && s.moveCount < 400) {
        const m = bot(s)
        if (!m) break
        const r = play(s, m)
        if (!r.ok) break
        const p = progressFromEvents(r.events)
        lines += p.lines
        pl += p.placed
        best.combo = Math.max(best.combo, p.combo)
        best.multi = Math.max(best.multi, p.multi)
        best.score = Math.max(best.score, p.score)
        best.points += p.scoreSum
        s = r.state
      }
      best.games += 1
      best.lines += lines // günlük toplam (bir günde oynanan bütün oyunlar)
      best.placed += pl
    }
    for (let seed = 1; seed <= 12; seed++) playOut(seed, greedyBot)
    playOut(1, plannerBot(3))
    for (const tier of DAILY_TIERS)
      for (const t of DAILY_POOLS[tier]) expect(best[t.kind]).toBeGreaterThanOrEqual(t.kind === 'points' ? t.klasik! : t.target)
  })
})

// ------------------------------------------------------------------ ilerleme

describe('Aşama 10.2: ilerleme motor olaylarından', () => {
  it('hat = satır + sütun; tek hamlede çoklu; bomba patlaması ve şanslı blok ayrı sayaç; tek temizleme kombo 1', () => {
    const p = progressFromEvents([
      placed(),
      cleared([1, 2], [3]),
      scored(250),
      { type: 'exploded', bombs: [5, 9], cells: [1, 2, 3, 4], points: 40, score: 290 },
      { type: 'luckyReward', cell: 3, reward: { type: 'stars', amount: 5 }, cause: 'line' },
    ])
    expect(p).toEqual({ lines: 3, placed: 1, games: 0, score: 290, scoreSum: 290, combo: 1, multi: 3, bombs: 2, lucky: 1 })
    expect(progressFromEvents([placed()]).combo).toBe(0)
    expect(progressFromEvents([cleared([0]), { type: 'combo', combo: 4 }]).combo).toBe(4)
  })

  it('Klasik ve Eğlence ikisi de sayılır; rekor sayaçları moda göre ayrı', () => {
    let g: GoalsState = { ...initialGoals(), day: '2026-11-08', daily: dailyMissions('2026-11-08') }
    g = applyProgress(g, { ...NO_PROGRESS, lines: 5, score: 1200 }, { mode: 'klasik', ozel: false })
    g = applyProgress(g, { ...NO_PROGRESS, lines: 7, score: 900 }, { mode: 'eglence', ozel: true })
    g = applyProgress(g, { ...NO_PROGRESS, score: 5000 }, { mode: 'eglence', ozel: false })
    expect(g.counters.lines).toBe(12)
    expect(g.counters.bestKlasik).toBe(1200)
    expect(g.counters.bestEglence).toBe(900) // özel bloksuz (Aşama 8 öncesi) Eğlence sayılmaz
  })

  it('gerçek bot oyunu: defterdeki sayaçlar hamle olaylarının toplamına eşit; aynı hamle ikinci kez sayılmaz', () => {
    const st = memoryStorage()
    const store = owned(st)
    expect(store.startGame('bot', 'klasik').ok).toBe(true)
    let s = newGame(7, DEFAULT_CONFIG, { mode: 'klasik' })
    let lines = 0
    let pl = 0
    while (!s.gameOver && s.moveCount < 60) {
      const r = play(s, greedyBot(s)!)
      if (!r.ok) break
      lines += progressFromEvents(r.events).lines
      pl += 1
      expect(store.recordMove('bot', r.state, r.events).ok).toBe(true)
      // Aynı hamle tekrar bildirilirse (yeniden çizim, çift olay) reddedilir; ilerleme değişmez.
      expect(store.recordMove('bot', r.state, r.events)).toMatchObject({ ok: false, reason: 'staleMove' })
      s = r.state
    }
    const g = saved(st).goals
    expect(g.counters.lines).toBe(lines)
    expect(g.counters.placed).toBe(pl)
    expect(g.counters.bestKlasik).toBe(s.score)
    expect(lines).toBeGreaterThan(0)
  })
})

// ------------------------------------------------------------------ ödül alma

describe('Aşama 10.2: "Al" — ödül tek kez', () => {
  it('tamamlanmadan alınamaz; tamamlanınca bir kez; ikinci dokunuş reddedilir; bonus üçü birden', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    expect(store.heartbeat().ok).toBe(true)
    const day = saved(st).goals.day!
    expect(day).toBe('2026-11-08')
    expect(store.claimReward(dailyRewardId(day, 0))).toMatchObject({ ok: false, reason: 'notClaimable' })
    expect(store.claimReward(bonusRewardId(day))).toMatchObject({ ok: false, reason: 'notClaimable' })
    completeToday(store)
    const before = saved(st).stars
    const r0 = store.claimReward(dailyRewardId(day, 0))
    expect(r0).toMatchObject({ ok: true, stars: 10, persisted: true })
    expect(store.claimReward(dailyRewardId(day, 0))).toMatchObject({ ok: false, reason: 'duplicateReward' })
    expect(store.claimReward(dailyRewardId(day, 1))).toMatchObject({ ok: true, stars: 20 })
    expect(store.claimReward(dailyRewardId(day, 2))).toMatchObject({ ok: true, stars: 30 })
    expect(store.claimReward(bonusRewardId(day))).toMatchObject({ ok: true, stars: 20 })
    expect(store.claimReward(bonusRewardId(day))).toMatchObject({ ok: false, reason: 'duplicateReward' })
    const after = saved(st)
    expect(after.stars - before).toBe(80)
    expect(after.totals.rewardEarned).toBe(80)
    expect(dailyRewardStatus(after).every((r) => r.done && r.claimed)).toBe(true)
  })

  it('geçersiz, geçmiş ya da gelecek günün kimliği reddedilir', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    completeToday(store)
    for (const bad of ['', 'daily:2026-11-08:3', 'daily:2026-02-30:0', 'ach:yok-1', 'ach:hat-1:x', 'x'.repeat(65)])
      expect(store.claimReward(bad)).toMatchObject({ ok: false, reason: 'invalidInput' })
    expect(store.claimReward(dailyRewardId('2026-11-07', 0))).toMatchObject({ ok: false, reason: 'notClaimable' })
    expect(store.claimReward(dailyRewardId('2026-11-09', 0))).toMatchObject({ ok: false, reason: 'notClaimable' })
  })

  it('görev ödülü Eğlence\'nin 300 ★ oyun tavanından bağımsız', () => {
    let s = startGame({ ...initialEconomy(), goals: { ...initialGoals(), day: '2026-11-08', daily: dailyMissions('2026-11-08') } }, 'f', 'eglence', undefined, undefined, 1)
    expect(s.ok).toBe(true)
    // Tavanı doldur: 30 hamle × 3 hat.
    let e = s.state
    for (let m = 1; m <= 40; m++) {
      const r = awardMove(e, 'f', m, [cleared([0, 1, 2]), placed()])
      expect(r.ok).toBe(true)
      e = r.state
    }
    expect(e.active!.lineStars).toBe(300)
    const done = dailyRewardStatus(e).find((r) => r.done && !r.claimed)
    expect(done !== undefined).toBe(true)
    const c = claimReward(e, done!.id)
    expect(c.ok && c.stars).toBe(done!.stars)
    // Oyun tavanı değişmedi (görev ödülü oyunun hat yıldızına yazılmaz).
    expect(c.state.active!.lineStars).toBe(300)
    s = c
  })

  it('kayıt yazılamıyorsa ödül verilmez (storageError); bakiye ve kimlikler aynen', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    completeToday(store)
    const raw = st.data.get(ECONOMY_KEY)
    st.failWrites = true
    expect(store.claimReward(dailyRewardId('2026-11-08', 0))).toMatchObject({ ok: false, reason: 'storageError' })
    expect(st.data.get(ECONOMY_KEY)).toBe(raw)
    // Bu oturum artık bellekte: yazma geri gelse de bu oturumda ödül verilmez (kalıcılık kayboldu).
    st.failWrites = false
    expect(store.claimReward(dailyRewardId('2026-11-08', 0))).toMatchObject({ ok: false, reason: 'storageError' })
    expect(st.data.get(ECONOMY_KEY)).toBe(raw)
  })

  it('depolama hiç yoksa (gizli pencere) ödül alınamaz', () => {
    const store = createEconomyStore(null, { tabId: 'yok', now: () => clock.t, day: utcDay })
    expect(store.claimReward(dailyRewardId(utcDay(clock.t), 0))).toMatchObject({ ok: false, reason: 'storageError' })
  })
})

// ------------------------------------------------------------------ gün sonu ve saat

describe('Aşama 10.2: gün değişimi ve saat', () => {
  it('gün sonunda tamamlanmış ama alınmamış ödüller bir kez otomatik eklenir; yeni görevler üretilir', () => {
    clock.t = Date.UTC(2026, 10, 8, 22)
    const st = memoryStorage()
    const store = owned(st)
    completeToday(store)
    expect(store.claimReward(dailyRewardId('2026-11-08', 1)).ok).toBe(true) // 20 elle alındı
    const before = saved(st).stars
    clock.t = Date.UTC(2026, 10, 9, 0, 5) // gece yarısı geçti
    expect(store.heartbeat().ok).toBe(true)
    const s1 = saved(st)
    expect(s1.stars - before).toBe(10 + 30 + 20) // kolay + zor + bonus (orta zaten alınmıştı)
    expect(s1.goals.day).toBe('2026-11-09')
    expect(s1.goals.daily).toEqual(dailyMissions('2026-11-09'))
    for (const id of [dailyRewardId('2026-11-08', 0), dailyRewardId('2026-11-08', 2), bonusRewardId('2026-11-08')]) expect(s1.rewardIds).toContain(id)
    // Aynı gün tekrar: hiçbir şey eklenmez.
    expect(store.heartbeat().ok).toBe(true)
    expect(saved(st).stars).toBe(s1.stars)
    // Dünün ödülü artık elle de alınamaz.
    expect(store.claimReward(dailyRewardId('2026-11-08', 0))).toMatchObject({ ok: false, reason: 'duplicateReward' })
  })

  it('tamamlanmamış görevin ödülü gün sonunda verilmez', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    expect(store.heartbeat().ok).toBe(true)
    const before = saved(st).stars
    clock.t += DAY
    expect(store.heartbeat().ok).toBe(true)
    expect(saved(st).stars).toBe(before)
    expect(saved(st).rewardIds).toEqual([])
  })

  it('saat geri alınırsa görevler yeniden üretilmez ve ödül ikinci kez verilmez; ileri gelince yine bir kez', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    completeToday(store)
    clock.t = Date.UTC(2026, 10, 9, 10)
    expect(store.heartbeat().ok).toBe(true) // 8 Kasım otomatik eklendi
    const s9 = saved(st)
    // Saat 2 gün geri: gün 9 Kasım'da kalır.
    clock.t = Date.UTC(2026, 10, 7, 10)
    expect(store.heartbeat().ok).toBe(true)
    const back = saved(st)
    expect(back.goals.day).toBe('2026-11-09')
    expect(back.goals.daily).toEqual(s9.goals.daily)
    expect(back.stars).toBe(s9.stars)
    expect(store.claimReward(dailyRewardId('2026-11-08', 0))).toMatchObject({ ok: false, reason: 'duplicateReward' })
    expect(store.claimReward(dailyRewardId('2026-11-07', 0))).toMatchObject({ ok: false, reason: 'notClaimable' })
    // Geri alınmış saatte oynanan ilerleme mevcut (9 Kasım) görevlerine sayılır.
    completeToday(store)
    expect(store.claimReward(dailyRewardId('2026-11-09', 0))).toMatchObject({ ok: true, stars: 10 })
    expect(store.claimReward(dailyRewardId('2026-11-09', 0))).toMatchObject({ ok: false, reason: 'duplicateReward' })
    // Saat yeniden ileri (9 Kasım): değişiklik yok.
    clock.t = Date.UTC(2026, 10, 9, 12)
    const s = saved(st).stars
    expect(store.heartbeat().ok).toBe(true)
    expect(saved(st).stars).toBe(s)
  })

  it('saat ileri alınırsa yeni gün erken başlar; her gün yalnızca bir kez öder (en çok 80 ★/gün)', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    let total = 0
    for (let d = 0; d < 5; d++) {
      clock.t = Date.UTC(2026, 10, 8 + d, 10)
      completeToday(store)
      const before = saved(st).totals.rewardEarned
      for (const r of dailyRewardStatus(saved(st))) store.claimReward(r.id)
      for (const r of dailyRewardStatus(saved(st))) expect(store.claimReward(r.id)).toMatchObject({ ok: false, reason: 'duplicateReward' })
      const got = saved(st).totals.rewardEarned - before
      expect(got).toBeLessThanOrEqual(MAX_DAILY_STARS + ACHIEVEMENTS.reduce((n, a) => n + a.reward, 0))
      total += got
    }
    const s = saved(st)
    const dailyIds = s.rewardIds.filter((id) => id.startsWith('daily:'))
    expect(dailyIds.length).toBe(5 * 4)
    expect(new Set(dailyIds).size).toBe(dailyIds.length)
    expect(total).toBe(5 * 80)
  })

  it('rollover saf: aynı gün iki kez uygulanınca aynı sonuç (idempotent)', () => {
    let e: EconomyState = { ...initialEconomy(), goals: { ...initialGoals(), day: '2026-11-08', daily: dailyMissions('2026-11-08').map((m) => ({ ...m, progress: m.target })) } }
    const a = rollover(e, '2026-11-09')
    expect(a.autoStars).toBe(80)
    expect(a.autoCredited.length).toBe(4)
    const b = rollover(a.state, '2026-11-09')
    expect(b.state).toBe(a.state)
    expect(b.autoStars).toBe(0)
    e = a.state
    expect(rollover(e, 'bozuk').state).toBe(e)
  })

  it('seri: ardışık "üçü tamam" günleri; boşluk seriyi sıfırlar, en iyi seri kalır; Düzenli başarımı açılır', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    for (let d = 0; d < 3; d++) {
      clock.t = Date.UTC(2026, 10, 8 + d, 10)
      completeToday(store)
    }
    let g = saved(st).goals
    expect(g.streak).toEqual({ count: 3, lastDay: '2026-11-10', best: 3 })
    expect(currentStreak(g, '2026-11-11')).toBe(3)
    expect(currentStreak(g, '2026-11-12')).toBe(0)
    expect(unlockedAchievements(g).map((a) => a.id)).toContain('duzenli-1')
    expect(store.claimReward(achievementRewardId('duzenli-1'))).toMatchObject({ ok: true, stars: 25 })
    clock.t = Date.UTC(2026, 10, 12, 10) // 11 Kasım atlandı
    completeToday(store)
    g = saved(st).goals
    expect(g.streak).toEqual({ count: 1, lastDay: '2026-11-12', best: 3 })
  })

  it('eski günlük kimlikler budanır (son 7 gün), başarım kimlikleri kalır', () => {
    const ids = ['ach:hat-1', dailyRewardId('2026-11-01', 0), dailyRewardId('2026-11-02', 0), bonusRewardId('2026-11-08'), 'bozuk']
    expect(pruneRewardIds(ids, '2026-11-08')).toEqual(['ach:hat-1', dailyRewardId('2026-11-02', 0), bonusRewardId('2026-11-08')])
    expect(DAILY_ID_DAYS).toBe(7)
    expect(parseRewardId('ach:hat-1')).toEqual({ kind: 'ach', id: 'hat-1' })
  })
})

// ------------------------------------------------------------------ başarımlar

describe('Aşama 10.2: başarımlar', () => {
  it('eşik aşılınca açılır, "Al" ile bir kez; birden çok basamak aynı anda açılabilir', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    completeToday(store) // 64 hat, kombo 6, Klasik 3000
    const status = achievementRewardStatus(saved(st))
    const open = status.filter((a) => a.done).map((a) => a.id)
    expect(open).toEqual(['ach:klasik-1', 'ach:klasik-2', 'ach:kombo-1', 'ach:kombo-2'])
    expect(store.claimReward('ach:hat-1')).toMatchObject({ ok: false, reason: 'notClaimable' })
    for (const id of open) expect(store.claimReward(id).ok).toBe(true)
    for (const id of open) expect(store.claimReward(id)).toMatchObject({ ok: false, reason: 'duplicateReward' })
    expect(saved(st).totals.rewardEarned).toBe(25 + 75 + 25 + 50)
    // İkinci gün de tamamlanınca toplam hat 100'ü geçer: Hat-1 açılır.
    clock.t += DAY
    completeToday(store)
    expect(store.claimReward('ach:hat-1')).toMatchObject({ ok: true, stars: 25 })
  })

  it('geriye dönük: mevcut rekor anahtarları ve özel Eğlence rekoru açar (yalnızca açar, ödül "Al" ile); rekor anahtarları değişmez', () => {
    const records = { 'popgrid:v1:best': '3500', 'popgrid:v1:best:eglence-ozel': '1200', 'popgrid:v1:best:eglence': '9000' }
    const st = memoryStorage(records)
    const store = owned(st)
    expect(store.heartbeat().ok).toBe(true)
    const s = saved(st)
    expect(s.goals.retroDone).toBe(true)
    expect(s.goals.counters.bestKlasik).toBe(3500)
    expect(s.goals.counters.bestEglence).toBe(1200) // özel bloksuz eski Eğlence rekoru (9000) sayılmaz
    expect(s.rewardIds).toEqual([])
    expect(s.stars).toBe(0)
    expect(achievementRewardStatus(s).filter((a) => a.done).map((a) => a.id)).toEqual(['ach:klasik-1', 'ach:klasik-2', 'ach:eglence-1'])
    for (const [k, v] of Object.entries(records)) expect(st.data.get(k)).toBe(v)
    // Tarama bir kez: sonra rekor anahtarı değişse de sayaç oradan okunmaz (oyun içinden ilerler).
    st.data.set('popgrid:v1:best', '99999')
    expect(store.heartbeat().ok).toBe(true)
    expect(saved(st).goals.counters.bestKlasik).toBe(3500)
  })

  it('geriye dönük: ekonomi kaydındaki funBestsOzel de sayılır; bozuk rekor anahtarı 0', () => {
    const v3 = { ...JSON.parse(serializeEconomy(initialEconomy())), schemaVersion: 3, funBestsOzel: { withoutPurchased: 500, withPurchased: 3100 } }
    delete v3.goals
    delete v3.rewardIds
    delete v3.totals.rewardEarned
    const st = memoryStorage({ [ECONOMY_KEY]: JSON.stringify(v3), 'popgrid:v1:best': 'abc' })
    const store = owned(st)
    expect(store.heartbeat().ok).toBe(true)
    expect(saved(st).goals.counters).toMatchObject({ bestKlasik: 0, bestEglence: 3100 })
  })
})

// ------------------------------------------------------------------ iki sekme

describe('Aşama 10.2: iki sekme', () => {
  it('sahip olmayan sekme ödül alamaz ve ilerletemez; zorla devralmadan sonra eski sekme reddedilir; ödül yine bir kez', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const a = owned(st)
    completeToday(a)
    const b = tab(st)
    expect(b.claimReward(dailyRewardId('2026-11-08', 0))).toMatchObject({ ok: false, reason: 'otherTab' })
    expect(b.heartbeat()).toMatchObject({ ok: false, reason: 'otherTab' })
    expect(a.claimReward(dailyRewardId('2026-11-08', 0))).toMatchObject({ ok: true, stars: 10 })
    // B zorla devralır (kullanıcı "bu sekmede devam et" dedi).
    expect(b.claim(true).ok).toBe(true)
    expect(a.claimReward(dailyRewardId('2026-11-08', 1))).toMatchObject({ ok: false, reason: 'otherTab' })
    // B, A'nın aldığı ödülü göremez gibi davranamaz: kimlik kayıtta.
    expect(b.claimReward(dailyRewardId('2026-11-08', 0))).toMatchObject({ ok: false, reason: 'duplicateReward' })
    expect(b.claimReward(dailyRewardId('2026-11-08', 1))).toMatchObject({ ok: true, stars: 20 })
    // Kira bitince A geri alabilir; ödüller yine tek.
    clock.t += LEASE_MS + 1
    expect(a.claim().ok).toBe(true)
    expect(a.claimReward(dailyRewardId('2026-11-08', 1))).toMatchObject({ ok: false, reason: 'duplicateReward' })
    expect(saved(st).totals.rewardEarned).toBe(30)
  })

  it('iki sekme aynı bayat durumdan yazsa bile (yarış) aynı ödül iki kez görünmez: her yazma kimliği ve yıldızı birlikte taşır', () => {
    // En kötü durum benzetimi: A'nın okuduğu eski kayıt üzerine B'nin sonucu yazılır → B'nin yazması kaybolur
    // ("lost update"), ama hiçbir kayıtta yıldız kimliksiz ya da kimlik yıldızsız değildir.
    const base: EconomyState = { ...initialEconomy(), goals: { ...initialGoals(), day: '2026-11-08', daily: dailyMissions('2026-11-08').map((m) => ({ ...m, progress: m.target })) } }
    const fromA = claimReward(base, dailyRewardId('2026-11-08', 0))
    const fromB = claimReward(base, dailyRewardId('2026-11-08', 0))
    expect(fromA.ok && fromB.ok).toBe(true)
    // Son yazan kazanır: kayıtta tek bir sürüm vardır.
    const final = fromB.state
    expect(final.stars).toBe(10)
    expect(final.rewardIds.filter((x) => x === dailyRewardId('2026-11-08', 0)).length).toBe(1)
    expect(claimReward(final, dailyRewardId('2026-11-08', 0))).toMatchObject({ ok: false, reason: 'duplicateReward' })
  })
})

// ------------------------------------------------------------------ kayıt şeması 4

describe('Aşama 10.2: kayıt şeması 4', () => {
  it('güncel şema 4; yeni kayıt birebir geri okunur', () => {
    expect(ECONOMY_SCHEMA_VERSION).toBe(4)
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    completeToday(store)
    store.claimReward(dailyRewardId('2026-11-08', 0))
    const raw = st.data.get(ECONOMY_KEY)!
    const back = parseEconomy(raw)
    expect(back.status).toBe('ok')
    expect(serializeEconomy(back.state)).toBe(raw)
  })

  it('şema 3 → 4: bakiye, envanter, oyun, geçmiş, rekorlar aynen; görevler boş; ilk işlemde 4 olarak yazılır', () => {
    const e3 = { ...JSON.parse(serializeEconomy({ ...initialEconomy({ cekic: 2, yenile: 0, dondur: 1 }), stars: 777 })), schemaVersion: 3 }
    delete e3.goals
    delete e3.rewardIds
    delete e3.totals.rewardEarned
    const raw3 = JSON.stringify(e3)
    const r = parseEconomy(raw3)
    expect(r.status).toBe('migrated')
    expect(r.state.stars).toBe(777)
    expect(r.state.inventory).toEqual({ cekic: 2, yenile: 0, dondur: 1 })
    expect(r.state.goals).toEqual(initialGoals())
    expect(r.state.rewardIds).toEqual([])
    expect(r.state.totals.rewardEarned).toBe(0)
    const st = memoryStorage({ [ECONOMY_KEY]: raw3 })
    const store = owned(st)
    expect(store.heartbeat().ok).toBe(true)
    const w = JSON.parse(st.data.get(ECONOMY_KEY)!)
    expect(w.schemaVersion).toBe(4)
    expect(w.stars).toBe(777)
    expect(w.goals.day).toBe(utcDay(clock.t))
  })

  it('bozuk görev alanı: yalnızca görevler sıfırlanır; bakiye ve ödül kimlikleri korunur, alınmış ödül tekrar alınamaz', () => {
    clock.t = Date.UTC(2026, 10, 8, 10)
    const st = memoryStorage()
    const store = owned(st)
    completeToday(store)
    expect(store.claimReward('ach:klasik-1').ok).toBe(true)
    expect(store.claimReward(dailyRewardId('2026-11-08', 0)).ok).toBe(true)
    const good = JSON.parse(st.data.get(ECONOMY_KEY)!)
    const stars = good.stars
    const variants: unknown[] = [
      undefined,
      'x',
      { ...good.goals, catalog: 0 },
      { ...good.goals, catalog: '2' },
      { ...good.goals, day: '2026-02-30' },
      { ...good.goals, daily: good.goals.daily.slice(1) },
      { ...good.goals, daily: [{ ...good.goals.daily[0], reward: 999 }, ...good.goals.daily.slice(1)] }, // ödül şişirme
      { ...good.goals, daily: [{ ...good.goals.daily[0], target: 7 }, ...good.goals.daily.slice(1)] }, // hedef küçültme
      { ...good.goals, daily: [{ ...good.goals.daily[0], progress: -1 }, ...good.goals.daily.slice(1)] },
      { ...good.goals, counters: { ...good.goals.counters, lines: 1.5 } },
      { ...good.goals, streak: { count: 5, lastDay: null, best: 2 } },
      { ...good.goals, retroDone: 'evet' },
    ]
    for (const goals of variants) {
      const r = parseEconomy(JSON.stringify({ ...good, goals }))
      expect(r.status).toBe('ok')
      expect(r.goalsReset).toBe(true)
      expect(r.state.stars).toBe(stars)
      expect(r.state.rewardIds).toEqual(good.rewardIds)
      expect(r.state.goals).toEqual(initialGoals())
    }
    // Depoda: bozuk görevli kayıtla devam; alınmış ödüller tekrar verilmez.
    st.data.set(ECONOMY_KEY, JSON.stringify({ ...good, goals: 'x' }))
    expect(store.heartbeat().ok).toBe(true)
    completeToday(store)
    expect(store.claimReward('ach:klasik-1')).toMatchObject({ ok: false, reason: 'duplicateReward' })
    expect(store.claimReward(dailyRewardId('2026-11-08', 0))).toMatchObject({ ok: false, reason: 'duplicateReward' })
  })

  it('bozuk ödül kimlikleri ya da rewardEarned: bütün kayıt bozuk (tahminle onarılmaz)', () => {
    const good = JSON.parse(serializeEconomy(initialEconomy()))
    expect(parseEconomy(JSON.stringify(good)).status).toBe('ok')
    for (const rewardIds of [undefined, 'x', ['ach:yok'], ['daily:2026-11-08:9'], [5], ['ach:hat-1', 'ach:hat-1']])
      expect(parseEconomy(JSON.stringify({ ...good, rewardIds })).status).toBe('corrupt')
    for (const rewardEarned of [undefined, -1, 'x']) expect(parseEconomy(JSON.stringify({ ...good, totals: { ...good.totals, rewardEarned } })).status).toBe('corrupt')
  })

  it('daha yeni şema (5): salt okunur; ödül alınmaz, kayıt değişmez', () => {
    const raw = JSON.stringify({ ...JSON.parse(serializeEconomy(initialEconomy())), schemaVersion: 5 })
    const st = memoryStorage({ [ECONOMY_KEY]: raw })
    const store = tab(st)
    expect(store.load().status).toBe('future')
    expect(store.claim()).toMatchObject({ ok: false, reason: 'readOnly' })
    expect(store.claimReward(dailyRewardId(utcDay(clock.t), 0))).toMatchObject({ ok: false, reason: 'readOnly' })
    expect(store.heartbeat()).toMatchObject({ ok: false, reason: 'readOnly' })
    expect(st.data.get(ECONOMY_KEY)).toBe(raw)
  })
})

describe('Aşama 10.2: saf durum yardımcıları', () => {
  it('allDailyDone yalnızca üç görev de bitince', () => {
    const daily = dailyMissions('2026-11-08')
    const g: GoalsState = { ...initialGoals(), day: '2026-11-08', daily }
    expect(allDailyDone(g)).toBe(false)
    expect(allDailyDone({ ...g, daily: daily.map((m) => ({ ...m, progress: m.target })) })).toBe(true)
    expect(allDailyDone(initialGoals())).toBe(false)
  })
})

// ------------------------------------------------------------------ katalog sürüm 2 (Aşama 10.3 kararları)

const hasTemplate = (pool: readonly { kind: string; target: number }[], t: { kind: string; target: number }) =>
  pool.some((x) => x.kind === t.kind && x.target === t.target)

describe('Aşama 10.3: görev kataloğu sürüm 2', () => {
  it('yeni hedefler: orta Klasik 750 / Eğlence 2.000, zor Klasik 1.500 / Eğlence 4.000 (oranlı), zor kombo 4; ödüller aynı', () => {
    expect(GOALS_CATALOG_VERSION).toBe(2)
    const orta = DAILY_POOLS.orta.find((t) => t.kind === 'points')!
    const zor = DAILY_POOLS.zor.find((t) => t.kind === 'points')!
    expect(orta).toEqual({ kind: 'points', target: 6000, klasik: 750, eglence: 2000 })
    expect(zor).toEqual({ kind: 'points', target: 12000, klasik: 1500, eglence: 4000 })
    // Tam sayı ağırlıklar: 1 Klasik puanı = 8 birim, 1 Eğlence puanı = 3 birim (iki görevde de).
    for (const t of [orta, zor]) {
      expect([pointWeight(t, 'klasik'), pointWeight(t, 'eglence')]).toEqual([8, 3])
      expect(t.klasik! * pointWeight(t, 'klasik')).toBe(t.target)
      expect(t.eglence! * pointWeight(t, 'eglence')).toBe(t.target)
    }
    expect(pointsTemplate(1000, 2500)).toEqual({ kind: 'points', target: 5000, klasik: 1000, eglence: 2500 })
    expect(hasTemplate(DAILY_POOLS.zor, { kind: 'combo', target: 4 })).toBe(true)
    // Tek oyun puanı ve kombo 5 artık üretilmez.
    for (const tier of DAILY_TIERS) for (const t of DAILY_POOLS[tier]) expect(t.kind === 'score' || (t.kind === 'combo' && t.target === 5)).toBe(false)
    // Diğer şablonlar sürüm 1 ile aynı.
    const same = (tier: (typeof DAILY_TIERS)[number]) => DAILY_POOLS[tier].filter((t) => t.kind !== 'points' && !(tier === 'zor' && t.kind === 'combo'))
    for (const tier of DAILY_TIERS) for (const t of same(tier)) expect(hasTemplate(DAILY_POOLS_V1[tier], t)).toBe(true)
    expect(DAILY_TIERS.map((t) => DAILY_REWARDS[t])).toEqual([10, 20, 30])
    expect(MAX_DAILY_STARS).toBe(80)
  })

  it('başarımlar: Kombo 3/5/7, Klasik 1.000/2.500/5.000; toplam yine 1.775 ★', () => {
    const t = (p: string) => ACHIEVEMENTS.filter((a) => a.id.startsWith(`${p}-`)).map((a) => a.target)
    expect(t('kombo')).toEqual([3, 5, 7])
    expect(t('klasik')).toEqual([1000, 2500, 5000])
    expect(t('eglence')).toEqual([1000, 3000, 6000])
    expect(ACHIEVEMENTS.reduce((n, a) => n + a.reward, 0)).toBe(1775)
  })

  it('görev üretimi sürüme bağlı ve sabit (aynı gün, aynı sürüm = aynı görevler)', () => {
    const kinds = (d: string, c?: number) => dailyMissions(d, c).map((m) => `${m.kind}:${m.target}`)
    expect(kinds('2026-11-08')).toEqual(['placed:25', 'games:2', 'combo:4'])
    expect(kinds('2026-11-09')).toEqual(['lines:10', 'games:2', 'points:12000'])
    expect(kinds('2026-11-08', 1)).toEqual(['placed:25', 'games:2', 'score:2500'])
  })

  it('gün içinde puan: hamle puanı + bomba patlaması tam bir kez (gerçek motor: toplam = oyun puanı)', () => {
    let bombs = 0
    for (const mode of ['klasik', 'eglence'] as const) {
      for (const seed of [279, 300, 7]) {
        let s = newGame(seed, DEFAULT_CONFIG, { mode })
        let sum = 0
        while (!s.gameOver && s.moveCount < 250 && !s.stuck) {
          const r = play(s, greedyBot(s)!)
          if (!r.ok) break
          const p = progressFromEvents(r.events)
          sum += p.scoreSum
          bombs += p.bombs
          s = r.state
        }
        expect(sum).toBe(s.score)
        expect(sum).toBeGreaterThan(0)
      }
    }
    // Bomba patlaması gerçekten denendi (patlama puanı hamle puanına ikinci kez eklenmedi).
    expect(bombs).toBeGreaterThan(0)
  })

  it('oranlı puan: Klasik ve Eğlence aynı göreve katkı sağlar; yarıda kalan oyun sayılır; aynı hamle iki kez sayılmaz', () => {
    clock.t = Date.UTC(2026, 10, 9, 10) // 9 Kasım: zor görev "Klasik 1.500 ya da Eğlence 4.000"
    const st = memoryStorage()
    const store = owned(st)
    const zor = () => saved(st).goals.daily[2]!
    expect(store.heartbeat().ok).toBe(true)
    expect(zor()).toMatchObject({ kind: 'points', target: 12000, klasik: 1500, eglence: 4000, progress: 0 })
    expect(missionView(zor())).toEqual({ done: false, percent: 0, remaining: 12000, remainingPoints: { klasik: 1500, eglence: 4000 } })
    // Klasik 600 puan = %40.
    expect(store.startGame('k1', 'klasik').ok).toBe(true)
    expect(store.awardMove('k1', 1, [placed(), scored(600)]).ok).toBe(true)
    expect(store.finishGame('k1', 600, null).ok).toBe(true)
    expect(missionView(zor())).toMatchObject({ percent: 40, remainingPoints: { klasik: 900, eglence: 2400 } })
    // Eğlence 2.000 hamle puanı + 300 bomba puanı = 2.300 → %57,5; oyun bitirilmeden bırakılır.
    expect(store.startGame('e1', 'eglence', undefined, undefined, 1).ok).toBe(true)
    expect(store.awardMove('e1', 1, [placed(), scored(2000), { type: 'exploded', bombs: [3], cells: [], points: 300, score: 2300 }]).ok).toBe(true)
    expect(store.startGame('k2', 'klasik').ok).toBe(true) // e1 yarıda bırakıldı: puanı sayılmış olarak kalır
    expect(zor().progress).toBe(600 * 8 + 2300 * 3)
    expect(missionView(zor())).toMatchObject({ done: false, percent: 97, remainingPoints: { klasik: 38, eglence: 100 } })
    expect(store.claimReward(dailyRewardId('2026-11-09', 2))).toMatchObject({ ok: false, reason: 'notClaimable' })
    // Kalan Klasik puanı: 37 yetmez, 38 yeter (gösterilen "kalan" yukarı yuvarlanır).
    expect(store.awardMove('k2', 1, [placed(), scored(37)]).ok).toBe(true)
    expect(missionView(zor())).toMatchObject({ done: false, percent: 99, remainingPoints: { klasik: 1, eglence: 2 } })
    // Aynı hamle ikinci kez bildirilirse puan iki kez sayılmaz.
    expect(store.awardMove('k2', 1, [placed(), scored(37)])).toMatchObject({ ok: false, reason: 'staleMove' })
    expect(zor().progress).toBe(11996)
    expect(store.awardMove('k2', 2, [placed(), scored(137, 100)]).ok).toBe(true)
    expect(zor().progress).toBe(12000) // hedefte kırpılır
    expect(missionView(zor())).toEqual({ done: true, percent: 100, remaining: 0, remainingPoints: { klasik: 0, eglence: 0 } })
    expect(store.claimReward(dailyRewardId('2026-11-09', 2))).toMatchObject({ ok: true, stars: 30 })
    expect(store.claimReward(dailyRewardId('2026-11-09', 2))).toMatchObject({ ok: false, reason: 'duplicateReward' })
  })

  it('oranlı puan saf hesap: yalnızca Klasik, yalnızca Eğlence ya da karışık — hepsi aynı hedefe tam sayıyla ulaşır', () => {
    const day = '2026-11-09'
    const base: GoalsState = { ...initialGoals(), day, daily: dailyMissions(day) }
    const run = (parts: Array<['klasik' | 'eglence', number]>) =>
      parts.reduce((g, [mode, pts]) => applyProgress(g, { ...NO_PROGRESS, scoreSum: pts }, { mode, ozel: mode === 'eglence' }), base).daily[2]!
    expect(missionView(run([['klasik', 1500]])).done).toBe(true)
    expect(missionView(run([['klasik', 1499]])).done).toBe(false)
    expect(missionView(run([['eglence', 4000]])).done).toBe(true)
    expect(missionView(run([['eglence', 3999]])).done).toBe(false)
    expect(missionView(run([['klasik', 750], ['eglence', 2000]])).done).toBe(true) // %50 + %50
    expect(missionView(run([['klasik', 750], ['eglence', 1999]])).done).toBe(false)
    expect(run([['klasik', 1], ['eglence', 1]]).progress).toBe(11)
    // Her yerleştirme parça parça gelse de toplam aynı (yuvarlama birikmez).
    const many = run(Array.from({ length: 1500 }, () => ['klasik', 1] as ['klasik', number]))
    expect(many.progress).toBe(12000)
  })

  it('kayıtta oranlı görevin hedefi ya da ağırlığı değiştirilemez (görevler sıfırlanır)', () => {
    const day = '2026-11-09'
    const good = JSON.parse(serializeEconomy({ ...initialEconomy(), goals: { ...initialGoals(), day, daily: dailyMissions(day) } }))
    expect(parseEconomy(JSON.stringify(good)).goalsReset === true).toBe(false)
    const z = good.goals.daily[2]
    for (const bad of [{ ...z, klasik: 10 }, { ...z, eglence: 100000 }, { ...z, target: 120 }, { ...z, klasik: undefined }, { ...z, progress: 12001 }]) {
      const r = parseEconomy(JSON.stringify({ ...good, goals: { ...good.goals, daily: [good.goals.daily[0], good.goals.daily[1], bad] } }))
      expect(r.goalsReset).toBe(true)
    }
    const k = good.goals.daily[0]
    expect(parseEconomy(JSON.stringify({ ...good, goals: { ...good.goals, daily: [{ ...k, klasik: 5 }, good.goals.daily[1], z] } })).goalsReset).toBe(true)
  })

  it('sürüm 1 → 2 geçişi: o günün sürüm 1 görevleri ilerlemesiyle kalır, alınmış ödüller tekrar verilmez; ertesi gün sürüm 2', () => {
    const day = '2026-11-08'
    const v1Daily = dailyMissions(day, 1).map((m, i) => ({ ...m, progress: i === 0 ? m.target : Math.min(m.target, 1) }))
    const base = JSON.parse(serializeEconomy(initialEconomy()))
    const rec = {
      ...base,
      stars: 500,
      rewardIds: [dailyRewardId(day, 0), 'ach:kombo-3'],
      goals: {
        catalog: 1,
        day,
        daily: v1Daily,
        streak: { count: 2, lastDay: '2026-11-07', best: 4 },
        counters: { lines: 900, placed: 2000, games: 40, bombs: 12, lucky: 9, maxCombo: 8, bestKlasik: 2600, bestEglence: 1500 },
        retroDone: true,
      },
    }
    const raw = JSON.stringify(rec)
    const r = parseEconomy(raw)
    expect(r.status).toBe('ok')
    expect(r.goalsReset === true).toBe(false)
    expect(r.state.goals.catalog).toBe(1)
    expect(r.state.goals.daily).toEqual(v1Daily)
    expect(r.state.goals.counters.maxCombo).toBe(8)
    // Aynı gün: sürüm 1 görevleri sürer; alınmış ödül tekrar verilmez; sayaçlar ve seri korunur.
    clock.t = Date.UTC(2026, 10, 8, 20)
    const st = memoryStorage({ [ECONOMY_KEY]: raw })
    const store = owned(st)
    expect(store.heartbeat().ok).toBe(true)
    let s = saved(st)
    expect(s.goals.catalog).toBe(1)
    expect(s.goals.daily).toEqual(v1Daily)
    expect(s.stars).toBe(500)
    expect(store.claimReward(dailyRewardId(day, 0))).toMatchObject({ ok: false, reason: 'duplicateReward' })
    // Kombo-3 (artık 7) zaten alınmış: yeniden verilmez. Klasik-2 (artık 2.500) eski rekorla açılır.
    expect(store.claimReward('ach:kombo-3')).toMatchObject({ ok: false, reason: 'duplicateReward' })
    expect(store.claimReward('ach:klasik-2')).toMatchObject({ ok: true, stars: 75 })
    // Ertesi gün: sürüm 2 görevleri; sürüm 1 günü tamamlanmadığı için otomatik ödül yok (yalnızca alınmış 0. görev vardı).
    clock.t = Date.UTC(2026, 10, 9, 10)
    const before = saved(st).stars
    expect(store.heartbeat().ok).toBe(true)
    s = saved(st)
    expect(s.goals.catalog).toBe(2)
    expect(s.goals.day).toBe('2026-11-09')
    expect(s.goals.daily).toEqual(dailyMissions('2026-11-09'))
    expect(s.stars).toBe(before)
    expect(s.goals.streak).toEqual({ count: 2, lastDay: '2026-11-07', best: 4 })
    expect(s.goals.counters.lines).toBe(900)
  })

  it('sürüm 1 günü gün sonunda tamamlanmışsa ödülleri (bonus dahil) bir kez otomatik eklenir', () => {
    const day = '2026-11-08'
    const e: EconomyState = { ...initialEconomy(), goals: { ...initialGoals(), catalog: 1, day, daily: dailyMissions(day, 1).map((m) => ({ ...m, progress: m.target })) } }
    const back = parseEconomy(serializeEconomy(e))
    expect(back.status).toBe('ok')
    const r = rollover(back.state, '2026-11-09')
    expect(r.autoStars).toBe(80)
    expect(r.state.goals.catalog).toBe(2)
    expect(rollover(r.state, '2026-11-09').autoStars).toBe(0)
  })

  it('sürüm 1 görevi sürüm 2 havuzuyla ya da sürüm 2 görevi sürüm 1 havuzuyla doğrulanmaz (karıştırma = görevler sıfırlanır)', () => {
    const day = '2026-11-08'
    const good = JSON.parse(serializeEconomy({ ...initialEconomy(), goals: { ...initialGoals(), day, daily: dailyMissions(day) } }))
    expect(parseEconomy(JSON.stringify(good)).status).toBe('ok')
    // combo 4 sürüm 1'de yok
    expect(parseEconomy(JSON.stringify({ ...good, goals: { ...good.goals, catalog: 1 } })).goalsReset).toBe(true)
    const v1 = { ...good.goals, catalog: 2, daily: dailyMissions(day, 1) } // score 2500 sürüm 2'de yok
    expect(parseEconomy(JSON.stringify({ ...good, goals: v1 })).goalsReset).toBe(true)
  })

  it('daha yeni katalog sürümü (3) yazılmış kayıt: salt okunur, görevler sıfırlanmaz, kayıt değişmez', () => {
    const rec = JSON.parse(serializeEconomy(initialEconomy()))
    const raw = JSON.stringify({ ...rec, goals: { ...rec.goals, catalog: 3 } })
    expect(parseEconomy(raw).status).toBe('future')
    const st = memoryStorage({ [ECONOMY_KEY]: raw })
    const store = tab(st)
    expect(store.claim()).toMatchObject({ ok: false, reason: 'readOnly' })
    expect(store.claimReward(dailyRewardId(utcDay(clock.t), 0))).toMatchObject({ ok: false, reason: 'readOnly' })
    expect(st.data.get(ECONOMY_KEY)).toBe(raw)
  })
})
