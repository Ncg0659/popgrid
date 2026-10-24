import type { Shape } from './types'

/**
 * Parça kataloğu. Parçalar döndürülmediği için her yön ayrı bir şekildir.
 * Sıra sabittir: rastgele seçim bu dizinin sırasına bağlıdır, sırayı değiştirmek
 * oyun akışını değiştirir ve GENERATOR_VERSION artırılmalıdır.
 *
 * Desen: '#' = blok, '.' = boşluk, satırlar '/' ile ayrılır.
 */
const DEFINITIONS: ReadonlyArray<readonly [id: string, pattern: string, weight: number]> = [
  ['dot', '#', 2],
  ['h2', '##', 4],
  ['v2', '#/#', 4],
  ['h3', '###', 5],
  ['v3', '#/#/#', 5],
  ['h4', '####', 4],
  ['v4', '#/#/#/#', 4],
  ['h5', '#####', 2],
  ['v5', '#/#/#/#/#', 2],
  ['sq2', '##/##', 6],
  ['sq3', '###/###/###', 2],
  ['rect23', '###/###', 3],
  ['rect32', '##/##/##', 3],
  // Küçük köşeler (3 blok)
  ['c3-tl', '##/#.', 3],
  ['c3-tr', '##/.#', 3],
  ['c3-bl', '#./##', 3],
  ['c3-br', '.#/##', 3],
  // L ve J (4 blok)
  ['l4-a', '#./#./##', 2],
  ['l4-b', '###/#..', 2],
  ['l4-c', '##/.#/.#', 2],
  ['l4-d', '..#/###', 2],
  ['j4-a', '.#/.#/##', 2],
  ['j4-b', '#../###', 2],
  ['j4-c', '##/#./#.', 2],
  ['j4-d', '###/..#', 2],
  // T (4 blok)
  ['t4-up', '###/.#.', 2],
  ['t4-down', '.#./###', 2],
  ['t4-left', '#./##/#.', 2],
  ['t4-right', '.#/##/.#', 2],
  // S ve Z (4 blok)
  ['s4-h', '.##/##.', 2],
  ['s4-v', '#./##/.#', 2],
  ['z4-h', '##./.##', 2],
  ['z4-v', '.#/##/#.', 2],
  // Büyük köşeler (5 blok)
  ['c5-tl', '###/#../#..', 1],
  ['c5-tr', '###/..#/..#', 1],
  ['c5-bl', '#../#../###', 1],
  ['c5-br', '..#/..#/###', 1],
]

function parse(id: string, pattern: string, weight: number): Shape {
  const rows = pattern.split('/')
  const cells: Array<readonly [number, number]> = []
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '#') cells.push([r, c] as const)
    }
  })
  const width = Math.max(...rows.map((line) => line.length))
  return { id, cells, width, height: rows.length, weight }
}

export const SHAPES: readonly Shape[] = DEFINITIONS.map(([id, pattern, weight]) => parse(id, pattern, weight))

const BY_ID = new Map(SHAPES.map((shape) => [shape.id, shape] as const))

export function getShape(id: string): Shape {
  const shape = BY_ID.get(id)
  if (!shape) throw new Error(`Bilinmeyen parça: ${id}`)
  return shape
}

export const TOTAL_WEIGHT = SHAPES.reduce((sum, shape) => sum + shape.weight, 0)
