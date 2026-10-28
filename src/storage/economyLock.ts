/**
 * K7 — eşzamanlı yazma: sahiplik ALMA işlemini sekmeler arasında sıraya koyar.
 *
 * Tek yazıcı kuralı nedeniyle normal işlemlerde aynı anda iki yazan olmaz; tek yarış penceresi, iki
 * sekmenin aynı anda sahipliği almaya çalışmasıdır. Web Locks API destekleniyorsa bu adım tarayıcının
 * özel (exclusive) kilidiyle yapılır. Desteklenmiyorsa (eski tarayıcı, HTTPS olmayan sayfa) kilitsiz
 * yapılır: aynı milisaniyede iki alma çakışırsa sahiplik birine geçer; öteki bir sonraki işleminde
 * 'otherTab' alır. Ekonomi verisi kaybolmaz, çünkü sahiplik alınana kadar o sekme hiçbir şey yazmamıştır.
 *
 * Normal işlemler (ödül, satın alma, joker) senkron olduğu için kilide alınmaz: async kilit, aynı
 * dokunuşta jokerin uygulanmasıyla kaydın yazılmasını ayırırdı (K5'i bozardı).
 */
import type { EconomyStore, StoreResult } from './economy'

export const ECONOMY_LOCK_NAME = 'popgrid:v1:economy-lock'

/** navigator.locks'un burada kullanılan kısmı (testlerde sahtesi verilir). */
export interface LockManagerLike {
  request<T>(name: string, options: { mode: 'exclusive' }, callback: () => T | Promise<T>): Promise<T>
}

/** Tarayıcının kilit yöneticisi; yoksa null (desteklenmiyor ya da güvenli bağlam değil). */
export function webLocks(): LockManagerLike | null {
  try {
    const locks = (globalThis as { navigator?: { locks?: unknown } }).navigator?.locks as LockManagerLike | undefined
    return locks && typeof locks.request === 'function' ? locks : null
  } catch {
    return null
  }
}

/** Sahipliği (varsa) Web Locks kilidi içinde alır. */
export async function claimWithLock(
  store: EconomyStore,
  force = false,
  locks: LockManagerLike | null = webLocks(),
): Promise<StoreResult & { readonly locked: boolean }> {
  if (!locks) return { ...store.claim(force), locked: false }
  const result = await locks.request(ECONOMY_LOCK_NAME, { mode: 'exclusive' }, () => store.claim(force))
  return { ...result, locked: true }
}
