// Carreira multiplayer: o host cria com regras, os amigos entram com o código e cada um
// joga a própria run no seu tempo. Nos torneios, as chaves usam os times reais de todo mundo.
import {species} from '../data/dex';
import {isLegendary} from '../data/dex';
import {SEASON_LENGTH} from './encounters';
import {expForLevel} from './mon';
import {uid} from './rng';
import type {OwnedMon, RunState} from './types';

export interface CareerRules {
  /** Pode entrar com um treinador que já existe (com a coleção dele). Padrão: não, todo mundo do zero. */
  allowCollection: boolean;
  /** Rondas por temporada: 120 (completa), 60 ou 24. */
  rounds: 120 | 60 | 24;
  /** Quantas temporadas a carreira tem. */
  seasons: number;
  /** Máximo de lendários no time (6 = sem limite). */
  legendCap: number;
  /** Nível máximo dos Pokémon (100 = sem limite). */
  levelCap: number;
  /** Mega evolução liberada. */
  megas: boolean;
  /** Multiplicador de EXP e dinheiro. */
  boost: 1 | 1.5 | 2;
}

/** Máximo de jogadores numa carreira (a chave dos torneios tem 8 lugares). */
export const MAX_PLAYERS = 8;

export const DEFAULT_RULES: CareerRules = {allowCollection: false, rounds: 120, seasons: 3, legendCap: 1, levelCap: 100, megas: true, boost: 1};

export interface CareerDoc {
  code: string;
  name: string;
  host: string;
  createdAt: number;
  rules: CareerRules;
}

/** Pokémon do time como os outros jogadores veem (o suficiente para o simulador). */
export type SnapMon = Pick<OwnedMon, 'species' | 'level' | 'moves' | 'ability' | 'nature' | 'gender' | 'shiny' | 'ivs' | 'evs' | 'item' | 'nickname'>;

export interface CareerResult {
  season: number;
  kind: string;
  placement: number;
}

export interface PlayerDoc {
  id: string;
  name: string;
  avatar: string;
  /** Temporada em que está (1, 2, ...). */
  season: number;
  round: number;
  /** Pontos da temporada atual e soma das temporadas já terminadas. */
  points: number;
  banked: number;
  /** Time atual e o time usado em cada torneio desta temporada. */
  team: SnapMon[];
  tours: Partial<Record<string, SnapMon[]>>;
  results: CareerResult[];
  /** Terminou todas as temporadas. */
  done?: boolean;
  /** Última ronda de jogo (wave) que terminou nesta temporada: as rondas andam juntas. */
  cleared?: number;
  /** A run desta temporada acabou (perdeu): não segura os outros. */
  out?: boolean;
  /** De onde vêm os pontos da temporada (para o ranking). */
  log?: {label: string; pts: number}[];
  /** Para estudar o jogador: rondas jogadas com cada Pokémon e as últimas lutas importantes. */
  usage?: Record<string, number>;
  fights?: CareerFight[];
  /** Insígnias da temporada (como ganhou), lendas vencidas e o parceiro. */
  badges?: {gym: string; wave: number; team: string[]; tries: number}[];
  legends?: string[];
  partner?: string;
  updatedAt: number;
}

/** Luta importante (ginásio, torneio, lenda, chefe, rival) para os outros estudarem. */
export interface CareerFight {
  vs: string;
  won: boolean;
  seen: string[];
  kind: 'gym' | 'tour' | 'legend' | 'boss' | 'rival';
  wave: number;
}

/** O que a run guarda da carreira. */
export interface RunCareer {
  code: string;
  season: number;
  rules: CareerRules;
  /** Time levado a cada torneio desta temporada (os outros jogadores enfrentam este time). */
  tours?: Partial<Record<string, SnapMon[]>>;
  usage?: Record<string, number>;
  fights?: CareerFight[];
}

export function newCareerCode(): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}

/** Id deste navegador (vira o id do jogador nas carreiras). */
export function deviceId(): string {
  try {
    let id = localStorage.getItem('rtg-device');
    if (!id) localStorage.setItem('rtg-device', (id = uid()));
    return id;
  } catch {
    return 'anon';
  }
}

/** Quantas rondas de jogo cada ronda da carreira pula (120 → 1, 60 → 2, 24 → 5). */
export function waveStep(run: Pick<RunState, 'career'> | null | undefined): number {
  const rounds = run?.career?.rules.rounds ?? SEASON_LENGTH;
  return Math.max(1, Math.round(SEASON_LENGTH / rounds));
}

/** Ronda mostrada ao jogador (numa carreira curta, a ronda 5 de 24 é a ronda de jogo 25). */
export function roundOf(run: Pick<RunState, 'wave' | 'career'>): number {
  return Math.ceil(run.wave / waveStep(run));
}

export function roundsOf(run: Pick<RunState, 'career'> | null | undefined): number {
  return SEASON_LENGTH / waveStep(run);
}

/** EXP e dinheiro: compensa as rondas puladas e aplica o bônus do host. */
export function careerBoost(run: Pick<RunState, 'career'>): number {
  return waveStep(run) * (run.career?.rules.boost ?? 1);
}

export function snapMon(m: OwnedMon): SnapMon {
  const {species: s, level, moves, ability, nature, gender, shiny, ivs, evs, item, nickname} = m;
  return {species: s, level, moves, ability, nature, gender, shiny, ivs, evs, item, nickname};
}

export function fromSnap(s: SnapMon): OwnedMon {
  return {...structuredClone(s), uid: uid(), exp: expForLevel(s.level), hp: 1};
}

export function isLegendMon(m: {species: string}): boolean {
  return isLegendary(species(m.species));
}

/**
 * Aplica as regras do host no time: lendários além do limite vão para a caixa e ninguém
 * passa do nível máximo. Devolve avisos para mostrar ao jogador.
 */
export function enforceRules(run: RunState): string[] {
  const rules = run.career?.rules;
  if (!rules) return [];
  const notes: string[] = [];
  if (rules.legendCap < 6) {
    let legends = 0;
    for (const m of [...run.party]) {
      if (!isLegendMon(m)) continue;
      if (++legends <= rules.legendCap || run.party.length <= 1) continue;
      run.party = run.party.filter(p => p !== m);
      run.box.push(m);
      notes.push(`Regra da carreira: no máximo ${rules.legendCap} lendário(s) no time. ${m.species} foi para a caixa.`);
    }
  }
  if (rules.levelCap < 100) {
    // O teto vale para todo mundo: selvagens, chefes, ginásios e torneios também param nele.
    const foes = [run.encounter?.mon, ...(run.encounter?.team ?? []), ...(run.tournament?.entrants.flatMap(e => e.team) ?? [])];
    for (const m of foes) if (m && m.level > rules.levelCap) m.level = rules.levelCap;
    for (const m of [...run.party, ...run.box]) {
      if (m.level <= rules.levelCap) continue;
      m.level = rules.levelCap;
      m.exp = expForLevel(rules.levelCap);
    }
  }
  return notes;
}

/** Texto curto das regras para mostrar no lobby. */
export function rulesSummary(r: CareerRules): string[] {
  return [
    r.allowCollection ? 'Pode usar treinador já criado' : 'Todo mundo começa do zero',
    `${r.rounds} rondas por temporada · ${r.seasons} temporada${r.seasons > 1 ? 's' : ''}`,
    r.legendCap >= 6 ? 'Lendários sem limite' : r.legendCap === 0 ? 'Sem lendários no time' : `Até ${r.legendCap} lendário${r.legendCap > 1 ? 's' : ''} no time`,
    r.levelCap >= 100 ? 'Sem nível máximo' : `Nível máximo ${r.levelCap}`,
    r.megas ? 'Mega evolução liberada' : 'Sem mega evolução',
    r.boost === 1 ? 'EXP e dinheiro normais' : `EXP e dinheiro x${r.boost}`,
  ];
}

/** Classificação: pontos das temporadas terminadas + a atual. */
export function standings(players: PlayerDoc[]): PlayerDoc[] {
  return [...players].sort((a, b) => b.banked + b.points - (a.banked + a.points) || b.season - a.season || b.round - a.round);
}

/** Id do jogador na carreira (este navegador + o treinador). */
export const playerId = (trainerId: string) => deviceId() + '-' + trainerId;

/**
 * Quem ainda não terminou a ronda `wave` desta temporada (as rondas andam juntas).
 * Quem perdeu a run, já terminou a carreira ou está numa temporada à frente não segura ninguém.
 */
export function roundBlockers(peers: PlayerDoc[], me: string, season: number, wave: number): PlayerDoc[] {
  return peers.filter(p => p.id !== me && !p.done && !p.out && p.season === season && (p.cleared ?? 0) < wave);
}

/** Quem ainda está jogando uma temporada anterior (ninguém começa a próxima antes de todos acabarem). */
export function seasonBlockers(peers: PlayerDoc[], me: string, season: number): PlayerDoc[] {
  return peers.filter(p => p.id !== me && !p.done && p.season < season);
}

/** Extrato agrupado: soma os pontos por descrição. */
export function groupLog(entries: {label: string; pts: number}[]): {label: string; pts: number}[] {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.label, (map.get(e.label) ?? 0) + e.pts);
  return [...map].map(([label, pts]) => ({label, pts})).sort((a, b) => b.pts - a.pts);
}
