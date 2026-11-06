/**
 * Aşama 9 — animasyonların görsel karşılaştırması: iki derleme (önce / sonra) aynı oyunu oynar,
 * ölçülen hamleden sonra bütün CSS animasyonları aynı ana (t ms) dondurulur ve tahta bölgesinin
 * ekran görüntüleri piksel piksel karşılaştırılır. Parçacıklar (tohumsuz rastgele) iki tarafta da gizlenir.
 * Chromium EMÜLASYONU; gerçek cihaz değil. Ayrıntılar: docs/perf.md
 *
 *   BEFORE=../popgrid-main/dist AFTER=dist BASE=/popgrid/ [SHOTS=klasör] npx vite-node scripts/perf/visual.ts
 * Tek durum: ONLY=hat-klasik,zincir-eglence
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import type { GameEvent } from '../../src/engine'
import { arg, dragMove, isChain, isLine, isLucky, isNoClear, loadPlaywright, phoneContext, planUntil, serve, wait } from './common'

const before = arg('before')
const after = arg('after')
const base = arg('base', '/popgrid/')!
const shots = arg('shots')
if (!before || !after) {
  console.error('Kullanım: BEFORE=<klasör> AFTER=<klasör> [BASE=/popgrid/] [SHOTS=klasör] npx vite-node scripts/perf/visual.ts')
  process.exit(2)
}
if (shots) mkdirSync(shots, { recursive: true })
const { chromium } = loadPlaywright()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const isBombPlaced = (ev: readonly GameEvent[]) => ev.some((e) => e.type === 'specialPlaced' && e.kind === 'bomba')
const CASES: Array<{ name: string; seed: number; mode: 'klasik' | 'eglence'; pred: (ev: readonly GameEvent[]) => boolean; reduced?: boolean; times: number[] }> = [
  { name: 'yerlestirme-klasik', seed: 7, mode: 'klasik', pred: isNoClear, times: [0, 40, 80, 120, 160, 200, 240, 300] },
  { name: 'hat-klasik', seed: 7, mode: 'klasik', pred: isLine, times: [0, 30, 60, 90, 120, 160, 200, 260, 320, 400, 600] },
  { name: 'bomba-yerlestirme-eglence', seed: 279, mode: 'eglence', pred: isBombPlaced, times: [0, 60, 120, 240, 400] },
  { name: 'zincir-eglence', seed: 279, mode: 'eglence', pred: isChain, times: [0, 60, 120, 180, 240, 300, 360, 450, 600] },
  { name: 'sansli-eglence', seed: 300, mode: 'eglence', pred: isLucky, times: [0, 60, 120, 200, 300, 500, 800] },
  { name: 'hat-klasik-hareketi-azalt', seed: 7, mode: 'klasik', pred: isLine, reduced: true, times: [0, 300] },
]

const servers = [serve({ [base]: before }, 4321), serve({ [base]: after }, 4322)]
const browser = await chromium.launch()

async function capture(port: number, c: (typeof CASES)[number]): Promise<Buffer[]> {
  const plan = planUntil(c.seed, c.mode, c.pred)
  const ctx = await phoneContext(browser, { reducedMotion: c.reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${port}${base}?seed=${c.seed}&mode=${c.mode}`)
  await page.waitForSelector('.board')
  await page.addStyleTag({ content: '.fx-canvas{visibility:hidden!important}' })
  const cdp = await ctx.newCDPSession(page)
  for (let i = 0; i < plan.length - 1; i++) {
    await dragMove(page, cdp, plan[i]!.s, plan[i]!.mv)
    await wait(900)
  }
  const last = plan[plan.length - 1]!
  await dragMove(page, cdp, last.s, last.mv)
  await wait(60)
  const box = await page.evaluate(`(() => { const r = document.querySelector('.board').parentElement.getBoundingClientRect(); return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 } })()`)
  const out: Buffer[] = []
  for (const t of c.times) {
    await page.evaluate(`(async () => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ${t} } await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) })()`)
    out.push(await page.screenshot({ clip: box, animations: 'allow' }))
  }
  await ctx.close()
  return out
}

/** İki PNG'yi tarayıcıda karşılaştırır: farklı piksel sayısı ve en büyük kanal farkı. */
async function diff(page: Any, a: Buffer, b: Buffer) {
  return page.evaluate(
    `(async ([a, b]) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { sizeMismatch: true, px: -1, max: 255, total: 0 };
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const g = c.getContext('2d');
      g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data;
      g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
      let px = 0, max = 0;
      for (let i = 0; i < da.length; i += 4) { const m = Math.max(Math.abs(da[i]-db[i]), Math.abs(da[i+1]-db[i+1]), Math.abs(da[i+2]-db[i+2]), Math.abs(da[i+3]-db[i+3])); if (m > 0) { px++; if (m > max) max = m } }
      return { px, max, total: da.length / 4 };
    })(${JSON.stringify([a.toString('base64'), b.toString('base64')])})`,
  )
}

const cmp = await (await browser.newContext()).newPage()
let bad = 0
console.log('Görsel karşılaştırma (Chromium emülasyonu, 390×844, 3× piksel; parçacıklar gizli)')
const only = process.env.ONLY?.split(',')
for (const c of CASES.filter((x) => !only || only.includes(x.name))) {
  const [a, b] = [await capture(4321, c), await capture(4322, c)]
  const rows: string[] = []
  for (let i = 0; i < c.times.length; i++) {
    const d = await diff(cmp, a[i]!, b[i]!)
    const ok = d.px === 0
    if (!ok) bad++
    rows.push(`${c.times[i]}ms:${ok ? '=' : `${d.px}px/≤${d.max}`}`)
    if (shots) {
      writeFileSync(`${shots}/${c.name}-${c.times[i]}-once.png`, a[i]!)
      writeFileSync(`${shots}/${c.name}-${c.times[i]}-sonra.png`, b[i]!)
    }
  }
  console.log(`${c.name.padEnd(28)} ${rows.join('  ')}`)
}
console.log(bad === 0 ? '\nBütün kareler piksel piksel aynı.' : `\n${bad} karede fark var (yukarıda: farklı piksel / en büyük kanal farkı).`)
await browser.close()
for (const s of servers) s.close()
process.exit(bad === 0 ? 0 : 1)
