import { useRef, useState } from 'react'
import { TUTORIAL_CARDS } from './content'
import { TutorialSceneView } from './Scenes'
import { useDialog } from './useDialog'

interface Props {
  /** Eğitim bitti ya da atlandı (ikisi de "görüldü" sayılır). */
  onClose(reason: 'tamamlandı' | 'atlandı'): void
  returnFocus?: () => HTMLElement | null
}

/** İlk açılış eğitimi: 4 animasyonlu kart. Alttaki oyuna dokunmaz. */
export function Tutorial({ onClose, returnFocus }: Props) {
  const [step, setStep] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  const dialog = useDialog<HTMLDivElement>(() => onClose('atlandı'), nextRef, returnFocus)
  const card = TUTORIAL_CARDS[step]!
  const last = step === TUTORIAL_CARDS.length - 1

  return (
    <div className="overlay" role="presentation">
      <div
        ref={dialog}
        className="sheet tutorial"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-text"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && !last) setStep(step + 1)
          if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1)
        }}
      >
        <div className="tutorial-scene" key={card.id} aria-hidden="true">
          <TutorialSceneView scene={card.scene} />
        </div>
        <p className="tutorial-step">
          {step + 1} / {TUTORIAL_CARDS.length}
        </p>
        <h2 id="tutorial-title">{card.title}</h2>
        <p id="tutorial-text" className="tutorial-text">
          {card.text}
        </p>
        <div className="dots" aria-hidden="true">
          {TUTORIAL_CARDS.map((c, i) => (
            <span key={c.id} data-on={i === step || undefined} />
          ))}
        </div>
        <div className="sheet-actions">
          {!last && (
            <button type="button" className="btn-quiet" onClick={() => onClose('atlandı')}>
              Atla
            </button>
          )}
          <span className="spacer" />
          {step > 0 && (
            <button type="button" className="btn-soft" onClick={() => setStep(step - 1)}>
              Geri
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            className="btn-main"
            onClick={() => (last ? onClose('tamamlandı') : setStep(step + 1))}
          >
            {last ? 'Hadi oyna!' : 'İleri'}
          </button>
        </div>
      </div>
    </div>
  )
}
