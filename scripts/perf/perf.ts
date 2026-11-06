/**
 * Aşama 9 — tekrarlanabilir performans ölçümü (Chromium EMÜLASYONU: telefon görünümü + CPU yavaşlatma).
 * Gerçek iPhone ölçümü DEĞİLDİR; yöntem ve sınırlar: docs/perf.md
 *
 * Çalıştırma (üretim derlemesi gerekir: npm run build → dist/):
 *   DIR=dist BASE=/popgrid/ LABEL=sonra npx vite-node scripts/perf/perf.ts
 * Seçenekler (ortam değişkeni): N=3 (koşu), RATES=1,4 (CPU yavaşlatma), SCEN=aim,place,line,chain,lucky,
 *   TRACE=1 (ilk koşunun iz kaydından uzun görev dökümü), TRACE=all (her koşuda; bırakma görevinin süresini de verir),
 *   PROFILE=1 (ilk koşuda JS öz süreleri),
 *   OUT=dosya.json (ham sonuçlar)
 */
import { writeFileSync } from 'node:fs'
import { arg, dragMove, loadPlaywright, phoneContext, planUntil, SCENARIOS, serve, touch, wait, type ScenarioName } from './common'

const dir = arg('dir', 'dist')!
const base = arg('base', '/popgrid/')!
const label = arg('label', dir)!
const port = Number(arg('port', '4310'))
const { chromium } = loadPlaywright()

// Sayfaya enjekte edilen ölçüm: her kare zamanı ve tarayıcının "uzun görev" kayıtları (>50 ms).
const PROBE = `window.__f=[];window.__rec=false;window.__lt=[];
try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(window.__rec)window.__lt.push(Math.round(e.duration))}).observe({type:'longtask'})}catch(e){}
(function loop(t){if(window.__rec)window.__f.push(t);requestAnimationFrame(loop)})(performance.now());`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

/** İz dökümüne giren en kısa görev (µs). TRACE=all'da 10 ms: bırakma görevi 50 ms'nin altında da ölçülür. */
const TASK_MIN_US = process.env.TRACE === 'all' ? 10000 : 40000

/** İz kaydındaki ana iş parçacığı uzun görevleri: her birinin içinde en çok zaman alan iş türleri (özel süre, ms). */
function analyzeTrace(trace: Any) {
  const ev: Any[] = Array.isArray(trace) ? trace : trace.traceEvents
  const names = new Map<string, string>()
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name)
  const count = new Map<string, number>()
  for (const e of ev) if (e.ph === 'X' && names.get(`${e.pid}:${e.tid}`) === 'CrRendererMain') count.set(`${e.pid}:${e.tid}`, (count.get(`${e.pid}:${e.tid}`) ?? 0) + 1)
  const mainKey = [...count].sort((a, b) => b[1] - a[1])[0]?.[0]
  const main = ev
    .filter((e) => e.ph === 'X' && `${e.pid}:${e.tid}` === mainKey && typeof e.dur === 'number')
    .sort((a, b) => a.ts - b.ts || b.dur - a.dur)
  const tasks = main.filter((e) => e.name === 'ThreadControllerImpl::RunTask' && e.dur > TASK_MIN_US && !main.some((m) => m.name === 'Receive mojo message' && m.ts >= e.ts && m.dur > e.dur * 0.9))
  return tasks.map((t) => {
    const kids = main.filter((e) => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e.name !== 'ThreadControllerImpl::RunTask')
    const excl = new Map<string, number>()
    const stack: Any[] = []
    for (const e of kids) {
      while (stack.length && e.ts >= stack[stack.length - 1].ts + stack[stack.length - 1].dur) stack.pop()
      if (stack.length) excl.set(stack[stack.length - 1].name, (excl.get(stack[stack.length - 1].name) ?? 0) - e.dur)
      excl.set(e.name, (excl.get(e.name) ?? 0) + e.dur)
      stack.push(e)
    }
    const trigger = kids.find((e) => e.name === 'EventDispatch')?.args?.data?.type ?? (kids.some((e) => e.name === 'FireAnimationFrame') ? 'animationFrame' : kids[0]?.name)
    const top = [...excl].filter(([, v]) => v > 1500).sort((a, b) => b[1] - a[1]).slice(0, 6)
    return { ms: +(t.dur / 1000).toFixed(1), trigger, top: Object.fromEntries(top.map(([k, v]) => [k, +(v / 1000).toFixed(1)])) }
  })
}

function analyzeProfile(prof: Any): string[] {
  const byId = new Map<number, Any>(prof.nodes.map((n: Any) => [n.id, n]))
  const self = new Map<number, number>()
  for (let i = 0; i < prof.samples.length; i++) self.set(prof.samples[i], (self.get(prof.samples[i]) ?? 0) + (prof.timeDeltas[i + 1] ?? 0))
  const agg = new Map<string, number>()
  for (const [id, us] of self) {
    const cf = byId.get(id).callFrame
    const k = cf.functionName || (cf.url ? '(anonim)' : '(program/gc)')
    agg.set(k, (agg.get(k) ?? 0) + us)
  }
  return [...agg].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}`)
}

const quantile = (a: number[], p: number) => {
  const b = [...a].sort((x, y) => x - y)
  return b[Math.min(b.length - 1, Math.floor(p * b.length))] ?? 0
}

async function runOnce(browser: Any, name: ScenarioName, rate: number, opts: { trace: boolean; profile: boolean }) {
  const sc = SCENARIOS[name]
  const plan = planUntil(sc.seed, sc.mode, sc.pred)
  const ctx = await phoneContext(browser)
  await ctx.addInitScript(PROBE)
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${port}${base}?seed=${sc.seed}&mode=${sc.mode}`)
  await page.waitForSelector('.board')
  const cdp = await ctx.newCDPSession(page)
  // Hedef hamleye kadar normal hızda oynanır; yavaşlatma yalnızca ölçülen hamlede.
  for (let i = 0; i < plan.length - 1; i++) {
    await dragMove(page, cdp, plan[i]!.s, plan[i]!.mv)
    await wait(650)
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  await wait(400)
  const last = plan[plan.length - 1]!
  if (opts.trace) await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink', 'toplevel'] })
  if (opts.profile) {
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
    await cdp.send('Profiler.start')
  }
  await page.evaluate('window.__f = []; window.__lt = []; window.__rec = true')
  if (name === 'aim') {
    // Parça tahtanın üstünde dört köşe arasında gezer (her adım yeni hedef hücre), sonra bırakılır.
    await dragMove(page, cdp, last.s, last.mv, { steps: 10, gap: 16, release: false, via: [{ row: 0, col: 0 }, { row: 0, col: 5 }, { row: 5, col: 5 }, { row: 5, col: 0 }] })
    await touch(cdp, 'touchEnd')
    await wait(800)
  } else {
    // Ölçülen an: parmak kaldırıldığı andan itibaren 1,3 sn (bırakma + efekt).
    await dragMove(page, cdp, last.s, last.mv, { steps: 6, gap: 16, release: false })
    await page.evaluate('window.__f = []; window.__lt = []')
    await touch(cdp, 'touchEnd')
    await wait(1300)
  }
  const r: { f: number[]; lt: number[] } = await page.evaluate('(() => { window.__rec = false; return { f: window.__f, lt: window.__lt } })()')
  const prof = opts.profile ? analyzeProfile((await cdp.send('Profiler.stop')).profile) : null
  const tasks = opts.trace ? analyzeTrace(JSON.parse((await browser.stopTracing()).toString())) : []
  await ctx.close()
  const d = r.f.slice(1).map((t, i) => t - r.f[i]!)
  // En uzun ana iş parçacığı görevi (iz kaydı varsa): kare süresinden daha hassas (16,7 ms basamağı yok).
  const maxTask = tasks.length ? Math.max(...tasks.map((t) => t.ms)) : null
  return { maxTask, maxFrame: Math.max(...d), over50: d.filter((x) => x > 50).length, over25: d.filter((x) => x > 25).length, frames: d.length, p95: quantile(d, 0.95), longTasks: r.lt, tasks, prof }
}

const N = Number(process.env.N ?? 3)
const rates = (process.env.RATES ?? '1,4').split(',').map(Number)
const scen = (process.env.SCEN ?? 'aim,place,line,chain,lucky').split(',') as ScenarioName[]
const server = serve({ [base]: dir }, port)
const browser = await chromium.launch()
const results: Any[] = []
console.log(`Ölçüm: ${label} (${dir}), 390×844, ${N} koşu — Chromium emülasyonu, gerçek cihaz değil`)
for (const rate of rates)
  for (const s of scen) {
    const runs = []
    for (let i = 0; i < N; i++) runs.push(await runOnce(browser, s, rate, { trace: process.env.TRACE === 'all' || (process.env.TRACE === '1' && i === 0), profile: process.env.PROFILE === '1' && i === 0 }))
    const med = quantile(runs.map((x) => x.maxFrame), 0.5)
    const tasksMs = runs.map((x) => x.maxTask).filter((x): x is number => x !== null)
    console.log(
      `[${label}] CPU ${rate}× ${s.padEnd(6)} | en uzun kare medyan ${med.toFixed(0)} ms (koşular ${runs.map((x) => x.maxFrame.toFixed(0)).join('/')}) | 50 ms+ kare ${runs.map((x) => x.over50).join('/')} | 25 ms+ kare ${runs.map((x) => x.over25).join('/')} | uzun görevler ${runs.map((x) => `[${x.longTasks.join(',')}]`).join(' ')}`,
    )
    if (tasksMs.length) console.log(`     en uzun görev (iz kaydı) medyan ${quantile(tasksMs, 0.5).toFixed(1)} ms (koşular ${tasksMs.join('/')})`)
    if (process.env.TRACE !== 'all') for (const t of runs[0]!.tasks) console.log(`     görev ${t.ms} ms (${t.trigger}): ${JSON.stringify(t.top)}`)
    if (runs[0]!.prof) console.log(`     JS öz süre (ms): ${runs[0]!.prof.join(' | ')}`)
    results.push({ label, rate, scenario: s, medianMaxFrame: med, medianMaxTask: tasksMs.length ? quantile(tasksMs, 0.5) : null, runs })
  }
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(results, null, 1))
await browser.close()
server.close()
