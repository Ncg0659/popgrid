import { useEffect, useRef, useState } from 'react'
import { SoundDebug } from './audio/SoundDebug'
import { HelpSheet } from './help/HelpSheet'
import { JokerIntro } from './help/JokerIntro'
import { Tutorial } from './help/Tutorial'
import { jokerIntroStore } from './storage/jokerIntro'
import { tutorialStore } from './storage/tutorial'
import { isSoundEnabled, playPlace, setSoundEnabled } from './audio/sound'
import { purchaseCue } from './audio/soundCue'
import { playCue, useSoundCues } from './audio/useSoundCues'
import { FxCanvas } from './fx/FxCanvas'
import { useReducedMotion } from './fx/useReducedMotion'
import { useDrag } from './input/useDrag'
import { BoardView } from './ui/BoardView'
import { GameOver } from './ui/GameOver'
import { Hud } from './ui/Hud'
import { JokerBar } from './ui/JokerBar'
import { jokerButtons, rotatableSlots } from './ui/jokerUi'
import { ModeSheet } from './ui/ModeSheet'
import { economyBanner, purchaseMessage, createPurchaseGuard } from './ui/economyUi'
import { ShopSheet } from './ui/ShopSheet'
import { StarButton } from './ui/StarButton'
import { StarToast } from './ui/StarToast'
import { useEconomy } from './ui/useEconomy'
import { randomId } from './storage/economy'
import type { JokerKind } from './engine/types'
import { PieceView } from './ui/PieceView'
import { StuckNotice } from './ui/StuckNotice'
import { Tray } from './ui/Tray'
import { useGame } from './ui/useGame'
import { AtmosphereBackdrop } from './theme/AtmosphereBackdrop'
import { atmosphereIndex } from './theme/atmosphere'

export default function App() {
  // Ekonomi (yıldız, mağaza, sekme sahipliği) oyundan ÖNCE kurulur: ilk oyun sahipliğe göre başlar.
  const eco = useEconomy()
  const g = useGame(eco)
  const purchaseGuard = useRef(createPurchaseGuard(() => randomId('p')))
  const lastPointer = useRef<string>('touch')
  const boardRef = useRef<HTMLDivElement>(null)
  const { game, selected, preview, effect } = g
  const reducedMotion = useReducedMotion()
  // Rehber katmanı: oyunun üstünde açılır; oyun durumu (tahta, skor, rekor, parçalar) hiç değişmez.
  const helpButton = () => document.querySelector<HTMLElement>('.help-btn')
  const restartButton = () => document.querySelector<HTMLElement>('.restart')
  const shopButton = () => document.querySelector<HTMLElement>('.star-btn')
  type Overlay = 'none' | 'tutorial' | 'help' | 'mode' | 'jokerIntro' | 'shop'
  // Açılışta: yeni oyuncuya temel eğitim; Eğlence ile açılan ve tanıtımı görmemiş oyuncuya joker tanıtımı.
  const [overlay, setOverlay] = useState<Overlay>(() => {
    if (tutorialStore.shouldAutoShow(g.best)) return 'tutorial'
    if (jokerIntroStore.shouldAutoShow(g.game.mode)) return 'jokerIntro'
    return 'none'
  })
  const [soundOn, setSoundOn] = useState(isSoundEnabled)

  // Aşama 7.3c: mağaza kapanınca, oyuna eklenen jokerlerin hak sayısı bir kez zıplar (panel açıkken görünmezdi).
  const flushJokerBumps = g.flushJokerBumps
  useEffect(() => {
    if (overlay !== 'shop') flushJokerBumps()
  }, [overlay, flushJokerBumps])

  // Hamle ve joker sesleri (eşleme src/audio/soundCue.ts'te).
  const jokerFx = g.jokerFx
  useSoundCues(effect, jokerFx)

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

  /** Mağazada tek dokunuşla satın alma. Yalnızca kalıcı kayıt başarılıysa "alındı" denir. */
  const buy = (kind: JokerKind) => {
    const id = purchaseGuard.current.request(performance.now())
    // Koruma süresindeki ikinci dokunuş sessizce yok sayılır: başarı bildirimi ekranda kalır.
    if (!id) return null
    // Eğlence oyunu sürüyorsa joker aynı kayıtta bu oyuna da getirilir ve hemen kullanılabilir.
    const target = g.purchaseTarget()
    const starsBefore = eco.store.load().state.stars
    const r = eco.store.purchase(kind, id, target)
    const success = r.ok && r.persisted
    purchaseGuard.current.settle(performance.now(), success)
    eco.apply(r)
    const intoGame = success && r.ok && r.intoGame === true && target !== undefined && g.grantPurchased(target, kind)
    const result = { ok: success, text: purchaseMessage(kind, r.ok ? { ok: true, intoGame } : { ok: false, reason: r.reason }) }
    // Aşama 7.3c: geri bildirim (bakiye sayımı, mercan renk, ses) yalnızca kalıcı kaydı yapılan alımda.
    if (success) g.pulseStars('spend', starsBefore - r.state.stars)
    const cue = purchaseCue(result)
    if (cue) playCue(cue)
    return result
  }

  const banner = economyBanner(eco.status, eco.persistent)
  const starButton = (
    <StarButton stars={eco.state.stars} warn={banner !== null} onOpenShop={() => setOverlay('shop')} pulse={g.starPulse} reducedMotion={reducedMotion} />
  )

  const startMode = (mode: 'klasik' | 'eglence') => {
    g.startGame(mode)
    // Eğlence Modu'na ilk giriş: tek kartlık joker tanıtımı (yalnızca bir kez kendiliğinden). Klasik etkilenmez.
    setOverlay(jokerIntroStore.shouldAutoShow(mode) ? 'jokerIntro' : 'none')
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
      {/* Dinamik Atmosfer: yalnızca bu oyunun puanına göre arka plan (src/theme/atmosphere.ts). */}
      <AtmosphereBackdrop level={atmosphereIndex(game.score)} instant={reducedMotion} />
      <div className="hud-zone">
        <Hud
          score={game.score}
          best={g.best}
          mode={game.mode}
          recordLabel={g.record.label}
          boughtCategory={g.record.category === 'eglenceSatin'}
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
        jokerFx={jokerFx}
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
        jokerFx={jokerFx}
        reducedMotion={reducedMotion}
      />
      <div className="bottom-zone">
        <StarToast notice={g.starNotice} banner={banner} />
        {fun ? (
          <>
            <JokerBar
              buttons={jokerButtons(game)}
              armed={armed}
              message={g.notice?.text ?? null}
              onArm={g.arm}
              onRefresh={g.refresh}
              onDisarm={g.disarm}
              trailing={starButton}
              bump={g.jokerBump}
            />
            {/* Eğlence'de ipucu satırının yerini joker çubuğu alır; ipucu ekran okuyucuya söylenir. */}
            <p className="hint sr-only" aria-live="polite">
              {armed ? '' : (g.notice?.text ?? hint)}
            </p>
          </>
        ) : (
          <div className="hint-row">
            <p className="hint" aria-live="polite">
              {hint}
            </p>
            {starButton}
          </div>
        )}
      </div>
      <FxCanvas effect={effect} boardRef={boardRef} reducedMotion={reducedMotion} jokerFx={jokerFx} />
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
          stars={g.gameStars}
          isNewBest={g.record.isNew}
          recordLine={g.record.line}
          boughtCategory={g.record.category === 'eglenceSatin'}
          reducedMotion={reducedMotion}
          onRestart={g.restart}
          onChooseMode={() => setOverlay('mode')}
        />
      )}
    </main>
    {overlay === 'tutorial' && (
      <Tutorial
        onClose={() => {
          tutorialStore.markDone()
          // Eğitim bittikten sonra, Eğlence ile açılmış ve tanıtımı görmemişse joker tanıtımı gelir.
          setOverlay(jokerIntroStore.shouldAutoShow(game.mode) ? 'jokerIntro' : 'none')
        }}
        returnFocus={helpButton}
      />
    )}
    {overlay === 'mode' && (
      <ModeSheet
        current={game.mode}
        bests={g.bests}
        stars={eco.state.stars}
        boughtBest={g.boughtBest}
        onStart={startMode}
        onClose={() => setOverlay('none')}
        returnFocus={restartButton}
      />
    )}
    {overlay === 'help' && (
      <HelpSheet
        onClose={() => setOverlay('none')}
        onReplayTutorial={() => setOverlay('tutorial')}
        onReplayJokerIntro={() => setOverlay('jokerIntro')}
        returnFocus={helpButton}
      />
    )}
    {overlay === 'shop' && (
      <ShopSheet
        state={eco.state}
        status={eco.status}
        persistent={eco.persistent}
        onBuy={buy}
        canTakeOver={banner?.canTakeOver ?? false}
        onTakeOver={eco.takeOver}
        onClose={() => setOverlay('none')}
        returnFocus={shopButton}
        pulse={g.starPulse}
        reducedMotion={reducedMotion}
      />
    )}
    {overlay === 'jokerIntro' && (
      <JokerIntro
        onClose={() => {
          jokerIntroStore.markDone()
          setOverlay('none')
        }}
        returnFocus={helpButton}
      />
    )}
    </>
  )
}
