import { describe, expect, it } from 'vitest'
import { getShape } from '../src/engine/shapes'
import { TOUCH_LIFT_CELLS, floatPosition, gridMetrics, pieceSize, snapOrigin } from '../src/input/dragGeometry'

// 8 hücre × 40px + 7 boşluk × 4px = 348px genişlik, ızgara (100, 200) noktasında.
const m = gridMetrics(100, 200, 348, 4)

describe('sürükleme geometrisi', () => {
  it('ızgara ölçüleri gerçek hücre boyutunu verir', () => {
    expect(m.cell).toBe(40)
    expect(m.pitch).toBe(44)
  })

  it('yüzen parça tahta hücreleriyle aynı boyuttadır', () => {
    expect(pieceSize(getShape('h3'), m)).toEqual({ width: 3 * 44 - 4, height: 40 })
    expect(pieceSize(getShape('sq3'), m)).toEqual({ width: 128, height: 128 })
  })

  it('dokunmada parça parmağın üstünde, yatayda ortalı durur', () => {
    const p = floatPosition(300, 600, getShape('sq2'), m, 'touch')
    const { width, height } = pieceSize(getShape('sq2'), m)
    expect(p.x + width / 2).toBe(300)
    expect(600 - (p.y + height)).toBeCloseTo(TOUCH_LIFT_CELLS * 44)
  })

  it('farede imleç parçanın ortasındadır', () => {
    const p = floatPosition(300, 600, getShape('sq2'), m, 'mouse')
    expect(p).toEqual({ x: 300 - 42, y: 600 - 42 })
  })

  it('en yakın hücreye oturur', () => {
    const h3 = getShape('h3')
    expect(snapOrigin(100, 200, h3, m)).toEqual({ row: 0, col: 0 })
    expect(snapOrigin(100 + 2 * 44 + 10, 200 + 3 * 44 - 10, h3, m)).toEqual({ row: 3, col: 2 })
    expect(snapOrigin(100 + 2 * 44 + 30, 200, h3, m)).toEqual({ row: 0, col: 3 })
  })

  it('yarım hücreden fazla taşan parça için konum yoktur', () => {
    const h3 = getShape('h3')
    expect(snapOrigin(100 - 15, 200, h3, m)).toEqual({ row: 0, col: 0 })
    expect(snapOrigin(100 - 30, 200, h3, m)).toBe(null)
    expect(snapOrigin(100 + 5 * 44 + 10, 200, h3, m)).toEqual({ row: 0, col: 5 })
    expect(snapOrigin(100 + 6 * 44, 200, h3, m)).toBe(null)
    expect(snapOrigin(100, 200 + 8 * 44, h3, m)).toBe(null)
  })

  it('dokunma ile hedef hücre arasında gidiş-dönüş tutarlıdır', () => {
    const shape = getShape('l4-a')
    const { width, height } = pieceSize(shape, m)
    for (let row = 0; row <= 8 - shape.height; row++) {
      for (let col = 0; col <= 8 - shape.width; col++) {
        const fingerX = m.left + col * m.pitch + width / 2
        const fingerY = m.top + row * m.pitch + height + TOUCH_LIFT_CELLS * m.pitch
        const p = floatPosition(fingerX, fingerY, shape, m, 'touch')
        expect(snapOrigin(p.x, p.y, shape, m)).toEqual({ row, col })
      }
    }
  })
})
