import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, NO_JOKERS, applyJoker, createRng, newGame, play, type GameEvent, type GameState } from '../src/engine'
import {
  ECONOMY_SCHEMA_VERSION,
  HISTORY_LIMIT,
  MAX_INVENTORY_PER_KIND,
  awardMove,
  finishGame,
  initialEconomy,
  purchase,
  startGame,
  starsLeftThisGame,
  syncUsage,
  type EconomyResult,
  type EconomyState,
} from '../src/economy/ledger'
import { FUN_STAR_CAP, JOKER_PRICES, linesCleared, starsForFinalScore, starsForLines, starsForMove } from '../src/economy/rules'
import { LEASE_MS } from '../src/economy/ownership'
import { parseEconomy, serializeEconomy } from '../src/economy/schema'
import { ECONOMY_BACKUP_KEY, ECONOMY_KEY, createEconomyStore, createTabId, newGameId, type EconomyStore } from '../src/storage/economy'
import { ECONOMY_LOCK_NAME, claimWithLock, webLocks, type LockManagerLike } from '../src/storage/economyLock'
import { INVENTORY_KEY } from '../src/storage/inventory'
import { greedyBot, jokerRescueAction } from '../scripts/bot'
import { gameStars, policyById } from '../scripts/economy-policy'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  let writes = 0
  return {
    data,
    get writes() {
      return writes
    },
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      writes++
      data.set(k, v)
    },
  }
}

/** Başarılı sonucu açar; başarısızsa testi düşürür. */
function ok(r: EconomyResult | { ok: boolean; state: EconomyState }): EconomyState {
  expect(r.ok).toBe(true)
  return r.state
}

const cleared = (rows: number[], cols: number[] = []): GameEvent => ({ type: 'cleared', rows, cols, cells: [] })
const rich = (stars: number): EconomyState => ({ ...initialEconomy(), stars })

/** Sahte saat (sekmelerin kira süreleri için) ve sekme yardımcıları. */
const clock = { t: 1_700_000_000_000 }
let tabSeq = 0
type KV = Parameters<typeof createEconomyStore>[0]
/** Yeni sekme (sahiplik almamış). */
const tab = (storage: KV): EconomyStore => createEconomyStore(storage, { tabId: `tab-${++tabSeq}`, now: () => clock.t })
/** Yeni sekme ve sahiplik. */
function owned(storage: KV): EconomyStore {
  const store = tab(storage)
  expect(store.claim().ok).toBe(true)
  return store
}
/** Sayfa yenileme: eski sekme kapanırken sahipliği bırakır, yeni sekme alır. */
function reload(prev: EconomyStore, storage: KV): EconomyStore {
  prev.release()
  return owned(storage)
}

/** Aşama 7 öncesi kayıtlar: ekonomi işlemlerinden hiçbiri bunlara dokunmamalı. */
const OLD_KEYS: Record<string, string> = {
  'popgrid:v1:best': '353',
  'popgrid:v1:best:eglence': '157',
  'popgrid:v1:mode': 'eglence',
  'popgrid:v1:tutorial': 'done',
  'popgrid:v1:sound': 'off',
  'popgrid:v1:joker-intro': 'done',
}

describe('yıldız kuralları', () => {
  it('hat ödülü: 1 → 2, 2 → 5, 3 ve üstü → 10; aynı hamlede birikmez', () => {
    expect([0, 1, 2, 3, 4, 6].map(starsForLines)).toEqual([0, 2, 5, 10, 10, 10])
    expect(starsForMove([cleared([1, 2])])).toBe(5)
    expect(starsForMove([cleared([1], [3, 4])])).toBe(10)
    expect([-1, 1.5, Number.NaN].map(starsForLines)).toEqual([0, 0, 0])
  })

  it('oyun sonu: her tam 100 puan için 5 yıldız', () => {
    expect([0, 99, 100, 199, 250, 1090, 10_000].map(starsForFinalScore)).toEqual([0, 0, 5, 5, 10, 50, 500])
    expect([-100, 150.5, Number.NaN, Infinity].map(starsForFinalScore)).toEqual([0, 0, 0, 0])
  })

  it('fiyatlar: Çekiç 25, Yenile 40, Döndür 20', () => {
    expect(JOKER_PRICES).toEqual({ cekic: 25, yenile: 40, dondur: 20 })
  })

  it('gerçek oyunda her hamlenin yıldızı motorun temizleme olayından gelir; joker hamleleri 0 verir', () => {
    let state: GameState = newGame(11, DEFAULT_CONFIG, { mode: 'eglence' })
    let econ = ok(startGame(initialEconomy(), 'g1', 'eglence'))
    let lineStars = 0
    let jokerResults = 0
    let clears = 0
    while (!state.gameOver && state.moveCount < 400) {
      if (state.stuck) {
        const r = applyJoker(state, jokerRescueAction(state)!)
        expect(r.ok).toBe(true)
        if (!r.ok) break
        expect(starsForMove(r.events)).toBe(0)
        jokerResults++
        econ = ok(syncUsage(econ, 'g1', r.state.jokers))
        state = r.state
        continue
      }
      const r = play(state, greedyBot(state)!)
      if (!r.ok) throw new Error(r.reason)
      const lines = linesCleared(r.events)
      if (lines > 0) clears++
      lineStars += starsForLines(lines)
      econ = ok(awardMove(econ, 'g1', r.state.moveCount, r.events))
      state = r.state
    }
    expect(clears).toBeGreaterThan(0)
    expect(jokerResults).toBeGreaterThan(0)
    expect(econ.stars).toBe(lineStars)
    const end = finishGame(econ, 'g1', state.score, state.jokers)
    expect(end.ok && end.stars).toBe(starsForFinalScore(state.score))
    expect(end.state.stars).toBe(lineStars + starsForFinalScore(state.score))
  })
})

describe('ödül defteri: çift ödül yok', () => {
  it('aynı hamle iki kez yıldız kazandırmaz; eski hamle numarası reddedilir', () => {
    const s0 = ok(startGame(initialEconomy(), 'g', 'klasik'))
    const s1 = ok(awardMove(s0, 'g', 1, [cleared([0])]))
    expect(s1.stars).toBe(2)
    const again = awardMove(s1, 'g', 1, [cleared([0])])
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.reason).toBe('staleMove')
    expect(again.state).toBe(s1)
    expect(awardMove(s1, 'g', 0, [cleared([0])]).ok).toBe(false)
    const s2 = ok(awardMove(s1, 'g', 2, [cleared([0, 1])]))
    expect(s2.stars).toBe(7)
    expect(s2.totals.earned).toBe(7)
  })

  it('oyun sonu ödülü yalnızca bir kez verilir', () => {
    const s0 = ok(startGame(initialEconomy(), 'g', 'klasik'))
    const s1 = ok(finishGame(s0, 'g', 1234, null))
    expect(s1.stars).toBe(60)
    expect(s1.active).toBe(null)
    const again = finishGame(s1, 'g', 1234, null)
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.reason).toBe('noActiveGame')
    expect(again.state.stars).toBe(60)
    // Bitmiş oyun yeniden başlatılıp ödül tekrar alınamaz.
    const restart = startGame(s1, 'g', 'klasik')
    expect(restart.ok).toBe(false)
    if (!restart.ok) expect(restart.reason).toBe('duplicateGame')
    expect(s1.totals.gamesFinished).toBe(1)
  })

  it('başka oyunun hamlesi ya da oyun sonu bu oyuna yazılmaz', () => {
    const s0 = ok(startGame(initialEconomy(), 'a', 'klasik'))
    const r = awardMove(s0, 'b', 1, [cleared([0])])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('wrongGame')
    expect(finishGame(s0, 'b', 500, null).ok).toBe(false)
    expect(awardMove(initialEconomy(), 'a', 1, []).ok).toBe(false)
  })

  it('aynı oyunu iki kez başlatmak hiçbir şeyi değiştirmez', () => {
    const s0 = ok(startGame(initialEconomy(), 'g', 'klasik'))
    const s1 = ok(awardMove(s0, 'g', 1, [cleared([0])]))
    const s2 = startGame(s1, 'g', 'klasik')
    expect(s2.ok).toBe(true)
    expect(s2.state).toBe(s1)
  })

  it('bitmeden bırakılan oyun: hat yıldızları kalır, oyun sonu ödülü verilmez, geç gelen hamle reddedilir', () => {
    let s = ok(startGame(initialEconomy(), 'old', 'klasik'))
    s = ok(awardMove(s, 'old', 1, [cleared([0, 1, 2])]))
    s = ok(startGame(s, 'new', 'klasik'))
    expect(s.stars).toBe(10)
    expect(s.totals.gamesAbandoned).toBe(1)
    expect(s.totals.gamesFinished).toBe(0)
    expect(awardMove(s, 'old', 2, [cleared([0])]).ok).toBe(false)
    expect(finishGame(s, 'old', 900, null).ok).toBe(false)
    expect(s.stars).toBe(10)
  })

  it('geçersiz girdiler reddedilir, durum değişmez', () => {
    const e = initialEconomy()
    for (const r of [
      startGame(e, '', 'klasik'),
      startGame(e, 'x'.repeat(65), 'klasik'),
      startGame(e, 'g', 'hile' as 'klasik'),
      startGame(e, 'g', 'eglence', { cekic: -1, yenile: 0, dondur: 0 }),
    ]) {
      expect(r.ok).toBe(false)
      expect(r.state).toBe(e)
    }
    const s = ok(startGame(e, 'g', 'klasik'))
    expect(awardMove(s, 'g', 1.5, []).ok).toBe(false)
    expect(finishGame(s, 'g', -5, null).ok).toBe(false)
    expect(finishGame(s, 'g', Number.NaN, null).ok).toBe(false)
  })
})

describe('mağaza: atomik satın alma', () => {
  it('yeterli bakiye: fiyat düşer ve envantere 1 eklenir — birlikte', () => {
    const s = ok(purchase(rich(100), 'yenile', 'p1'))
    expect(s.stars).toBe(60)
    expect(s.inventory).toEqual({ cekic: 0, yenile: 1, dondur: 0 })
    expect(s.totals.spent).toBe(40)
  })

  it('tam bakiye yeter; eksik bakiyede hiçbir şey değişmez', () => {
    expect(ok(purchase(rich(25), 'cekic', 'p')).stars).toBe(0)
    const poor = rich(19)
    const r = purchase(poor, 'dondur', 'p')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('insufficientStars')
    expect(r.state).toBe(poor)
  })

  it('çift dokunuş: aynı istek kimliği bir kez işlenir', () => {
    const s1 = ok(purchase(rich(100), 'cekic', 'tap-1'))
    const s2 = purchase(s1, 'cekic', 'tap-1')
    expect(s2.ok).toBe(false)
    if (!s2.ok) expect(s2.reason).toBe('duplicatePurchase')
    expect(s2.state.stars).toBe(75)
    expect(s2.state.inventory.cekic).toBe(1)
  })

  it('iki ayrı dokunuş, tek alımlık bakiye: ikincisi reddedilir, bakiye eksiye düşmez', () => {
    const s1 = ok(purchase(rich(45), 'yenile', 'a'))
    const s2 = purchase(s1, 'yenile', 'b')
    expect(s2.ok).toBe(false)
    expect(s2.state.stars).toBe(5)
    expect(s2.state.inventory.yenile).toBe(1)
  })

  it('geçersiz joker türü ve dolu envanter reddedilir', () => {
    expect(purchase(rich(100), 'bomba' as 'cekic', 'p').ok).toBe(false)
    const full = { ...rich(100), inventory: { cekic: MAX_INVENTORY_PER_KIND, yenile: 0, dondur: 0 } }
    expect(purchase(full, 'cekic', 'p').ok).toBe(false)
  })
})

describe('ücretsiz ve satın alınmış joker kullanımı', () => {
  /** Çekiç'i (önce ücretsiz, sonra satın alınmış) iki kez kullanan gerçek bir Eğlence oyunu. */
  function hammerTwice(): { econ: EconomyState; state: GameState } {
    let econ = ok(purchase(rich(50), 'cekic', 'buy-1'))
    econ = ok(startGame(econ, 'fun', 'eglence', econ.inventory))
    let state = newGame(5, DEFAULT_CONFIG, { mode: 'eglence', inventory: econ.inventory })
    // Tahtada dolu hücre olsun diye birkaç hamle.
    while (state.board.filter((c) => c !== 0).length < 2) {
      const r = play(state, greedyBot(state)!)
      if (!r.ok) throw new Error(r.reason)
      econ = ok(awardMove(econ, 'fun', r.state.moveCount, r.events))
      state = r.state
    }
    const sources: string[] = []
    for (let i = 0; i < 2; i++) {
      const cell = state.board.findIndex((c) => c !== 0)
      const r = applyJoker(state, { type: 'cekic', cell })
      if (!r.ok) throw new Error(r.reason)
      for (const e of r.events) if (e.type === 'jokerUsed') sources.push(e.source)
      state = r.state
      econ = ok(syncUsage(econ, 'fun', state.jokers))
    }
    expect(sources).toEqual(['free', 'inventory'])
    return { econ, state }
  }

  it('önce ücretsiz hak, sonra satın alınmış; kalıcı envanter yalnızca satın alınmıştan düşer', () => {
    const { econ } = hammerTwice()
    expect(econ.inventory.cekic).toBe(0)
    expect(econ.active!.usage.free.cekic).toBe(1)
    expect(econ.active!.usage.purchased.cekic).toBe(1)
  })

  it('aynı cüzdan iki kez bildirilse de envanter bir kez düşer (idempotent)', () => {
    const { econ, state } = hammerTwice()
    const again = ok(syncUsage(econ, 'fun', state.jokers))
    expect(again).toBe(econ)
  })

  it('oyun sonunda satın alınmış kullanım işaretlenir; ayrı rekor tutulur', () => {
    const { econ, state } = hammerTwice()
    const end = ok(finishGame(econ, 'fun', state.score, state.jokers))
    const game = end.history[end.history.length - 1]!
    expect(game.usedPurchased).toBe(true)
    expect(game.usage.free.cekic).toBe(1)
    expect(game.usage.purchased.cekic).toBe(1)
    expect(end.funBests.withPurchased).toBe(state.score)
    expect(end.funBests.withoutPurchased).toBe(0)
  })

  it('yalnız ücretsiz joker kullanılan oyun "satın alınmışsız" sayılır', () => {
    let econ = ok(startGame(initialEconomy(), 'f', 'eglence'))
    let state = newGame(9, DEFAULT_CONFIG, { mode: 'eglence' })
    const r = applyJoker(state, { type: 'yenile' })
    if (!r.ok) throw new Error(r.reason)
    state = r.state
    econ = ok(finishGame(econ, 'f', 420, state.jokers))
    expect(econ.history[0]!.usedPurchased).toBe(false)
    expect(econ.history[0]!.usage.free.yenile).toBe(1)
    expect(econ.funBests).toEqual({ withoutPurchased: 420, withPurchased: 0 })
  })

  it('oyun sırasında yapılan satın alma, kullanım işlenirken silinmez', () => {
    let { econ } = hammerTwice()
    econ = { ...econ, stars: econ.stars + 100 }
    econ = ok(purchase(econ, 'dondur', 'mid'))
    const synced = syncUsage(econ, 'fun', { free: { cekic: 0, yenile: 1, dondur: 2 }, inventory: NO_JOKERS })
    expect(synced.state.inventory.dondur).toBe(1)
  })

  it('sahip olunandan fazla satın alınmış joker oyuna getirilemez', () => {
    const r = startGame(initialEconomy(), 'g', 'eglence', { cekic: 1, yenile: 0, dondur: 0 })
    expect(r.ok).toBe(false)
  })

  it('Klasik Mod: joker yok, harcama yok; getirilen envanter yok sayılır', () => {
    let econ = { ...initialEconomy({ cekic: 3, yenile: 2, dondur: 1 }) }
    econ = ok(startGame(econ, 'k', 'klasik', econ.inventory))
    expect(econ.active!.inventoryAtStart).toEqual(NO_JOKERS)
    const game = newGame(3)
    expect(game.jokers).toBe(null)
    const r = applyJoker(game, { type: 'yenile' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('notFunMode')
    // Sahte bir cüzdan gönderilse bile Klasik oyunda envanter düşmez.
    econ = ok(syncUsage(econ, 'k', { free: NO_JOKERS, inventory: NO_JOKERS }))
    econ = ok(finishGame(econ, 'k', 300, null))
    expect(econ.inventory).toEqual({ cekic: 3, yenile: 2, dondur: 1 })
    expect(econ.history[0]!.usedPurchased).toBe(false)
    expect(econ.funBests).toEqual({ withoutPurchased: 0, withPurchased: 0 })
  })

  it('oyun özetleri sınırlı tutulur', () => {
    let econ = initialEconomy()
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      econ = ok(startGame(econ, `g${i}`, 'klasik'))
      econ = ok(finishGame(econ, `g${i}`, 100, null))
    }
    expect(econ.history).toHaveLength(HISTORY_LIMIT)
    expect(econ.totals.gamesFinished).toBe(HISTORY_LIMIT + 5)
    expect(econ.stars).toBe(5 * (HISTORY_LIMIT + 5))
  })
})

describe('kayıt biçimi ve uyumluluk', () => {
  it('kayıt yoksa sıfırdan başlar; Aşama 6 envanteri taşınır', () => {
    expect(parseEconomy(null).status).toBe('empty')
    expect(parseEconomy(null).state.stars).toBe(0)
    const migrated = parseEconomy(null, JSON.stringify({ cekic: 2, yenile: 0, dondur: 1 }))
    expect(migrated.state.inventory).toEqual({ cekic: 2, yenile: 0, dondur: 1 })
    for (const bad of ['{', '"x"', '[1]', JSON.stringify({ cekic: -3 }), JSON.stringify({ cekic: 'çok' })]) {
      expect(parseEconomy(null, bad).state.inventory).toEqual(NO_JOKERS)
    }
  })

  it('yazılan kayıt aynen geri okunur', () => {
    let econ = ok(purchase(rich(80), 'cekic', 'p'))
    econ = ok(startGame(econ, 'g', 'eglence', econ.inventory))
    econ = ok(awardMove(econ, 'g', 1, [cleared([0])]))
    const back = parseEconomy(serializeEconomy(econ))
    expect(back.status).toBe('ok')
    expect(back.state).toEqual(econ)
  })

  it('bozuk kayıtlar oyunu çökertmez: varsayılanla devam', () => {
    const valid = JSON.parse(serializeEconomy(rich(50))) as Record<string, unknown>
    const cases = [
      '{',
      'null',
      '[]',
      '42',
      JSON.stringify({}),
      JSON.stringify({ ...valid, schemaVersion: 0 }),
      JSON.stringify({ ...valid, stars: -1 }),
      JSON.stringify({ ...valid, stars: '50' }),
      JSON.stringify({ ...valid, stars: 1.5 }),
      JSON.stringify({ ...valid, inventory: { cekic: 1 } }),
      JSON.stringify({ ...valid, active: { id: 'g' } }),
      JSON.stringify({ ...valid, history: [{ id: 'x' }] }),
      JSON.stringify({ ...valid, purchaseIds: [5] }),
      JSON.stringify({ ...valid, totals: null }),
    ]
    for (const raw of cases) {
      const r = parseEconomy(raw)
      expect(r.status).toBe('corrupt')
      expect(r.state.stars).toBe(0)
    }
  })

  it('daha yeni sürümün kaydı okunmaz ve üzerine yazılmaz', () => {
    const raw = JSON.stringify({ schemaVersion: ECONOMY_SCHEMA_VERSION + 1, stars: 999, whatever: true })
    const st = memoryStorage({ [ECONOMY_KEY]: raw })
    const store = tab(st)
    expect(store.load().status).toBe('future')
    expect(store.claim().ok).toBe(false)
    const r = store.startGame('g', 'klasik')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('readOnly')
    expect(store.purchase('cekic', 'p').ok).toBe(false)
    store.release()
    expect(st.data.get(ECONOMY_KEY)).toBe(raw)
    expect(st.writes).toBe(0)
  })
})

describe('şema 1 → 2 geçişi (eski veri)', () => {
  /** Aşama 7.1'in ilk sürümünün (şema 1) yazdığı bir kayıt: sahiplik alanı yok. */
  const v1 = () => {
    let s = ok(purchase(rich(130), 'yenile', 'p1'))
    s = ok(startGame(s, 'eski-oyun', 'eglence', s.inventory))
    s = ok(awardMove(s, 'eski-oyun', 3, [cleared([0, 1])]))
    const { owner: _owner, ...rest } = s
    void _owner
    return JSON.stringify({ ...rest, schemaVersion: 1 })
  }

  it('şema 1 kaydı bütün alanlarıyla okunur, sahiplik boş gelir', () => {
    const r = parseEconomy(v1())
    expect(r.status).toBe('migrated')
    expect(r.state.schemaVersion).toBe(ECONOMY_SCHEMA_VERSION)
    expect(r.state.stars).toBe(130 - 40 + 5)
    expect(r.state.inventory).toEqual({ cekic: 0, yenile: 1, dondur: 0 })
    expect(r.state.active?.id).toBe('eski-oyun')
    expect(r.state.active?.lastAwardedMove).toBe(3)
    expect(r.state.purchaseIds).toEqual(['p1'])
    expect(r.state.owner).toBe(null)
  })

  it('ilk işlemle kayıt şema 2 olarak yazılır; eski oyun ve envanter korunur, eski anahtarlar değişmez', () => {
    const st = memoryStorage({ ...OLD_KEYS, [ECONOMY_KEY]: v1() })
    const store = owned(st)
    expect(store.awardMove('eski-oyun', 4, [cleared([0])]).ok).toBe(true)
    const saved = JSON.parse(st.data.get(ECONOMY_KEY)!) as { schemaVersion: number; owner: { tabId: string } }
    expect(saved.schemaVersion).toBe(2)
    expect(saved.owner.tabId).toBe(store.tabId)
    const back = parseEconomy(st.data.get(ECONOMY_KEY)!)
    expect(back.status).toBe('ok')
    expect(back.state.stars).toBe(130 - 40 + 5 + 2)
    expect(back.state.inventory.yenile).toBe(1)
    for (const [k, v] of Object.entries(OLD_KEYS)) expect(st.data.get(k)).toBe(v)
  })

  it('şema 2 kaydında bozuk sahiplik alanı bozuk kayıt sayılır', () => {
    const good = JSON.parse(serializeEconomy(rich(10))) as Record<string, unknown>
    for (const owner of [{ tabId: '' , until: 1 }, { tabId: 't', until: -1 }, { tabId: 5, until: 1 }, 'x', undefined]) {
      expect(parseEconomy(JSON.stringify({ ...good, owner })).status).toBe('corrupt')
    }
    expect(parseEconomy(JSON.stringify({ ...good, owner: { tabId: 't', until: 5 } })).status).toBe('ok')
  })
})

describe('Eğlence yıldız tavanı (300)', () => {
  const fun = () => ok(startGame(initialEconomy(), 'f', 'eglence'))

  it('hamle ödülleri 300\'de durur; son ödül kalan pay kadar verilir', () => {
    let s = fun()
    for (let m = 1; m <= 29; m++) s = ok(awardMove(s, 'f', m, [cleared([0, 1, 2])]))
    expect(s.stars).toBe(290)
    s = ok(awardMove(s, 'f', 30, [cleared([0])]))
    expect(s.stars).toBe(292)
    const partial = awardMove(s, 'f', 31, [cleared([0, 1, 2])])
    expect(partial.ok && partial.stars).toBe(8)
    s = partial.state
    expect(s.stars).toBe(FUN_STAR_CAP)
    expect(starsLeftThisGame(s.active!)).toBe(0)
  })

  it('tavan dolunca oyun sürer: hamleler kabul edilir (0 yıldız), çift ödül koruması çalışmaya devam eder', () => {
    let s = fun()
    for (let m = 1; m <= 30; m++) s = ok(awardMove(s, 'f', m, [cleared([0, 1, 2])]))
    const after = awardMove(s, 'f', 31, [cleared([0, 1, 2])])
    expect(after.ok && after.stars).toBe(0)
    expect(after.state.active!.lastAwardedMove).toBe(31)
    expect(awardMove(after.state, 'f', 31, [cleared([0])]).ok).toBe(false)
    expect(after.state.stars).toBe(300)
  })

  it('oyun sonu ödülü kalan pay kadar; kazanılmış yıldız geri alınmaz', () => {
    let s = fun()
    for (let m = 1; m <= 28; m++) s = ok(awardMove(s, 'f', m, [cleared([0, 1, 2])]))
    expect(s.stars).toBe(280)
    const end = finishGame(s, 'f', 5_000, null)
    expect(end.ok && end.stars).toBe(20)
    expect(end.state.stars).toBe(300)
    const game = end.state.history[0]!
    expect(game.lineStars + game.endStars).toBe(300)
    expect(game.score).toBe(5_000)
    expect(end.state.funBests.withoutPurchased).toBe(5_000)
  })

  it('tavan, önceki bakiyeyi değil yalnızca bu oyunun kazancını sınırlar', () => {
    let s = ok(startGame(rich(1_000), 'f', 'eglence'))
    s = ok(awardMove(s, 'f', 1, [cleared([0])]))
    s = ok(finishGame(s, 'f', 100_000, null))
    expect(s.stars).toBe(1_300)
    s = ok(startGame(s, 'f2', 'eglence'))
    s = ok(finishGame(s, 'f2', 100_000, null))
    expect(s.stars).toBe(1_600)
  })

  it('Klasik Mod\'da tavan yok', () => {
    let s = ok(startGame(initialEconomy(), 'k', 'klasik'))
    for (let m = 1; m <= 40; m++) s = ok(awardMove(s, 'k', m, [cleared([0, 1, 2])]))
    s = ok(finishGame(s, 'k', 10_000, null))
    expect(s.stars).toBe(400 + 500)
  })

  it('satın alınmış joker kullanan oyuncuya ek kesinti yok: aynı kazançta aynı yıldız', () => {
    const wallet = { free: { cekic: 0, yenile: 0, dondur: 0 }, inventory: NO_JOKERS }
    let a = ok(startGame(initialEconomy({ cekic: 2, yenile: 0, dondur: 0 }), 'buy', 'eglence', { cekic: 2, yenile: 0, dondur: 0 }, { cekic: 1, yenile: 0, dondur: 0 }))
    let b = ok(startGame(initialEconomy(), 'free', 'eglence', NO_JOKERS, { cekic: 1, yenile: 0, dondur: 0 }))
    for (let m = 1; m <= 10; m++) {
      a = ok(awardMove(a, 'buy', m, [cleared([0, 1])]))
      b = ok(awardMove(b, 'free', m, [cleared([0, 1])]))
    }
    a = ok(finishGame(a, 'buy', 1_234, wallet))
    b = ok(finishGame(b, 'free', 1_234, wallet))
    expect(a.history[0]!.usedPurchased).toBe(true)
    expect(b.history[0]!.usedPurchased).toBe(false)
    expect(a.stars).toBe(b.stars)
    expect(a.stars).toBe(50 + 60)
  })

  it('gerçek oyunlar: defter = simülasyonun onaylı kuralı (Eğlence tavan 300, Klasik tavansız)', () => {
    let reachedCap = 0
    for (let seed = 1; seed <= 12; seed++) {
      for (const mode of ['eglence', 'klasik'] as const) {
        const inventory = mode === 'eglence' ? { cekic: 3, yenile: 3, dondur: 3 } : NO_JOKERS
        let e = ok(startGame(initialEconomy(inventory), 'g', mode, inventory))
        let state: GameState = newGame(seed, DEFAULT_CONFIG, mode === 'eglence' ? { mode, inventory } : {})
        let line = 0
        let usedPurchased = false
        let lineAtPurchase = 0
        let scoreAtPurchase = 0
        while (!state.gameOver && state.moveCount < 2_000) {
          if (state.stuck) {
            const r = applyJoker(state, jokerRescueAction(state)!)
            if (!r.ok) throw new Error(r.reason)
            if (!usedPurchased && r.events.some((x) => x.type === 'jokerUsed' && x.source === 'inventory')) {
              usedPurchased = true
              lineAtPurchase = line
              scoreAtPurchase = state.score
            }
            state = r.state
            e = ok(syncUsage(e, 'g', state.jokers))
            continue
          }
          const r = play(state, greedyBot(state)!)
          if (!r.ok) throw new Error(r.reason)
          line += starsForMove(r.events)
          state = r.state
          e = ok(awardMove(e, 'g', state.moveCount, r.events))
        }
        e = ok(finishGame(e, 'g', state.score, state.jokers))
        const input = { lineStars: line, score: state.score, usedPurchased, lineAtPurchase: usedPurchased ? lineAtPurchase : line, scoreAtPurchase: usedPurchased ? scoreAtPurchase : state.score }
        const expected = gameStars(policyById(mode === 'eglence' ? 'C300' : 'A'), input)
        expect(e.stars).toBe(expected)
        if (mode === 'eglence' && line + starsForFinalScore(state.score) > 300) reachedCap++
      }
    }
    expect(reachedCap).toBeGreaterThan(0)
  })
})

describe('kalıcı kayıt (localStorage)', () => {
  it('satın alma tek yazmayla saklanır: bakiye ve envanter birlikte', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(60)) })
    const store = owned(st)
    const before = st.writes
    const r = store.purchase('dondur', 'p1')
    expect(r.ok).toBe(true)
    expect(st.writes - before).toBe(1)
    const saved = parseEconomy(st.data.get(ECONOMY_KEY)!).state
    expect(saved.stars).toBe(40)
    expect(saved.inventory.dondur).toBe(1)
  })

  it('sayfa yenilenince bakiye, envanter ve etkin oyun korunur; çift ödül yine engellenir', () => {
    const st = memoryStorage()
    const a = owned(st)
    a.startGame('g', 'klasik')
    a.awardMove('g', 1, [cleared([0, 1])])
    const b = reload(a, st)
    expect(b.load().state.stars).toBe(5)
    expect(b.awardMove('g', 1, [cleared([0, 1])]).ok).toBe(false)
    expect(b.finishGame('g', 300, null).ok).toBe(true)
    const c = reload(b, st)
    expect(c.finishGame('g', 300, null).ok).toBe(false)
    expect(c.load().state.stars).toBe(20)
  })

  it('sekme oyun ortasında kapandı: kazanılan hat yıldızları kalır, yeni oyun eskisini bırakılmış sayar', () => {
    const st = memoryStorage()
    const s = owned(st)
    s.startGame('g1', 'eglence')
    s.awardMove('g1', 1, [cleared([0])])
    // Çökme: sahiplik bırakılamadı; kira dolunca yeni sekme devralır.
    clock.t += LEASE_MS + 1
    const after = owned(st)
    after.startGame('g2', 'eglence')
    const state = after.load().state
    expect(state.stars).toBe(2)
    expect(state.totals.gamesAbandoned).toBe(1)
    expect(state.active!.id).toBe('g2')
  })

  it('bozuk kayıt yedeklenir, oyun çökmez, ilk işlemle temiz kayıt yazılır', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: '{bozuk' })
    const store = tab(st)
    expect(store.load().status).toBe('corrupt')
    expect(st.data.get(ECONOMY_BACKUP_KEY)).toBe('{bozuk')
    expect(store.claim().ok).toBe(true)
    expect(store.startGame('g', 'klasik').ok).toBe(true)
    expect(parseEconomy(st.data.get(ECONOMY_KEY)!).status).toBe('ok')
  })

  it('depolama kapalı ya da dolu: hata vermez, bu oturumda bellekte devam eder', () => {
    const broken = {
      getItem: () => {
        throw new Error('kapalı')
      },
      setItem: () => {
        throw new Error('kapalı')
      },
    }
    for (const storage of [broken, null]) {
      const store = tab(storage)
      expect(store.load().state.stars).toBe(0)
      expect(store.claim().ok).toBe(true)
      const r = store.startGame('g', 'klasik')
      expect(r.ok && r.persisted).toBe(false)
      store.awardMove('g', 1, [cleared([0, 1, 2])])
      expect(store.load().state.stars).toBe(10)
      expect(store.awardMove('g', 1, [cleared([0])]).ok).toBe(false)
    }
    // Okuma çalışıyor ama yazma kota hatası veriyor.
    const full = { ...memoryStorage(), setItem: () => { throw new Error('QuotaExceededError') } }
    const store = tab(full)
    expect(store.claim().ok).toBe(true)
    expect(store.startGame('g', 'klasik').ok).toBe(true)
    expect(store.awardMove('g', 1, [cleared([0])]).ok).toBe(true)
    expect(store.load().state.stars).toBe(2)
  })

  it('mevcut kayıtlar (rekorlar, mod, eğitim, ses, tanıtım, eski envanter) hiç değişmez', () => {
    const legacy = JSON.stringify({ cekic: 1, yenile: 0, dondur: 0 })
    const st = memoryStorage({ ...OLD_KEYS, [INVENTORY_KEY]: legacy })
    const store = owned(st)
    expect(store.load().state.inventory).toEqual({ cekic: 1, yenile: 0, dondur: 0 })
    store.startGame('g', 'eglence', { cekic: 1, yenile: 0, dondur: 0 })
    store.awardMove('g', 1, [cleared([0])])
    store.syncUsage('g', { free: { cekic: 1, yenile: 1, dondur: 2 }, inventory: NO_JOKERS })
    store.finishGame('g', 777, { free: { cekic: 1, yenile: 1, dondur: 2 }, inventory: NO_JOKERS })
    store.release()
    for (const [k, v] of Object.entries(OLD_KEYS)) expect(st.data.get(k)).toBe(v)
    expect(st.data.get(INVENTORY_KEY)).toBe(legacy)
    const keys = [...st.data.keys()].filter((k) => !(k in OLD_KEYS))
    expect(keys.sort()).toEqual([ECONOMY_KEY, INVENTORY_KEY].sort())
    expect(store.load().state.stars).toBe(2 + 35)
    expect(store.load().state.inventory.cekic).toBe(0)
  })
})

/** Eğlence oyununda satın alınmış Çekiç'i kullanabilecek bir durum (tahtada dolu hücre var). */
function funGameWith(inventory: { cekic: number; yenile: number; dondur: number }, seed = 5): GameState {
  let state = newGame(seed, DEFAULT_CONFIG, { mode: 'eglence', inventory, freeJokers: { cekic: 0, yenile: 0, dondur: 0 } })
  while (state.board.every((c) => c === 0)) {
    const r = play(state, greedyBot(state)!)
    if (!r.ok) throw new Error(r.reason)
    state = r.state
  }
  return state
}
const filledCell = (g: GameState) => g.board.findIndex((c) => c !== 0)

describe('K1 + K2 · tek yazıcı: ikinci sekme ekonomiyi değiştiremez', () => {
  it('ikinci sekme okuyabilir ama yazamaz; açıklama için durumu "other"', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(100)) })
    const a = owned(st)
    const b = tab(st)
    expect(b.ownership()).toBe('other')
    expect(b.load().state.stars).toBe(100)
    const writes = st.writes
    for (const r of [
      b.claim(),
      b.startGame('gb', 'klasik'),
      b.awardMove('gb', 1, [cleared([0])]),
      b.purchase('yenile', 'x'),
      b.syncUsage('gb', null),
      b.finishGame('gb', 500, null),
      b.heartbeat(),
    ]) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('otherTab')
    }
    b.release()
    expect(st.writes).toBe(writes)
    expect(a.ownership()).toBe('mine')
  })

  it('K1: birinci sekmenin oyunu ikinci sekme açıldı diye yıldız kaybetmez', () => {
    const st = memoryStorage()
    const a = owned(st)
    a.startGame('ga', 'klasik')
    const b = tab(st)
    expect(b.startGame('gb', 'klasik').ok).toBe(false)
    expect(a.awardMove('ga', 1, [cleared([0])]).ok).toBe(true)
    expect(a.finishGame('ga', 800, null).ok).toBe(true)
    expect(b.load().state.stars).toBe(2 + 40)
  })

  it('sahip sekme kapanınca (bırakma) ikinci sekme hemen devralır', () => {
    const st = memoryStorage()
    const a = owned(st)
    const b = tab(st)
    expect(b.claim().ok).toBe(false)
    a.release()
    expect(b.claim().ok).toBe(true)
    expect(b.ownership()).toBe('mine')
    expect(a.ownership()).toBe('other')
  })

  it('kira: yenilenen sahip korunur; kirası dolan sahip devredilir ve eski sekme yazamaz', () => {
    const st = memoryStorage()
    const a = owned(st)
    const b = tab(st)
    clock.t += LEASE_MS - 1_000
    expect(a.heartbeat().ok).toBe(true)
    clock.t += LEASE_MS - 1_000
    expect(b.claim().ok).toBe(false)
    clock.t += 2_000
    expect(b.claim().ok).toBe(true)
    const r = a.startGame('ga', 'klasik')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('otherTab')
  })

  it('kullanıcı "bu sekmede devam et" derse sahiplik zorla alınır', () => {
    const st = memoryStorage()
    const a = owned(st)
    const b = tab(st)
    expect(b.claim().ok).toBe(false)
    expect(b.claim(true).ok).toBe(true)
    expect(a.ownership()).toBe('other')
  })

  it('saat geri alınmış (kira bitişi çok ileride): sahiplik boş sayılır', () => {
    const st = memoryStorage()
    const a = owned(st)
    clock.t -= 10 * LEASE_MS
    const b = tab(st)
    expect(b.claim().ok).toBe(true)
    expect(a.ownership()).toBe('other')
  })

  it('K2: aynı satın alınmış joker iki sekmede harcanamaz; devralınan sekmede eski oyun harcayamaz', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(ok(purchase(rich(25), 'cekic', 'p'))) })
    const one = { cekic: 1, yenile: 0, dondur: 0 }
    const a = owned(st)
    expect(a.startGame('ga', 'eglence', one).ok).toBe(true)
    const gameA = funGameWith(one)
    // B açıldı: sahip olmadığı için oyuna satın alınmış joker getiremez, harcayamaz.
    const b = tab(st)
    expect(b.startGame('gb', 'eglence', one).ok).toBe(false)
    const gameB = funGameWith(one, 6)
    const tryB = b.useJoker('gb', gameB, { type: 'cekic', cell: filledCell(gameB) })
    expect(tryB.ok).toBe(false)
    if (!tryB.ok) expect(tryB.reason).toBe('otherTab')
    // B sahipliği zorla alır; A artık satın alınmış joker harcayamaz (motor sonucu da verilmez).
    expect(b.claim(true).ok).toBe(true)
    const tryA = a.useJoker('ga', gameA, { type: 'cekic', cell: filledCell(gameA) })
    expect(tryA.ok).toBe(false)
    // B kendi oyununu başlatıp jokeri bir kez kullanır.
    expect(b.startGame('gb', 'eglence', one).ok).toBe(true)
    const used = b.useJoker('gb', gameB, { type: 'cekic', cell: filledCell(gameB) })
    expect(used.ok).toBe(true)
    expect(b.load().state.inventory.cekic).toBe(0)
    expect(b.load().state.totals.gamesAbandoned).toBe(1)
  })

  it('sahip olmayan sekmede ücretsiz joker oyun içinde çalışır (ekonomiye dokunmaz)', () => {
    const st = memoryStorage()
    owned(st)
    const b = tab(st)
    const game = newGame(9, DEFAULT_CONFIG, { mode: 'eglence' })
    const r = b.useJoker('gb', game, { type: 'yenile' })
    expect(r.ok).toBe(true)
  })

  it('özellik: rastgele iki sekme akışında satın alınmış joker ne kaybolur ne çoğalır', () => {
    const rng = createRng(2026)
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(10_000)) })
    const tabs = [owned(st), tab(st)]
    const games: Array<{ id: string; game: GameState } | null> = [null, null]
    let bought = 0
    let appliedInventoryUses = 0
    for (let step = 0; step < 400; step++) {
      const i = rng.nextInt(2)
      const t = tabs[i]!
      const roll = rng.nextInt(7)
      if (roll === 0) t.claim(rng.nextInt(4) === 0)
      else if (roll === 1) t.release()
      else if (roll === 2) {
        if (t.purchase('cekic', `r${step}`).ok) bought++
      } else if (roll === 3) {
        const inv = t.load().state.inventory
        const id = `g${step}`
        if (t.startGame(id, 'eglence', inv).ok) games[i] = { id, game: funGameWith(inv, step % 50) }
      } else if (roll === 4 && games[i]) {
        const g = games[i]!
        const cell = filledCell(g.game)
        if (cell >= 0 && !g.game.gameOver) {
          const r = t.useJoker(g.id, g.game, { type: 'cekic', cell })
          if (r.ok) {
            if (r.events.some((e) => e.type === 'jokerUsed' && e.source === 'inventory')) appliedInventoryUses++
            games[i] = { id: g.id, game: r.game }
          }
        }
      } else if (roll === 5 && games[i]) {
        t.finishGame(games[i]!.id, games[i]!.game.score, games[i]!.game.jokers)
      } else {
        clock.t += rng.nextInt(2) === 0 ? 1_000 : LEASE_MS + 1
      }
      const s = tabs[0]!.load().state
      expect(s.inventory.cekic).toBe(bought - appliedInventoryUses)
    }
    expect(appliedInventoryUses).toBeGreaterThan(0)
  })
})

describe('K3 · hamle numarası doğrulama', () => {
  const started = (id = 'g') => ok(startGame(initialEconomy(), id, 'klasik'))

  it('sıradaki numara kabul; aynı ya da eski numara reddedilir', () => {
    let s = ok(awardMove(started(), 'g', 1, [cleared([0])]))
    for (const n of [1, 0]) {
      const r = awardMove(s, 'g', n, [cleared([0])])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('staleMove')
    }
    s = ok(awardMove(s, 'g', 2, [cleared([0])]))
    expect(s.stars).toBe(4)
  })

  it('geçersiz numaralar (negatif, ondalık, NaN, sonsuz, metin) reddedilir ve durumu değiştirmez', () => {
    const s = started()
    for (const n of [-1, 1.5, Number.NaN, Infinity, '2' as unknown as number]) {
      const r = awardMove(s, 'g', n, [cleared([0])])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('invalidInput')
      expect(r.state).toBe(s)
    }
  })

  it('atlanan numara çift ödül yaratmaz: atlanan hamle sonradan gelirse reddedilir', () => {
    let s = ok(awardMove(started(), 'g', 1, [cleared([0])]))
    s = ok(awardMove(s, 'g', 3, [cleared([0])]))
    expect(awardMove(s, 'g', 2, [cleared([0])]).ok).toBe(false)
    s = ok(awardMove(s, 'g', 4, [cleared([0])]))
    expect(s.stars).toBe(6)
  })

  it('BİLİNEN SINIRLAMA (yalnızca ham awardMove): çok büyük yanlış numara oyunun kalan hamle ödüllerini kapatır; oyun sonu ödülü verilir', () => {
    let s = ok(awardMove(started(), 'g', 1000, []))
    expect(awardMove(s, 'g', 2, [cleared([0])]).ok).toBe(false)
    s = ok(finishGame(s, 'g', 500, null))
    expect(s.stars).toBe(25)
  })

  it('recordMove numarayı motordan alır: gerçek oyunda her hamle tam bir kez ödüllenir', () => {
    const st = memoryStorage()
    const store = owned(st)
    store.startGame('g', 'klasik')
    let state: GameState = newGame(21)
    let expected = 0
    while (!state.gameOver && state.moveCount < 300) {
      const r = play(state, greedyBot(state)!)
      if (!r.ok) throw new Error(r.reason)
      expected += starsForMove(r.events)
      expect(store.recordMove('g', r.state, r.events).ok).toBe(true)
      // Aynı sonuç ikinci kez bildirilirse (çift olay) reddedilir.
      expect(store.recordMove('g', r.state, r.events).ok).toBe(false)
      state = r.state
    }
    expect(store.load().state.stars).toBe(expected)
    expect(store.load().state.active!.lastAwardedMove).toBe(state.moveCount)
  })
})

describe('K4 · oyun kimliği', () => {
  it('kimlikler rastgele ve benzersiz; tohumdan türetilmez', () => {
    const ids = new Set(Array.from({ length: 5_000 }, () => newGameId()))
    expect(ids.size).toBe(5_000)
    for (const id of [...ids].slice(0, 20)) {
      expect(id.startsWith('g-')).toBe(true)
      expect(id.length).toBeLessThanOrEqual(64)
    }
    expect(createTabId().startsWith('t-')).toBe(true)
  })

  it('aynı tohumla iki oyun: yeni kimlikle ikinci oyun da baştan ödül alır', () => {
    const st = memoryStorage()
    const store = owned(st)
    for (let round = 0; round < 2; round++) {
      const id = newGameId()
      expect(store.startGame(id, 'klasik').ok).toBe(true)
      let state: GameState = newGame(4)
      let expected = store.load().state.stars
      for (let i = 0; i < 25 && !state.gameOver; i++) {
        const r = play(state, greedyBot(state)!)
        if (!r.ok) throw new Error(r.reason)
        expected += starsForMove(r.events)
        expect(store.recordMove(id, r.state, r.events).ok).toBe(true)
        state = r.state
      }
      expect(store.load().state.stars).toBe(expected)
    }
  })

  it('bitmiş oyunun kimliğiyle yeni oyun başlatılamaz; aynı kimlikle çift başlatma etkisizdir', () => {
    let s = ok(finishGame(ok(awardMove(ok(startGame(initialEconomy(), 'x', 'klasik')), 'x', 1, [cleared([0])])), 'x', 200, null))
    const again = startGame(s, 'x', 'klasik')
    expect(again.ok).toBe(false)
    s = ok(startGame(s, 'y', 'klasik'))
    expect(startGame(s, 'y', 'klasik').state).toBe(s)
  })
})

describe('K5 · joker kullanımı ve envanter aynı anda', () => {
  const one = { cekic: 1, yenile: 0, dondur: 0 }
  const setup = () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(ok(purchase(rich(25), 'cekic', 'p'))) })
    const store = owned(st)
    store.startGame('g', 'eglence', one)
    return { st, store, game: funGameWith(one) }
  }

  it('satın alınmış Çekiç: motor sonucu ve envanter düşümü aynı çağrıda; yenilemeden sonra da düşük kalır', () => {
    const { st, store, game } = setup()
    const r = store.useJoker('g', game, { type: 'cekic', cell: filledCell(game) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.game.jokers!.inventory.cekic).toBe(0)
    expect(r.economy.inventory.cekic).toBe(0)
    // Sayfa hemen kapandı: kayıt zaten yazılmıştı.
    const after = reload(store, st)
    expect(after.load().state.inventory.cekic).toBe(0)
    expect(after.load().state.active!.usage.purchased.cekic).toBe(1)
  })

  it('kayıt yazılamıyorsa satın alınmış joker uygulanmaz (çoğalma yok), envanter aynen kalır', () => {
    const { st, game } = setup()
    const failing = { getItem: st.getItem, setItem: () => { throw new Error('QuotaExceededError') } }
    const store = tab(failing)
    // Sahiplik bellekte alınır ama kalıcı değil.
    expect(store.claim(true).ok).toBe(true)
    const r = store.useJoker('g', game, { type: 'cekic', cell: filledCell(game) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('storageError')
    expect(store.load().state.inventory.cekic).toBe(1)
    expect(parseEconomy(st.data.get(ECONOMY_KEY)!).state.inventory.cekic).toBe(1)
  })

  it('başka oyunun kimliğiyle satın alınmış joker harcanamaz', () => {
    const { store, game } = setup()
    const r = store.useJoker('baska', game, { type: 'cekic', cell: filledCell(game) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('wrongGame')
    expect(store.load().state.inventory.cekic).toBe(1)
  })

  it('geçersiz joker (boş hücre) hiçbir şeyi değiştirmez', () => {
    const { store, game } = setup()
    const empty = game.board.findIndex((c) => c === 0)
    const r = store.useJoker('g', game, { type: 'cekic', cell: empty })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('jokerInvalid')
    expect(store.load().state.inventory.cekic).toBe(1)
  })

  it('bırakılan oyun: kullanılmayan satın alınmış jokerler envanterde kalır (kaybolmaz)', () => {
    const { st, store } = setup()
    clock.t += LEASE_MS + 1
    const next = owned(st)
    expect(next.startGame('g2', 'eglence', one).ok).toBe(true)
    expect(next.load().state.inventory.cekic).toBe(1)
    void store
  })
})

describe('K6 · satın alma sırasında sekme yenileme', () => {
  it('yazma olmadan yenilendi: ne yıldız düşer ne joker eklenir', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(50)) })
    const reloaded = tab(st).load().state
    expect(reloaded.stars).toBe(50)
    expect(reloaded.inventory.cekic).toBe(0)
  })

  it('yazmadan sonra yenilendi: ikisi birlikte kalıcı; aynı istek yeniden gönderilirse ikinci kez alınmaz', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(50)) })
    const first = owned(st)
    expect(first.purchase('cekic', 'tap-7').ok).toBe(true)
    const after = reload(first, st)
    expect(after.load().state.stars).toBe(25)
    expect(after.load().state.inventory.cekic).toBe(1)
    const again = after.purchase('cekic', 'tap-7')
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.reason).toBe('duplicatePurchase')
    expect(after.load().state.stars).toBe(25)
  })

  it('yazma başarısız (kota): alım yalnızca bellekte; yenilemede ikisi birlikte geri döner, yarım kalmaz', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(50)) })
    const failing = { getItem: st.getItem, setItem: () => { throw new Error('QuotaExceededError') } }
    const store = tab(failing)
    store.claim()
    const r = store.purchase('yenile', 'p')
    expect(r.ok && r.persisted).toBe(false)
    const reloaded = tab(st).load().state
    expect(reloaded.stars).toBe(50)
    expect(reloaded.inventory.yenile).toBe(0)
  })
})

describe('K7 · eşzamanlı sahiplik alma', () => {
  it('Web Locks varsa sahiplik alma kilit içinde ve sırayla yapılır', async () => {
    const st = memoryStorage()
    const order: string[] = []
    let chain: Promise<unknown> = Promise.resolve()
    const locks: LockManagerLike = {
      request<T>(name: string, _o: { mode: 'exclusive' }, cb: () => T | Promise<T>): Promise<T> {
        const run = chain.then(async () => {
          order.push(`al:${name}`)
          const v = await cb()
          order.push('bırak')
          return v
        })
        chain = run
        return run
      },
    }
    const a = tab(st)
    const b = tab(st)
    const [ra, rb] = await Promise.all([claimWithLock(a, false, locks), claimWithLock(b, false, locks)])
    expect(ra.ok).toBe(true)
    expect(ra.locked).toBe(true)
    expect(rb.ok).toBe(false)
    expect(order).toEqual([`al:${ECONOMY_LOCK_NAME}`, 'bırak', `al:${ECONOMY_LOCK_NAME}`, 'bırak'])
  })

  it('Web Locks yoksa kilitsiz alır (desteklenmeyen tarayıcı)', async () => {
    const st = memoryStorage()
    const r = await claimWithLock(tab(st), false, null)
    expect(r.ok).toBe(true)
    expect(r.locked).toBe(false)
    expect(webLocks()).toBe(null)
  })

  it('kilitsiz en kötü durum: iki sekme aynı anda alırsa sahiplik birinde kalır, öteki yazamaz, veri kaybolmaz', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(70)) })
    // B, A'nın almasından önceki kaydı okumuş gibi (aynı milisaniye): bayat okuma.
    const stale = st.data.get(ECONOMY_KEY)!
    const a = owned(st)
    let first = true
    const staleView = {
      getItem: (k: string) => (k === ECONOMY_KEY && first ? ((first = false), stale) : st.getItem(k)),
      setItem: st.setItem,
    }
    const b = createEconomyStore(staleView, { tabId: 'tab-b', now: () => clock.t })
    expect(b.claim().ok).toBe(true)
    const r = a.purchase('yenile', 'x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('otherTab')
    const s = b.load().state
    expect(s.stars).toBe(70)
    expect(s.inventory.yenile).toBe(0)
    expect(b.purchase('yenile', 'y').ok).toBe(true)
  })
})
