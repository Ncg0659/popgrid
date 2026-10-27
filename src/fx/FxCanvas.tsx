import { useEffect, useRef, type RefObject } from 'react'
import { BOARD_SIZE } from '../engine/types'
import type { Effect } from './effects'
import type { JokerFx } from './jokerEffects'
import { ParticleSystem } from './particles'

interface Props {
  effect: Effect | null
  boardRef: RefObject<HTMLElement | null>
  reducedMotion: boolean
  /** Çekiç kırılmasında küçük parçacıklar. */
  jokerFx?: JokerFx | null
}

function blockColors(): string[] {
  const css = getComputedStyle(document.documentElement)
  return [0, 1, 2, 3, 4, 5, 6].map((i) => css.getPropertyValue(`--c${i}`).trim() || '#ffffff')
}

/** Ekranı kaplayan, dokunmayı engellemeyen parçacık katmanı. */
export function FxCanvas({ effect, boardRef, reducedMotion, jokerFx = null }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const system = useRef<ParticleSystem | null>(null)
  const colors = useRef<string[] | null>(null)

  useEffect(() => {
    if (canvasRef.current) system.current = new ParticleSystem(canvasRef.current)
    return () => system.current?.clear()
  }, [])

  useEffect(() => {
    const ps = system.current
    if (!ps) return
    if (!effect) {
      ps.clear()
      return
    }
    if (reducedMotion || effect.cleared.length === 0) return
    const board = boardRef.current
    if (!board) return
    colors.current ??= blockColors()
    const rect = board.getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(board).columnGap) || 0
    const cell = (rect.width - (BOARD_SIZE - 1) * gap) / BOARD_SIZE
    const pitch = cell + gap
    // Çok hat temizlenince daha güçlü ve kalabalık patlama.
    const big = effect.lines >= 2
    const perCell = big ? 4 : 3
    const power = big ? 1.25 : 1
    for (const b of effect.cleared) {
      const r = Math.floor(b.cell / BOARD_SIZE)
      const c = b.cell % BOARD_SIZE
      const x = rect.left + c * pitch + cell / 2
      const y = rect.top + r * pitch + cell / 2
      ps.burst(x, y, cell, colors.current[b.color] ?? '#ffffff', perCell, power, b.delay)
    }
  }, [effect, boardRef, reducedMotion])

  useEffect(() => {
    const ps = system.current
    const board = boardRef.current
    if (!ps || !board || !jokerFx || jokerFx.kind !== 'cekic' || reducedMotion) return
    colors.current ??= blockColors()
    const rect = board.getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(board).columnGap) || 0
    const cell = (rect.width - (BOARD_SIZE - 1) * gap) / BOARD_SIZE
    const pitch = cell + gap
    const x = rect.left + (jokerFx.cell % BOARD_SIZE) * pitch + cell / 2
    const y = rect.top + Math.floor(jokerFx.cell / BOARD_SIZE) * pitch + cell / 2
    // Az ve kısa: tek bloğun kırılması (düşük güçlü telefonlarda da hafif). Darbe anına denk gelsin diye 50 ms gecikme.
    ps.burst(x, y, cell, colors.current[jokerFx.color] ?? '#ffffff', 12, 0.75, 50)
  }, [jokerFx, boardRef, reducedMotion])

  return <canvas ref={canvasRef} className="fx-canvas" aria-hidden="true" />
}
