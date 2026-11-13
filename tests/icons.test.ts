/**
 * Uygulama ikonları ve manifest (onaylı turkuaz küp, docs/ikon/popgrid-ikon-kaynak.png).
 * Dosyalar scripts/icons/make-icons.py ile üretilir; burada boyutlar, bağlantılar ve manifest denetlenir.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const PUB = join(ROOT, 'public')

/** PNG başlığı: genişlik, yükseklik, renk türü (2 = RGB, 6 = RGBA). */
function pngInfo(file: string) {
  const b = readFileSync(file)
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR')
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bitDepth: b[24]!, colorType: b[25]!, interlace: b[28]!, buf: b }
}

/** Birkaç pikseli okumak için küçük PNG çözücü (8 bit, RGB/RGBA, taramasız). */
function pngPixels(file: string) {
  const { w, h, colorType, bitDepth, interlace, buf } = pngInfo(file)
  expect(bitDepth).toBe(8)
  expect(interlace).toBe(0)
  const bpp = colorType === 6 ? 4 : 3
  const idat: Buffer[] = []
  let off = 8
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.subarray(off + 4, off + 8).toString('ascii')
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len))
    off += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!
      const a = x >= bpp ? out[y * stride + x - bpp]! : 0
      const b = y > 0 ? out[(y - 1) * stride + x]! : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp]! : 0
      let p = 0
      if (f === 1) p = a
      else if (f === 2) p = b
      else if (f === 3) p = (a + b) >> 1
      else if (f === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[y * stride + x] = (v + p) & 0xff
    }
  }
  return { w, h, at: (x: number, y: number) => Array.from(out.subarray(y * stride + x * bpp, y * stride + x * bpp + bpp)) }
}

const ICONS: Array<[string, number]> = [
  ['icons/apple-touch-icon.png', 180],
  ['icons/icon-1024.png', 1024],
  ['icons/icon-192.png', 192],
  ['icons/icon-512.png', 512],
  ['icons/favicon-32.png', 32],
  ['icons/favicon-48.png', 48],
]

describe('Uygulama ikonu', () => {
  it('bütün boyutlar var ve kare', () => {
    for (const [f, size] of ICONS) {
      const i = pngInfo(join(PUB, f))
      expect([f, i.w, i.h]).toEqual([f, size, size])
    }
    expect(existsSync(join(PUB, 'favicon.ico'))).toBe(true)
    expect(existsSync(join(ROOT, 'docs/ikon/popgrid-ikon-kaynak.png'))).toBe(true)
  })

  it('ana ekran ve PWA ikonları saydamsız ve tam dolu (iOS saydamlığı siyaha boyar; beyaz çerçeve/siyah köşe kalmadı)', () => {
    for (const f of ['icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-1024.png']) {
      const p = pngPixels(join(PUB, f))
      expect(pngInfo(join(PUB, f)).colorType).toBe(2)
      const n = p.w - 1
      for (const [x, y] of [[0, 0], [n, 0], [0, n], [n, n], [p.w >> 1, 0], [0, p.w >> 1], [2, 2], [n - 2, n - 2]] as const) {
        const [r, g, b] = p.at(x, y)
        const max = Math.max(r!, g!, b!)
        const min = Math.min(r!, g!, b!)
        // Köşe ve kenarlar renkli arka plan: ne beyaz (çerçeve) ne siyah (dış köşe).
        expect(max > 60 && !(min > 220)).toBe(true)
      }
    }
  })

  it('favicon köşeleri saydam (görselin kendi yuvarlak biçimi), ortası dolu', () => {
    for (const f of ['icons/favicon-32.png', 'icons/favicon-48.png']) {
      const p = pngPixels(join(PUB, f))
      expect(pngInfo(join(PUB, f)).colorType).toBe(6)
      expect(p.at(0, 0)[3]).toBe(0)
      expect(p.at(p.w >> 1, p.h >> 1)[3]).toBe(255)
    }
  })

  it('manifest: ad, başlangıç adresi, ekran modu ve ikonlar (yalnızca "any"; ünlemler maskable güvenli alanın dışında)', () => {
    const m = JSON.parse(readFileSync(join(PUB, 'manifest.webmanifest'), 'utf8'))
    expect(m.name).toBe('POPGRID')
    expect(m.short_name).toBe('POPGRID')
    expect(m.start_url).toBe('./')
    expect(m.scope).toBe('./')
    expect(m.display).toBe('standalone')
    expect(m.theme_color).toBe('#fff6e9')
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toEqual(['192x192', '512x512', '1024x1024'])
    for (const i of m.icons) {
      expect(i.purpose).toBe('any')
      expect(i.src.startsWith('/')).toBe(false) // manifeste göre göreli: /popgrid/icons/...
      const [w] = i.sizes.split('x').map(Number)
      expect(pngInfo(join(PUB, i.src)).w).toBe(w)
    }
  })

  it('index.html: favicon, Apple Touch Icon ve manifest bağlantıları public/ dosyalarını gösteriyor', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    const links = [...html.matchAll(/<link rel="([^"]+)"[^>]*href="([^"]+)"/g)].map((m) => [m[1]!, m[2]!] as const)
    expect(links).toEqual([
      ['icon', '/favicon.ico'],
      ['icon', '/icons/favicon-32.png'],
      ['icon', '/icons/favicon-48.png'],
      ['apple-touch-icon', '/icons/apple-touch-icon.png'],
      ['manifest', '/manifest.webmanifest'],
    ])
    for (const [, href] of links) expect(existsSync(join(PUB, href))).toBe(true)
    // Onaylı logo ve açılış görseli korunur (RULES.md).
    expect(existsSync(join(PUB, 'logo.png'))).toBe(true)
    expect(existsSync(join(PUB, 'splash.png'))).toBe(true)
  })
})
