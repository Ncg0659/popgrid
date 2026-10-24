import { canPlaceAnywhere } from './board'
import { createRng, mixSeed, type Rng } from './rng'
import { SHAPES, TOTAL_WEIGHT, getShape } from './shapes'
import { COLOR_COUNT, type Board, type GeneratorConfig, type Piece, type Shape, type Tray } from './types'

/**
 * Üretici sürümü. Aynı seed'in farklı parça sırası üretmesine yol açan her değişiklikte
 * (katalog, ağırlık, algoritma) artırılır. Kayıtlı oyunlar bu numarayla saklanır.
 */
export const GENERATOR_VERSION = 1

/** Kurtarma zarı tuttuğunda sığan parça aramak için en fazla kaç ek çekiliş yapılır. */
export const RESCUE_DRAWS = 24

/**
 * Varsayılan ayar. Oranlar DENEYSEL — simülasyon sonucuna göre seçilecek (RULES.md 17).
 */
export const DEFAULT_CONFIG: GeneratorConfig = {
  rescue: { enabled: true, startPercent: 70, endPercent: 25, rampScore: 3000 },
}

/** Günlük yarışma için: kurtarma kapalı, parça sırası tahtadan bağımsız. */
export const SHARED_SEQUENCE_CONFIG: GeneratorConfig = {
  rescue: { enabled: false, startPercent: 0, endPercent: 0, rampScore: 1 },
}

/** Skora göre kurtarma şansı (tamsayı yüzde). Ondalık sayı kullanılmaz. */
export function rescueChance(config: GeneratorConfig, score: number): number {
  const { enabled, startPercent, endPercent, rampScore } = config.rescue
  if (!enabled) return 0
  if (score >= rampScore) return endPercent
  return startPercent + Math.trunc(((endPercent - startPercent) * score) / rampScore)
}

function drawShape(rng: Rng): Shape {
  let roll = rng.nextInt(TOTAL_WEIGHT)
  for (const shape of SHAPES) {
    if (roll < shape.weight) return shape
    roll -= shape.weight
  }
  throw new Error('drawShape: ağırlık hesabı hatalı')
}

const drawColor = (rng: Rng): number => 1 + rng.nextInt(COLOR_COUNT)

export interface TripleResult {
  readonly tray: Tray
  /** Kurtarma bir parçayı değiştirdiyse true. */
  readonly rescued: boolean
}

/**
 * Bir üçlü üretir. Sonuç yalnızca (seed, tripleIndex, board, score, config)'e bağlıdır.
 * Çekiliş sırası sabittir: önce 3 ham parça (şekil + renk), sonra kurtarma zarı her zaman atılır.
 * Kurtarma kapalıyken sonuç tahtadan bağımsızdır.
 */
export function generateTriple(
  seed: number,
  tripleIndex: number,
  board: Board,
  score: number,
  config: GeneratorConfig,
): TripleResult {
  const rng = createRng(mixSeed(seed, tripleIndex))
  const raw: Piece[] = []
  for (let i = 0; i < 3; i++) {
    const shape = drawShape(rng)
    raw.push({ shapeId: shape.id, color: drawColor(rng) })
  }
  const roll = rng.nextInt(100)
  const tray = (): Tray => [raw[0] ?? null, raw[1] ?? null, raw[2] ?? null]

  if (roll >= rescueChance(config, score)) return { tray: tray(), rescued: false }
  if (raw.some((p) => canPlaceAnywhere(board, getShape(p.shapeId)))) return { tray: tray(), rescued: false }

  // Kurtarma: normal ağırlıklı havuzdan sığan bir parça ara.
  let replacement: Shape | null = null
  for (let i = 0; i < RESCUE_DRAWS && !replacement; i++) {
    const shape = drawShape(rng)
    if (canPlaceAnywhere(board, shape)) replacement = shape
  }
  if (!replacement) {
    // Yedek: sığan şekiller arasından ağırlıklı seçim (katalog sırası sabit).
    const fitting = SHAPES.filter((shape) => canPlaceAnywhere(board, shape))
    const total = fitting.reduce((sum, shape) => sum + shape.weight, 0)
    if (total === 0) return { tray: tray(), rescued: false }
    let pick = rng.nextInt(total)
    for (const shape of fitting) {
      if (pick < shape.weight) {
        replacement = shape
        break
      }
      pick -= shape.weight
    }
  }
  if (!replacement) return { tray: tray(), rescued: false }
  const slot = rng.nextInt(3)
  const old = raw[slot]
  raw[slot] = { shapeId: replacement.id, color: old ? old.color : drawColor(rng) }
  return { tray: tray(), rescued: true }
}
