/**
 * Joker sistemi (yalnızca Eğlence Modu). Saf ve belirlenimli:
 * aynı seed + aynı hamleler + aynı joker hamleleri = aynı oyun.
 *
 * Kurallar:
 * - Jokerler puan vermez, kombo serisini ne artırır ne sıfırlar, üçlü numarasını ilerletmez.
 * - Çekiç: seçilen dolu hücreyi boşaltır. Hücre silmek hat tamamlayamaz; temizleme yoktur.
 * - Yenile: tepside kalan parçaları değiştirir. Tahtada boş hücre varsa en az biri sığar.
 *   Kendi tohum akışını kullanır; normal üçlü sırasını kaydırmaz.
 * - Döndür: parçayı saat yönünde 90° çevirir. İlk dönüş 1 hak harcar; o parça yerleşene
 *   (ya da Yenile ile değişene) kadar sonraki dönüşler ücretsizdir.
 */
import { canPlaceAnywhere, shapeCellsAt } from './board'
import { RESCUE_DRAWS, drawColor, drawShape } from './generator'
import { createRng, mixSeed } from './rng'
import { SHAPES, getShape } from './shapes'
import {
  BOARD_SIZE,
  CELL_COUNT,
  type Board,
  type GameEvent,
  type GameState,
  type JokerAction,
  type JokerCharges,
  type JokerKind,
  type JokerResult,
  type JokerWallet,
  type Piece,
  type Shape,
  type Slot,
  type Tray,
} from './types'

/**
 * Oyun başına ücretsiz haklar: Çekiç 1, Yenile 1, Döndür 2.
 * DENEYSEL — simülasyonla seçildi (docs/sim-jokers.md): 2/2/3 oyunu 3–5 kat uzatıyordu, 1/1/2 yaklaşık 2–3 kat.
 */
export const DEFAULT_FREE_JOKERS: JokerCharges = { cekic: 1, yenile: 1, dondur: 2 }
export const NO_JOKERS: JokerCharges = { cekic: 0, yenile: 0, dondur: 0 }
export const JOKER_KINDS: readonly JokerKind[] = ['cekic', 'yenile', 'dondur']

const NO_ROTATION: readonly [boolean, boolean, boolean] = [false, false, false]

// ---------------------------------------------------------------------------
// Haklar (ileride yıldız ekonomisi bu fonksiyonları kullanacak)
// ---------------------------------------------------------------------------

export function validateCharges(charges: JokerCharges): JokerCharges {
  for (const kind of JOKER_KINDS) {
    const n = charges[kind]
    if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`Geçersiz joker hakkı: ${kind}=${n}`)
  }
  return { cekic: charges.cekic, yenile: charges.yenile, dondur: charges.dondur }
}

/** İki hak kümesini toplar (ör. envantere satın alınan jokeri eklemek). Eskisini değiştirmez. */
export function grantJokers(charges: JokerCharges, add: Partial<JokerCharges>): JokerCharges {
  return validateCharges({
    cekic: charges.cekic + (add.cekic ?? 0),
    yenile: charges.yenile + (add.yenile ?? 0),
    dondur: charges.dondur + (add.dondur ?? 0),
  })
}

/** Bu oyunda o jokerden toplam kaç hak var (ücretsiz + envanter). */
export function jokerCount(wallet: JokerWallet | null, kind: JokerKind): number {
  return wallet ? wallet.free[kind] + wallet.inventory[kind] : 0
}

/** Bir hak harcar: önce ücretsiz haklardan, bitince envanterden. Hak yoksa null. */
function spend(wallet: JokerWallet, kind: JokerKind): { wallet: JokerWallet; source: 'free' | 'inventory' } | null {
  if (wallet.free[kind] > 0) {
    return { wallet: { ...wallet, free: { ...wallet.free, [kind]: wallet.free[kind] - 1 } }, source: 'free' }
  }
  if (wallet.inventory[kind] > 0) {
    return {
      wallet: { ...wallet, inventory: { ...wallet.inventory, [kind]: wallet.inventory[kind] - 1 } },
      source: 'inventory',
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Döndürme: katalogdaki her şeklin 90° saat yönü karşılığı
// ---------------------------------------------------------------------------

function cellsKey(cells: ReadonlyArray<readonly [number, number]>): string {
  const minR = Math.min(...cells.map(([r]) => r))
  const minC = Math.min(...cells.map(([, c]) => c))
  return cells
    .map(([r, c]) => [r - minR, c - minC] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([r, c]) => `${r},${c}`)
    .join(';')
}

function buildRotationMap(): ReadonlyMap<string, string> {
  const byKey = new Map(SHAPES.map((shape) => [cellsKey(shape.cells), shape.id] as const))
  const map = new Map<string, string>()
  for (const shape of SHAPES) {
    // (satır, sütun) → (sütun, yükseklik-1-satır): saat yönünde 90°.
    const rotated = shape.cells.map(([r, c]) => [c, shape.height - 1 - r] as const)
    const target = byKey.get(cellsKey(rotated))
    if (!target) throw new Error(`Döndürülmüş şekil katalogda yok: ${shape.id}`)
    map.set(shape.id, target)
  }
  return map
}

const ROTATE_CW = buildRotationMap()

/** Şeklin saat yönünde 90° döndürülmüş hâlinin kimliği. */
export function rotateShapeId(shapeId: string): string {
  const next = ROTATE_CW.get(shapeId)
  if (!next) throw new Error(`Bilinmeyen parça: ${shapeId}`)
  return next
}

/** Döndürünce değişmeyen şekiller (tek kare, 2×2, 3×3) için false. */
export function isRotatable(shapeId: string): boolean {
  return rotateShapeId(shapeId) !== shapeId
}

/** Şeklin bütün farklı yönleri (kendisi dahil, 1–4 adet). */
export function orientationsOf(shapeId: string): string[] {
  const list = [shapeId]
  let next = rotateShapeId(shapeId)
  while (next !== shapeId) {
    list.push(next)
    next = rotateShapeId(next)
  }
  return list
}

// ---------------------------------------------------------------------------
// Yenile
// ---------------------------------------------------------------------------

/** Yenile'nin ayrı tohum akışı için etiket ("JOKR"). Normal üçlü akışıyla karışmaz. */
const REFRESH_TAG = 0x4a4f4b52

export function refreshSeed(seed: number, tripleIndex: number, refreshCount: number): number {
  return mixSeed(mixSeed((seed ^ REFRESH_TAG) >>> 0, tripleIndex), refreshCount)
}

export interface RefreshResult {
  readonly tray: Tray
  readonly slots: readonly Slot[]
  /** Hiçbir yeni parça sığmadığı için biri sığan bir parçayla değiştirildiyse true. */
  readonly guaranteed: boolean
}

function anyFits(board: Board, pieces: ReadonlyArray<Piece | null>): boolean {
  return pieces.some((p) => p !== null && canPlaceAnywhere(board, getShape(p.shapeId)))
}

/**
 * Yenile'nin sonucunu hesaplar (durumu değiştirmez). Sonuç yalnızca
 * (seed, tripleIndex, refreshCount, tahta, dolu yuvalar)'a bağlıdır.
 * Çekiliş sırası sabittir: önce her dolu yuva için şekil + renk, sonra gerekirse garanti araması.
 */
export function refreshTray(state: GameState): RefreshResult {
  const rng = createRng(refreshSeed(state.seed, state.tripleIndex, state.refreshCount))
  const slots = ([0, 1, 2] as const).filter((i) => state.tray[i] !== null)
  const fresh: Piece[] = slots.map(() => ({ shapeId: drawShape(rng).id, color: drawColor(rng) }))
  let guaranteed = false

  if (fresh.length > 0 && !anyFits(state.board, fresh) && state.board.some((c) => c === 0)) {
    let replacement: Shape | null = null
    for (let i = 0; i < RESCUE_DRAWS && !replacement; i++) {
      const shape = drawShape(rng)
      if (canPlaceAnywhere(state.board, shape)) replacement = shape
    }
    if (!replacement) {
      // Yedek: sığan şekiller arasından ağırlıklı seçim. Boş hücre varsa en az 1×1 sığar.
      const fitting = SHAPES.filter((shape) => canPlaceAnywhere(state.board, shape))
      const total = fitting.reduce((sum, shape) => sum + shape.weight, 0)
      let pick = total > 0 ? rng.nextInt(total) : -1
      for (const shape of fitting) {
        if (pick < shape.weight) {
          replacement = shape
          break
        }
        pick -= shape.weight
      }
    }
    if (replacement) {
      const k = rng.nextInt(fresh.length)
      fresh[k] = { shapeId: replacement.id, color: fresh[k]!.color }
      guaranteed = true
    }
  }

  const tray = [...state.tray] as Array<Piece | null>
  slots.forEach((slot, i) => {
    tray[slot] = fresh[i] ?? null
  })
  return { tray: tray as unknown as Tray, slots, guaranteed }
}

// ---------------------------------------------------------------------------
// Kurtuluş analizi
// ---------------------------------------------------------------------------

/** Şekli tahtaya koymak için en az kaç dolu hücrenin silinmesi gerektiği (Çekiç sayısı). */
export function minHammersToFit(board: Board, shape: Shape): number {
  let best = Infinity
  for (let row = 0; row <= BOARD_SIZE - shape.height; row++) {
    for (let col = 0; col <= BOARD_SIZE - shape.width; col++) {
      const cells = shapeCellsAt(shape, row, col)
      if (!cells) continue
      let filled = 0
      for (const i of cells) if (board[i] !== 0) filled++
      if (filled < best) best = filled
      if (best === 0) return 0
    }
  }
  return best
}

/**
 * Eğlence Modu'nda, eldeki jokerlerle (tek başına ya da birlikte) en az bir parçanın
 * yerleştirilebilir hâle gelip gelmediği. Yalnızca hak sayısına değil, gerçek etkiye bakar:
 * - Yenile: gerçek Yenile sonucu hesaplanır; yeni parçalardan biri sığıyor mu?
 * - Çekiç + Döndür: her parça ve (Döndür kullanılabiliyorsa) her yönü için, sığması için
 *   silinmesi gereken en az hücre sayısı eldeki Çekiç sayısını aşmıyor mu?
 * Jokerler tahtayı yalnızca boşalttığı ya da parçayı değiştirdiği için bu kontrol eksiksizdir.
 */
export function canRescue(state: GameState): boolean {
  const wallet = state.jokers
  if (state.mode !== 'eglence' || !wallet) return false
  if (jokerCount(wallet, 'yenile') > 0 && anyFits(state.board, refreshTray(state).tray)) return true
  const hammers = jokerCount(wallet, 'cekic')
  const rotateAvailable = jokerCount(wallet, 'dondur') > 0
  for (const slot of [0, 1, 2] as const) {
    const piece = state.tray[slot]
    if (!piece) continue
    const ids = rotateAvailable || state.rotatePaid[slot] ? orientationsOf(piece.shapeId) : [piece.shapeId]
    for (const id of ids) if (minHammersToFit(state.board, getShape(id)) <= hammers) return true
  }
  return false
}

/**
 * Hamle ya da joker sonrası oyun sonu kararı.
 * Klasik: hiçbir parça sığmıyorsa oyun biter (bugünkü kural).
 * Eğlence: sığmıyorsa ve jokerle kurtuluş varsa "sıkıştı"; yoksa oyun biter.
 */
export function resolveEnd(next: GameState): { stuck: boolean; gameOver: boolean } {
  if (anyFits(next.board, next.tray)) return { stuck: false, gameOver: false }
  const rescuable = canRescue(next)
  return { stuck: rescuable, gameOver: !rescuable }
}

/** Kullanılan yuvanın Döndür ödemesini temizler; yeni üçlüde hepsi sıfırlanır. */
export function nextRotatePaid(
  paid: readonly [boolean, boolean, boolean],
  usedSlot: Slot,
  newTriple: boolean,
): readonly [boolean, boolean, boolean] {
  if (newTriple) return NO_ROTATION
  if (!paid[usedSlot]) return paid
  const next = [...paid] as [boolean, boolean, boolean]
  next[usedSlot] = false
  return next
}

export function initialRotatePaid(): readonly [boolean, boolean, boolean] {
  return NO_ROTATION
}

// ---------------------------------------------------------------------------
// Joker hamlesi
// ---------------------------------------------------------------------------

/**
 * Bir joker kullanır. Eski durumu değiştirmez; yeni durum ve olayları döndürür.
 * Geçersizse durum aynen döner ve hak harcanmaz.
 */
export function applyJoker(state: GameState, action: JokerAction): JokerResult {
  if (state.gameOver) return { ok: false, state, reason: 'gameOver' }
  const wallet = state.jokers
  if (state.mode !== 'eglence' || !wallet) return { ok: false, state, reason: 'notFunMode' }

  const events: GameEvent[] = []
  let next: GameState

  switch (action.type) {
    case 'cekic': {
      const cell = action.cell
      if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return { ok: false, state, reason: 'badCell' }
      const color = state.board[cell] ?? 0
      if (color === 0) return { ok: false, state, reason: 'emptyCell' }
      const paid = spend(wallet, 'cekic')
      if (!paid) return { ok: false, state, reason: 'noCharge' }
      const board = state.board.slice()
      board[cell] = 0
      events.push({ type: 'jokerUsed', joker: 'cekic', source: paid.source })
      events.push({ type: 'hammered', cell, color })
      next = { ...state, board, jokers: paid.wallet }
      break
    }
    case 'yenile': {
      const paid = spend(wallet, 'yenile')
      if (!paid) return { ok: false, state, reason: 'noCharge' }
      const result = refreshTray(state)
      const rotatePaid = [...state.rotatePaid] as [boolean, boolean, boolean]
      for (const slot of result.slots) rotatePaid[slot] = false
      events.push({ type: 'jokerUsed', joker: 'yenile', source: paid.source })
      events.push({ type: 'refreshed', slots: result.slots, tray: result.tray, guaranteed: result.guaranteed })
      next = {
        ...state,
        tray: result.tray,
        jokers: paid.wallet,
        refreshCount: state.refreshCount + 1,
        rotatePaid,
      }
      break
    }
    case 'dondur': {
      const slot = action.slot
      const piece = state.tray[slot]
      if (!piece) return { ok: false, state, reason: 'emptySlot' }
      const to = rotateShapeId(piece.shapeId)
      if (to === piece.shapeId) return { ok: false, state, reason: 'notRotatable' }
      let jokers = wallet
      const alreadyPaid = state.rotatePaid[slot]
      if (!alreadyPaid) {
        const paid = spend(wallet, 'dondur')
        if (!paid) return { ok: false, state, reason: 'noCharge' }
        jokers = paid.wallet
        events.push({ type: 'jokerUsed', joker: 'dondur', source: paid.source })
      }
      const tray = [...state.tray] as Array<Piece | null>
      tray[slot] = { shapeId: to, color: piece.color }
      const rotatePaid = [...state.rotatePaid] as [boolean, boolean, boolean]
      rotatePaid[slot] = true
      events.push({ type: 'rotated', slot, from: piece.shapeId, to, paid: !alreadyPaid })
      next = { ...state, tray: tray as unknown as Tray, jokers, rotatePaid }
      break
    }
  }

  const end = resolveEnd(next)
  if (end.gameOver) events.push({ type: 'gameOver', score: next.score })
  else if (end.stuck) events.push({ type: 'stuck' })
  return { ok: true, events, state: { ...next, stuck: end.stuck, gameOver: end.gameOver } }
}

/** "Bitir" düğmesi: oyuncu sıkıştığında (ya da istediğinde) oyunu sonlandırır. */
export function giveUp(state: GameState): JokerResult {
  if (state.gameOver) return { ok: false, state, reason: 'gameOver' }
  return {
    ok: true,
    events: [{ type: 'gameOver', score: state.score }],
    state: { ...state, stuck: false, gameOver: true },
  }
}
