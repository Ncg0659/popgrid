import { describe, expect, it } from 'vitest'
import { DEFAULT_FREE_JOKERS } from '../src/engine'
import { HELP_SECTIONS, JOKER_INTRO, TUTORIAL_CARDS, visibleSections } from '../src/help/content'
import { JOKER_INTRO_KEY, createJokerIntroStore } from '../src/storage/jokerIntro'

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return { m, storage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }
}

describe('joker tanıtımı kaydı', () => {
  it('yalnızca Eğlence Modu’na ilk girişte kendiliğinden gösterilir; Klasik hiç etkilenmez', () => {
    const { storage } = memory()
    const store = createJokerIntroStore(storage)
    expect(store.shouldAutoShow('klasik')).toBe(false)
    expect(store.shouldAutoShow('eglence')).toBe(true)
  })

  it('görüldükten sonra (yeniden açılışta da) kendiliğinden gösterilmez; diğer kayıtlara dokunmaz', () => {
    const { m, storage } = memory({ 'popgrid:v1:tutorial': 'done', 'popgrid:v1:best': '353', 'popgrid:v1:mode': 'eglence' })
    createJokerIntroStore(storage).markDone()
    expect(m.get(JOKER_INTRO_KEY)).toBe('done')
    expect(createJokerIntroStore(storage).shouldAutoShow('eglence')).toBe(false)
    expect(m.get('popgrid:v1:tutorial')).toBe('done')
    expect(m.get('popgrid:v1:best')).toBe('353')
    expect(m.get('popgrid:v1:mode')).toBe('eglence')
  })

  it('depolama kapalıysa hata vermez; aynı oturumda tekrar açılmaz', () => {
    const broken = {
      getItem: () => {
        throw new Error('kapalı')
      },
      setItem: () => {
        throw new Error('kapalı')
      },
    }
    const store = createJokerIntroStore(broken)
    expect(store.shouldAutoShow('eglence')).toBe(true)
    expect(() => store.markDone()).not.toThrow()
    expect(store.shouldAutoShow('eglence')).toBe(false)
    expect(createJokerIntroStore(null).shouldAutoShow('eglence')).toBe(true)
  })
})

describe('joker tanıtımı ve rehber içeriği', () => {
  it('kart üç jokeri ve oyunun gerçek başlangıç haklarını anlatır (1 Çekiç, 1 Yenile, 2 Döndür)', () => {
    expect(JOKER_INTRO.title).toBe('Jokerlerle tanış!')
    expect(JOKER_INTRO.items.map((i) => [i.kind, i.rights])).toEqual([
      ['cekic', DEFAULT_FREE_JOKERS.cekic],
      ['yenile', DEFAULT_FREE_JOKERS.yenile],
      ['dondur', DEFAULT_FREE_JOKERS.dondur],
    ])
    expect(JOKER_INTRO.items.map((i) => i.text)).toEqual([
      'Bir dolu bloğu siler.',
      'Kullanılmamış parçaları yeniler.',
      'Bir parçayı döndürür; aynı parça için sonraki dönüşler ücretsizdir.',
    ])
    expect(JOKER_INTRO.rights).toContain('1 Çekiç, 1 Yenile ve 2 Döndür')
    expect(JOKER_INTRO.button).toBe('Hadi oyna!')
  })

  it('yardımda Jokerler bölümü görünür ve istenen her konuyu kapsar', () => {
    const section = visibleSections().find((s) => s.id === 'jokerler')
    expect(section !== undefined).toBe(true)
    const text = JSON.stringify(section)
    for (const phrase of [
      'Klasik Mod jokersizdir',
      'Çekiç (1 hak)',
      'Yenile (1 hak)',
      'Döndür (2 hak)',
      'sonraki dönüşler ücretsizdir',
      'puan vermez ve komboyu bozmaz',
      'her yeni Eğlence oyununda yeniden verilir',
      'rekorları ayrı tutulur',
      'oyun bitmez',
    ])
      expect(text.includes(phrase)).toBe(true)
    expect(section!.blocks.some((b) => b.kind === 'replayJokerIntro')).toBe(true)
  })

  it('SSS mod farkını, hakların yenilenmesini ve puanı yanıtlar; eğitim ve tekrar izleme düğmesi korunur', () => {
    const faq = HELP_SECTIONS.find((s) => s.id === 'sss')!
    const qs = JSON.stringify(faq)
    for (const q of ['Klasik ve Eğlence Modu arasındaki fark nedir?', 'Joker hakları sonraki oyuna geçer mi?', 'Jokerler puan verir mi?'])
      expect(qs.includes(q)).toBe(true)
    expect(faq.blocks.some((b) => b.kind === 'replayTutorial')).toBe(true)
    expect(TUTORIAL_CARDS).toHaveLength(4)
  })
})
