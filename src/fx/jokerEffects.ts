/**
 * Joker efekt tanımı: motorun joker olaylarını (hammered, refreshed, rotated) görsel ve ses
 * efektine çevirir. Saf fonksiyon: DOM bilmez, motoru değiştirmez, Node testleriyle denenir.
 *
 * Efekt yalnızca jokerin GERÇEKTEN uygulandığı sonuçtan üretilir (applyJoker ok: true).
 * Geçersiz kullanım, iptal (Vazgeç/Tamam/Esc) ve hedef seçimi efekt üretmez.
 */
import type { Cell, GameEvent, JokerKind, Piece, Slot, Tray } from '../engine/types'

export type JokerFx =
  | { readonly id: number; readonly kind: 'cekic'; readonly cell: number; readonly color: Cell }
  | {
      readonly id: number
      readonly kind: 'yenile'
      readonly slots: readonly Slot[]
      /** Yenilemeden önceki parçalar (küçülerek kaybolan kopyalar için). */
      readonly before: ReadonlyArray<Piece | null>
    }
  | { readonly id: number; readonly kind: 'dondur'; readonly slot: Slot; readonly paid: boolean }

/** Efekt süreleri (ms). Kısa tutulur: oyun akışını bekletmez, dokunmayı engellemez. */
export const JOKER_FX_MS: Readonly<Record<JokerKind, number>> = {
  cekic: 320,
  yenile: 360,
  dondur: 200,
}

/**
 * @param id her efektte artan kimlik (animasyonu yeniden başlatmak için anahtar)
 * @param events applyJoker sonucunun olayları
 * @param prevTray jokerden ÖNCEKİ tepsi (Yenile'de kaybolan parçalar için)
 */
export function describeJokerFx(id: number, events: readonly GameEvent[], prevTray: Tray): JokerFx | null {
  for (const e of events) {
    if (e.type === 'hammered') return { id, kind: 'cekic', cell: e.cell, color: e.color }
    if (e.type === 'refreshed') return { id, kind: 'yenile', slots: e.slots, before: [...prevTray] }
    if (e.type === 'rotated') return { id, kind: 'dondur', slot: e.slot, paid: e.paid }
  }
  return null
}
