import type { JokerKind } from '../engine/types'
import { JokerIcon } from './JokerIcon'
import { JOKER_NAMES, jokerLabel, type ArmedJoker, type JokerButton } from './jokerUi'

interface Props {
  buttons: readonly JokerButton[]
  armed: ArmedJoker
  /** Hedef seçimi sırasında gösterilecek geri bildirim (ör. boş hücre); yoksa yönerge. */
  message: string | null
  onArm(kind: 'cekic' | 'dondur'): void
  onRefresh(): void
  onDisarm(): void
}

const INSTRUCTION: Record<'cekic' | 'dondur', string> = {
  cekic: 'Kırmak için dolu bir bloğa dokun.',
  dondur: 'Döndürmek için bir parçaya dokun.',
}

/**
 * Eğlence Modu joker çubuğu: tepsinin altında, ipucu satırının yerinde (ekran yüksekliği korunur).
 * Hedef bekleyen joker seçilince çubuk aynı yükseklikte bir yönerge + Vazgeç/Tamam satırına dönüşür.
 * Düğmeler yalnızca onClick kullanır: iOS'ta bir dokunuş tek click üretir (pointerup + click çift sayılmaz).
 */
export function JokerBar({ buttons, armed, message, onArm, onRefresh, onDisarm }: Props) {
  if (armed) {
    return (
      <div className="joker-bar" data-armed={armed} role="group" aria-label={`${JOKER_NAMES[armed]} seçili`}>
        <div className="joker-armed">
          <span className="jk-chip" data-kind={armed} aria-hidden="true">
            <JokerIcon kind={armed} />
          </span>
          <p className="joker-msg" aria-live="polite">
            {message ?? INSTRUCTION[armed]}
          </p>
          <button type="button" className="btn-soft joker-cancel" onClick={onDisarm}>
            {armed === 'dondur' ? 'Tamam' : 'Vazgeç'}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="joker-bar" role="group" aria-label="Jokerler">
      {buttons.map((b) => (
        <button
          key={b.kind}
          type="button"
          className="joker-btn"
          data-kind={b.kind}
          disabled={!b.enabled}
          aria-label={jokerLabel(b)}
          title={jokerLabel(b)}
          onClick={() => (b.kind === 'yenile' ? onRefresh() : onArm(b.kind as Exclude<JokerKind, 'yenile'>))}
        >
          <span className="jk-chip" data-kind={b.kind} aria-hidden="true">
            <JokerIcon kind={b.kind} />
            <span className="jk-count" data-zero={b.count === 0 || undefined}>
              {b.freeRotation && b.count === 0 ? '↻' : b.count}
            </span>
          </span>
          <span className="jk-name" aria-hidden="true">
            {JOKER_NAMES[b.kind]}
          </span>
        </button>
      ))}
    </div>
  )
}
