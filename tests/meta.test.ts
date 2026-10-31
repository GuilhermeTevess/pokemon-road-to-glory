import {describe, expect, it, vi} from 'vitest';
import {BattleController} from '../src/game/battle';
import {createMon} from '../src/game/mon';
import {
  applyEntry, baseCost, entryOf, heartsOf, lineSpecies, loadCollection, registerCatch, startMoveOptions, teamCost,
} from '../src/game/meta';
import type {Collection} from '../src/game/meta';

const empty = (): Collection => ({version: 1, entries: {}, runs: []});

describe('coleção', () => {
  it('save antigo sem os campos novos continua funcionando', () => {
    const old = {version: 1, entries: {pidgey: {caught: 2, bestIvs: {hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1}, shiny: false, firstCaughtAt: 1}}, runs: [{endedAt: 1, wave: 12, starter: 'Charmander', result: 'lost', party: []}]};
    vi.stubGlobal('localStorage', {getItem: () => JSON.stringify(old), setItem() {}, removeItem() {}});
    const c = loadCollection('x');
    expect(c.stats?.bestWave).toBe(12);
    expect(c.stats?.caught).toBe(2);
    expect(entryOf(c, 'Pidgeotto').candies).toBe(0);
    vi.unstubAllGlobals();
  });
  it('capturar dá doces e desbloqueia nature e habilidade', () => {
    const c = empty();
    const mon = createMon('Charmeleon', {level: 20});
    const r = registerCatch(c, mon);
    expect(r.duplicate).toBe(false);
    expect(r.candies).toBe(3);
    const e = entryOf(c, 'Charmander');
    expect(e.natures).toEqual([mon.nature]);
    expect(e.abilities).toEqual([mon.ability]);
    expect(registerCatch(c, createMon('Charmander', {level: 5})).candies).toBe(5);
  });
  it('inicial usado (caught 0) não conta como repetido na primeira captura', () => {
    const c = empty();
    entryOf(c, 'Squirtle');
    expect(registerCatch(c, createMon('Squirtle', {level: 5})).duplicate).toBe(false);
  });
  it('linha evolutiva e custo', () => {
    expect(lineSpecies('Charizard').map(s => s.name)).toEqual(['Charmander', 'Charmeleon', 'Charizard']);
    expect(baseCost('Pidgey')).toBe(1);
    expect(baseCost('Charmander')).toBe(3);
    expect(baseCost('Dratini')).toBe(7);
    const c = empty();
    entryOf(c, 'Dratini').costCut = 2;
    expect(teamCost(c, 'Dratini')).toBe(5);
  });
  it('golpe inicial liberado entra no Pokémon', () => {
    const c = empty();
    expect(startMoveOptions('Charmander').some(m => m.id === 'flamethrower')).toBe(true);
    const e = entryOf(c, 'Charmander');
    e.moves = ['flamethrower'];
    e.startMove = 'flamethrower';
    const mon = createMon('Charmander', {level: 5});
    applyEntry(c, mon);
    expect(mon.moves).toContain('flamethrower');
  });
  it('corações', () => {
    expect(heartsOf({caught: 0, bestIvs: {} as never, shiny: false, firstCaughtAt: 0, heartPts: 60})).toBe(2);
  });
});

describe('amizade na batalha', () => {
  it('com 5 corações às vezes aguenta com 1 HP', () => {
    let endured = 0;
    for (let i = 0; i < 60; i++) {
      const me = createMon('Magikarp', {level: 5});
      const wild = createMon('Mewtwo', {level: 100});
      wild.moves = ['psystrike'];
      const ctl = new BattleController([me], {mon: wild, rarity: 'legendary', boss: false}, {[me.uid]: 5});
      ctl.initialEvents();
      const evs = ctl.chooseMove(0);
      if (evs.some(e => e.text?.includes('amizade'))) endured++;
    }
    expect(endured).toBeGreaterThan(0);
    expect(endured).toBeLessThan(30);
  });
});

describe('Parte B', () => {
  it('Tutor nunca repete e o garantido sempre acerta', async () => {
    const {tutorRoll} = await import('../src/game/meta');
    const c = empty();
    const e = entryOf(c, 'Charmander');
    e.candies = 1000;
    e.natures = ['Timid'];
    const r1 = tutorRoll(c, 'Charmander', 'nature', 'Adamant', 'sure', 0.99);
    expect(r1).toEqual({got: 'Adamant', wanted: true});
    const r2 = tutorRoll(c, 'Charmander', 'nature', 'Jolly', 'basic', 0.99);
    expect(r2?.wanted).toBe(false);
    expect(['Timid', 'Adamant', 'Jolly']).not.toContain(r2?.got);
    expect(new Set(e.natures).size).toBe(e.natures.length);
    expect(tutorRoll(c, 'Charmander', 'ability', 'Solar Power', 'basic')).toBeNull();
    expect(tutorRoll(c, 'Charmander', 'ability', 'Solar Power', 'sure')?.got).toBe('Solar Power');
  });
  it('EVs: banco respeita 510 e 252 por atributo', async () => {
    const {bankEvs, allocateEvs, addStatEvs, evTotal} = await import('../src/game/meta');
    const c = empty();
    expect(bankEvs(c, 'Pidgey', 600)).toBe(510);
    const e = entryOf(c, 'Pidgey');
    allocateEvs(e, 'spe', 300);
    expect(e.evs.spe).toBe(252);
    allocateEvs(e, 'atk', 300);
    expect(evTotal(e.evs)).toBe(504);
    expect(e.evBank).toBe(6);
    expect(addStatEvs(c, 'Pidgey', 'hp', 10)).toBe(6);
    expect(e.evBank).toBe(0);
    const mon = createMon('Pidgey', {level: 5});
    applyEntry(c, mon);
    expect(mon.evs.spe).toBe(252);
  });
});
