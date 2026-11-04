import {describe, expect, it} from 'vitest';
import {species} from '../src/data/dex';
import {LADDER_STEPS, drawLadders, ladderAfter, ladderMon, ladderPool} from '../src/game/ladder';
import {BattleController} from '../src/game/battle';

describe('Escadinha', () => {
  it('todo degrau tem Pokémon de sobra', () => {
    for (let k = 0; k < LADDER_STEPS; k++) expect(ladderPool(k).length, `degrau ${k + 1}`).toBeGreaterThanOrEqual(16);
  });

  it('as escadas vão piorando e não repetem Pokémon', () => {
    for (let i = 0; i < 20; i++) {
      const [a, b] = drawLadders();
      expect(a.length).toBe(LADDER_STEPS);
      expect(new Set([...a, ...b]).size).toBe(LADDER_STEPS * 2);
      for (const ladder of [a, b]) expect(species(ladder[0]).bst).toBeGreaterThan(species(ladder[LADDER_STEPS - 1]).bst + 200);
    }
  });

  it('quem vence desce um degrau; no último, é campeão', () => {
    expect(ladderAfter([0, 0], 1)).toEqual({steps: [0, 1], champion: null});
    expect(ladderAfter([3, 2], 0)).toEqual({steps: [4, 2], champion: null});
    expect(ladderAfter([LADDER_STEPS - 1, 5], 1)).toEqual({steps: [LADDER_STEPS - 1, 6], champion: null});
    expect(ladderAfter([LADDER_STEPS - 1, 5], 0).champion).toBe(0);
  });

  it('uma luta de 1 contra 1 roda até o fim', () => {
    const [a, b] = drawLadders();
    const me = ladderMon(a[0]);
    const foe = ladderMon(b[LADDER_STEPS - 1]);
    expect(me.level).toBe(50);
    const ctl = new BattleController([me], {mon: foe, team: [foe], rarity: 'rare', boss: true, trainer: 'Rival'});
    ctl.initialEvents();
    for (let t = 0; t < 200 && !ctl.ended; t++) ctl.chooseMove(0);
    expect(ctl.ended).toBe(true);
  });
});
