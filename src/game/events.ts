// Eventos entre as rondas (Parte C): em vez de ir direto para a próxima batalha,
// às vezes aparece uma escolha. Eventos não gastam ronda.
import {getItem, ITEMS} from '../data/items';
import {generateEncounter, isBossWave, STAGE_LENGTH} from './encounters';
import {chance, pick} from './rng';
import type {Encounter, RunEvent, RunState} from './types';

export const EVENT_CHANCE = 0.1;
export const RIVAL_NAMES = ['Léo', 'Bia', 'Caio', 'Duda', 'Rafa', 'Nina', 'Theo', 'Malu'];
export const BERRIES = ['sitrusberry', 'lumberry', 'oranberry'];

/** Um selvagem "tranquilo" (sem super raros nem lendários) para a casa e o machucado. */
function calmMon(run: RunState): Encounter['mon'] {
  for (let i = 0; i < 20; i++) {
    const enc = generateEncounter(Math.max(1, run.wave), run.biome, false);
    if (enc.rarity === 'common' || enc.rarity === 'uncommon' || enc.rarity === 'rare') return enc.mon;
  }
  return generateEncounter(1, run.biome, false).mon;
}

export function shouldRollEvent(run: RunState): boolean {
  const next = run.wave + 1;
  if (run.wave < 2 || next >= STAGE_LENGTH || isBossWave(next)) return false;
  if (run.lastEventWave === run.wave) return false;
  return chance(EVENT_CHANCE);
}

export function rollEvent(run: RunState): RunEvent {
  const tradable = Object.keys(run.bag).filter(id => run.bag[id] > 0 && getItem(id).tier !== 'ultra' && getItem(id).tier !== 'master');
  const kinds: RunEvent['kind'][] = ['house', 'berries', 'hurt', 'rival', 'seer'];
  if (tradable.length) kinds.push('merchant');
  const kind = pick(kinds);
  switch (kind) {
    case 'house':
      return {kind, mon: calmMon(run)};
    case 'hurt': {
      const mon = calmMon(run);
      mon.hp = 1;
      return {kind, mon};
    }
    case 'berries':
      return {kind, options: [...BERRIES]};
    case 'merchant': {
      const give = pick(tradable);
      const better = ITEMS.filter(i => i.tier === 'ultra' && i.kind !== 'money');
      return {kind, give, get: pick(better).id};
    }
    case 'rival':
      return {kind, name: pick(RIVAL_NAMES)};
    case 'seer':
    default:
      return {kind: 'seer', upcoming: upcomingEncounters(run, 3)};
  }
}

/** Gera os próximos selvagens antes (a Vidente mostra os tipos deles). */
export function upcomingEncounters(run: RunState, n: number): Encounter[] {
  const out: Encounter[] = [];
  for (let w = run.wave + 1; w <= run.wave + n && w <= STAGE_LENGTH; w++) out.push(generateEncounter(w, run.biome, run.incenseWaves > 0, run.perks?.luck));
  return out;
}

/** Pokémon do rival: um pouco mais forte que o selvagem da ronda. */
export function rivalEncounter(run: RunState, name: string): Encounter {
  const enc = generateEncounter(run.wave + 1, run.biome, false);
  enc.mon.level += 3;
  return {...enc, boss: false, trainer: name};
}

/** Cura mais barata da mochila (para o Pokémon machucado). */
export function cheapestHeal(run: RunState): string | null {
  const heals = Object.keys(run.bag)
    .filter(id => run.bag[id] > 0 && getItem(id).kind === 'heal')
    .sort((a, b) => getItem(a).price - getItem(b).price);
  return heals[0] ?? null;
}
