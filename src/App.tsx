import { useEffect, useRef, useState } from 'react'
import { SoundDebug } from './audio/SoundDebug'
import { HelpSheet } from './help/HelpSheet'
import { Tutorial } from './help/Tutorial'
import { tutorialStore } from './storage/tutorial'
import { isSoundEnabled, playClear, playPlace, setSoundEnabled } from './audio/sound'
import { FxCanvas } from './fx/FxCanvas'
import { useReducedMotion } from './fx/useReducedMotion'
import { useDrag } from './input/useDrag'
import { BoardView } from './ui/BoardView'
import { GameOver } from './ui/GameOver'
import { Hud } from './ui/Hud'
import { JokerBar } from './ui/JokerBar'
import { jokerButtons, rotatableSlots } from './ui/jokerUi'
import { ModeSheet } from './ui/ModeSheet'
import { PieceView } from './ui/PieceView'
import { StuckNotice } from './ui/StuckNotice'
import { Tray } from './ui/Tray'
import { useGame } from './ui/useGame'

export default function App() {
  const g = useGame()
  const lastPointer = useRef<string>('touch')
  const boardRef = useRef<HTMLDivElement>(null)
  const { game, selected, preview, effect } = g
  const reducedMotion = useReducedMotion()
  // Rehber katmanı: oyunun üstünde açılır; oyun durumu (tahta, skor, rekor, parçalar) hiç değişmez.
  const helpButton = () => document.querySelector<HTMLElement>('.help-btn')
  const restartButton = () => document.querySelector<HTMLElement>('.restart')
  const [overlay, setOverlay] = useState<'none' | 'tutorial' | 'help' | 'mode'>(() =>
    tutorialStore.shouldAutoShow(g.best) ? 'tutorial' : 'none',
  )
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

  const fun = game.mode === 'eglence'
  const armed = g.armed
  // Döndür seçiliyken parçaya dokunmak onu çevirir; aksi hâlde normal seçim.
  const tapSlot = (slot: 0 | 1 | 2) => (armed === 'dondur' ? g.rotateSlot(slot) : g.select(slot))

  const { drag, floatRef, handlers } = useDrag({
    tray: game.tray,
    disabled: game.gameOver,
    boardRef,
    // Sürükleme başlarsa seçili joker iptal olur (useGame.beginDrag); hak harcanmaz.
    onBegin: g.beginDrag,
    onAim: g.aimAt,
    onDrop: g.dropAt,
    onCancel: g.cancelDrag,
    onTap: tapSlot,
  })

  // Çekiç seçilince tahtaya odaklan (klavyeyle oklar + Enter); Esc her yerde seçili jokeri bırakır.
  // Efekt yalnızca seçili joker değişince kurulur (her çizimde değil); disarm en güncel hâliyle ref'ten okunur.
  const disarmRef = useRef(g.disarm)
  disarmRef.current = g.disarm
  useEffect(() => {
    if (armed === 'cekic') boardRef.current?.focus({ preventScroll: true })
    if (!armed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') disarmRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed])

  let hint = 'Bir parçayı tahtaya sürükle.'
  if (drag) hint = !preview ? 'Parçayı tahtanın üstüne getir.' : preview.ok ? 'Bırak ve yerleştir.' : 'Bu parça buraya sığmıyor.'
  else if (selected !== null && !preview) hint = 'Tahtada parçayı koymak istediğin yere dokun.'
  else if (preview && !preview.ok) hint = 'Bu parça buraya sığmıyor.'
  else if (preview?.ok) hint = lastPointer.current === 'mouse' ? 'Tıkla ve yerleştir.' : 'Yerleştirmek için parçaya tekrar dokun.'

  const startMode = (mode: 'klasik' | 'eglence') => {
    g.startGame(mode)
    setOverlay('none')
  }

  return (
    <>
    <main
      className="game"
      data-mode={game.mode}
      data-dragging={drag ? '' : undefined}
      // Rehber açıkken oyun alanı dokunmaya ve odağa kapalıdır; durumu ise aynen korunur.
      inert={overlay !== 'none'}
      // Ses motoru belge düzeyindeki dokunma/tıklama olaylarıyla açılır (src/audio/sound.ts).
      onPointerDownCapture={(e) => (lastPointer.current = e.pointerType)}
    >
      <div className="hud-zone">
        <Hud
          score={game.score}
          best={g.best}
          mode={game.mode}
          canRestartFreely={game.gameOver || game.moveCount === 0}
          effect={effect}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          // Yeni oyun: mod seçimi açılır (mod yalnızca oyun başlarken seçilir).
          onRestart={() => setOverlay('mode')}
          onHelp={() => setOverlay('help')}
        />
        {fun && game.stuck && !game.gameOver && <StuckNotice onGiveUp={g.giveUp} />}
      </div>
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
        hammer={armed === 'cekic'}
        onHammerCell={g.hammerCell}
        onCancelJoker={g.disarm}
      />
      <Tray
        tray={game.tray}
        board={game.board}
        selected={selected}
        dragging={drag?.slot ?? null}
        disabled={game.gameOver}
        slotHandlers={handlers}
        onKeyboardSelect={tapSlot}
        rotateMode={armed === 'dondur'}
        rotatable={armed === 'dondur' ? rotatableSlots(game) : []}
        rotatePaid={game.rotatePaid}
      />
      {fun ? (
        <>
          <JokerBar
            buttons={jokerButtons(game)}
            armed={armed}
            message={g.notice?.text ?? null}
            onArm={g.arm}
            onRefresh={g.refresh}
            onDisarm={g.disarm}
          />
          {/* Eğlence'de ipucu satırının yerini joker çubuğu alır; ipucu ekran okuyucuya söylenir. */}
          <p className="hint sr-only" aria-live="polite">
            {armed ? '' : (g.notice?.text ?? hint)}
          </p>
        </>
      ) : (
        <p className="hint" aria-live="polite">
          {hint}
        </p>
      )}
      <FxCanvas effect={effect} boardRef={boardRef} reducedMotion={reducedMotion} />
      {drag && (
        <div ref={floatRef} className="drag-float" aria-hidden="true">
          <PieceView piece={drag.piece} />
        </div>
      )}
      <SoundDebug />
      {game.gameOver && (
        <GameOver
          score={game.score}
          best={g.best}
          mode={game.mode}
          isNewBest={game.score > g.bestAtStart && game.score > 0}
          onRestart={g.restart}
          onChooseMode={() => setOverlay('mode')}
        />
      )}
    </main>
    {overlay === 'tutorial' && (
      <Tutorial
        onClose={() => {
          tutorialStore.markDone()
          setOverlay('none')
        }}
        returnFocus={helpButton}
      />
    )}
    {overlay === 'mode' && (
      <ModeSheet
        current={game.mode}
        bests={g.bests}
        onStart={startMode}
        onClose={() => setOverlay('none')}
        returnFocus={restartButton}
      />
    )}
    {overlay === 'help' && (
      <HelpSheet onClose={() => setOverlay('none')} onReplayTutorial={() => setOverlay('tutorial')} returnFocus={helpButton} />
    )}
    </>
  )
}
