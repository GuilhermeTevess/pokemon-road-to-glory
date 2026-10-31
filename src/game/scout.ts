// Estudo do adversário com "névoa": o PokéPC só sabe o que é público.
// - Lutas públicas (Ginásio, Torneio, Lenda) saem no noticiário, mas cada notícia só cita
//   até 2 Pokémon (os destaques), e só as últimas 3 lutas ficam no banco de dados.
// - Quem você já enfrentou numa luta sua aparece inteiro (você viu com os próprios olhos).
// - Nada de rondas por Pokémon, itens ou com quem abre: isso entregava o time.
import {RIVALS, getRival} from '../data/rivals';
import type {CareerFight, PlayerDoc} from './career';
import type {WorldBot} from './world';

export interface ScoutSeen {
  species: string;
  /** Em quantas notícias de lutas públicas ele apareceu. */
  news: number;
  /** Você já enfrentou esse Pokémon numa luta sua contra esse treinador. */
  faced: boolean;
}

export interface ScoutMatch {
  /** Tipo da luta (Ginásio, Torneio...). */
  label?: string;
  vs: string;
  won: boolean;
  /** Destaques daquela luta (no máximo 2). */
  seen: string[];
}

export interface ScoutReport {
  /** Pokémon conhecidos: os que você enfrentou primeiro, depois os mais citados. */
  seen: ScoutSeen[];
  matches: ScoutMatch[];
}

/** Lutas que saem no noticiário. Selvagens, chefes e rivais de rota são privados. */
const PUBLIC: CareerFight['kind'][] = ['gym', 'tour', 'legend'];
/** Quantas lutas públicas o PC guarda e quantos Pokémon cada notícia cita. */
export const SCOUT_FIGHTS = 3;
export const SCOUT_PER_FIGHT = 2;

const FIGHT_LABEL = {gym: 'Ginásio', tour: 'Torneio', legend: 'Lenda', boss: 'Chefe', rival: 'Rival'} as const;

function hash(text: string): number {
  return [...text].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

/** Os destaques de uma luta: até 2 Pokémon, sempre os mesmos para a mesma luta. */
export function glimpse(seen: string[], key: string): string[] {
  const rand = seeded(hash(key));
  return [...seen].map(s => [s, rand()] as const).sort((a, b) => a[1] - b[1]).slice(0, SCOUT_PER_FIGHT).map(([s]) => s);
}

/** Lutas públicas, como o noticiário conta (as últimas 3, com até 2 destaques cada). */
export function publicFights(fights: CareerFight[]): ScoutMatch[] {
  return fights
    .filter(f => PUBLIC.includes(f.kind))
    .slice(0, SCOUT_FIGHTS)
    .map(f => ({label: FIGHT_LABEL[f.kind], vs: f.vs, won: f.won, seen: glimpse(f.seen, `${f.kind}|${f.vs}|${f.wave}`)}));
}

function build(matches: ScoutMatch[], faced: string[]): ScoutReport {
  const news = new Map<string, number>();
  for (const m of matches) for (const s of m.seen) news.set(s, (news.get(s) ?? 0) + 1);
  const names = [...new Set([...faced, ...news.keys()])];
  const seen = names
    .map(s => ({species: s, news: news.get(s) ?? 0, faced: faced.includes(s)}))
    .sort((a, b) => Number(b.faced) - Number(a.faced) || b.news - a.news);
  return {seen, matches};
}

/**
 * Rival da lista fixa (fora do mundo da carreira): inventa 3 lutas públicas recentes,
 * quase sempre com Pokémon do time de hoje, mas cada uma só cita 2.
 */
export function scoutReport(name: string, wave: number, team: string[], faced: string[] = []): ScoutReport | null {
  const rival = getRival(name);
  if (!rival) return null;
  const rand = seeded(hash(`${name}|${wave}`));
  const bench = rival.team.filter(s => !team.includes(s));
  const others = RIVALS.filter(r => r.name !== name);
  const matches: ScoutMatch[] = Array.from({length: SCOUT_FIGHTS}, () => {
    const pool = [...team, ...(rand() < 0.5 ? bench.slice(0, 1) : [])];
    const seen = [...pool].sort(() => rand() - 0.5).slice(0, SCOUT_PER_FIGHT);
    return {label: rand() < 0.5 ? 'Torneio' : 'Ginásio', vs: others[Math.floor(rand() * others.length)].name, won: rand() < 0.6, seen};
  });
  return build(matches, faced);
}

/** Névoa a partir de uma lista de lutas (perfis). */
export function playerScoutFromFights(fights: CareerFight[], faced: string[] = []): ScoutReport {
  return build(publicFights(fights), faced);
}

/** Jogador da carreira: só as lutas públicas dele e o que você já enfrentou. */
export function playerScout(p: PlayerDoc, faced: string[] = []): ScoutReport {
  return build(publicFights(p.fights ?? []), faced);
}

/** Rival do mundo da temporada: só as lutas públicas dele e o que você já enfrentou. */
export function botScout(b: WorldBot, faced: string[] = []): ScoutReport {
  return build(publicFights(b.fights), faced);
}
