import {describe, expect, it} from 'vitest';
import {RUSH_MODES, doublesMode, drawPairs, duelChoose, duelNeeds, duelRequest, rushMon, type DuelReq} from '../src/game/rush';
import {BattleController, type Side} from '../src/game/battle';

/** Monta a escolha completa de um lado na dupla: um golpe (ou troca) por Pokémon. */
function pickAll(req: DuelReq, randomTarget: boolean): string {
  const used = new Set<number>();
  return req
    .slots!.map(s => {
      if (s.forced) {
        const sw = req.switches.find(x => !used.has(x.index));
        if (!sw) return 'pass';
        used.add(sw.index);
        return `switch ${sw.index}`;
      }
      const m = s.moves.find(x => !x.disabled && (x.locked || x.pp > 0)) ?? s.moves[0];
      const aim = m.targets && randomTarget ? m.targets[Math.floor(Math.random() * m.targets.length)].aim : (m.aim ?? '');
      return `move ${m.index}${aim}`;
    })
    .join(', ');
}

describe('Rush em dupla', () => {
  it('existe o modo Dupla, com o grupo do Clássico', () => {
    expect(RUSH_MODES.some(m => m.id === 'duo')).toBe(true);
    expect(doublesMode('duo')).toBe(true);
    expect(doublesMode('nv50')).toBe(false);
  });

  it('dois jogadores no mesmo aparelho jogam a dupla até o fim', () => {
    for (let round = 0; round < 3; round++) {
      const pairs = drawPairs('duo');
      const a = pairs.map(p => rushMon(p[0], 'duo'));
      const b = pairs.map(p => rushMon(p[1], 'duo'));
      const ctl = new BattleController(a, {mon: b[0], team: b, rarity: 'rare', boss: true, trainer: 'Bia', versus: 'Ju', double: true});
      expect(ctl.doubles).toBe(true);
      const start = ctl.initialEvents();
      expect(start.filter(e => e.switchIn).length).toBe(4);
      let sawTargets = false;
      for (let turn = 0; turn < 300 && !ctl.ended; turn++) {
        for (const side of ['p2', 'p1'] as Side[]) {
          if (ctl.ended || !duelNeeds(ctl.battle, side)) continue;
          const req = duelRequest(ctl.battle, side);
          expect(req.slots?.length).toBeGreaterThan(0);
          if (req.slots!.some(s => s.moves.some(m => m.targets))) sawTargets = true;
          duelChoose(ctl, side, pickAll(req, true), false);
        }
      }
      expect(ctl.ended).toBe(true);
      expect(sawTargets).toBe(true);
    }
  });

  it('contra o computador: só o jogador escolhe e a IA joga a dupla', () => {
    const pairs = drawPairs('duo');
    const a = pairs.map(p => rushMon(p[0], 'duo'));
    const b = pairs.map(p => rushMon(p[1], 'duo'));
    const ctl = new BattleController(a, {mon: b[0], team: b, rarity: 'rare', boss: true, trainer: 'Bia', double: true});
    ctl.initialEvents();
    for (let turn = 0; turn < 300 && !ctl.ended; turn++) {
      if (duelNeeds(ctl.battle, 'p1')) duelChoose(ctl, 'p1', pickAll(duelRequest(ctl.battle, 'p1'), false), false);
    }
    expect(ctl.ended).toBe(true);
  });
});
