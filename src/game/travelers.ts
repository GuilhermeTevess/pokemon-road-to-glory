// Viajantes: ajude e ganhe uma dica sobre um lendário (vai para o diário). Com a dica,
// estar na região e no bioma certos dá chance de o lendário aparecer. Algumas dicas
// apontam para biomas ocultos, que só aparecem no sorteio com a dica (ou muita sorte).
import {BIOMES, hiddenBiomeOf} from '../data/biomes';
import {HINTS, getHint} from '../data/hints';
import type {Hint} from '../data/hints';
import {getItem} from '../data/items';
import {createMon} from './mon';
import {moneyReward} from './rewards';
import {cheapestHeal} from './events';
import {chance, pick} from './rng';
import {AVATARS} from './trainers';
import type {Encounter, RunEvent, RunState} from './types';

/** Chance por ronda de o lendário da dica aparecer no lugar certo. */
export const HINT_CHANCE = 0.3;
/** Chance de cair no bioma oculto num sorteio de bioma: com dica e sem dica. */
export const HIDDEN_WITH_HINT = 0.5;
export const HIDDEN_BASE = 0.03;

const TRAVELER_NAMES = ['Viajante de capa', 'Velho pescador', 'Arqueóloga', 'Andarilho', 'Professora em viagem', 'Mochileiro'];

function pickHint(run: RunState): Hint | null {
  const known = new Set([...(run.diary ?? []), ...(run.found ?? [])]);
  const left = HINTS.filter(h => !known.has(h.id));
  if (!left.length) return null;
  const local = left.filter(h => h.region === run.region);
  return pick(local.length && chance(0.5) ? local : left);
}

export function travelerEvent(run: RunState): RunEvent | null {
  const hint = pickHint(run);
  if (!hint) return null;
  const base = {kind: 'traveler' as const, name: pick(TRAVELER_NAMES), avatar: pick(AVATARS), hint: hint.id};
  const tradable = Object.keys(run.bag).filter(id => run.bag[id] > 0 && getItem(id).kind === 'ball');
  const asks: ('money' | 'heal' | 'item')[] = ['money'];
  if (cheapestHeal(run)) asks.push('heal');
  if (tradable.length) asks.push('item');
  const ask = pick(asks);
  if (ask === 'money') return {...base, ask, cost: moneyReward(run.wave, false) * 2};
  if (ask === 'item') return {...base, ask, item: pick(tradable)};
  return {...base, ask};
}

/** Dica do diário que vale aqui (região e bioma atuais). */
export function hintHere(run: RunState): Hint | undefined {
  return (run.diary ?? []).map(getHint).find(h => h && h.region === run.region && h.biome === run.biome);
}

/** Lendário da dica aparece nesta ronda? */
export function rollHintLegendary(run: RunState): Encounter | null {
  const hint = hintHere(run);
  if (!hint || !chance(HINT_CHANCE + 0.1 * (run.perks?.hint ?? 0))) return null;
  const mon = createMon(hint.species, {level: run.wave + 5, ivMin: 20, shinyChance: (1 + (run.perks?.luck ?? 0)) / 256});
  return {mon, rarity: 'legendary', boss: true, hinted: true, intro: ['A dica do viajante era verdade...']};
}

/** Próximo bioma no sorteio: normal, ou o oculto da região (bem mais provável com dica). */
export function rollBiome(run: RunState, region = run.region): string {
  const hidden = hiddenBiomeOf(region);
  if (hidden) {
    const hinted = (run.diary ?? []).some(id => getHint(id)?.biome === hidden.id);
    const lv = run.perks?.hidden ?? 0;
    if (chance(hinted ? HIDDEN_WITH_HINT + 0.15 * lv : HIDDEN_BASE * (1 + lv))) return hidden.id;
  }
  return pick(BIOMES).id;
}
