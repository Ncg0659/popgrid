import { useEffect, useRef, useState } from 'react'
import { DAILY_BONUS } from '../economy/goalsCatalog'
import { allDailyDone, localDayKey, missionDone, missionView } from '../economy/goals'
import type { EconomyState } from '../economy/ledger'
import { dailyRewardStatus } from '../economy/rewards'
import { SHOP_TOAST_MS } from '../fx/fxTiming'
import { useDialog } from '../help/useDialog'
import { fmtStars, fmtStarsShort, type EconomyStatus } from './economyUi'
import {
  TIER_LABEL,
  achievementGroups,
  goalsBlockedReason,
  missionHint,
  missionProgressText,
  missionTitle,
  nextMissionsText,
  streakText,
} from './goalsUi'
import { StarIcon } from './StarIcon'

export type GoalsTab = 'gunluk' | 'basarim'

interface Props {
  state: EconomyState
  status: EconomyStatus
  persistent: boolean
  /** Ödülü alır; sonuç mesajını döndürür. */
  onClaim(rewardId: string): { ok: boolean; text: string }
  canTakeOver: boolean
  onTakeOver(): void
  onClose(): void
  returnFocus?: () => HTMLElement | null
}

const STATE_LABEL = { kilitli: 'Kilitli', ilerliyor: 'Sürüyor', tamam: 'Tamamlandı', alindi: 'Alındı' } as const

/**
 * Aşama 10.4: Görevler paneli (ekranın altından açılır, oyunun üstünde; oyun durumu değişmez).
 * İki sekme: Günlük Görevler (3 görev + bonus, yeni görevlere kalan süre) ve Başarımlar (7 seri × 3 basamak).
 */
export function GoalsSheet({ state, status, persistent, onClaim, canTakeOver, onTakeOver, onClose, returnFocus }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialog = useDialog<HTMLDivElement>(onClose, closeRef, returnFocus)
  const [tab, setTab] = useState<GoalsTab>('gunluk')
  const [now, setNow] = useState(() => Date.now())
  // Ödül alınca kartların üstüne bildirim çıkmaz: başarıda yalnızca başlıktaki bakiye güncellenir;
  // sorun olursa (kayıt yazılamadı vb.) mesaj panelin içinde, kartları itmeden en üstte görünür.
  const [error, setError] = useState<{ id: number; text: string } | null>(null)
  const errorId = useRef(0)
  const blocked = goalsBlockedReason(status, persistent)
  const canClaim = blocked === null

  // Kalan süre dakikada bir güncellenir (yalnızca panel açıkken).
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!error) return
    const t = window.setTimeout(() => setError(null), SHOP_TOAST_MS)
    return () => window.clearTimeout(t)
  }, [error])

  const claim = (id: string) => {
    const r = onClaim(id)
    if (r.ok) return setError(null)
    errorId.current += 1
    setError({ id: errorId.current, text: r.text })
  }

  const g = state.goals
  const daily = dailyRewardStatus(state)
  const bonus = daily[daily.length - 1]
  const doneCount = g.daily.filter(missionDone).length
  const groups = achievementGroups(state)
  const achDone = groups.reduce((n, gr) => n + gr.rows.filter((r) => r.state === 'tamam' || r.state === 'alindi').length, 0)
  const streak = streakText(g, localDayKey(now))

  const claimButton = (id: string, stars: number, done: boolean, claimed: boolean, name: string) =>
    claimed ? (
      <span className="goal-claimed">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
        Alındı
      </span>
    ) : done ? (
      <button type="button" className="goal-claim" disabled={!canClaim} onClick={() => claim(id)} aria-label={`${name}: ${stars} yıldızı al`}>
        Al <StarIcon /> {stars}
      </button>
    ) : (
      <span className="goal-reward" aria-label={`Ödül ${stars} yıldız`}>
        <StarIcon /> {stars}
      </span>
    )

  return (
    <div
      className="overlay shop-overlay goals-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={dialog} className="sheet shop goals" role="dialog" aria-modal="true" aria-labelledby="goals-title">
        <div className="shop-grip" aria-hidden="true" />
        <header className="help-head shop-head">
          <h2 id="goals-title">Görevler</h2>
          <div className="goals-head-end">
            <span className="goals-balance" role="status" aria-live="polite" aria-label={`Yıldız bakiyen ${fmtStars(state.stars)}`}>
              <StarIcon /> {fmtStarsShort(state.stars)}
            </span>
            <button ref={closeRef} type="button" className="btn-soft" onClick={onClose}>
              Kapat
            </button>
          </div>
        </header>
        <div className="goals-tabs" role="tablist" aria-label="Görevler">
          <button type="button" role="tab" id="goals-tab-gunluk" aria-controls="goals-panel" aria-selected={tab === 'gunluk'} onClick={() => setTab('gunluk')}>
            Günlük<span className="goals-tab-long"> Görevler</span>
          </button>
          <button type="button" role="tab" id="goals-tab-basarim" aria-controls="goals-panel" aria-selected={tab === 'basarim'} onClick={() => setTab('basarim')}>
            Başarımlar <span className="goals-tab-n">{achDone}/21</span>
          </button>
        </div>
        <div className="shop-body goals-body" id="goals-panel" role="tabpanel" aria-labelledby={`goals-tab-${tab}`}>
          {error && (
            <p className="goals-error" role="alert">
              {error.text}
            </p>
          )}
          {blocked && (
            <div className="shop-blocked" role="note">
              <p>{blocked}</p>
              {canTakeOver && (
                <button type="button" className="btn-soft wide eco-takeover" onClick={onTakeOver}>
                  Bu sekmede devam et
                </button>
              )}
            </div>
          )}
          {tab === 'gunluk' ? (
            <>
              <p className="goals-meta">
                <span>{nextMissionsText(g, now) ?? 'Görevler ilk oyunla başlar'}</span>
                {streak && <span className="goals-streak">{streak}</span>}
              </p>
              <ul className="goals-list">
                {g.daily.map((m, i) => {
                  const v = missionView(m)
                  const st = daily[i]!
                  const title = missionTitle(m)
                  const hint = missionHint(m)
                  return (
                    <li key={st.id} className="goal-card" data-state={st.claimed ? 'alindi' : v.done ? 'tamam' : 'surer'}>
                      <div className="goal-top">
                        <span className="goal-tier" data-tier={m.tier}>
                          {TIER_LABEL[m.tier]}
                        </span>
                        {claimButton(st.id, st.stars, st.done, st.claimed, title)}
                      </div>
                      <p className="goal-title">{title}</p>
                      {hint && !v.done && <p className="goal-hint">{hint}</p>}
                      <div className="goal-bar" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.percent}>
                        <i style={{ width: `${v.percent}%` }} />
                      </div>
                      <p className="goal-progress">{missionProgressText(m)}</p>
                    </li>
                  )
                })}
              </ul>
              {bonus && (
                <div className="goal-card goal-bonus" data-state={bonus.claimed ? 'alindi' : bonus.done ? 'tamam' : 'surer'}>
                  <div className="goal-top">
                    <p className="goal-title">Üç görevi de bitir</p>
                    {claimButton(bonus.id, DAILY_BONUS, allDailyDone(g), bonus.claimed, 'Üç görev bonusu')}
                  </div>
                  <div className="goal-dots" aria-label={`${doneCount} / 3 görev tamam`}>
                    {[0, 1, 2].map((k) => (
                      <i key={k} data-on={k < doneCount || undefined} />
                    ))}
                  </div>
                </div>
              )}
              <p className="shop-note">Gün bitince tamamlanmış ama alınmamış ödüller hesabına kendiliğinden eklenir. Klasik ve Eğlence birlikte sayılır.</p>
            </>
          ) : (
            <div className="ach-groups">
              {groups.map((grp) => (
                <section key={grp.name} className="ach-group" aria-label={grp.name}>
                  <h3>{grp.name}</h3>
                  <ul>
                    {grp.rows.map((row) => (
                      <li key={row.id} className="ach-row" data-state={row.state}>
                        <span className="ach-step" aria-hidden="true">
                          {row.state === 'kilitli' ? (
                            <svg viewBox="0 0 24 24">
                              <rect x="5" y="11" width="14" height="10" rx="2.5" />
                              <path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" />
                            </svg>
                          ) : (
                            row.step
                          )}
                        </span>
                        <span className="ach-text">
                          <span className="ach-title">{row.title}</span>
                          <span className="ach-sub">
                            {row.state === 'kilitli' ? STATE_LABEL.kilitli : row.state === 'ilerliyor' ? `${row.value.toLocaleString('tr-TR')} / ${row.target.toLocaleString('tr-TR')}` : STATE_LABEL[row.state]}
                          </span>
                          {row.state === 'ilerliyor' && (
                            <span className="goal-bar ach-bar" role="progressbar" aria-label={row.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.percent}>
                              <i style={{ width: `${row.percent}%` }} />
                            </span>
                          )}
                        </span>
                        {claimButton(row.rewardId, row.reward, row.state === 'tamam', row.state === 'alindi', `${grp.name} ${row.step}`)}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
