import { describe, expect, it } from 'vitest'
import { clearBasePoints, scoreMove } from '../src/engine/scoring'
import { HELP_SECTIONS, SCORE_EXAMPLES, STAR_RULES_TEXT, TUTORIAL_CARDS, visibleSections, type HelpSection } from '../src/help/content'
import { PRIOR_USE_KEYS, TUTORIAL_KEY, createTutorialStore, hasPriorUse } from '../src/storage/tutorial'
import { DEFAULT_FREE_JOKERS } from '../src/engine'
import { FUN_STAR_CAP, JOKER_PRICES, LINE_CLEAR_STARS, STARS_PER_HUNDRED_POINTS } from '../src/economy/rules'
import { initialEconomy } from '../src/economy/ledger'
import { serializeEconomy } from '../src/economy/schema'

describe('yardım içeriği', () => {
  it('puan tablosu oyun motorundaki puanlarla aynı (1 hat 10, 2 hat 40, 3 hat 90, 4 hat 160)', () => {
    const table = HELP_SECTIONS.flatMap((s) => s.blocks).find((b) => b.kind === 'scoreTable')
    expect(table && table.kind === 'scoreTable').toBe(true)
    if (table?.kind !== 'scoreTable') return
    expect(table.rows.map((r) => r.points)).toEqual([10, 40, 90, 160])
    for (const r of table.rows) expect(r.points).toBe(clearBasePoints(r.lines))
  })

  it('puan örnekleri motordan hesaplanır ve elle doğrulanan değerlerle aynıdır', () => {
    expect(SCORE_EXAMPLES).toEqual({ placeOnly: 4, oneLine: 13, twoLines: 43, comboSecond: 23 })
    expect(SCORE_EXAMPLES.comboSecond).toBe(scoreMove(3, 1, 1).breakdown.total)
  })

  it('örnek metinleri hesaplanan puanları içerir', () => {
    const text = JSON.stringify(HELP_SECTIONS.find((s) => s.id === 'puan'))
    for (const n of [4, 13, 43, 23]) expect(text.includes(`${n} puan`)).toBe(true)
  })

  it('oyunda olmayan ("planlanan") bölümler gösterilmez', () => {
    const planned: HelpSection = { id: 'deneme', title: 'Gelecek özellik', availability: 'planlanan', blocks: [] }
    const shown = visibleSections([...HELP_SECTIONS, planned])
    expect(shown.some((s) => s.id === 'deneme')).toBe(false)
    expect(shown).toHaveLength(HELP_SECTIONS.length)
  })

  it('şu an yayındaki içerikte gelecek özelliklerden söz edilmez', () => {
    const all = JSON.stringify(visibleSections()).toLocaleLowerCase('tr-TR')
    // Jokerler Aşama 6.2 ile, yıldız ekonomisi ve mağaza Aşama 7.1–7.3 ile oyuna girdi; artık anlatılır (Aşama 7.4).
    for (const word of ['bomba', 'şanslı', 'topluluk', 'arkadaş']) expect(all.includes(word)).toBe(false)
  })

  it('"döndürülemez" bilgisi Klasik Mod’a özel', () => {
    const all = JSON.stringify(visibleSections())
    expect(all.includes('Parçalar döndürülemez')).toBe(false)
    expect(all.includes('Klasik Mod’da parçalar döndürülemez')).toBe(true)
  })

  it('bütün bölümlerin başlığı ve içeriği var; kimlikler benzersiz', () => {
    expect(new Set(HELP_SECTIONS.map((s) => s.id)).size).toBe(HELP_SECTIONS.length)
    for (const s of HELP_SECTIONS) {
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.blocks.length).toBeGreaterThan(0)
    }
  })

  it('eğitim 4 karttan oluşur ve her kartın sahnesi farklıdır', () => {
    expect(TUTORIAL_CARDS).toHaveLength(4)
    expect(new Set(TUTORIAL_CARDS.map((c) => c.scene)).size).toBe(4)
  })
})

describe('eğitim kaydı', () => {
  const memory = () => {
    const m = new Map<string, string>([
      ['popgrid:v1:best', '474'],
      ['popgrid:v1:sound', 'off'],
    ])
    return { m, storage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }
  }

  it('yeni oyuncuya (rekor 0, kayıt yok) kendiliğinden gösterilir', () => {
    // Aşama 7.4: yalnızca bu cihazda hiç oynamamış oyuncu "yeni" sayılır (ses tercihi iz sayılmaz).
    const m = new Map<string, string>([['popgrid:v1:sound', 'off']])
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    expect(createTutorialStore(storage).shouldAutoShow(0)).toBe(true)
  })

  it('Aşama 7.4: başka moddaki rekor da oyuncuyu "mevcut" yapar (bu modun rekoru 0 olsa bile)', () => {
    const { storage } = memory() // Klasik rekor 474
    expect(createTutorialStore(storage).shouldAutoShow(0)).toBe(false)
  })

  it('rekoru olan oyuncuya kendiliğinden gösterilmez', () => {
    const { storage } = memory()
    expect(createTutorialStore(storage).shouldAutoShow(474)).toBe(false)
  })

  it('tamamlanınca/atlanınca ayrı anahtarla kaydedilir; rekor ve ses kayıtlarına dokunmaz', () => {
    const { m, storage } = memory()
    const store = createTutorialStore(storage)
    store.markDone()
    expect(m.get(TUTORIAL_KEY)).toBe('done')
    expect(m.get('popgrid:v1:best')).toBe('474')
    expect(m.get('popgrid:v1:sound')).toBe('off')
    expect(createTutorialStore(storage).shouldAutoShow(0)).toBe(false)
  })

  it('depolama kapalıysa hata vermez; bu oturumda tekrar gösterilmez', () => {
    const broken = {
      getItem: () => {
        throw new Error('kapalı')
      },
      setItem: () => {
        throw new Error('kapalı')
      },
    }
    const store = createTutorialStore(broken)
    expect(store.shouldAutoShow(0)).toBe(true)
    store.markDone()
    expect(store.shouldAutoShow(0)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Aşama 7.4 — Nasıl Oynanır? içeriği ve ilk eğitim
// ---------------------------------------------------------------------------

const text = (id: string) => JSON.stringify(HELP_SECTIONS.find((s) => s.id === id) ?? null)
const kv = (entries: Array<[string, string]>) => {
  const m = new Map(entries)
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('Aşama 7.4: Nasıl Oynanır? kurallarla birebir', () => {
  it('bölüm sırası: temel kurallar, modlar, yerleştirme, temizleme, puan, yıldızlar, bitiş, jokerler, mağaza, düğmeler, SSS', () => {
    expect(visibleSections().map((s) => s.id)).toEqual(['kurallar', 'modlar', 'yerlestirme', 'temizleme', 'puan', 'yildizlar', 'bitis', 'jokerler', 'magaza', 'dugmeler', 'sss'])
  })

  it('modlar: Klasik jokersiz; Eğlence ücretsiz haklar motordan (1 / 1 / 2)', () => {
    const t = text('modlar')
    expect(t).toContain('Klasik: jokersiz')
    expect(t).toContain(`${DEFAULT_FREE_JOKERS.cekic} Çekiç, ${DEFAULT_FREE_JOKERS.yenile} Yenile ve ${DEFAULT_FREE_JOKERS.dondur} Döndür`)
    expect([DEFAULT_FREE_JOKERS.cekic, DEFAULT_FREE_JOKERS.yenile, DEFAULT_FREE_JOKERS.dondur]).toEqual([1, 1, 2])
  })

  it('yıldızlar: 2 / 5 / 10, her 100 puana 5, Eğlence tavanı 300, Klasik sınırsız (ekonomi kurallarından)', () => {
    expect([LINE_CLEAR_STARS.one, LINE_CLEAR_STARS.two, LINE_CLEAR_STARS.threePlus, STARS_PER_HUNDRED_POINTS, FUN_STAR_CAP]).toEqual([2, 5, 10, 5, 300])
    const t = text('yildizlar')
    expect(t).toContain('1 hat 2, 2 hat 5, 3 ve daha fazla hat 10 yıldız')
    expect(t).toContain('her 100 puan için 5 yıldız')
    expect(t).toContain('en çok 300 yıldız')
    expect(t).toContain('Klasik’te sınır yoktur')
  })

  it('mağaza: fiyatlar 25 / 40 / 20; aynı Eğlence oyununda kullanım; önce ücretsiz haklar', () => {
    expect([JOKER_PRICES.cekic, JOKER_PRICES.yenile, JOKER_PRICES.dondur]).toEqual([25, 40, 20])
    const t = text('magaza')
    expect(t).toContain(STAR_RULES_TEXT.prices)
    expect(t).toContain('Çekiç 25, Yenile 40, Döndür 20 yıldız')
    expect(t).toContain('hemen o oyuna eklenir')
    expect(t).toContain('Önce ücretsiz hakların harcanır')
  })

  it('jokerler: ücretsiz haklar geçmez, satın alınanlar saklanır; eski "haklar sonraki oyuna geçmez" ifadesi düzeltildi', () => {
    const t = text('jokerler')
    expect(t).toContain('kullanılmayan ücretsiz haklar sonraki oyuna geçmez')
    expect(t).toContain('Mağazadan aldığın jokerler saklanır')
    expect(t).toContain('Önce ücretsiz haklar harcanır')
    expect(JSON.stringify(visibleSections())).not.toContain('Hayır. Haklar her yeni Eğlence oyununda yeniden verilir')
  })
})

describe('Aşama 7.4: ilk eğitim', () => {
  it('dört adım: yerleştir, temizle, yıldız kazan, modunu tanı; her adımın sahnesi farklı', () => {
    expect(TUTORIAL_CARDS.map((c) => c.id)).toEqual(['yerlestir', 'temizle', 'yildiz', 'mod'])
    expect(TUTORIAL_CARDS.map((c) => c.scene)).toEqual(['drag', 'clear', 'stars', 'modes'])
  })

  it('yıldız ve mod kartlarındaki sayılar kurallardan gelir', () => {
    expect(TUTORIAL_CARDS[2]!.text).toContain('1 hat 2, 2 hat 5, 3 ve daha fazla hat 10 yıldız')
    expect(TUTORIAL_CARDS[2]!.text).toContain('her 100 puan için 5 yıldız')
    expect(TUTORIAL_CARDS[3]!.text).toContain('1 Çekiç, 1 Yenile ve 2 Döndür')
    expect(TUTORIAL_CARDS[3]!.text).toContain('Klasik jokersizdir')
  })

  it('eğitim kartları kısa (her biri en çok 180 karakter)', () => {
    for (const c of TUTORIAL_CARDS) expect(c.text.length).toBeLessThanOrEqual(180)
  })
})

describe('Aşama 7.4: mevcut oyuncuya eğitim kendiliğinden açılmaz', () => {
  it('hiç iz yoksa ya da yalnızca açılışta oluşan boş yıldız kaydı varsa: yeni oyuncu', () => {
    expect(hasPriorUse(kv([]))).toBe(false)
    expect(hasPriorUse(kv([['popgrid:v1:sound', 'on'], ['popgrid:v1:mode', 'klasik'], [PRIOR_USE_KEYS.economy, serializeEconomy(initialEconomy())]]))).toBe(false)
    expect(createTutorialStore(kv([[PRIOR_USE_KEYS.economy, serializeEconomy(initialEconomy())]])).shouldAutoShow(0)).toBe(true)
  })

  it('Klasik ya da Eğlence rekoru, görülmüş joker tanıtımı, yıldız / biten oyun / satın alma varsa: mevcut oyuncu', () => {
    expect(hasPriorUse(kv([[PRIOR_USE_KEYS.best, '12']]))).toBe(true)
    expect(hasPriorUse(kv([[PRIOR_USE_KEYS.bestFun, '157']]))).toBe(true)
    expect(hasPriorUse(kv([[PRIOR_USE_KEYS.jokerIntro, 'done']]))).toBe(true)
    expect(hasPriorUse(kv([[PRIOR_USE_KEYS.economy, serializeEconomy({ ...initialEconomy(), stars: 3 })]]))).toBe(true)
    const played = { ...initialEconomy(), totals: { ...initialEconomy().totals, gamesFinished: 1 } }
    expect(hasPriorUse(kv([[PRIOR_USE_KEYS.economy, serializeEconomy(played)]]))).toBe(true)
    const spentAll = { ...initialEconomy(), totals: { ...initialEconomy().totals, earned: 25, spent: 25 } }
    expect(hasPriorUse(kv([[PRIOR_USE_KEYS.economy, serializeEconomy(spentAll)]]))).toBe(true)
  })

  it('bozuk yıldız kaydı: biri oynamış sayılır; depolama kapalıysa eski davranış (gösterilir)', () => {
    expect(hasPriorUse(kv([[PRIOR_USE_KEYS.economy, '{bozuk']]))).toBe(true)
    const broken = { getItem: () => { throw new Error('kapalı') }, setItem: () => { throw new Error('kapalı') } }
    expect(hasPriorUse(broken)).toBe(false)
  })

  it('kontrol hiçbir kaydı değiştirmez', () => {
    const m = new Map<string, string>([[PRIOR_USE_KEYS.best, '353'], [PRIOR_USE_KEYS.bestFun, '157']])
    const before = JSON.stringify([...m])
    const store = createTutorialStore({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) })
    store.shouldAutoShow(0)
    hasPriorUse({ getItem: (k: string) => m.get(k) ?? null })
    expect(JSON.stringify([...m])).toBe(before)
  })
})
