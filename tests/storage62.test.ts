import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, NO_JOKERS, applyJoker, newGame } from '../src/engine'
import { INVENTORY_KEY, createInventoryStore, spendInventoryFor } from '../src/storage/inventory'
import { MODE_KEY, createModeStore } from '../src/storage/mode'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

const broken = {
  getItem: () => {
    throw new Error('kapalı')
  },
  setItem: () => {
    throw new Error('kapalı')
  },
}

describe('mod tercihi', () => {
  it('varsayılan Klasik; seçilen mod kaydedilir ve geri okunur', () => {
    const st = memoryStorage()
    const store = createModeStore(st)
    expect(store.load()).toBe('klasik')
    store.save('eglence')
    expect(st.data.get(MODE_KEY)).toBe('eglence')
    expect(createModeStore(st).load()).toBe('eglence')
  })

  it('bozuk değer Klasik sayılır; depolama kapalıysa oturumda bellekte kalır', () => {
    expect(createModeStore(memoryStorage({ [MODE_KEY]: 'xyz' })).load()).toBe('klasik')
    const store = createModeStore(broken)
    expect(store.load()).toBe('klasik')
    expect(() => store.save('eglence')).not.toThrow()
    expect(store.load()).toBe('eglence')
    expect(createModeStore(null).load()).toBe('klasik')
  })
})

describe('kalıcı envanter', () => {
  it('kayıt yoksa ya da bozuksa 0; ücretsiz haklar envantere yazılmaz', () => {
    expect(createInventoryStore(memoryStorage()).load()).toEqual(NO_JOKERS)
    expect(createInventoryStore(memoryStorage({ [INVENTORY_KEY]: '{bozuk' })).load()).toEqual(NO_JOKERS)
    expect(createInventoryStore(memoryStorage({ [INVENTORY_KEY]: '{"cekic":-3}' })).load()).toEqual(NO_JOKERS)
    // Ücretsiz hak harcamak envantere dokunmaz.
    const st = memoryStorage()
    const store = createInventoryStore(st)
    const g = newGame(1, DEFAULT_CONFIG, { mode: 'eglence' })
    const r = applyJoker(g, { type: 'yenile' })
    if (!r.ok) throw new Error('beklenmedik')
    expect(spendInventoryFor(r.events, store)).toBe(0)
    expect(st.data.has(INVENTORY_KEY)).toBe(false)
  })

  it('envanterden harcanan hak olay başına tam bir kez düşülür', () => {
    const st = memoryStorage({ [INVENTORY_KEY]: JSON.stringify({ cekic: 0, yenile: 2, dondur: 0 }) })
    const store = createInventoryStore(st)
    const g = newGame(2, DEFAULT_CONFIG, { mode: 'eglence', freeJokers: NO_JOKERS, inventory: store.load() })
    const r = applyJoker(g, { type: 'yenile' })
    if (!r.ok) throw new Error('beklenmedik')
    expect(spendInventoryFor(r.events, store)).toBe(1)
    expect(JSON.parse(st.data.get(INVENTORY_KEY)!)).toEqual({ cekic: 0, yenile: 1, dondur: 0 })
    // Oyun durumu da aynı sayıyı söyler: kayıt ve oyun tutarlı.
    expect(r.state.jokers!.inventory.yenile).toBe(1)
    // Aynı eski durumdan ikinci deneme arayüzde yapılmaz (useGame son durumu kullanır);
    // yeni durumla ikinci kullanım ikinci hakkı düşer.
    const r2 = applyJoker(r.state, { type: 'yenile' })
    if (!r2.ok) throw new Error('beklenmedik')
    spendInventoryFor(r2.events, store)
    expect(JSON.parse(st.data.get(INVENTORY_KEY)!)).toEqual(NO_JOKERS)
    expect(applyJoker(r2.state, { type: 'yenile' })).toMatchObject({ ok: false, reason: 'noCharge' })
  })

  it('0 altına inmez; depolama kapalıyken hata vermez', () => {
    const store = createInventoryStore(broken)
    expect(store.load()).toEqual(NO_JOKERS)
    expect(() => store.spend('cekic')).not.toThrow()
    expect(store.load()).toEqual(NO_JOKERS)
  })
})
