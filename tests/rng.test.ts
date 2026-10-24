import { describe, expect, it } from 'vitest'
import { createRng, mixSeed, seedFromString } from '../src/engine/rng'

describe('rng', () => {
  it('aynı tohum aynı diziyi üretir', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    for (let i = 0; i < 1000; i++) expect(a.nextUint32()).toBe(b.nextUint32())
  })

  it('farklı tohum farklı dizi üretir', () => {
    const a = createRng(1)
    const b = createRng(2)
    const sa = Array.from({ length: 5 }, () => a.nextUint32())
    const sb = Array.from({ length: 5 }, () => b.nextUint32())
    expect(sa).not.toEqual(sb)
  })

  it('mulberry32 altın değerleri değişmez', () => {
    const rng = createRng(1)
    expect(Array.from({ length: 4 }, () => rng.nextUint32())).toEqual(GOLDEN_SEED1)
  })

  it('nextInt her zaman sınırların içindedir ve tüm değerleri üretir', () => {
    const rng = createRng(7)
    const seen = new Set<number>()
    for (let i = 0; i < 5000; i++) {
      const x = rng.nextInt(6)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(6)
      seen.add(x)
    }
    expect(seen.size).toBe(6)
  })

  it('nextInt geçersiz sınırı reddeder', () => {
    const rng = createRng(1)
    expect(() => rng.nextInt(0)).toThrow()
    expect(() => rng.nextInt(2.5)).toThrow()
  })

  it('mixSeed ve seedFromString belirlenimlidir', () => {
    expect(mixSeed(42, 3)).toBe(mixSeed(42, 3))
    expect(mixSeed(42, 3)).not.toBe(mixSeed(42, 4))
    expect(seedFromString('2026-10-24')).toBe(seedFromString('2026-10-24'))
    expect(seedFromString('2026-10-24')).not.toBe(seedFromString('2026-10-25'))
  })
})

// mulberry32(1) referans çıktısı (ilk değer / 2^32 = 0.6270739405881613). Değişirse oyun akışı değişmiş demektir.
const GOLDEN_SEED1 = [2693262067, 11749833, 2265367787, 4213581821]
