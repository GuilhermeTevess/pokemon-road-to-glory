import {describe, expect, it} from 'vitest';
import {LUCKY_LEVEL, LUCKY_POOL, RUSH_MODES, draftPick, drawPairs, giveMegaStone, rollLucky, rushMon, rushPool} from '../src/game/rush';
import {isLegendary, species} from '../src/data/dex';
import {BattleController} from '../src/game/battle';

describe('rush', () => {
  it('todos os modos têm Pokémon suficientes', () => {
    for (const m of RUSH_MODES) expect(rushPool(m.id).length, m.id).toBeGreaterThanOrEqual(12);
  });

  it('são 10 modos (2 linhas de 5)', () => {
    expect(RUSH_MODES.length).toBe(10);
  });

  it('Espelho: o escolhido entra nos dois times, igualzinho, e o outro sai', () => {
    let teams: [ReturnType<typeof rushMon>[], ReturnType<typeof rushMon>[]] = [[], []];
    const pairs = drawPairs('mirror');
    pairs.forEach((pair, round) => {
      teams = draftPick(teams, 'mirror', pair, 0, round % 2);
    });
    expect(teams[0].length).toBe(6);
    expect(teams[0]).toEqual(teams[1]);
    expect(teams[0][0]).not.toBe(teams[1][0]);
    expect(teams[0].map(m => m.species)).toEqual(pairs.map(p => p[0]));
  });

  it('nos outros modos o par se divide entre os dois', () => {
    const next = draftPick([[], []], 'nv50', ['Pikachu', 'Eevee'], 1, 0);
    expect(next[0][0].species).toBe('Eevee');
    expect(next[1][0].species).toBe('Pikachu');
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

describe('mega no Rush', () => {
  it('todos levam a pedra, mas só 1 mega-evolui por luta', async () => {
    const {giveAllMegaStones} = await import('../src/game/rush');
    const a = ['Charizard', 'Gengar', 'Garchomp'].map(n => rushMon(n, 'mega'));
    const b = ['Snorlax', 'Snorlax', 'Snorlax'].map(n => rushMon(n, 'nv50'));
    giveAllMegaStones(a);
    expect(a.every(m => m.item)).toBe(true);
    const ctl = new BattleController(a, {mon: b[0], team: b, rarity: 'rare', boss: true, trainer: 'Bia', versus: 'Ju'});
    ctl.initialEvents();
    expect(ctl.canMega()).toBeTruthy();
    ctl.chooseP2('move 1');
    ctl.chooseMove(1, true);
    expect(ctl.battle.p1.active[0].species.name).toContain('Mega');
    // Troca para outro que também tem pedra: não pode mais.
    if (!ctl.ended) {
      ctl.chooseP2('move 1');
      ctl.chooseSwitchSlot(2);
      expect(ctl.canMega()).toBeFalsy();
    }
  });
});
