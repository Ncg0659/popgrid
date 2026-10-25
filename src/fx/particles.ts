/**
 * Hafif parçacık sistemi: tek bir <canvas>, kütüphane yok.
 * Yalnızca parçacık varken requestAnimationFrame döngüsü çalışır; bitince durur.
 * Görsel rastgelelik Math.random kullanır — oyun motorunun tohumlu rastgeleliğine dokunmaz (RULES.md 11).
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  /** Doğmadan önce beklenecek süre (ms) — patlama dalgasıyla eşzamanlı. */
  wait: number
  age: number
  life: number
  size: number
  rot: number
  vr: number
  color: string
  star: boolean
}

/** Aynı anda en fazla bu kadar parçacık (eski telefonlarda da akıcı kalsın). */
export const MAX_PARTICLES = 220

export class ParticleSystem {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D | null
  private particles: Particle[] = []
  private frame = 0
  private last = 0
  private dpr = 1

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
  }

  get active(): number {
    return this.particles.length
  }

  private resize(): void {
    // Ölçüm: tam ekran tuvali 2x çözünürlükte çizmek yavaş telefonda ~8 fps'e mal oluyordu.
    // Parçacıklar küçük ve hızlı olduğu için 1x çözünürlük gözle fark edilmez.
    this.dpr = 1
    const w = Math.round(window.innerWidth * this.dpr)
    const h = Math.round(window.innerHeight * this.dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  /**
   * Bir hücreden parçacık fışkırtır.
   * @param cell hücre boyutu (px) — parçacık boyu ve hızı buna göre ölçeklenir
   */
  burst(x: number, y: number, cell: number, color: string, count: number, power: number, wait: number): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const star = i % 3 === 0
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6
      const speed = cell * (3 + Math.random() * 5) * power
      this.particles.push({
        x: x + (Math.random() - 0.5) * cell * 0.5,
        y: y + (Math.random() - 0.5) * cell * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        wait,
        age: 0,
        life: 450 + Math.random() * 350,
        size: cell * (star ? 0.2 + Math.random() * 0.12 : 0.1 + Math.random() * 0.1),
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 10,
        color: star ? (Math.random() < 0.6 ? '#ffd23f' : '#ffffff') : color,
        star,
      })
    }
    if (!this.frame) {
      this.resize()
      this.last = performance.now()
      this.frame = requestAnimationFrame(this.tick)
    }
  }

  clear(): void {
    this.particles = []
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private readonly tick = (now: number): void => {
    const ctx = this.ctx
    // Sekme arka plandayken büyük zaman sıçramalarını kırp.
    const dt = Math.min(now - this.last, 50)
    this.last = now
    if (!ctx) {
      this.clear()
      return
    }
    this.resize()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    const s = dt / 1000
    const alive: Particle[] = []
    for (const p of this.particles) {
      if (p.wait > 0) {
        p.wait -= dt
        alive.push(p)
        continue
      }
      p.age += dt
      if (p.age >= p.life) continue
      p.vy += 1600 * s
      p.vx *= 0.985
      p.x += p.vx * s
      p.y += p.vy * s
      p.rot += p.vr * s
      const t = p.age / p.life
      ctx.globalAlpha = 1 - t * t
      ctx.fillStyle = p.color
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      if (p.star) drawStar(ctx, p.size)
      else roundRect(ctx, p.size)
      ctx.restore()
      alive.push(p)
    }
    ctx.globalAlpha = 1
    this.particles = alive
    this.frame = alive.length ? requestAnimationFrame(this.tick) : 0
    if (!alive.length) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }
}

function drawStar(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45
    const a = (i * Math.PI) / 5 - Math.PI / 2
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

function roundRect(ctx: CanvasRenderingContext2D, s: number): void {
  const r = s * 0.3
  ctx.beginPath()
  ctx.moveTo(-s + r, -s)
  ctx.arcTo(s, -s, s, s, r)
  ctx.arcTo(s, s, -s, s, r)
  ctx.arcTo(-s, s, -s, -s, r)
  ctx.arcTo(-s, -s, s, -s, r)
  ctx.closePath()
  ctx.fill()
}
