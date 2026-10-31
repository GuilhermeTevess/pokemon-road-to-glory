import {describe, expect, it} from 'vitest';
import {Dex} from '@pkmn/sim';
import {RIVALS} from '../src/data/rivals';
import {CHARACTERS, CLASSES, PROTAGONISTS} from '../src/data/trainerSprites';

describe('rivais', () => {
  it('espécies existem e todo rival tem sprite', () => {
    const all = new Set([...PROTAGONISTS, ...CHARACTERS, ...CLASSES]);
    for (const r of RIVALS) {
      expect(all.has(r.avatar), `${r.name}: ${r.avatar}`).toBe(true);
      for (const s of r.team) expect(Dex.species.get(s).exists, `${r.name}: ${s}`).toBe(true);
    }
  });
});
