import { describe, expect, it } from 'vitest'
import { clearBasePoints, scoreMove } from '../src/engine/scoring'
import { HELP_SECTIONS, SCORE_EXAMPLES, TUTORIAL_CARDS, visibleSections, type HelpSection } from '../src/help/content'
import { TUTORIAL_KEY, createTutorialStore } from '../src/storage/tutorial'

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
    for (const word of ['joker', 'bomba', 'şanslı', 'yıldız', 'topluluk', 'arkadaş']) expect(all.includes(word)).toBe(false)
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
    const { storage } = memory()
    expect(createTutorialStore(storage).shouldAutoShow(0)).toBe(true)
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
