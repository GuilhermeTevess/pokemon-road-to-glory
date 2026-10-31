import {describe, expect, it} from 'vitest';
import {BIOMES, HIDDEN_BIOMES} from '../src/data/biomes';
import {biomeOdds} from '../src/game/guide';
import {botScout, glimpse, SCOUT_FIGHTS, SCOUT_PER_FIGHT} from '../src/game/scout';
import type {WorldBot} from '../src/game/world';

describe('guia dos biomas', () => {
  it('as chances de cada bioma somam 100%', () => {
    for (const b of [...BIOMES, ...HIDDEN_BIOMES])
      for (const wave of [1, 5, 20, 80]) {
        const total = biomeOdds(b.id, wave, 'kanto').reduce((a, r) => a + r.chance, 0);
        expect(total).toBeCloseTo(1, 6);
      }
  });
  it('sem raros antes da ronda 4', () => {
    expect(biomeOdds('forest', 2, 'kanto').some(r => r.rarity === 'rare' && r.chance > 0)).toBe(false);
  });
});

describe('névoa do PokéPC', () => {
  const bot = {
    name: 'Teste',
    team: ['Pikachu', 'Charizard', 'Gengar', 'Lapras', 'Snorlax', 'Dragonite'],
    usage: {Pikachu: 30, Charizard: 30, Gengar: 30, Lapras: 30, Snorlax: 30, Dragonite: 30},
    fights: [1, 2, 3, 4, 5].map(i => ({vs: `Líder ${i}`, won: true, kind: 'gym' as const, wave: i * 5, seen: ['Pikachu', 'Charizard', 'Gengar', 'Lapras', 'Snorlax', 'Dragonite']})),
  } as unknown as WorldBot;

  it('mostra só as últimas lutas públicas, com no máximo 2 destaques', () => {
    const r = botScout(bot);
    expect(r.matches.length).toBe(SCOUT_FIGHTS);
    for (const m of r.matches) expect(m.seen.length).toBeLessThanOrEqual(SCOUT_PER_FIGHT);
    expect(r.seen.length).toBeLessThanOrEqual(SCOUT_FIGHTS * SCOUT_PER_FIGHT);
  });
  it('quem você enfrentou aparece primeiro', () => {
    const r = botScout(bot, ['Dragonite']);
    expect(r.seen[0]).toMatchObject({species: 'Dragonite', faced: true});
  });
  it('destaques são sempre os mesmos para a mesma luta', () => {
    expect(glimpse(['A', 'B', 'C', 'D'], 'x')).toEqual(glimpse(['A', 'B', 'C', 'D'], 'x'));
  });
  it('lutas privadas não entram', () => {
    const r = botScout({...bot, fights: [{vs: 'x', won: true, kind: 'boss', wave: 3, seen: ['Mew']}]} as WorldBot);
    expect(r.seen).toEqual([]);
  });
});
