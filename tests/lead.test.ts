import {describe, expect, it} from 'vitest';
import {asksLead, leadAdvice} from '../src/game/lead';
import {createMon} from '../src/game/mon';
import type {Encounter} from '../src/game/types';

const mon = (name: string, moves: string[]) => ({...createMon(name, {level: 20}), moves});

describe('Quer trocar o Pokémon?', () => {
  it('fogo contra grama é boa escolha; água contra grama não', () => {
    const fire = leadAdvice(mon('Charmander', ['ember', 'scratch']), ['Bulbasaur']);
    const water = leadAdvice(mon('Squirtle', ['watergun', 'tackle']), ['Bulbasaur']);
    expect(fire.attack).toBe(2);
    expect(fire.move).toBe('Ember');
    expect(water.attack).toBe(1);
    expect(water.defend).toBe(2);
    expect(fire.score).toBeGreaterThan(water.score);
  });
  it('sem golpe de dano conta como neutro', () => {
    expect(leadAdvice(mon('Abra', ['teleport']), ['Rattata']).attack).toBe(1);
  });
  it('não pergunta no torneio nem com um Pokémon só', () => {
    const a = mon('Charmander', ['ember']);
    const b = mon('Squirtle', ['watergun']);
    const enc: Encounter = {mon: mon('Bulbasaur', ['tackle']), rarity: 'common', boss: false};
    expect(asksLead(enc, [a, b])).toBe(true);
    expect(asksLead({...enc, tournament: true}, [a, b])).toBe(false);
    expect(asksLead(enc, [a, {...b, hp: 0}])).toBe(false);
  });
});
