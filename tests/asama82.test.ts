import { describe, expect, it } from 'vitest'
import { emptyBoard, placeCells } from '../src/engine/board'
import { DEFAULT_CONFIG, GENERATOR_VERSION, SHARED_SEQUENCE_CONFIG } from '../src/engine/generator'
import { fingerprint, newGame, play } from '../src/engine/game'
import { applyJoker } from '../src/engine/jokers'
import { FUN_RULES_VERSION, LUCKY_JOKER_CAP, LUCKY_JOKER_OVERFLOW_STARS } from '../src/engine/specials'
import type { Board, BoardSpecial, GameEvent, GameState, JokerCharges, LuckyReward, Piece, PieceSpecial, Tray } from '../src/engine/types'
import {
  ECONOMY_SCHEMA_VERSION,
  awardMove,
  finishGame,
  initialEconomy,
  luckyJokersGranted,
  startGame,
  syncUsage,
  type EconomyState,
} from '../src/economy/ledger'
import { FUN_STAR_CAP, starsForMove } from '../src/economy/rules'
import { parseEconomy, serializeEconomy } from '../src/economy/schema'
import { bestKey } from '../src/storage/records'
import { PRIOR_USE_KEYS, hasPriorUse } from '../src/storage/tutorial'

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`beklenmeyen geçersiz sonuç: ${JSON.stringify((r as { reason?: string }).reason)}`)
  return r as Extract<T, { ok: true }>
}
const NONE: JokerCharges = { cekic: 0, yenile: 0, dondur: 0 }
const dot = (special?: PieceSpecial): Piece => (special ? { shapeId: 'dot', color: 1, special } : { shapeId: 'dot', color: 1 })
const luckyJoker = (joker: 'cekic' | 'yenile' | 'dondur'): LuckyReward => ({ type: 'joker', joker })
const ROW3 = [24, 25, 26, 28, 29, 30, 31] // (3,3)=27 hariç satır 3
const filled = (cells: number[]): Board => placeCells(emptyBoard(), cells, 2)
function funState(board: Board, tray: Array<Piece | null>, specials: BoardSpecial[] = [], luckyJokers = 0): GameState {
  const base = newGame(5, SHARED_SEQUENCE_CONFIG, { mode: 'eglence', freeJokers: NONE })
  return { ...base, board, tray: tray as unknown as Tray, specials, luckyJokers }
}
const rewards = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: 'luckyReward' }> => e.type === 'luckyReward')

// ---------------------------------------------------------------------------
describe('Aşama 8.2 / A: şanslı bloktan oyun başına en fazla 2 ücretsiz joker', () => {
  it('sabitler: sınır 2, sınır sonrası +5 yıldız; sürümler aynı', () => {
    expect(LUCKY_JOKER_CAP).toBe(2)
    expect(LUCKY_JOKER_OVERFLOW_STARS).toBe(5)
    expect(GENERATOR_VERSION).toBe(1)
    expect(FUN_RULES_VERSION).toBe(1)
  })

  it('yeni özel bloklu Eğlence oyunu 0 ile başlar; özel bloksuz Eğlence ve Klasik\'te alan yok', () => {
    expect(newGame(3, DEFAULT_CONFIG, { mode: 'eglence' }).luckyJokers).toBe(0)
    expect('luckyJokers' in newGame(3, DEFAULT_CONFIG, { mode: 'eglence', specials: false })).toBe(false)
    expect('luckyJokers' in newGame(3)).toBe(false)
  })

  it('1. ve 2. joker ödülü verilir; 3. joker ödülü +5 yıldıza dönüşür (ayrı hamlelerde)', () => {
    const results: GameState[] = []
    for (const before of [0, 1, 2]) {
      const r = ok(play(funState(filled(ROW3), [dot({ kind: 'sansli', block: [0, 0], reward: luckyJoker('cekic') }), dot(), dot()], [], before), { slot: 0, row: 3, col: 3 }))
      const [ev] = rewards(r.events)
      if (before < 2) {
        expect(ev).toEqual({ type: 'luckyReward', cell: 27, reward: luckyJoker('cekic'), cause: 'line' })
        expect(r.state.jokers!.free.cekic).toBe(1)
        expect(r.state.luckyJokers).toBe(before + 1)
        expect(starsForMove(r.events)).toBe(2) // yalnızca hat yıldızı
      } else {
        expect(ev).toEqual({ type: 'luckyReward', cell: 27, reward: { type: 'stars', amount: 5 }, cause: 'line', convertedFrom: 'cekic' })
        expect(r.state.jokers!.free.cekic).toBe(0)
        expect(r.state.luckyJokers).toBe(2)
        expect(starsForMove(r.events)).toBe(2 + 5)
      }
      results.push(r.state)
    }
    expect(results).toHaveLength(3)
  })

  it('aynı hamlede iki joker ödülü, sınıra 1 kala: biri joker, diğeri +5 yıldız', () => {
    const board = filled([...ROW3, 19])
    const specials: BoardSpecial[] = [
      { kind: 'bomba', cell: 26, timer: 3 }, // satır 3'te: hatla erken patlar, 19'u da kaldırır
      { kind: 'sansli', cell: 25, reward: luckyJoker('dondur') }, // hatla
      { kind: 'sansli', cell: 19, reward: luckyJoker('yenile') }, // patlamayla
    ]
    const r = ok(play(funState(board, [dot(), dot(), dot()], specials, 1), { slot: 0, row: 3, col: 3 }))
    const evs = rewards(r.events)
    expect(evs).toHaveLength(2)
    expect(evs[0]).toEqual({ type: 'luckyReward', cell: 25, reward: luckyJoker('dondur'), cause: 'line' })
    expect(evs[1]).toEqual({ type: 'luckyReward', cell: 19, reward: { type: 'stars', amount: 5 }, cause: 'bomb', convertedFrom: 'yenile' })
    expect(r.state.jokers!.free).toEqual({ cekic: 0, yenile: 0, dondur: 1 })
    expect(r.state.luckyJokers).toBe(2)
    expect(starsForMove(r.events)).toBe(2 + 5)
  })

  it('yıldız ödülleri sınırdan etkilenmez; sayaç parmak izinde ve JSON\'dan geri yüklemede korunur', () => {
    const r = ok(play(funState(filled(ROW3), [dot({ kind: 'sansli', block: [0, 0], reward: { type: 'stars', amount: 10 } }), dot(), dot()], [], 2), { slot: 0, row: 3, col: 3 }))
    expect(rewards(r.events)[0]!.reward).toEqual({ type: 'stars', amount: 10 })
    const s = r.state
    expect(fingerprint({ ...s, luckyJokers: 1 })).not.toBe(fingerprint(s))
    expect(fingerprint(JSON.parse(JSON.stringify(s)) as GameState)).toBe(fingerprint(s))
  })

  it('Çekiç sayacı değiştirmez; gerçek oyunlarda şanslı joker hiçbir zaman 2\'yi aşmaz', () => {
    const s = ok(play(funState(filled([0]), [dot(), dot(), dot()], [], 1), { slot: 0, row: 7, col: 7 })).state
    const h = ok(applyJoker({ ...s, jokers: { ...s.jokers!, free: { cekic: 1, yenile: 0, dondur: 0 } } }, { type: 'cekic', cell: 0 }))
    expect(h.state.luckyJokers).toBe(1)
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let g = newGame(seed, DEFAULT_CONFIG, { mode: 'eglence' })
      let granted = 0
      for (let i = 0; i < 300 && !g.gameOver && !g.stuck; i++) {
        const move = firstLegal(g)
        if (!move) break
        const r = ok(play(g, move))
        granted += rewards(r.events).filter((e) => e.reward.type === 'joker').length
        g = r.state
        expect(g.luckyJokers!).toBeLessThanOrEqual(LUCKY_JOKER_CAP)
      }
      expect(granted).toBe(g.luckyJokers)
    }
  })
})

/** Basit, deterministik hamle seçici (bot yerine; bu testte strateji önemli değil). */
function firstLegal(s: GameState) {
  for (const slot of [0, 1, 2] as const) {
    const p = s.tray[slot]
    if (!p) continue
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) if (play(s, { slot, row, col }).ok) return { slot, row, col }
  }
  return null
}

// ---------------------------------------------------------------------------
describe('Aşama 8.2: şanslı jokerin kullanım istatistiği (defter)', () => {
  const grantEvents = (joker: 'cekic' | 'yenile' | 'dondur', convertedFrom?: 'cekic'): GameEvent[] => [
    convertedFrom
      ? { type: 'luckyReward', cell: 1, reward: { type: 'stars', amount: 5 }, cause: 'line', convertedFrom }
      : { type: 'luckyReward', cell: 1, reward: luckyJoker(joker), cause: 'line' },
  ]

  it('luckyJokersGranted yalnızca verilen jokerleri sayar (yıldıza dönenleri değil)', () => {
    expect(luckyJokersGranted(grantEvents('cekic'))).toEqual({ cekic: 1, yenile: 0, dondur: 0 })
    expect(luckyJokersGranted(grantEvents('cekic', 'cekic'))).toEqual(NONE)
  })

  it('verilen ücretsiz joker kullanılınca istatistik doğru sayar; satın alınmış kullanım ve envanter değişmez', () => {
    let e = ok(startGame(initialEconomy({ cekic: 2, yenile: 0, dondur: 0 }), 'g', 'eglence', { cekic: 2, yenile: 0, dondur: 0 }, { cekic: 1, yenile: 0, dondur: 0 }, 1)).state
    expect(e.active!.funRules).toBe(1)
    expect(e.active!.freeGranted).toEqual(NONE)
    e = ok(awardMove(e, 'g', 1, grantEvents('cekic'))).state
    expect(e.active!.freeGranted).toEqual({ cekic: 1, yenile: 0, dondur: 0 })
    // Aynı hamle ikinci kez işlenmez: verilen joker iki kez sayılmaz.
    expect(awardMove(e, 'g', 1, grantEvents('cekic')).ok).toBe(false)
    // Oyuncu iki ücretsiz Çekiç'i de kullandı (başlangıçtaki 1 + şanslıdan 1); satın alınmışlar duruyor.
    e = ok(syncUsage(e, 'g', { free: NONE, inventory: { cekic: 2, yenile: 0, dondur: 0 } })).state
    expect(e.active!.usage.free.cekic).toBe(2) // düzeltme öncesi 1 sayılırdı
    expect(e.active!.usage.purchased).toEqual(NONE)
    expect(e.inventory.cekic).toBe(2)
    const end = ok(finishGame(e, 'g', 500, { free: NONE, inventory: { cekic: 2, yenile: 0, dondur: 0 } })).state
    expect(end.history.at(-1)!.usage.free.cekic).toBe(2)
    expect(end.history.at(-1)!.usedPurchased).toBe(false)
  })

  it('verilen ücretsiz joker varken satın alınmış joker kullanılırsa doğru ayrılır', () => {
    let e = ok(startGame(initialEconomy({ cekic: 1, yenile: 0, dondur: 0 }), 'g', 'eglence', { cekic: 1, yenile: 0, dondur: 0 }, NONE, 1)).state
    e = ok(awardMove(e, 'g', 1, grantEvents('cekic'))).state
    // 2 Çekiç kullanıldı: önce ücretsiz (şanslıdan), sonra satın alınmış.
    e = ok(syncUsage(e, 'g', { free: NONE, inventory: NONE })).state
    expect(e.active!.usage.free.cekic).toBe(1)
    expect(e.active!.usage.purchased.cekic).toBe(1)
    expect(e.inventory.cekic).toBe(0)
  })

  it('Klasik oyuna kural sürümü verilemez; sürümsüz Eğlence (eski oyun) eskisi gibi çalışır', () => {
    expect(startGame(initialEconomy(), 'k', 'klasik', NONE, NONE, 1).ok).toBe(false)
    const e = ok(startGame(initialEconomy(), 'old', 'eglence')).state
    expect('funRules' in e.active! || 'freeGranted' in e.active!).toBe(false)
    expect(ok(awardMove(e, 'old', 1, grantEvents('cekic'))).state.active!.freeGranted).toBe(undefined)
  })

  it('şanslı yıldız ve dönüşen +5 yıldız 300 tavanına tabidir', () => {
    let e = ok(startGame(initialEconomy(), 'g', 'eglence', NONE, NONE, 1)).state
    let total = 0
    for (let m = 1; m <= 80; m++) {
      const r = ok(awardMove(e, 'g', m, grantEvents('cekic', 'cekic')))
      total += r.stars
      e = r.state
    }
    expect(total).toBe(FUN_STAR_CAP)
  })
})

// ---------------------------------------------------------------------------
describe('Aşama 8.2: özel bloklu Eğlence için ayrı rekorlar', () => {
  const play2 = (e: EconomyState, id: string, funRules: number | undefined, score: number, usedPurchased: boolean) => {
    const inv = usedPurchased ? { cekic: 1, yenile: 0, dondur: 0 } : NONE
    let s = ok(startGame(e, id, 'eglence', inv, NONE, funRules)).state
    s = ok(finishGame(s, id, score, { free: NONE, inventory: NONE })).state
    return s
  }

  it('özel bloklu oyun yalnızca funBestsOzel\'i günceller; eski Eğlence rekorları korunur', () => {
    let e: EconomyState = { ...initialEconomy({ cekic: 5, yenile: 0, dondur: 0 }), funBests: { withoutPurchased: 1234, withPurchased: 777 } }
    e = play2(e, 'a', 1, 9000, false)
    e = play2(e, 'b', 1, 4000, true)
    expect(e.funBests).toEqual({ withoutPurchased: 1234, withPurchased: 777 })
    expect(e.funBestsOzel).toEqual({ withoutPurchased: 9000, withPurchased: 4000 })
    expect(e.history.map((g) => g.funRules)).toEqual([1, 1])
  })

  it('kural sürümsüz (Aşama 8 öncesi) oyun eski rekorları günceller; yenilere dokunmaz', () => {
    const e = play2(initialEconomy(), 'x', undefined, 500, false)
    expect(e.funBests.withoutPurchased).toBe(500)
    expect(e.funBestsOzel).toEqual({ withoutPurchased: 0, withPurchased: 0 })
    expect('funRules' in e.history[0]!).toBe(false)
  })

  it('kayıt anahtarları: eski anahtarlar aynı; özel bloklu Eğlence ayrı anahtarda', () => {
    expect(bestKey('klasik')).toBe('popgrid:v1:best')
    expect(bestKey('eglence')).toBe('popgrid:v1:best:eglence')
    expect(bestKey('eglenceOzel')).toBe('popgrid:v1:best:eglence-ozel')
    expect(new Set([bestKey('klasik'), bestKey('eglence'), bestKey('eglenceOzel')]).size).toBe(3)
  })

  it('eğitim: yalnızca yeni (özel bloklu) rekoru olan oyuncu da "daha önce oynamış" sayılır', () => {
    const store = (data: Record<string, string>) => ({ getItem: (k: string) => data[k] ?? null })
    expect(PRIOR_USE_KEYS.bestFunOzel).toBe(bestKey('eglenceOzel'))
    expect(hasPriorUse(store({ 'popgrid:v1:best:eglence-ozel': '250' }))).toBe(true)
    expect(hasPriorUse(store({ 'popgrid:v1:best:eglence': '250' }))).toBe(true)
    expect(hasPriorUse(store({ 'popgrid:v1:best:eglence-ozel': '0' }))).toBe(false)
    expect(hasPriorUse(store({}))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('Aşama 8.2: kayıt şeması 3 ve geriye uyumluluk', () => {
  const v2 = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      schemaVersion: 2,
      stars: 140,
      inventory: { cekic: 1, yenile: 2, dondur: 0 },
      active: {
        id: 'eski',
        mode: 'eglence',
        lastAwardedMove: 4,
        lineStars: 12,
        freeAtStart: { cekic: 1, yenile: 1, dondur: 2 },
        inventoryAtStart: { cekic: 1, yenile: 0, dondur: 0 },
        usage: { free: { cekic: 1, yenile: 0, dondur: 0 }, purchased: { cekic: 0, yenile: 0, dondur: 0 } },
      },
      history: [{ id: 'h', mode: 'eglence', score: 900, lineStars: 30, endStars: 45, usage: { free: NONE, purchased: NONE }, usedPurchased: false }],
      funBests: { withoutPurchased: 900, withPurchased: 0 },
      totals: { earned: 200, spent: 60, gamesFinished: 1, gamesAbandoned: 0 },
      purchaseIds: ['p1'],
      owner: null,
      ...over,
    })

  // Aşama 10.2: şema 4'e çıktı (görevler); şema 3'ün bütün alanları ve geçişleri aynen geçerli.
  it('güncel şema 4 (Aşama 10.2)', () => {
    expect(ECONOMY_SCHEMA_VERSION).toBe(4)
  })

  it('şema 2 kaydı okunur (migrated): bakiye, envanter, oyun, geçmiş, eski rekorlar aynen; yeni alanlar boş', () => {
    const r = parseEconomy(v2())
    expect(r.status).toBe('migrated')
    expect(r.state.schemaVersion).toBe(4)
    expect(r.state.stars).toBe(140)
    expect(r.state.inventory).toEqual({ cekic: 1, yenile: 2, dondur: 0 })
    expect(r.state.funBests).toEqual({ withoutPurchased: 900, withPurchased: 0 })
    expect(r.state.funBestsOzel).toEqual({ withoutPurchased: 0, withPurchased: 0 })
    expect(r.state.active!.lineStars).toBe(12)
    expect('funRules' in r.state.active! || 'freeGranted' in r.state.active!).toBe(false)
    expect(r.state.history[0]!.score).toBe(900)
    expect(r.state.totals).toEqual({ earned: 200, spent: 60, gamesFinished: 1, gamesAbandoned: 0, rewardEarned: 0 })
    expect(r.state.rewardIds).toEqual([])
    expect(r.state.goals.day).toBe(null)
  })

  it('şema 2 kaydındaki yabancı Aşama 8 alanları yok sayılır (2\'de anlamı yok)', () => {
    const r = parseEconomy(v2({ funBestsOzel: { withoutPurchased: 'x' } }))
    expect(r.status).toBe('migrated')
    expect(r.state.funBestsOzel).toEqual({ withoutPurchased: 0, withPurchased: 0 })
  })

  it('şema 3 kaydı birebir geri okunur (funRules, freeGranted, funBestsOzel dahil)', () => {
    let e = ok(startGame(initialEconomy(), 'g', 'eglence', NONE, { cekic: 1, yenile: 1, dondur: 2 }, 1)).state
    e = ok(awardMove(e, 'g', 1, [{ type: 'luckyReward', cell: 1, reward: luckyJoker('yenile'), cause: 'line' }])).state
    e = { ...e, funBestsOzel: { withoutPurchased: 4321, withPurchased: 12 } }
    const back = parseEconomy(serializeEconomy(e))
    expect(back.status).toBe('ok')
    expect(back.state).toEqual(e)
  })

  it('şema 3\'te bozuk ya da eksik yeni alan bozuk kayıt sayılır; daha yeni şema "future"', () => {
    const good = JSON.parse(serializeEconomy(initialEconomy())) as Record<string, unknown>
    expect(parseEconomy(JSON.stringify(good)).status).toBe('ok')
    const noOzel: Record<string, unknown> = { ...good }
    delete noOzel.funBestsOzel
    expect(parseEconomy(JSON.stringify(noOzel)).status).toBe('corrupt')
    const withActive = (active: Record<string, unknown>) =>
      JSON.stringify({ ...good, active: { id: 'a', mode: 'eglence', lastAwardedMove: 0, lineStars: 0, freeAtStart: NONE, inventoryAtStart: NONE, usage: { free: NONE, purchased: NONE }, ...active } })
    expect(parseEconomy(withActive({ funRules: 1, freeGranted: NONE })).status).toBe('ok')
    expect(parseEconomy(withActive({ funRules: 0 })).status).toBe('corrupt')
    expect(parseEconomy(withActive({ freeGranted: { cekic: -1, yenile: 0, dondur: 0 } })).status).toBe('corrupt')
    expect(parseEconomy(JSON.stringify({ ...good, schemaVersion: 5 })).status).toBe('future')
  })
})
