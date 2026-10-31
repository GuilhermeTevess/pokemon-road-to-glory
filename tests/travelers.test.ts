import {describe, expect, it} from 'vitest';
import {BIOMES, HIDDEN_BIOMES, biomePools, getBiome} from '../src/data/biomes';
import {species} from '../src/data/dex';
import {HINTS} from '../src/data/hints';
import {REGIONS} from '../src/data/regions';
import {generateEncounter} from '../src/game/encounters';
import {hintHere, rollBiome, travelerEvent} from '../src/game/travelers';
import type {RunState} from '../src/game/types';

const run = (extra: Partial<RunState> = {}) => ({wave: 20, region: 'hoenn', biome: 'lake', money: 9999, bag: {potion: 1, pokeball: 2}, ...extra}) as RunState;

describe('viajantes e biomas ocultos', () => {
  it('dicas apontam para espécies, regiões e biomas que existem', () => {
    for (const h of HINTS) {
      expect(species(h.species).exists, h.species).toBe(true);
      expect(REGIONS.some(r => r.id === h.region)).toBe(true);
      expect(getBiome(h.biome).id, h.biome).toBe(h.biome);
    }
  });

  it('cada região tem um bioma oculto com moradores', () => {
    for (const r of REGIONS) {
      const b = HIDDEN_BIOMES.find(x => x.region === r.id)!;
      expect(b, r.id).toBeTruthy();
      const p = biomePools(b);
      expect(Object.values(p).flat().length).toBeGreaterThan(3);
      expect(p.legendary.length).toBeGreaterThan(0);
      expect(() => generateEncounter(25, b.id, true, 0, r.id)).not.toThrow();
    }
    expect(BIOMES.some(b => b.region)).toBe(false);
  });

  it('com a dica, o bioma oculto cai bem mais', () => {
    let hits = 0;
    for (let i = 0; i < 400; i++) if (rollBiome(run({diary: ['rayquaza']})) === 'skypillar') hits++;
    expect(hits).toBeGreaterThan(120);
    hits = 0;
    for (let i = 0; i < 400; i++) if (rollBiome(run()) === 'skypillar') hits++;
    expect(hits).toBeLessThan(40);
  });

  it('viajante pede ajuda e oferece uma dica nova', () => {
    const ev = travelerEvent(run({diary: ['kyogre']}));
    expect(ev?.kind).toBe('traveler');
    if (ev?.kind === 'traveler') expect(ev.hint).not.toBe('kyogre');
    expect(hintHere(run({diary: ['kyogre'], biome: 'sea'}))?.species).toBe('Kyogre');
  });
});
