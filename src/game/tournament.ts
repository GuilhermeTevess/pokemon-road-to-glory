// Torneios da temporada (rondas 30, 60, 90 e 120): chave de 8 com eliminação simples.
// As partidas entre bots são simuladas de verdade no Showdown, para dar para estudar os times depois.
import {Battle} from '@pkmn/sim';
import {BIOMES} from '../data/biomes';
import {getRegion} from '../data/regions';
import {aiMoveChoice, aiSwitchChoice} from './battle';
import {generateEncounter} from './encounters';
import {toSet} from './mon';
import {AVATARS} from './trainers';
import type {NarratorCtx} from './narration';
import {pick, randInt, shuffle} from './rng';
import type {OwnedMon} from './types';

export type TourKind = 'cup' | 'regional' | 'international' | 'worlds';

export interface TourInfo {
  kind: TourKind;
  wave: number;
  name: string;
  /** Explicação curta para quem não conhece o circuito. */
  about: string;
  /** Tamanho do time dos bots. */
  teamSize: number;
  /** Prêmios por colocação: [campeão, vice, semifinal, quartas]. */
  cp: number[];
  glory: number[];
  fame: number[];
  money: number[];
}

export const TOURS: TourInfo[] = [
  {
    kind: 'cup', wave: 30, name: 'League Cup', teamSize: 3,
    about: 'Torneio local, o primeiro degrau do circuito. Vale poucos Championship Points (CP), mas é onde todo campeão começa.',
    cp: [50, 40, 25, 15], glory: [30, 20, 12, 6], fame: [80, 50, 30, 15], money: [4000, 2500, 1500, 800],
  },
  {
    kind: 'regional', wave: 60, name: 'Regional Championship', teamSize: 4,
    about: 'Campeonato regional: muito mais gente, times mais fortes e bem mais CP. Ir bem aqui faz seu nome circular.',
    cp: [200, 160, 100, 60], glory: [60, 40, 25, 12], fame: [200, 120, 70, 40], money: [8000, 5000, 3000, 1500],
  },
  {
    kind: 'international', wave: 90, name: 'International Championship', teamSize: 5,
    about: 'Um dos grandes internacionais (Europa, América Latina, América do Norte, Oceania). Reúne os melhores de vários países.',
    cp: [500, 400, 250, 150], glory: [100, 70, 45, 25], fame: [400, 250, 150, 80], money: [15000, 9000, 5000, 2500],
  },
  {
    kind: 'worlds', wave: 120, name: 'World Championship', teamSize: 6,
    about: 'O Campeonato Mundial, o fim da temporada. Só os melhores chegam, e vencer aqui é virar lenda.',
    cp: [0, 0, 0, 0], glory: [200, 130, 80, 40], fame: [1000, 600, 350, 200], money: [30000, 18000, 10000, 5000],
  },
];

export const ROUND_NAMES = ['Quartas de final', 'Semifinal', 'Final'];

export function tourAt(wave: number): TourInfo | undefined {
  return TOURS.find(t => t.wave === wave);
}

export function tourInfo(kind: TourKind): TourInfo {
  return TOURS.find(t => t.kind === kind)!;
}

export interface Entrant extends NarratorCtx {
  avatar?: string;
  player?: boolean;
  /** Time dos bots (o do jogador é o time da run). */
  team: OwnedMon[];
}

export interface MatchRec {
  a: number;
  b: number;
  winner?: number;
  /** Espécies que cada lado usou. */
  teams?: [string[], string[]];
  /** Lances principais (nocautes, críticos) para o histórico. */
  highlights?: string[];
  /** Quantos Pokémon o vencedor terminou de pé. */
  left?: number;
}

export interface Tournament {
  kind: TourKind;
  wave: number;
  /** Região onde acontece (League Cup e Regional são na sua região). */
  region?: string;
  entrants: Entrant[];
  rounds: MatchRec[][];
  stage: 'intro' | 'draw' | 'bracket' | 'done';
  /** Colocação final do jogador (1, 2, 3 ou 5). */
  placement?: number;
}

/** Registro guardado na coleção (histórico de torneios). */
export interface TourRecord {
  kind: TourKind;
  wave: number;
  at: number;
  placement: number;
  entrants: {name: string; avatar?: string; player?: boolean; team: string[]}[];
  rounds: MatchRec[][];
}

/** Carreira do treinador: pontos, fama, títulos e histórico. */
export interface Career {
  cp: number;
  fame: number;
  titles: Partial<Record<TourKind, number>>;
  runnerUps: number;
  /** Venceu a última edição deste torneio (vai defender o título). */
  defending: Partial<Record<TourKind, boolean>>;
  history: TourRecord[];
}

export function emptyCareer(): Career {
  return {cp: 0, fame: 0, titles: {}, runnerUps: 0, defending: {}, history: []};
}

export const FAME_TIERS: [number, string][] = [
  [0, 'Desconhecido'], [100, 'Promessa'], [400, 'Conhecido'], [1200, 'Estrela'], [3000, 'Lenda'],
];

export function fameLabel(fame: number): string {
  return [...FAME_TIERS].reverse().find(([min]) => fame >= min)![1];
}

const BOT_NAMES = [
  'Bia', 'Caio', 'Duda', 'Léo', 'Mari', 'Rafa', 'Nina', 'Theo', 'Gabi', 'Vini', 'Lara', 'Hugo', 'Iara', 'Davi',
  'Lia', 'Enzo', 'Malu', 'Juca', 'Tati', 'Beto', 'Yuki', 'Kenji', 'Sofia', 'Marco', 'Aiko', 'Pietro', 'Chloé', 'Sam',
];

/** Time de um bot: Pokémon de vários biomas, sem repetir espécie. `skill` mexe no nível. */
export function botTeam(wave: number, size: number, skill: number): OwnedMon[] {
  const team: OwnedMon[] = [];
  for (let guard = 0; team.length < size && guard < 40; guard++) {
    const mon = generateEncounter(wave - 1, pick(BIOMES).id, false).mon;
    if (team.some(m => m.species === mon.species)) continue;
    team.push(mon);
  }
  // Mais habilidade = níveis um pouco maiores (o nível entra só no simulador).
  for (const m of team) m.level = Math.max(5, Math.min(100, m.level + skill));
  return team;
}

/** Nome do torneio: League Cup e Regional levam o nome da região onde acontecem. */
export function tourName(t: {kind: TourKind; region?: string}): string {
  const name = tourInfo(t.kind).name;
  return t.region && (t.kind === 'cup' || t.kind === 'regional') ? `${name} de ${getRegion(t.region).name}` : name;
}

export function createTournament(info: TourInfo, me: Omit<Entrant, 'team'>, region?: string): Tournament {
  const names = shuffle(BOT_NAMES).slice(0, 7);
  const bots: Entrant[] = names.map((name, i) => {
    const skill = randInt(-2, 2) + (info.kind === 'worlds' ? 2 : info.kind === 'international' ? 1 : 0);
    const vet = Math.random() < 0.3;
    const titles: Partial<Record<TourKind, number>> = {};
    if (vet) titles.cup = randInt(1, 4);
    if (vet && info.kind !== 'cup' && Math.random() < 0.5) titles.regional = 1;
    if (info.kind === 'worlds' && i === 0) titles.worlds = 1;
    return {
      name, avatar: pick(AVATARS), titles,
      runnerUps: Math.random() < 0.15 ? randInt(2, 4) : 0,
      fame: vet ? randInt(300, 1200) : randInt(0, 300),
      team: botTeam(info.wave, info.teamSize, skill),
    };
  });
  const entrants = shuffle([{...me, player: true, team: []}, ...bots]);
  return {kind: info.kind, wave: info.wave, region, entrants, rounds: [pairUp([0, 1, 2, 3, 4, 5, 6, 7])], stage: 'intro'};
}

function pairUp(ids: number[]): MatchRec[] {
  const out: MatchRec[] = [];
  for (let i = 0; i < ids.length; i += 2) out.push({a: ids[i], b: ids[i + 1]});
  return out;
}

export function playerIndex(t: Tournament): number {
  return t.entrants.findIndex(e => e.player);
}

/** Partida do jogador ainda sem resultado (null se já caiu ou acabou). */
export function playerMatch(t: Tournament): MatchRec | null {
  const me = playerIndex(t);
  const round = t.rounds[t.rounds.length - 1];
  return round.find(m => m.winner === undefined && (m.a === me || m.b === me)) ?? null;
}

export function currentRound(t: Tournament): number {
  return t.rounds.length - 1;
}

/** Simula uma partida entre dois times com a IA dos dois lados. */
export function simulateMatch(teamA: OwnedMon[], teamB: OwnedMon[], nameA: string, nameB: string): {winner: 0 | 1; highlights: string[]; left: number} {
  const battle = new Battle({formatid: 'gen9customgame' as never});
  battle.setPlayer('p1', {name: nameA, team: teamA.map(toSet)});
  battle.setPlayer('p2', {name: nameB, team: teamB.map(toSet)});
  if (battle.p1.requestState === 'teampreview') {
    battle.choose('p1', 'default');
    battle.choose('p2', 'default');
  }
  for (let guard = 0; !battle.ended && guard < 400; guard++) {
    for (const side of ['p1', 'p2'] as const) {
      const s = battle[side];
      if (battle.ended || s.isChoiceDone()) continue;
      if (s.requestState === 'move') battle.choose(side, aiMoveChoice(battle, side));
      else if (s.requestState === 'switch') battle.choose(side, aiSwitchChoice(battle, side));
    }
  }
  let winner: 0 | 1;
  if (battle.ended && battle.winner) winner = battle.winner === nameA ? 0 : 1;
  else {
    // Empate técnico (muitos turnos): ganha quem tem mais HP somado.
    const hp = (s: typeof battle.p1) => s.pokemon.reduce((a, p) => a + (p.fainted ? 0 : p.hp / p.maxhp), 0);
    winner = hp(battle.p1) >= hp(battle.p2) ? 0 : 1;
  }
  const side = winner === 0 ? battle.p1 : battle.p2;
  const left = side.pokemon.filter(p => !p.fainted).length;
  const highlights = highlightsFromLog(battle.log, nameA, nameB, winner === 0 ? nameA : nameB, left);
  return {winner, highlights, left};
}

/** Lances principais de uma partida (nocautes e críticos), lidos do log do Showdown. */
export function highlightsFromLog(log: string[], nameA: string, nameB: string, winnerName: string, left: number): string[] {
  const owner = (ident: string) => (ident.startsWith('p1') ? nameA : nameB);
  const mon = (ident: string) => ident.replace(/^p\d[a-z]?: /, '');
  const highlights: string[] = [];
  let last: {who: string; move: string} | null = null;
  for (const line of log) {
    const parts = line.split('|');
    if (parts[1] === 'move' && parts[3] !== 'Ação do Treinador') last = {who: `${mon(parts[2])} de ${owner(parts[2])}`, move: parts[3]};
    else if (parts[1] === '-crit' && last) highlights.push(`Crítico de ${last.who} com ${last.move}!`);
    else if (parts[1] === 'faint') {
      const victim = `${mon(parts[2])} de ${owner(parts[2])}`;
      highlights.push(last && last.who !== victim ? `${last.who} nocauteou ${victim} com ${last.move}.` : `${victim} desmaiou.`);
    }
  }
  highlights.push(`${winnerName} venceu com ${left} Pokémon de pé.`);
  return highlights;
}

/** Joga as partidas de bots que faltam na rodada atual e abre a próxima rodada quando ela acaba. */
function advance(t: Tournament): void {
  const round = t.rounds[t.rounds.length - 1];
  for (const m of round) {
    if (m.winner !== undefined) continue;
    const A = t.entrants[m.a];
    const B = t.entrants[m.b];
    if (A.player || B.player) continue;
    const r = simulateMatch(A.team, B.team, A.name, B.name);
    m.winner = r.winner === 0 ? m.a : m.b;
    m.teams = [A.team.map(x => x.species), B.team.map(x => x.species)];
    m.highlights = r.highlights;
    m.left = r.left;
  }
  if (round.some(m => m.winner === undefined)) return;
  if (round.length === 1) {
    t.stage = 'done';
    return;
  }
  t.rounds.push(pairUp(round.map(m => m.winner!)));
}

/** Resultado da partida do jogador. Se perder, o resto do torneio é simulado até a final. */
export function recordPlayerResult(t: Tournament, won: boolean, myTeam: string[], highlights: string[], left: number): void {
  const m = playerMatch(t);
  if (!m) return;
  const me = playerIndex(t);
  const foe = m.a === me ? m.b : m.a;
  m.winner = won ? me : foe;
  const foeTeam = t.entrants[foe].team.map(x => x.species);
  m.teams = m.a === me ? [myTeam, foeTeam] : [foeTeam, myTeam];
  m.highlights = highlights;
  m.left = left;
  if (!won) t.placement = [5, 3, 2][currentRound(t)];
  advance(t);
  if (!won) while (t.stage !== 'done') advance(t);
  else if (t.stage === 'done') t.placement = 1;
}

/** Índice da tabela de prêmios: 0 campeão, 1 vice, 2 semi, 3 quartas. */
export function prizeIndex(placement: number): number {
  return placement === 1 ? 0 : placement === 2 ? 1 : placement === 3 ? 2 : 3;
}

export function placementLabel(placement: number): string {
  return placement === 1 ? 'Campeão' : placement === 2 ? 'Vice' : placement === 3 ? 'Semifinal (top 4)' : 'Quartas (top 8)';
}

/** Aplica o resultado na carreira e guarda o torneio no histórico. */
export function applyToCareer(c: Career, t: Tournament): void {
  const info = tourInfo(t.kind);
  const i = prizeIndex(t.placement ?? 5);
  c.cp += info.cp[i];
  c.fame += info.fame[i];
  if (t.placement === 1) c.titles[t.kind] = (c.titles[t.kind] ?? 0) + 1;
  if (t.placement === 2) c.runnerUps++;
  c.defending[t.kind] = t.placement === 1;
  c.history.unshift({
    kind: t.kind, wave: t.wave, at: Date.now(), placement: t.placement ?? 5,
    entrants: t.entrants.map(e => ({name: e.name, avatar: e.avatar, player: e.player, team: e.team.map(m => m.species)})),
    rounds: t.rounds,
  });
  c.history = c.history.slice(0, 20);
}
