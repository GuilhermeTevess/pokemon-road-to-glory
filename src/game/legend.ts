// Treinadores lendários: o "Rastro da lenda" de cada região sobe com chefes, eventos e
// viajantes. A cada ronda na região, a chance de a lenda te desafiar é o rastro (até 40%).
import {toID} from '@pkmn/sim';
import {ITEMS} from '../data/items';
import {legendsOf} from '../data/legends';
import type {Legend} from '../data/legends';
import {createMon} from './mon';
import {pick} from './rng';
import type {Encounter, OwnedMon, RunState} from './types';

export const TRAIL_CAP = 40;
/** Quanto o rastro sobe com cada coisa. */
export const TRAIL = {boss: 10, event: 10, traveler: 25};

export function trailOf(run: RunState, region = run.region): number {
  return region ? (run.trail?.[region] ?? 0) : 0;
}

export function addTrail(run: RunState, amount: number, region = run.region): void {
  if (!region || !legendsOf(region).length) return;
  const boost = 1 + 0.5 * (run.perks?.trail ?? 0);
  run.trail = {...run.trail, [region]: Math.min(100, trailOf(run, region) + Math.round(amount * boost))};
}

/** Chance (0 a 1) de a lenda aparecer nesta ronda. */
export function legendChance(run: RunState): number {
  return Math.min(TRAIL_CAP, trailOf(run)) / 100;
}

/** Time da lenda: mesmo tamanho do seu (mínimo 3), nível do seu mais forte +3, IVs no máximo. */
export function legendTeam(legend: Legend, party: OwnedMon[]): OwnedMon[] {
  const size = Math.min(6, Math.max(3, party.length));
  const level = Math.min(100, Math.max(5, ...party.map(m => m.level)) + 3);
  return legend.team.slice(0, size).map(l => {
    const mon = createMon(l.species, {level, ivMin: 31, shinyChance: 0, hiddenAbilityChance: 0});
    mon.moves = [...l.moves];
    const item = l.item ? toID(l.item) : '';
    if (item && ITEMS.some(i => i.id === item)) mon.item = item;
    return mon;
  });
}

export function legendEncounter(legend: Legend, party: OwnedMon[]): Encounter {
  const team = legendTeam(legend, party);
  return {mon: team[0], team, rarity: 'legendary', boss: true, trainer: legend.name, legend: legend.id, intro: legend.intro};
}

/** Sorteia a lenda da região para esta ronda (ou null). */
export function rollLegend(run: RunState): Legend | null {
  const options = legendsOf(run.region);
  if (!options.length || Math.random() >= legendChance(run)) return null;
  return pick(options);
}

/** Prêmio por vencer uma lenda. */
export function legendPrize(wave: number): {glory: number; money: number} {
  return {glory: 40, money: 3000 + wave * 100};
}
