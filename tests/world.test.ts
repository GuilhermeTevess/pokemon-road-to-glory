import {describe, expect, it} from 'vitest';
import {createTournament, tourInfo} from '../src/game/tournament';
import {nextSeasonWorld, newWorld, stepWorld, worldTournament} from '../src/game/world';

describe('mundo da temporada', () => {
  it('os rivais jogam: time cresce, ganham insígnias, somam pontos e viram notícia', () => {
    const w = newWorld();
    stepWorld(w, 120);
    expect(w.wave).toBe(120);
    expect(w.bots.every(b => b.team.length === 6)).toBe(true);
    const badges = w.bots.reduce((n, b) => n + b.badges.length, 0);
    expect(badges).toBeGreaterThan(20);
    expect(w.news.length).toBeGreaterThan(5);
    const b = w.bots.find(x => x.badges.length)!;
    expect(b.points).toBe(b.log.reduce((n, e) => n + e.pts, 0));
    expect(Object.values(b.usage)[0]).toBeGreaterThan(0);
  });

  it('carreira curta: cada ronda conta uma vez para os rivais', () => {
    const w = newWorld();
    stepWorld(w, 120, 5);
    expect(Math.max(...Object.values(w.bots[0].usage))).toBeLessThanOrEqual(24);
  });

  it('torneio usa os rivais do mundo e dá pontos para eles', () => {
    const w = newWorld();
    stepWorld(w, 30);
    const t = createTournament(tourInfo('cup'), {name: 'Eu', titles: {}, runnerUps: 0, fame: 0}, 'kanto', [], w);
    const names = new Set(w.bots.map(b => b.name));
    expect(t.entrants.filter(e => !e.player).every(e => names.has(e.name))).toBe(true);
    // Simula a chave inteira (o primeiro de cada partida ganha).
    let ids = [0, 1, 2, 3, 4, 5, 6, 7];
    t.rounds = [];
    while (ids.length > 1) {
      const round = [];
      for (let i = 0; i < ids.length; i += 2) round.push({a: ids[i], b: ids[i + 1], winner: ids[i]});
      t.rounds.push(round);
      ids = round.map(m => m.winner);
    }
    const before = w.bots.reduce((n, b) => n + b.points, 0);
    worldTournament(w, t, 'League Cup', tourInfo('cup').fame);
    expect(w.bots.reduce((n, b) => n + b.points, 0)).toBeGreaterThan(before);
  });

  it('nova temporada guarda os pontos no acumulado', () => {
    const w = newWorld();
    stepWorld(w, 60);
    const total = w.bots[0].points;
    const n = nextSeasonWorld(w);
    expect(n.bots[0].banked).toBe(total);
    expect(n.bots[0].badges).toEqual([]);
  });
});
