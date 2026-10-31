import {describe, expect, it} from 'vitest';
import {DEFAULT_RULES, enforceRules, roundOf, roundsOf, standings, waveStep} from '../src/game/career';
import type {PlayerDoc} from '../src/game/career';
import {createMon} from '../src/game/mon';
import type {RunState} from '../src/game/types';

const runWith = (rules: Partial<typeof DEFAULT_RULES>, party: string[], level = 30) =>
  ({wave: 10, party: party.map(s => createMon(s, {level})), box: [], career: {code: 'X', season: 1, rules: {...DEFAULT_RULES, ...rules}}}) as unknown as RunState;

describe('carreira', () => {
  it('temporadas curtas pulam rondas sem perder torneios e chefes', () => {
    expect(waveStep(runWith({rounds: 24}, []))).toBe(5);
    expect(waveStep(runWith({rounds: 60}, []))).toBe(2);
    expect(waveStep(null)).toBe(1);
    const r = runWith({rounds: 24}, []);
    r.wave = 30;
    expect(roundOf(r)).toBe(6);
    expect(roundsOf(r)).toBe(24);
  });

  it('manda o lendário extra para a caixa e respeita o nível máximo', () => {
    const r = runWith({legendCap: 1, levelCap: 50}, ['Mewtwo', 'Lugia', 'Pikachu'], 70);
    const notes = enforceRules(r);
    expect(r.party.map(m => m.species)).toEqual(['Mewtwo', 'Pikachu']);
    expect(r.box.map(m => m.species)).toEqual(['Lugia']);
    expect(notes.length).toBe(1);
    expect([...r.party, ...r.box].every(m => m.level === 50)).toBe(true);
  });

  it('classifica pela soma das temporadas', () => {
    const p = (id: string, banked: number, points: number) => ({id, banked, points, season: 1, round: 0}) as PlayerDoc;
    expect(standings([p('a', 100, 10), p('b', 50, 100), p('c', 0, 0)]).map(x => x.id)).toEqual(['b', 'a', 'c']);
  });
});
