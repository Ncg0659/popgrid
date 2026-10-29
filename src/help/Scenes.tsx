/**
 * Eğitim kartlarının kodla çizilmiş küçük sahneleri. Görsel dosyası yok; oyundaki
 * gerçek blok stili (.blk) kullanılır. Animasyonlar yalnızca CSS ile; azaltılmış harekette
 * sahneler durağan kalır ve oklar/etiketler anlatımı taşır.
 */
import type { CSSProperties, ReactNode } from 'react'
import { DEFAULT_FREE_JOKERS, JOKER_KINDS } from '../engine'
import { LINE_CLEAR_STARS, STARS_PER_HUNDRED_POINTS } from '../economy/rules'
import { JokerIcon } from '../ui/JokerIcon'
import { StarIcon } from '../ui/StarIcon'
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

/** Aşama 7.4: hat sayısına göre yıldız (değerler ekonomi kurallarından). Durağan sahne. */
function StarsScene() {
  const rows = [
    { lines: 1, stars: LINE_CLEAR_STARS.one, label: '1 hat' },
    { lines: 2, stars: LINE_CLEAR_STARS.two, label: '2 hat' },
    { lines: 3, stars: LINE_CLEAR_STARS.threePlus, label: '3+ hat' },
  ]
  return (
    <div className="scene scene-stars">
      <ul className="star-rows">
        {rows.map((r) => (
          <li key={r.lines} className="star-row">
            <span className="star-row-lines">
              <span className="hat-chips">
                {Array.from({ length: r.lines }, (_, i) => (
                  <span key={i} className="blk" data-c={[1, 4, 6][i]} />
                ))}
              </span>
              {r.label}
            </span>
            <span className="star-row-arrow">→</span>
            <span className="star-row-gain">
              <StarIcon />+{r.stars}
            </span>
          </li>
        ))}
      </ul>
      <span className="scene-label">Oyun sonu: her 100 puan → +{STARS_PER_HUNDRED_POINTS}</span>
    </div>
  )
}

/** Aşama 7.4: Klasik ve Eğlence farkı (ücretsiz haklar motordan). Durağan sahne. */
function ModesScene() {
  return (
    <div className="scene scene-modes">
      <div className="mode-mini" data-mode="klasik">
        <svg className="mode-mini-icon" viewBox="0 0 24 24">
          <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8z" />
        </svg>
        <strong>Klasik</strong>
        <span>Jokersiz</span>
      </div>
      <div className="mode-mini" data-mode="eglence">
        <StarIcon className="mode-mini-icon" />
        <strong>Eğlence</strong>
        <span className="mode-mini-jokers">
          {JOKER_KINDS.map((k) => (
            <span key={k} className="jk-chip mm-chip" data-kind={k}>
              <JokerIcon kind={k} />
              <span className="jk-count">{DEFAULT_FREE_JOKERS[k]}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}

export function TutorialSceneView({ scene }: { scene: TutorialScene }) {
  if (scene === 'drag') return <DragScene />
  if (scene === 'clear') return <ClearScene />
  if (scene === 'stars') return <StarsScene />
  return <ModesScene />
}
