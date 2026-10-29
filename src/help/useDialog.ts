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
    // Aşama 7.4: pencerenin boş bir yerine dokunulunca odak sayfaya düşmesin, pencerede kalsın (ekran okuyucu ve
    // klavye için). tabindex=-1: Tab sırasına girmez, yalnızca işaretçiyle ya da programla odak alır (halkasız).
    if (el && !el.hasAttribute('tabindex')) el.tabIndex = -1
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
      // Odak pencerenin kendisindeyse (boş alana dokunulduktan sonra) Tab ilk, Shift+Tab son öğeye gider.
      if (document.activeElement === el) {
        e.preventDefault()
        const target = e.shiftKey ? last : first
        target.focus()
        return
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    // Aşama 7.4: dokunma/fare kullanılınca odak halkası sönsün. Açılışta odak programla verildiği için tarayıcı
    // (henüz dokunuş yokken) halkayı klavye odağı gibi çizer; aynı düğmeye parmakla basmak odağı yerinden
    // oynatmadığı için halka kalırdı. İşaretçiyle basıldığında odak AYNI öğede kalır, yalnızca "halkasız" yeniden
    // verilir (FocusOptions.focusVisible: false; desteklemeyen tarayıcı seçeneği yok sayar, davranışı değişmez).
    // Klavyeyle (Tab / Shift+Tab) halka aynen görünür; ekran okuyucunun odağı değişmez.
    const onPointer = () => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || !el?.contains(active)) return
      let visible = false
      try {
        visible = active.matches(':focus-visible')
      } catch {
        return // :focus-visible desteklenmiyorsa hiçbir şey yapma.
      }
      if (!visible) return
      active.blur()
      active.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
    }
    el?.addEventListener('keydown', onKey)
    el?.addEventListener('pointerdown', onPointer, true)
    return () => {
      el?.removeEventListener('keydown', onKey)
      el?.removeEventListener('pointerdown', onPointer, true)
      back.current?.()?.focus()
    }
  }, [initialFocus])

  return ref
}
