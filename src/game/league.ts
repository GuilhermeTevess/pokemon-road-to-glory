// Pontos de fama e ranking. Cada run é uma temporada: torneios, lendas, ginásios e viajantes
// dão pontos. No fim, o ranking da temporada com os treinadores do circuito (NPCs) e o geral.
import {careerOf} from './meta';
import type {Collection} from './meta';
import {randInt, shuffle} from './rng';
import {RIVALS} from '../data/rivals';
import type {RunState} from './types';

export type PointSource = 'tournaments' | 'legends' | 'gyms' | 'books' | 'travelers' | 'legendaries' | 'penalties';

export const POINTS = {legend: 150, badge: 30, book: 300, traveler: 10, legendary: 50};

export const SOURCE_LABEL: Record<PointSource, string> = {
  tournaments: 'Torneios',
  legends: 'Lendas vencidas',
  gyms: 'Insígnias',
  books: 'Cadernetas completas',
  travelers: 'Viajantes ajudados',
  legendaries: 'Lendários das dicas',
  penalties: 'Derrotas na trilha',
};

export interface Npc {
  name: string;
  /** Nome antigo (rival genérico de saves velhos), para achar os pontos da temporada em andamento. */
  was?: string;
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
  /** Rival do mundo da temporada (dá para abrir o perfil). */
  bot?: boolean;
}

export interface SeasonRec {
  at: number;
  wave: number;
  region?: string;
  points: number;
  breakdown: Partial<Record<PointSource, number>>;
  /** Extrato: de onde veio cada ponto. */
  log?: PointEntry[];
  rank: number;
  top: RankRow[];
}

export interface League {
  npcs: Npc[];
  seasons: SeasonRec[];
}

/** Nomes dos rivais genéricos de antes: viram rivais conhecidos (mantendo os pontos). */
const OLD_NPC_NAMES = new Set(['Bia', 'Caio', 'Duda', 'Léo', 'Mari', 'Rafa', 'Nina', 'Theo', 'Gabi', 'Vini', 'Lara', 'Hugo', 'Yuki', 'Kenji', 'Sofia', 'Marco', 'Aiko', 'Chloé']);

/** O circuito: 15 rivais conhecidos do anime e dos jogos, de várias regiões. */
export function leagueOf(col: Collection): League {
  if (!col.league) {
    const rivals = shuffle(RIVALS).slice(0, 15);
    col.league = {
      npcs: rivals.map((r, i) => ({
        name: r.name, avatar: r.avatar, region: r.region, fav: r.team[0],
        skill: 0.4 + (i / rivals.length) * 1.0 + Math.random() * 0.2, total: 0, wins: 0,
      })),
      seasons: [],
    };
  } else if (col.league.npcs.some(n => OLD_NPC_NAMES.has(n.name))) {
    const taken = new Set(col.league.npcs.map(n => n.name));
    const free = shuffle(RIVALS.filter(r => !taken.has(r.name)));
    for (const n of col.league.npcs) {
      if (!OLD_NPC_NAMES.has(n.name)) continue;
      const r = free.shift();
      if (!r) break;
      Object.assign(n, {was: n.name, name: r.name, avatar: r.avatar, region: r.region, fav: r.team[0]});
    }
  }
  return col.league;
}

/** Soma pontos na temporada (run) e na fama da carreira. */
/** Uma entrada do extrato de pontos ("30 · Ginásio de Brock"). */
export interface PointEntry {
  source: PointSource;
  label: string;
  pts: number;
  wave: number;
}

export function addPoints(run: RunState, col: Collection | null, source: PointSource, n: number, fame = true, label?: string): void {
  if (n <= 0) return;
  run.points = {...run.points, [source]: (run.points?.[source] ?? 0) + n};
  run.pointLog = [...(run.pointLog ?? []), {source, label: label ?? SOURCE_LABEL[source], pts: n, wave: run.wave}];
  if (col && fame) careerOf(col).fame += n;
}

/** Tira pontos da temporada (nunca abaixo de zero) e um pouco da fama. Devolve quanto tirou. */
export function losePoints(run: RunState, col: Collection | null, n: number, label: string): number {
  const lost = Math.min(Math.round(n), seasonPoints(run));
  if (lost <= 0) return 0;
  run.points = {...run.points, penalties: (run.points?.penalties ?? 0) - lost};
  run.pointLog = [...(run.pointLog ?? []), {source: 'penalties', label, pts: -lost, wave: run.wave}];
  if (col) careerOf(col).fame = Math.max(0, careerOf(col).fame - lost);
  return lost;
}

/** Lendas vencidas nesta temporada (pelo extrato de pontos). */
export function legendsBeaten(run: RunState): string[] {
  return (run.pointLog ?? []).filter(e => e.source === 'legends').map(e => e.label.replace(/^Vitória sobre /, ''));
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
  const rows: RankRow[] = run.world
    ? run.world.bots.map(b => ({name: b.name, avatar: b.avatar, region: b.region, fav: b.partner, points: b.points, bot: true}))
    : leagueOf(col).npcs.map(n => ({
    name: n.name, avatar: n.avatar, region: n.region, fav: n.fav, points: Math.round(((rivals[n.name] ?? rivals[n.was ?? ''] ?? 0) * progress) / 10) * 10,
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
  for (const n of league.npcs)
    n.total += run.world ? (run.world.bots.find(b => b.name === n.name)?.points ?? 0) : (run.rivalPoints?.[n.name] ?? run.rivalPoints?.[n.was ?? ''] ?? 0);
  const champ = league.npcs.find(n => n.name === rows[0].name && !rows[0].player);
  if (champ) champ.wins++;
  const rec: SeasonRec = {
    at: Date.now(),
    wave: run.wave,
    region: run.region,
    points: seasonPoints(run),
    breakdown: {...run.points},
    log: run.pointLog ?? [],
    rank: rows.findIndex(r => r.player) + 1,
    top: rows.slice(0, 3),
  };
  league.seasons.unshift(rec);
  league.seasons = league.seasons.slice(0, 50);
  return rec;
}
