/**
 * Eğitim kartlarının kodla çizilmiş küçük sahneleri. Görsel dosyası yok; oyundaki
 * gerçek blok stili (.blk) kullanılır. Animasyonlar yalnızca CSS ile; azaltılmış harekette
 * sahneler durağan kalır ve oklar/etiketler anlatımı taşır.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { TutorialScene } from './content'

type Grid = number[]

/** 8 satırlık metin deseninden tahta: '.' boş, 1–6 renk. */
function grid(rows: string[]): Grid {
  return rows.join('').split('').map((ch) => (ch === '.' ? 0 : Number(ch)))
}

function MiniBoard({ cells, children, className }: { cells: Grid; children?: ReactNode; className?: string }) {
  return (
    <div className={`mini-board ${className ?? ''}`}>
      <div className="mini-grid">
        {cells.map((c, i) => (
          <div key={i} className="mini-cell">
            {c !== 0 && <span className="blk" data-c={c} />}
          </div>
        ))}
        {children}
      </div>
    </div>
  )
}

/** Izgara üstünde, hücre koordinatıyla konumlanan küçük parça. */
function Piece({ cells, color, row, col, className, style }: {
  cells: Array<[number, number]>
  color: number
  row: number
  col: number
  className?: string
  style?: CSSProperties
}) {
  const w = Math.max(...cells.map(([, c]) => c)) + 1
  const h = Math.max(...cells.map(([r]) => r)) + 1
  return (
    <div
      className={`mini-piece ${className ?? ''}`}
      style={{ '--r': row, '--c': col, '--w': w, '--h': h, ...style } as CSSProperties}
    >
      {cells.map(([r, c]) => (
        <span key={`${r}-${c}`} className="blk" data-c={color} style={{ gridRow: r + 1, gridColumn: c + 1 }} />
      ))}
    </div>
  )
}

const L_SHAPE: Array<[number, number]> = [[0, 0], [1, 0], [2, 0], [2, 1]]
const H2: Array<[number, number]> = [[0, 0], [0, 1]]
const SQ2: Array<[number, number]> = [[0, 0], [0, 1], [1, 0], [1, 1]]
const H3: Array<[number, number]> = [[0, 0], [0, 1], [0, 2]]
const DOT: Array<[number, number]> = [[0, 0]]

function DragScene() {
  const board = grid([
    '........', '........', '........', '........',
    '........', '......44', '22.5..44', '22.55566',
  ])
  return (
    <div className="scene scene-drag">
      <MiniBoard cells={board}>
        <Piece cells={L_SHAPE} color={3} row={2} col={3} className="ghost-demo" />
        <Piece cells={L_SHAPE} color={3} row={2} col={3} className="fly-in" />
      </MiniBoard>
      <span className="scene-finger" aria-hidden="true" />
      <svg className="scene-arrow" viewBox="0 0 40 60" aria-hidden="true">
        <path d="M20 56 V10 M8 22 L20 8 L32 22" />
      </svg>
    </div>
  )
}

function ClearScene() {
  const board = grid([
    '........', '........', '........', '........',
    '........', '..5.....', '.15...6.', '........',
  ])
  const rowColors = [1, 2, 4, 5, 6, 1]
  return (
    <div className="scene scene-clear">
      <MiniBoard cells={board}>
        {rowColors.map((c, i) => (
          <Piece key={i} cells={DOT} color={c} row={7} col={i} className="row-pop" />
        ))}
        <Piece cells={H2} color={3} row={7} col={6} className="drop-in row-pop" />
        <span className="scene-flash" style={{ '--r': 7 } as CSSProperties} aria-hidden="true" />
      </MiniBoard>
      <span className="scene-label">Satır doldu → patladı!</span>
    </div>
  )
}

function RefillScene() {
  return (
    <div className="scene scene-refill">
      <div className="mini-tray" aria-hidden="true">
        {[
          { cells: SQ2, color: 2 },
          { cells: H3, color: 4 },
          { cells: L_SHAPE, color: 6 },
        ].map((p, i) => (
          <div key={i} className="mini-slot">
            <Piece cells={p.cells} color={p.color} row={0} col={0} className={`tray-out out-${i}`} />
            <Piece cells={[SQ2, H2, H3][i]!} color={[5, 1, 3][i]!} row={0} col={0} className="tray-in" />
          </div>
        ))}
      </div>
      <span className="scene-label">Üçü de bitti → yeni üç parça</span>
    </div>
  )
}

function GameOverScene() {
  const board = grid([
    '1122.455', '1.223445', '66.23.45', '61122.44',
    '.5562233', '45.6.123', '445566.1', '2.33.441',
  ])
  return (
    <div className="scene scene-over">
      <MiniBoard cells={board} />
      <div className="mini-tray" aria-hidden="true">
        <div className="mini-slot stuck">
          <Piece cells={SQ2} color={2} row={0} col={0} />
        </div>
        <div className="mini-slot stuck">
          <Piece cells={H3} color={4} row={0} col={0} />
        </div>
      </div>
      <span className="scene-label">Hiçbiri sığmıyor → oyun biter</span>
    </div>
  )
}

export function TutorialSceneView({ scene }: { scene: TutorialScene }) {
  if (scene === 'drag') return <DragScene />
  if (scene === 'clear') return <ClearScene />
  if (scene === 'refill') return <RefillScene />
  return <GameOverScene />
}
