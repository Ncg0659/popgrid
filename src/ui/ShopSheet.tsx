import { useEffect, useRef, useState } from 'react'
import type { JokerKind } from '../engine/types'
import type { EconomyState } from '../economy/ledger'
import { useDialog } from '../help/useDialog'
import { FREE_RIGHTS_NOTE, fmtStars, shopBlockedReason, shopItems, type EconomyStatus } from './economyUi'
import { JokerIcon } from './JokerIcon'
import { StarIcon } from './StarIcon'

interface Props {
  state: EconomyState
  status: EconomyStatus
  persistent: boolean
  /** Tek dokunuşla satın alır; sonuç mesajını döndürür (başarılıysa ok: true). */
  onBuy(kind: JokerKind): { ok: boolean; text: string }
  onClose(): void
  returnFocus?: () => HTMLElement | null
}

/**
 * Yıldız Mağazası: ekranın altından açılan panel. Oyunun üstünde açılır; tahta, parçalar ve skor değişmez.
 * Satın alınan jokerler kalıcı envantere eklenir ve bir sonraki Eğlence oyununda hazır olur.
 */
export function ShopSheet({ state, status, persistent, onBuy, onClose, returnFocus }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialog = useDialog<HTMLDivElement>(onClose, closeRef, returnFocus)
  const [toast, setToast] = useState<{ id: number; text: string; ok: boolean } | null>(null)
  const toastId = useRef(0)
  const items = shopItems(state, status, persistent)
  const blocked = shopBlockedReason(status, persistent)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  const buy = (kind: JokerKind) => {
    const r = onBuy(kind)
    toastId.current += 1
    setToast({ id: toastId.current, text: r.text, ok: r.ok })
  }

  return (
    <div
      className="overlay shop-overlay"
      role="presentation"
      // Panelin dışına (koyu olmayan arka plana) dokunmak kapatır.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={dialog} className="sheet shop" role="dialog" aria-modal="true" aria-labelledby="shop-title">
        <div className="shop-grip" aria-hidden="true" />
        <header className="help-head shop-head">
          <h2 id="shop-title">Yıldız Mağazası</h2>
          <button ref={closeRef} type="button" className="btn-soft" onClick={onClose}>
            Kapat
          </button>
        </header>
        <div className="shop-body">
          <p className="shop-balance" aria-live="polite">
            <StarIcon />
            <span>
              <strong>{fmtStars(state.stars)}</strong> yıldızın var
            </span>
          </p>
          {blocked && (
            <p className="shop-blocked" role="note">
              {blocked}
            </p>
          )}
          <ul className="shop-list">
            {items.map((item) => (
              <li key={item.kind} className="shop-item">
                <span className="jk-chip shop-chip" data-kind={item.kind} aria-hidden="true">
                  <JokerIcon kind={item.kind} />
                </span>
                <span className="shop-text">
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                  <span className="shop-owned">Sende: {item.owned}</span>
                </span>
                <button
                  type="button"
                  className="shop-buy"
                  data-kind={item.kind}
                  disabled={!item.enabled}
                  aria-label={item.label}
                  onClick={() => buy(item.kind)}
                >
                  <StarIcon />
                  <span>{item.price}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="shop-note">{FREE_RIGHTS_NOTE}</p>
        </div>
        <p className="shop-toast" role="status" aria-live="polite" data-ok={toast?.ok || undefined} data-shown={toast ? '' : undefined}>
          {toast?.text ?? ''}
        </p>
      </div>
    </div>
  )
}
