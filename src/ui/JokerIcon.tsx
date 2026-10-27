import type { JokerKind } from '../engine/types'

/**
 * Joker simgeleri: kodla çizilmiş, dolgun ve yuvarlak hatlı (görsel dosyası yok).
 * Beyaz gövde + hafif gölge; rengi düğmenin kendisi verir.
 */
export function JokerIcon({ kind }: { kind: JokerKind }) {
  if (kind === 'cekic') {
    return (
      <svg className="jk-icon" viewBox="0 0 32 32" aria-hidden="true">
        {/* Düz çizilip bütün olarak eğilen çekiç: üstte baş, altta sap. */}
        <g transform="rotate(-40 16 16)">
          <rect x="13.8" y="11" width="4.4" height="18.5" rx="2.2" />
          <rect x="5.5" y="4" width="21" height="9.5" rx="3.6" />
          <rect x="5.5" y="4" width="4.2" height="9.5" rx="2" className="jk-shade" />
          <rect x="11.5" y="6" width="9" height="2.4" rx="1.2" className="jk-shine" />
        </g>
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
      {/* Bloğun üstünden saat yönünde dönen ok */}
      <path d="M5.5 16.5A10 10 0 0 1 22.5 8.6" className="jk-stroke" />
      <path d="M27.6 5.2l-1 9.1-7.9-4.6z" />
      <rect x="11" y="15" width="11.5" height="11.5" rx="3.2" />
      <rect x="13.2" y="17" width="4.6" height="2.2" rx="1.1" className="jk-shine" />
    </svg>
  )
}
