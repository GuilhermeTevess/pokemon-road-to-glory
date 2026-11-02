import {describe, expect, it} from 'vitest';
import {BUILT_LEVEL, PREMADE, botTeam, evTotal, itemsFor, learnable, premadeTeam, suggestedSet, teamProblems, teamToOwned, toOwned} from '../src/game/builder';
import {dex, isPlayable, species} from '../src/data/dex';
import {BattleController} from '../src/game/battle';

describe('Time dos Sonhos', () => {
  it('set sugerido tem golpes, habilidade da espécie e EVs válidos', () => {
    for (const n of ['Garchomp', 'Gengar', 'Snorlax', 'Pikachu', 'Ferrothorn', 'Magikarp', 'Ditto', 'Blissey', 'Shedinja', 'Charizard']) {
      const s = suggestedSet(n);
      expect(s.moves.length, n).toBeGreaterThan(0);
      expect(s.moves.length, n).toBeLessThanOrEqual(4);
      expect(new Set(s.moves).size, n).toBe(s.moves.length);
      expect(Object.values(species(n).abilities), n).toContain(s.ability);
      expect(evTotal(s.evs), n).toBeLessThanOrEqual(510);
      for (const m of s.moves) expect(dex.moves.get(m).exists, `${n} ${m}`).toBe(true);
    }
  });

  it('set sugerido do Garchomp é físico com golpe de Terra e Dragão', () => {
    const s = suggestedSet('Garchomp');
    const types = s.moves.map(m => dex.moves.get(m).type);
    expect(types).toContain('Ground');
    expect(types).toContain('Dragon');
    expect(s.evs.atk).toBe(252);
  });

  it('times prontos são válidos (habilidade, nature, golpes que aprende, item)', () => {
    PREMADE.forEach((_, i) => {
      const t = premadeTeam(i);
      expect(t.mons.length).toBe(6);
      expect(teamProblems(t), t.name).toEqual([]);
      for (const m of t.mons) {
        const sp = species(m.species);
        expect(sp.exists && isPlayable(sp), m.species).toBe(true);
        expect(Object.values(sp.abilities), `${m.species} ${m.ability}`).toContain(m.ability);
        expect(dex.natures.get(m.nature).exists, m.nature).toBe(true);
        expect(evTotal(m.evs), m.species).toBeLessThanOrEqual(510);
        const learn = learnable(m.species);
        for (const mv of m.moves) expect(learn, `${m.species} ${mv}`).toContain(mv);
        expect(itemsFor(m.species).map(x => x.id), `${m.species} ${m.item}`).toContain(m.item);
      }
    });
    expect(premadeTeam(1).mons[0].ability).toBe('Drizzle');
  });

  it('regras: espécie repetida e duas Mega Pedras', () => {
    const t = {id: 'x', name: 't', updated: 0, mons: [{...suggestedSet('Charizard'), item: 'charizarditex'}, {...suggestedSet('Gengar'), item: 'gengarite'}, suggestedSet('Gengar')]};
    const p = teamProblems(t);
    expect(p.some(x => x.includes('duas vezes'))).toBe(true);
    expect(p.some(x => x.includes('Mega'))).toBe(true);
    expect(itemsFor('Charizard').some(i => i.id === 'charizarditex')).toBe(true);
    expect(itemsFor('Pikachu').some(i => i.megaFor)).toBe(false);
  });

  it('vira Pokémon de batalha no nível 50 e luta com itens', () => {
    const mon = toOwned({...suggestedSet('Charizard'), item: 'charizarditey'});
    expect(mon.level).toBe(BUILT_LEVEL);
    expect(mon.ivs.spe).toBe(31);
    const a = teamToOwned(premadeTeam(0));
    const b = teamToOwned(botTeam());
    const ctl = new BattleController(a, {mon: b[0], team: b, rarity: 'rare', boss: true, trainer: 'Bot'});
    for (let i = 0; i < 300 && !ctl.ended; i++) {
      if (ctl.battle.p1.requestState === 'switch') ctl.chooseSwitchSlot(ctl.battle.p1.pokemon.findIndex(p => !p.fainted && !p.isActive) + 1);
      else ctl.chooseMove(1);
    }
    expect(ctl.ended).toBe(true);
  });
});
