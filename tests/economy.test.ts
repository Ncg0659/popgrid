import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, NO_JOKERS, applyJoker, newGame, play, type GameEvent, type GameState } from '../src/engine'
import {
  HISTORY_LIMIT,
  MAX_INVENTORY_PER_KIND,
  awardMove,
  finishGame,
  initialEconomy,
  purchase,
  startGame,
  syncUsage,
  type EconomyResult,
  type EconomyState,
} from '../src/economy/ledger'
import { JOKER_PRICES, linesCleared, starsForFinalScore, starsForLines, starsForMove } from '../src/economy/rules'
import { parseEconomy, serializeEconomy } from '../src/economy/schema'
import { ECONOMY_BACKUP_KEY, ECONOMY_KEY, createEconomyStore } from '../src/storage/economy'
import { INVENTORY_KEY } from '../src/storage/inventory'
import { greedyBot, jokerRescueAction } from '../scripts/bot'

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
    const raw = JSON.stringify({ schemaVersion: 2, stars: 999, whatever: true })
    const st = memoryStorage({ [ECONOMY_KEY]: raw })
    const store = createEconomyStore(st)
    expect(store.load().status).toBe('future')
    const r = store.startGame('g', 'klasik')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('readOnly')
    expect(store.purchase('cekic', 'p').ok).toBe(false)
    expect(st.data.get(ECONOMY_KEY)).toBe(raw)
    expect(st.writes).toBe(0)
  })
})

describe('kalıcı kayıt (localStorage)', () => {
  it('satın alma tek yazmayla saklanır: bakiye ve envanter birlikte', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(60)) })
    const store = createEconomyStore(st)
    const r = store.purchase('dondur', 'p1')
    expect(r.ok).toBe(true)
    expect(st.writes).toBe(1)
    const saved = parseEconomy(st.data.get(ECONOMY_KEY)!).state
    expect(saved.stars).toBe(40)
    expect(saved.inventory.dondur).toBe(1)
  })

  it('sayfa yenilenince (yeni depo nesnesi) bakiye, envanter ve etkin oyun korunur; çift ödül yine engellenir', () => {
    const st = memoryStorage()
    const a = createEconomyStore(st)
    a.startGame('g', 'klasik')
    a.awardMove('g', 1, [cleared([0, 1])])
    const b = createEconomyStore(st)
    expect(b.load().state.stars).toBe(5)
    expect(b.awardMove('g', 1, [cleared([0, 1])]).ok).toBe(false)
    expect(b.finishGame('g', 300, null).ok).toBe(true)
    expect(createEconomyStore(st).finishGame('g', 300, null).ok).toBe(false)
    expect(createEconomyStore(st).load().state.stars).toBe(20)
  })

  it('sekme oyun ortasında kapandı: kazanılan hat yıldızları kalır, yeni oyun eskisini bırakılmış sayar', () => {
    const st = memoryStorage()
    const s = createEconomyStore(st)
    s.startGame('g1', 'eglence')
    s.awardMove('g1', 1, [cleared([0])])
    // Oyun devam kaydı yok: yeniden açılışta yeni oyun başlar.
    const after = createEconomyStore(st)
    after.startGame('g2', 'eglence')
    const state = after.load().state
    expect(state.stars).toBe(2)
    expect(state.totals.gamesAbandoned).toBe(1)
    expect(state.active!.id).toBe('g2')
  })

  it('iki depo nesnesi (iki sekme) sırayla yazınca biri ötekinin alımını silmez', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(100)) })
    const tab1 = createEconomyStore(st)
    const tab2 = createEconomyStore(st)
    expect(tab1.purchase('yenile', 'a').ok).toBe(true)
    expect(tab2.purchase('yenile', 'b').ok).toBe(true)
    expect(tab2.purchase('yenile', 'c').ok).toBe(false)
    const final = createEconomyStore(st).load().state
    expect(final.stars).toBe(20)
    expect(final.inventory.yenile).toBe(2)
  })

  it('bozuk kayıt yedeklenir, oyun çökmez, ilk işlemle temiz kayıt yazılır', () => {
    const st = memoryStorage({ [ECONOMY_KEY]: '{bozuk' })
    const store = createEconomyStore(st)
    expect(store.load().status).toBe('corrupt')
    expect(st.data.get(ECONOMY_BACKUP_KEY)).toBe('{bozuk')
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
      const store = createEconomyStore(storage)
      expect(store.load().state.stars).toBe(0)
      const r = store.startGame('g', 'klasik')
      expect(r.ok && r.persisted).toBe(false)
      store.awardMove('g', 1, [cleared([0, 1, 2])])
      expect(store.load().state.stars).toBe(10)
      expect(store.awardMove('g', 1, [cleared([0])]).ok).toBe(false)
    }
    // Okuma çalışıyor ama yazma kota hatası veriyor.
    const full = { ...memoryStorage(), setItem: () => { throw new Error('QuotaExceededError') } }
    const store = createEconomyStore(full)
    expect(store.startGame('g', 'klasik').ok).toBe(true)
    expect(store.awardMove('g', 1, [cleared([0])]).ok).toBe(true)
    expect(store.load().state.stars).toBe(2)
  })

  it('mevcut kayıtlar (rekorlar, mod, eğitim, ses, tanıtım, eski envanter) hiç değişmez', () => {
    const legacy = JSON.stringify({ cekic: 1, yenile: 0, dondur: 0 })
    const st = memoryStorage({ ...OLD_KEYS, [INVENTORY_KEY]: legacy })
    const store = createEconomyStore(st)
    expect(store.load().state.inventory).toEqual({ cekic: 1, yenile: 0, dondur: 0 })
    store.startGame('g', 'eglence', { cekic: 1, yenile: 0, dondur: 0 })
    store.awardMove('g', 1, [cleared([0])])
    store.syncUsage('g', { free: { cekic: 1, yenile: 1, dondur: 2 }, inventory: NO_JOKERS })
    store.finishGame('g', 777, { free: { cekic: 1, yenile: 1, dondur: 2 }, inventory: NO_JOKERS })
    for (const [k, v] of Object.entries(OLD_KEYS)) expect(st.data.get(k)).toBe(v)
    expect(st.data.get(INVENTORY_KEY)).toBe(legacy)
    const keys = [...st.data.keys()].filter((k) => !(k in OLD_KEYS))
    expect(keys.sort()).toEqual([ECONOMY_KEY, INVENTORY_KEY].sort())
    expect(store.load().state.stars).toBe(2 + 35)
  })
})

/**
 * Aşama 7.1 ek: risk senaryoları. Bu testler BUGÜNKÜ davranışı belgeler.
 * "BİLİNEN SINIRLAMA" diye işaretlenenler docs/asama-7.1-dengeleme.md'de kusur olarak raporlandı;
 * düzeltme onaylanırsa bu testler bilerek değiştirilecek.
 */
describe('risk senaryoları', () => {
  const started = (id = 'g') => ok(startGame(initialEconomy(), id, 'klasik'))

  describe('hamle numarası atlama', () => {
    it('atlanan numara sorun değil; geride kalan numara reddedilir, sonrakiler kabul edilir', () => {
      let s = ok(awardMove(started(), 'g', 1, [cleared([0])]))
      s = ok(awardMove(s, 'g', 3, [cleared([0])]))
      expect(awardMove(s, 'g', 2, [cleared([0])]).ok).toBe(false)
      s = ok(awardMove(s, 'g', 4, [cleared([0])]))
      expect(s.stars).toBe(6)
    })

    it('BİLİNEN SINIRLAMA: yanlışlıkla çok büyük numara gelirse oyunun kalanında hamle ödülü verilmez (oyun sonu ödülü yine verilir)', () => {
      let s = ok(awardMove(started(), 'g', 1000, []))
      expect(awardMove(s, 'g', 2, [cleared([0])]).ok).toBe(false)
      expect(awardMove(s, 'g', 999, [cleared([0])]).ok).toBe(false)
      s = ok(finishGame(s, 'g', 500, null))
      expect(s.stars).toBe(25)
    })
  })

  describe('yinelenen oyun kimliği', () => {
    it('bitmiş oyunun kimliğiyle yeni oyun başlatılamaz (yıldız verilmez, bakiye korunur)', () => {
      let s = ok(finishGame(ok(awardMove(started('x'), 'x', 1, [cleared([0])])), 'x', 200, null))
      const before = s.stars
      const again = startGame(s, 'x', 'klasik')
      expect(again.ok).toBe(false)
      s = again.state
      expect(awardMove(s, 'x', 1, [cleared([0])]).ok).toBe(false)
      expect(s.stars).toBe(before)
    })

    it('BİLİNEN SINIRLAMA: etkin oyunun kimliği yeni oyunda tekrar kullanılırsa aynı oyun sayılır; ilk hamleler ödül almaz', () => {
      let s = ok(awardMove(started('same'), 'same', 30, [cleared([0])]))
      s = ok(startGame(s, 'same', 'klasik'))
      // Arayüz yeni oyunda 1'den saymaya başlar: 1…30 eski sayılır.
      expect(awardMove(s, 'same', 1, [cleared([0])]).ok).toBe(false)
      expect(awardMove(s, 'same', 30, [cleared([0])]).ok).toBe(false)
      expect(awardMove(s, 'same', 31, [cleared([0])]).ok).toBe(true)
    })

    it('BİLİNEN SINIRLAMA: son 20 oyundan eski bir kimlik yeniden kabul edilir (kimlikler rastgele olmalı)', () => {
      let s = initialEconomy()
      for (let i = 0; i <= HISTORY_LIMIT; i++) s = ok(finishGame(ok(startGame(s, `g${i}`, 'klasik')), `g${i}`, 0, null))
      expect(startGame(s, 'g0', 'klasik').ok).toBe(true)
      expect(startGame(s, `g${HISTORY_LIMIT}`, 'klasik').ok).toBe(false)
    })
  })

  describe('yarıda bırakılan oyun', () => {
    it('bildirilmiş satın alınmış kullanım düşülmüş kalır; bırakılan oyun sonradan bitirilemez', () => {
      let s = ok(purchase(rich(100), 'cekic', 'p'))
      s = ok(startGame(s, 'a', 'eglence', s.inventory))
      s = ok(syncUsage(s, 'a', { free: { cekic: 0, yenile: 1, dondur: 2 }, inventory: NO_JOKERS }))
      s = ok(startGame(s, 'b', 'eglence', s.inventory))
      expect(s.inventory.cekic).toBe(0)
      expect(s.totals.gamesAbandoned).toBe(1)
      expect(finishGame(s, 'a', 900, null).ok).toBe(false)
    })

    it('BİLİNEN SINIRLAMA: joker kullanıldı ama bildirilmeden sayfa kapandıysa satın alınmış hak düşmez', () => {
      let s = ok(purchase(rich(100), 'cekic', 'p'))
      s = ok(startGame(s, 'a', 'eglence', s.inventory))
      // syncUsage çağrılamadan oyun kayboldu.
      s = ok(startGame(s, 'b', 'eglence', s.inventory))
      expect(s.inventory.cekic).toBe(1)
    })
  })

  describe('satın alma sırasında sekme yenileme', () => {
    it('yazma olmadan yenilendi: ne yıldız düşer ne joker eklenir', () => {
      const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(50)) })
      // Satın alma çağrısı yazmaya ulaşmadan sayfa kapandı → depoda hiçbir şey değişmedi.
      const reloaded = createEconomyStore(st).load().state
      expect(reloaded.stars).toBe(50)
      expect(reloaded.inventory.cekic).toBe(0)
    })

    it('yazmadan sonra yenilendi: ikisi birlikte kalıcı; aynı istek yeniden gönderilirse ikinci kez alınmaz', () => {
      const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(50)) })
      expect(createEconomyStore(st).purchase('cekic', 'tap-7').ok).toBe(true)
      const after = createEconomyStore(st)
      expect(after.load().state.stars).toBe(25)
      expect(after.load().state.inventory.cekic).toBe(1)
      const again = after.purchase('cekic', 'tap-7')
      expect(again.ok).toBe(false)
      if (!again.ok) expect(again.reason).toBe('duplicatePurchase')
      expect(createEconomyStore(st).load().state.stars).toBe(25)
    })

    it('yazma başarısız (kota): alım yalnızca bellekte; yenilemede ikisi birlikte geri döner, yarım kalmaz', () => {
      const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(50)) })
      const failing = { getItem: st.getItem, setItem: () => { throw new Error('QuotaExceededError') } }
      const r = createEconomyStore(failing).purchase('yenile', 'p')
      expect(r.ok && r.persisted).toBe(false)
      const reloaded = createEconomyStore(st).load().state
      expect(reloaded.stars).toBe(50)
      expect(reloaded.inventory.yenile).toBe(0)
    })
  })

  describe('iki sekme', () => {
    it('sırayla yapılan işlemler birbirini silmez: bir sekmenin kazancı ötekinin alımıyla kaybolmaz', () => {
      const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(rich(40)) })
      const a = createEconomyStore(st)
      const b = createEconomyStore(st)
      a.startGame('ga', 'klasik')
      a.awardMove('ga', 1, [cleared([0, 1, 2])])
      expect(b.purchase('yenile', 'x').ok).toBe(true)
      a.awardMove('ga', 2, [cleared([0])])
      const s = createEconomyStore(st).load().state
      expect(s.stars).toBe(40 + 10 - 40 + 2)
      expect(s.inventory.yenile).toBe(1)
    })

    it('BİLİNEN SINIRLAMA: ikinci sekmede yeni oyun açılınca birinci sekmenin oyunu yıldız kazanamaz', () => {
      const st = memoryStorage()
      const a = createEconomyStore(st)
      const b = createEconomyStore(st)
      a.startGame('ga', 'klasik')
      b.startGame('gb', 'klasik')
      const r = a.awardMove('ga', 1, [cleared([0])])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('wrongGame')
      expect(a.finishGame('ga', 800, null).ok).toBe(false)
    })

    it('BİLİNEN SINIRLAMA: aynı satın alınmış joker iki sekmede birden kullanılabilir (envanter bir kez düşer)', () => {
      const st = memoryStorage({ [ECONOMY_KEY]: serializeEconomy(ok(purchase(rich(25), 'cekic', 'p'))) })
      const a = createEconomyStore(st)
      const b = createEconomyStore(st)
      const one = { cekic: 1, yenile: 0, dondur: 0 }
      a.startGame('ga', 'eglence', one)
      b.startGame('gb', 'eglence', one)
      const spent = { free: { cekic: 0, yenile: 1, dondur: 2 }, inventory: NO_JOKERS }
      expect(b.syncUsage('gb', spent).ok).toBe(true)
      expect(a.syncUsage('ga', spent).ok).toBe(false)
      expect(createEconomyStore(st).load().state.inventory.cekic).toBe(0)
    })
  })
})
