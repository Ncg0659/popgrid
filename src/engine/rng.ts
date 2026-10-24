/**
 * Tohumlu rastgele sayı üreteci.
 * Yalnızca 32 bit tamsayı işlemleri kullanır; her tarayıcıda ve Node'da aynı sonucu verir.
 * Motorda Math.random yerine her zaman bu dosya kullanılır (RULES.md 9).
 */

export interface Rng {
  /** 0 ile 2^32-1 arası tamsayı. */
  nextUint32(): number
  /** 0 ile max-1 arası tamsayı (eşit dağılımlı). */
  nextInt(max: number): number
}

/** mulberry32 algoritması. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
  const nextInt = (max: number): number => {
    if (!Number.isInteger(max) || max <= 0 || max > 0x100000000) {
      throw new RangeError(`nextInt: geçersiz üst sınır ${max}`)
    }
    // Modulo yanlılığını önlemek için reddetme örneklemesi.
    const limit = 0x100000000 - (0x100000000 % max)
    let x = nextUint32()
    while (x >= limit) x = nextUint32()
    return x % max
  }
  return { nextUint32, nextInt }
}

/** İki sayıyı tek bir 32 bit tohumda karıştırır (seed + üçlü numarası gibi). */
export function mixSeed(a: number, b: number): number {
  let h = (a >>> 0) ^ Math.imul(b >>> 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/** Metinden tohum üretir (ör. günlük yarışma için "2026-10-24"). FNV-1a. */
export function seedFromString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
