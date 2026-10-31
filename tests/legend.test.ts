import {describe, expect, it} from 'vitest';
import {Dex} from '@pkmn/sim';
import {LEGENDS} from '../src/data/legends';
import {REGIONS} from '../src/data/regions';
import {legendChance, legendTeam, addTrail} from '../src/game/legend';
import {createMon} from '../src/game/mon';
import {simulateMatch} from '../src/game/tournament';
import type {RunState} from '../src/game/types';

describe('lendas', () => {
  it('toda região tem lenda, e espécies e golpes existem', () => {
    for (const r of REGIONS) expect(LEGENDS.some(l => l.region === r.id)).toBe(true);
    for (const l of LEGENDS) {
      for (const m of l.team) {
        expect(Dex.species.get(m.species).exists, m.species).toBe(true);
        for (const mv of m.moves) expect(Dex.moves.get(mv).exists, `${l.name}: ${mv}`).toBe(true);
      }
    }
  });

  it('time acompanha o jogador: tamanho mínimo 3 e nível do mais forte +3', () => {
    const party = [createMon('Pidgey', {level: 12}), createMon('Rattata', {level: 20})];
    const team = legendTeam(LEGENDS[0], party);
    expect(team).toHaveLength(3);
    expect(team.every(m => m.level === 23)).toBe(true);
  });

  it('rastro sobe e a chance tem teto de 40%', () => {
    const run = {region: 'kanto'} as RunState;
    addTrail(run, 25);
    expect(legendChance(run)).toBeCloseTo(0.25);
    addTrail(run, 50);
    expect(legendChance(run)).toBeCloseTo(0.4);
  });

  it('batalha de lenda roda no simulador', () => {
    for (const l of LEGENDS) {
      const party = [createMon('Charizard', {level: 50}), createMon('Blastoise', {level: 50}), createMon('Venusaur', {level: 50})];
      const r = simulateMatch(party, legendTeam(l, party), 'Ju', l.name);
      expect([0, 1]).toContain(r.winner);
    }
  }, 60000);
});
