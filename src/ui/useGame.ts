import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CONFIG, NO_JOKERS, applyJoker, getShape, giveUp as engineGiveUp, grantJokers, newGame } from '../engine'
import type { GameEvent, GameMode, GameState, JokerAction, JokerCharges, JokerInvalidReason, JokerKind, Slot } from '../engine/types'
import { describeEffect, type Effect } from '../fx/effects'
import { describeJokerFx, type JokerFx } from '../fx/jokerEffects'
import { newGameId, type StoreFailure } from '../storage/economy'
import { modeStore } from '../storage/mode'
import { loadBest, restoreBest, saveBest } from '../storage/records'
import {
  CAP_TEXT,
  finishedGameStars,
  purchasedUsedInGame,
  reachedCapNow,
  recordCategory,
  recordView,
  type GameStars,
  type RecordView,
} from './economyUi'
import type { ArmedJoker } from './jokerUi'
import { starsGained, type StarPulse } from './starFeedback'
import type { EconomyApi } from './useEconomy'
import { originFor, previewMove, type Origin, type Preview } from './placement'

/** Yeni oyun tohumu: adreste ?seed=123 varsa o, yoksa tarayıcının kripto rastgeleliği (motor dışında). */
function freshSeed(): number {
  try {
    const param = new URLSearchParams(window.location.search).get('seed')
    if (param !== null && /^\d+$/.test(param)) return Number(param) >>> 0
  } catch {
    // adres okunamazsa rastgele tohum
  }
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1
}

/** Adreste ?mode=eglence|klasik varsa (testler için) o, yoksa son seçilen mod. */
function initialMode(): GameMode {
  try {
    const param = new URLSearchParams(window.location.search).get('mode')
    if (param === 'eglence' || param === 'klasik') return param
  } catch {
    // yok say
  }
  return modeStore.load()
}

/**
 * Eğlence: oyun başına ücretsiz haklar (motorun varsayılanı) + oyuna getirilen satın alınmış haklar.
 * Satın alınmış haklar YALNIZCA ekonomi defterine kayıtlı oyuna getirilir (tek kaynak: src/storage/economy.ts).
 */
function createGame(mode: GameMode, inventory: JokerCharges = NO_JOKERS): GameState {
  if (mode === 'klasik') return newGame(freshSeed())
  return newGame(freshSeed(), DEFAULT_CONFIG, { mode, inventory })
}

/** Bu sekme sahipse ekonomi envanterinin tamamı oyuna getirilir; değilse yalnızca ücretsiz haklar. */
function inventoryFor(mode: GameMode, eco: EconomyApi): JokerCharges {
  return mode === 'eglence' && eco.ownsNow() ? eco.store.load().state.inventory : NO_JOKERS
}

/** Ekonomi işleminin joker kullanımını engellediği durumlarda gösterilecek açıklama. */
const ECONOMY_JOKER_TEXT: Partial<Record<StoreFailure, string>> = {
  otherTab: 'Satın alınmış joker şu an kullanılamıyor: POPGRID başka bir sekmede açık.',
  storageError: 'Kayıt yapılamıyor; satın alınmış joker kullanılamıyor. Ücretsiz hakların duruyor.',
  wrongGame: 'Satın alınmış joker bu oyunda kullanılamıyor (başka sekmede yeni oyun açıldı).',
  noActiveGame: 'Satın alınmış joker bu oyunda kullanılamıyor (başka sekmede yeni oyun açıldı).',
  readOnly: 'Kayıt daha yeni bir sürümden; satın alınmış joker kullanılamıyor.',
}

const usesInventory = (events: readonly GameEvent[]) =>
  events.some((e) => e.type === 'jokerUsed' && e.source === 'inventory')

type Bests = Readonly<Record<GameMode, number>>

/** Yenile'nin yanlışlıkla iki kez basılmasını önleyen bekleme (ms). */
export const REFRESH_GUARD_MS = 450

/** Joker geri bildirimi (ekran okuyucu ve durum satırı). id her mesajda artar. */
export interface JokerNotice {
  readonly id: number
  readonly text: string
}

export interface GameApi {
  readonly game: GameState
  readonly mode: GameMode
  /** Bu oyunun rekor kategorisindeki rekor (Eğlence'de satın alınmış joker kullanılınca ayrı kategori). */
  readonly best: number
  readonly bests: Bests
  /** Satın alınmış jokerli Eğlence rekoru (ekonomi defteri, funBests.withPurchased). */
  readonly boughtBest: number
  /** Bu oyun başladığında geçerli olan (normal) rekor. */
  readonly bestAtStart: number
  /** Bu oyunun rekor kategorisi, etiketi ve "yeni rekor" durumu (HUD ve oyun sonu kartı). */
  readonly record: RecordView
  readonly selected: Slot | null
  readonly preview: Preview | null
  /** Geçersiz denemede artar; arayüz sallanma geri bildirimi için kullanır. */
  readonly rejectCount: number
  /** Son başarılı hamlenin efekt tanımı (animasyon, parçacık, ses); yeni oyunda null. */
  readonly effect: Effect | null
  /** Hedef bekleyen joker (Çekiç: hücre, Döndür: parça). */
  readonly armed: ArmedJoker
  readonly notice: JokerNotice | null
  /** Son BAŞARILI jokerin efekt tanımı (animasyon + ses). Geçersiz/iptal edilen joker üretmez. */
  readonly jokerFx: JokerFx | null
  select(slot: Slot): void
  /** Dokunulan hücreye göre önizleme konumunu ayarlar. */
  aimAtCell(row: number, col: number): void
  /** Önizlemeyi doğrudan sol üst köşe ile taşır (klavye, sürükleme); null önizlemeyi kaldırır. */
  aimAt(origin: Origin | null): void
  /** Sürükleme başladı: parçayı seçer (aç/kapa değil). Seçili joker iptal olur, hak harcanmaz. */
  beginDrag(slot: Slot): void
  /** Sürüklenen parçayı bırakılan yere yerleştirmeyi dener; başarılıysa true. */
  dropAt(slot: Slot, origin: Origin): boolean
  /** Sürükleme iptal: seçimi ve önizlemeyi kaldırır. */
  cancelDrag(): void
  /** Önizlemedeki yerleşimi uygular; geçersizse reddeder. */
  confirm(): void
  /** Hücreye göre önizleyip hemen yerleştirir (fare tıklaması). */
  placeAtCell(row: number, col: number): void
  clearAim(): void
  /** Aynı modda yeni oyun. */
  restart(): void
  /** Seçilen modda yeni oyun; tercih kaydedilir. */
  startGame(mode: GameMode): void
  /** Çekiç/Döndür'ü hedef seçimine hazırlar; aynı jokere tekrar basmak vazgeçer. Hak harcanmaz. */
  arm(kind: 'cekic' | 'dondur'): void
  disarm(): void
  /** Yenile: tepside kalan parçaları değiştirir. */
  refresh(): void
  /** Çekiç seçiliyken hücreye vurur. Boş hücre: hak harcanmaz, mod açık kalır. */
  hammerCell(cell: number): void
  /** Döndür seçiliyken parçayı çevirir. İlk dönüş hak harcar, sonrakiler ücretsiz. */
  rotateSlot(slot: Slot): void
  /** "Bitir": sıkışınca oyunu sonlandırır. */
  giveUp(): void
  /** Biten oyunun yıldız özeti (oyun sonu kartı); oyun sürerken null. */
  readonly gameStars: GameStars | null
  /** Kısa yıldız bilgisi (ör. 300 sınırına ulaşıldı). id her mesajda artar. */
  readonly starNotice: JokerNotice | null
  /** Bu sekmedeki son yıldız kazanımı / harcaması (yıldız düğmesi geri bildirimi, Aşama 7.3b). */
  readonly starPulse: StarPulse | null
  /** Harcamayı yıldız düğmesine bildirir (mağaza; Aşama 7.3c). */
  pulseStars(kind: StarPulse['kind'], amount: number): void
  /** Mağazadan oyuna eklenen jokerler: hak sayıları mağaza kapanınca bir kez zıplar (Aşama 7.3c). */
  readonly jokerBump: { readonly id: number; readonly kinds: readonly JokerKind[] } | null
  /** Mağaza kapandı: bekleyen zıplamaları başlatır. */
  flushJokerBumps(): void
  /**
   * Mağazadan alınan joker bu oyuna hemen eklenebilir mi? Evetse defter kimliği (satın alma bununla yapılır),
   * değilse undefined (Klasik, biten oyun, deftere kayıtsız oyun).
   */
  purchaseTarget(): string | undefined
  /** Satın alma defterde bu oyuna getirildikten sonra oyunun cüzdanına 1 ekler (tahta, skor, parçalar aynı kalır). */
  grantPurchased(gameId: string, kind: JokerKind): boolean
}

const REASON_TEXT: Partial<Record<JokerInvalidReason, string>> = {
  emptyCell: 'Boş hücre. Dolu bloğa dokun.',
  notRotatable: 'Bu parça dönünce aynı kalır.',
  noCharge: 'Bu jokerin hakkı kalmadı.',
}

export function useGame(eco: EconomyApi): GameApi {
  // İlk oyun: kimlik, getirilen satın alınmış haklar ve oyun birlikte, bir kez kurulur; deftere kaydı efektte yapılır.
  const [initial] = useState(() => {
    const mode = initialMode()
    const inventory = inventoryFor(mode, eco)
    return { id: newGameId(), mode, inventory, game: createGame(mode, inventory) }
  })
  // Oyuna getirilen satın alınmış haklar: kullanılıp kullanılmadığı bundan anlaşılır (rekor kategorisi).
  const inventoryAtStartRef = useRef<JokerCharges>(initial.inventory)
  const [boughtBestAtStart, setBoughtBestAtStart] = useState(() => eco.state.funBests.withPurchased)
  const [game, setGameState] = useState<GameState>(initial.game)
  const [bests, setBests] = useState<Bests>(() => ({ klasik: loadBest('klasik'), eglence: loadBest('eglence') }))
  const [bestAtStart, setBestAtStart] = useState<number>(() => bests[game.mode])
  const [selected, setSelected] = useState<Slot | null>(null)
  const [aim, setAim] = useState<Origin | null>(null)
  const [rejectCount, setRejectCount] = useState(0)
  const [effect, setEffect] = useState<Effect | null>(null)
  const [armed, setArmedState] = useState<ArmedJoker>(null)
  const [notice, setNotice] = useState<JokerNotice | null>(null)
  const [jokerFx, setJokerFx] = useState<JokerFx | null>(null)
  const effectId = useRef(0)
  const jokerFxId = useRef(0)
  const noticeId = useRef(0)
  // Joker eylemleri her zaman EN SON durumu okur: çift dokunuş aynı eski durumu iki kez işleyemez.
  const gameRef = useRef(game)
  const armedRef = useRef<ArmedJoker>(null)
  const lastRefreshAt = useRef(-Infinity)
  // Ekonomi: bu oyunun defter kimliği ve deftere kayıtlı olup olmadığı (kayıtsız oyunda yıldız ve satın alınmış joker yok).
  const gameIdRef = useRef(initial.id)
  const trackedRef = useRef(false)
  const [gameStars, setGameStars] = useState<GameStars | null>(null)
  const [starNotice, setStarNotice] = useState<JokerNotice | null>(null)
  const [starPulse, setStarPulse] = useState<StarPulse | null>(null)
  const [jokerBump, setJokerBump] = useState<{ id: number; kinds: readonly JokerKind[] } | null>(null)
  const pendingBumps = useRef<JokerKind[]>([])
  const pulseId = useRef(0)
  const pulseStars = useCallback((kind: StarPulse['kind'], amount: number) => {
    if (amount <= 0) return
    pulseId.current += 1
    setStarPulse({ id: pulseId.current, kind, amount, at: performance.now() })
  }, [])
  const ecoRef = useRef(eco)
  ecoRef.current = eco

  const setGame = useCallback((next: GameState) => {
    gameRef.current = next
    setGameState(next)
  }, [])
  const setArmed = useCallback((next: ArmedJoker) => {
    armedRef.current = next
    setArmedState(next)
  }, [])
  const say = useCallback((text: string) => {
    noticeId.current += 1
    setNotice({ id: noticeId.current, text })
  }, [])
  const tellStars = useCallback((text: string) => {
    noticeId.current += 1
    setStarNotice({ id: noticeId.current, text })
  }, [])

  // İlk oyunu deftere kaydet (StrictMode'da efekt iki kez çalışsa da aynı kimlik: ikinci çağrı etkisiz).
  useEffect(() => {
    const e = ecoRef.current
    const r = e.store.startGame(initial.id, initial.mode, initial.inventory)
    trackedRef.current = r.ok
    e.apply(r)
  }, [initial])

  /** Oyun sonu: yıldız ödülü bir kez; oyun defterde kapanır. */
  const finishEconomy = useCallback(
    (final: GameState) => {
      if (!trackedRef.current) return
      const e = ecoRef.current
      const id = gameIdRef.current
      const before = e.store.load().state
      const r = e.store.finishGame(id, final.score, final.jokers)
      trackedRef.current = false
      e.apply(r)
      if (r.ok) {
        setGameStars(finishedGameStars(r.state, id))
        if (reachedCapNow(before, r.state, id)) tellStars(CAP_TEXT)
      }
    },
    [tellStars],
  )

  /** Başarılı hamlenin hat yıldızı (numara motordan) ve gerekiyorsa oyun sonu ödülü. */
  const recordEconomy = useCallback(
    (next: GameState, events: readonly GameEvent[]) => {
      if (!trackedRef.current) return
      const e = ecoRef.current
      const id = gameIdRef.current
      const before = e.store.load().state
      const r = e.store.recordMove(id, next, events)
      e.apply(r)
      // Yalnızca bu hamlede gerçekten kazanılan yıldız (300 sınırında kalan pay); bakiyeyle aynı kaynak.
      if (r.ok) pulseStars('gain', starsGained(before, r.state))
      if (r.ok && reachedCapNow(before, r.state, id)) tellStars(CAP_TEXT)
      if (next.gameOver) finishEconomy(next)
    },
    [finishEconomy, tellStars, pulseStars],
  )

  const mode = game.mode
  const usedPurchased = purchasedUsedInGame(game, inventoryAtStartRef.current)
  const category = recordCategory(mode, usedPurchased)
  const boughtBest = eco.state.funBests.withPurchased
  const record =
    category === 'eglenceSatin'
      ? recordView(category, game.score, boughtBestAtStart, boughtBest)
      : recordView(category, game.score, bestAtStart, bests[mode])
  const best = record.best

  const preview = useMemo(
    () => (selected !== null && aim ? previewMove(game, selected, aim) : null),
    [game, selected, aim],
  )

  useEffect(() => {
    // Satın alınmış joker kullanılan Eğlence oyunu normal Eğlence rekoruna yazılmaz (ayrı kategori, defterde).
    // Bu oyun sırasında normal rekora yazılmış bir değer varsa oyunun başındaki değerine geri alınır.
    if (usedPurchased) {
      if (bests.eglence > bestAtStart) {
        setBests((b) => ({ ...b, eglence: bestAtStart }))
        restoreBest(bestAtStart, 'eglence')
      }
      return
    }
    // Rekor modun kendi anahtarına yazılır; Klasik ve Eğlence birbirini etkilemez.
    if (game.score > bests[game.mode]) {
      setBests((b) => ({ ...b, [game.mode]: game.score }))
      saveBest(game.score, game.mode)
    }
  }, [game.score, game.mode, bests, usedPurchased, bestAtStart])

  /** Geçerli önizlemeyi uygular ve efekt tanımını üretir. Motorun sonucu aynen kullanılır. */
  const commit = useCallback(
    (p: Preview | null): boolean => {
      if (!p?.ok || !p.next) return false
      effectId.current += 1
      setEffect(describeEffect(effectId.current, gameRef.current.board, p.events))
      setGame(p.next)
      recordEconomy(p.next, p.events)
      setSelected(null)
      setAim(null)
      setArmed(null)
      // Yerleştirme olunca eski joker efekti biter (boşalan yuvada yeniden oynamasın).
      setJokerFx(null)
      return true
    },
    [setGame, setArmed, recordEconomy],
  )

  const apply = useCallback(
    (p: Preview | null) => {
      if (!commit(p)) setRejectCount((n) => n + 1)
    },
    [commit],
  )

  /**
   * Jokeri uygular. Kayıtlı oyunda ekonomi deposu jokeri uygular ve satın alınmış hakkın düşülmesini AYNI
   * çağrıda kaydeder (kaydedilemezse joker uygulanmaz). Kayıtsız oyunda satın alınmış hak hiç kullanılmaz.
   */
  const runJoker = useCallback(
    (action: JokerAction): boolean => {
      const before = gameRef.current
      let next: GameState
      let events: readonly GameEvent[]
      if (trackedRef.current) {
        const e = ecoRef.current
        const r = e.store.useJoker(gameIdRef.current, before, action)
        if (!r.ok) {
          const text =
            r.reason === 'jokerInvalid'
              ? REASON_TEXT[r.jokerReason as JokerInvalidReason]
              : (ECONOMY_JOKER_TEXT[r.reason] ?? 'Satın alınmış joker şu an kullanılamıyor.')
          if (text) say(text)
          e.refresh()
          return false
        }
        e.refresh()
        next = r.game
        events = r.events
      } else {
        const result = applyJoker(before, action)
        if (!result.ok) {
          const text = REASON_TEXT[result.reason]
          if (text) say(text)
          return false
        }
        if (usesInventory(result.events)) {
          say('Satın alınmış jokerler bu oyunda kullanılamıyor. Ücretsiz hakların duruyor.')
          return false
        }
        next = result.state
        events = result.events
      }
      setGame(next)
      jokerFxId.current += 1
      setJokerFx(describeJokerFx(jokerFxId.current, events, before.tray))
      if (next.stuck) say('Hâlâ sığan parça yok. Başka bir joker dene ya da oyunu bitir.')
      return true
    },
    [setGame, say],
  )

  const originForCell = useCallback(
    (row: number, col: number): Origin | null => {
      if (selected === null) return null
      const piece = game.tray[selected]
      return piece ? originFor(getShape(piece.shapeId), row, col) : null
    },
    [game, selected],
  )

  const start = (next: GameMode) => {
    // Yeni oyun önce deftere kaydedilir; kayıt olmazsa (başka sekme, eski sürüm kaydı) satın alınmış haklar getirilmez.
    const e = ecoRef.current
    const id = newGameId()
    let inventory = inventoryFor(next, e)
    const r = e.store.startGame(id, next, inventory)
    if (!r.ok) inventory = NO_JOKERS
    gameIdRef.current = id
    trackedRef.current = r.ok
    e.apply(r)
    setGameStars(null)
    setStarNotice(null)
    inventoryAtStartRef.current = inventory
    setBoughtBestAtStart(e.store.load().state.funBests.withPurchased)
    setGame(createGame(next, inventory))
    setEffect(null)
    setBestAtStart(bests[next])
    setSelected(null)
    setAim(null)
    setArmed(null)
    setNotice(null)
    setJokerFx(null)
  }

  return {
    game,
    mode,
    best,
    bests,
    boughtBest,
    bestAtStart,
    record,
    selected,
    preview,
    rejectCount,
    effect,
    armed,
    notice,
    jokerFx,
    select(slot) {
      if (game.gameOver || !game.tray[slot]) return
      setArmed(null)
      setSelected((current) => (current === slot ? null : slot))
      setAim(null)
    },
    aimAtCell(row, col) {
      const origin = originForCell(row, col)
      if (origin) setAim(origin)
    },
    aimAt(origin) {
      setAim(origin)
    },
    beginDrag(slot) {
      if (game.gameOver || !game.tray[slot]) return
      setArmed(null)
      setSelected(slot)
      setAim(null)
    },
    dropAt(slot, origin) {
      return commit(previewMove(gameRef.current, slot, origin))
    },
    cancelDrag() {
      setSelected(null)
      setAim(null)
    },
    confirm() {
      apply(preview)
    },
    placeAtCell(row, col) {
      const origin = originForCell(row, col)
      if (!origin || selected === null) return
      setAim(origin)
      apply(previewMove(gameRef.current, selected, origin))
    },
    clearAim() {
      setAim(null)
    },
    restart() {
      start(gameRef.current.mode)
    },
    startGame(next) {
      modeStore.save(next)
      start(next)
    },
    arm(kind) {
      const g = gameRef.current
      if (g.mode !== 'eglence' || g.gameOver) return
      if (armedRef.current === kind) {
        setArmed(null)
        return
      }
      setSelected(null)
      setAim(null)
      setNotice(null)
      setArmed(kind)
    },
    disarm() {
      setArmed(null)
    },
    refresh() {
      const now = performance.now()
      if (now - lastRefreshAt.current < REFRESH_GUARD_MS) return
      lastRefreshAt.current = now
      setArmed(null)
      setSelected(null)
      setAim(null)
      runJoker({ type: 'yenile' })
    },
    hammerCell(cell) {
      if (armedRef.current !== 'cekic') return
      // Önce modu kapat: aynı dokunuştan gelen ikinci olay ikinci vuruş yapamaz.
      if (gameRef.current.board[cell] === 0) {
        say(REASON_TEXT.emptyCell!)
        return
      }
      setArmed(null)
      if (!runJoker({ type: 'cekic', cell })) setArmed('cekic')
    },
    rotateSlot(slot) {
      if (armedRef.current !== 'dondur') return
      // Başarılı dönüşten sonra eski uyarı silinir; çubuk "ücretsiz dönüş" yönergesini gösterir.
      if (runJoker({ type: 'dondur', slot })) setNotice(null)
    },
    giveUp() {
      const result = engineGiveUp(gameRef.current)
      if (result.ok) {
        setArmed(null)
        setGame(result.state)
        finishEconomy(result.state)
      }
    },
    gameStars,
    starNotice,
    starPulse,
    pulseStars,
    jokerBump,
    flushJokerBumps() {
      if (pendingBumps.current.length === 0) return
      const kinds = [...new Set(pendingBumps.current)]
      pendingBumps.current = []
      pulseId.current += 1
      setJokerBump({ id: pulseId.current, kinds })
    },
    purchaseTarget() {
      const g = gameRef.current
      if (g.mode !== 'eglence' || g.gameOver || !g.jokers || !trackedRef.current) return undefined
      return gameIdRef.current
    },
    grantPurchased(gameId, kind) {
      const g = gameRef.current
      if (gameId !== gameIdRef.current || g.mode !== 'eglence' || g.gameOver || !g.jokers) return false
      // Oyun başı envanteri de 1 artar: "satın alınmış joker kullanıldı mı" (rekor kategorisi) doğru kalır.
      inventoryAtStartRef.current = grantJokers(inventoryAtStartRef.current, { [kind]: 1 })
      setGame({ ...g, jokers: { ...g.jokers, inventory: grantJokers(g.jokers.inventory, { [kind]: 1 }) } })
      pendingBumps.current.push(kind)
      return true
    },
  }
}
