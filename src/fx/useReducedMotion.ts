import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function current(): boolean {
  try {
    return window.matchMedia(QUERY).matches
  } catch {
    return false
  }
}

/** Kullanıcının "hareketi azalt" tercihini izler; oyun sırasında değişirse de güncellenir. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(current)
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia(QUERY)
    } catch {
      return
    }
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
