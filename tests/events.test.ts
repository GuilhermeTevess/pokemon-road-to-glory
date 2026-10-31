import {describe, expect, it} from 'vitest';
import {rivalEncounter, rollEvent, shouldRollEvent, tutorMoves, tutorPrice, upcomingEncounters} from '../src/game/events';
import {MAX_GLOW, loadCollection, lineRoot, registerStarter, shinyGlow, starterIvs} from '../src/game/meta';
import {createMon} from '../src/game/mon';
import type {RunState} from '../src/game/types';
import {newWorld, stepWorld} from '../src/game/world';
import {species} from '../src/data/dex';

function run(wave: number): RunState {
  return {
    version: 1, id: 'r', startedAt: 0, wave, biome: 'plains', phase: 'reward', party: [createMon('Charmander', {level: 10})], box: [],
    bag: {pokeball: 3, potion: 2}, money: 0, mapReady: false, incenseWaves: 0, pending: [], rewardOptions: [], rerolls: 0, log: [],
    stats: {defeated: 0, caught: 0, fled: 0},
  };
}

describe('eventos', () => {
  it('não aparece antes de chefe nem duas vezes na mesma ronda', () => {
    expect(shouldRollEvent(run(9))).toBe(false);
    const r = run(4);
    r.lastEventWave = 4;
    expect(shouldRollEvent(r)).toBe(false);
  });
  it('sorteia todos os tipos', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 300; i++) kinds.add(rollEvent(run(6)).kind);
    expect([...kinds].sort()).toEqual(['berries', 'house', 'hurt', 'life', 'merchant', 'place', 'rival', 'seer', 'traveler', 'tutor']);
  });
  it('o lugar muda a cena: fantasma no pântano, ninho nos campos', () => {
    const swamp = {...run(20), biome: 'swamp'};
    const places = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const ev = rollEvent(swamp);
      if (ev.kind === 'place') places.add(ev.theme);
      if (ev.kind === 'place' && ev.theme === 'haunted') expect(species(ev.mon!.species).types).toContain('Ghost');
    }
    expect(places.has('haunted')).toBe(true);
  });
  it('jornal com notícias do mundo e fã para quem é famoso', () => {
    const r = run(30);
    r.world = newWorld();
    stepWorld(r.world, 30);
    const kinds = new Set<string>();
    for (let i = 0; i < 400; i++) kinds.add(rollEvent(r, {fame: 500}).kind);
    expect(kinds.has('news')).toBe(true);
    expect(kinds.has('fan')).toBe(true);
  });
  it('vidente e rival', () => {
    expect(upcomingEncounters(run(6), 3)).toHaveLength(3);
    const enc = rivalEncounter(run(6), 'Bia');
    expect(enc.trainer).toBe('Bia');
    expect(enc.boss).toBe(false);
  });
});

describe('mega', () => {
  it('Charizard com Charizardite mega-evolui sozinho', async () => {
    const {BattleController} = await import('../src/game/battle');
    const {megaStonesFor} = await import('../src/data/items');
    expect(megaStonesFor('Charizard').map(i => i.id).sort()).toEqual(['charizarditex', 'charizarditey']);
    const me = createMon('Charizard', {level: 50});
    me.item = 'charizarditey';
    const wild = createMon('Pidgey', {level: 5});
    const ctl = new BattleController([me], {mon: wild, rarity: 'common', boss: false});
    ctl.initialEvents();
    const evs = ctl.chooseMove(1, true);
    expect(evs.some(e => e.forme?.species === 'Charizard-Mega-Y')).toBe(true);
  });
});

describe('mega própria', () => {
  it('linha do Charmander tem as duas pedras', async () => {
    const {lineMegaStones} = await import('../src/game/meta');
    expect(lineMegaStones('Charmander').map(i => i.id).sort()).toEqual(['charizarditex', 'charizarditey']);
    expect(lineMegaStones('Pidgey').map(i => i.id)).toEqual(['pidgeotite']);
    expect(lineMegaStones('Rattata')).toEqual([]);
  });
});

describe('professor de golpes, inicial e shiny', () => {
  it('ensina golpes que o Pokémon aprende, mais caros quando fortes', () => {
    const blaziken = createMon('Blaziken', {level: 40});
    const moves = tutorMoves(blaziken);
    expect(moves).toContain('closecombat');
    expect(moves.some(m => blaziken.moves.includes(m))).toBe(false);
    const r = run(30);
    expect(tutorPrice(r, 'closecombat')).toBeGreaterThan(tutorPrice(r, 'scratch'));
  });

  it('o inicial guarda nature, habilidade e IVs, e os IVs só sobem', () => {
    const col = loadCollection(null);
    const mon = createMon('Torchic', {level: 5});
    mon.nature = 'Jolly';
    mon.ivs.atk = 31;
    const reg = registerStarter(col, mon);
    expect(reg.newNature).toBe(true);
    const e = col.entries[lineRoot('Torchic')];
    expect(e.natures).toContain('Jolly');
    expect(e.bestIvs.atk).toBe(31);
    for (let i = 0; i < 20; i++) expect(starterIvs(col, 'Torchic')!.atk).toBe(31);
  });

  it('shinies raros brilham mais e o brilho tem teto', () => {
    expect(shinyGlow([{species: 'Pikachu', shiny: false}])).toBe(0);
    expect(shinyGlow([{species: 'Mewtwo', shiny: true}])).toBeGreaterThan(shinyGlow([{species: 'Rattata', shiny: true}]));
    expect(shinyGlow(Array.from({length: 6}, () => ({species: 'Mewtwo', shiny: true})))).toBe(MAX_GLOW);
  });
});
