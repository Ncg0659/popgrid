import { useRef } from 'react'
import { useDrag } from './input/useDrag'
import { BoardView } from './ui/BoardView'
import { GameOver } from './ui/GameOver'
import { Hud } from './ui/Hud'
import { PieceView } from './ui/PieceView'
import { Tray } from './ui/Tray'
import { useGame } from './ui/useGame'

export default function App() {
  const g = useGame()
  const lastPointer = useRef<string>('touch')
  const boardRef = useRef<HTMLDivElement>(null)
  const { game, selected, preview } = g

  const { drag, floatRef, handlers } = useDrag({
    tray: game.tray,
    disabled: game.gameOver,
    boardRef,
    onBegin: g.beginDrag,
    onAim: g.aimAt,
    onDrop: g.dropAt,
    onCancel: g.cancelDrag,
    onTap: g.select,
  })

  let hint = 'Bir parçayı tahtaya sürükle.'
  if (drag) hint = !preview ? 'Parçayı tahtanın üstüne getir.' : preview.ok ? 'Bırak ve yerleştir.' : 'Bu parça buraya sığmıyor.'
  else if (selected !== null && !preview) hint = 'Tahtada parçayı koymak istediğin yere dokun.'
  else if (preview && !preview.ok) hint = 'Bu parça buraya sığmıyor.'
  else if (preview?.ok) hint = lastPointer.current === 'mouse' ? 'Tıkla ve yerleştir.' : 'Yerleştirmek için parçaya tekrar dokun.'

  return (
    <main className="game" data-dragging={drag ? '' : undefined} onPointerDownCapture={(e) => (lastPointer.current = e.pointerType)}>
      <Hud score={game.score} best={g.best} canRestartFreely={game.gameOver || game.moveCount === 0} onRestart={g.restart} />
      <BoardView
        gridRef={boardRef}
        game={game}
        selected={selected}
        preview={preview}
        rejectCount={g.rejectCount}
        dragging={drag !== null}
        onAimCell={g.aimAtCell}
        onAim={g.aimAt}
        onPlaceCell={g.placeAtCell}
        onConfirm={g.confirm}
        onCancel={g.clearAim}
      />
      <Tray
        tray={game.tray}
        board={game.board}
        selected={selected}
        dragging={drag?.slot ?? null}
        disabled={game.gameOver}
        slotHandlers={handlers}
        onKeyboardSelect={g.select}
      />
      <p className="hint" aria-live="polite">
        {hint}
      </p>
      {drag && (
        <div ref={floatRef} className="drag-float" aria-hidden="true">
          <PieceView piece={drag.piece} />
        </div>
      )}
      {game.gameOver && (
        <GameOver score={game.score} best={g.best} isNewBest={game.score > g.bestAtStart && game.score > 0} onRestart={g.restart} />
      )}
    </main>
  )
}
