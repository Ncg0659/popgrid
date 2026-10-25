/**
 * Oyun sesleri — Web Audio ile kod içinde üretilir (ses dosyası yok, 0 TL, internet gerekmez).
 * Kurallar:
 * - AudioContext yalnızca kullanıcı dokunduktan/tıkladıktan sonra oluşturulur; ilk açılışta ses çalmaz.
 * - Ses kapalıysa hiç AudioContext oluşturulmaz.
 * - Uygulama arka plana geçince ses motoru askıya alınır.
 * Not: iPhone sessiz modundayken Safari Web Audio seslerini çalmayabilir.
 */
const SOUND_KEY = 'popgrid:v1:sound'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = readEnabled()

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // Depolama yoksa tercih yalnızca bu oturumda geçerli.
  }
  if (!on && ctx && ctx.state === 'running') void ctx.suspend()
  if (on) unlockAudio()
}

/** Kullanıcı etkileşimi sırasında çağrılır (pointerdown/pointerup/keydown). */
export function unlockAudio(): void {
  if (!enabled) return
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    try {
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
    } catch {
      ctx = null
      return
    }
  }
  if (ctx.state === 'suspended' && document.visibilityState === 'visible') void ctx.resume()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.visibilityState === 'hidden') void ctx.suspend()
    else if (enabled) void ctx.resume()
  })
}

function ready(): AudioContext | null {
  return enabled && ctx && master && ctx.state === 'running' ? ctx : null
}

interface Tone {
  freq: number
  /** Başlangıçtan sonra (saniye). */
  at?: number
  dur: number
  type?: OscillatorType
  gain?: number
  /** Bitişte frekansın çarpanı (kayan ses). */
  slide?: number
}

function tone(ac: AudioContext, t: Tone): void {
  const start = ac.currentTime + (t.at ?? 0)
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = t.type ?? 'triangle'
  osc.frequency.setValueAtTime(t.freq, start)
  if (t.slide) osc.frequency.exponentialRampToValueAtTime(t.freq * t.slide, start + t.dur)
  const peak = t.gain ?? 0.2
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(peak, start + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur)
  osc.connect(g)
  g.connect(master!)
  osc.start(start)
  osc.stop(start + t.dur + 0.02)
}

/** Pentatonik notalar (Do majör): kulağa hep uyumlu gelir. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0]

/** Blok yerleştirme: kısa, yumuşak "tok". */
export function playPlace(): void {
  const ac = ready()
  if (!ac) return
  tone(ac, { freq: 340, dur: 0.09, type: 'sine', gain: 0.22, slide: 0.55 })
  tone(ac, { freq: 1200, dur: 0.03, type: 'triangle', gain: 0.04 })
}

/**
 * Satır/sütun temizleme: yükselen parlak arpej. Çok hat → daha uzun arpej.
 * Kombo arttıkça aynı arpej daha yüksekten başlar ve sonda ışıltı eklenir.
 */
export function playClear(lines: number, combo: number): void {
  const ac = ready()
  if (!ac) return
  const shift = Math.min(Math.max(combo - 1, 0), 4)
  const notes = Math.min(3 + lines, 7)
  for (let i = 0; i < notes; i++) {
    const freq = SCALE[Math.min(i + shift, SCALE.length - 1)]!
    tone(ac, { freq, at: i * 0.045, dur: 0.16, type: 'triangle', gain: 0.16 })
    tone(ac, { freq: freq * 2, at: i * 0.045, dur: 0.08, type: 'sine', gain: 0.05 })
  }
  // Temizlemenin "pop" hissi
  tone(ac, { freq: 180, dur: 0.12, type: 'sine', gain: 0.18, slide: 2.2 })
  if (combo >= 2) {
    const end = notes * 0.045
    tone(ac, { freq: 2093, at: end, dur: 0.12, type: 'sine', gain: 0.07 })
    tone(ac, { freq: 2637, at: end + 0.05, dur: 0.16, type: 'sine', gain: 0.06 })
  }
}
