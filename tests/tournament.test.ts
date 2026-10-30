import {describe, expect, it} from 'vitest';
import {
  TOURS, applyToCareer, botTeam, createTournament, emptyCareer, playerMatch, recordPlayerResult, simulateMatch, tourAt,
} from '../src/game/tournament';
import {introLines} from '../src/game/narration';
import {isMilestoneWave, SEASON_LENGTH} from '../src/game/encounters';

const me = {name: 'Ju', titles: {}, runnerUps: 0, fame: 0};

describe('temporada e torneios', () => {
  it('120 rondas com torneios em 30/60/90/120', () => {
    expect(SEASON_LENGTH).toBe(120);
    expect([30, 60, 90, 120].map(w => tourAt(w)?.kind)).toEqual(['cup', 'regional', 'international', 'worlds']);
    expect(isMilestoneWave(60)).toBe(true);
    expect(isMilestoneWave(50)).toBe(false);
  });

  it('bots têm times sem repetir espécie e partidas simuladas terminam', () => {
    const a = botTeam(30, 3, 0);
    const b = botTeam(30, 3, 0);
    expect(new Set(a.map(m => m.species)).size).toBe(3);
    const r = simulateMatch(a, b, 'Bia', 'Caio');
    expect([0, 1]).toContain(r.winner);
    expect(r.highlights.at(-1)).toMatch(/venceu/);
  });

  it('perder nas quartas: o torneio é simulado até o fim e você fica em 5º', () => {
    const t = createTournament(TOURS[0], me);
    expect(t.entrants).toHaveLength(8);
    recordPlayerResult(t, false, ['Charmander'], [], 1);
    expect(t.stage).toBe('done');
    expect(t.placement).toBe(5);
    expect(t.rounds).toHaveLength(3);
    expect(t.rounds[2][0].winner).toBeDefined();
  });

  it('vencer tudo dá o título e entra na carreira', () => {
    const t = createTournament(TOURS[0], me);
    for (let i = 0; i < 3; i++) {
      expect(playerMatch(t)).not.toBeNull();
      recordPlayerResult(t, true, ['Charmander'], [], 1);
    }
    expect(t.stage).toBe('done');
    expect(t.placement).toBe(1);
    const c = emptyCareer();
    applyToCareer(c, t);
    expect(c.titles.cup).toBe(1);
    expect(c.cp).toBe(50);
    expect(c.defending.cup).toBe(true);
    expect(c.history[0].rounds).toHaveLength(3);
  });

  it('narrador zoa o eterno vice e apresenta quem defende o título', () => {
    const vice = introLines({...me, runnerUps: 3}, me, 'League Cup', 0, false).join(' ');
    expect(vice).toMatch(/vice|prata/);
    const champ = introLines(me, me, 'League Cup', 2, true).join(' ');
    expect(champ).toMatch(/FINAL/);
    expect(champ).toMatch(/defender o título/);
  });
});
