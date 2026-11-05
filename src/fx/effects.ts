/**
 * Motorun olaylarını (placed, cleared, scored, combo; Aşama 8.3'te bomba ve şanslı blok olayları)
 * görsel ve ses efekti tanımına çevirir.
 * Saf fonksiyon: motoru değiştirmez, DOM bilmez, Node testleriyle denenir.
 */
import { blastArea } from '../engine/specials'
import { BOARD_SIZE, type Board, type Cell, type GameEvent, type JokerKind, type LuckyReward } from '../engine/types'

export interface ClearedBlock {
  readonly cell: number
  readonly color: Cell
  /** Patlama gecikmesi (ms): yerleştirilen parçadan uzaklaştıkça dalga gibi gecikir. */
  readonly delay: number
}

export interface Effect {
  /** Her hamlede artan kimlik; animasyonları yeniden başlatmak için anahtar. */
  readonly id: number
  readonly placed: readonly number[]
  readonly placedColor: Cell
  readonly cleared: readonly ClearedBlock[]
  /** Aynı hamlede temizlenen satır + sütun sayısı. */
  readonly lines: number
  readonly combo: number
  /** Bu hamlede kazanılan puan (bomba patlamasının hücre puanları dahil). */
  readonly gained: number
  /** Aşama 8.3 — patlayan bombalar (motorun patlatma sırasıyla). Klasik'te ve özel bloksuz oyunda hep boş. */
  readonly blasts?: readonly BlastFx[]
  /** Patlamanın temizlediği dolu hücreler; gecikme, hücreyi ilk kapsayan bombanın zincir adımından gelir. */
  readonly blasted?: readonly ClearedBlock[]
  /** Patlamanın puanı (hücre başına +1). */
  readonly blastPoints?: number
  /** Sayacı azalan (patlamayan) bombalar: sayı kısa bir zıplamayla değişir. */
  readonly ticks?: readonly number[]
  /** Şanslı blok ödülleri (tahtada küçük ödül çipi + bildirim metni). */
  readonly lucky?: readonly LuckyFx[]
}
// Yeni alanlar isteğe bağlıdır: describeEffect hepsini doldurur; eski (Aşama 8 öncesi) efekt tanımları da geçerli kalır.

/** describeEffect'in sonucu: Aşama 8.3 alanlarının hepsi dolu. */
export type MoveEffect = Effect & Required<Pick<Effect, 'blasts' | 'blasted' | 'blastPoints' | 'ticks' | 'lucky'>>

export interface BlastFx {
  /** Bombanın hücresi (3×3 alanın merkezi). */
  readonly cell: number
  /** Zincir adımı: 0 = hamlenin kendisi patlattı, 1 = başka bir bombanın patlaması tetikledi, … */
  readonly step: number
  /** Görsel gecikme (ms). */
  readonly delay: number
}

export interface LuckyFx {
  readonly cell: number
  readonly reward: LuckyReward
  readonly cause: 'line' | 'bomb'
  /** Joker sınırı (oyun başı 2) dolduğu için yıldıza dönüşen joker. */
  readonly convertedFrom?: JokerKind
  readonly delay: number
}

/** Dalga gecikmesi: hücre başına adım ve üst sınır. */
export const WAVE_STEP_MS = 22
export const WAVE_MAX_MS = 160
/** Zincirdeki her bomba bir öncekinden bu kadar sonra patlar; en çok CHAIN_MAX_STEPS adım geciktirilir. */
export const CHAIN_STEP_MS = 110
export const CHAIN_MAX_STEPS = 4
/** Bomba patlaması, satır temizleme dalgasının hemen ardından başlar. */
export const BLAST_START_MS = 60

/**
 * @param prevBoard hamleden ÖNCEKİ tahta (temizlenen blokların renkleri için)
 * @param events play() sonucunun olayları
 */
export function describeEffect(id: number, prevBoard: Board, events: readonly GameEvent[]): MoveEffect {
  let placed: readonly number[] = []
  let placedColor: Cell = 0
  let clearedCells: readonly number[] = []
  let lines = 0
  let combo = 0
  let gained = 0
  let explodedBombs: readonly number[] = []
  let blastCells: readonly number[] = []
  let blastPoints = 0
  const ticks: number[] = []
  const luckyEvents: Array<Extract<GameEvent, { type: 'luckyReward' }>> = []
  for (const e of events) {
    if (e.type === 'placed') {
      placed = e.cells
      placedColor = e.color
    } else if (e.type === 'cleared') {
      clearedCells = e.cells
      lines = e.rows.length + e.cols.length
    } else if (e.type === 'scored') {
      gained = e.breakdown.total
      combo = lines > 0 ? e.breakdown.comboMultiplier : 0
    } else if (e.type === 'exploded') {
      explodedBombs = e.bombs
      blastCells = e.cells
      blastPoints = e.points
    } else if (e.type === 'bombTick') {
      for (const b of e.bombs) ticks.push(b.cell)
    } else if (e.type === 'luckyReward') {
      luckyEvents.push(e)
    }
  }

  // Yerleştirilen parçanın ortası: dalga buradan yayılır.
  const cr = placed.reduce((s, i) => s + Math.floor(i / BOARD_SIZE), 0) / Math.max(1, placed.length)
  const cc = placed.reduce((s, i) => s + (i % BOARD_SIZE), 0) / Math.max(1, placed.length)
  const placedSet = new Set(placed)

  const cleared = clearedCells.map((cell) => {
    const r = Math.floor(cell / BOARD_SIZE)
    const c = cell % BOARD_SIZE
    const dist = Math.hypot(r - cr, c - cc)
    return {
      cell,
      color: placedSet.has(cell) ? placedColor : (prevBoard[cell] ?? 0),
      delay: Math.min(WAVE_MAX_MS, Math.round(dist) * WAVE_STEP_MS),
    }
  })

  const colorOf = (cell: number): Cell => (placedSet.has(cell) ? placedColor : (prevBoard[cell] ?? 0))
  const blasts = chainSteps(explodedBombs)
  const blastDelay = (step: number) => BLAST_START_MS + Math.min(step, CHAIN_MAX_STEPS) * CHAIN_STEP_MS
  // Her patlayan hücre, onu ilk kapsayan bombanın adımında patlar (motor da hücreyi ilk bombada temizler).
  const blastedAt = new Map<number, number>()
  for (const b of blasts) for (const cell of blastArea(b.cell)) if (!blastedAt.has(cell)) blastedAt.set(cell, b.step)
  const blasted = blastCells.map((cell) => ({ cell, color: colorOf(cell), delay: blastDelay(blastedAt.get(cell) ?? 0) }))
  const lucky = luckyEvents.map((e) => ({
    cell: e.cell,
    reward: e.reward,
    cause: e.cause,
    ...(e.convertedFrom ? { convertedFrom: e.convertedFrom } : {}),
    delay: e.cause === 'bomb' ? blastDelay(blastedAt.get(e.cell) ?? 0) : 0,
  }))

  return {
    id,
    placed,
    placedColor,
    cleared,
    lines,
    combo,
    gained: gained + blastPoints,
    blasts: blasts.map((b) => ({ ...b, delay: blastDelay(b.step) })),
    blasted,
    blastPoints,
    ticks,
    lucky,
  }
}

/**
 * Zincir adımları: motor bombaları sırayla (kuyrukla) patlatır. Bir bomba, kendinden önce patlayan bir bombanın
 * 3×3 alanındaysa o bombanın tetiklediği zincirin bir sonraki adımıdır; değilse hamlenin kendisi patlatmıştır (0).
 */
export function chainSteps(bombs: readonly number[]): Array<{ cell: number; step: number }> {
  const out: Array<{ cell: number; step: number }> = []
  for (const cell of bombs) {
    const parent = out.find((p) => blastArea(p.cell).includes(cell))
    out.push({ cell, step: parent ? parent.step + 1 : 0 })
  }
  return out
}

/** Patlamanın kutlama metni: "Bomba! +9", zincirde "Zincir ×3! +20". Patlama yoksa null. */
export function blastText(effect: Effect): string | null {
  const n = effect.blasts?.length ?? 0
  if (n === 0) return null
  const head = n >= 2 ? `Zincir ×${n}!` : 'Bomba!'
  const points = effect.blastPoints ?? 0
  return points > 0 ? `${head} +${points}` : head
}

/** Çoklu temizleme ve kombo için kısa kutlama metni; gerekmiyorsa null. */
export function celebrationText(effect: Effect): { title: string | null; combo: string | null; blast?: string } | null {
  const title = effect.lines >= 4 ? 'Muhteşem!' : effect.lines === 3 ? 'Harika!' : effect.lines === 2 ? 'Süper!' : null
  const combo = effect.combo >= 2 ? `Kombo ×${effect.combo}` : null
  const blast = blastText(effect)
  if (!title && !combo && !blast) return null
  // Patlama satırı yalnızca patlama varsa eklenir (Klasik kutlamaları birebir aynı kalır).
  return blast ? { title, combo, blast } : { title, combo }
}
