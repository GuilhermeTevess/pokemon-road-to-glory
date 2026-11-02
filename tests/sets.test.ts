import {describe, expect, it} from 'vitest';
import {buildSet} from '../src/game/sets';
import {PLAYABLE, dex, species} from '../src/data/dex';

describe('sets do Quickplay', () => {
  it('atacante físico vem com golpes físicos do próprio tipo e natureza certa', () => {
    const set = buildSet(species('Garchomp'));
    const moves = set.moves.map(m => dex.moves.get(m));
    expect(moves.some(m => m.type === 'Dragon' && m.category === 'Physical')).toBe(true);
    expect(moves.some(m => m.type === 'Ground' && m.category === 'Physical')).toBe(true);
    expect(['Jolly', 'Adamant']).toContain(set.nature);
    expect(set.evs.atk).toBe(252);
  });

  it('especial vem com natureza especial', () => {
    const set = buildSet(species('Gengar'));
    expect(['Timid', 'Modest']).toContain(set.nature);
    expect(set.moves.map(m => dex.moves.get(m)).filter(m => m.category === 'Special').length).toBeGreaterThanOrEqual(3);
  });

  it('ninguém fica sem golpes e não repete', () => {
    for (const s of PLAYABLE) {
      const set = buildSet(s);
      expect(set.moves.length, s.name).toBeGreaterThan(0);
      expect(new Set(set.moves).size, s.name).toBe(set.moves.length);
    }
  });
});
