import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ATMOSPHERE_FADE_MS,
  ATMOSPHERE_LEVELS,
  ATMOSPHERE_STOP_POSITIONS,
  atmosphereGradient,
  atmosphereIndex,
} from '../src/theme/atmosphere'

const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'theme', 'game.css'), 'utf8')
const SRC = readFileSync(join(import.meta.dirname, '..', 'src', 'theme', 'atmosphere.ts'), 'utf8')

/** WCAG göreli parlaklık ve kontrast oranı. */
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const cssVar = (name: string) => CSS.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))?.[1]

describe('Dinamik Atmosfer: seviye seçimi (yalnızca bu oyunun puanı)', () => {
  it('her eşikte doğru seviye', () => {
    const cases: [number, string][] = [
      [0, 'sakin'],
      [999, 'sakin'],
      [1000, 'isiniyor'],
      [2499, 'isiniyor'],
      [2500, 'yuksek'],
      [4999, 'yuksek'],
      [5000, 'zirve'],
      [123456, 'zirve'],
    ]
    for (const [score, id] of cases) expect(ATMOSPHERE_LEVELS[atmosphereIndex(score)]!.id).toBe(id)
  })

  it('geçersiz ya da negatif puan başlangıç seviyesidir', () => {
    expect(atmosphereIndex(-5)).toBe(0)
    expect(atmosphereIndex(Number.NaN)).toBe(0)
    expect(atmosphereIndex(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('yeni oyun (puan 0) başlangıç rengine döner; puan arttıkça seviye geri düşmez', () => {
    expect(atmosphereIndex(0)).toBe(0)
    let prev = 0
    for (let s = 0; s <= 8000; s += 7) {
      const i = atmosphereIndex(s)
      expect(i).toBeGreaterThanOrEqual(prev)
      prev = i
    }
    expect(prev).toBe(3)
  })

  it('tek yapılandırma: dört seviye, artan eşikler, ilk eşik 0, benzersiz adlar', () => {
    expect(ATMOSPHERE_LEVELS.map((l) => l.minScore)).toEqual([0, 1000, 2500, 5000])
    expect(new Set(ATMOSPHERE_LEVELS.map((l) => l.id)).size).toBe(ATMOSPHERE_LEVELS.length)
  })

  it('başka yapılandırma verilirse ona göre seçer (eşikler tek yerden yönetilir)', () => {
    const custom = [
      { ...ATMOSPHERE_LEVELS[0]!, minScore: 0 },
      { ...ATMOSPHERE_LEVELS[1]!, minScore: 10 },
    ]
    expect(atmosphereIndex(9, custom)).toBe(0)
    expect(atmosphereIndex(10, custom)).toBe(1)
  })

  it('modül saf: rekor, yıldız, depolama, DOM ya da zamanlayıcı okumaz', () => {
    for (const bad of [/localStorage/, /\bwindow\./, /\bdocument\./, /setTimeout|setInterval|requestAnimationFrame/, /from ['"]react/, /economy|best|stars/i]) {
      expect(SRC.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).not.toMatch(bad)
    }
  })
})

describe('Dinamik Atmosfer: görünüm', () => {
  it('ilk seviye mevcut arka planla birebir aynı (renkler ve durak konumları)', () => {
    const base = ['sky', 'sky-soft', 'sun', 'butter'].map(cssVar)
    expect(ATMOSPHERE_LEVELS[0]!.stops).toEqual(base)
    expect(CSS).toContain(
      'background: linear-gradient(180deg, var(--sky) 0%, var(--sky-soft) 24%, var(--sun) 58%, var(--butter) 100%);',
    )
    expect(ATMOSPHERE_STOP_POSITIONS).toEqual([0, 24, 58, 100])
    expect(atmosphereGradient(ATMOSPHERE_LEVELS[0]!)).toBe(
      'linear-gradient(180deg, #c6efff 0%, #e8f8ff 24%, #fff3cf 58%, #ffe3a6 100%)',
    )
  })

  it('yazılar okunaklı: ana ve ikincil yazı rengi her renk durağında yeterli kontrastta', () => {
    const ink = cssVar('ink')!
    const soft = cssVar('ink-soft')!
    for (const level of ATMOSPHERE_LEVELS) {
      for (const stop of level.stops) {
        expect(contrast(ink, stop)).toBeGreaterThanOrEqual(7)
        expect(contrast(soft, stop)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('pastel kalır: koyu ya da neon renk yok (her durak açık tonda)', () => {
    for (const level of ATMOSPHERE_LEVELS) for (const stop of level.stops) expect(luminance(stop)).toBeGreaterThan(0.6)
  })

  it('geçiş 800–1.200 ms; Hareketi Azalt açıkken geçiş kapalı', () => {
    expect(ATMOSPHERE_FADE_MS).toBeGreaterThanOrEqual(800)
    expect(ATMOSPHERE_FADE_MS).toBeLessThanOrEqual(1200)
    expect(CSS).toMatch(/\.atmos\[data-instant\] \.atmos-layer \{\s*transition: none;/)
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.atmos-layer \{\s*transition: none;/)
  })

  it('yalnızca opaklık canlandırılır (gradient canlandırılmaz) ve katmanlar dokunmayı engellemez', () => {
    const block = (sel: string) => CSS.slice(CSS.indexOf(`${sel} {`), CSS.indexOf('}', CSS.indexOf(`${sel} {`)))
    expect(block('.atmos-layer')).toMatch(/transition: opacity /)
    expect(block('.atmos')).toMatch(/pointer-events: none/)
    expect(block('.atmos')).toMatch(/z-index: -1/)
  })
})
