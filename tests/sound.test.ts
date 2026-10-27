import { describe, expect, it } from 'vitest'
import { UNLOCK_EVENTS, createSoundSystem, type SoundEnv } from '../src/audio/sound'

/**
 * iOS'u taklit eden sahte ses motoru: resume() reddedilebilir (etkileşim sayılmayan olay),
 * WebKit'e özgü "interrupted" durumuna geçebilir, kapatılabilir.
 */
class FakeCtx {
  static instances: FakeCtx[] = []
  static allowResume = true
  static failResume = false
  state = 'suspended'
  currentTime = 0
  destination = {}
  onstatechange: (() => void) | null = null
  tones = 0
  primes = 0
  constructor() {
    FakeCtx.instances.push(this)
  }
  setState(s: string) {
    this.state = s
    this.onstatechange?.()
  }
  resume() {
    if (FakeCtx.failResume) return Promise.reject(new Error('NotAllowedError: etkileşim yok'))
    if (FakeCtx.allowResume && this.state !== 'closed') this.setState('running')
    return Promise.resolve()
  }
  suspend() {
    if (this.state !== 'closed') this.setState('suspended')
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

function setup(opts: { stored?: string | null; noAudio?: boolean } = {}) {
  FakeCtx.instances = []
  FakeCtx.allowResume = true
  FakeCtx.failResume = false
  const store = new Map<string, string>()
  if (opts.stored) store.set('popgrid:v1:sound', opts.stored)
  const listeners = new Map<string, Array<() => void>>()
  const doc = {
    visibilityState: 'visible',
    addEventListener(type: string, fn: () => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn])
    },
  }
  const env: SoundEnv = {
    AudioContextCtor: opts.noAudio ? undefined : (FakeCtx as unknown as new () => AudioContext),
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    doc,
    audioSessionType: () => 'auto',
  }
  const sound = createSoundSystem(env)
  sound.install()
  const fire = async (type: string) => {
    for (const fn of listeners.get(type) ?? []) fn()
    await new Promise((r) => setTimeout(r, 0))
  }
  const last = () => FakeCtx.instances[FakeCtx.instances.length - 1]!
  return { sound, store, doc, listeners, fire, last }
}

describe('ses sistemi (iOS davranışları sahte motorla)', () => {
  it('açılışta ses motoru kurulmaz ve ses çalmaz', () => {
    const { sound } = setup()
    sound.playPlace()
    sound.playClear(2, 2)
    expect(FakeCtx.instances).toHaveLength(0)
    expect(sound.status().state).toBe('yok')
  })

  it('iOS etkileşim olaylarının hepsi dinlenir (touchend ve click dahil), her biri bir kez', () => {
    const { sound, listeners } = setup()
    sound.install()
    for (const type of UNLOCK_EVENTS) expect(listeners.get(type)).toHaveLength(1)
    expect(UNLOCK_EVENTS).toContain('touchend')
    expect(UNLOCK_EVENTS).toContain('click')
  })

  it('ilk dokunuş motoru açar, sessiz tampon çalar; sonra sesler çalar', async () => {
    const { sound, fire, last } = setup()
    await fire('touchend')
    expect(FakeCtx.instances).toHaveLength(1)
    expect(last().state).toBe('running')
    expect(last().primes).toBe(1)
    sound.playPlace()
    expect(last().tones).toBe(2)
    expect(sound.status().lastGesture).toBe('touchend')
  })

  it('pointerdown etkileşim sayılmazsa (iOS) motor bekler; touchend gelince açılır', async () => {
    const { sound, fire, last } = setup()
    FakeCtx.allowResume = false
    await fire('pointerdown')
    expect(last().state).toBe('suspended')
    sound.playPlace()
    expect(last().tones).toBe(0)
    FakeCtx.allowResume = true
    await fire('touchend')
    expect(FakeCtx.instances).toHaveLength(1)
    expect(last().state).toBe('running')
    sound.playPlace()
    expect(last().tones).toBe(2)
  })

  it('motor "interrupted" olursa sonraki dokunuşta eskisi kapatılıp yenisi kurulur', async () => {
    const { sound, fire } = setup()
    await fire('touchend')
    const first = FakeCtx.instances[0]!
    first.setState('interrupted')
    sound.playPlace()
    expect(first.tones).toBe(0)
    await fire('click')
    expect(FakeCtx.instances).toHaveLength(2)
    expect(first.state).toBe('closed')
    const second = FakeCtx.instances[1]!
    expect(second.state).toBe('running')
    sound.playClear(1, 1)
    expect(second.tones).toBeGreaterThan(0)
  })

  it('arka plandan dönüşte ("running" görünse bile) sonraki dokunuşta motor yenilenir', async () => {
    const { sound, fire, doc } = setup()
    await fire('touchend')
    const first = FakeCtx.instances[0]!
    doc.visibilityState = 'hidden'
    await fire('visibilitychange')
    expect(first.state).toBe('suspended')
    doc.visibilityState = 'visible'
    await fire('visibilitychange')
    expect(first.state).toBe('running')
    await fire('pointerdown')
    expect(FakeCtx.instances).toHaveLength(2)
    expect(first.state).toBe('closed')
    sound.playPlace()
    expect(FakeCtx.instances[1]!.tones).toBe(2)
    expect(sound.status().contexts).toBe(2)
  })

  it('ses kapalı tercihi saklanır ve kapalıyken motor hiç kurulmaz', async () => {
    const { sound, fire, store } = setup({ stored: 'off' })
    expect(sound.isEnabled()).toBe(false)
    await fire('touchend')
    expect(FakeCtx.instances).toHaveLength(0)
    sound.setEnabled(true)
    await new Promise((r) => setTimeout(r, 0))
    expect(store.get('popgrid:v1:sound')).toBe('on')
    expect(FakeCtx.instances).toHaveLength(1)
    sound.setEnabled(false)
    await new Promise((r) => setTimeout(r, 0))
    expect(store.get('popgrid:v1:sound')).toBe('off')
    expect(FakeCtx.instances[0]!.state).toBe('suspended')
    sound.playPlace()
    expect(FakeCtx.instances[0]!.tones).toBe(0)
  })

  it('kayıt yoksa ses varsayılan olarak açıktır (Mac/masaüstü davranışı değişmedi)', () => {
    const { sound } = setup({ stored: null })
    expect(sound.isEnabled()).toBe(true)
  })

  it('resume reddedilirse hata yutulmaz, tanı için kaydedilir; oyun çökmez', async () => {
    const { sound, fire } = setup()
    FakeCtx.failResume = true
    await fire('touchend')
    expect(sound.status().lastError).toBe('Error: NotAllowedError: etkileşim yok')
    sound.playPlace()
    expect(FakeCtx.instances[0]!.tones).toBe(0)
  })

  it('Web Audio olmayan tarayıcıda hata vermez', async () => {
    const { sound, fire } = setup({ noAudio: true })
    await fire('touchend')
    sound.playPlace()
    expect(sound.status().supported).toBe(false)
    expect(sound.status().state).toBe('yok')
  })
})
