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

  it('rondas livres: dentro da estadia, sem torneio, chefe ou outro ginásio', () => {
    const run = {wave: 22, regionLeft: 10, gyms: [{id: 'kanto-1', wave: 25}]} as RunState;
    expect(gymWaves(run)).toEqual([23, 24, 26, 27, 28, 29, 31, 32]);
  });

  it('time cresce com as insígnias e o ás é o mais forte', () => {
    const run = {wave: 30, region: 'kanto', party: [createMon('Charmander', {level: 30})], badges: []} as unknown as RunState;
    const a = gymEncounter(gymsOf('kanto')[0], run);
    expect(a.team).toHaveLength(3);
    expect(a.team!.at(-1)!.level).toBeGreaterThan(a.team![0].level);
    run.badges = ['kanto-2', 'kanto-3', 'kanto-4'];
    expect(gymEncounter(gymsOf('kanto')[4], run).team).toHaveLength(4);
  });
});
