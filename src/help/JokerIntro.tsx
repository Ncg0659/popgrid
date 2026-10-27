import { useRef } from 'react'
import { JokerIcon } from '../ui/JokerIcon'
import { JOKER_INTRO } from './content'
import { useDialog } from './useDialog'

interface Props {
  /** "Hadi oyna!" ya da Esc: kart kapanır (görüldü sayılır). Alttaki oyun aynen kalır. */
  onClose(): void
  returnFocus?: () => HTMLElement | null
}

/**
 * Eğlence Modu'na ilk girişte tek kartlık "Jokerlerle tanış!" ekranı. Yardımdan tekrar açılabilir.
 * Simgeler oyundaki joker düğmeleriyle aynı (renkli, hacimli rozetler). Animasyon yok:
 * Hareketi Azalt tercihinde de aynı görünür.
 */
export function JokerIntro({ onClose, returnFocus }: Props) {
  const playRef = useRef<HTMLButtonElement>(null)
  const dialog = useDialog<HTMLDivElement>(onClose, playRef, returnFocus)
  return (
    <div className="overlay" role="presentation">
      <div
        ref={dialog}
        className="sheet joker-intro"
        role="dialog"
        aria-modal="true"
        aria-labelledby="joker-intro-title"
        aria-describedby="joker-intro-lead"
      >
        <h2 id="joker-intro-title">{JOKER_INTRO.title}</h2>
        <p id="joker-intro-lead" className="ji-lead">
          {JOKER_INTRO.lead}
        </p>
        <ul className="ji-list">
          {JOKER_INTRO.items.map((item) => (
            <li key={item.kind} className="ji-item">
              <span className="jk-chip ji-chip" data-kind={item.kind} aria-hidden="true">
                <JokerIcon kind={item.kind} />
                <span className="jk-count">{item.rights}</span>
              </span>
              <span className="ji-text">
                <strong>
                  {item.name} <span className="ji-rights">({item.rights} hak)</span>
                </strong>
                <span>{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="ji-rights-line">{JOKER_INTRO.rights}</p>
        <p className="ji-note">{JOKER_INTRO.note}</p>
        <div className="sheet-actions ji-actions">
          <button ref={playRef} type="button" className="btn-main wide ji-play" onClick={onClose}>
            {JOKER_INTRO.button}
          </button>
        </div>
      </div>
    </div>
  )
}
