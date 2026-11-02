import {describe, expect, it} from 'vitest';
import {addScoredMatch, type History, type MatchLog} from '../src/game/history';
import {saneScore} from '../src/game/players';
import {MAX_GAIN, RAISE_GAP, applyPoints, emptyScore, eloOf, matchPoints, nextCloudScore, rankKeyOf, sideScore, totalPoints, type MatchScore} from '../src/game/ranking';
import {guestScore} from '../src/game/rush';

const side = (alive: number, size: number, hp: number) => ({alive, size, hp});
const sc = (mine: ReturnType<typeof side>, theirs: ReturnType<typeof side>): MatchScore => ({mine, theirs});
const log = (mode: string, won: boolean, extra: Partial<MatchLog> = {}): MatchLog => ({at: 1, mode, online: true, won, vs: 'Vaz', vsKind: 'player', mine: [], theirs: [], ...extra});

describe('pontos do ranking', () => {
  it('vitória perfeita vale mais que vitória por um fio', () => {
    const perfect = matchPoints(true, sc(side(6, 6, 1), side(0, 6, 0)));
    const close = matchPoints(true, sc(side(1, 6, 0.03), side(0, 6, 0)));
    expect(perfect).toBe(MAX_GAIN);
    expect(close).toBeGreaterThanOrEqual(20);
    expect(close).toBeLessThan(26);
    // Times menores (Rush de 3) também chegam ao máximo com todos de pé.
    expect(matchPoints(true, sc(side(3, 3, 1), side(0, 3, 0)))).toBe(MAX_GAIN);
  });

  it('derrota tira menos quando foi apertada; sair no meio tira o máximo', () => {
    expect(matchPoints(false, sc(side(0, 6, 0), side(6, 6, 1)))).toBe(-10);
    expect(matchPoints(false, sc(side(0, 6, 0), side(1, 6, 0.1)))).toBe(-3);
    expect(matchPoints(false, sc(side(0, 6, 0), side(1, 6, 0.1)), 'me')).toBe(-10);
    expect(matchPoints(true, null, 'foe')).toBe(15);
  });

  it('no Bronze a derrota não tira e ninguém fica negativo', () => {
    expect(applyPoints(40, -10)).toBe(40);
    expect(applyPoints(105, -10)).toBe(95);
    expect(applyPoints(100, -200)).toBe(0);
    expect(applyPoints(0, 30)).toBe(30);
  });

  it('só modos online contra pessoas contam', () => {
    expect(rankKeyOf('online-rush:mega')).toBe('rush');
    expect(rankKeyOf('qtour-online')).toBe('qtour');
    expect(rankKeyOf('online-built')).toBe('built');
    expect(rankKeyOf('career-pvp')).toBe('pvp');
    expect(rankKeyOf('career')).toBeNull();
    expect(rankKeyOf('rush:mega')).toBeNull();
    let h: History = {version: 1, list: [], totals: {}};
    h = addScoredMatch(h, log('online-rush:nv50', true), {score: sc(side(6, 6, 1), side(0, 6, 0))});
    h = addScoredMatch(h, log('qtour-online', true, {vsKind: 'bot'}));
    h = addScoredMatch(h, log('rush:nv50', true, {online: false}));
    expect(h.points).toEqual({rush: 50});
    expect(h.list[0].pts).toBeUndefined();
    expect(h.list[2].pts).toBe(50);
    expect(totalPoints(h.points)).toBe(50);
  });

  it('elos: cada modo e o geral (que pede o dobro)', () => {
    expect(eloOf(0).elo.name).toBe('Bronze');
    expect(eloOf(99)).toMatchObject({toNext: 1});
    expect(eloOf(100).elo.name).toBe('Prata');
    expect(eloOf(100, true).elo.name).toBe('Bronze');
    expect(eloOf(5000).elo.name).toBe('Mestre');
    expect(eloOf(5000).next).toBeNull();
  });

  it('placar da batalha a partir da vida dos Pokémon', () => {
    const s = sideScore([
      {hp: 50, maxhp: 100},
      {hp: 0, maxhp: 100, fainted: true},
    ]);
    expect(s).toEqual({alive: 1, size: 2, hp: 0.25});
    // Quem entrou vê o placar ao contrário; placar estranho é ignorado.
    expect(guestScore({p1: side(1, 2, 0.5), p2: side(0, 2, 0)})).toEqual({mine: side(0, 2, 0), theirs: side(1, 2, 0.5)});
    expect(guestScore({p1: side(9, 2, 0.5), p2: side(0, 2, 0)})).toBeNull();
    expect(guestScore('lixo')).toBeNull();
  });
});

describe('envio dos pontos para o banco', () => {
  it('sobe no máximo 50 por modo e 1 vez por minuto (como as regras exigem)', () => {
    const sent = emptyScore();
    const a = nextCloudScore({rush: 80}, sent, RAISE_GAP);
    expect(a.score.pts.rush).toBe(50);
    expect(a.score.n).toBe(1);
    expect(a.more).toBe(true);
    // Logo em seguida: não sobe (falta 1 minuto), fica para depois.
    const b = nextCloudScore({rush: 80}, a.score, RAISE_GAP + 1000);
    expect(b.raises).toBe(false);
    expect(b.score).toEqual(a.score);
    const c = nextCloudScore({rush: 80}, a.score, 2 * RAISE_GAP);
    expect(c.score.pts.rush).toBe(80);
    expect(c.score.n).toBe(2);
    expect(c.more).toBe(false);
  });

  it('descer pontos (derrota) vai na hora', () => {
    const sent = {...emptyScore(), pts: {rush: 120, qtour: 0, built: 0, pvp: 0}, n: 3, t: 1000};
    const r = nextCloudScore({rush: 110}, sent, 1500);
    expect(r.score).toEqual({...sent, pts: {...sent.pts, rush: 110}});
  });

  it('limpa pontos estranhos lidos do banco', () => {
    expect(saneScore({pts: {rush: 10, qtour: -5, built: 'x', pvp: 2.7, hack: 9}, n: 2, t: 5})).toEqual({pts: {rush: 10, qtour: 0, built: 0, pvp: 2}, n: 2, t: 5});
    expect(saneScore(null)).toBeNull();
  });
});
