/**
 * Oyun sesleri — Web Audio ile kod içinde üretilir (ses dosyası yok, 0 TL, internet gerekmez).
 *
 * iPhone (Safari ve ana ekrana eklenen uygulama) için kurallar:
 * - Ses motoru (AudioContext) yalnızca kullanıcı etkileşiminde kurulur; ilk açılışta ses çalmaz.
 * - iOS bir motoru ancak "açık bir hareketle" (dokunup bırakma/tıklama, tuş) başlatır; touchstart ve
 *   sürükleme bunu sağlamaz (WebKit 149367). Bir kez başlamış motor için bu kısıt kalkar.
 * - Bu yüzden kilidi açılmış motor KORUNUR: arka plandan dönüşte (visibilitychange / pageshow) ve
 *   sonraki her etkileşimde aynı motor resume() ile sürdürülür. Sürükleme de bunu yapabilir.
 * - Motor "running" görünüp saati ilerlemiyorsa (WebKit 263627) ya da kapandıysa, yenisi yalnızca
 *   bir sonraki AÇIK harekette ve bir kez kurulur — yeniden kurma döngüsü olmaz.
 * - Ses kapalıysa hiç motor kurulmaz; tercih localStorage'da saklanır.
 *
 * Bilinen platform sınırı: Web Audio'nun varsayılan ses oturumu "ambient" türündedir. iPhone sessiz
 * moddayken (yan anahtar / Eylem düğmesi / Denetim Merkezi) bu sesler iOS tarafından kısılır.
 * Kullanıcı kararı: sessiz moda uyulur; audioSession.type değiştirilmez.
 */
const SOUND_KEY = 'popgrid:v1:sound'

export type JokerSound = 'cekic' | 'yenile' | 'dondur'

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
  /** pageshow / pagehide olayları window üzerinde gelir (iOS ana ekran uygulamasında da). */
  readonly win?: {
    addEventListener(type: string, listener: () => void, options?: AddEventListenerOptions): void
  }
  /** iOS 17+ navigator.audioSession.type (yalnızca tanı panelinde gösterilir; değiştirilmez). */
  readonly audioSessionType?: () => string | undefined
  /** Zamanlayıcı (testlerde aynı kalır; burada yalnızca okunabilirlik için). */
  readonly now?: () => number
}

export interface SoundStatus {
  readonly supported: boolean
  readonly enabled: boolean
  /** Motor durumu: yok / suspended / running / interrupted / closed */
  readonly state: string
  /** Şimdiye kadar kurulan motor sayısı. Sağlıklı oyunda 1 kalmalı. */
  readonly contexts: number
  /** Motor en az bir kez gerçekten çalıştı mı (iOS kilidi açıldı mı)? */
  readonly unlocked: boolean
  /** Arka plana kaç kez gidildi. */
  readonly backgrounds: number
  /** Motorun saati (saniye): çalışıyorsa ilerler. */
  readonly clock: number
  readonly lastGesture: string
  readonly audioSession: string
  readonly lastError: string
  /** Son olaylar (en yenisi sonda): arka plan, dönüş, etkileşim, durum geçişi, sonuç. */
  readonly log: readonly string[]
}

export interface SoundSystem {
  isEnabled(): boolean
  setEnabled(on: boolean): void
  /** Kullanıcı etkileşimi sırasında çağrılır. */
  unlock(gesture?: string): void
  playPlace(): void
  playClear(lines: number, combo: number): void
  /** Joker sesleri (yalnızca Eğlence Modu, joker gerçekten uygulandığında). */
  playJoker(kind: JokerSound): void
  /** Satın alma sesi (Aşama 7.3c): yalnızca kalıcı kaydı başarılı olan alımda çağrılır. */
  playPurchase(): void
  status(): SoundStatus
  /** Belge ve pencere olaylarını dinlemeye başlar (bir kez). */
  install(): void
}

/**
 * iOS'un kesin "açık kullanıcı hareketi" saydığı olaylar. Yeni bir motor yalnızca bunlarda kurulur.
 * Sürükleme (pointerdown / sürüklemenin bittiği touchend) iOS'ta hareket sayılmaz (WebKit 149367).
 */
const EXPLICIT_GESTURES = new Set(['click', 'keydown', 'ses düğmesi'])

/** Motor "running" görünüp saati ilerlemiyorsa durmuş kabul edilir (WebKit 263627). */
export const STALL_CHECK_MS = 250
const LOG_SIZE = 14

export function createSoundSystem(env: SoundEnv): SoundSystem {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  /** Bu motor en az bir kez çalıştı: iOS'ta kilidi açıldı, sonraki resume() için hareket gerekmez. */
  let unlocked = false
  /** Motor gerçekten durmuş/kapanmış: bir sonraki AÇIK harekette (tıklama) bir kez yenisi kurulur. */
  let needsRecreate = false
  /** resume() çağrıldı, sonucu bekleniyor: bu sırada planlanan sesler motor açılınca çalar. */
  let resuming = false
  let checking = false
  /** Durmuş motor için suspend/resume bir kez denendi mi? */
  let kicked = false
  let contexts = 0
  let backgrounds = 0
  let lastGesture = ''
  let lastError = ''
  let installed = false
  const started = (env.now ?? Date.now)()
  const log: string[] = []
  let enabled = (() => {
    try {
      return env.storage?.getItem(SOUND_KEY) !== 'off'
    } catch {
      return true
    }
  })()

  const stateOf = () => (ctx ? String(ctx.state) : 'yok')
  const note = (msg: string) => {
    const t = (((env.now ?? Date.now)() - started) / 1000).toFixed(1)
    log.push(`${t}s ${msg}`)
    if (log.length > LOG_SIZE) log.shift()
  }
  const remember = (e: unknown) => {
    lastError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    note(`hata: ${lastError}`)
  }

  function dispose(): void {
    const old = ctx
    ctx = null
    master = null
    resuming = false
    unlocked = false
    kicked = false
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
        if (ac !== ctx) return
        const st = String(ac.state)
        note(`motor → ${st}`)
        if (st === 'running') unlocked = true
        // Kapanmış motor geri gelmez. "interrupted" (arama, Siri, arka plan) ise kendi motorumuzla sürdürülür.
        if (st === 'closed') needsRecreate = true
      }
      ctx = ac
      master = gain
      contexts += 1
      note(`motor kuruldu (#${contexts})`)
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

  /** "running" görünen motorun saati gerçekten ilerliyor mu? İlerlemiyorsa yenilemeye işaretle. */
  function checkClock(ac: AudioContext): void {
    if (checking) return
    checking = true
    const before = ac.currentTime
    setTimeout(() => {
      checking = false
      if (ac !== ctx || String(ac.state) !== 'running') return
      if (ac.currentTime > before) {
        kicked = false
        return
      }
      if (!kicked) {
        // WebKit 263627 geçici çözümü: önce aynı motoru durdurup yeniden başlat, sonra tekrar ölç.
        kicked = true
        note('motor running ama saati durmuş → suspend/resume deneniyor')
        ac.suspend()
          .then(() => ac.resume())
          .then(() => checkClock(ac))
          .catch(remember)
        return
      }
      note('saat hâlâ durmuş → sonraki tıklamada yeni motor kurulacak')
      needsRecreate = true
    }, STALL_CHECK_MS)
  }

  /** Mevcut motoru sürdürmeyi dener (kilidi açılmış motor için iOS hareket istemez). */
  function resumeCurrent(ac: AudioContext, why: string): void {
    if (String(ac.state) === 'running') {
      checkClock(ac)
      return
    }
    primeSilently(ac)
    resuming = true
    ac.resume()
      .then(() => {
        if (ac !== ctx) return
        note(`${why}: resume → ${String(ac.state)}`)
        if (String(ac.state) === 'running') {
          unlocked = true
          checkClock(ac)
        }
      })
      .catch(remember)
      .finally(() => {
        if (ac === ctx) resuming = false
      })
  }

  function unlock(gesture = 'manual'): void {
    if (!enabled) return
    lastGesture = gesture
    const explicit = EXPLICIT_GESTURES.has(gesture)
    // Yeni motor yalnızca açık bir harekette ve gerçekten gerekiyorsa kurulur; dönüş başına en fazla bir kez.
    if (needsRecreate && explicit) {
      note(`${gesture}: durmuş motor yenileniyor`)
      needsRecreate = false
      dispose()
    }
    if (!ctx) {
      if (!create()) return
    }
    if (ctx) resumeCurrent(ctx, gesture)
  }

  function onHidden(source: string): void {
    backgrounds += 1
    note(`arka plan (${source}), motor ${stateOf()}`)
    if (ctx && String(ctx.state) === 'running') ctx.suspend().catch(remember)
  }

  function onShown(source: string): void {
    note(`ön plan (${source}), motor ${stateOf()}`)
    // Kilidi açılmış motor hareket beklemeden sürdürülebilir; olmazsa ilk dokunuş tekrar dener.
    if (ctx && enabled) resumeCurrent(ctx, `dönüş (${source})`)
  }

  function ready(): AudioContext | null {
    if (!enabled || !ctx || !master) return null
    const st = String(ctx.state)
    return st === 'running' || (resuming && st !== 'closed') ? ctx : null
  }

  return {
    isEnabled: () => enabled,
    setEnabled(on) {
      enabled = on
      note(`ses ${on ? 'açıldı' : 'kapatıldı'}`)
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
    playJoker(kind) {
      // Aynı motor ve aynı "hazır mı" kontrolü: arka plan/ön plan ve sessiz mod davranışı değişmez.
      const ac = ready()
      if (!ac || !master) return
      jokerSound(ac, master, kind)
    },
    playPurchase() {
      // Aynı motor ve aynı "hazır mı" kontrolü: ses kapalıysa motor kurulmaz, iPhone sessiz moduna uyulur.
      const ac = ready()
      if (!ac || !master) return
      purchaseSound(ac, master)
    },
    status: () => ({
      supported: !!env.AudioContextCtor,
      enabled,
      state: stateOf(),
      contexts,
      unlocked,
      backgrounds,
      clock: ctx ? Math.round(ctx.currentTime * 10) / 10 : 0,
      lastGesture: lastGesture || '-',
      audioSession: env.audioSessionType?.() ?? 'desteklenmiyor',
      lastError: lastError || '-',
      log: [...log],
    }),
    install() {
      if (installed) return
      installed = true
      for (const type of UNLOCK_EVENTS) {
        env.doc.addEventListener(type, () => unlock(type), { capture: true, passive: true })
      }
      env.doc.addEventListener('visibilitychange', () => {
        if (env.doc.visibilityState === 'hidden') onHidden('visibilitychange')
        else onShown('visibilitychange')
      })
      env.win?.addEventListener('pagehide', () => onHidden('pagehide'))
      env.win?.addEventListener('pageshow', () => onShown('pageshow'))
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

/**
 * Joker sesleri: yalnızca osilatör (dosya, gürültü tamponu, filtre yok) — eski telefonlarda da hafif.
 * - Çekiç: alçak, tok bir darbe + kısa, kuru bir çatırtı.
 * - Yenile: iki notalı neşeli yükseliş + ince parıltı.
 * - Döndür: yumuşak, kısa bir "vınn" (kayarak yükselen ses).
 */
function jokerSound(ac: AudioContext, out: AudioNode, kind: JokerSound): void {
  if (kind === 'cekic') {
    tone(ac, out, { freq: 150, dur: 0.14, type: 'sine', gain: 0.32, slide: 0.45 })
    tone(ac, out, { freq: 95, dur: 0.09, type: 'triangle', gain: 0.14, slide: 0.7 })
    tone(ac, out, { freq: 2300, dur: 0.03, type: 'triangle', gain: 0.05, slide: 0.4 })
    tone(ac, out, { freq: 1500, at: 0.018, dur: 0.035, type: 'triangle', gain: 0.04, slide: 0.5 })
    return
  }
  if (kind === 'yenile') {
    tone(ac, out, { freq: 659.25, dur: 0.1, type: 'triangle', gain: 0.13, slide: 1.12 })
    tone(ac, out, { freq: 987.77, at: 0.07, dur: 0.12, type: 'triangle', gain: 0.12 })
    tone(ac, out, { freq: 1567.98, at: 0.13, dur: 0.1, type: 'sine', gain: 0.05 })
    return
  }
  tone(ac, out, { freq: 520, dur: 0.1, type: 'sine', gain: 0.13, slide: 1.4 })
  tone(ac, out, { freq: 780, at: 0.035, dur: 0.07, type: 'triangle', gain: 0.045, slide: 1.2 })
}

/** Satın alma sesi seviyesi (Aşama 7.3c): Yenile/Döndür seslerine yakın, yumuşak. */
export const PURCHASE_GAIN = 0.11

/** Satın alma: iki notalı, yükselen yumuşak "çin" (Do6 → Sol6), toplam ~160 ms. Yalnızca osilatör. */
function purchaseSound(ac: AudioContext, out: AudioNode): void {
  tone(ac, out, { freq: 1046.5, dur: 0.09, type: 'triangle', gain: PURCHASE_GAIN })
  tone(ac, out, { freq: 1567.98, at: 0.06, dur: 0.1, type: 'triangle', gain: PURCHASE_GAIN })
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
        win: window,
        audioSessionType: () => (navigator as unknown as { audioSession?: { type?: string } }).audioSession?.type,
      })
system?.install()

export const isSoundEnabled = (): boolean => system?.isEnabled() ?? false
export const setSoundEnabled = (on: boolean): void => system?.setEnabled(on)
export const unlockAudio = (): void => system?.unlock('react')
export const playPlace = (): void => system?.playPlace()
export const playClear = (lines: number, combo: number): void => system?.playClear(lines, combo)
export const playJoker = (kind: JokerSound): void => system?.playJoker(kind)
export const playPurchase = (): void => system?.playPurchase()
export const soundStatus = (): SoundStatus | null => system?.status() ?? null
