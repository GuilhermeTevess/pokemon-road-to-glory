// Pontos de fama e ranking. Cada run é uma temporada: torneios, lendas, ginásios e viajantes
// dão pontos. No fim, o ranking da temporada com os treinadores do circuito (NPCs) e o geral.
import {REGIONS} from '../data/regions';
import {careerOf} from './meta';
import type {Collection} from './meta';
import {pick, randInt, shuffle} from './rng';
import {AVATARS} from './trainers';
import type {RunState} from './types';

export type PointSource = 'tournaments' | 'legends' | 'gyms' | 'books' | 'travelers' | 'legendaries';

export const POINTS = {legend: 150, badge: 30, book: 300, traveler: 10, legendary: 50};

export const SOURCE_LABEL: Record<PointSource, string> = {
  tournaments: 'Torneios',
  legends: 'Lendas vencidas',
  gyms: 'Insígnias',
  books: 'Cadernetas completas',
  travelers: 'Viajantes ajudados',
  legendaries: 'Lendários das dicas',
};

export interface Npc {
  name: string;
  avatar: string;
  region: string;
  fav: string;
  /** Mais habilidade = mais pontos por temporada. */
  skill: number;
  total: number;
  wins: number;
}

export interface RankRow {
  name: string;
  avatar?: string;
  points: number;
  player?: boolean;
  region?: string;
  fav?: string;
}

export interface SeasonRec {
  at: number;
  wave: number;
  region?: string;
  points: number;
  breakdown: Partial<Record<PointSource, number>>;
  rank: number;
  top: RankRow[];
}

export interface League {
  npcs: Npc[];
  seasons: SeasonRec[];
}

const NPC_NAMES = ['Bia', 'Caio', 'Duda', 'Léo', 'Mari', 'Rafa', 'Nina', 'Theo', 'Gabi', 'Vini', 'Lara', 'Hugo', 'Yuki', 'Kenji', 'Sofia', 'Marco', 'Aiko', 'Chloé'];
const FAVS = ['Garchomp', 'Gardevoir', 'Lucario', 'Dragonite', 'Gengar', 'Tyranitar', 'Sylveon', 'Greninja', 'Metagross', 'Togekiss', 'Volcarona', 'Kingambit', 'Dragapult', 'Umbreon', 'Mimikyu'];

export function leagueOf(col: Collection): League {
  if (!col.league) {
    const names = shuffle(NPC_NAMES).slice(0, 15);
    col.league = {
      npcs: names.map((name, i) => ({
        name, avatar: pick(AVATARS), region: pick(REGIONS).id, fav: pick(FAVS),
        skill: 0.4 + (i / names.length) * 1.0 + Math.random() * 0.2, total: 0, wins: 0,
      })),
      seasons: [],
    };
  }
  return col.league;
}

/** Soma pontos na temporada (run) e na fama da carreira. */
export function addPoints(run: RunState, col: Collection | null, source: PointSource, n: number, fame = true): void {
  if (n <= 0) return;
  run.points = {...run.points, [source]: (run.points?.[source] ?? 0) + n};
  if (col && fame) careerOf(col).fame += n;
}

export function seasonPoints(run: RunState): number {
  return Object.values(run.points ?? {}).reduce((a, b) => a + (b ?? 0), 0);
}

/** Pontos finais de cada NPC nesta temporada (sorteados no começo da run). */
export function rollRivalPoints(col: Collection): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of leagueOf(col).npcs) out[n.name] = Math.round(n.skill * randInt(250, 1300) / 10) * 10;
  return out;
}

/** Ranking da temporada. Durante a run, os NPCs aparecem com os pontos proporcionais à ronda. */
export function seasonRanking(col: Collection, run: RunState, me: {name: string; avatar?: string}, final = false): RankRow[] {
  const progress = final ? 1 : Math.min(1, run.wave / 120);
  const rivals = run.rivalPoints ?? {};
  const rows: RankRow[] = leagueOf(col).npcs.map(n => ({
    name: n.name, avatar: n.avatar, region: n.region, fav: n.fav, points: Math.round(((rivals[n.name] ?? 0) * progress) / 10) * 10,
  }));
  rows.push({name: me.name, avatar: me.avatar, points: seasonPoints(run), player: true, region: run.region, fav: run.party[0]?.species});
  return rows.sort((a, b) => b.points - a.points || (a.player ? -1 : 1));
}

/** Ranking geral: soma de todas as temporadas. */
export function overallRanking(col: Collection, me: {name: string; avatar?: string}): RankRow[] {
  const league = leagueOf(col);
  const mine = league.seasons.reduce((a, s) => a + s.points, 0);
  const rows: RankRow[] = league.npcs.map(n => ({name: n.name, avatar: n.avatar, region: n.region, fav: n.fav, points: n.total}));
  rows.push({name: me.name, avatar: me.avatar, points: mine, player: true});
  return rows.sort((a, b) => b.points - a.points);
}

/** Fecha a temporada: guarda o resultado e soma os pontos dos NPCs no geral. */
export function finishSeason(col: Collection, run: RunState, me: {name: string; avatar?: string}): SeasonRec {
  const rows = seasonRanking(col, run, me, true);
  const league = leagueOf(col);
  for (const n of league.npcs) n.total += run.rivalPoints?.[n.name] ?? 0;
  const champ = league.npcs.find(n => n.name === rows[0].name && !rows[0].player);
  if (champ) champ.wins++;
  const rec: SeasonRec = {
    at: Date.now(),
    wave: run.wave,
    region: run.region,
    points: seasonPoints(run),
    breakdown: {...run.points},
    rank: rows.findIndex(r => r.player) + 1,
    top: rows.slice(0, 3),
  };
  league.seasons.unshift(rec);
  league.seasons = league.seasons.slice(0, 50);
  return rec;
}
