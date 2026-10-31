// Estudo do adversário: em vez de mostrar o time exato, mostra as estatísticas da temporada
// (quem ele mais jogou, quantas rondas, itens) e as últimas batalhas. O time de hoje sai
// desses números, mas sempre fica uma dúvida: o elenco dele é maior que o time.
import {RIVALS, getRival} from '../data/rivals';
import {getItem} from '../data/items';
import {rivalItem} from './tournament';
import type {CareerFight, PlayerDoc} from './career';
import type {WorldBot} from './world';

export interface ScoutUse {
  species: string;
  /** Em quantas rondas da temporada ele usou esse Pokémon. */
  rounds: number;
  /** Item que costuma levar nele. */
  item: string;
}

export interface ScoutMatch {
  /** Tipo da luta (Ginásio, Torneio...), quando é um jogador de verdade. */
  label?: string;
  vs: string;
  won: boolean;
  /** Pokémon que apareceram naquela luta. */
  seen: string[];
}

export interface ScoutReport {
  /** Uso de cada Pokémon na temporada, do mais jogado ao menos jogado. */
  usage: ScoutUse[];
  matches: ScoutMatch[];
  /** Com quem costuma abrir (nem sempre). */
  lead?: string;
  /** Rondas jogadas na temporada até agora. */
  season: number;
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

/**
 * `team` é o time que o rival trouxe para ESTE torneio (o que ele vai usar de verdade).
 * Os Pokémon do time aparecem bem jogados; os que ficaram no banco aparecem menos.
 */
export function scoutReport(name: string, wave: number, team: string[]): ScoutReport | null {
  const rival = getRival(name);
  if (!rival) return null;
  const rand = seeded([...name].reduce((a, c) => a * 31 + c.charCodeAt(0), wave) >>> 0);
  const season = Math.max(10, wave);
  const bench = rival.team.filter(s => !team.includes(s));
  const usage: ScoutUse[] = [
    ...team.map((s, i) => ({species: s, rounds: Math.round(season * (i < 2 ? 0.8 + rand() * 0.2 : 0.5 + rand() * 0.35))})),
    // Quem está no banco também já jogou, só que menos (é o que deixa a dúvida).
    ...bench.map(s => ({species: s, rounds: Math.round(season * (0.15 + rand() * 0.4))})),
  ]
    .map(u => ({...u, item: getItem(rivalItem(name, u.species)).name}))
    .sort((a, b) => b.rounds - a.rounds);
  const others = RIVALS.filter(r => r.name !== name);
  const matches: ScoutMatch[] = Array.from({length: 3}, () => {
    // Em cada luta apareceram 2 ou 3 Pokémon, quase sempre do time de agora.
    const pool = [...team, ...(rand() < 0.5 ? bench.slice(0, 1) : [])];
    const seen = [...pool].sort(() => rand() - 0.5).slice(0, 2 + Math.floor(rand() * 2));
    return {vs: others[Math.floor(rand() * others.length)].name, won: rand() < 0.6, seen};
  });
  return {usage, matches, season, lead: rand() < 0.7 ? team[0] : undefined};
}

const FIGHT_LABEL = {gym: 'Ginásio', tour: 'Torneio', legend: 'Lenda', boss: 'Chefe', rival: 'Rival'} as const;

/** Estudo de um jogador da carreira: números reais da temporada dele (uso, lutas importantes). */
export function playerScout(p: PlayerDoc): ScoutReport {
  const items = new Map(p.team.map(m => [m.species, m.item ? getItem(m.item).name : '—']));
  return realScout(p.usage ?? {}, p.fights ?? [], sp => items.get(sp) ?? '—', p.round, p.team[0]?.species);
}

/** Estudo de um rival do mundo da temporada: o que ele jogou de verdade. */
export function botScout(b: WorldBot): ScoutReport {
  return realScout(b.usage, b.fights, sp => getItem(rivalItem(b.name, sp)).name, 1, b.team[0]);
}

function realScout(usageMap: Record<string, number>, fights: CareerFight[], item: (sp: string) => string, round: number, lead?: string): ScoutReport {
  const usage = Object.entries(usageMap)
    .map(([sp, rounds]) => ({species: sp, rounds, item: item(sp)}))
    .sort((a, b) => b.rounds - a.rounds);
  const matches = fights.slice(0, 6).map(f => ({label: FIGHT_LABEL[f.kind], vs: f.vs, won: f.won, seen: f.seen}));
  return {usage, matches, season: Math.max(1, round, ...usage.map(u => u.rounds)), lead};
}
