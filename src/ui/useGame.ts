import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CONFIG, applyJoker, getShape, giveUp as engineGiveUp, newGame } from '../engine'
import type { GameMode, GameState, JokerAction, JokerInvalidReason, Slot } from '../engine/types'
import { describeEffect, type Effect } from '../fx/effects'
import { inventoryStore, spendInventoryFor } from '../storage/inventory'
import { modeStore } from '../storage/mode'
import { loadBest, saveBest } from '../storage/records'
import type { ArmedJoker } from './jokerUi'
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

function createGame(mode: GameMode): GameState {
  if (mode === 'klasik') return newGame(freshSeed())
  // Eğlence: oyun başına ücretsiz haklar (motorun varsayılanı) + kalıcı envanterin o anki değeri.
  return newGame(freshSeed(), DEFAULT_CONFIG, { mode, inventory: inventoryStore.load() })
}

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
  /** Bu modun rekoru. */
  readonly best: number
  readonly bests: Bests
  /** Bu oyun başladığında geçerli olan rekor ("Yeni rekor!" için). */
  readonly bestAtStart: number
  readonly selected: Slot | null
  readonly preview: Preview | null
  /** Geçersiz denemede artar; arayüz sallanma geri bildirimi için kullanır. */
  readonly rejectCount: number
  /** Son başarılı hamlenin efekt tanımı (animasyon, parçacık, ses); yeni oyunda null. */
  readonly effect: Effect | null
  /** Hedef bekleyen joker (Çekiç: hücre, Döndür: parça). */
  readonly armed: ArmedJoker
  readonly notice: JokerNotice | null
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
}

const REASON_TEXT: Partial<Record<JokerInvalidReason, string>> = {
  emptyCell: 'Boş hücre. Dolu bir bloğa dokun.',
  notRotatable: 'Bu parça döndürülünce aynı kalır.',
  noCharge: 'Bu jokerin hakkı kalmadı.',
}

export function useGame(): GameApi {
  const [game, setGameState] = useState<GameState>(() => createGame(initialMode()))
  const [bests, setBests] = useState<Bests>(() => ({ klasik: loadBest('klasik'), eglence: loadBest('eglence') }))
  const [bestAtStart, setBestAtStart] = useState<number>(() => bests[game.mode])
  const [selected, setSelected] = useState<Slot | null>(null)
  const [aim, setAim] = useState<Origin | null>(null)
  const [rejectCount, setRejectCount] = useState(0)
  const [effect, setEffect] = useState<Effect | null>(null)
  const [armed, setArmedState] = useState<ArmedJoker>(null)
  const [notice, setNotice] = useState<JokerNotice | null>(null)
  const effectId = useRef(0)
  const noticeId = useRef(0)
  // Joker eylemleri her zaman EN SON durumu okur: çift dokunuş aynı eski durumu iki kez işleyemez.
  const gameRef = useRef(game)
  const armedRef = useRef<ArmedJoker>(null)
  const lastRefreshAt = useRef(-Infinity)

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

  const mode = game.mode
  const best = bests[mode]

  const preview = useMemo(
    () => (selected !== null && aim ? previewMove(game, selected, aim) : null),
    [game, selected, aim],
  )

  useEffect(() => {
    // Rekor modun kendi anahtarına yazılır; Klasik ve Eğlence birbirini etkilemez.
    if (game.score > bests[game.mode]) {
      setBests((b) => ({ ...b, [game.mode]: game.score }))
      saveBest(game.score, game.mode)
    }
  }, [game.score, game.mode, bests])

  /** Geçerli önizlemeyi uygular ve efekt tanımını üretir. Motorun sonucu aynen kullanılır. */
  const commit = useCallback(
    (p: Preview | null): boolean => {
      if (!p?.ok || !p.next) return false
      effectId.current += 1
      setEffect(describeEffect(effectId.current, gameRef.current.board, p.events))
      setGame(p.next)
      setSelected(null)
      setAim(null)
      setArmed(null)
      return true
    },
    [setGame, setArmed],
  )

  const apply = useCallback(
    (p: Preview | null) => {
      if (!commit(p)) setRejectCount((n) => n + 1)
    },
    [commit],
  )

  /** Joker sonucunu uygular; envanterden harcanan her hak kalıcı kayıttan tam bir kez düşülür. */
  const runJoker = useCallback(
    (action: JokerAction): boolean => {
      const result = applyJoker(gameRef.current, action)
      if (!result.ok) {
        const text = REASON_TEXT[result.reason]
        if (text) say(text)
        return false
      }
      spendInventoryFor(result.events, inventoryStore)
      setGame(result.state)
      if (result.state.stuck) say('Hâlâ sığan parça yok. Başka bir joker dene ya da oyunu bitir.')
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
    setGame(createGame(next))
    setEffect(null)
    setBestAtStart(bests[next])
    setSelected(null)
    setAim(null)
    setArmed(null)
    setNotice(null)
  }

  return {
    game,
    mode,
    best,
    bests,
    bestAtStart,
    selected,
    preview,
    rejectCount,
    effect,
    armed,
    notice,
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
      runJoker({ type: 'dondur', slot })
    },
    giveUp() {
      const result = engineGiveUp(gameRef.current)
      if (result.ok) {
        setArmed(null)
        setGame(result.state)
      }
    },
  }
}
