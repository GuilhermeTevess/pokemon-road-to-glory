import type {PokemonSet, Species} from '@pkmn/sim';
import {dex, movesAtLevel, movesLearnedAt, playableEvos, species} from '../data/dex';
import {getItem} from '../data/items';
import {STAT_IDS} from './types';
import type {OwnedMon, PendingEvent, StatTable} from './types';
import {chance, pick, randInt, uid} from './rng';

export const MAX_LEVEL = 100;
const NATURES = dex.natures.all().map(n => n.name);

export function zeroStats(v = 0): StatTable {
  return {hp: v, atk: v, def: v, spa: v, spd: v, spe: v};
}

export function randomIvs(min = 0, max = 31): StatTable {
  const t = zeroStats();
  for (const s of STAT_IDS) t[s] = randInt(min, max);
  return t;
}

export function expForLevel(level: number): number {
  return level <= 1 ? 0 : level ** 3;
}

export interface CreateOpts {
  level: number;
  ivMin?: number;
  ivs?: StatTable;
  shinyChance?: number;
  hiddenAbilityChance?: number;
}

export function createMon(speciesName: string, opts: CreateOpts): OwnedMon {
  const s = species(speciesName);
  const abilities = [s.abilities[0], s.abilities[1]].filter(Boolean) as string[];
  const hidden = s.abilities.H;
  const ability = hidden && chance(opts.hiddenAbilityChance ?? 0.05) ? hidden : pick(abilities);
  const gender = s.gender ? (s.gender as 'M' | 'F' | 'N') : chance(s.genderRatio.M) ? 'M' : 'F';
  const mon: OwnedMon = {
    uid: uid(),
    species: s.name,
    level: opts.level,
    exp: expForLevel(opts.level),
    moves: movesAtLevel(s, opts.level),
    ability,
    nature: pick(NATURES),
    gender,
    shiny: chance(opts.shinyChance ?? 1 / 256),
    ivs: opts.ivs ?? randomIvs(opts.ivMin ?? 0),
    evs: zeroStats(),
    hp: 0,
  };
  mon.hp = calcStats(mon).hp;
  return mon;
}

export function calcStats(mon: OwnedMon): StatTable {
  const s = species(mon.species);
  const nature = dex.natures.get(mon.nature);
  const out = zeroStats();
  for (const stat of STAT_IDS) {
    const base = s.baseStats[stat];
    const core = Math.floor(((2 * base + mon.ivs[stat] + Math.floor(mon.evs[stat] / 4)) * mon.level) / 100);
    if (stat === 'hp') {
      out.hp = s.id === 'shedinja' ? 1 : core + mon.level + 10;
    } else {
      let v = core + 5;
      if (nature.plus === stat) v = Math.floor(v * 1.1);
      if (nature.minus === stat) v = Math.floor(v * 0.9);
      out[stat] = v;
    }
  }
  return out;
}

export function maxHp(mon: OwnedMon): number {
  return calcStats(mon).hp;
}

export function isFainted(mon: OwnedMon): boolean {
  return mon.hp <= 0;
}

/** Converte para o formato de time do Showdown. */
export function toSet(mon: OwnedMon): PokemonSet {
  return {
    name: mon.species,
    species: mon.species,
    item: mon.item ? getItem(mon.item).showdown ?? '' : '',
    ability: mon.ability,
    moves: mon.moves,
    nature: mon.nature,
    gender: mon.gender === 'N' ? '' : mon.gender,
    evs: mon.evs,
    ivs: mon.ivs,
    level: mon.level,
    shiny: mon.shiny,
  };
}

// ---------------------------------------------------------------- Evolução

const FRIENDSHIP_LEVEL = 25;

function isLevelEvo(e: Species): boolean {
  return (!e.evoType && !!e.evoLevel) || e.evoType === 'levelFriendship';
}

/** Evoluções liberadas pelo nível atual. */
export function levelEvolutions(mon: OwnedMon): string[] {
  return playableEvos(species(mon.species))
    .filter(e => (!e.evoType && e.evoLevel && mon.level >= e.evoLevel) || (e.evoType === 'levelFriendship' && mon.level >= FRIENDSHIP_LEVEL))
    .map(e => e.name);
}

/** Evoluções liberadas pela Pedra da Evolução (pedras, troca, condições especiais). */
export function itemEvolutions(mon: OwnedMon): string[] {
  return playableEvos(species(mon.species)).filter(e => !isLevelEvo(e)).map(e => e.name);
}

export function evolve(mon: OwnedMon, into: string): void {
  const before = maxHp(mon);
  const from = species(mon.species);
  const to = species(into);
  // Mantém o slot de habilidade (0, 1 ou oculta).
  const slot = (Object.entries(from.abilities).find(([, a]) => a === mon.ability)?.[0] ?? '0') as '0';
  mon.species = to.name;
  mon.ability = to.abilities[slot] ?? to.abilities[0];
  const after = maxHp(mon);
  mon.hp = Math.max(1, Math.min(after, mon.hp + (after - before)));
  // Golpe de evolução (nível "0/1" na geração mais recente) é aprendido na hora.
  for (const m of movesLearnedAt(to, 1)) if (!mon.moves.includes(m) && mon.moves.length < 4) mon.moves.push(m);
}

/**
 * Adiciona experiência e devolve os eventos que pedem decisão do jogador
 * (golpes novos com 4 golpes já ocupados e evoluções).
 */
export function gainExp(mon: OwnedMon, amount: number): {levelsGained: number; events: PendingEvent[]} {
  const events: PendingEvent[] = [];
  let levelsGained = 0;
  mon.exp += amount;
  while (mon.level < MAX_LEVEL && mon.exp >= expForLevel(mon.level + 1)) {
    levelsGained += levelUp(mon, events);
  }
  return {levelsGained, events};
}

export function levelUp(mon: OwnedMon, events: PendingEvent[]): number {
  const before = maxHp(mon);
  mon.level++;
  mon.exp = Math.max(mon.exp, expForLevel(mon.level));
  if (mon.hp > 0) mon.hp += maxHp(mon) - before;
  for (const m of movesLearnedAt(species(mon.species), mon.level)) {
    if (mon.moves.includes(m)) continue;
    if (mon.moves.length < 4) mon.moves.push(m);
    else events.push({kind: 'learnMove', uid: mon.uid, move: m});
  }
  const evos = levelEvolutions(mon);
  if (evos.length && !events.some(e => e.kind === 'evolve' && e.uid === mon.uid)) {
    events.push({kind: 'evolve', uid: mon.uid, into: evos});
  }
  return 1;
}

/** XP de derrotar um Pokémon (curva ajustada para ~1 nível por ronda). */
export function expYield(defeated: OwnedMon, boss: boolean): number {
  const s = species(defeated.species);
  return Math.floor(((s.bst * defeated.level) / 4) * (boss ? 1.5 : 1));
}
