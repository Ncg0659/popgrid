import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, NO_JOKERS, applyJoker, newGame } from '../src/engine'
import { emptyBoard, placeCells } from '../src/engine/board'
import type { GameState, JokerCharges, JokerKind, Tray } from '../src/engine/types'
import { jokerButtons, jokerLabel, rotatableSlots, usefulWhenStuck, type JokerButton } from '../src/ui/jokerUi'

const fun = (free: JokerCharges) => newGame(3, DEFAULT_CONFIG, { mode: 'eglence', freeJokers: free })
const withTray = (s: GameState, ids: (string | null)[]): GameState => ({
  ...s,
  tray: ids.map((id) => (id ? { shapeId: id, color: 1 } : null)) as unknown as Tray,
})
function byKind(s: GameState): Record<JokerKind, JokerButton> {
  const list = jokerButtons(s)
  const find = (kind: JokerKind) => {
    const b = list.find((x) => x.kind === kind)
    if (!b) throw new Error(`düğme yok: ${kind}`)
    return b
  }
  return { cekic: find('cekic'), yenile: find('yenile'), dondur: find('dondur') }
}

function checkerboard() {
  const cells: number[] = []
  for (let i = 0; i < 64; i++) if ((Math.floor(i / 8) + (i % 8)) % 2 === 0) cells.push(i)
  return placeCells(emptyBoard(), cells, 3)
}

describe('joker düğmeleri', () => {
  it('Klasik Mod: düğme yok sayılır (hepsi kapalı, hak 0)', () => {
    const b = byKind(newGame(1))
    expect(Object.values(b).every((x) => !x.enabled && x.count === 0)).toBe(true)
  })

  it('Eğlence başlangıcı: boş tahtada Çekiç kapalı, Yenile açık; haklar 1/1/2', () => {
    const s = withTray(newGame(1, DEFAULT_CONFIG, { mode: 'eglence' }), ['l4-a', 'sq2', 'dot'])
    const b = byKind(s)
    expect([b.cekic.count, b.yenile.count, b.dondur.count]).toEqual([1, 1, 2])
    expect(b.cekic.enabled).toBe(false)
    expect(b.yenile.enabled).toBe(true)
    expect(b.dondur.enabled).toBe(true)
  })

  it('yalnızca dönmeyen parçalar varsa Döndür kapalı', () => {
    const s = withTray(fun({ cekic: 1, yenile: 1, dondur: 2 }), ['sq2', 'dot', 'sq3'])
    expect(rotatableSlots(s)).toEqual([])
    expect(byKind(s).dondur.enabled).toBe(false)
  })

  it('Döndür hakkı bitse de ödenmiş parça ücretsiz dönebilir', () => {
    let s = withTray(fun({ cekic: 0, yenile: 0, dondur: 1 }), ['l4-a', 'h3', null])
    const r = applyJoker(s, { type: 'dondur', slot: 0 })
    if (!r.ok) throw new Error('beklenmedik')
    s = r.state
    const b = byKind(s)
    expect(b.dondur.count).toBe(0)
    expect(b.dondur.enabled).toBe(true)
    expect(b.dondur.freeRotation).toBe(true)
    expect(rotatableSlots(s)).toEqual([0])
    expect(jokerLabel(b.dondur)).toBe('Döndür, hakkın kalmadı, ücretsiz dönüş var')
  })

  it('oyun bitince hepsi kapalı', () => {
    const s = { ...fun({ cekic: 1, yenile: 1, dondur: 2 }), gameOver: true }
    expect(jokerButtons(s).every((b) => !b.enabled)).toBe(true)
  })

  it('sıkışınca yalnızca gerçekten işe yarayabilecek jokerler açık', () => {
    // Satranç tahtasında h2: Çekiç tek başına kurtarır; Döndür (v2) kurtarmaz.
    const base = { ...withTray(fun({ cekic: 1, yenile: 0, dondur: 2 }), ['h2', null, null]), board: checkerboard(), stuck: true }
    const b = byKind(base)
    expect(b.cekic.enabled).toBe(true)
    expect(b.dondur.enabled).toBe(false)
    expect(b.yenile.enabled).toBe(false)
    expect(usefulWhenStuck(base, 'dondur')).toBe(false)
    // Yenile hakkı varsa o da açılır (boş hücre varken her zaman kurtarır).
    const withRefresh = { ...base, jokers: { free: { cekic: 1, yenile: 1, dondur: 2 }, inventory: NO_JOKERS } }
    expect(byKind(withRefresh).yenile.enabled).toBe(true)
  })

  it('etiketler hak sayısını açıkça söyler', () => {
    const b = byKind(withTray(fun({ cekic: 1, yenile: 1, dondur: 2 }), ['l4-a', null, null]))
    expect(jokerLabel(b.cekic)).toBe('Çekiç, 1 hak kaldı')
    expect(jokerLabel(b.dondur)).toBe('Döndür, 2 hak kaldı')
  })
})
