/**
 * Aşama 9 — stil hesabı mikro ölçümü: tahtaya 16 blok eklemenin maliyeti, üç biçimde:
 *   1) durağan .blk   2) animasyon .blk'nin kendisinde (Aşama 9.1 öncesi biçim)   3) animasyon dış kapta, .blk içinde durağan (9.1)
 * Aynı derlemenin kendi CSS'iyle (.blk ve place-bounce her sürümde var). Chromium EMÜLASYONU; docs/perf.md
 *
 *   DIR=dist BASE=/popgrid/ RATE=4 npx vite-node scripts/perf/style-cost.ts
 */
import { arg, loadPlaywright, phoneContext, serve } from './common'

const dir = arg('dir', 'dist')!
const base = arg('base', '/popgrid/')!
const rate = Number(arg('rate', '4'))
const { chromium } = loadPlaywright()
const server = serve({ [base]: dir }, 4330)
const browser = await chromium.launch()
const ctx = await phoneContext(browser)
const page = await ctx.newPage()
await page.goto(`http://localhost:4330${base}?seed=7&mode=klasik`)
await page.waitForSelector('.board')
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate })
await page.waitForTimeout(500)
const result = await page.evaluate(`(() => {
  const board = document.querySelector('.board');
  const flush = () => document.body.offsetHeight;
  const med = (f, n = 11) => { const a = []; for (let i = 0; i < n; i++) a.push(f()); a.sort((x, y) => x - y); return +a[Math.floor(n / 2)].toFixed(1) };
  const cell = (g, i) => { const s = document.createElement('span'); s.style.gridRow = String(1 + (i >> 3)); s.style.gridColumn = String(1 + (i & 7)); g.appendChild(s); return s };
  const blk = (parent, i) => { const b = document.createElement('span'); b.className = 'blk'; b.dataset.c = String(1 + (i % 6)); parent.appendChild(b); return b };
  const run = (build) => med(() => {
    flush(); const t = performance.now();
    const g = document.createElement('div'); g.className = 'fx-grid';
    for (let i = 0; i < 16; i++) build(g, i);
    board.appendChild(g); flush(); const d = performance.now() - t; g.remove(); flush(); return d;
  });
  const anim = 'place-bounce 240ms cubic-bezier(0.3, 1.5, 0.55, 1)';
  return {
    'durağan .blk': run((g, i) => { const b = blk(g, i); b.style.gridRow = String(1 + (i >> 3)); b.style.gridColumn = String(1 + (i & 7)) }),
    'animasyon .blk üzerinde (eski)': run((g, i) => { const b = blk(g, i); b.style.gridRow = String(1 + (i >> 3)); b.style.gridColumn = String(1 + (i & 7)); b.style.animation = anim }),
    'animasyon dış kapta (9.1)': run((g, i) => { const w = cell(g, i); w.style.position = 'relative'; w.style.animation = anim; const b = blk(w, i); b.style.position = 'absolute'; b.style.inset = '0' }),
  };
})()`)
console.log(`16 blok ekleme + stil/yerleşim (ms, medyan, CPU ${rate}×, ${dir}):`)
for (const [k, v] of Object.entries(result as Record<string, number>)) console.log(`  ${k}: ${v}`)
await browser.close()
server.close()
