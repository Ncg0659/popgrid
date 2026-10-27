/**
 * Joker çubuğunun durumu. Arayüz katmanıdır ama saf: DOM bilmez, Node testleriyle denenir.
 * Kurallar motordadır (src/engine/jokers.ts); burası yalnızca "hangi düğme ne zaman etkin" sorusunu cevaplar.
 */
import { JOKER_KINDS, canRescue, isRotatable, jokerCount } from '../engine'
import type { GameState, JokerCharges, JokerKind, Slot } from '../engine/types'

/** Hedef seçimi isteyen jokerler: Çekiç (hücre), Döndür (parça). Yenile anında uygulanır. */
export type ArmedJoker = 'cekic' | 'dondur' | null

export interface JokerButton {
  readonly kind: JokerKind
  readonly count: number
  readonly enabled: boolean
  /** Döndür: bu oyunda ücretsiz dönüşü olan (ödenmiş) parça var. */
  readonly freeRotation: boolean
}

export const JOKER_NAMES: Readonly<Record<JokerKind, string>> = {
  cekic: 'Çekiç',
  yenile: 'Yenile',
  dondur: 'Döndür',
}

/** Döndür'ün şu an uygulanabileceği yuvalar: dönen bir şekil ve (hak ya da ödenmiş dönüş). */
export function rotatableSlots(game: GameState): Slot[] {
  if (game.mode !== 'eglence' || game.gameOver) return []
  const charges = jokerCount(game.jokers, 'dondur')
  return ([0, 1, 2] as const).filter((slot) => {
    const piece = game.tray[slot]
    return !!piece && isRotatable(piece.shapeId) && (charges > 0 || game.rotatePaid[slot])
  })
}

function keepOnly(charges: JokerCharges, keep: readonly JokerKind[]): JokerCharges {
  return {
    cekic: keep.includes('cekic') ? charges.cekic : 0,
    yenile: keep.includes('yenile') ? charges.yenile : 0,
    dondur: keep.includes('dondur') ? charges.dondur : 0,
  }
}

function withOnly(game: GameState, keep: readonly JokerKind[]): GameState {
  const w = game.jokers
  if (!w) return game
  return { ...game, jokers: { free: keepOnly(w.free, keep), inventory: keepOnly(w.inventory, keep) } }
}

/**
 * Sıkışınca bu joker kurtuluşa katkı verebilir mi?
 * - Tek başına kurtarıyorsa evet.
 * - Ya da kurtuluş var ama bu joker olmadan yok (ör. Döndür + Çekiç birlikte gerekiyor) → evet.
 */
export function usefulWhenStuck(game: GameState, kind: JokerKind): boolean {
  if (canRescue(withOnly(game, [kind]))) return true
  const others = JOKER_KINDS.filter((k) => k !== kind)
  return canRescue(game) && !canRescue(withOnly(game, others))
}

export function jokerButtons(game: GameState): JokerButton[] {
  const active = game.mode === 'eglence' && !game.gameOver && game.jokers !== null
  const hasBlock = game.board.some((c) => c !== 0)
  const hasPiece = game.tray.some((p) => p !== null)
  const rotatable = rotatableSlots(game)
  const freeRotation = ([0, 1, 2] as const).some((s) => game.rotatePaid[s] && game.tray[s] !== null)
  return JOKER_KINDS.map((kind) => {
    const count = jokerCount(game.jokers, kind)
    let enabled = false
    if (active) {
      if (kind === 'cekic') enabled = count > 0 && hasBlock
      else if (kind === 'yenile') enabled = count > 0 && hasPiece
      else enabled = rotatable.length > 0
      if (enabled && game.stuck) enabled = usefulWhenStuck(game, kind)
    }
    return { kind, count, enabled, freeRotation: kind === 'dondur' && freeRotation }
  })
}

/** Ekran okuyucu ve düğme etiketi: "Çekiç, 1 hak kaldı". */
export function jokerLabel(button: JokerButton): string {
  const name = JOKER_NAMES[button.kind]
  const rights = button.count === 0 ? 'hakkın kalmadı' : `${button.count} hak kaldı`
  const free = button.freeRotation ? ', ücretsiz dönüş var' : ''
  return `${name}, ${rights}${free}`
}
