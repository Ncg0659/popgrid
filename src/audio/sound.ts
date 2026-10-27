/**
 * Oyun sesleri — Web Audio ile kod içinde üretilir (ses dosyası yok, 0 TL, internet gerekmez).
 *
 * iPhone (Safari ve ana ekrana eklenen uygulama) için kurallar:
 * - Ses motoru (AudioContext) yalnızca gerçek bir kullanıcı etkileşiminde açılır; ilk açılışta ses çalmaz.
 *   iOS'un kesin kabul ettiği touchend ve click olayları da dinlenir (yalnızca pointer olayları yetmeyebilir).
 * - Motor çalışmıyorsa her etkileşimde yeniden resume() denenir ve 1 örneklik sessiz bir ses çalınır.
 * - iOS arka plandan dönüşte motoru standart dışı "interrupted" durumuna sokabilir ya da "running"
 *   görünüp ses çıkarmayabilir (WebKit hataları 217606, 263627). Bu yüzden uygulama arka plana geçtiyse
 *   veya motor kesintiye uğradıysa, sonraki etkileşimde eski motor kapatılıp yenisi kurulur.
 * - Ses kapalıysa hiç motor kurulmaz; tercih localStorage'da saklanır.
 *
 * Bilinen platform sınırı: Web Audio'nun varsayılan ses oturumu "ambient" türündedir. iPhone sessiz
 * moddayken (yan anahtar / Eylem düğmesi / Denetim Merkezi) bu sesler iOS tarafından kısılır.
 */
const SOUND_KEY = 'popgrid:v1:sound'

/** Ses motorunu açmayı deneyen etkileşim olayları (belge düzeyinde, yakalama aşamasında dinlenir). */
export const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const

/** Ses sisteminin dış dünyaya bağımlılıkları; testlerde sahteleri verilir. */
export interface SoundEnv {
  readonly AudioContextCtor: (new () => AudioContext) | undefined
  readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null
  readonly doc: {
    readonly visibilityState: string
    addEventListener(type: string, listener: () => void, options?: AddEventListenerOptions): void
  }
  /** iOS 17+ navigator.audioSession.type (yalnızca tanı panelinde gösterilir; değiştirilmez). */
  readonly audioSessionType?: () => string | undefined
}

export interface SoundStatus {
  readonly supported: boolean
  readonly enabled: boolean
  /** Motor durumu: yok / suspended / running / interrupted / closed */
  readonly state: string
  /** Şimdiye kadar kurulan motor sayısı (arka plandan dönüşte artar). */
  readonly contexts: number
  readonly lastGesture: string
  readonly audioSession: string
  readonly lastError: string
}

export interface SoundSystem {
  isEnabled(): boolean
  setEnabled(on: boolean): void
  /** Kullanıcı etkileşimi sırasında çağrılır. */
  unlock(gesture?: string): void
  playPlace(): void
  playClear(lines: number, combo: number): void
  status(): SoundStatus
  /** Belge olaylarını dinlemeye başlar (bir kez). */
  install(): void
}

export function createSoundSystem(env: SoundEnv): SoundSystem {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  /** Motor arka plana geçti ya da kesintiye uğradı: sonraki etkileşimde yenisi kurulur. */
  let stale = false
  /** resume() çağrıldı, sonucu bekleniyor: bu sırada planlanan sesler motor açılınca çalar. */
  let resuming = false
  let contexts = 0
  let lastGesture = ''
  let lastError = ''
  let installed = false
  let enabled = (() => {
    try {
      return env.storage?.getItem(SOUND_KEY) !== 'off'
    } catch {
      return true
    }
  })()

  const remember = (e: unknown) => {
    lastError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }

  function dispose(): void {
    const old = ctx
    ctx = null
    master = null
    resuming = false
    if (old) old.close().catch(remember)
  }

  function create(): AudioContext | null {
    const AC = env.AudioContextCtor
    if (!AC) return null
    try {
      const ac = new AC()
      const gain = ac.createGain()
      gain.gain.value = 0.5
      gain.connect(ac.destination)
      ac.onstatechange = () => {
        // "interrupted" WebKit'e özgüdür (aramalar, Siri, arka plan); kapanmış motor da geri gelmez.
        const st = String(ac.state)
        if (ac === ctx && (st === 'interrupted' || st === 'closed')) stale = true
      }
      ctx = ac
      master = gain
      contexts += 1
      return ac
    } catch (e) {
      remember(e)
      return null
    }
  }

  /** iOS'un eski sürümlerinde motoru gerçekten açmak için etkileşim içinde sessiz bir ses çalınır. */
  function primeSilently(ac: AudioContext): void {
    try {
      const buffer = ac.createBuffer(1, 1, 22050)
      const src = ac.createBufferSource()
      src.buffer = buffer
      src.connect(ac.destination)
      src.start(0)
    } catch (e) {
      remember(e)
    }
  }

  function unlock(gesture = 'manual'): void {
    if (!enabled) return
    lastGesture = gesture
    if (stale) {
      dispose()
      stale = false
    }
    const ac = ctx ?? create()
    if (!ac || String(ac.state) === 'running') return
    primeSilently(ac)
    resuming = true
    ac.resume()
      .catch(remember)
      .finally(() => {
        if (ac === ctx) resuming = false
      })
  }

  function onVisibility(): void {
    if (!ctx) return
    if (env.doc.visibilityState === 'hidden') {
      stale = true
      ctx.suspend().catch(remember)
    } else if (enabled) {
      // Masaüstünde bu yeterlidir; iOS'ta motor bir sonraki dokunuşta zaten yeniden kurulur.
      ctx.resume().catch(remember)
    }
  }

  function ready(): AudioContext | null {
    if (!enabled || !ctx || !master || stale) return null
    const st = String(ctx.state)
    return st === 'running' || (st === 'suspended' && resuming) ? ctx : null
  }

  return {
    isEnabled: () => enabled,
    setEnabled(on) {
      enabled = on
      try {
        env.storage?.setItem(SOUND_KEY, on ? 'on' : 'off')
      } catch {
        // Depolama yoksa tercih yalnızca bu oturumda geçerli.
      }
      if (!on && ctx && String(ctx.state) === 'running') ctx.suspend().catch(remember)
      if (on) unlock('ses düğmesi')
    },
    unlock,
    playPlace() {
      const ac = ready()
      if (!ac || !master) return
      tone(ac, master, { freq: 340, dur: 0.09, type: 'sine', gain: 0.22, slide: 0.55 })
      tone(ac, master, { freq: 1200, dur: 0.03, type: 'triangle', gain: 0.04 })
    },
    playClear(lines, combo) {
      const ac = ready()
      if (!ac || !master) return
      clearArpeggio(ac, master, lines, combo)
    },
    status: () => ({
      supported: !!env.AudioContextCtor,
      enabled,
      state: ctx ? String(ctx.state) : 'yok',
      contexts,
      lastGesture: lastGesture || '-',
      audioSession: env.audioSessionType?.() ?? 'desteklenmiyor',
      lastError: lastError || '-',
    }),
    install() {
      if (installed) return
      installed = true
      for (const type of UNLOCK_EVENTS) {
        env.doc.addEventListener(type, () => unlock(type), { capture: true, passive: true })
      }
      env.doc.addEventListener('visibilitychange', onVisibility)
    },
  }
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

function tone(ac: AudioContext, out: AudioNode, t: Tone): void {
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
  g.connect(out)
  osc.start(start)
  osc.stop(start + t.dur + 0.02)
}

/** Pentatonik notalar (Do majör): kulağa hep uyumlu gelir. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0]

/**
 * Satır/sütun temizleme: yükselen parlak arpej. Çok hat → daha uzun arpej.
 * Kombo arttıkça aynı arpej daha yüksekten başlar ve sonda ışıltı eklenir.
 */
function clearArpeggio(ac: AudioContext, out: AudioNode, lines: number, combo: number): void {
  const shift = Math.min(Math.max(combo - 1, 0), 4)
  const notes = Math.min(3 + lines, 7)
  for (let i = 0; i < notes; i++) {
    const freq = SCALE[Math.min(i + shift, SCALE.length - 1)]!
    tone(ac, out, { freq, at: i * 0.045, dur: 0.16, type: 'triangle', gain: 0.16 })
    tone(ac, out, { freq: freq * 2, at: i * 0.045, dur: 0.08, type: 'sine', gain: 0.05 })
  }
  // Temizlemenin "pop" hissi
  tone(ac, out, { freq: 180, dur: 0.12, type: 'sine', gain: 0.18, slide: 2.2 })
  if (combo >= 2) {
    const end = notes * 0.045
    tone(ac, out, { freq: 2093, at: end, dur: 0.12, type: 'sine', gain: 0.07 })
    tone(ac, out, { freq: 2637, at: end + 0.05, dur: 0.16, type: 'sine', gain: 0.06 })
  }
}

// ---------- Uygulamanın kullandığı tek ses sistemi ----------
const system: SoundSystem | null =
  typeof window === 'undefined' || typeof document === 'undefined'
    ? null
    : createSoundSystem({
        AudioContextCtor:
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: new () => AudioContext }).webkitAudioContext,
        storage: (() => {
          try {
            return window.localStorage
          } catch {
            return null
          }
        })(),
        doc: document,
        audioSessionType: () => (navigator as unknown as { audioSession?: { type?: string } }).audioSession?.type,
      })
system?.install()

export const isSoundEnabled = (): boolean => system?.isEnabled() ?? false
export const setSoundEnabled = (on: boolean): void => system?.setEnabled(on)
export const unlockAudio = (): void => system?.unlock('react')
export const playPlace = (): void => system?.playPlace()
export const playClear = (lines: number, combo: number): void => system?.playClear(lines, combo)
export const soundStatus = (): SoundStatus | null => system?.status() ?? null
