/**
 * Tek yazıcı kuralı (Aşama 7.1, K1/K2/K7): ekonomi kaydını aynı anda yalnızca bir sekme değiştirir.
 * Saf: zamanı (now) ve sekme kimliğini dışarıdan alır.
 *
 * - Sahip sekme her işlemde ve düzenli aralıkla (arayüz, Aşama 7.2) kirasını yeniler.
 * - Kira süresi dolmuşsa (sekme kapandı, çöktü ya da arka planda donduruldu) başka bir sekme sahipliği alabilir.
 * - Sahip sekme kapanırken sahipliği bırakır (pagehide); öbür sekme beklemeden devralır.
 * - Kullanıcı açıkça isterse ("Bu sekmede devam et") sahiplik zorla alınabilir; eski sekme bir sonraki
 *   işleminde bunu görür ve ekonomi işlemi yapamaz (oyun normal sürer).
 * Sahip olmayan sekme kaydı OKUYABİLİR (bakiye gösterimi) ama yıldız kazanamaz, satın alamaz,
 * satın alınmış joker harcayamaz.
 */
import type { EconomyResult, EconomyState } from './ledger'

/** Kira süresi. Sahip sekme bunun yaklaşık üçte birinde bir yeniler (arayüz). */
export const LEASE_MS = 15_000

export type OwnershipStatus = 'mine' | 'free' | 'other'

const validTab = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64

/**
 * mine: bu sekme sahip (kirası geçmiş olsa da başkası almadıysa sürdürebilir).
 * free: sahip yok, kira bitmiş ya da saat geri alınmış (kira bitişi şimdiden LEASE_MS'ten fazla ileride).
 * other: başka bir sekme sahip ve kirası sürüyor.
 */
export function ownershipStatus(state: EconomyState, tabId: string, now: number): OwnershipStatus {
  const owner = state.owner
  if (owner?.tabId === tabId) return 'mine'
  if (!owner || owner.until < now || owner.until - now > LEASE_MS) return 'free'
  return 'other'
}

/** Sahipliği alır (ya da kendi kirasını yeniler). Başka sekmenin kirası sürüyorsa yalnızca force ile. */
export function claimOwnership(state: EconomyState, tabId: string, now: number, force = false): EconomyResult {
  if (!validTab(tabId) || !Number.isSafeInteger(now) || now < 0) return { ok: false, state, reason: 'invalidInput' }
  if (ownershipStatus(state, tabId, now) === 'other' && !force) return { ok: false, state, reason: 'otherTab' }
  return { ok: true, stars: 0, state: { ...state, owner: { tabId, until: now + LEASE_MS } } }
}

/** Sahip sekmenin kirasını yeniler; sahip değilse dokunmaz. */
export function renewOwnership(state: EconomyState, tabId: string, now: number): EconomyState {
  if (state.owner?.tabId !== tabId || !Number.isSafeInteger(now)) return state
  return { ...state, owner: { tabId, until: now + LEASE_MS } }
}

/** Sahipliği bırakır (sekme kapanırken). Yalnızca sahip bırakabilir. */
export function releaseOwnership(state: EconomyState, tabId: string): EconomyState {
  return state.owner?.tabId === tabId ? { ...state, owner: null } : state
}
