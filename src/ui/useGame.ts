import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getShape, newGame } from '../engine'
import type { GameState, Slot } from '../engine/types'
import { describeEffect, type Effect } from '../fx/effects'
import { loadBest, saveBest } from '../storage/records'
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

export interface GameApi {
  readonly game: GameState
  readonly best: number
  /** Bu oyun başladığında geçerli olan rekor ("Yeni rekor!" için). */
  readonly bestAtStart: number
  readonly selected: Slot | null
  readonly preview: Preview | null
  /** Geçersiz denemede artar; arayüz sallanma geri bildirimi için kullanır. */
  readonly rejectCount: number
  /** Son başarılı hamlenin efekt tanımı (animasyon, parçacık, ses); yeni oyunda null. */
  readonly effect: Effect | null
  select(slot: Slot): void
  /** Dokunulan hücreye göre önizleme konumunu ayarlar. */
  aimAtCell(row: number, col: number): void
  /** Önizlemeyi doğrudan sol üst köşe ile taşır (klavye, sürükleme); null önizlemeyi kaldırır. */
  aimAt(origin: Origin | null): void
  /** Sürükleme başladı: parçayı seçer (aç/kapa değil). */
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
  restart(): void
}

export function useGame(): GameApi {
  const [game, setGame] = useState<GameState>(() => newGame(freshSeed()))
  const [best, setBest] = useState<number>(() => loadBest())
  const [bestAtStart, setBestAtStart] = useState<number>(best)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [aim, setAim] = useState<Origin | null>(null)
  const [rejectCount, setRejectCount] = useState(0)
  const [effect, setEffect] = useState<Effect | null>(null)
  const effectId = useRef(0)

  const preview = useMemo(
    () => (selected !== null && aim ? previewMove(game, selected, aim) : null),
    [game, selected, aim],
  )

  useEffect(() => {
    if (game.score > best) {
      setBest(game.score)
      saveBest(game.score)
    }
  }, [game.score, best])

  /** Geçerli önizlemeyi uygular ve efekt tanımını üretir. Motorun sonucu aynen kullanılır. */
  const commit = useCallback(
    (p: Preview | null): boolean => {
      if (!p?.ok || !p.next) return false
      effectId.current += 1
      setEffect(describeEffect(effectId.current, game.board, p.events))
      setGame(p.next)
      setSelected(null)
      setAim(null)
      return true
    },
    [game],
  )

  const apply = useCallback(
    (p: Preview | null) => {
      if (!commit(p)) setRejectCount((n) => n + 1)
    },
    [commit],
  )

  const originForCell = useCallback(
    (row: number, col: number): Origin | null => {
      if (selected === null) return null
      const piece = game.tray[selected]
      return piece ? originFor(getShape(piece.shapeId), row, col) : null
    },
    [game, selected],
  )

  return {
    game,
    best,
    bestAtStart,
    selected,
    preview,
    rejectCount,
    effect,
    select(slot) {
      if (game.gameOver || !game.tray[slot]) return
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
      setSelected(slot)
      setAim(null)
    },
    dropAt(slot, origin) {
      return commit(previewMove(game, slot, origin))
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
      apply(previewMove(game, selected, origin))
    },
    clearAim() {
      setAim(null)
    },
    restart() {
      setGame(newGame(freshSeed()))
      setEffect(null)
      setBestAtStart(best)
      setSelected(null)
      setAim(null)
    },
  }
}
