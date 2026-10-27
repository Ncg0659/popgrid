import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, applyJoker, createRng, newGame, play, type GameState } from '../src/engine'
import { starsForFinalScore, starsForMove } from '../src/economy/rules'
import { greedyBot, jokerRescueAction } from '../scripts/bot'
import {
  NEW_POLICY_GAME,
  POLICIES,
  gameStars,
  hitCap,
  policyById,
  policyEnd,
  policyMove,
  policyPurchasedUse,
  shape,
  type GameStarsInput,
  type PolicyGame,
  type StarPolicy,
} from '../scripts/economy-policy'

/**
 * Dengeleme prototipinin (scripts/economy-policy.ts) güvenlik denetimi: kurallar birlikte çalışırken
 * yıldız geri alınmaz/sıfırlanmaz, çift ödül oluşmaz, adım adım sonuç simülasyonun kapalı biçimiyle aynıdır.
 * Oyundaki ekonomi kodu (src/economy/) bu prototipten etkilenmez.
 */

interface Played {
  awards: number[]
  game: PolicyGame
  input: GameStarsInput
}

/** Rastgele bir oyun akışını adım adım işler ve simülasyonun kullandığı ham özeti de çıkarır. */
function randomGame(p: StarPolicy, seed: number): Played {
  const rng = createRng(seed)
  let g = NEW_POLICY_GAME
  const awards: number[] = []
  let score = 0
  let lineStars = 0
  let lineAtPurchase = -1
  let scoreAtPurchase = -1
  const moves = 5 + rng.nextInt(120)
  const purchaseAt = rng.nextInt(3) === 0 ? -1 : rng.nextInt(moves)
  for (let i = 0; i < moves; i++) {
    if (i === purchaseAt) {
      lineAtPurchase = lineStars
      scoreAtPurchase = score
      g = policyPurchasedUse(p, g, score)
      // Aynı kullanım tekrar bildirilirse hiçbir şey değişmez.
      expect(policyPurchasedUse(p, g, score + 999)).toBe(g)
    }
    const line = [0, 0, 0, 2, 2, 5, 10][rng.nextInt(7)]!
    score += 3 + line * 9
    lineStars += line
    const step = policyMove(p, g, line)
    awards.push(step.stars)
    g = step.game
  }
  const end = policyEnd(p, g, score)
  awards.push(end.stars)
  g = end.game
  const used = purchaseAt >= 0
  return {
    awards,
    game: g,
    input: {
      lineStars,
      score,
      usedPurchased: used,
      lineAtPurchase: used ? lineAtPurchase : lineStars,
      scoreAtPurchase: used ? scoreAtPurchase : score,
    },
  }
}

describe('dengeleme kuralları birlikte: güvenlik', () => {
  for (const p of POLICIES) {
    it(`${p.id}: ödüller hiç negatif değil, toplam kapalı biçimle aynı, sert tavan aşılmaz`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const { awards, game, input } = randomGame(p, seed)
        expect(awards.every((a) => a >= 0 && Number.isSafeInteger(a))).toBe(true)
        const total = awards.reduce((a, b) => a + b, 0)
        expect(total).toBe(game.awarded)
        expect(total).toBe(gameStars(p, input))
        if (p.cap !== null && p.overCapRate === 0) expect(total).toBeLessThanOrEqual(p.cap)
        expect(hitCap(p, input)).toBe(p.cap !== null && shape({ ...p, overCapRate: 0 }, game.raw) < game.raw)
      }
    })
  }

  it('oyun sonu ödülü bir kez; bitmiş oyuna hamle yıldızı yazılmaz', () => {
    for (const p of POLICIES) {
      const a = policyEnd(p, policyMove(p, NEW_POLICY_GAME, 5).game, 400)
      expect(policyEnd(p, a.game, 400).stars).toBe(0)
      expect(policyMove(p, a.game, 10).stars).toBe(0)
      expect(policyPurchasedUse(p, a.game, 400)).toBe(a.game)
    }
  })

  it('satın alma yapmayan oyuncu için B, D ve E kuralları hiçbir şey değiştirmez', () => {
    const pairs: Array<[string, string]> = [['A', 'B'], ['A', 'E'], ['C200', 'D200'], ['C200', 'E200'], ['C150', 'D150']]
    for (const [base, rule] of pairs) {
      for (let seed = 1; seed <= 200; seed++) {
        const input: GameStarsInput = { ...randomGame(policyById(base), seed).input }
        const noBuy = { ...input, usedPurchased: false, lineAtPurchase: input.lineStars, scoreAtPurchase: input.score }
        expect(gameStars(policyById(rule), noBuy)).toBe(gameStars(policyById(base), noBuy))
      }
    }
  })

  it('B + tavan (D): satın alınmış joker kazanılmış hat yıldızlarını sıfırlamaz', () => {
    const d = policyById('D200')
    let g = NEW_POLICY_GAME
    let got = 0
    for (let i = 0; i < 12; i++) {
      const s = policyMove(d, g, 10)
      g = s.game
      got += s.stars
    }
    expect(got).toBe(120)
    g = policyPurchasedUse(d, g, 1500)
    const end = policyEnd(d, g, 2500)
    expect(end.stars).toBe(0)
    expect(end.game.awarded).toBe(120)
  })

  it('tavan aşılınca sonraki hamleler 0 verir, kazanılanlar geri alınmaz', () => {
    const c = policyById('C150')
    let g = NEW_POLICY_GAME
    const awards: number[] = []
    for (let i = 0; i < 20; i++) {
      const s = policyMove(c, g, 10)
      g = s.game
      awards.push(s.stars)
    }
    expect(awards.slice(0, 15).every((a) => a === 10)).toBe(true)
    expect(awards.slice(15).every((a) => a === 0)).toBe(true)
    expect(policyEnd(c, g, 5000).stars).toBe(0)
    expect(g.awarded).toBe(150)
  })

  it('yumuşak tavan: tavan üstü yalnızca %25, toplam hiç azalmaz', () => {
    const y = policyById('E200y')
    expect([0, 199, 200, 204, 280, 600].map((r) => shape(y, r))).toEqual([0, 199, 200, 201, 220, 300])
  })

  it('dondurma (E): satın alınmış jokerden sonraki hatlar yıldız vermez, oyun sonu o anki skorla', () => {
    const e = policyById('E')
    let g = policyMove(e, NEW_POLICY_GAME, 5).game
    g = policyPurchasedUse(e, g, 340)
    expect(policyMove(e, g, 10).stars).toBe(0)
    const end = policyEnd(e, g, 9_000)
    expect(end.stars).toBe(starsForFinalScore(340))
    expect(end.game.awarded).toBe(5 + 15)
  })
})

describe('simülasyonun ham verisi gerçek oyunla tutarlı', () => {
  it('satın alınmış jokerli gerçek oyunlarda adım adım ödül = kapalı biçim (her senaryo)', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const inventory = { cekic: 1, yenile: 1, dondur: 1 }
      let state: GameState = newGame(seed, DEFAULT_CONFIG, { mode: 'eglence', inventory })
      const games = POLICIES.map(() => NEW_POLICY_GAME)
      const sums = POLICIES.map(() => 0)
      let lineStars = 0
      let lineAtPurchase = -1
      let scoreAtPurchase = -1
      while (!state.gameOver && state.moveCount < 1500) {
        if (state.stuck) {
          const r = applyJoker(state, jokerRescueAction(state)!)
          if (!r.ok) throw new Error(r.reason)
          if (r.events.some((e) => e.type === 'jokerUsed' && e.source === 'inventory')) {
            if (lineAtPurchase < 0) {
              lineAtPurchase = lineStars
              scoreAtPurchase = state.score
            }
            POLICIES.forEach((p, i) => (games[i] = policyPurchasedUse(p, games[i]!, state.score)))
          }
          state = r.state
          continue
        }
        const r = play(state, greedyBot(state)!)
        if (!r.ok) throw new Error(r.reason)
        const line = starsForMove(r.events)
        lineStars += line
        POLICIES.forEach((p, i) => {
          const s = policyMove(p, games[i]!, line)
          games[i] = s.game
          sums[i]! += s.stars
        })
        state = r.state
      }
      const used = lineAtPurchase >= 0
      const input: GameStarsInput = {
        lineStars,
        score: state.score,
        usedPurchased: used,
        lineAtPurchase: used ? lineAtPurchase : lineStars,
        scoreAtPurchase: used ? scoreAtPurchase : state.score,
      }
      POLICIES.forEach((p, i) => {
        const end = policyEnd(p, games[i]!, state.score)
        expect(sums[i]! + end.stars).toBe(gameStars(p, input))
      })
    }
  })
})
