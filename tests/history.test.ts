import {describe, expect, it} from 'vitest';
import {HISTORY_KEEP, addMatch, modeLabel, nemesisOf, streakOf, sumRows, tableOf, winRate} from '../src/game/history';
import type {History, MatchLog} from '../src/game/history';

const base = (): History => ({version: 1, list: [], totals: {}});
const m = (mode: string, won: boolean, extra: Partial<MatchLog> = {}): MatchLog => ({
  at: 1, mode, online: mode.startsWith('online') || mode.startsWith('career') || mode === 'qtour-online', won, vs: 'Gary', vsKind: 'cpu', mine: ['Pikachu'], theirs: ['Eevee'], ...extra,
});

describe('histórico do treinador', () => {
  it('soma vitórias e derrotas por modo e separa offline de online', () => {
    let h = base();
    h = addMatch(h, m('rush:nv50', true));
    h = addMatch(h, m('rush:nv50', false));
    h = addMatch(h, m('rush:mega', true));
    h = addMatch(h, m('gym', true));
    h = addMatch(h, m('online-rush:nv50', false));
    h = addMatch(h, m('career-pvp', true));
    const off = tableOf(h, false);
    expect(off.map(r => r.label)).toEqual(['Ginásios', 'Rush · Clássico Nv. 50', 'Rush · Mega']);
    expect(off.find(r => r.key === 'rush:nv50')).toMatchObject({w: 1, l: 1});
    const on = tableOf(h, true);
    expect(on.map(r => r.key)).toEqual(['online-rush:nv50', 'career-pvp']);
    expect(sumRows(off)).toEqual({w: 3, l: 1, titles: 0});
  });

  it('guarda só as últimas partidas, mas os totais continuam', () => {
    let h = base();
    for (let i = 0; i < HISTORY_KEEP + 15; i++) h = addMatch(h, m('qtour', i % 2 === 0));
    expect(h.list.length).toBe(HISTORY_KEEP);
    expect(h.totals.qtour.w + h.totals.qtour.l).toBe(HISTORY_KEEP + 15);
  });

  it('winrate, sequência e adversário mais enfrentado', () => {
    expect(winRate(0, 0)).toBeNull();
    expect(winRate(3, 1)).toBe(75);
    const list = [m('gym', true), m('gym', true), m('gym', false, {vs: 'Misty'}), m('gym', false)];
    expect(streakOf(list)).toEqual({won: true, n: 2});
    expect(nemesisOf(list)).toMatchObject({vs: 'Gary', w: 2, l: 1});
    expect(modeLabel('online-rush:legend')).toBe('Rush online · Lendários');
  });
});
