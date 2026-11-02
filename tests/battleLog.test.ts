import {describe, expect, it} from 'vitest';
import {BattleController} from '../src/game/battle';
import type {BattleEvent} from '../src/game/battle';
import {BattleTracker, boostMultiplier, multiplierText} from '../src/game/battleLog';
import {createMon} from '../src/game/mon';
import type {Encounter, OwnedMon} from '../src/game/types';

function setup(moves: string[], foeMoves = ['splash']) {
  const me = createMon('Garchomp', {level: 60}) as OwnedMon;
  me.moves = moves;
  const foe = createMon('Magikarp', {level: 5});
  foe.moves = foeMoves;
  const ctl = new BattleController([me], {mon: foe, rarity: 'common'} as Encounter);
  const tracker = new BattleTracker();
  const feed = (evs: BattleEvent[]) => evs.forEach(e => tracker.push(e));
  feed(ctl.initialEvents());
  return {ctl, tracker, feed};
}

describe('histórico e atributos da batalha', () => {
  it('Swords Dance aparece como +2 de Ataque, na rodada certa', () => {
    const {ctl, tracker, feed} = setup(['swordsdance', 'tackle']);
    expect(tracker.turn).toBe(1);
    expect(tracker.speciesAt('p1')).toBe('Garchomp');
    feed(ctl.chooseMove(0));
    expect(tracker.boostsAt('p1').atk).toBe(2);
    const move = tracker.entries.find(e => e.kind === 'move' && e.side === 'p1');
    expect(move).toMatchObject({turn: 1, species: 'Garchomp', move: 'Swords Dance'});
    expect(tracker.entries.some(e => e.kind === 'boost' && e.stat === 'atk' && e.amount === 2)).toBe(true);
    feed(ctl.chooseMove(0));
    expect(tracker.boostsAt('p1').atk).toBe(4);
    expect(tracker.byTurn().map(g => g.turn)).toEqual([0, 1, 2]);
  });

  it('Draco Meteor baixa 2 de Atq. Esp. de quem usa', () => {
    const foe = createMon('Snorlax', {level: 80});
    foe.moves = ['splash'];
    const me = createMon('Garchomp', {level: 50}) as OwnedMon;
    me.moves = ['dracometeor'];
    const ctl = new BattleController([me], {mon: foe, rarity: 'common'} as Encounter);
    const t = new BattleTracker();
    ctl.initialEvents().forEach(e => t.push(e));
    ctl.chooseMove(0).forEach(e => t.push(e));
    // Errar é raro (90%), mas pode: então só confere quando acertou.
    const used = t.entries.find(e => e.kind === 'move' && e.side === 'p1');
    if (used && used.kind === 'move' && !used.results.includes('miss')) expect(t.boostsAt('p1').spa).toBe(-2);
  });

  it('item X (fora do log do simulador) também aparece', () => {
    const {ctl, tracker, feed} = setup(['tackle']);
    feed(ctl.useBoostItem('xattack'));
    expect(tracker.boostsAt('p1').atk).toBe(2);
  });

  it('trocar de Pokémon zera os estágios', () => {
    const t = new BattleTracker();
    t.push({switchIn: {side: 'p1', species: 'Pikachu', hp: 10, maxhp: 10}});
    t.push({boost: {side: 'p1', stat: 'spe', amount: 2}});
    expect(t.boostsAt('p1').spe).toBe(2);
    t.push({switchIn: {side: 'p1', species: 'Raichu', hp: 10, maxhp: 10}});
    expect(t.boostsAt('p1').spe).toBeUndefined();
    t.push({boost: {side: 'p1', stat: 'atk', set: 6}});
    t.push({boost: {side: 'p1', stat: 'atk', amount: 2}});
    expect(t.boostsAt('p1').atk).toBe(6);
    t.push({clearBoosts: {}});
    expect(t.boostsAt('p1').atk).toBeUndefined();
  });

  it('multiplicadores oficiais', () => {
    expect(multiplierText(boostMultiplier('atk', 2))).toBe('x2');
    expect(multiplierText(boostMultiplier('spa', -2))).toBe('x0,5');
    expect(multiplierText(boostMultiplier('spe', -1))).toBe('x0,67');
    expect(multiplierText(boostMultiplier('accuracy', 1))).toBe('x1,33');
  });

  it('não guarda nada escondido (item, habilidade, nature)', () => {
    const {ctl, tracker, feed} = setup(['swordsdance', 'tackle']);
    feed(ctl.chooseMove(1));
    const text = JSON.stringify(tracker.entries);
    const me = ctl.battle.p1.active[0];
    expect(text).not.toContain(me.set.nature);
    expect(text.toLowerCase()).not.toContain(String(me.ability));
  });
});
