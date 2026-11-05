import { BOARD_SIZE } from '../engine/types'
import { luckyChip } from '../ui/specialUi'
import { celebrationText, type Effect } from './effects'

interface Props {
  effect: Effect | null
  reducedMotion: boolean
}

/** 3×3 patlama alanının ızgaradaki yeri (kenarda kırpılır; motordaki blastArea ile aynı). */
function blastBox(cell: number) {
  const r = Math.floor(cell / BOARD_SIZE)
  const c = cell % BOARD_SIZE
  const r0 = Math.max(0, r - 1)
  const c0 = Math.max(0, c - 1)
  const r1 = Math.min(BOARD_SIZE - 1, r + 1)
  const c1 = Math.min(BOARD_SIZE - 1, c + 1)
  return { gridRow: `${r0 + 1} / ${r1 + 2}`, gridColumn: `${c0 + 1} / ${c1 + 2}` }
}

/**
 * Tahtanın üstündeki efekt katmanı (dokunmayı engellemez):
 * - Temizlenen blokların "pop" kopyaları (gerçek hücreler zaten boşalmıştır)
 * - Aşama 8.3: bomba patlaması (3×3 parlama halkası, zincirde sırayla), patlayan blokların pop kopyaları,
 *   şanslı blok ödül çipi
 * - Çoklu temizleme / kombo / patlama kutlama yazısı
 * Azaltılmış harekette büyüme ve uçuş yoktur: patlama alanı ve ödül çipi yerinde görünüp yalnızca solar.
 * Animasyonlar bitince öğeler görünmez kalır; bir sonraki hamlede yenileriyle değişir.
 */
export function BoardFx({ effect, reducedMotion }: Props) {
  if (!effect) return null
  const text = celebrationText(effect)
  const blasts = effect.blasts ?? []
  const blasted = effect.blasted ?? []
  const lucky = effect.lucky ?? []
  const pops = reducedMotion ? [] : [...effect.cleared, ...blasted]
  return (
    <>
      {(pops.length > 0 || blasts.length > 0 || lucky.length > 0) && (
        <div key={`pop-${effect.id}`} className="fx-grid" aria-hidden="true">
          {pops.map((b, k) => (
            <span
              // Aynı hücre hem satırda hem patlamada olamaz (motor önce satırı temizler); yine de anahtar sırayla tekil.
              key={`${k}-${b.cell}`}
              className="blk fx-pop"
              data-c={b.color}
              style={{
                gridRow: Math.floor(b.cell / BOARD_SIZE) + 1,
                gridColumn: (b.cell % BOARD_SIZE) + 1,
                animationDelay: `${b.delay}ms`,
              }}
            />
          ))}
          {blasts.map((b) => (
            <span
              key={`blast-${b.cell}`}
              className="fx-blast"
              data-step={b.step}
              style={{ ...blastBox(b.cell), animationDelay: `${b.delay}ms` }}
            />
          ))}
          {lucky.map((l) => (
            <span
              key={`lucky-${l.cell}`}
              className="fx-lucky"
              data-joker={l.reward.type === 'joker' || undefined}
              // Kenar sütunlarda çip tahtanın içine doğru açılır (ekran dışına taşmasın).
              data-edge={l.cell % BOARD_SIZE === 0 ? 'l' : l.cell % BOARD_SIZE === BOARD_SIZE - 1 ? 'r' : undefined}
              style={{
                gridRow: Math.floor(l.cell / BOARD_SIZE) + 1,
                gridColumn: (l.cell % BOARD_SIZE) + 1,
                animationDelay: `${l.delay}ms`,
              }}
            >
              <b>{luckyChip(l)}</b>
            </span>
          ))}
        </div>
      )}
      {text && (
        <div key={`cheer-${effect.id}`} className="cheer" data-big={effect.lines >= 3 || blasts.length >= 2 || undefined} role="status">
          {text.title && <span className="cheer-title">{text.title}</span>}
          {text.combo && <span className="cheer-combo">{text.combo}</span>}
          {text.blast && <span className="cheer-blast">{text.blast}</span>}
        </div>
      )}
    </>
  )
}
