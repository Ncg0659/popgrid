/** Tahtanın kenar uzunluğu (8×8). */
export const BOARD_SIZE = 8
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE

/** Renkler motorda yalnızca numaradır (1–6); görünüm CSS'te belirlenir. 0 = boş hücre. */
export const COLOR_COUNT = 6
export type Cell = number

/** 64 hücre, satır satır: indeks = satır * 8 + sütun. */
export type Board = readonly Cell[]

/** Bir parçanın şekli: kapladığı hücreler (satır, sütun), sol üst köşe 0,0. */
export interface Shape {
  readonly id: string
  readonly cells: ReadonlyArray<readonly [number, number]>
  readonly width: number
  readonly height: number
  /** Ağırlıklı seçimde ağırlık (tamsayı). Büyük = daha sık. */
  readonly weight: number
}

export interface Piece {
  readonly shapeId: string
  readonly color: Cell
}

/** Tepsideki üç yuva; kullanılan yuva null olur. */
export type Tray = readonly [Piece | null, Piece | null, Piece | null]
export type Slot = 0 | 1 | 2

export interface RescueConfig {
  readonly enabled: boolean
  /** Oyun başındaki kurtarma şansı (yüzde, 0–100). */
  readonly startPercent: number
  /** rampScore puana ulaşıldığında kurtarma şansı (yüzde). */
  readonly endPercent: number
  /** Şansın başlangıçtan sona doğrusal geçtiği puan aralığı. */
  readonly rampScore: number
}

export interface GeneratorConfig {
  readonly rescue: RescueConfig
}

/** Klasik: jokersiz, bugünkü oyun. Eğlence: jokerli oyun (ayrı rekor). */
export type GameMode = 'klasik' | 'eglence'

export type JokerKind = 'cekic' | 'yenile' | 'dondur'
export type JokerCharges = Readonly<Record<JokerKind, number>>

/**
 * Oyuncunun bu oyundaki joker hakları, iki ayrı kaynaktan:
 * - free: oyun başına verilen ücretsiz haklar (oyun bitince kaybolur),
 * - inventory: kalıcı envanterden bu oyuna getirilenler (ileride yıldızla alınacak; şimdilik hep 0).
 * Harcama önce ücretsiz haklardan yapılır; envanterden harcanan her hak olayla bildirilir
 * ki arayüz kalıcı envanteri düşebilsin.
 */
export interface JokerWallet {
  readonly free: JokerCharges
  readonly inventory: JokerCharges
}

/** Joker hamleleri. Hamleler gibi kaydedilip tekrar oynatılabilir. */
export type JokerAction =
  | { readonly type: 'cekic'; readonly cell: number }
  | { readonly type: 'yenile' }
  | { readonly type: 'dondur'; readonly slot: Slot }

export interface GameState {
  readonly generatorVersion: number
  readonly mode: GameMode
  /** Klasik Mod'da null. */
  readonly jokers: JokerWallet | null
  /** Bu oyunda kaç kez Yenile kullanıldı (Yenile'nin kendi tohum akışı için). */
  readonly refreshCount: number
  /** Döndür hakkı ödenmiş yuvalar: o parça yerleşene kadar ek dönüşler ücretsiz. */
  readonly rotatePaid: readonly [boolean, boolean, boolean]
  /** Eğlence Modu: hiçbir parça sığmıyor ama jokerle kurtuluş mümkün. Klasik'te hep false. */
  readonly stuck: boolean
  readonly seed: number
  readonly config: GeneratorConfig
  readonly board: Board
  readonly tray: Tray
  readonly score: number
  /** Art arda temizleme yapan hamle sayısı. */
  readonly combo: number
  /** Kaçıncı üçlüde olduğumuz (0'dan başlar). */
  readonly tripleIndex: number
  readonly moveCount: number
  readonly gameOver: boolean
}

export interface Move {
  readonly slot: Slot
  readonly row: number
  readonly col: number
}

export interface ScoreBreakdown {
  readonly placement: number
  readonly lines: number
  readonly clearBase: number
  readonly comboMultiplier: number
  readonly clear: number
  readonly total: number
}

/** Arayüzün ve animasyonların dinlediği olaylar. */
export type GameEvent =
  | { type: 'placed'; slot: Slot; shapeId: string; color: Cell; cells: readonly number[] }
  | { type: 'cleared'; rows: readonly number[]; cols: readonly number[]; cells: readonly number[] }
  | { type: 'scored'; breakdown: ScoreBreakdown; score: number }
  | { type: 'combo'; combo: number }
  | { type: 'newTriple'; tripleIndex: number; tray: Tray; rescued: boolean }
  | { type: 'gameOver'; score: number }
  /** Eğlence Modu: parçalar sığmıyor ama bir joker oyunu kurtarabilir. */
  | { type: 'stuck' }
  | { type: 'jokerUsed'; joker: JokerKind; source: 'free' | 'inventory' }
  | { type: 'hammered'; cell: number; color: Cell }
  | { type: 'refreshed'; slots: readonly Slot[]; tray: Tray; guaranteed: boolean }
  | { type: 'rotated'; slot: Slot; from: string; to: string; paid: boolean }

export type InvalidReason = 'gameOver' | 'emptySlot' | 'doesNotFit'

export type JokerInvalidReason =
  | 'gameOver'
  | 'notFunMode'
  | 'noCharge'
  | 'emptySlot'
  | 'emptyCell'
  | 'badCell'
  | 'notRotatable'

export type JokerResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly state: GameState; readonly reason: JokerInvalidReason }

export type PlayResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly state: GameState; readonly reason: InvalidReason }
