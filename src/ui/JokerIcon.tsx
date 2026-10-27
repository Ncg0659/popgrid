import type { JokerKind } from '../engine/types'

/**
 * Joker simgeleri: kodla çizilmiş, dolgun ve yuvarlak hatlı (görsel dosyası yok).
 * Beyaz gövde + hafif gölge; rengi düğmenin kendisi verir.
 */
export function JokerIcon({ kind }: { kind: JokerKind }) {
  if (kind === 'cekic') {
    return (
      <svg className="jk-icon" viewBox="0 0 32 32" aria-hidden="true">
        {/* Sap */}
        <rect x="14.2" y="12" width="4.6" height="17" rx="2.3" transform="rotate(-38 16.5 20.5)" className="jk-shade" />
        <rect x="13.8" y="11.4" width="4.6" height="17" rx="2.3" transform="rotate(-38 16.1 19.9)" />
        {/* Baş */}
        <rect x="6.5" y="4.5" width="17" height="9" rx="3.6" transform="rotate(-38 15 9)" />
        <rect x="9" y="6" width="6" height="2.4" rx="1.2" transform="rotate(-38 12 7.2)" className="jk-shine" />
      </svg>
    )
  }
  if (kind === 'yenile') {
    return (
      <svg className="jk-icon" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M24.5 13A9 9 0 0 0 8.6 10" className="jk-stroke" />
        <path d="M7.5 19a9 9 0 0 0 15.9 3" className="jk-stroke" />
        <path d="M25.8 6.5v7.6h-7.6z" />
        <path d="M6.2 25.5v-7.6h7.6z" />
      </svg>
    )
  }
  return (
    <svg className="jk-icon" viewBox="0 0 32 32" aria-hidden="true">
      {/* Küçük blok + saat yönünde ok */}
      <rect x="10.5" y="11.5" width="11" height="11" rx="3" />
      <rect x="12.5" y="13.2" width="4.5" height="2.2" rx="1.1" className="jk-shine" />
      <path d="M6.5 15A10 10 0 0 1 24 7.6" className="jk-stroke" />
      <path d="M27.4 4.2l-.6 8.2-7.4-3.6z" />
    </svg>
  )
}
