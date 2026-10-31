import {describe, expect, it} from 'vitest';
import {species} from '../src/data/dex';
import {getRegion, regionWeight} from '../src/data/regions';
import {generateEncounter} from '../src/game/encounters';
import {lineRoot} from '../src/game/meta';

describe('regiões', () => {
  it('formas regionais só aparecem na região delas', () => {
    expect(regionWeight(species('Vulpix-Alola'), getRegion('alola'))).toBe(3);
    expect(regionWeight(species('Vulpix-Alola'), getRegion('kanto'))).toBe(0);
    expect(regionWeight(species('Vulpix'), getRegion('kanto'))).toBe(3);
    expect(regionWeight(species('Vulpix'), getRegion('galar'))).toBe(1);
  });

  it('chefes são da geração da região', () => {
    const r = getRegion('hoenn');
    for (let i = 0; i < 15; i++) {
      const enc = generateEncounter(20, 'lake', false, 0, 'hoenn');
      expect(enc.boss).toBe(true);
      // O chefe pode ter evoluído: confere o primeiro estágio da linha.
      const num = species(lineRoot(enc.mon.species)).num;
      expect(num).toBeGreaterThanOrEqual(r.nums[0]);
      expect(num).toBeLessThanOrEqual(r.nums[1]);
    }
  });

  it('formas de outras regiões nunca aparecem como selvagens', () => {
    for (let i = 0; i < 200; i++) {
      const enc = generateEncounter(8, 'snow', false, 0, 'kanto');
      expect(species(enc.mon.species).forme).not.toBe('Alola');
    }
  });
});
