import { useEffect, useRef, type RefObject } from 'react'

/**
 * Basit diyalog davranışı: açılınca ilk odaklanacak öğeye odaklan, Esc ile kapat,
 * Tab'ı diyalog içinde tut, kapanınca odağı belirtilen öğeye geri ver.
 */
export function useDialog<T extends HTMLElement>(
  onEscape: () => void,
  initialFocus: RefObject<HTMLElement | null>,
  /** Kapanınca odağın döneceği öğe. Açılırken oyun alanı kilitlendiği (inert) için önceki odak kaybolur. */
  returnFocus?: () => HTMLElement | null,
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const escape = useRef(onEscape)
  escape.current = onEscape
  const back = useRef(returnFocus)
  back.current = returnFocus

  useEffect(() => {
    initialFocus.current?.focus()
    const el: HTMLElement | null = ref.current
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        escape.current()
        return
      }
      if (e.key !== 'Tab' || !el) return
      const focusable: HTMLElement[] = Array.from(
        el.querySelectorAll<HTMLElement>('button, summary, [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((f: HTMLElement) => !f.hasAttribute('disabled'))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    el?.addEventListener('keydown', onKey)
    return () => {
      el?.removeEventListener('keydown', onKey)
      back.current?.()?.focus()
    }
  }, [initialFocus])

  return ref
}
