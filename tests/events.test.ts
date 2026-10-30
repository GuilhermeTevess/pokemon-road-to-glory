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
    expect([...kinds].sort()).toEqual(['berries', 'house', 'hurt', 'merchant', 'rival', 'seer']);
  });
  it('vidente e rival', () => {
    expect(upcomingEncounters(run(6), 3)).toHaveLength(3);
    const enc = rivalEncounter(run(6), 'Bia');
    expect(enc.trainer).toBe('Bia');
    expect(enc.boss).toBe(false);
  });
});
