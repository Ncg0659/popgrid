/**
 * Aşama 9.3 — yazı kalınlığı: oyunun yazı tipi Baloo 2 Variable yalnızca 400–800 kalınlıklarını içerir
 * (@fontsource-variable/baloo-2, "font-weight: 400 800"). Daha kalın istemek görünümü değiştirmez (tarayıcı 800 çizer),
 * yalnızca gereksiz yazı tipi eşleştirmesine yol açar. Bu test, CSS'te 800'den kalın değer kalmadığını denetler.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../src/theme/game.css', import.meta.url), 'utf8')

describe('Aşama 9.3: yazı kalınlıkları yazı tipinin aralığında', () => {
  it('game.css içinde 800’den büyük font-weight yok (bold/bolder dahil değil, sayısal değerler)', () => {
    const weights = [...css.matchAll(/font-weight:\s*(\d+)/g)].map((m) => Number(m[1]))
    expect(weights.length).toBeGreaterThan(0)
    expect(weights.filter((w) => w > 800)).toEqual([])
    expect(weights.filter((w) => w < 400)).toEqual([])
  })

  it('yazı tipi tanımı Baloo 2 Variable ile başlıyor', () => {
    expect(/--font:\s*'Baloo 2 Variable'/.test(css)).toBe(true)
  })
})
