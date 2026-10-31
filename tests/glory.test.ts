import {describe, expect, it} from 'vitest';
import {applyPerks, buyUpgrade, discounted, gloryFor, perksOf, teamBudget} from '../src/game/glory';
import type {Collection} from '../src/game/meta';
import type {RunState} from '../src/game/types';

describe('Glória', () => {
  it('ganha por ronda e compra melhorias', () => {
    expect(gloryFor(30, 'stageClear')).toBe(65);
    expect(gloryFor(2, 'abandoned')).toBe(0);
    const c: Collection = {version: 1, entries: {}, runs: [], glory: 40};
    expect(teamBudget(c)).toBe(6);
    expect(buyUpgrade(c, 'budget')).toBe(true);
    expect(teamBudget(c)).toBe(7);
    expect(c.glory).toBe(10);
    expect(buyUpgrade(c, 'budget')).toBe(false);
  });
  it('aplica no começo da run', () => {
    const run = {money: 500, bag: {pokeball: 5, potion: 3}} as unknown as RunState;
    applyPerks(run, {...perksOf({version: 1, entries: {}, runs: []}), money: 2, balls: 3, discount: 2});
    expect(run.money).toBe(1000);
    expect(run.bag).toEqual({pokeball: 9, potion: 5, greatball: 1});
    expect(discounted(run, 1000)).toBe(800);
  });
});
