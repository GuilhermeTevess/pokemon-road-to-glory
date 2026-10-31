import {describe, expect, it} from 'vitest';
import {compatibility, hatch, makeEgg} from '../src/game/daycare';
import {entryOf} from '../src/game/meta';
import type {Collection} from '../src/game/meta';

const col = (): Collection => ({version: 1, entries: {}, runs: []});

describe('creche', () => {
  it('egg groups e Ditto', () => {
    expect(compatibility('Charmeleon', 'Bulbasaur')).toEqual({ok: true, child: 'charmander'});
    expect(compatibility('Pidgey', 'Charmander').ok).toBe(false);
    expect(compatibility('Ditto', 'Magnemite')).toEqual({ok: true, child: 'magnemite'});
    expect(compatibility('Magnemite', 'Voltorb').ok).toBe(false);
    expect(compatibility('Mewtwo', 'Ditto').ok).toBe(false);
  });
  it('Laço do Destino, Pedra Eterna e item Power', () => {
    const c = col();
    const mom = entryOf(c, 'Charmander');
    mom.caught = 1;
    mom.bestIvs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
    mom.natures = ['Adamant'];
    mom.nature = 'Adamant';
    const dad = entryOf(c, 'Bulbasaur');
    dad.caught = 1;
    dad.bestIvs = {hp: 30, atk: 30, def: 30, spa: 30, spd: 30, spe: 30};
    const egg = makeEgg(c, 'Charmander', 'Bulbasaur', ['everstone', 'destinyknot'])!;
    expect(egg.species).toBe('Charmander');
    expect(egg.nature).toBe('Adamant');
    expect(Object.values(egg.ivs).filter(v => v >= 30).length).toBeGreaterThanOrEqual(5);
    const egg2 = makeEgg(c, 'Charmander', 'Bulbasaur', [null, 'poweranklet'])!;
    expect(egg2.ivs.spe).toBe(30);
    const baby = hatch(egg, 20);
    expect(baby.level).toBe(20);
    expect(baby.nature).toBe('Adamant');
  });
});

describe('gênero', () => {
  it('precisa de mãe fêmea e pai macho', async () => {
    const {registerCatch} = await import('../src/game/meta');
    const {createMon} = await import('../src/game/mon');
    const c = col();
    const f = createMon('Charmander', {level: 5});
    f.gender = 'F';
    registerCatch(c, f);
    const m = createMon('Bulbasaur', {level: 5});
    m.gender = 'F';
    registerCatch(c, m);
    expect(compatibility('Charmander', 'Bulbasaur', c).ok).toBe(false);
    m.gender = 'M';
    registerCatch(c, m);
    expect(compatibility('Charmander', 'Bulbasaur', c).ok).toBe(true);
    expect(compatibility('Bulbasaur', 'Charmander', c).ok).toBe(false);
  });
});
