/**
 * DENGELEME PROTOTİPİ (yalnızca simülasyon ve testler için; oyunda kullanılmaz).
 * Aşama 7.1 ekonomi kodu (src/economy/) ve onaylanan değerler DEĞİŞMEDİ. Burada, onay beklenen
 * alternatif kurallar (tavan, "satın alınmışta oyun sonu yok", yıldız dondurma, yumuşak tavan)
 * oyun içinde nasıl adım adım uygulanacaklarıyla birlikte tanımlanır; böylece kuralların birlikte
 * çalışması (sıfırlama yok, çift ödül yok) testle denetlenebilir.
 *
 * Hat ödülleri (2 / 5 / 10) ve oyun sonu formülü değişmez; senaryolar yalnızca bunların
 * oyun başına NASIL sınırlandığını değiştirir.
 */
import { starsForFinalScore } from '../src/economy/rules'

export interface StarPolicy {
  readonly id: string
  readonly label: string
  /** Oyun başına toplam yıldız (hat + oyun sonu) sınırı. null: sınır yok. */
  readonly cap: number | null
  /** Sınırın üstündeki yıldızların verilme oranı. 0 = sert tavan; 0,25 = yumuşak tavan. */
  readonly overCapRate: number
  /** B kuralı: satın alınmış joker kullanılan oyunda oyun sonu yıldızı verilmez. */
  readonly noEndIfPurchased: boolean
  /**
   * Dondurma kuralı: satın alınmış ilk joker kullanıldığı anda o oyunun yıldız hesabı kapanır.
   * O ana kadarki hat yıldızları kalır; oyun sonu yıldızı o anki skora göre verilir; sonraki hatlar yıldız vermez.
   */
  readonly freezeOnPurchase: boolean
}

const policy = (p: Partial<StarPolicy> & Pick<StarPolicy, 'id' | 'label'>): StarPolicy => ({
  cap: null,
  overCapRate: 0,
  noEndIfPurchased: false,
  freezeOnPurchase: false,
  ...p,
})

export const POLICIES: readonly StarPolicy[] = [
  policy({ id: 'A', label: 'A · mevcut, tavan yok' }),
  policy({ id: 'B', label: 'B · satın alınmışta oyun sonu yok', noEndIfPurchased: true }),
  policy({ id: 'C150', label: 'C · tavan 150', cap: 150 }),
  policy({ id: 'C200', label: 'C · tavan 200', cap: 200 }),
  policy({ id: 'C250', label: 'C · tavan 250', cap: 250 }),
  policy({ id: 'C300', label: 'C · tavan 300', cap: 300 }),
  policy({ id: 'D150', label: 'D · B + tavan 150', noEndIfPurchased: true, cap: 150 }),
  policy({ id: 'D200', label: 'D · B + tavan 200', noEndIfPurchased: true, cap: 200 }),
  policy({ id: 'D250', label: 'D · B + tavan 250', noEndIfPurchased: true, cap: 250 }),
  policy({ id: 'D300', label: 'D · B + tavan 300', noEndIfPurchased: true, cap: 300 }),
  policy({ id: 'E', label: 'E · dondurma', freezeOnPurchase: true }),
  policy({ id: 'E200', label: 'E · dondurma + tavan 200', freezeOnPurchase: true, cap: 200 }),
  policy({ id: 'E200y', label: 'E · dondurma + yumuşak tavan 200 (üstü %25)', freezeOnPurchase: true, cap: 200, overCapRate: 0.25 }),
]

export function policyById(id: string): StarPolicy {
  const p = POLICIES.find((x) => x.id === id)
  if (!p) throw new Error(`Bilinmeyen senaryo: ${id}`)
  return p
}

/** Ham (sınırsız) oyun toplamından verilen yıldıza: sert ya da yumuşak tavan. Azalmayan bir fonksiyon. */
export function shape(policy: StarPolicy, raw: number): number {
  if (policy.cap === null || raw <= policy.cap) return raw
  return policy.cap + Math.floor((raw - policy.cap) * policy.overCapRate)
}

// ---------------------------------------------------------------------------
// Oyun içi, adım adım uygulama (7.2'de defterin yapacağı iş)
// ---------------------------------------------------------------------------

export interface PolicyGame {
  /** Kurala göre sayılan ham yıldız (tavandan önce). */
  readonly raw: number
  /** Bu oyunda gerçekten verilen yıldız (tavandan sonra). Hiç azalmaz. */
  readonly awarded: number
  readonly usedPurchased: boolean
  /** Dondurma kuralında: satın alınmış ilk jokerden hemen önceki skor. */
  readonly frozenScore: number | null
  readonly finished: boolean
}

export const NEW_POLICY_GAME: PolicyGame = { raw: 0, awarded: 0, usedPurchased: false, frozenScore: null, finished: false }

export interface Step {
  readonly game: PolicyGame
  /** Bu adımda bakiyeye eklenecek yıldız (asla negatif değil). */
  readonly stars: number
}

/** Bir hamlenin hat yıldızı (2/5/10) kurala göre işlenir. */
export function policyMove(p: StarPolicy, g: PolicyGame, lineStars: number): Step {
  if (g.finished || lineStars <= 0) return { game: g, stars: 0 }
  if (p.freezeOnPurchase && g.usedPurchased) return { game: g, stars: 0 }
  const raw = g.raw + lineStars
  const stars = Math.max(0, shape(p, raw) - g.awarded)
  return { game: { ...g, raw, awarded: g.awarded + stars }, stars }
}

/** Satın alınmış bir joker kullanıldı. scoreBefore: jokerden önceki skor (jokerler puan vermez). */
export function policyPurchasedUse(_p: StarPolicy, g: PolicyGame, scoreBefore: number): PolicyGame {
  if (g.finished || g.usedPurchased) return g
  return { ...g, usedPurchased: true, frozenScore: scoreBefore }
}

/** Oyun sonu ödülü; yalnızca bir kez. */
export function policyEnd(p: StarPolicy, g: PolicyGame, finalScore: number): Step {
  if (g.finished) return { game: g, stars: 0 }
  let end = starsForFinalScore(finalScore)
  if (g.usedPurchased && p.noEndIfPurchased) end = 0
  if (g.usedPurchased && p.freezeOnPurchase) end = starsForFinalScore(g.frozenScore ?? 0)
  const raw = g.raw + end
  const stars = Math.max(0, shape(p, raw) - g.awarded)
  return { game: { ...g, raw, awarded: g.awarded + stars, finished: true }, stars }
}

// ---------------------------------------------------------------------------
// Kapalı biçim (simülasyon raporu bunu kullanır; testler adım adım sonuçla eşitliğini denetler)
// ---------------------------------------------------------------------------

export interface GameStarsInput {
  readonly lineStars: number
  readonly score: number
  readonly usedPurchased: boolean
  /** Satın alınmış ilk jokerden önce kazanılan hat yıldızı (kullanılmadıysa lineStars). */
  readonly lineAtPurchase: number
  /** Satın alınmış ilk jokerden önceki skor (kullanılmadıysa score). */
  readonly scoreAtPurchase: number
}

export function gameStars(p: StarPolicy, g: GameStarsInput): number {
  const frozen = p.freezeOnPurchase && g.usedPurchased
  const line = frozen ? g.lineAtPurchase : g.lineStars
  let end = starsForFinalScore(frozen ? g.scoreAtPurchase : g.score)
  if (g.usedPurchased && p.noEndIfPurchased) end = 0
  return shape(p, line + end)
}

/** Tavana ulaştı mı (sınır yüzünden en az bir yıldız kesildi mi)? */
export function hitCap(p: StarPolicy, g: GameStarsInput): boolean {
  if (p.cap === null) return false
  const frozen = p.freezeOnPurchase && g.usedPurchased
  const line = frozen ? g.lineAtPurchase : g.lineStars
  let end = starsForFinalScore(frozen ? g.scoreAtPurchase : g.score)
  if (g.usedPurchased && p.noEndIfPurchased) end = 0
  return line + end > p.cap
}
