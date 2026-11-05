/**
 * Aşama 8.3 — bombalı ve şanslı blokların arayüz metinleri ve konumları.
 * Saf: DOM bilmez, Node testleriyle denenir. Kurallar motordadır (src/engine/specials.ts); burası yalnızca
 * "tahtada / parçada nerede, ne yazacak" sorusunu cevaplar.
 */
import { LUCKY_JOKER_CAP } from '../engine/specials'
import type { BoardSpecial, GameState, JokerKind, Piece, SpecialKind } from '../engine/types'
import type { LuckyFx } from '../fx/effects'
import { JOKER_NAMES } from './jokerUi'

/** Hücredeki özel blok (tahtada); yoksa undefined. */
export type CellSpecial = { readonly kind: 'bomba'; readonly timer: number } | { readonly kind: 'sansli' }

/** Tahtadaki özel blokları hücreye göre dizer (64 hücrede tek tek aramamak için). */
export function specialsByCell(specials: readonly BoardSpecial[] | undefined): ReadonlyMap<number, CellSpecial> {
  const out = new Map<number, CellSpecial>()
  for (const s of specials ?? []) out.set(s.cell, s.kind === 'bomba' ? { kind: 'bomba', timer: s.timer } : { kind: 'sansli' })
  return out
}

/** Tepsideki parçanın özel bloğu hangi şekil hücresinde ([satır, sütun])? Yoksa null. */
export function pieceSpecialAt(piece: Piece, r: number, c: number): SpecialKind | null {
  const s = piece.special
  return s && s.block[0] === r && s.block[1] === c ? s.kind : null
}

/** Önizlemede (hayalet) özel bloğun ineceği tahta hücresi; parça özel değilse null. */
export function previewSpecialCell(piece: Piece | null | undefined, origin: { row: number; col: number } | null | undefined): number | null {
  if (!piece?.special || !origin) return null
  return (origin.row + piece.special.block[0]) * 8 + origin.col + piece.special.block[1]
}

/** Ekran okuyucu ve renk körlüğü için: hücredeki özel bloğun sözlü adı. */
export function specialLabel(s: CellSpecial): string {
  return s.kind === 'bomba' ? `bomba, ${s.timer} hamle sonra patlar` : 'şanslı blok'
}

/** Tahtanın erişilebilir özeti: "2 bomba, 1 şanslı blok"; özel blok yoksa boş. */
export function specialsSummary(game: Pick<GameState, 'specials'>): string {
  const all = game.specials ?? []
  const bombs = all.filter((s) => s.kind === 'bomba')
  const lucky = all.length - bombs.length
  const parts: string[] = []
  if (bombs.length > 0) {
    const soonest = Math.min(...bombs.map((b) => (b.kind === 'bomba' ? b.timer : Infinity)))
    parts.push(`${bombs.length} bomba (en yakını ${soonest} hamle sonra)`)
  }
  if (lucky > 0) parts.push(`${lucky} şanslı blok`)
  return parts.join(', ')
}

/**
 * Şanslı blok ödülünün kısa bildirimi (tepsiyi az kapatsın diye tek satıra yakın). Joker sınırı dolduysa nedeni yazar.
 * Örnekler: "Şanslı blok: +10 ★", "Şanslı blok: +1 Çekiç (bu oyuna)", "Şanslı blok: +5 ★ (2 joker sınırı doldu)".
 * @param starsCredited yıldızlar kalıcı deftere yazılıyor mu (kayıtsız oyunda yıldız sözü verilmez)
 */
export function luckyNotice(lucky: readonly LuckyFx[] | undefined, starsCredited: boolean): string | null {
  if (!lucky || lucky.length === 0) return null
  let stars = 0
  let converted = false
  const jokers: JokerKind[] = []
  for (const l of lucky) {
    if (l.reward.type === 'joker') jokers.push(l.reward.joker)
    else {
      stars += l.reward.amount
      if (l.convertedFrom) converted = true
    }
  }
  const parts: string[] = []
  if (stars > 0 && starsCredited) parts.push(`+${stars} ★`)
  for (const k of jokers) parts.push(`+1 ${JOKER_NAMES[k]}`)
  if (parts.length === 0) return null
  const head = lucky.length > 1 ? 'Şanslı bloklar' : 'Şanslı blok'
  let text = `${head}: ${parts.join(', ')}`
  if (jokers.length > 0) text += ' (bu oyuna)'
  if (converted && starsCredited) text += ` (${LUCKY_JOKER_CAP} joker sınırı doldu)`
  return text
}

/** Şanslı ödülün tahtadaki kısa çipi: "+10 ★" ya da joker adı. */
export function luckyChip(l: LuckyFx): string {
  return l.reward.type === 'stars' ? `+${l.reward.amount} ★` : `+1 ${JOKER_NAMES[l.reward.joker]}`
}

/** Bu hamlede şanslı bloktan oyuna eklenen jokerler (sınır yüzünden yıldıza dönüşenler hariç). */
export function luckyJokerKinds(lucky: readonly LuckyFx[] | undefined): JokerKind[] {
  return [...new Set((lucky ?? []).flatMap((l) => (l.reward.type === 'joker' ? [l.reward.joker] : [])))]
}

/**
 * Aşama 8 öncesi (özel bloksuz) Eğlence rekorları: değişmez, yalnızca gösterilir. 0 olanlar gösterilmez.
 * Yeni (bombalı/şanslı) Eğlence rekorları ayrı anahtarda tutulur; bu satırlar onlarla karıştırılmasın diye adlandırılır.
 */
export function legacyRecordLines(legacy: { readonly eglence: number; readonly eglenceSatin: number }): string[] {
  const fmt = (n: number) => n.toLocaleString('tr-TR')
  const out: string[] = []
  if (legacy.eglence > 0) out.push(`Önceki Eğlence rekoru (özel bloksuz): ${fmt(legacy.eglence)}`)
  if (legacy.eglenceSatin > 0) out.push(`Önceki satın alınmış jokerli (özel bloksuz): ${fmt(legacy.eglenceSatin)}`)
  return out
}
