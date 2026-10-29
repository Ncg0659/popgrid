/**
 * Bildirim ve efekt süreleri (Aşama 7.3a): tek yerde. Değerler 7.2'deki davranışla aynıdır.
 * Hareket süreleri en çok 300 ms; bilginin ekranda kalma süresi ayrı tutulur.
 */

/** Mağaza içindeki satın alma bildirimi. */
export const SHOP_TOAST_MS = 2200
/** Oyun sırasındaki kısa yıldız bilgisi (ör. 300 sınırı). */
export const STAR_NOTICE_MS = 3500
/** Sahiplik / kayıt uyarısı (daha uzun okunur). */
export const STAR_BANNER_MS = 6000

// ---------- Aşama 7.3b: yıldız geri bildirimi ----------
/** Bakiye sayısının eski değerden yenisine geçişi (hareket). */
export const STAR_COUNT_MS = 300
/** Kazanım çipi: 150 ms belirme + 6 px yükselme, 900 ms sabit, 250 ms solma. */
export const STAR_CHIP_IN_MS = 150
export const STAR_CHIP_HOLD_MS = 900
export const STAR_CHIP_OUT_MS = 250
/** Çipin ekranda kalma toplamı (1,3 sn). */
export const STAR_CHIP_MS = STAR_CHIP_IN_MS + STAR_CHIP_HOLD_MS + STAR_CHIP_OUT_MS

// ---------- Aşama 7.3c: satın alma geri bildirimi ----------
/** Harcamada bakiye sayım sonrası mercan renkte kalır; dönüş 250 ms renk geçişi. */
export const STAR_SPEND_HOLD_MS = 300
export const STAR_SPEND_BACK_MS = 250
/** Fiyat düğmesindeki ✓: 150 ms giriş, 700 ms sabit, 150 ms fiyata dönüş (toplam 1 sn). */
export const SHOP_CHECK_IN_MS = 150
export const SHOP_CHECK_HOLD_MS = 700
export const SHOP_CHECK_OUT_MS = 150
/** "Sende" sayısı ve joker hak sayısı: tek yumuşak zıplama. */
export const SOFT_BUMP_MS = 260

// ---------- Aşama 7.3d: oyun sonu yıldız sayımı ----------
/** Kart yerleşsin diye sayım öncesi bekleme; sayım STAR_COUNT_MS sürer (toplam 450 ms). */
export const GAMEOVER_STARS_DELAY_MS = 150
