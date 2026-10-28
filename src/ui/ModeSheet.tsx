import { useRef } from 'react'
import { DEFAULT_FREE_JOKERS } from '../engine'
import type { GameMode } from '../engine/types'
import { useDialog } from '../help/useDialog'
import { fmtStars } from './economyUi'
import { JokerIcon } from './JokerIcon'
import { StarIcon } from './StarIcon'

const fmt = (n: number) => n.toLocaleString('tr-TR')

interface Props {
  current: GameMode
  bests: Readonly<Record<GameMode, number>>
  /** Yıldız bakiyesi (açılış/yeni oyun ekranında gösterilir). */
  stars: number
  onStart(mode: GameMode): void
  onClose(): void
  returnFocus?: () => HTMLElement | null
}

/**
 * Yeni oyun: mod seçimi. Mod yalnızca burada, oyun başlarken seçilir; oyun ortasında değişmez.
 * Kartlardan birine dokunmak o modda yeni oyunu hemen başlatır.
 */
export function ModeSheet({ current, bests, stars, onStart, onClose, returnFocus }: Props) {
  const currentRef = useRef<HTMLButtonElement>(null)
  const dialog = useDialog<HTMLDivElement>(onClose, currentRef, returnFocus)
  const j = DEFAULT_FREE_JOKERS
  return (
    <div className="overlay" role="presentation">
      <div ref={dialog} className="sheet mode-sheet" role="dialog" aria-modal="true" aria-labelledby="mode-title">
        <header className="help-head">
          <h2 id="mode-title">Yeni oyun</h2>
          <button type="button" className="btn-soft" onClick={onClose}>
            Vazgeç
          </button>
        </header>
        <p className="mode-lead">Bir mod seç. Mod oyun boyunca değişmez.</p>
        <p className="mode-stars">
          <StarIcon />
          <span>
            <strong>{fmtStars(stars)}</strong> yıldız · iki modda da kazanılır
          </span>
        </p>
        <div className="mode-cards">
          <button
            ref={current === 'klasik' ? currentRef : undefined}
            type="button"
            className="mode-card"
            data-mode="klasik"
            data-current={current === 'klasik' || undefined}
            onClick={() => onStart('klasik')}
          >
            <span className="mode-art" aria-hidden="true">
              <span className="blk" data-c="1" />
              <span className="blk" data-c="2" />
              <span className="blk" data-c="3" />
              <span className="blk" data-c="4" />
            </span>
            <span className="mode-text">
              <span className="mode-name">Klasik</span>
              <span className="mode-desc">Jokersiz, saf blok bulmaca.</span>
              <span className="mode-best">Klasik rekor: {fmt(bests.klasik)}</span>
            </span>
          </button>
          <button
            ref={current === 'eglence' ? currentRef : undefined}
            type="button"
            className="mode-card"
            data-mode="eglence"
            data-current={current === 'eglence' || undefined}
            onClick={() => onStart('eglence')}
          >
            <span className="mode-art jokers" aria-hidden="true">
              <span className="jk-chip" data-kind="cekic">
                <JokerIcon kind="cekic" />
              </span>
              <span className="jk-chip" data-kind="yenile">
                <JokerIcon kind="yenile" />
              </span>
              <span className="jk-chip" data-kind="dondur">
                <JokerIcon kind="dondur" />
              </span>
            </span>
            <span className="mode-text">
              <span className="mode-name">Eğlence</span>
              <span className="mode-desc">
                Jokerlerle: Çekiç {j.cekic}, Yenile {j.yenile}, Döndür {j.dondur}.
              </span>
              <span className="mode-best">Eğlence rekoru: {fmt(bests.eglence)}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
