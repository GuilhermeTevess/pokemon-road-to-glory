import {describe, expect, it} from 'vitest';
import {BattleController} from '../src/game/battle';
import {createMon} from '../src/game/mon';
import type {Encounter} from '../src/game/types';

function doubleEnc(): Encounter {
  const a = createMon('Pidgey', {level: 8});
  const b = createMon('Rattata', {level: 8});
  return {mon: a, team: [a, b], rarity: 'common', boss: false, double: true};
}

describe('batalha em dupla', () => {
  it('dois contra dois até o fim, escolhendo alvo', () => {
    for (let round = 0; round < 5; round++) {
      const party = [createMon('Charmander', {level: 20}), createMon('Squirtle', {level: 20}), createMon('Bulbasaur', {level: 20})];
      const ctl = new BattleController(party, doubleEnc());
      expect(ctl.doubles).toBe(true);
      const events = ctl.initialEvents();
      expect(events.filter(e => e.switchIn).length).toBe(4);
      expect(new Set(events.filter(e => e.switchIn?.side === 'p2').map(e => e.slot))).toEqual(new Set([0, 1]));
      for (let turn = 0; turn < 60 && !ctl.ended; turn++) {
        if (ctl.mustSwitch) {
          const next = ctl.partyStatus().find(p => !p.active && p.hp > 0);
          if (next) ctl.chooseSwitch(next.uid);
          continue;
        }
        const first = ctl.slot;
        const moves = ctl.moveOptions().filter(m => !m.disabled);
        const tgt = ctl.targetOptions(moves[0].index);
        const ev = ctl.chooseMove(moves[0].index, false, tgt.at(-1)?.loc);
        // Primeira escolha de duas: ainda não rodou o turno.
        if (ctl.battle.p1.active.filter(p => p && !p.fainted).length === 2 && first === 0) expect(ev).toEqual([]);
      }
      expect(ctl.ended).toBe(true);
    }
  });

  it('pokébola gasta o turno dos dois', () => {
    const party = [createMon('Charmander', {level: 5}), createMon('Squirtle', {level: 5})];
    const ctl = new BattleController(party, doubleEnc());
    ctl.initialEvents();
    const turn = ctl.battle.turn;
    const {result} = ctl.throwBall('pokeball');
    if (!result.caught) expect(ctl.battle.turn).toBe(turn + 1);
  });
});
