import {describe, expect, it} from 'vitest';
import {DEFAULT_RULES, enforceRules, roundBlockers, roundOf, roundsOf, standings, waveStep} from '../src/game/career';
import {adoptShared, botPending, createSharedTournament, matchKey, sharedAdvance, simulateBotMatch, tourInfo} from '../src/game/tournament';
import type {PlayerDoc} from '../src/game/career';
import {createMon} from '../src/game/mon';
import type {RunState} from '../src/game/types';

const runWith = (rules: Partial<typeof DEFAULT_RULES>, party: string[], level = 30) =>
  ({wave: 10, party: party.map(s => createMon(s, {level})), box: [], career: {code: 'X', season: 1, rules: {...DEFAULT_RULES, ...rules}}}) as unknown as RunState;

describe('carreira', () => {
  it('temporadas curtas pulam rondas sem perder torneios e chefes', () => {
    expect(waveStep(runWith({rounds: 24}, []))).toBe(5);
    expect(waveStep(runWith({rounds: 60}, []))).toBe(2);
    expect(waveStep(null)).toBe(1);
    const r = runWith({rounds: 24}, []);
    r.wave = 30;
    expect(roundOf(r)).toBe(6);
    expect(roundsOf(r)).toBe(24);
  });

  it('manda o lendário extra para a caixa e respeita o nível máximo', () => {
    const r = runWith({legendCap: 1, levelCap: 50}, ['Mewtwo', 'Lugia', 'Pikachu'], 70);
    const notes = enforceRules(r);
    expect(r.party.map(m => m.species)).toEqual(['Mewtwo', 'Pikachu']);
    expect(r.box.map(m => m.species)).toEqual(['Lugia']);
    expect(notes.length).toBe(1);
    expect([...r.party, ...r.box].every(m => m.level === 50)).toBe(true);
  });

  it('classifica pela soma das temporadas', () => {
    const p = (id: string, banked: number, points: number) => ({id, banked, points, season: 1, round: 0}) as PlayerDoc;
    expect(standings([p('a', 100, 10), p('b', 50, 100), p('c', 0, 0)]).map(x => x.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('torneio da carreira online', () => {
  const info = tourInfo('cup');
  const mk = (pid: string) => ({name: pid, pid, titles: {}, runnerUps: 0, fame: 0, team: [createMon('Pikachu', {level: 30})]});

  it('é igual em todos os PCs e espalha os jogadores pela chave', () => {
    const a = createSharedTournament(info, [mk('a'), mk('b')], 'a', 'X-s1-cup');
    const b = createSharedTournament(info, [mk('a'), mk('b')], 'b', 'X-s1-cup');
    expect(a.entrants.map(e => e.name)).toEqual(b.entrants.map(e => e.name));
    expect(a.entrants[0].pid).toBe('a');
    expect(a.entrants[4].pid).toBe('b');
    expect(a.entrants[0].player).toBe(true);
    expect(b.entrants[4].player).toBe(true);
    const four = createSharedTournament(info, ['a', 'b', 'c', 'd'].map(mk), 'a', 'X-s1-cup');
    expect([0, 2, 4, 6].map(i => four.entrants[i].pid)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('todo mundo usa a chave da nuvem e os resultados dos bots de quem simulou primeiro', () => {
    const a = createSharedTournament(info, [mk('a'), mk('b')], 'a', 'Y-s1-cup');
    const b = createSharedTournament(info, [mk('a'), mk('b')], 'b', 'Y-s1-cup');
    // "b" adota a chave que "a" gravou na nuvem.
    adoptShared(b, {region: a.region, entrants: a.entrants.map(e => ({...e, player: false, friend: false}))});
    expect(b.entrants.map(e => e.name)).toEqual(a.entrants.map(e => e.name));
    expect(b.entrants[4].player).toBe(true);
    expect(b.entrants[0].friend).toBe(true);
    // Só as partidas 1 e 3 são entre bots.
    expect(botPending(a).map(x => x.key)).toEqual([matchKey(0, 1), matchKey(0, 3)]);
    const results = Object.fromEntries(botPending(a).map(x => [x.key, simulateBotMatch(a, x.round, x.index)]));
    sharedAdvance(a, results);
    sharedAdvance(b, results);
    expect(a.rounds[0][1].winner).toBe(b.rounds[0][1].winner);
    expect(a.rounds[0][0].winner).toBeUndefined();
    const fromCloud = {...results, [matchKey(0, 0)]: {tid: 'Y-s1-cup', key: matchKey(0, 0), winner: 0}, [matchKey(0, 2)]: {tid: 'Y-s1-cup', key: matchKey(0, 2), winner: 4}};
    sharedAdvance(b, fromCloud);
    expect(b.rounds.length).toBe(2);
  });

  it('só segura a ronda quem ainda não terminou', () => {
    const p = (id: string, cleared: number, extra = {}) => ({id, season: 1, cleared, ...extra}) as PlayerDoc;
    const peers = [p('me', 5), p('a', 5), p('b', 4), p('c', 2, {out: true}), p('d', 0, {season: 2})];
    expect(roundBlockers(peers, 'me', 1, 5).map(x => x.id)).toEqual(['b']);
  });
});
