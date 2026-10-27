import { describe, expect, it } from 'vitest'
import { bestKey, loadBest, saveBest } from '../src/storage/records'

/** Test için basit bellek içi localStorage. */
function withFakeStorage(run: (data: Map<string, string>) => void): void {
  const data = new Map<string, string>()
  const g = globalThis as unknown as { window?: unknown }
  const previous = g.window
  g.window = {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
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
