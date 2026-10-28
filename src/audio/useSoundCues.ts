import { useEffect } from 'react'
import type { Effect } from '../fx/effects'
import type { JokerFx } from '../fx/jokerEffects'
import { playClear, playJoker, playPlace } from './sound'
import { jokerCue, moveCue, type SoundCue } from './soundCue'

/** Bir sesi mevcut tek ses motoruyla çalar (ses kapalıysa ya da motor hazır değilse hiçbir şey olmaz). */
export function playCue(cue: SoundCue): void {
  if (cue.kind === 'clear') playClear(cue.lines, cue.combo)
  else if (cue.kind === 'joker') playJoker(cue.joker)
  else playPlace()
}

/**
 * Oyun olaylarının sesleri (tek kanca). Hamle ve joker birbirinden bağımsız izlenir: her yeni
 * efekt nesnesinde bir kez çalar, aynı nesneyle yeniden çizimde çalmaz.
 */
export function useSoundCues(effect: Effect | null, jokerFx: JokerFx | null): void {
  useEffect(() => {
    if (effect) playCue(moveCue(effect))
  }, [effect])

  useEffect(() => {
    if (jokerFx) playCue(jokerCue(jokerFx))
  }, [jokerFx])
}
