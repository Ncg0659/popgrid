/**
 * Aşama 9.2 — parçacık katmanı: pencere boyutu her karede okunmaz (tarayıcıyı stil/yerleşim hesabına zorlar),
 * yalnızca efekt başlarken ve pencere boyutu değişince okunur. Çizim davranışı aynı kalır.
 * Tarayıcı yok: sahte pencere, tuval ve requestAnimationFrame ile sınanır.
 */
import { describe, expect, it } from 'vitest'
import { MAX_PARTICLES, ParticleSystem } from '../src/fx/particles'

type Listener = () => void
interface FakeWindow {
  reads: number
  w: number
  h: number
  listeners: Map<string, Set<Listener>>
  readonly innerWidth: number
  readonly innerHeight: number
  addEventListener(type: string, fn: Listener): void
  removeEventListener(type: string, fn: Listener): void
  fire(type: string): void
}

let win: FakeWindow
let rafQueue: Array<(t: number) => void> = []
let clock = 1000
const g = globalThis as unknown as Record<string, unknown>
const saved = { window: g.window, raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame }

function fakeCanvas() {
  const calls: string[] = []
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop: string) => (...args: unknown[]) => {
        calls.push(`${prop}(${args.map((a) => (typeof a === 'number' ? a.toFixed(2) : String(a))).join(',')})`)
      },
      set: (_t, prop: string, value: unknown) => {
        calls.push(`${prop}=${String(value)}`)
        return true
      },
    },
  )
  const canvas = { width: 0, height: 0, getContext: () => ctx }
  return { canvas: canvas as unknown as HTMLCanvasElement, calls }
}

function step(n: number) {
  for (let i = 0; i < n; i++) {
    clock += 16
    const q = rafQueue
    rafQueue = []
    for (const cb of q) cb(clock)
  }
}

/** Sahte tarayıcı ortamını kurar, testi çalıştırır ve gerçek globalleri geri koyar. */
function withFakeBrowser(fn: () => void) {
  win = {
    reads: 0,
    w: 390,
    h: 844,
    listeners: new Map(),
    get innerWidth() {
      this.reads++
      return this.w
    },
    get innerHeight() {
      this.reads++
      return this.h
    },
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type)!.add(fn)
    },
    removeEventListener(type, fn) {
      this.listeners.get(type)?.delete(fn)
    },
    fire(type) {
      for (const fn of this.listeners.get(type) ?? []) fn()
    },
  }
  g.window = win
  rafQueue = []
  g.requestAnimationFrame = (cb: (t: number) => void) => {
    rafQueue.push(cb)
    return rafQueue.length
  }
  g.cancelAnimationFrame = () => {
    rafQueue = []
  }
  try {
    fn()
  } finally {
    g.window = saved.window
    g.requestAnimationFrame = saved.raf
    g.cancelAnimationFrame = saved.caf
  }
}

describe('Aşama 9.2: parçacık katmanı pencere boyutunu her karede okumaz', () => {
  it('efekt boyunca pencere boyutu yalnızca başta bir kez okunur; tuval pencere boyutunda', () => {
    withFakeBrowser(() => {
      const { canvas } = fakeCanvas()
      const ps = new ParticleSystem(canvas)
      ps.burst(100, 100, 40, '#ff0000', 6, 1, 0)
      expect(win.reads).toBe(2) // innerWidth + innerHeight, bir kez
      expect([canvas.width, canvas.height]).toEqual([390, 844])
      step(20)
      expect(ps.active).toBeGreaterThan(0)
      expect(win.reads).toBe(2) // 20 karede hiç yeni okuma yok (eskiden kare başına 4)
      step(80)
      expect(ps.active).toBe(0) // parçacıklar ömrünü doldurunca döngü durur
      expect(rafQueue).toHaveLength(0)
      expect(win.reads).toBe(2)
    })
  })

  it('pencere boyutu değişince (döndürme) bir sonraki karede bir kez yeniden okunur ve tuval büyür', () => {
    withFakeBrowser(() => {
      const { canvas } = fakeCanvas()
      const ps = new ParticleSystem(canvas)
      ps.burst(100, 100, 40, '#00ff00', 6, 1, 0)
      step(2)
      win.w = 844
      win.h = 390
      win.fire('resize')
      step(1)
      expect(win.reads).toBe(4)
      expect([canvas.width, canvas.height]).toEqual([844, 390])
      step(5)
      expect(win.reads).toBe(4)
    })
  })

  it('temizleme kare boyutunu önbellekten kullanır; yeni efekt yine bir kez okur', () => {
    withFakeBrowser(() => {
      const { canvas, calls } = fakeCanvas()
      const ps = new ParticleSystem(canvas)
      ps.burst(50, 50, 40, '#0000ff', 3, 1, 0)
      step(1)
      expect(calls).toContain('clearRect(0.00,0.00,390.00,844.00)')
      step(100)
      ps.burst(50, 50, 40, '#0000ff', 3, 1, 0)
      expect(win.reads).toBe(4)
    })
  })

  it('destroy döngüyü durdurur ve pencere dinleyicisini bırakır', () => {
    withFakeBrowser(() => {
      const { canvas } = fakeCanvas()
      const ps = new ParticleSystem(canvas)
      expect(win.listeners.get('resize')?.size).toBe(1)
      ps.burst(50, 50, 40, '#0000ff', 3, 1, 0)
      ps.destroy()
      expect(ps.active).toBe(0)
      expect(win.listeners.get('resize')?.size).toBe(0)
    })
  })

  it('parçacık üst sınırı değişmedi', () => {
    withFakeBrowser(() => {
      const { canvas } = fakeCanvas()
      const ps = new ParticleSystem(canvas)
      ps.burst(0, 0, 40, '#fff', MAX_PARTICLES + 50, 1, 0)
      expect(ps.active).toBe(MAX_PARTICLES)
    })
  })
})
