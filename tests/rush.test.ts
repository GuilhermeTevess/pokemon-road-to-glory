import {describe, expect, it} from 'vitest';
import {LUCKY_LEVEL, LUCKY_POOL, RUSH_MODES, drawPairs, giveMegaStone, rollLucky, rushMon, rushPool} from '../src/game/rush';
import {isLegendary, species} from '../src/data/dex';
import {BattleController} from '../src/game/battle';

describe('rush', () => {
  it('todos os modos têm Pokémon suficientes', () => {
    for (const m of RUSH_MODES) expect(rushPool(m.id).length, m.id).toBeGreaterThanOrEqual(12);
  });

  it('são 8 modos (4 em cima, 4 embaixo)', () => {
    expect(RUSH_MODES.length).toBe(8);
  });

  it('Misturado traz normais, megas e lendários', () => {
    let legends = 0;
    let normals = 0;
    for (let i = 0; i < 20; i++) {
      const all = drawPairs('mix').flat();
      expect(new Set(all).size).toBe(12);
      legends += all.filter(n => isLegendary(species(n))).length;
      normals += all.filter(n => !isLegendary(species(n))).length;
    }
    expect(legends).toBeGreaterThan(20);
    expect(normals).toBeGreaterThan(60);
  });

  it('Tiro de sorte troca o mais fraco de um time por um quebrado', () => {
    expect(LUCKY_POOL).toContain('Mewtwo');
    expect(LUCKY_POOL).not.toContain('Pikachu');
    const pairs = drawPairs('lucky');
    const teams: [ReturnType<typeof rushMon>[], ReturnType<typeof rushMon>[]] = [pairs.map(p => rushMon(p[0], 'lucky')), pairs.map(p => rushMon(p[1], 'lucky'))];
    const lucky = rollLucky(teams);
    expect(teams[lucky.side].length).toBe(6);
    const mon = teams[lucky.side].find(m => m.species === lucky.species)!;
    expect(mon.level).toBe(LUCKY_LEVEL);
    expect(teams[lucky.side].some(m => m.species === lucky.out)).toBe(false);
    expect(teams[1 - lucky.side].some(m => m.species === lucky.species)).toBe(false);
  });

  it('duplas sem repetir', () => {
    const pairs = drawPairs('evo2');
    const all = pairs.flat();
    expect(new Set(all).size).toBe(12);
  });

  it('batalha no mesmo PC termina com os dois lados escolhendo', () => {
    const a = drawPairs('mega').map(p => rushMon(p[0], 'mega'));
    const b = drawPairs('nv50').map(p => rushMon(p[1], 'nv50'));
    giveMegaStone(a[0]);
    expect(a[0].item).toBeTruthy();
    const ctl = new BattleController(a, {mon: b[0], team: b, rarity: 'rare', boss: true, trainer: 'Bia', versus: 'Ju'});
    ctl.initialEvents();
    const bat = ctl.battle;
    for (let turn = 0; turn < 400 && !ctl.ended; turn++) {
      if (bat.p2.requestState === 'switch') {
        const i = bat.p2.pokemon.findIndex((p, k) => k > 0 && !p.fainted);
        ctl.chooseP2(`switch ${i + 1}`);
      } else if (bat.p2.requestState === 'move') ctl.chooseP2('move 1');
      if (ctl.ended) break;
      if (bat.p1.requestState === 'switch') {
        const i = bat.p1.pokemon.findIndex((p, k) => k > 0 && !p.fainted);
        ctl.chooseSwitchSlot(i + 1);
      } else if (bat.p1.requestState === 'move') ctl.chooseMove(1, true);
    }
    expect(ctl.ended).toBe(true);
  });
});
