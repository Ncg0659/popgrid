import { describe, expect, it } from 'vitest'
import { awardMove, finishGame, initialEconomy, purchase, startGame, type EconomyState } from '../src/economy/ledger'
import {
  CAP_TEXT,
  FREE_RIGHTS_NOTE,
  PURCHASE_GUARD_MS,
  createPurchaseGuard,
  economyBanner,
  finishedGameStars,
  fmtStarsShort,
  purchasedUsedInGame,
  recordCategory,
  recordView,
  purchaseMessage,
  reachedCapNow,
  shopBlockedReason,
  shopItems,
} from '../src/ui/economyUi'
import { DEFAULT_CONFIG, applyJoker, newGame, play, type GameEvent, type GameState } from '../src/engine'
import { greedyBot } from '../scripts/bot'

const rich = (stars: number): EconomyState => ({ ...initialEconomy(), stars })
const cleared = (n: number): GameEvent => ({ type: 'cleared', rows: Array.from({ length: n }, (_, i) => i), cols: [], cells: [] })
const ok = (r: { ok: boolean; state: EconomyState }) => {
  expect(r.ok).toBe(true)
  return r.state
}

describe('mağaza görünümü', () => {
  it('fiyatlar 25 / 40 / 20, sahip olunan adet ve bakiye yetiyor mu', () => {
    const s = { ...rich(30), inventory: { cekic: 2, yenile: 0, dondur: 5 } }
    const items = shopItems(s, 'mine', true)
    expect(items.map((i) => [i.kind, i.price, i.owned, i.affordable, i.enabled])).toEqual([
      ['cekic', 25, 2, true, true],
      ['yenile', 40, 0, false, false],
      ['dondur', 20, 5, true, true],
    ])
    expect(items[1]!.label).toContain('yetersiz')
    expect(items.every((i) => i.description.length > 10)).toBe(true)
  })

  it('başka sekme, eski sürüm kaydı ya da kayıt hatasında satın alma düğmeleri kapalı ve nedeni yazılı', () => {
    for (const [status, persistent] of [['other', true], ['readonly', true], ['mine', false]] as const) {
      expect(shopItems(rich(999), status, persistent).every((i) => !i.enabled)).toBe(true)
      const reason = shopBlockedReason(status, persistent)
      expect(typeof reason === 'string' && reason.length > 0).toBe(true)
    }
    expect(shopBlockedReason('mine', true)).toBe(null)
  })

  it('ücretsiz haklar notu 1 / 1 / 2 ve "bir sonraki Eğlence oyunu" bilgisini içerir', () => {
    expect(FREE_RIGHTS_NOTE).toContain('Çekiç 1, Yenile 1, Döndür 2')
    expect(FREE_RIGHTS_NOTE).toContain('bir sonraki Eğlence oyununda')
  })

  it('satın alma mesajları: yalnızca başarıda "alındı"; başarısızlıkta kayıp olmadığı söylenir', () => {
    // Aşama 7.2 R3: başarı mesajı jokerin bir sonraki Eğlence oyununda kullanılacağını söyler.
    expect(purchaseMessage('cekic', { ok: true })).toBe('Çekiç alındı! Bir sonraki Eğlence oyununda kullanabilirsin.')
    expect(purchaseMessage('yenile', { ok: false, reason: 'insufficientStars' })).toBe('Yeterli yıldızın yok.')
    expect(purchaseMessage('yenile', { ok: false, reason: 'storageError' })).toContain('değişmedi')
    expect(purchaseMessage('yenile', { ok: false, reason: 'otherTab' })).toContain('başka bir sekmede')
  })
})

describe('çift dokunuş koruması', () => {
  it('başarılı alımdan sonra kısa süre yeni istek yok; süre bitince yeni kimlik', () => {
    let n = 0
    const g = createPurchaseGuard(() => `id${++n}`)
    const a = g.request(1000)
    expect(a).toBe('id1')
    g.settle(1000, true)
    expect(g.request(1000 + PURCHASE_GUARD_MS - 1)).toBe(null)
    expect(g.request(1000 + PURCHASE_GUARD_MS)).toBe('id2')
  })

  it('aynı karede iki dokunuş (alım bitmeden) aynı kimliği alır; defter ikincisini reddeder', () => {
    let n = 0
    const g = createPurchaseGuard(() => `id${++n}`)
    const first = g.request(5)!
    const second = g.request(5)!
    expect(second).toBe(first)
    let s = ok(purchase(rich(100), 'cekic', first))
    const dup = purchase(s, 'cekic', second)
    expect(dup.ok).toBe(false)
    s = dup.state
    expect(s.stars).toBe(75)
    expect(s.inventory.cekic).toBe(1)
  })

  it('başarısız alımdan sonra (ör. yetersiz) bekleme yok, yeni kimlik verilir', () => {
    let n = 0
    const g = createPurchaseGuard(() => `id${++n}`)
    g.request(0)
    g.settle(0, false)
    expect(g.request(1)).toBe('id2')
  })
})

describe('tavan bilgisi ve oyun sonu özeti', () => {
  it('Eğlence: tavana ulaşılan hamlede bir kez "sınır" bilgisi; sonra tekrar etmez', () => {
    let s = ok(startGame(initialEconomy(), 'f', 'eglence'))
    for (let m = 1; m <= 29; m++) s = ok(awardMove(s, 'f', m, [cleared(3)]))
    const hit = ok(awardMove(s, 'f', 30, [cleared(3)]))
    expect(reachedCapNow(s, hit, 'f')).toBe(true)
    const after = ok(awardMove(hit, 'f', 31, [cleared(3)]))
    expect(reachedCapNow(hit, after, 'f')).toBe(false)
    expect(CAP_TEXT).toContain('300')
    expect(CAP_TEXT).toContain('sürüyor')
  })

  it('tavana oyun sonu ödülüyle ulaşılırsa da bilgi verilir; Klasik\'te hiç verilmez', () => {
    let s = ok(startGame(initialEconomy(), 'f', 'eglence'))
    s = ok(awardMove(s, 'f', 1, [cleared(1)]))
    const end = ok(finishGame(s, 'f', 99_999, null))
    expect(reachedCapNow(s, end, 'f')).toBe(true)
    expect(finishedGameStars(end, 'f')).toEqual({ earned: 300, capped: true, usedPurchased: false })

    let k = ok(startGame(initialEconomy(), 'k', 'klasik'))
    for (let m = 1; m <= 40; m++) {
      const next = ok(awardMove(k, 'k', m, [cleared(3)]))
      expect(reachedCapNow(k, next, 'k')).toBe(false)
      k = next
    }
    const kEnd = ok(finishGame(k, 'k', 1_000, null))
    expect(finishedGameStars(kEnd, 'k')).toEqual({ earned: 450, capped: false, usedPurchased: false })
  })

  it('bilinmeyen oyunun özeti yok', () => {
    expect(finishedGameStars(initialEconomy(), 'yok')).toBe(null)
  })
})

describe('sahiplik ve kayıt uyarısı', () => {
  it('başka sekme: oyun sürer, yıldız ve satın alınmış joker yok; devralma düğmesi var', () => {
    const b = economyBanner('other', true)!
    expect(b.text).toContain('başka bir sekmede')
    expect(b.text).toContain('oyun sürer')
    expect(b.canTakeOver).toBe(true)
  })

  it('kayıt hatası ve eski sürüm kaydı açıklanır; her şey yolundaysa uyarı yok', () => {
    expect(economyBanner('mine', false)!.text).toContain('Kayıt yapılamıyor')
    expect(economyBanner('readonly', true)!.canTakeOver).toBe(false)
    expect(economyBanner('mine', true)).toBe(null)
  })
})

describe('kısa yıldız yazımı (dar düğme)', () => {
  it('9.999\'a kadar tam, sonra bin ve milyon kısaltması (yuvarlamadan, aşağı)', () => {
    expect([0, 7, 1234, 9999, 10_000, 12_345, 999_999, 1_250_000].map(fmtStarsShort)).toEqual([
      '0',
      '7',
      '1.234',
      '9.999',
      '10B',
      '12,3B',
      '999,9B',
      '1,2Mn',
    ])
  })
})

describe('rekor kategorileri (R1)', () => {
  const inv = { cekic: 1, yenile: 0, dondur: 0 }
  /** Önce ücretsiz, sonra satın alınmış Çekiç kullanan gerçek Eğlence oyunu. */
  function hammers(): { afterFree: GameState; afterBought: GameState } {
    let s = newGame(5, DEFAULT_CONFIG, { mode: 'eglence', inventory: inv })
    while (s.board.filter((c) => c !== 0).length < 2) {
      const r = play(s, greedyBot(s)!)
      if (!r.ok) throw new Error(r.reason)
      s = r.state
    }
    const hit = (g: GameState) => {
      const r = applyJoker(g, { type: 'cekic', cell: g.board.findIndex((c) => c !== 0) })
      if (!r.ok) throw new Error(r.reason)
      return r.state
    }
    const afterFree = hit(s)
    return { afterFree, afterBought: hit(afterFree) }
  }

  it('ücretsiz joker kullanımı normal Eğlence kategorisinde kalır; satın alınmış kullanım ayrı kategoriye geçirir', () => {
    const { afterFree, afterBought } = hammers()
    expect(afterFree.jokers!.free.cekic).toBe(0)
    expect(purchasedUsedInGame(afterFree, inv)).toBe(false)
    expect(recordCategory('eglence', purchasedUsedInGame(afterFree, inv))).toBe('eglence')
    expect(purchasedUsedInGame(afterBought, inv)).toBe(true)
    expect(recordCategory('eglence', purchasedUsedInGame(afterBought, inv))).toBe('eglenceSatin')
  })

  it('Klasik ve satın alınmış joker getirilmeyen oyun her zaman kendi kategorisinde', () => {
    expect(purchasedUsedInGame(newGame(3), inv)).toBe(false)
    expect(recordCategory('klasik', true)).toBe('klasik')
    const free = newGame(9, DEFAULT_CONFIG, { mode: 'eglence' })
    const r = applyJoker(free, { type: 'yenile' })
    expect(r.ok && purchasedUsedInGame(r.state, { cekic: 0, yenile: 0, dondur: 0 })).toBe(false)
  })

  it('yeni rekor bildirimi yalnızca kendi kategorisinin başlangıç rekoruna göre', () => {
    // Normal Eğlence rekoru 157 (eski oyuncu), satın alınmışlı rekor 900.
    expect(recordView('eglence', 200, 157, 200).line).toBe('Yeni rekor!')
    expect(recordView('eglenceSatin', 200, 900, 900)).toMatchObject({ isNew: false, best: 900, line: 'Satın alınmış jokerli rekor: 900' })
    expect(recordView('eglenceSatin', 1200, 900, 1200)).toMatchObject({ isNew: true, line: 'Yeni satın alınmış jokerli rekor!' })
    // Satın alınmışlı rekor yokken (0) ilk oyun yeni rekordur; normal rekor etkilenmez.
    expect(recordView('eglenceSatin', 50, 0, 50).isNew).toBe(true)
    expect(recordView('eglence', 100, 157, 157)).toMatchObject({ isNew: false, line: 'Eğlence rekoru: 157' })
    expect(recordView('klasik', 0, 0, 0).isNew).toBe(false)
  })
})
