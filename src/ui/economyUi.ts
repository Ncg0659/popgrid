/**
 * Yıldız ekonomisinin arayüz tarafı (Aşama 7.2). Saf: DOM bilmez, Node testleriyle denenir.
 * Kurallar src/economy/'dedir; burası yalnızca "ne gösterilir, hangi düğme açık" sorularını cevaplar.
 */
import { DEFAULT_FREE_JOKERS, JOKER_KINDS } from '../engine'
import type { GameMode, GameState, JokerCharges, JokerKind } from '../engine/types'
import { starsLeftThisGame, type EconomyState } from '../economy/ledger'
import { FUN_STAR_CAP, JOKER_PRICES } from '../economy/rules'
import type { StoreFailure } from '../storage/economy'
import { JOKER_NAMES } from './jokerUi'

export const fmtStars = (n: number): string => n.toLocaleString('tr-TR')

/** Dar düğmeler için kısa yazım: 9.999'a kadar tam, sonra 12,3B (bin) ve 1,2Mn. Tam sayı etikette ve mağazada. */
export function fmtStarsShort(n: number): string {
  if (n < 10_000) return fmtStars(n)
  const one = (x: number) => (Math.floor(x * 10) / 10).toLocaleString('tr-TR', { maximumFractionDigits: 1 })
  if (n < 1_000_000) return `${one(n / 1_000)}B`
  return `${one(n / 1_000_000)}Mn`
}

/** Mağazadaki açıklamalar (Aşama 6.4 tanıtımıyla aynı dil). */
export const JOKER_DESCRIPTIONS: Readonly<Record<JokerKind, string>> = {
  cekic: 'Bir dolu bloğu siler.',
  yenile: 'Kullanılmamış parçaları yeniler.',
  dondur: 'Bir parçayı döndürür; aynı parçanın sonraki dönüşleri ücretsiz.',
}

/** Bu sekmenin ekonomideki durumu. */
export type EconomyStatus = 'mine' | 'other' | 'readonly'

export interface ShopItem {
  readonly kind: JokerKind
  readonly name: string
  readonly description: string
  readonly price: number
  /** Satın alınmış, saklanan adet. */
  readonly owned: number
  readonly affordable: boolean
  readonly enabled: boolean
  /** Düğme yazısı / ekran okuyucu etiketi. */
  readonly label: string
}

export function shopItems(state: EconomyState, status: EconomyStatus, persistent: boolean): ShopItem[] {
  const canBuy = status === 'mine' && persistent
  return JOKER_KINDS.map((kind) => {
    const price = JOKER_PRICES[kind]
    const affordable = state.stars >= price
    const name = JOKER_NAMES[kind]
    return {
      kind,
      name,
      description: JOKER_DESCRIPTIONS[kind],
      price,
      owned: state.inventory[kind],
      affordable,
      enabled: canBuy && affordable,
      label: affordable ? `${name} satın al, ${price} yıldız` : `${name}: yetersiz yıldız, ${price} gerekir`,
    }
  })
}

/** Mağazada üstte gösterilen açıklama (satın alma neden kapalı?). Her şey yolundaysa null. */
export function shopBlockedReason(status: EconomyStatus, persistent: boolean): string | null {
  if (status === 'readonly') return 'Kayıt daha yeni bir sürümden. Bu sürümde satın alma yapılamaz.'
  if (status === 'other') return 'POPGRID başka bir sekmede açık. Satın alma yalnızca o sekmede yapılabilir.'
  if (!persistent) return 'Kayıt yapılamıyor. Satın alma, kayıt düzelene kadar kapalı.'
  return null
}

export const FREE_RIGHTS_NOTE = `Her Eğlence oyununda ücretsiz: Çekiç ${DEFAULT_FREE_JOKERS.cekic}, Yenile ${DEFAULT_FREE_JOKERS.yenile}, Döndür ${DEFAULT_FREE_JOKERS.dondur}. Satın aldıkların ücretsizler bitince kullanılır ve bir sonraki Eğlence oyununda hazır olur.`

/** Başarılı satın alma bildirimi: jokerin ne zaman kullanılabileceğini de söyler. */
export const NEXT_GAME_TEXT = 'Bir sonraki Eğlence oyununda kullanabilirsin.'

/** Satın alma sonucu kısa bildirimi. */
export function purchaseMessage(kind: JokerKind, result: { ok: true } | { ok: false; reason: StoreFailure }): string {
  const name = JOKER_NAMES[kind]
  if (result.ok) return `${name} alındı! ${NEXT_GAME_TEXT}`
  switch (result.reason) {
    case 'insufficientStars':
      return 'Yeterli yıldızın yok.'
    case 'duplicatePurchase':
      return 'Bu dokunuş zaten işlendi.'
    case 'otherTab':
      return 'POPGRID başka bir sekmede açık; satın alma orada yapılabilir.'
    case 'storageError':
    case 'readOnly':
      return 'Kayıt yapılamadı. Yıldızın ve jokerlerin değişmedi.'
    default:
      return 'Satın alma yapılamadı. Yıldızın ve jokerlerin değişmedi.'
  }
}

/**
 * Çift dokunuş koruması: aynı karede gelen iki tıklama aynı istek kimliğini taşır (defter ikincisini
 * reddeder), ayrıca başarılı alımdan sonra kısa süre yeni alım yapılmaz.
 */
export const PURCHASE_GUARD_MS = 450

export interface PurchaseGuard {
  /** Bu dokunuş için istek kimliği; koruma süresindeyse null. */
  request(now: number): string | null
  /** Alım bitti (başarılı ya da değil): bir sonraki dokunuş yeni kimlik alır. */
  settle(now: number, ok: boolean): void
}

export function createPurchaseGuard(makeId: () => string): PurchaseGuard {
  let current: string | null = null
  let blockedUntil = -Infinity
  return {
    request(now) {
      if (now < blockedUntil) return null
      current ??= makeId()
      return current
    },
    settle(now, ok) {
      current = null
      if (ok) blockedUntil = now + PURCHASE_GUARD_MS
    },
  }
}

/** Bu oyunda tavana ulaşıldı mı (Eğlence)? Ödülden önce payı vardı, şimdi yok. */
export function reachedCapNow(before: EconomyState, after: EconomyState, gameId: string): boolean {
  const a = before.active
  const b = after.active
  if (!a || a.id !== gameId || a.mode !== 'eglence') return false
  const leftBefore = starsLeftThisGame(a)
  if (leftBefore <= 0) return false
  if (b && b.id === gameId) return starsLeftThisGame(b) === 0
  // Oyun bitti: özetteki toplam tavana ulaştı mı?
  const last = after.history[after.history.length - 1]
  return !!last && last.id === gameId && last.lineStars + last.endStars >= FUN_STAR_CAP
}

export const CAP_TEXT = `Bu oyunda ${FUN_STAR_CAP} yıldız sınırına ulaştın. Oyun aynen sürüyor.`

/** Biten oyunun yıldız özeti (oyun sonu kartı için). */
export interface GameStars {
  readonly earned: number
  readonly capped: boolean
  readonly usedPurchased: boolean
}

export function finishedGameStars(state: EconomyState, gameId: string): GameStars | null {
  const g = [...state.history].reverse().find((x) => x.id === gameId)
  if (!g) return null
  const earned = g.lineStars + g.endStars
  return { earned, capped: g.mode === 'eglence' && earned >= FUN_STAR_CAP, usedPurchased: g.usedPurchased }
}

/** Sahiplik / kayıt uyarısı (oyunun üstünde, rahatsız etmeyen şerit). */
export interface EconomyBanner {
  readonly text: string
  /** Alt raftaki kısa hâli (dar ekranda iki satırı geçmez). */
  readonly short: string
  /** "Bu sekmede devam et" düğmesi gösterilsin mi? */
  readonly canTakeOver: boolean
}

export function economyBanner(status: EconomyStatus, persistent: boolean): EconomyBanner | null {
  if (status === 'other') {
    return {
      text: 'POPGRID başka bir sekmede açık. Burada oyun sürer ama yıldız kazanılmaz ve satın alınmış joker kullanılamaz.',
      short: 'Başka sekmede açık: burada yıldız kazanılmaz.',
      canTakeOver: true,
    }
  }
  if (status === 'readonly') {
    return { text: 'Kayıt daha yeni bir sürümden. Bu sürümde yıldız kaydedilemez.', short: 'Yeni sürüm kaydı: yıldız kaydedilemez.', canTakeOver: false }
  }
  if (!persistent) {
    return {
      text: 'Kayıt yapılamıyor. Bu oturumda kazanılan yıldızlar sayfa yenilenince kaybolabilir.',
      short: 'Kayıt yapılamıyor: yıldızlar kaybolabilir.',
      canTakeOver: false,
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Rekor kategorileri (Aşama 7.2 R1)
// ---------------------------------------------------------------------------

/**
 * klasik: Klasik rekor. eglence: satın alınmış joker KULLANILMAYAN Eğlence oyunları (normal Eğlence rekoru,
 * eski anahtar popgrid:v1:best:eglence aynen sürer). eglenceSatin: satın alınmış joker kullanılan Eğlence
 * oyunları (ekonomi defterindeki funBests.withPurchased).
 */
export type RecordCategory = 'klasik' | 'eglence' | 'eglenceSatin'

export const RECORD_LABELS: Readonly<Record<RecordCategory, string>> = {
  klasik: 'Rekor',
  eglence: 'Eğlence rekoru',
  eglenceSatin: 'Satın alınmış jokerli rekor',
}

/** Bu oyunda satın alınmış joker kullanıldı mı? Oyunun cüzdanı oyun başındaki envanterle karşılaştırılır. */
export function purchasedUsedInGame(game: GameState, inventoryAtStart: JokerCharges): boolean {
  const inv = game.mode === 'eglence' ? game.jokers?.inventory : undefined
  return !!inv && JOKER_KINDS.some((k) => inv[k] < inventoryAtStart[k])
}

export function recordCategory(mode: GameMode, usedPurchased: boolean): RecordCategory {
  if (mode === 'klasik') return 'klasik'
  return usedPurchased ? 'eglenceSatin' : 'eglence'
}

export interface RecordView {
  readonly category: RecordCategory
  readonly label: string
  /** Gösterilecek rekor (oyun sürerken skor geçtiyse skor). */
  readonly best: number
  /** Bu kategoride yeni rekor mu (oyunun başındaki rekora göre)? */
  readonly isNew: boolean
  /** Oyun sonu kartındaki satır. */
  readonly line: string
}

/**
 * @param bestAtStart bu kategorinin oyun başındaki rekoru
 * @param storedBest bu kategorinin şu an kayıtlı rekoru
 */
export function recordView(category: RecordCategory, score: number, bestAtStart: number, storedBest: number): RecordView {
  const best = Math.max(storedBest, score)
  const isNew = score > 0 && score > bestAtStart
  const label = RECORD_LABELS[category]
  const line = isNew
    ? category === 'eglenceSatin'
      ? 'Yeni satın alınmış jokerli rekor!'
      : 'Yeni rekor!'
    : `${label}: ${fmtStars(best)}`
  return { category, label, best, isNew, line }
}
