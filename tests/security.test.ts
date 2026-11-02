import {describe, expect, it} from 'vitest';
import {sanePlayer, snapMon, type PlayerDoc} from '../src/game/career';
import {createMon} from '../src/game/mon';

const legit = (): PlayerDoc => ({
  id: 'abc',
  name: 'Juliana',
  avatar: 'red',
  season: 1,
  round: 3,
  points: 40,
  banked: 0,
  team: [snapMon(createMon('pikachu', {level: 20})), snapMon(createMon('charmander', {level: 100}))],
  tours: {cup: [snapMon(createMon('bulbasaur', {level: 12}))]},
  results: [],
  updatedAt: Date.now(),
});

describe('documentos de outros jogadores', () => {
  it('aceita um jogador normal', () => {
    expect(sanePlayer(legit())).toBe(true);
  });

  it('recusa o que o jogo nunca deixaria existir', () => {
    const p = legit();
    expect(sanePlayer({...p, team: [...p.team, ...p.team, ...p.team, ...p.team]})).toBe(false);
    expect(sanePlayer({...p, team: [{...p.team[0], level: 999}]})).toBe(false);
    expect(sanePlayer({...p, team: [{...p.team[0], moves: ['a', 'b', 'c', 'd', 'e']}]})).toBe(false);
    expect(sanePlayer({...p, team: [{...p.team[0], ivs: {...p.team[0].ivs, atk: 99}}]})).toBe(false);
    expect(sanePlayer({...p, team: [{...p.team[0], evs: {hp: 252, atk: 252, def: 252, spa: 0, spd: 0, spe: 0}}]})).toBe(false);
    expect(sanePlayer({...p, points: Infinity})).toBe(false);
    expect(sanePlayer({...p, points: 1e9})).toBe(false);
    expect(sanePlayer({...p, tours: {cup: [{...p.team[0], level: 500}]}})).toBe(false);
    expect(sanePlayer(null)).toBe(false);
    expect(sanePlayer({id: 'x'})).toBe(false);
  });
});
