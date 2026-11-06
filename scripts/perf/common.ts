/**
 * Aşama 9 — performans ve görsel karşılaştırma betiklerinin ortak parçaları.
 * Proje bağımlılığı DEĞİLDİR: Playwright (Chromium) çalıştıran bilgisayarda ayrıca kurulu olmalıdır
 * (ör. geçici bir klasöre `npm i playwright` ya da genel kurulum). CI'de çalışmaz, zorunlu testlere girmez.
 * Ayrıntılar: docs/perf.md
 */
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join, resolve } from 'node:path'
import { DEFAULT_CONFIG, getShape, newGame, play, type GameEvent, type GameState, type Move } from '../../src/engine'
import { TOUCH_LIFT_CELLS } from '../../src/input/dragGeometry'
import { greedyBot } from '../bot'

/** Playwright'ı projeye eklemeden yükler (NODE_PATH ya da üst klasörlerdeki node_modules). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadPlaywright(): any {
  const require = createRequire(join(process.cwd(), 'noop.js'))
  try {
    return require('playwright')
  } catch {
    console.error('Playwright bulunamadı. docs/perf.md içindeki kurulum notuna bakın (projeye bağımlılık eklenmez).')
    process.exit(2)
  }
}

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

/** Derlenmiş oyunları (ör. dist/) yerel olarak sunar. mounts: { '/once/': 'klasör', '/sonra/': 'klasör' } */
export function serve(mounts: Record<string, string>, port: number): Server {
  const entries = Object.entries(mounts).map(([prefix, dir]) => [prefix, resolve(dir)] as const)
  return createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]!)
    const hit = entries.find(([prefix]) => path.startsWith(prefix))
    let body: Buffer | null = null
    let file = ''
    if (hit) {
      const rest = path.slice(hit[0].length)
      file = join(hit[1], rest === '' ? 'index.html' : rest)
      try {
        body = readFileSync(file)
      } catch {
        body = null
      }
    }
    if (body) {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
      res.end(body)
    } else {
      res.writeHead(404, { 'content-type': 'text/html' })
      res.end('<p>yok</p>')
    }
  }).listen(port)
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

/** CDP üzerinden gerçek dokunma olayı (iPhone'daki gibi tek parmak). */
export const touch = (cdp: Any, type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] })

interface BoardMetrics {
  left: number
  top: number
  gap: number
  pitch: number
}

export async function boardMetrics(page: Any): Promise<BoardMetrics> {
  return page.evaluate(`(() => {
    const el = document.querySelector('.board'); const r = el.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0; const cell = (r.width - 7 * gap) / 8;
    return { left: r.left, top: r.top, gap, pitch: cell + gap };
  })()`)
}

/** Parçanın sol üst hücresi (row, col) olacak şekilde parmağın duracağı nokta (oyunun parmak kaldırma payı dahil). */
export function fingerFor(m: BoardMetrics, shapeId: string, row: number, col: number) {
  const s = getShape(shapeId)
  return {
    x: m.left + col * m.pitch + (s.width * m.pitch - m.gap) / 2,
    y: m.top + row * m.pitch + (s.height * m.pitch - m.gap) + TOUCH_LIFT_CELLS * m.pitch,
  }
}

/** Tepsideki parçayı sürükler; release=false ise parmağı kaldırmaz. via: arada uğranacak hücreler. */
export async function dragMove(
  page: Any,
  cdp: Any,
  s: GameState,
  mv: Move,
  opts: { steps?: number; gap?: number; release?: boolean; via?: Array<{ row: number; col: number }> } = {},
) {
  const m = await boardMetrics(page)
  const b = await page.locator('.tray > *').nth(mv.slot).boundingBox()
  const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  const id = s.tray[mv.slot]!.shapeId
  const pts = [...(opts.via ?? []).map((v) => fingerFor(m, id, v.row, v.col)), fingerFor(m, id, mv.row, mv.col)]
  await touch(cdp, 'touchStart', from.x, from.y)
  let cur = from
  for (const to of pts) {
    const steps = opts.steps ?? 8
    for (let i = 1; i <= steps; i++) {
      await touch(cdp, 'touchMove', cur.x + ((to.x - cur.x) * i) / steps, cur.y + ((to.y - cur.y) * i) / steps)
      if (opts.gap) await wait(opts.gap)
    }
    cur = to
  }
  await wait(40)
  if (opts.release !== false) await touch(cdp, 'touchEnd')
}

export interface PlanStep {
  s: GameState
  mv: Move
  ev: readonly GameEvent[]
}

/** Bot ile hamle planı: hedef olay (pred) gerçekleşen hamleye kadar. Aynı seed = her koşuda aynı oyun. */
export function planUntil(seed: number, mode: 'klasik' | 'eglence', pred: (ev: readonly GameEvent[]) => boolean, max = 80): PlanStep[] {
  let s = newGame(seed, DEFAULT_CONFIG, mode === 'eglence' ? { mode } : {})
  const out: PlanStep[] = []
  for (let i = 0; i < max; i++) {
    const mv = greedyBot(s)
    if (!mv) break
    const r = play(s, mv)
    if (!r.ok) throw new Error(r.reason)
    out.push({ s, mv, ev: r.events })
    if (pred(r.events)) return out
    s = r.state
  }
  throw new Error(`seed ${seed}: hedef olay ${max} hamlede bulunamadı`)
}

export const isNoClear = (ev: readonly GameEvent[]) => !ev.some((e) => e.type === 'cleared' || e.type === 'exploded')
export const isLine = (ev: readonly GameEvent[]) => ev.some((e) => e.type === 'cleared')
export const isChain = (ev: readonly GameEvent[]) => ev.some((e) => e.type === 'exploded' && e.bombs.length >= 2)
export const isLucky = (ev: readonly GameEvent[]) => ev.some((e) => e.type === 'luckyReward')

/** Ölçüm senaryoları (seed'ler Aşama 8.3/9 ölçümleriyle aynı). */
export const SCENARIOS = {
  place: { seed: 7, mode: 'klasik', pred: isNoClear, label: 'yalnızca yerleştirme (Klasik)' },
  line: { seed: 7, mode: 'klasik', pred: isLine, label: 'hat temizleme (Klasik)' },
  chain: { seed: 279, mode: 'eglence', pred: isChain, label: 'zincir patlaması (Eğlence)' },
  lucky: { seed: 300, mode: 'eglence', pred: isLucky, label: 'şanslı ödül (Eğlence)' },
  aim: { seed: 7, mode: 'klasik', pred: isNoClear, label: 'sürüklerken hedef değişimi (Klasik)' },
} as const satisfies Record<string, { seed: number; mode: 'klasik' | 'eglence'; pred: (ev: readonly GameEvent[]) => boolean; label: string }>
export type ScenarioName = keyof typeof SCENARIOS

/** Eğitim ve joker tanıtımı atlanmış, boş kayıtlı telefon bağlamı (390×844, 3× piksel). */
export async function phoneContext(browser: Any, opts: { width?: number; height?: number; reducedMotion?: 'reduce' | 'no-preference' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.width ?? 390, height: opts.height ?? 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: opts.reducedMotion ?? 'no-preference',
  })
  await ctx.addInitScript(
    "try { if (!localStorage.getItem('popgrid:v1:tutorial')) { localStorage.setItem('popgrid:v1:tutorial','done'); localStorage.setItem('popgrid:v1:joker-intro','done') } } catch (e) {}",
  )
  return ctx
}

/** Ayar: önce ortam değişkeni (DIR, BASE, BEFORE, …), sonra komut satırı (--dir değer), sonra varsayılan. */
export function arg(name: string, fallback?: string): string | undefined {
  const env = process.env[name.toUpperCase()]
  if (env) return env
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
