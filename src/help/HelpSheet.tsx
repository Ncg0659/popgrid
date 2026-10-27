import { useRef } from 'react'
import { visibleSections, type HelpBlock } from './content'
import { useDialog } from './useDialog'

interface Props {
  onClose(): void
  onReplayTutorial(): void
  returnFocus?: () => HTMLElement | null
}

const fmt = (n: number) => n.toLocaleString('tr-TR')

function Block({ block, onReplayTutorial }: { block: HelpBlock; onReplayTutorial(): void }) {
  switch (block.kind) {
    case 'text':
      return <p>{block.text}</p>
    case 'list':
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    case 'scoreTable':
      return (
        <table className="score-table">
          <caption>Aynı hamlede temizlenen hat → temizleme puanı</caption>
          <tbody>
            {block.rows.map((r) => (
              <tr key={r.lines}>
                <th scope="row">
                  <span className="hat-chips" aria-hidden="true">
                    {Array.from({ length: r.lines }, (_, i) => (
                      <span key={i} className="blk" data-c={(i % 6) + 1} />
                    ))}
                  </span>
                  {r.lines} hat
                </th>
                <td>{fmt(r.points)} puan</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'faq':
      return (
        <div className="faq">
          {block.items.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      )
    case 'replayTutorial':
      return (
        <button type="button" className="btn-main wide" onClick={onReplayTutorial}>
          Eğitimi tekrar izle
        </button>
      )
  }
}

/** "Nasıl Oynanır?" ekranı. Alttaki oyuna dokunmaz; kapatınca oyun aynen devam eder. */
export function HelpSheet({ onClose, onReplayTutorial, returnFocus }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialog = useDialog<HTMLDivElement>(onClose, closeRef, returnFocus)
  return (
    <div className="overlay" role="presentation">
      <div ref={dialog} className="sheet help" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header className="help-head">
          <h2 id="help-title">Nasıl Oynanır?</h2>
          <button ref={closeRef} type="button" className="btn-soft" onClick={onClose}>
            Kapat
          </button>
        </header>
        <div className="help-body">
          {visibleSections().map((section) => (
            <section key={section.id} aria-labelledby={`help-${section.id}`}>
              <h3 id={`help-${section.id}`}>{section.title}</h3>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} onReplayTutorial={onReplayTutorial} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
