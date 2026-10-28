import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EconomyState } from '../economy/ledger'
import { ECONOMY_KEY, economyStore, type EconomyStore, type StoreResult } from '../storage/economy'
import { claimWithLock } from '../storage/economyLock'
import type { EconomyStatus } from './economyUi'

/** Sahip sekme kirasını bu aralıkla yeniler (kira 15 sn). */
export const HEARTBEAT_MS = 5_000

export interface EconomyApi {
  readonly store: EconomyStore
  /** Gösterim için son okunan kayıt (bakiye, envanter). */
  readonly state: EconomyState
  readonly status: EconomyStatus
  /** false: bu oturumda kayıt yazılamadı (yıldızlar yenilemede kaybolabilir, satın alma kapalı). */
  readonly persistent: boolean
  /** Şu an bu sekme mi yazıyor? (Oyun başlatırken satın alınmış joker getirmek için; anlık okur.) */
  ownsNow(): boolean
  /** Bir ekonomi işleminin sonucunu gösterime işler. */
  apply(result: StoreResult): void
  /** Kayıttan yeniden okur. */
  refresh(): void
  /** "Bu sekmede devam et": sahipliği (kullanıcı isteğiyle) zorla alır. */
  takeOver(): void
}

function statusOf(store: EconomyStore): EconomyStatus {
  if (store.load().status === 'future') return 'readonly'
  return store.ownership() === 'mine' ? 'mine' : 'other'
}

/**
 * Ekonomi kaydının sekme yaşam döngüsü (Aşama 7.1 tek yazıcı kuralının arayüz bağlantısı):
 * - açılışta sahiplik alınır (başka sekme sahipse bu sekme okuyucudur, uyarı gösterilir);
 * - sahip sekme kirasını düzenli yeniler; kira başkasına geçtiyse uyarı çıkar;
 * - sekme öne gelince (iPhone arka plandan dönüş) sahiplik yeniden doğrulanır, boşsa alınır;
 * - başka sekmenin yazdığı değişiklik (storage olayı) bakiyeye yansır;
 * - sayfa kapanırken sahiplik bırakılmaya çalışılır (öbür sekme beklemeden devralır).
 */
export function useEconomy(store: EconomyStore = economyStore): EconomyApi {
  // İlk çizimden önce senkron sahiplik denemesi: ilk oyun buna göre (satın alınmış jokerle ya da onsuz) kurulur.
  const [state, setState] = useState<EconomyState>(() => {
    if (store.ownership() !== 'other') store.claim()
    return store.load().state
  })
  const [status, setStatus] = useState<EconomyStatus>(() => statusOf(store))
  const [persistent, setPersistent] = useState(true)
  const persistentRef = useRef(true)

  const refresh = useCallback(() => {
    setState(store.load().state)
    setStatus(statusOf(store))
  }, [store])

  const apply = useCallback(
    (result: StoreResult) => {
      setState(result.state)
      if (result.ok) {
        if (!result.persisted && persistentRef.current) {
          persistentRef.current = false
          setPersistent(false)
        }
        setStatus(statusOf(store))
      } else if (result.reason === 'otherTab' || result.reason === 'readOnly') {
        setStatus(statusOf(store))
      } else if (result.reason === 'storageError') {
        persistentRef.current = false
        setPersistent(false)
      }
    },
    [store],
  )

  /** Sahipliği doğrular; boşsa (öbür sekme kapandı ya da kirası doldu) alır. */
  const verify = useCallback(async () => {
    const own = store.ownership()
    if (own === 'mine') {
      const r = store.heartbeat()
      if (!r.ok && r.reason === 'otherTab') refresh()
      else if (r.ok) apply(r)
      return
    }
    if (own === 'free') {
      const r = await claimWithLock(store)
      if (r.ok) apply(r)
    }
    refresh()
  }, [store, apply, refresh])

  const takeOver = useCallback(() => {
    void claimWithLock(store, true).then((r) => {
      if (r.ok) apply(r)
      refresh()
    })
  }, [store, apply, refresh])

  useEffect(() => {
    const beat = window.setInterval(() => void verify(), HEARTBEAT_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void verify()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === ECONOMY_KEY) refresh()
    }
    const onHide = () => store.release()
    // Sayfa önbellekten (bfcache) geri gelirse sahipliği yeniden doğrula.
    const onShow = () => void verify()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('storage', onStorage)
    window.addEventListener('pagehide', onHide)
    window.addEventListener('pageshow', onShow)
    return () => {
      window.clearInterval(beat)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pageshow', onShow)
    }
  }, [store, verify, refresh])

  return useMemo(
    () => ({
      store,
      state,
      status,
      persistent,
      ownsNow: () => store.ownership() === 'mine' && store.load().status !== 'future',
      apply,
      refresh,
      takeOver,
    }),
    [store, state, status, persistent, apply, refresh, takeOver],
  )
}
