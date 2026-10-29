import { useEffect, useRef, useState } from 'react'
import type { JokerKind } from '../engine/types'
import type { EconomyState } from '../economy/ledger'
import { SHOP_CHECK_HOLD_MS, SHOP_CHECK_IN_MS, SHOP_CHECK_OUT_MS, SHOP_TOAST_MS } from '../fx/fxTiming'
import { useDialog } from '../help/useDialog'
import { FREE_RIGHTS_NOTE, fmtStars, shopBlockedReason, shopItems, type EconomyStatus } from './economyUi'
import { JokerIcon } from './JokerIcon'
import { StarIcon } from './StarIcon'
import type { StarPulse } from './starFeedback'
import { useStarCount } from './useStarCount'

interface Props {
  state: EconomyState
  status: EconomyStatus
  persistent: boolean
  /** Tek dokunuşla satın alır; sonuç mesajını döndürür (başarılıysa ok: true). Çift dokunuş korumasında null. */
  onBuy(kind: JokerKind): { ok: boolean; text: string } | null
  /** Başka sekme sahipse: "Bu sekmede devam et" (sahipliği bu sekmeye al). */
  canTakeOver: boolean
  onTakeOver(): void
  onClose(): void
  returnFocus?: () => HTMLElement | null
  /** Bu sekmenin son yıldız olayı: alımda bakiye sayılarak düşer (Aşama 7.3c). */
  pulse?: StarPulse | null
  reducedMotion?: boolean
}

/** Başarılı alımın düğmedeki onayı: önce ✓, sonra kısa fiyata dönüş. */
type Confirm = { readonly id: number; readonly kind: JokerKind; readonly phase: 'check' | 'back' }

/**
 * Yıldız Mağazası: ekranın altından açılan panel. Oyunun üstünde açılır; tahta, parçalar ve skor değişmez.
 * Satın alınan jokerler kalıcı envantere eklenir; Eğlence oyunu sürüyorsa o oyuna da hemen eklenir.
 */
export function ShopSheet({ state, status, persistent, onBuy, canTakeOver, onTakeOver, onClose, returnFocus, pulse = null, reducedMotion = false }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialog = useDialog<HTMLDivElement>(onClose, closeRef, returnFocus)
  const [toast, setToast] = useState<{ id: number; text: string; ok: boolean } | null>(null)
  const toastId = useRef(0)
  const items = shopItems(state, status, persistent)
  const blocked = shopBlockedReason(status, persistent)
  const balance = useStarCount(state.stars, pulse, reducedMotion)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const confirmId = useRef(0)

  // ✓ onayı: 150 ms giriş + 700 ms sabit, sonra 150 ms fiyata dönüş. Yeni alım öncekinin yerini alır.
  useEffect(() => {
    if (!confirm) return
    const next = confirm.phase === 'check' ? SHOP_CHECK_IN_MS + SHOP_CHECK_HOLD_MS : SHOP_CHECK_OUT_MS
    const t = window.setTimeout(
      () => setConfirm((c) => (c?.id !== confirm.id ? c : c.phase === 'check' ? { ...c, phase: 'back' } : null)),
      next,
    )
    return () => window.clearTimeout(t)
  }, [confirm])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), SHOP_TOAST_MS)
    return () => window.clearTimeout(t)
  }, [toast])

  const buy = (kind: JokerKind) => {
    const r = onBuy(kind)
    if (!r) return
    toastId.current += 1
    setToast({ id: toastId.current, text: r.text, ok: r.ok })
    // Onay yalnızca kalıcı kaydı yapılan alımda (yetersiz yıldız, başka sekme, kayıt hatası: onay yok).
    if (r.ok) {
      confirmId.current += 1
      setConfirm({ id: confirmId.current, kind, phase: 'check' })
    }
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
              <strong data-spend={balance.spending || undefined}>{fmtStars(balance.shown)}</strong> yıldızın var
            </span>
          </p>
          {blocked && (
            <div className="shop-blocked" role="note">
              <p>{blocked}</p>
              {canTakeOver && (
                <button type="button" className="btn-soft wide eco-takeover" onClick={onTakeOver}>
                  Bu sekmede devam et
                </button>
              )}
            </div>
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
                  <span className="shop-owned">
                    Sende:{' '}
                    <span
                      key={confirm?.kind === item.kind ? `o${confirm.id}` : 'o'}
                      className={confirm?.kind === item.kind && confirm.phase === 'check' ? 'shop-owned-n fx-soft-bump' : 'shop-owned-n'}
                    >
                      {item.owned}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  className="shop-buy"
                  data-kind={item.kind}
                  disabled={!item.enabled}
                  aria-label={item.label}
                  onClick={() => buy(item.kind)}
                >
                  {confirm?.kind === item.kind && confirm.phase === 'check' ? (
                    <span key={`c${confirm.id}`} className="shop-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M5 12.5l4.2 4.2L19 7" />
                      </svg>
                    </span>
                  ) : (
                    <span key={confirm?.kind === item.kind ? `p${confirm.id}` : 'p'} className={confirm?.kind === item.kind ? 'shop-price shop-price-back' : 'shop-price'}>
                      <StarIcon />
                      <span>{item.price}</span>
                    </span>
                  )}
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
