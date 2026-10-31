import {describe, expect, it} from 'vitest';
import {BattleController} from '../src/game/battle';
import {duelRequest} from '../src/game/rush';
import {createMon} from '../src/game/mon';
import type {Encounter, OwnedMon} from '../src/game/types';

function setup(moves: string[], opts: {item?: string; foeMoves?: string[]} = {}) {
  const me = createMon('Lopunny', {level: 50}) as OwnedMon;
  me.moves = moves;
  if (opts.item) me.item = opts.item;
  me.hp = 40;
  const foe = createMon(opts.foeMoves ? 'Magikarp' : 'Snorlax', {level: 50});
  if (opts.foeMoves) foe.moves = opts.foeMoves;
  const ctl = new BattleController([me], {mon: foe, rarity: 'common'} as Encounter);
  ctl.initialEvents();
  return {ctl, me};
}

/** Simula o clique da tela: só escolhe golpes que o botão deixa apertar. */
function clickable(ctl: BattleController) {
  return ctl.moveOptions().filter(m => !(m.disabled || (!m.locked && m.pp <= 0)));
}

describe('golpes de vários turnos', () => {
  for (const move of ['bounce', 'fly', 'dig', 'dive', 'solarbeam', 'skyattack', 'phantomforce', 'outrage', 'hyperbeam', 'meteorbeam']) {
    it(`${move} não trava a batalha`, () => {
      const {ctl} = setup([move, 'tackle']);
      for (let t = 0; t < 6 && !ctl.ended; t++) {
        const opts = clickable(ctl);
        expect(opts.length, `turno ${ctl.battle.turn}`).toBeGreaterThan(0);
        const turn = ctl.battle.turn;
        ctl.chooseMove(opts[0].index);
        expect(ctl.battle.turn > turn || ctl.ended).toBe(true);
      }
    });
  }

  it('no ar com Bounce não dá para usar item nem trocar', () => {
    const {ctl, me} = setup(['bounce']);
    ctl.chooseMove(1);
    expect(ctl.isLocked()).toBe(true);
    expect(ctl.canUseItem()).toBe(false);
    expect(ctl.canSwitch()).toBe(false);
    expect(ctl.moveOptions()).toMatchObject([{id: 'bounce', locked: true, disabled: false}]);
    expect(ctl.useHealItem('potion', me.uid)).toEqual([]);
  });

  it('PvP: o golpe em andamento aparece liberado', () => {
    const {ctl} = setup(['bounce']);
    ctl.chooseMove(1);
    const req = duelRequest(ctl.battle, 'p1');
    expect(req.moves).toMatchObject([{id: 'bounce', locked: true, disabled: false}]);
  });
});

describe('itens gastam o turno', () => {
  const potionTurn = (moves: string[], opts: {item?: string; foeMoves?: string[]} = {}, before?: (c: BattleController) => void) => {
    const {ctl, me} = setup(moves, opts);
    before?.(ctl);
    const turn = ctl.battle.turn;
    const pp = ctl.battle.p1.active[0].moveSlots[0].pp;
    const evs = ctl.useHealItem('potion', me.uid);
    expect(evs.length).toBeGreaterThan(0);
    expect(ctl.battle.turn).toBe(turn + 1);
    expect(ctl.battle.p1.active[0].moveSlots[0].pp).toBe(pp);
  };
  it('poção normal', () => potionTurn(['tackle'], {foeMoves: ['splash']}));
  it('com Choice Band (preso a um golpe)', () => potionTurn(['tackle', 'quickattack'], {item: 'choiceband', foeMoves: ['splash']}, c => c.chooseMove(1)));
  it('com Taunt', () => potionTurn(['tackle'], {foeMoves: ['taunt']}, c => c.chooseMove(1)));
  it('item X', () => {
    const {ctl} = setup(['tackle'], {foeMoves: ['splash']});
    const turn = ctl.battle.turn;
    ctl.useBoostItem('xattack');
    expect(ctl.battle.turn).toBe(turn + 1);
  });
});
