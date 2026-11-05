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
  /** Aşama 8 (yalnızca Eğlence): parçanın bir bloğu özel. Klasik'te hiç bulunmaz. */
  readonly special?: PieceSpecial
}

/** Aşama 8 özel blok türleri: bomba ve parlayan şanslı blok. */
export type SpecialKind = 'bomba' | 'sansli'

/** Şanslı bloğun tek seferlik ödülü (üretimde belirlenir, tekrar oynatmada aynıdır). */
export type LuckyReward =
  | { readonly type: 'stars'; readonly amount: number }
  | { readonly type: 'joker'; readonly joker: JokerKind }

/** Tepsideki parçanın özel bloğu: hangi blok (şeklin içindeki satır, sütun) ve ne olduğu. */
export interface PieceSpecial {
  readonly kind: SpecialKind
  readonly block: readonly [number, number]
  /** Yalnızca şanslı blokta. */
  readonly reward?: LuckyReward
}

/** Tahtadaki özel blok. Bomba: kalan başarılı yerleştirme sayısı (timer). */
export type BoardSpecial =
  | { readonly kind: 'bomba'; readonly cell: number; readonly timer: number }
  | { readonly kind: 'sansli'; readonly cell: number; readonly reward: LuckyReward }

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
  /**
   * Aşama 8 — yalnızca Eğlence: özel blok kurallarının sürümü (1). Klasik'te ve özel bloksuz Eğlence'de yok.
   * GENERATOR_VERSION'dan ayrıdır: parça şekil/renk sırasını değiştirmez, yalnızca Eğlence kurallarını belirtir.
   */
  readonly funRulesVersion?: number
  /** Aşama 8 — yalnızca Eğlence: tahtadaki özel bloklar (hücre başına en fazla bir). */
  readonly specials?: readonly BoardSpecial[]
  /** Aşama 8 — yalnızca Eğlence: bu oyunda şanslı bloktan verilen ücretsiz joker sayısı (en fazla 2). */
  readonly luckyJokers?: number
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
  // --- Aşama 8 (yalnızca Eğlence) ---
  /** Özel blok tahtaya kondu (bombada başlangıç sayacı). */
  | { type: 'specialPlaced'; kind: SpecialKind; cell: number; timer?: number }
  /** Bu hamlede sayacı azalan ve patlamayan bombalar. */
  | { type: 'bombTick'; bombs: ReadonlyArray<{ readonly cell: number; readonly timer: number }> }
  /**
   * Patlama(lar): bombs = patlayan bombaların merkezleri (sırayla), cells = temizlenen dolu hücreler (tekrarsız),
   * points = cells.length (hücre başına +1), score = patlama sonrası toplam skor. Hat sayılmaz; kombo ve hat yıldızı vermez.
   */
  | { type: 'exploded'; bombs: readonly number[]; cells: readonly number[]; points: number; score: number }
  /** Şanslı blok satır/sütun ya da patlamayla kaldırıldı: tek seferlik ödül. */
  /**
   * convertedFrom: oyun başı joker sınırı (2) dolduğu için joker ödülü +5 yıldıza dönüştü; reward artık yıldızdır.
   */
  | { type: 'luckyReward'; cell: number; reward: LuckyReward; cause: 'line' | 'bomb'; convertedFrom?: JokerKind }
  /** Çekiç özel bloğu kaldırdı: bomba söner, şanslı blok ödül vermez. */
  | { type: 'specialDefused'; kind: SpecialKind; cell: number }

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
