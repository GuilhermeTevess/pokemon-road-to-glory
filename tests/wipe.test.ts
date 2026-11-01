import {describe, expect, it} from 'vitest';
import {applyGymLoss, applyWipe, WIPE, wipePoints} from '../src/game/wipe';
import {createMon} from '../src/game/mon';
import {seasonPoints} from '../src/game/league';
import type {RunState} from '../src/game/types';
import type {Collection} from '../src/game/meta';

const runWith = (points: number): RunState =>
  ({
    wave: 44,
    party: [createMon('Charmeleon', {level: 30}), createMon('Pikachu', {level: 6})],
    bag: {pokeball: 5, potion: 1, expall: 1, megastone: 1},
    money: 1000,
    points: {gyms: points},
    pointLog: [],
  }) as unknown as RunState;

describe('derrota na carreira online', () => {
  it('perde níveis (nunca abaixo de 5), itens comuns, dinheiro e alguns pontos', () => {
    const run = runWith(300);
    const col = {career: {fame: 500}} as unknown as Collection;
    const loss = applyWipe(run, col, 'Onix selvagem');
    expect(run.party[0].level).toBe(30 - WIPE.levels);
    expect(run.party[1].level).toBe(5);
    expect(run.party.every(m => m.hp > 0)).toBe(true);
    // Item-chave e Mega Pedra nunca caem.
    expect(run.bag.expall).toBe(1);
    expect(run.bag.megastone).toBe(1);
    expect(loss.items.length).toBe(2);
    expect(loss.money).toBe(150);
    expect(run.money).toBe(850);
    expect(loss.points).toBe(wipePoints({...run, points: {gyms: 300}} as RunState));
    expect(loss.points).toBeLessThanOrEqual(WIPE.pointsMax);
    expect(seasonPoints(run)).toBe(300 - loss.points);
    expect(run.pointLog!.at(-1)!.pts).toBe(-loss.points);
  });

  it('pontos nunca ficam negativos', () => {
    const run = runWith(4);
    applyWipe(run, null, 'Brock');
    expect(seasonPoints(run)).toBe(0);
  });
});

describe('derrota no ginásio', () => {
  it('sem cura depois: quem caiu volta com 1 HP; não mexe em pontos, dinheiro nem mochila', () => {
    const run = runWith(100);
    run.party[0].hp = 0;
    const full = run.party[1].hp;
    const loss = applyGymLoss(run, 'Brock');
    expect(run.party[0].hp).toBe(1);
    expect(run.party[1].hp).toBe(full);
    expect(loss).toMatchObject({gym: true, money: 0, points: 0, levels: 0});
    expect(run.money).toBe(1000);
    expect(seasonPoints(run)).toBe(100);
    expect(run.bag.pokeball).toBe(5);
  });
});
