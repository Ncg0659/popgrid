/**
 * Aşama 8 — Bombalı ve Parlayan Şanslı Bloklar (yalnızca Eğlence Modu). Saf TypeScript (RULES.md 7–9).
 *
 * Üretim: önce normal üçlü (generateTriple) aynen üretilir; özel blok SONRA, ayrı bir tohum akışıyla atanır.
 * Bu yüzden parça şekil/renk sırası, Klasik Mod ve iki golden test değişmez (GENERATOR_VERSION = 1 kalır).
 *
 * Onaylı kurallar (kullanıcı, Aşama 8):
 * - Tepsi başına en fazla 1 özel blok: bomba %12; bomba çıkmazsa şanslı blok, toplamda %10.
 * - Bomba yerleştirildiği hamle sayılmadan sonraki 3 başarılı yerleştirmede patlar (3×3).
 *   Satır/sütunla erken kaldırılırsa hemen patlar. Zincirleme patlama olur; aynı bomba iki kez patlamaz.
 *   Patlamada temizlenen her dolu hücre +1 puan; hat sayılmaz (kombo ve hat yıldızı yok). Çekiç bombayı söndürür.
 * - Şanslı blok satır/sütun ya da patlamayla kaldırılınca tek ödül verir: %55 +5 yıldız, %25 +10 yıldız,
 *   %20 +1 ücretsiz joker (bu oyun için; %50 Döndür, %30 Çekiç, %20 Yenile). Çekiçle kaldırılırsa ödül yok.
 */
import { cellIndex } from './board'
import { createRng, mixSeed } from './rng'
import { getShape } from './shapes'
import {
  BOARD_SIZE,
  type Board,
  type BoardSpecial,
  type GameEvent,
  type JokerKind,
  type LuckyReward,
  type Piece,
  type PieceSpecial,
  type Shape,
  type Tray,
} from './types'

/** Eğlence özel blok kurallarının sürümü. GENERATOR_VERSION'dan bağımsızdır. */
export const FUN_RULES_VERSION = 1

/** Özel blok akışının etiketi ("SPCL"). Normal üçlü ve Yenile akışlarıyla karışmaz. */
const SPECIAL_TAG = 0x5350434c

/** Olasılıklar binde (tamsayı; ondalık kullanılmaz). */
export const BOMB_PER_MILLE = 120
export const LUCKY_PER_MILLE = 100
/** Bombanın sayacı: yerleştikten sonraki kaç başarılı yerleştirmede patlar. */
export const BOMB_FUSE = 3

/** Şanslı ödül dağılımı (yüzde, toplam 100). */
export const LUCKY_REWARD_TABLE: ReadonlyArray<{ readonly percent: number; readonly reward: 'stars5' | 'stars10' | 'joker' }> = [
  { percent: 55, reward: 'stars5' },
  { percent: 25, reward: 'stars10' },
  { percent: 20, reward: 'joker' },
]
/** Ödül joker ise türü (yüzde, toplam 100). */
export const LUCKY_JOKER_TABLE: ReadonlyArray<{ readonly percent: number; readonly joker: JokerKind }> = [
  { percent: 50, joker: 'dondur' },
  { percent: 30, joker: 'cekic' },
  { percent: 20, joker: 'yenile' },
]

export function specialSeed(seed: number, tripleIndex: number): number {
  return mixSeed((seed ^ SPECIAL_TAG) >>> 0, tripleIndex)
}

function pickPercent<T>(table: ReadonlyArray<{ readonly percent: number } & T>, roll: number): T {
  let r = roll
  for (const row of table) {
    if (r < row.percent) return row
    r -= row.percent
  }
  throw new Error('pickPercent: tablo toplamı 100 değil')
}

function luckyRewardFrom(rewardRoll: number, jokerRoll: number): LuckyReward {
  const { reward } = pickPercent(LUCKY_REWARD_TABLE, rewardRoll)
  if (reward === 'stars5') return { type: 'stars', amount: 5 }
  if (reward === 'stars10') return { type: 'stars', amount: 10 }
  return { type: 'joker', joker: pickPercent(LUCKY_JOKER_TABLE, jokerRoll).joker }
}

/**
 * Özel bloğun şekil içindeki yeri: şeklin merkezine en yakın blok (eşitlikte katalog sırası). Rastgelelik kullanmaz.
 * Karşılaştırma tamsayıyla yapılır: (2r − (h−1))² + (2c − (w−1))².
 */
export function centerBlock(shape: Shape): readonly [number, number] {
  let best = shape.cells[0]!
  let bestD = Number.POSITIVE_INFINITY
  for (const cell of shape.cells) {
    const dr = 2 * cell[0] - (shape.height - 1)
    const dc = 2 * cell[1] - (shape.width - 1)
    const d = dr * dr + dc * dc
    if (d < bestD) {
      bestD = d
      best = cell
    }
  }
  return [best[0], best[1]]
}

/**
 * Üretilmiş üçlüye özel blok atar (en fazla 1). Sonuç yalnızca (seed, tripleIndex, tepsi)'ye bağlıdır.
 * Çekiliş sayısı her zaman aynıdır (4): tür, yuva, ödül, joker türü.
 */
export function assignSpecials(seed: number, tripleIndex: number, tray: Tray): Tray {
  const rng = createRng(specialSeed(seed, tripleIndex))
  const kindRoll = rng.nextInt(1000)
  const slot = rng.nextInt(3)
  const rewardRoll = rng.nextInt(100)
  const jokerRoll = rng.nextInt(100)
  const kind = kindRoll < BOMB_PER_MILLE ? 'bomba' : kindRoll < BOMB_PER_MILLE + LUCKY_PER_MILLE ? 'sansli' : null
  const piece = tray[slot]
  if (!kind || !piece || tray.some((p) => p?.special)) return tray
  const special: PieceSpecial =
    kind === 'bomba'
      ? { kind, block: centerBlock(getShape(piece.shapeId)) }
      : { kind, block: centerBlock(getShape(piece.shapeId)), reward: luckyRewardFrom(rewardRoll, jokerRoll) }
  const next = [...tray] as Array<Piece | null>
  next[slot] = { ...piece, special }
  return next as unknown as Tray
}

/** Döndür: özel blok aynı fiziksel blokta kalır ((r, c) → (c, h−1−r), saat yönü). */
export function rotateSpecial(special: PieceSpecial, from: Shape): PieceSpecial {
  const [r, c] = special.block
  return { ...special, block: [c, from.height - 1 - r] }
}

/** Yenile: yuvadaki özel blok yeni parçaya geçer (merkez bloğa). Ek rastgelelik kullanmaz. */
export function carrySpecial(oldPiece: Piece | null, fresh: Piece): Piece {
  if (!oldPiece?.special) return fresh
  return { ...fresh, special: { ...oldPiece.special, block: centerBlock(getShape(fresh.shapeId)) } }
}

/** Yerleştirilen parçanın özel bloğu tahtada hangi hücreye düştü. */
export function placedSpecial(piece: Piece, row: number, col: number): BoardSpecial | null {
  const s = piece.special
  if (!s) return null
  const cell = cellIndex(row + s.block[0], col + s.block[1])
  if (s.kind === 'bomba') return { kind: 'bomba', cell, timer: BOMB_FUSE }
  return { kind: 'sansli', cell, reward: s.reward ?? { type: 'stars', amount: 5 } }
}

/** Patlama alanı: merkez + çevresindeki 8 hücre (tahta dışı kırpılır), sabit sırayla. */
export function blastArea(center: number): number[] {
  const row = Math.floor(center / BOARD_SIZE)
  const col = center % BOARD_SIZE
  const out: number[] = []
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) out.push(cellIndex(r, c))
    }
  }
  return out
}

export interface SpecialsOutcome {
  readonly board: Board
  readonly specials: readonly BoardSpecial[]
  readonly events: readonly GameEvent[]
  /** Patlamada temizlenen dolu hücre sayısı (= ek puan). */
  readonly points: number
  /** Bu hamlede verilen şanslı ödüller (her şanslı blok en fazla bir kez). */
  readonly rewards: readonly LuckyReward[]
}

/**
 * Bir hamlenin özel blok sonuçlarını hesaplar. Hat temizliğinden SONRA çağrılır.
 * Sıra: satır/sütunla kaldırılanlar (bomba → hemen patlar, şanslı → ödül) → eski bombaların sayacı azalır
 * (bu hamlede konan bomba sayılmaz) → sayacı biten bombalar patlar → zincir. Her bomba en fazla bir kez patlar,
 * her hücre en fazla bir kez sayılır, her şanslı blok en fazla bir kez ödül verir.
 * @param scoreBefore patlama puanı eklenmeden önceki skor (olayda son skor bildirilir)
 */
export function resolveSpecials(
  boardAfterLines: Board,
  existing: readonly BoardSpecial[],
  placed: BoardSpecial | null,
  lineCleared: ReadonlySet<number>,
  scoreBefore: number,
): SpecialsOutcome {
  const all = placed ? [...existing, placed] : [...existing]
  const byCell = new Map<number, BoardSpecial>(all.map((s) => [s.cell, s]))
  const removed = new Set<number>()
  const queue: number[] = []
  const events: GameEvent[] = []
  const rewards: LuckyReward[] = []

  // 1) Satır/sütunla kaldırılanlar.
  for (const s of all) {
    if (!lineCleared.has(s.cell)) continue
    removed.add(s.cell)
    if (s.kind === 'bomba') queue.push(s.cell)
    else {
      rewards.push(s.reward)
      events.push({ type: 'luckyReward', cell: s.cell, reward: s.reward, cause: 'line' })
    }
  }

  // 2) Eski bombaların sayacı (bu hamlede konan bomba sayılmaz).
  const timers = new Map<number, number>()
  for (const s of existing) {
    if (s.kind !== 'bomba' || removed.has(s.cell)) continue
    const t = s.timer - 1
    if (t <= 0) {
      removed.add(s.cell)
      queue.push(s.cell)
    } else timers.set(s.cell, t)
  }

  // 3) Patlamalar ve zincir.
  const board = boardAfterLines.slice()
  const exploded: number[] = []
  const done = new Set<number>()
  const clearedByBlast: number[] = []
  const blastRewards: GameEvent[] = []
  while (queue.length > 0) {
    const center = queue.shift()!
    if (done.has(center)) continue
    done.add(center)
    exploded.push(center)
    for (const cell of blastArea(center)) {
      if (board[cell] !== 0) {
        board[cell] = 0
        clearedByBlast.push(cell)
      }
      const s = byCell.get(cell)
      if (!s || removed.has(cell)) continue
      removed.add(cell)
      if (s.kind === 'bomba') queue.push(cell)
      else {
        rewards.push(s.reward)
        blastRewards.push({ type: 'luckyReward', cell, reward: s.reward, cause: 'bomb' })
      }
    }
  }

  const specials: BoardSpecial[] = []
  for (const s of all) {
    if (removed.has(s.cell)) continue
    specials.push(s.kind === 'bomba' && timers.has(s.cell) ? { ...s, timer: timers.get(s.cell)! } : s)
  }
  const ticked = specials.filter((s) => s.kind === 'bomba' && timers.has(s.cell)).map((s) => ({ cell: s.cell, timer: (s as { timer: number }).timer }))
  if (ticked.length > 0) events.push({ type: 'bombTick', bombs: ticked })
  const points = clearedByBlast.length
  if (exploded.length > 0) {
    events.push({ type: 'exploded', bombs: exploded, cells: clearedByBlast, points, score: scoreBefore + points })
  }
  events.push(...blastRewards)
  return { board, specials, events, points, rewards }
}

/** Çekiç: hücredeki özel blok kalkar (bomba söner, şanslı ödül vermez). */
export function defuseAt(specials: readonly BoardSpecial[], cell: number): { specials: readonly BoardSpecial[]; event: GameEvent | null } {
  const s = specials.find((x) => x.cell === cell)
  if (!s) return { specials, event: null }
  return { specials: specials.filter((x) => x !== s), event: { type: 'specialDefused', kind: s.kind, cell } }
}
