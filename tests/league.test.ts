import {describe, expect, it} from 'vitest';
import {checkAchievements} from '../src/game/achievements';
import {addPoints, finishSeason, leagueOf, overallRanking, rollRivalPoints, seasonPoints, seasonRanking} from '../src/game/league';
import {careerOf} from '../src/game/meta';
import type {Collection} from '../src/game/meta';
import type {RunState} from '../src/game/types';

const col = () => ({version: 1, entries: {}, runs: []}) as unknown as Collection;
const me = {name: 'Ju'};

describe('ranking e conquistas', () => {
  it('pontos somam na temporada e na fama', () => {
    const c = col();
    const run = {wave: 60, party: [], region: 'kanto'} as unknown as RunState;
    addPoints(run, c, 'legends', 150);
    addPoints(run, c, 'gyms', 30);
    addPoints(run, c, 'tournaments', 200, false);
    expect(seasonPoints(run)).toBe(380);
    expect(careerOf(c).fame).toBe(180);
  });

  it('ranking da temporada e geral com os rivais', () => {
    const c = col();
    const run = {wave: 120, party: [], region: 'kanto', rivalPoints: rollRivalPoints(c), points: {tournaments: 5000}} as unknown as RunState;
    const rows = seasonRanking(c, run, me, true);
    expect(rows).toHaveLength(leagueOf(c).npcs.length + 1);
    expect(rows[0].player).toBe(true);
    const rec = finishSeason(c, run, me);
    expect(rec.rank).toBe(1);
    expect(overallRanking(c, me)[0].player).toBe(true);
    expect(leagueOf(c).seasons).toHaveLength(1);
  });

  it('conquistas marcam uma vez só', () => {
    const c = col();
    c.legends = {ash: 1};
    const first = checkAchievements(c, null);
    expect(first).toContain('Vencer Ash');
    expect(checkAchievements(c, null)).toEqual([]);
  });
});
