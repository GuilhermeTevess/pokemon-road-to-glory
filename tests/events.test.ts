import {describe, expect, it} from 'vitest';
import {rivalEncounter, rollEvent, shouldRollEvent, upcomingEncounters} from '../src/game/events';
import {createMon} from '../src/game/mon';
import type {RunState} from '../src/game/types';

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
    expect([...kinds].sort()).toEqual(['berries', 'house', 'hurt', 'merchant', 'rival', 'seer', 'traveler']);
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
