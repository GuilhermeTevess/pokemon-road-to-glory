// Torneios da temporada (rondas 30, 60, 90 e 120): chave de 8 com eliminação simples.
// As partidas entre bots são simuladas de verdade no Showdown, para dar para estudar os times depois.
import {Battle} from '@pkmn/sim';
import {BIOMES} from '../data/biomes';
import {getRegion} from '../data/regions';
import {aiMoveChoice, aiSwitchChoice} from './battle';
import {generateEncounter} from './encounters';
import {createMon, toSet} from './mon';
import {RIVALS, rivalsOf} from '../data/rivals';
import type {Rival} from '../data/rivals';
import type {NarratorCtx} from './narration';
import {botLevel} from './world';
import type {World, WorldBot} from './world';
import {hashText, pick, randInt, shuffle, withSeed} from './rng';
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
  /** Outro jogador da carreira online: as partidas contra ele são ao vivo. */
  friend?: boolean;
  /** Id do jogador na carreira (você ou um amigo). */
  pid?: string;
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
  /** Torneio da carreira online: igual em todos os PCs (`tid`), `me` = seu id de jogador. */
  shared?: {tid: string; me: string; ready?: boolean};
}

/** Resultado de uma partida guardado na nuvem (partidas com jogadores). */
export interface MatchResult {
  tid: string;
  key: string;
  winner: number;
  teams?: [string[], string[]];
  highlights?: string[];
  left?: number;
}

/** Registro guardado na coleção (histórico de torneios). */
export interface TourRecord {
  kind: TourKind;
  wave: number;
  at: number;
  placement: number;
  entrants: {name: string; avatar?: string; player?: boolean; friend?: boolean; team: string[]}[];
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

/** Time de um rival conhecido: os Pokémon famosos dele, no nível da ronda. */
/** Itens que os rivais costumam levar (cada Pokémon de cada rival tem o seu, sempre o mesmo). */
const RIVAL_ITEMS = ['leftovers', 'sitrusberry', 'lumberry', 'choiceband', 'choicespecs', 'choicescarf', 'lifeorb', 'focussash', 'expertbelt', 'assaultvest', 'rockyhelmet', 'weaknesspolicy'];

function hash(text: string): number {
  return [...text].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
}

/** O item "de sempre" daquele Pokémon daquele rival. */
export function rivalItem(rival: string, speciesName: string): string {
  return RIVAL_ITEMS[hash(rival + speciesName) % RIVAL_ITEMS.length];
}

/**
 * Time de um rival no torneio: os 2 primeiros (os carros-chefes) sempre vão; o resto sai
 * sorteado do elenco dele, então nem sempre é o mesmo time.
 */
export function rivalTeam(rival: Rival, wave: number, size: number, skill: number): OwnedMon[] {
  const level = Math.max(5, Math.min(100, Math.round(wave * 0.9) + 1 + skill));
  const core = rival.team.slice(0, Math.min(2, size));
  const picked = [...core, ...shuffle(rival.team.slice(2)).slice(0, size - core.length)];
  // Quem abre a luta também varia (mas costuma ser um dos carros-chefes).
  if (Math.random() < 0.35) picked.unshift(...picked.splice(randInt(0, picked.length - 1), 1));
  return picked.map(name => {
    const mon = createMon(name, {level, ivMin: 10, shinyChance: 0, hiddenAbilityChance: 0.1});
    mon.item = rivalItem(rival.name, name);
    return mon;
  });
}

/** Quem joga: na League Cup e no Regional, os rivais da região primeiro; no Internacional e no Mundial, gente de todo lugar. */
function pickRivals(kind: TourKind, region?: string): Rival[] {
  const local = kind === 'cup' || kind === 'regional' ? shuffle(rivalsOf(region)) : [];
  const rest = shuffle(RIVALS.filter(r => !local.includes(r)));
  return [...local, ...rest].slice(0, 7);
}

export function createTournament(info: TourInfo, me: Omit<Entrant, 'team'>, region?: string, guests: Entrant[] = [], world?: World): Tournament {
  const need = 7 - guests.length;
  // Com o mundo da temporada, quem joga são os rivais que estão jogando com você (time e nível de agora).
  const fromWorld = world ? pickWorldBots(world, info.kind, region).slice(0, need) : [];
  const worldBots: Entrant[] = fromWorld.map(b => ({
    name: b.name, avatar: b.avatar, titles: {}, runnerUps: 0, fame: b.banked + b.points,
    team: worldTeam(b, info.wave, info.teamSize),
  }));
  const rivals = pickRivals(info.kind, region)
    .filter(r => !worldBots.some(w => w.name === r.name))
    .slice(0, need - worldBots.length);
  const bots: Entrant[] = rivals.map((rival, i) => {
    const name = rival.name;
    const skill = randInt(-2, 2) + (info.kind === 'worlds' ? 2 : info.kind === 'international' ? 1 : 0);
    const vet = Math.random() < 0.3;
    const titles: Partial<Record<TourKind, number>> = {};
    if (vet) titles.cup = randInt(1, 4);
    if (vet && info.kind !== 'cup' && Math.random() < 0.5) titles.regional = 1;
    if (info.kind === 'worlds' && i === 0) titles.worlds = 1;
    return {
      name, avatar: rival.avatar, titles,
      runnerUps: Math.random() < 0.15 ? randInt(2, 4) : 0,
      fame: vet ? randInt(300, 1200) : randInt(0, 300),
      team: rivalTeam(rival, info.wave, info.teamSize, skill),
    };
  });
  const entrants = shuffle([{...me, player: true, team: []}, ...guests, ...worldBots, ...bots]);
  return {kind: info.kind, wave: info.wave, region, entrants, rounds: [pairUp([0, 1, 2, 3, 4, 5, 6, 7])], stage: 'intro'};
}

/** Rivais do mundo para o torneio: nos locais, quem está na região; nos grandes, os mais famosos. */
function pickWorldBots(world: World, kind: TourKind, region?: string): WorldBot[] {
  const score = (b: WorldBot) => b.points + b.banked + Math.random() * 120;
  const ranked = [...world.bots].sort((a, b) => score(b) - score(a));
  if (kind !== 'cup' && kind !== 'regional') return ranked;
  return [...ranked.filter(b => b.region === region), ...ranked.filter(b => b.region !== region)];
}

/** Time de um rival do mundo: o time que ele está usando, no nível dele nesta ronda. */
export function worldTeam(b: WorldBot, wave: number, size: number): OwnedMon[] {
  const level = botLevel(b, wave);
  const team = [...b.team];
  // Quem abre a luta varia um pouco.
  if (Math.random() < 0.35 && team.length > 1) team.unshift(...team.splice(randInt(0, Math.min(size, team.length) - 1), 1));
  return team.slice(0, size).map(name => {
    const mon = createMon(name, {level, ivMin: 10, shinyChance: 0, hiddenAbilityChance: 0.1});
    mon.item = rivalItem(b.name, name);
    return mon;
  });
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
export function simulateMatch(teamA: OwnedMon[], teamB: OwnedMon[], nameA: string, nameB: string, seed?: string): {winner: 0 | 1; highlights: string[]; left: number} {
  // Com semente, o resultado é o mesmo em qualquer PC (torneio da carreira online).
  if (seed) {
    const h = hashText(seed).toString(16).padStart(8, '0');
    return withSeed(seed, () => runMatch(new Battle({formatid: 'gen9customgame' as never, seed: `gen5,${h}${h}` as never}), teamA, teamB, nameA, nameB));
  }
  return runMatch(new Battle({formatid: 'gen9customgame' as never}), teamA, teamB, nameA, nameB);
}

function runMatch(battle: Battle, teamA: OwnedMon[], teamB: OwnedMon[], nameA: string, nameB: string): {winner: 0 | 1; highlights: string[]; left: number} {
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
  if (t.shared) {
    // Carreira online: as partidas dos outros jogadores chegam pela nuvem.
    if (!won) t.stage = 'done';
    sharedAdvance(t, {});
    return;
  }
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

/** Posições na chave para os jogadores ficarem o mais longe possível (2 = um em cada ponta, 4 = um por chave). */
const SPREAD = [0, 4, 2, 6, 1, 5, 3, 7];

/** Chave de uma partida: rodada_índice. */
export const matchKey = (round: number, index: number) => `${round}_${index}`;

/**
 * Torneio da carreira online: todo mundo monta a mesma chave (mesma semente), com os
 * jogadores espalhados para só se cruzarem o mais tarde possível.
 */
export function createSharedTournament(
  info: TourInfo,
  players: (Omit<Entrant, 'team'> & {pid: string; team: OwnedMon[]})[],
  me: string,
  tid: string,
  region?: string,
  world?: World,
): Tournament {
  return withSeed(tid, () => {
    const humans = [...players].sort((a, b) => a.pid.localeCompare(b.pid)).slice(0, 8);
    const bots = createTournament(info, {name: '_', titles: {}, runnerUps: 0, fame: 0}, region, [], world).entrants.filter(e => !e.player);
    const slots: Entrant[] = new Array(8);
    humans.forEach((p, i) => (slots[SPREAD[i]] = {...p, player: p.pid === me, friend: p.pid !== me}));
    let b = 0;
    for (let i = 0; i < 8; i++) if (!slots[i]) slots[i] = bots[b++];
    return {kind: info.kind, wave: info.wave, region, entrants: slots, rounds: [pairUp([0, 1, 2, 3, 4, 5, 6, 7])], stage: 'intro', shared: {tid, me}};
  });
}

/**
 * Usa a chave que está na nuvem (a primeira que alguém montou): assim todo mundo joga
 * exatamente o mesmo torneio, com os mesmos bots.
 */
export function adoptShared(t: Tournament, doc: {region?: string; entrants: Entrant[]}): void {
  const me = t.shared!.me;
  const mine = t.entrants.find(e => e.player);
  t.region = doc.region;
  t.entrants = doc.entrants.map(e => (e.pid === me && mine ? {...e, ...mine, pid: me, player: true, friend: false} : {...e, player: e.pid === me, friend: !!e.pid && e.pid !== me}));
  t.shared!.ready = true;
}

/** Partidas entre bots da rodada atual que ainda não têm resultado. */
export function botPending(t: Tournament): {key: string; round: number; index: number}[] {
  const r = t.rounds.length - 1;
  return t.rounds[r].flatMap((m, i) => (m.winner === undefined && !t.entrants[m.a].pid && !t.entrants[m.b].pid ? [{key: matchKey(r, i), round: r, index: i}] : []));
}

/** Simula uma partida entre bots (quem simular primeiro grava na nuvem; os outros usam esse resultado). */
export function simulateBotMatch(t: Tournament, round: number, index: number): MatchResult {
  const m = t.rounds[round][index];
  const A = t.entrants[m.a];
  const B = t.entrants[m.b];
  const sim = simulateMatch(A.team, B.team, A.name, B.name);
  return {tid: t.shared!.tid, key: matchKey(round, index), winner: sim.winner === 0 ? m.a : m.b, teams: [A.team.map(x => x.species), B.team.map(x => x.species)], highlights: sim.highlights, left: sim.left};
}

/**
 * Avança o torneio compartilhado com os resultados da nuvem (bots e jogadores).
 * Para quando falta algum resultado.
 */
export function sharedAdvance(t: Tournament, results: Record<string, MatchResult>): void {
  const me = playerIndex(t);
  for (let guard = 0; guard < 4; guard++) {
    const r = t.rounds.length - 1;
    const round = t.rounds[r];
    round.forEach((m, i) => {
      if (m.winner !== undefined) return;
      const res = results[matchKey(r, i)];
      if (!res) return;
      m.winner = res.winner;
      m.teams = res.teams;
      m.highlights = res.highlights;
      m.left = res.left;
      if ((m.a === me || m.b === me) && res.winner !== me && t.stage !== 'done') {
        t.placement = [5, 3, 2][r];
        t.stage = 'done';
      }
    });
    if (round.some(m => m.winner === undefined)) return;
    if (round.length === 1) {
      if (round[0].winner === me) {
        t.placement = 1;
        t.stage = 'done';
      }
      return;
    }
    t.rounds.push(pairUp(round.map(m => m.winner!)));
  }
}

/** Partida do jogador que ainda não tem resultado: rodada, índice e adversário. */
export function myPending(t: Tournament): {round: number; index: number; foe: Entrant; foeIndex: number} | null {
  const me = playerIndex(t);
  const r = t.rounds.length - 1;
  const i = t.rounds[r].findIndex(m => (m.a === me || m.b === me) && m.winner === undefined);
  if (i < 0) return null;
  const m = t.rounds[r][i];
  const foeIndex = m.a === me ? m.b : m.a;
  return {round: r, index: i, foe: t.entrants[foeIndex], foeIndex};
}
