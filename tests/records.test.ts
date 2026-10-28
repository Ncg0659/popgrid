import { describe, expect, it } from 'vitest'
import { bestKey, loadBest, restoreBest, saveBest } from '../src/storage/records'

/** Test için basit bellek içi localStorage. */
function withFakeStorage(run: (data: Map<string, string>) => void): void {
  const data = new Map<string, string>()
  const g = globalThis as unknown as { window?: unknown }
  const previous = g.window
  g.window = {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  }
  try {
    run(data)
  } finally {
    g.window = previous
  }
}

describe('mod başına rekor', () => {
  it('Klasik eski anahtarı kullanır; mevcut rekor korunur', () => {
    expect(bestKey()).toBe('popgrid:v1:best')
    expect(bestKey('klasik')).toBe('popgrid:v1:best')
    withFakeStorage((data) => {
      data.set('popgrid:v1:best', '1234')
      expect(loadBest()).toBe(1234)
      expect(loadBest('klasik')).toBe(1234)
      expect(loadBest('eglence')).toBe(0)
    })
  })

  it('Eğlence rekoru ayrı saklanır ve Klasik rekoru değiştirmez', () => {
    withFakeStorage((data) => {
      data.set('popgrid:v1:best', '500')
      saveBest(900, 'eglence')
      expect(data.get('popgrid:v1:best')).toBe('500')
      expect(data.get(bestKey('eglence'))).toBe('900')
      expect(loadBest('eglence')).toBe(900)
      saveBest(700)
      expect(data.get('popgrid:v1:best')).toBe('700')
    })
  })
})

describe('Eğlence rekor kategorileri (Aşama 7.2 R1)', () => {
  it('satın alınmış joker kullanılınca oyun sırasında yazılan normal rekor başlangıç değerine döner; eski rekor korunur', () => {
    withFakeStorage((data) => {
      data.set('popgrid:v1:best', '353')
      data.set('popgrid:v1:best:eglence', '157')
      saveBest(400, 'eglence')
      restoreBest(157, 'eglence')
      expect(data.get('popgrid:v1:best:eglence')).toBe('157')
      expect(data.get('popgrid:v1:best')).toBe('353')
      expect(loadBest('eglence')).toBe(157)
    })
  })

  it('başlangıçta rekor yoksa anahtar eski hâline (yok) döner', () => {
    withFakeStorage((data) => {
      saveBest(80, 'eglence')
      restoreBest(0, 'eglence')
      expect(data.has('popgrid:v1:best:eglence')).toBe(false)
      expect(loadBest('eglence')).toBe(0)
    })
  })
})
