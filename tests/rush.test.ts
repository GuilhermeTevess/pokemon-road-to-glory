import {describe, expect, it} from 'vitest';
import {RUSH_MODES, drawPairs, giveMegaStone, rushMon, rushPool} from '../src/game/rush';
import {BattleController} from '../src/game/battle';

describe('rush', () => {
  it('todos os modos têm Pokémon suficientes', () => {
    for (const m of RUSH_MODES) expect(rushPool(m.id).length, m.id).toBeGreaterThanOrEqual(12);
  });

  it('duplas sem repetir', () => {
    const pairs = drawPairs('evo2');
    const all = pairs.flat();
    expect(new Set(all).size).toBe(12);
  });

  it('batalha no mesmo PC termina com os dois lados escolhendo', () => {
    const a = drawPairs('mega').map(p => rushMon(p[0], 'mega'));
    const b = drawPairs('nv50').map(p => rushMon(p[1], 'nv50'));
    giveMegaStone(a[0]);
    expect(a[0].item).toBeTruthy();
    const ctl = new BattleController(a, {mon: b[0], team: b, rarity: 'rare', boss: true, trainer: 'Bia', versus: 'Ju'});
    ctl.initialEvents();
    const bat = ctl.battle;
    for (let turn = 0; turn < 400 && !ctl.ended; turn++) {
      if (bat.p2.requestState === 'switch') {
        const i = bat.p2.pokemon.findIndex((p, k) => k > 0 && !p.fainted);
        ctl.chooseP2(`switch ${i + 1}`);
      } else if (bat.p2.requestState === 'move') ctl.chooseP2('move 1');
      if (ctl.ended) break;
      if (bat.p1.requestState === 'switch') {
        const i = bat.p1.pokemon.findIndex((p, k) => k > 0 && !p.fainted);
        ctl.chooseSwitch(ctl.partyStatus()[i].uid);
      } else if (bat.p1.requestState === 'move') ctl.chooseMove(1, true);
    }
    expect(ctl.ended).toBe(true);
  });
});
