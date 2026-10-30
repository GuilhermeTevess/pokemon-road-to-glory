// Creche (Parte C): dois Pokémon da coleção do mesmo egg group fazem um ovo. O ovo vai
// junto numa run e choca depois de algumas rondas vencidas; o filhote alimenta a ficha.
import {allLearnable, eggMoves, rarityOf, species} from '../data/dex';
import {getItem} from '../data/items';
import type {Collection} from './meta';
import {entryOf, gendersOf, lineAbilities, lineRoot, ALL_NATURES} from './meta';
import {createMon} from './mon';
import {chance, pick, randInt, shuffle, uid} from './rng';
import {STAT_IDS} from './types';
import type {OwnedMon, StatId, StatTable} from './types';

export interface Egg {
  id: string;
  /** Espécie que vai nascer (forma básica da "mãe"). */
  species: string;
  ivs: StatTable;
  nature: string;
  ability: string;
  eggMove?: string;
  shiny: boolean;
  /** Rondas vencidas para chocar. */
  waves: number;
  parents: [string, string];
}

export const MAX_EGGS = 3;
export const EGG_PRICE = 10;
/** Itens que podem ficar guardados para a creche. */
export const DAYCARE_ITEMS = ['everstone', 'destinyknot', 'powerweight', 'powerbracer', 'powerbelt', 'powerlens', 'powerband', 'poweranklet'];

export function canBreedSpecies(name: string): boolean {
  return !species(name).eggGroups.includes('Undiscovered');
}

/** Os dois podem fazer um ovo? Devolve o motivo quando não. */
export function compatibility(a: string, b: string, c?: Collection): {ok: true; child: string} | {ok: false; why: string} {
  const sa = species(a);
  const sb = species(b);
  if (!canBreedSpecies(a) || !canBreedSpecies(b)) return {ok: false, why: 'Lendários e bebês não fazem ovos.'};
  const dittoA = sa.name === 'Ditto';
  const dittoB = sb.name === 'Ditto';
  if (dittoA && dittoB) return {ok: false, why: 'Dois Ditto não fazem ovo.'};
  if (dittoA || dittoB) return {ok: true, child: lineRoot(dittoA ? b : a)};
  if (sa.gender === 'N' || sb.gender === 'N') return {ok: false, why: 'Pokémon sem gênero só fazem ovo com Ditto.'};
  const shared = sa.eggGroups.filter(g => sb.eggGroups.includes(g));
  if (!shared.length) return {ok: false, why: `Egg groups diferentes (${sa.eggGroups.join('/')} e ${sb.eggGroups.join('/')}).`};
  if (c) {
    if (!gendersOf(c, a).includes('F')) return {ok: false, why: `Você ainda não capturou um ${sa.name} fêmea (♀) para ser a mãe.`};
    if (!gendersOf(c, b).includes('M')) return {ok: false, why: `Você ainda não capturou um ${sb.name} macho (♂) para ser o pai.`};
  }
  return {ok: true, child: lineRoot(a)};
}

export function hatchWaves(name: string): number {
  const r = rarityOf(species(name));
  return r === 'common' ? 5 : r === 'uncommon' || r === 'rare' ? 10 : 15;
}

/**
 * Faz o ovo. `mother` dá a espécie; `items` são os itens que cada pai segura
 * (gastos ao fazer o ovo).
 */
export function makeEgg(c: Collection, mother: string, father: string, items: [string | null, string | null]): Egg | null {
  const comp = compatibility(mother, father, c);
  if (!comp.ok) return null;
  const parents = [entryOf(c, mother), entryOf(c, father)];
  const childName = species(comp.child).name;

  // IVs: 3 herdados (5 com Destiny Knot); itens Power garantem aquele atributo.
  const ivs = {} as StatTable;
  for (const s of STAT_IDS) ivs[s] = randInt(0, 31);
  const knot = items.includes('destinyknot');
  const forced: [StatId, number][] = [];
  items.forEach((it, i) => {
    const stat = it ? getItem(it).evStat : undefined;
    if (stat) forced.push([stat, i]);
  });
  const inherit = new Map<StatId, number>(forced.map(([s, i]) => [s, i]));
  for (const s of shuffle([...STAT_IDS])) {
    if (inherit.size >= (knot ? 5 : 3)) break;
    if (!inherit.has(s)) inherit.set(s, randInt(0, 1));
  }
  for (const [s, i] of inherit) ivs[s] = parents[i].bestIvs[s] || ivs[s];

  // Nature: a Everstone passa a nature de quem segura.
  const stoneAt = items.indexOf('everstone');
  const stoneParent = stoneAt >= 0 ? parents[stoneAt] : null;
  const nature = stoneParent ? (stoneParent.nature ?? pick(stoneParent.natures.length ? stoneParent.natures : ALL_NATURES)) : pick(ALL_NATURES);

  // Habilidade: a da mãe; oculta passa com 60% se ela já tiver.
  const abilities = lineAbilities(childName);
  const hidden = abilities.find(a => a.hidden);
  const regular = abilities.filter(a => !a.hidden).map(a => a.name);
  const ability = hidden && parents[0].abilities.includes(hidden.name) && chance(0.6) ? hidden.name : pick(regular.length ? regular : [abilities[0].name]);

  // Golpe de ovo: um que o outro pai também aprende.
  const fatherMoves = allLearnable(species(lineRoot(father)));
  const egg = eggMoves(species(childName)).filter(m => fatherMoves.has(m));

  return {
    id: uid(),
    species: childName,
    ivs,
    nature,
    ability,
    eggMove: egg.length ? pick(egg) : undefined,
    shiny: chance(1 / 128),
    waves: hatchWaves(childName),
    parents: [species(mother).name, species(father).name],
  };
}

/** Choca o ovo: filhote no nível dos selvagens da ronda. */
export function hatch(egg: Egg, level: number): OwnedMon {
  const mon = createMon(egg.species, {level, ivs: {...egg.ivs}, hiddenAbilityChance: 0});
  mon.nature = egg.nature;
  mon.ability = egg.ability;
  mon.shiny = egg.shiny;
  if (egg.eggMove && !mon.moves.includes(egg.eggMove)) {
    if (mon.moves.length < 4) mon.moves.push(egg.eggMove);
    else mon.moves[0] = egg.eggMove;
  }
  return mon;
}
