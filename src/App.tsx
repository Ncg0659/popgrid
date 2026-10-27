import { useEffect, useRef, useState } from 'react'
import { SoundDebug } from './audio/SoundDebug'
import { isSoundEnabled, playClear, playPlace, setSoundEnabled } from './audio/sound'
import { FxCanvas } from './fx/FxCanvas'
import { useReducedMotion } from './fx/useReducedMotion'
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
  const { game, selected, preview, effect } = g
  const reducedMotion = useReducedMotion()
  const [soundOn, setSoundOn] = useState(isSoundEnabled)

  // Her başarılı hamlede tek ses: temizleme varsa temizleme arpeji, yoksa yerleştirme sesi.
  useEffect(() => {
    if (!effect) return
    if (effect.lines > 0) playClear(effect.lines, effect.combo)
    else playPlace()
  }, [effect])

  const toggleSound = () => {
    const next = !soundOn
    setSoundEnabled(next)
    setSoundOn(next)
    if (next) playPlace()
  }

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
    <main
      className="game"
      data-dragging={drag ? '' : undefined}
      // Ses motoru belge düzeyindeki dokunma/tıklama olaylarıyla açılır (src/audio/sound.ts).
      onPointerDownCapture={(e) => (lastPointer.current = e.pointerType)}
    >
      <Hud
        score={game.score}
        best={g.best}
        canRestartFreely={game.gameOver || game.moveCount === 0}
        effect={effect}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        onRestart={g.restart}
      />
      <BoardView
        gridRef={boardRef}
        game={game}
        selected={selected}
        preview={preview}
        rejectCount={g.rejectCount}
        dragging={drag !== null}
        effect={effect}
        reducedMotion={reducedMotion}
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
      <FxCanvas effect={effect} boardRef={boardRef} reducedMotion={reducedMotion} />
      {drag && (
        <div ref={floatRef} className="drag-float" aria-hidden="true">
          <PieceView piece={drag.piece} />
        </div>
      )}
      <SoundDebug />
      {game.gameOver && (
        <GameOver score={game.score} best={g.best} isNewBest={game.score > g.bestAtStart && game.score > 0} onRestart={g.restart} />
      )}
    </main>
  )
}
