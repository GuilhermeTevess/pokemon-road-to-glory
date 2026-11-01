import {describe, expect, it} from 'vitest';
import {Dex} from '@pkmn/sim';
import {GYMS, GYM_BIOME, gymsOf} from '../src/data/gyms';
import {REGIONS} from '../src/data/regions';
import {getBiome} from '../src/data/biomes';
import {gymEncounter, gymWaves} from '../src/game/gym';
import {createMon} from '../src/game/mon';
import type {RunState} from '../src/game/types';

describe('ginásios', () => {
  it('8 por região (7 provas em Alola), com espécies que existem', () => {
    for (const r of REGIONS) expect(gymsOf(r.id)).toHaveLength(r.id === 'alola' ? 7 : 8);
    for (const g of GYMS) {
      for (const s of g.team) expect(Dex.species.get(s).exists, `${g.leader}: ${s}`).toBe(true);
      expect(getBiome(GYM_BIOME[g.type]).id).toBe(GYM_BIOME[g.type]);
    }
  });

  it('rondas livres: dentro da estadia, sem torneio nem outro ginásio', () => {
    const run = {wave: 22, regionLeft: 10, gyms: [{id: 'kanto-1', wave: 25}]} as RunState;
    expect(gymWaves(run)).toEqual([23, 24, 26, 27, 28, 29, 31, 32]);
  });

  it('ronda de chefe (40) pode virar ginásio; ronda de torneio (60) não', () => {
    expect(gymWaves({wave: 37, regionLeft: 5} as RunState)).toEqual([38, 39, 40, 41, 42]);
    expect(gymWaves({wave: 57, regionLeft: 5} as RunState)).toEqual([58, 59, 61, 62]);
  });

  it('começa fácil e cresce com insígnias, nível e tamanho do time', () => {
    const me = {name: 'Ju', fame: 0, worlds: 0, titles: 0};
    const run = {wave: 10, region: 'kanto', party: [createMon('Charmander', {level: 12})], badges: []} as unknown as RunState;
    const a = gymEncounter(gymsOf('kanto')[0], run, me);
    expect(a.team).toHaveLength(2);
    expect(a.team!.at(-1)!.level).toBeGreaterThan(a.team![0].level);
    // Mais insígnias, time maior e mais forte: o líder cresce junto.
    run.badges = ['kanto-2', 'kanto-3', 'kanto-4', 'kanto-5', 'kanto-6'];
    run.party = ['Charizard', 'Blastoise', 'Venusaur', 'Pikachu', 'Snorlax', 'Lapras'].map(n => createMon(n, {level: 50}));
    const b = gymEncounter(gymsOf('kanto')[7], run, me);
    expect(b.team).toHaveLength(5);
    expect(b.team![0].level).toBeGreaterThan(a.team![0].level + 20);
    // Nível alto: o ás chega evoluído.
    expect(b.team!.at(-1)!.species).toBe('Rhyperior');
  });
});
