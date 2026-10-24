import { describe, expect, it } from 'vitest'
import { canPlaceAnywhere, emptyBoard, placeCells } from '../src/engine/board'
import { DEFAULT_CONFIG, SHARED_SEQUENCE_CONFIG, generateTriple, rescueChance } from '../src/engine/generator'
import { getShape } from '../src/engine/shapes'
import type { GeneratorConfig } from '../src/engine/types'

const ALWAYS: GeneratorConfig = { rescue: { enabled: true, startPercent: 100, endPercent: 100, rampScore: 1 } }
const NEVER: GeneratorConfig = { rescue: { enabled: true, startPercent: 0, endPercent: 0, rampScore: 1 } }

/** Yalnızca (7,7) hücresi boş tahta: sadece 1×1 sığar. */
const ONE_HOLE = placeCells(emptyBoard(), Array.from({ length: 63 }, (_, i) => i), 4)

describe('üçlü üretimi', () => {
  it('aynı girdiler aynı üçlüyü üretir', () => {
    const a = generateTriple(12345, 3, emptyBoard(), 100, DEFAULT_CONFIG)
    const b = generateTriple(12345, 3, emptyBoard(), 100, DEFAULT_CONFIG)
    expect(a).toEqual(b)
  })

  it('renkler 1–6 arasında, şekiller katalogda', () => {
    for (let t = 0; t < 200; t++) {
      for (const p of generateTriple(1, t, emptyBoard(), 0, DEFAULT_CONFIG).tray) {
        expect(p).not.toBe(null)
        if (!p) continue
        expect(p.color).toBeGreaterThanOrEqual(1)
        expect(p.color).toBeLessThanOrEqual(6)
        expect(() => getShape(p.shapeId)).not.toThrow()
      }
    }
  })

  it('altın dizi: seed 12345 ilk 10 üçlü (ortak sıra modu)', () => {
    const ids = Array.from({ length: 10 }, (_, t) =>
      generateTriple(12345, t, emptyBoard(), 0, SHARED_SEQUENCE_CONFIG).tray.map((p) => p?.shapeId).join(','),
    )
    expect(ids).toEqual(GOLDEN_TRIPLES_12345)
  })
})

describe('kurtarma şansı', () => {
  it('şans skorla doğrusal azalır ve tamsayıdır', () => {
    expect(rescueChance(DEFAULT_CONFIG, 0)).toBe(70)
    expect(rescueChance(DEFAULT_CONFIG, 1500)).toBe(48)
    expect(rescueChance(DEFAULT_CONFIG, 3000)).toBe(25)
    expect(rescueChance(DEFAULT_CONFIG, 99999)).toBe(25)
    expect(rescueChance(SHARED_SEQUENCE_CONFIG, 0)).toBe(0)
  })

  it('zar tutarsa ve hiçbir parça sığmıyorsa sığan bir parça verir', () => {
    let rescuedCount = 0
    for (let t = 0; t < 100; t++) {
      const r = generateTriple(99, t, ONE_HOLE, 0, ALWAYS)
      const fits = r.tray.some((p) => p && canPlaceAnywhere(ONE_HOLE, getShape(p.shapeId)))
      expect(fits).toBe(true)
      if (r.rescued) rescuedCount++
    }
    expect(rescuedCount).toBeGreaterThan(0)
  })

  it('şans %0 ise kurtarma hiç devreye girmez', () => {
    for (let t = 0; t < 100; t++) expect(generateTriple(99, t, ONE_HOLE, 0, NEVER).rescued).toBe(false)
  })

  it('kurtarma yalnızca ilgili parçayı değiştirir; diğer iki parça ham sıradakiyle aynıdır', () => {
    for (let t = 0; t < 50; t++) {
      const raw = generateTriple(99, t, ONE_HOLE, 0, NEVER).tray
      const res = generateTriple(99, t, ONE_HOLE, 0, ALWAYS)
      const diff = raw.filter((p, i) => p?.shapeId !== res.tray[i]?.shapeId).length
      expect(diff).toBeLessThanOrEqual(1)
    }
  })

  it('ortak sıra modunda parçalar tahtadan bağımsızdır (günlük yarışma)', () => {
    for (let t = 0; t < 50; t++) {
      const onEmpty = generateTriple(2026, t, emptyBoard(), 0, SHARED_SEQUENCE_CONFIG)
      const onFull = generateTriple(2026, t, ONE_HOLE, 5000, SHARED_SEQUENCE_CONFIG)
      expect(onFull).toEqual(onEmpty)
    }
  })
})

// GENERATOR_VERSION 1 ile üretilip sabitlendi. Değişirse sürümü artır.
const GOLDEN_TRIPLES_12345 = [
  'rect32,h5,h3',
  'h3,h2,j4-c',
  'v3,sq3,v3',
  'l4-c,s4-h,c3-bl',
  'c3-bl,v3,v2',
  'c3-tr,sq2,s4-v',
  'l4-b,h2,c5-br',
  'h4,j4-b,h2',
  'v3,rect32,v4',
  'c5-tr,v4,h3',
]
