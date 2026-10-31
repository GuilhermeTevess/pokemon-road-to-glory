import {describe, expect, it} from 'vitest';
import {BattleController} from '../src/game/battle';
import {generateEncounter} from '../src/game/encounters';
import {createMon, gainExp, expYield} from '../src/game/mon';
import {BIOMES, biomePools} from '../src/data/biomes';
import {BASE_STAGE, defensiveMatchups, movesAtLevel, species} from '../src/data/dex';

describe('dados', () => {
  it('tem iniciais de todas as gerações', () => {
    const gens = new Set(BASE_STAGE.map(s => s.gen));
    for (let g = 1; g <= 9; g++) expect(gens.has(g)).toBe(true);
  });
  it('todo bioma tem Pokémon comuns e lendários', () => {
    for (const b of BIOMES) {
      const p = biomePools(b);
      expect(p.common.length + p.uncommon.length, b.id).toBeGreaterThan(0);
      expect(p.legendary.length, b.id).toBeGreaterThan(0);
    }
  });
  it('golpes por nível', () => {
    expect(movesAtLevel(species('Charmander'), 5)).toContain('ember');
  });
  it('fraquezas', () => {
    const m = defensiveMatchups(['Grass', 'Steel']);
    expect(m.x4).toEqual(['Fire']);
    expect(m.immune).toEqual(['Poison']);
  });
});

describe('batalha', () => {
  it('roda batalhas completas contra selvagens', () => {
    for (let wave = 1; wave <= 30; wave++) {
      const biome = BIOMES[wave % BIOMES.length].id;
      const party = [createMon('Charmander', {level: 40}), createMon('Squirtle', {level: 40})];
      const enc = generateEncounter(wave, biome, false);
      const ctl = new BattleController(party, enc);
      const evs = ctl.initialEvents();
      expect(evs.some(e => e.switchIn?.side === 'p2')).toBe(true);
      let turns = 0;
      while (!ctl.ended && turns++ < 200) {
        if (ctl.mustSwitch) {
          const next = party.find(m => m.uid !== ctl.activeUid() && ctl.battle.p1.pokemon.some(p => !p.fainted));
          ctl.chooseSwitch(next!.uid);
          continue;
        }
        if (turns === 2) ctl.useHealItem('potion', party[0].uid);
        else if (turns === 3) ctl.throwBall('pokeball');
        else ctl.chooseMove(1);
      }
      expect(ctl.ended).toBe(true);
      ctl.syncParty(party);
      if (ctl.won) {
        const r = gainExp(party[0], expYield(enc.mon, enc.boss));
        expect(r.levelsGained).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
