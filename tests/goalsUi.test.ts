/**
 * Aşama 10.4 — Görevler paneli metinleri, başarım durumları, rozet, kalan süre ve bildirimler (saf).
 */
import { describe, expect, it } from 'vitest'
import { DAILY_POOLS, pointsTemplate } from '../src/economy/goalsCatalog'
import { dailyMissions, initialGoals, type DailyMission } from '../src/economy/goals'
import { initialEconomy, type EconomyState } from '../src/economy/ledger'
import { achievementRewardId, claimReward, dailyRewardId, rollover } from '../src/economy/rewards'
import {
  achievementGroups,
  autoCreditNotice,
  claimMessage,
  claimableCount,
  completionNotice,
  goalsBlockedReason,
  missionProgressText,
  missionTitle,
  nextDayStart,
  nextMissionsText,
} from '../src/ui/goalsUi'

const DAY = '2026-11-09' // zor görev: oranlı puan (Klasik 1.500 / Eğlence 4.000)

function withDaily(daily: DailyMission[], extra: Partial<EconomyState> = {}): EconomyState {
  return { ...initialEconomy(), goals: { ...initialGoals(), day: DAY, daily }, ...extra }
}

describe('Aşama 10.4: görev metinleri', () => {
  it('her görev türünün açıklaması; teknik birim yok', () => {
    const zor = dailyMissions(DAY)[2]!
    expect(zor.kind).toBe('points')
    expect(missionTitle(zor)).toBe("Puan topla: Klasik'te 1.500 ya da Eğlence'de 4.000")
    for (const tier of ['kolay', 'orta', 'zor'] as const) {
      for (const t of DAILY_POOLS[tier]) {
        const m: DailyMission = { tier, kind: t.kind, target: t.target, reward: 10, progress: 0, ...(t.kind === 'points' ? { klasik: t.klasik, eglence: t.eglence } : {}) }
        const text = missionTitle(m) + missionProgressText(m)
        expect(text.length).toBeGreaterThan(5)
        expect(text.includes('12.000') || text.includes('6.000') || /birim/i.test(text)).toBe(false)
      }
    }
  })

  it('oranlı puan ilerlemesi yüzde ve kalan puan karşılıklarıyla', () => {
    const zor = { ...dailyMissions(DAY)[2]!, progress: 4800 } // 600 Klasik puanı
    expect(missionProgressText(zor)).toBe("%40 · Kalan: Klasik'te 900 ya da Eğlence'de 2.400 puan")
    expect(missionProgressText({ ...zor, progress: zor.target })).toBe('Tamamlandı')
    const orta: DailyMission = { tier: 'orta', reward: 20, progress: 0, ...pointsTemplate(750, 2000) }
    expect(missionTitle(orta)).toBe("Puan topla: Klasik'te 750 ya da Eğlence'de 2.000")
  })

  it('sayı ve en iyi değer görevleri', () => {
    expect(missionProgressText({ tier: 'kolay', kind: 'lines', target: 10, reward: 10, progress: 4 })).toBe('4 / 10')
    expect(missionProgressText({ tier: 'orta', kind: 'combo', target: 3, reward: 20, progress: 2 })).toBe('En iyi: 2 / 3')
    expect(missionTitle({ tier: 'kolay', kind: 'games', target: 1, reward: 10, progress: 0 })).toBe('1 oyun bitir')
  })
})

describe('Aşama 10.4: başarım grupları', () => {
  it('7 seri × 3 basamak; durumlar: ilerliyor, kilitli, tamam, alındı', () => {
    let s = initialEconomy()
    s = { ...s, goals: { ...s.goals, counters: { ...s.goals.counters, bestKlasik: 2600, lines: 40 } } }
    let groups = achievementGroups(s)
    expect(groups.length).toBe(7)
    expect(groups.every((g) => g.rows.length === 3)).toBe(true)
    expect(groups.flatMap((g) => g.rows).reduce((n, r) => n + r.reward, 0)).toBe(1775)
    const klasik = groups.find((g) => g.name === 'Klasik Rekoru')!
    expect(klasik.rows.map((r) => r.state)).toEqual(['tamam', 'tamam', 'ilerliyor'])
    const hat = groups.find((g) => g.name === 'Hat Ustası')!
    expect(hat.rows.map((r) => r.state)).toEqual(['ilerliyor', 'kilitli', 'kilitli'])
    expect(hat.rows[0]).toMatchObject({ value: 40, target: 100, percent: 40, title: 'Toplam 100 hat temizle' })
    const r = claimReward(s, achievementRewardId('klasik-1'))
    expect(r.ok).toBe(true)
    groups = achievementGroups(r.state)
    expect(groups.find((g) => g.name === 'Klasik Rekoru')!.rows.map((x) => x.state)).toEqual(['alindi', 'tamam', 'ilerliyor'])
  })
})

describe('Aşama 10.4: rozet, kalan süre, uyarı', () => {
  it('rozet = alınmayı bekleyen günlük + bonus + başarım', () => {
    const daily = dailyMissions(DAY).map((m) => ({ ...m, progress: m.target }))
    let s = withDaily(daily)
    s = { ...s, goals: { ...s.goals, counters: { ...s.goals.counters, maxCombo: 5 } } }
    expect(claimableCount(s)).toBe(3 + 1 + 2)
    const r = claimReward(s, dailyRewardId(DAY, 0))
    expect(r.ok && claimableCount(r.state)).toBe(5)
    expect(claimableCount(initialEconomy())).toBe(0)
  })

  it('yeni görevlere kalan süre (yerel gece yarısı)', () => {
    const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m).getTime()
    expect(nextDayStart(DAY)).toBe(new Date(2026, 10, 10).getTime())
    expect(nextMissionsText({ day: DAY }, at(16, 48))).toBe('Yeni görevler 7 sa 12 dk sonra')
    expect(nextMissionsText({ day: DAY }, at(23, 30))).toBe('Yeni görevler 30 dk sonra')
    expect(nextMissionsText({ day: DAY }, at(23, 59, ))).toBe('Yeni görevler birazdan')
    expect(nextMissionsText({ day: null }, at(10))).toBe(null)
  })

  it('okuyucu sekme, salt okunur ve kayıt hatası uyarıları', () => {
    expect(goalsBlockedReason('mine', true)).toBe(null)
    expect(goalsBlockedReason('other', true)).toContain('başka bir sekmede')
    expect(goalsBlockedReason('readonly', true)).toContain('yeni bir sürümden')
    expect(goalsBlockedReason('mine', false)).toContain('Kayıt yapılamıyor')
    expect(claimMessage({ ok: true, stars: 30 })).toBe('+30 ★ eklendi.')
    expect(claimMessage({ ok: false, reason: 'duplicateReward' })).toBe('Bu ödül zaten alındı.')
  })
})

describe('Aşama 10.4: bildirimler', () => {
  it('yeni tamamlanan görev bir kez bildirilir; aynı hâl, gün değişimi ve alma bildirim üretmez', () => {
    const base = withDaily(dailyMissions(DAY))
    const one = withDaily(dailyMissions(DAY).map((m, i) => (i === 0 ? { ...m, progress: m.target } : m)))
    expect(completionNotice(base, one)).toBe(`Görev tamam: ${missionTitle(one.goals.daily[0]!)}. Görevler'den al.`)
    expect(completionNotice(one, one)).toBe(null)
    expect(completionNotice(null, one)).toBe(null)
    const claimed = claimReward(one, dailyRewardId(DAY, 0))
    expect(claimed.ok && completionNotice(one, claimed.state)).toBe(null)
    const all = withDaily(dailyMissions(DAY).map((m) => ({ ...m, progress: m.target })))
    expect(completionNotice(base, all)).toBe("4 ödül hazır. Görevler'den al.") // 3 görev + bonus
    const nextDay = rollover(base, '2026-11-10').state
    expect(completionNotice(base, nextDay)).toBe(null)
  })

  it('gün sonunda otomatik eklenen ödüller bildirilir', () => {
    const all = withDaily(dailyMissions(DAY).map((m) => ({ ...m, progress: m.target })))
    const next = rollover(all, '2026-11-10').state
    expect(autoCreditNotice(all, next)).toBe('Dünün alınmamış görev ödülleri eklendi: +80 ★')
    const none = rollover(withDaily(dailyMissions(DAY)), '2026-11-10').state
    expect(autoCreditNotice(withDaily(dailyMissions(DAY)), none)).toBe(null)
    expect(autoCreditNotice(all, all)).toBe(null)
  })
})
