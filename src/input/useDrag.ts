import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { getShape } from '../engine'
import type { Piece, Slot, Tray } from '../engine/types'
import type { Origin } from '../ui/placement'
import { DRAG_THRESHOLD_PX, floatPosition, gridMetrics, snapOrigin, type GridMetrics } from './dragGeometry'

export interface DragState {
  readonly slot: Slot
  readonly piece: Piece
}

interface Session {
  slot: Slot
  piece: Piece
  pointerId: number
  pointerType: string
  startX: number
  startY: number
  x: number
  y: number
  active: boolean
  /** Parça tepsiye geri uçuyor; bu sırada yeni olaylar yok sayılır. */
  returning: boolean
  origin: Origin | null
  frame: number
}

interface Options {
  tray: Tray
  disabled: boolean
  /** Tahta ızgarası (.board) — ölçüler her karede buradan okunur, ekran boyutu değişse de doğru kalır. */
  boardRef: RefObject<HTMLElement | null>
  onBegin(slot: Slot): void
  onAim(origin: Origin | null): void
  /** Bırakılan konumda yerleştirmeyi dener; başarılıysa true. */
  onDrop(slot: Slot, origin: Origin): boolean
  onCancel(): void
  /** Sürüklemeden dokunup bırakma (eski dokunarak seçme yöntemi). */
  onTap(slot: Slot): void
}

const RETURN_MS = 170

function readMetrics(el: HTMLElement | null): GridMetrics | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0
  return gridMetrics(rect.left, rect.top, rect.width, gap)
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Tepsiden tahtaya sürükle-bırak (Pointer Events).
 * - Parmak/fare 6px'ten fazla hareket edince sürükleme başlar ve parça otomatik seçilir.
 * - Yüzen parça her karede (requestAnimationFrame) gerçek hücre boyutunda çizilir.
 * - Bırakınca geçerliyse yerleşir; değilse, iptal olursa (pointercancel) ya da tahta dışındaysa tepsiye döner.
 */
export function useDrag(opts: Options) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  const session = useRef<Session | null>(null)
  const slotEls = useRef<Array<HTMLElement | null>>([null, null, null])
  const latest = useRef(opts)
  latest.current = opts

  const paint = useCallback(() => {
    const s = session.current
    if (!s || s.returning) return
    s.frame = 0
    const el = floatRef.current
    const m = readMetrics(latest.current.boardRef.current)
    if (!el || !m) {
      // Yüzen parça henüz çizilmediyse bir sonraki karede tekrar dene.
      s.frame = requestAnimationFrame(paint)
      return
    }
    const shape = getShape(s.piece.shapeId)
    const p = floatPosition(s.x, s.y, shape, m, s.pointerType)
    el.style.setProperty('--u', `${m.cell}px`)
    el.style.setProperty('--pgap', `${m.gap}px`)
    el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
    el.style.visibility = 'visible'
    const origin = snapOrigin(p.x, p.y, shape, m)
    const same = origin === s.origin || (origin && s.origin && origin.row === s.origin.row && origin.col === s.origin.col)
    if (!same) {
      s.origin = origin
      latest.current.onAim(origin)
    }
  }, [])

  const schedule = useCallback(() => {
    const s = session.current
    if (s && !s.frame) s.frame = requestAnimationFrame(paint)
  }, [paint])

  const finish = useCallback(() => {
    const s = session.current
    if (s?.frame) cancelAnimationFrame(s.frame)
    session.current = null
    setDrag(null)
  }, [])

  /** Parçayı tepsideki yerine geri uçurur (azaltılmış harekette anında). */
  const returnToTray = useCallback(() => {
    const s = session.current
    if (s?.frame) cancelAnimationFrame(s.frame)
    if (s) {
      s.frame = 0
      s.returning = true
    }
    latest.current.onCancel()
    const el = floatRef.current
    const target = s ? slotEls.current[s.slot]?.querySelector('.piece') : null
    if (!s || !el || !target || prefersReducedMotion()) {
      finish()
      return
    }
    const to = target.getBoundingClientRect()
    const from = el.getBoundingClientRect()
    const scale = from.width > 0 ? to.width / from.width : 1
    el.style.transition = `transform ${RETURN_MS}ms ease-out`
    el.style.transformOrigin = '0 0'
    el.style.transform = `translate3d(${to.left}px, ${to.top}px, 0) scale(${scale})`
    window.setTimeout(finish, RETURN_MS + 20)
  }, [finish])

  // Sürükleme sırasında bileşen kaldırılırsa animasyon karesini iptal et.
  useEffect(() => () => {
    const s = session.current
    if (s?.frame) cancelAnimationFrame(s.frame)
  }, [])

  /** pointercancel ya da yakalamanın beklenmedik kaybı: parçayı güvenle tepsiye döndür. */
  const abandon = (pointerId: number) => {
    const s = session.current
    if (!s || pointerId !== s.pointerId || s.returning) return
    if (s.active) returnToTray()
    else session.current = null
  }

  const handlers = (slot: Slot) => ({
    ref: (el: HTMLElement | null) => {
      slotEls.current[slot] = el
    },
    onPointerDown(e: PointerEvent<HTMLElement>) {
      const piece = latest.current.tray[slot]
      if (latest.current.disabled || !piece || session.current) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      // Sayfa kaydırma, yakınlaştırma, metin seçimi ve sonradan gelen uyumluluk fare olaylarını engeller.
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      session.current = {
        slot,
        piece,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        active: false,
        returning: false,
        origin: null,
        frame: 0,
      }
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId || s.returning) return
      s.x = e.clientX
      s.y = e.clientY
      if (!s.active) {
        if (Math.hypot(s.x - s.startX, s.y - s.startY) < DRAG_THRESHOLD_PX) return
        s.active = true
        latest.current.onBegin(slot)
        setDrag({ slot, piece: s.piece })
      }
      schedule()
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId) return
      if (!s.active) {
        session.current = null
        latest.current.onTap(slot)
        return
      }
      if (s.returning) return
      // Bırakma konumu, son karenin değil parmağın son gerçek konumundan hesaplanır.
      const m = readMetrics(latest.current.boardRef.current)
      const shape = getShape(s.piece.shapeId)
      let origin: Origin | null = null
      if (m) {
        const p = floatPosition(e.clientX, e.clientY, shape, m, s.pointerType)
        origin = snapOrigin(p.x, p.y, shape, m)
      }
      if (origin && latest.current.onDrop(slot, origin)) finish()
      else returnToTray()
    },
    onPointerCancel(e: PointerEvent<HTMLElement>) {
      abandon(e.pointerId)
    },
    onLostPointerCapture(e: PointerEvent<HTMLElement>) {
      // pointerup'tan sonra da gelir; o zaman oturum ya kapanmış ya da geri dönüşte olur.
      abandon(e.pointerId)
    },
  })

  return { drag, floatRef, handlers }
}
