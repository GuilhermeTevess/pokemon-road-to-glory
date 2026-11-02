import {describe, expect, it} from 'vitest';
import {movesFor, stageAt} from '../src/game/mon';
import {rivalTeam} from '../src/game/tournament';
import {legendTeam} from '../src/game/legend';
import {getRival} from '../src/data/rivals';
import {legendsOf} from '../src/data/legends';
import {createMon} from '../src/game/mon';

describe('estágio de evolução pelo nível', () => {
  it('volta para a forma do nível, mas não desfaz evolução por amizade', () => {
    expect(stageAt('Charizard', 28)).toBe('Charmeleon');
    expect(stageAt('Charizard', 12)).toBe('Charmander');
    expect(stageAt('Charizard', 36)).toBe('Charizard');
    expect(stageAt('Gengar', 29)).toBe('Haunter');
    expect(stageAt('Gengar', 45)).toBe('Gengar');
    expect(stageAt('Dragonite', 40)).toBe('Dragonair');
    expect(stageAt('Pikachu', 10)).toBe('Pikachu');
    expect(stageAt('Snorlax', 10)).toBe('Snorlax');
  });

  it('rival da League Cup (ronda 30) não chega com Charizard', () => {
    const trevor = getRival('Trevor')!;
    const team = rivalTeam(trevor, 30, 6, 0);
    expect(team.map(m => m.species)).not.toContain('Charizard');
    expect(team.map(m => m.species)).toContain('Charmeleon');
  });

  it('lenda encontrada cedo usa o estágio do nível, com golpes que ele aprende', () => {
    const ash = legendsOf('kanto').find(l => l.team.some(m => m.species === 'Charizard'))!;
    const team = legendTeam(ash, [createMon('Bulbasaur', {level: 12})]);
    const zard = team.find(m => m.species.startsWith('Char'))!;
    expect(zard.species).toBe('Charmander');
    expect(zard.moves.length).toBeGreaterThan(0);
    expect(team.find(m => m.species === 'Pikachu')).toBeTruthy();
    expect(movesFor('Charmander', ['Flamethrower', 'Air Slash'], 15)).toContain('Flamethrower');
    expect(movesFor('Charmander', ['Flamethrower', 'Air Slash'], 15)).not.toContain('Air Slash');
  });
});
