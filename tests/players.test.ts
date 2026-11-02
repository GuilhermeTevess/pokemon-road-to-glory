import {describe, expect, it} from 'vitest';
import {isOnlineMode, onOnlineHistory, recordMatch, bumpTotals} from '../src/game/history';
import type {History, MatchLog} from '../src/game/history';
import {hasOnline, onlinePart, sanePlayerCard, PLAYER_KEEP} from '../src/game/players';

const m = (mode: string, online: boolean, extra: Partial<MatchLog> = {}): MatchLog => ({
  at: 1, mode, online, won: true, vs: 'Gary', vsKind: 'player', mine: ['Pikachu'], theirs: ['Eevee'], ...extra,
});

describe('lista de jogadores', () => {
  it('sabe quais modos são online', () => {
    expect(['online-rush:nv50', 'qtour-online', 'online-built', 'career-pvp', 'career'].every(isOnlineMode)).toBe(true);
    expect(['rush:nv50', 'qtour', 'built', 'gym', 'run'].some(isOnlineMode)).toBe(false);
  });

  it('manda só a parte online do histórico', () => {
    const h: History = {
      version: 1,
      list: [m('rush:nv50', false), m('online-rush:nv50', true), m('gym', false), m('career-pvp', true)],
      totals: {'rush:nv50': {w: 3, l: 1}, 'online-rush:nv50': {w: 1, l: 0}, 'qtour-online': {w: 2, l: 1, titles: 1}},
    };
    const p = onlinePart(h);
    expect(p.list.map(x => x.mode)).toEqual(['online-rush:nv50', 'career-pvp']);
    expect(Object.keys(p.totals).sort()).toEqual(['online-rush:nv50', 'qtour-online']);
    expect(hasOnline(h)).toBe(true);
    expect(hasOnline({version: 1, list: [m('gym', false)], totals: {gym: {w: 1, l: 0}}})).toBe(false);
  });

  it('avisa no fim de partida online e não no offline', () => {
    const seen: string[] = [];
    onOnlineHistory(id => seen.push(id));
    recordMatch('t1', m('rush:nv50', false));
    recordMatch('t2', m('online-rush:nv50', true));
    bumpTotals('t3', 'qtour', x => (x.titles = 1));
    bumpTotals('t4', 'qtour-online', x => (x.titles = 1));
    onOnlineHistory(null);
    expect(seen).toEqual(['t2', 't4']);
  });

  it('limpa o que vem do banco', () => {
    const ok = {key: 'u_t', tid: 't', name: 'Juliana', avatar: 'red', at: 5, list: [m('online-rush:nv50', true)], totals: {'online-rush:nv50': {w: 1, l: 0}}};
    expect(sanePlayerCard(ok)?.name).toBe('Juliana');
    expect(sanePlayerCard(null)).toBeNull();
    expect(sanePlayerCard({...ok, name: '  '})).toBeNull();
    expect(sanePlayerCard({...ok, gone: true})?.gone).toBe(true);
    const bad = sanePlayerCard({
      ...ok,
      name: 'X'.repeat(99),
      list: [...Array(100)].map(() => m('online-rush:nv50', true, {mine: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']})).concat([{oops: 1} as unknown as MatchLog]),
      totals: {'online-rush:nv50': {w: Infinity, l: -3}, gym: {w: 9, l: 0}},
    })!;
    expect(bad.name.length).toBe(20);
    expect(bad.list.length).toBe(PLAYER_KEEP);
    expect(bad.list[0].mine.length).toBe(6);
    expect(bad.totals).toEqual({'online-rush:nv50': {w: 0, l: 0}});
  });
});
