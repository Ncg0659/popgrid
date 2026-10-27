import { describe, expect, it } from 'vitest'
import { STALL_CHECK_MS, UNLOCK_EVENTS, createSoundSystem, type SoundEnv } from '../src/audio/sound'

/**
 * WebKit (iOS) kurallarını taklit eden sahte ses motoru:
 * - Yeni motor yalnızca "açık hareket" sırasında başlar (tıklama, tuş, dokunup bırakma).
 *   touchstart/pointerdown ve sürüklemenin bittiği touchend sayılmaz (WebKit 149367).
 * - Bir kez başlamış (kilidi açılmış) motor sonradan hareket olmadan resume() edilebilir.
 * - "interrupted" durumuna geçebilir; "running" görünüp saati durabilir (WebKit 263627).
 * desktop = true: masaüstü tarayıcı gibi her etkileşimde başlar.
 */
class FakeCtx {
  static instances: FakeCtx[] = []
  static gesture = false
  static desktop = false
  static failResume = false
  state = 'suspended'
  unlocked = false
  /** Saat durmuş ("running" ama ses yok). kickFixes: suspend/resume bunu düzeltir mi? */
  stalled = false
  kickFixes = false
  private base = 0
  private since = 0
  destination = {}
  onstatechange: (() => void) | null = null
  tones = 0
  primes = 0
  constructor() {
    FakeCtx.instances.push(this)
  }
  get currentTime() {
    return this.state === 'running' && !this.stalled ? this.base + (Date.now() - this.since) / 1000 : this.base
  }
  setState(s: string) {
    this.base = this.currentTime
    this.since = Date.now()
    this.state = s
    this.onstatechange?.()
  }
  resume() {
    if (FakeCtx.failResume) return Promise.reject(new Error('Bilinmeyen hata'))
    if (this.state === 'closed') return Promise.reject(new Error('InvalidStateError: kapalı'))
    if (!this.unlocked && !FakeCtx.gesture && !FakeCtx.desktop) {
      return Promise.reject(new Error('NotAllowedError: açık hareket yok'))
    }
    this.unlocked = true
    this.setState('running')
    return Promise.resolve()
  }
  suspend() {
    if (this.state !== 'closed') this.setState('suspended')
    if (this.kickFixes) this.stalled = false
    return Promise.resolve()
  }
  close() {
    this.setState('closed')
    return Promise.resolve()
  }
  createGain() {
    const param = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }
    return { gain: param, connect() {} }
  }
  createOscillator() {
    return {
      type: '',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start: () => {
        this.tones++
      },
      stop() {},
    }
  }
  createBuffer() {
    return {}
  }
  createBufferSource() {
    return {
      buffer: null,
      connect() {},
      start: () => {
        this.primes++
      },
    }
  }
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

function setup(opts: { stored?: string | null; noAudio?: boolean; desktop?: boolean } = {}) {
  FakeCtx.instances = []
  FakeCtx.gesture = false
  FakeCtx.desktop = !!opts.desktop
  FakeCtx.failResume = false
  const store = new Map<string, string>()
  if (opts.stored) store.set('popgrid:v1:sound', opts.stored)
  const docListeners = new Map<string, Array<() => void>>()
  const winListeners = new Map<string, Array<() => void>>()
  const add = (map: Map<string, Array<() => void>>) => (type: string, fn: () => void) => {
    map.set(type, [...(map.get(type) ?? []), fn])
  }
  const doc = { visibilityState: 'visible', addEventListener: add(docListeners) }
  const env: SoundEnv = {
    AudioContextCtor: opts.noAudio ? undefined : (FakeCtx as unknown as new () => AudioContext),
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    doc,
    win: { addEventListener: add(winListeners) },
    audioSessionType: () => 'auto',
  }
  const sound = createSoundSystem(env)
  sound.install()

  /** Olayı tetikler. explicit: iOS'un açık hareket saydığı bir an mı (tıklama / dokunup bırakma)? */
  const fire = async (type: string, explicit = type === 'click' || type === 'keydown') => {
    FakeCtx.gesture = explicit
    for (const fn of docListeners.get(type) ?? []) fn()
    FakeCtx.gesture = false
    await tick()
  }
  const fireWin = async (type: string) => {
    for (const fn of winListeners.get(type) ?? []) fn()
    await tick()
  }
  /** Tepsiden tahtaya sürükleme: iOS'ta hiçbiri açık hareket değildir. */
  const drag = async () => {
    await fire('pointerdown', false)
    await fire('pointerup', false)
    await fire('touchend', false)
  }
  /** Bir düğmeye dokunup bırakma: touchend (dokunuş) + click açık harekettir. */
  const tap = async () => {
    await fire('pointerdown', false)
    await fire('pointerup', false)
    await fire('touchend', true)
    await fire('click', true)
  }
  const background = async (via: 'visibility' | 'page' = 'visibility') => {
    doc.visibilityState = 'hidden'
    if (via === 'visibility') await fire('visibilitychange', false)
    else await fireWin('pagehide')
  }
  const foreground = async (via: 'visibility' | 'page' = 'visibility') => {
    doc.visibilityState = 'visible'
    if (via === 'visibility') await fire('visibilitychange', false)
    else await fireWin('pageshow')
  }
  const ctxAt = (i: number) => FakeCtx.instances[i]!
  return { sound, store, docListeners, winListeners, fire, drag, tap, background, foreground, ctxAt }
}

describe('ses sistemi: ilk açılış', () => {
  it('açılışta ses motoru kurulmaz ve ses çalmaz', () => {
    const { sound } = setup()
    sound.playPlace()
    sound.playClear(2, 2)
    expect(FakeCtx.instances).toHaveLength(0)
    expect(sound.status().state).toBe('yok')
  })

  it('etkileşim olayları ve arka plan olayları (visibilitychange, pageshow, pagehide) birer kez dinlenir', () => {
    const { sound, docListeners, winListeners } = setup()
    sound.install()
    for (const type of UNLOCK_EVENTS) expect(docListeners.get(type)).toHaveLength(1)
    expect(docListeners.get('visibilitychange')).toHaveLength(1)
    expect(winListeners.get('pageshow')).toHaveLength(1)
    expect(winListeners.get('pagehide')).toHaveLength(1)
  })

  it('bir dokunuş (tıklama) motoru açar, sessiz tampon çalar; sonra sesler çalar', async () => {
    const { sound, tap, ctxAt } = setup()
    await tap()
    expect(FakeCtx.instances).toHaveLength(1)
    expect(ctxAt(0).state).toBe('running')
    expect(ctxAt(0).primes).toBeGreaterThan(0)
    sound.playPlace()
    expect(ctxAt(0).tones).toBe(2)
    expect(sound.status().unlocked).toBe(true)
  })

  it('iOS sınırı: ilk açılışta yalnızca sürükleme motoru açamaz, ilk dokunuşta açılır (motor yenilenmez)', async () => {
    const { sound, drag, tap, ctxAt } = setup()
    await drag()
    expect(FakeCtx.instances).toHaveLength(1)
    expect(ctxAt(0).state).toBe('suspended')
    sound.playPlace()
    expect(ctxAt(0).tones).toBe(0)
    await tap()
    expect(FakeCtx.instances).toHaveLength(1)
    expect(ctxAt(0).state).toBe('running')
  })
})

describe('ses sistemi: arka plandan dönüş (iPhone bulgusu)', () => {
  it('KULLANICI SENARYOSU: ses çalışırken arka plana gidip dönünce ilk SÜRÜKLEME ile ses çalar', async () => {
    const { sound, tap, drag, background, foreground, ctxAt } = setup()
    await tap()
    await background()
    expect(ctxAt(0).state).toBe('suspended')
    await foreground()
    await drag()
    sound.playPlace()
    expect(FakeCtx.instances).toHaveLength(1)
    expect(ctxAt(0).state).toBe('running')
    expect(ctxAt(0).tones).toBe(2)
  })

  it('dönüşte motor hareket beklemeden sürdürülür (Yenile düğmesine basmak gerekmez)', async () => {
    const { sound, tap, background, foreground, ctxAt } = setup()
    await tap()
    await background()
    await foreground()
    expect(ctxAt(0).state).toBe('running')
    sound.playClear(1, 1)
    expect(ctxAt(0).tones).toBeGreaterThan(0)
    expect(sound.status().backgrounds).toBe(1)
  })

  it('pagehide / pageshow ile dönüş de aynı şekilde çalışır', async () => {
    const { sound, tap, drag, background, foreground, ctxAt } = setup()
    await tap()
    await background('page')
    await foreground('page')
    await drag()
    sound.playPlace()
    expect(FakeCtx.instances).toHaveLength(1)
    expect(ctxAt(0).tones).toBe(2)
  })

  it('iOS motoru "interrupted" yaparsa ilk sürüklemede aynı motor sürdürülür', async () => {
    const { sound, tap, drag, ctxAt } = setup()
    await tap()
    ctxAt(0).setState('interrupted')
    sound.playPlace()
    expect(ctxAt(0).tones).toBe(0)
    await drag()
    expect(FakeCtx.instances).toHaveLength(1)
    expect(ctxAt(0).state).toBe('running')
    sound.playPlace()
    expect(ctxAt(0).tones).toBe(2)
  })

  it('"running" görünüp saati duran motor önce suspend/resume ile kurtarılır (yeni motor yok)', async () => {
    const { sound, tap, background, foreground, ctxAt } = setup()
    await tap()
    ctxAt(0).stalled = true
    ctxAt(0).kickFixes = true
    await background()
    await foreground()
    await tick(STALL_CHECK_MS * 2 + 80)
    expect(FakeCtx.instances).toHaveLength(1)
    expect(ctxAt(0).stalled).toBe(false)
    expect(ctxAt(0).state).toBe('running')
    sound.playPlace()
    expect(ctxAt(0).tones).toBe(2)
  })

  it('kurtarılamayan durmuş motor: sürükleme yenilemez, ilk tıklama BİR KEZ yeni motor kurar (döngü yok)', async () => {
    const { sound, tap, drag, background, foreground, ctxAt } = setup()
    await tap()
    ctxAt(0).stalled = true
    await background()
    await foreground()
    await tick(STALL_CHECK_MS * 3 + 100)
    await drag()
    expect(FakeCtx.instances).toHaveLength(1)
    await tap()
    expect(FakeCtx.instances).toHaveLength(2)
    expect(ctxAt(0).state).toBe('closed')
    expect(ctxAt(1).state).toBe('running')
    sound.playPlace()
    expect(ctxAt(1).tones).toBe(2)
    await tap()
    await tap()
    expect(FakeCtx.instances).toHaveLength(2)
  })

  it('sağlıklı motorla tekrar tekrar arka plana gidip dönmek yeni motor kurmaz', async () => {
    const { sound, tap, drag, background, foreground, ctxAt } = setup()
    await tap()
    for (let i = 0; i < 5; i++) {
      await background()
      await foreground()
      await drag()
    }
    await tick(STALL_CHECK_MS + 50)
    expect(FakeCtx.instances).toHaveLength(1)
    expect(sound.status().contexts).toBe(1)
    expect(sound.status().backgrounds).toBe(5)
    sound.playPlace()
    expect(ctxAt(0).tones).toBe(2)
  })

  it('tanı günlüğü arka plan, dönüş ve motor geçişlerini kaydeder', async () => {
    const { sound, tap, background, foreground } = setup()
    await tap()
    await background()
    await foreground()
    const log = sound.status().log.join('\n')
    expect(log.includes('motor kuruldu (#1)')).toBe(true)
    expect(log.includes('arka plan (visibilitychange)')).toBe(true)
    expect(log.includes('ön plan (visibilitychange)')).toBe(true)
    expect(log.includes('motor → running')).toBe(true)
  })
})

describe('ses sistemi: tercih, masaüstü ve hatalar', () => {
  it('ses kapalı tercihi saklanır; kapalıyken motor kurulmaz, arka plan dönüşü de kurmaz', async () => {
    const { sound, tap, background, foreground, store } = setup({ stored: 'off' })
    expect(sound.isEnabled()).toBe(false)
    await tap()
    await background()
    await foreground()
    expect(FakeCtx.instances).toHaveLength(0)
    FakeCtx.gesture = true
    sound.setEnabled(true)
    FakeCtx.gesture = false
    await tick()
    expect(store.get('popgrid:v1:sound')).toBe('on')
    expect(FakeCtx.instances[0]!.state).toBe('running')
    sound.setEnabled(false)
    await tick()
    expect(store.get('popgrid:v1:sound')).toBe('off')
    expect(FakeCtx.instances[0]!.state).toBe('suspended')
    sound.playPlace()
    expect(FakeCtx.instances[0]!.tones).toBe(0)
  })

  it('kayıt yoksa ses varsayılan olarak açıktır', () => {
    const { sound } = setup({ stored: null })
    expect(sound.isEnabled()).toBe(true)
  })

  it('masaüstü (Mac): fareyle ilk etkileşim motoru açar, arka plan dönüşünde de tek motor kalır', async () => {
    const { sound, fire, background, foreground, ctxAt } = setup({ desktop: true })
    await fire('pointerdown', false)
    expect(ctxAt(0).state).toBe('running')
    sound.playPlace()
    expect(ctxAt(0).tones).toBe(2)
    await background()
    await foreground()
    await fire('pointerdown', false)
    expect(FakeCtx.instances).toHaveLength(1)
    sound.playPlace()
    expect(ctxAt(0).tones).toBe(4)
  })

  it('resume hatası yutulmaz, tanı için kaydedilir; oyun çökmez', async () => {
    const { sound, tap } = setup()
    FakeCtx.failResume = true
    await tap()
    expect(sound.status().lastError).toBe('Error: Bilinmeyen hata')
    sound.playPlace()
    expect(FakeCtx.instances[0]!.tones).toBe(0)
  })

  it('Web Audio olmayan tarayıcıda hata vermez', async () => {
    const { sound, tap } = setup({ noAudio: true })
    await tap()
    sound.playPlace()
    expect(sound.status().supported).toBe(false)
    expect(sound.status().state).toBe('yok')
  })
})

describe('ses sistemi: joker sesleri (Aşama 6.3)', () => {
  it('açılışta (hareket yokken) joker sesi motor kurmaz ve çalmaz', () => {
    const { sound } = setup()
    sound.playJoker('cekic')
    sound.playJoker('yenile')
    sound.playJoker('dondur')
    expect(FakeCtx.instances).toHaveLength(0)
  })

  it('üç joker sesi aynı motoru kullanır; Klasik sesleri değişmez (yerleştirme hâlâ 2 ton)', async () => {
    const { sound, tap, ctxAt } = setup()
    await tap()
    sound.playPlace()
    expect(ctxAt(0).tones).toBe(2)
    sound.playJoker('cekic')
    const afterHammer = ctxAt(0).tones
    sound.playJoker('yenile')
    const afterRefresh = ctxAt(0).tones
    sound.playJoker('dondur')
    expect(afterHammer - 2).toBe(4)
    expect(afterRefresh - afterHammer).toBe(3)
    expect(ctxAt(0).tones - afterRefresh).toBe(2)
    expect(FakeCtx.instances).toHaveLength(1)
  })

  it('KULLANICI SENARYOSU: arka plana gidip dönünce joker sesi aynı motorla çalar (yeni motor yok)', async () => {
    const { sound, tap, drag, background, foreground, ctxAt } = setup()
    await tap()
    await background()
    sound.playJoker('cekic')
    expect(ctxAt(0).tones).toBe(0) // arka planda ses yok
    await foreground()
    await drag()
    sound.playJoker('dondur')
    expect(FakeCtx.instances).toHaveLength(1)
    expect(ctxAt(0).state).toBe('running')
    expect(ctxAt(0).tones).toBe(2)
    // pagehide/pageshow ile de aynı
    await background('page')
    await foreground('page')
    sound.playJoker('yenile')
    expect(FakeCtx.instances).toHaveLength(1)
    expect(ctxAt(0).tones).toBe(5)
  })

  it('ses kapalıyken joker sesi çalmaz ve motor kurmaz', async () => {
    const { sound, tap } = setup({ stored: 'off' })
    await tap()
    sound.playJoker('cekic')
    expect(FakeCtx.instances).toHaveLength(0)
  })

  it('durmuş motorda joker sesi yeni motor kurmaz (yalnızca açık hareket kurar)', async () => {
    const { sound, tap, drag, ctxAt } = setup()
    await tap()
    ctxAt(0).close()
    await tick()
    await drag()
    sound.playJoker('cekic')
    expect(FakeCtx.instances).toHaveLength(1)
    await tap()
    expect(FakeCtx.instances).toHaveLength(2)
  })
})
