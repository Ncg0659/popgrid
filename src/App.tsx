import { useRef } from 'react'
import { BoardView } from './ui/BoardView'
import { GameOver } from './ui/GameOver'
import { Hud } from './ui/Hud'
import { Tray } from './ui/Tray'
import { useGame } from './ui/useGame'

export default function App() {
  const g = useGame()
  const lastPointer = useRef<string>('touch')
  const { game, selected, preview } = g

  let hint = 'Bir parça seç.'
  if (selected !== null && !preview) hint = 'Tahtada parçayı koymak istediğin yere dokun.'
  else if (preview && !preview.ok) hint = 'Bu parça buraya sığmıyor.'
  else if (preview?.ok) hint = lastPointer.current === 'mouse' ? 'Tıkla ve yerleştir.' : 'Yerleştirmek için parçaya tekrar dokun.'

  return (
    <main className="game" onPointerDownCapture={(e) => (lastPointer.current = e.pointerType)}>
      <Hud score={game.score} best={g.best} canRestartFreely={game.gameOver || game.moveCount === 0} onRestart={g.restart} />
      <BoardView
        game={game}
        selected={selected}
        preview={preview}
        rejectCount={g.rejectCount}
        onAimCell={g.aimAtCell}
        onAim={g.aimAt}
        onPlaceCell={g.placeAtCell}
        onConfirm={g.confirm}
        onCancel={g.clearAim}
      />
      <Tray tray={game.tray} board={game.board} selected={selected} disabled={game.gameOver} onSelect={g.select} />
      <p className="hint" aria-live="polite">
        {hint}
      </p>
      {game.gameOver && (
        <GameOver score={game.score} best={g.best} isNewBest={game.score > g.bestAtStart && game.score > 0} onRestart={g.restart} />
      )}
    </main>
  )
}
