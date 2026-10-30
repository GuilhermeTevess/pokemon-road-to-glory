import type {Species} from '@pkmn/sim';
import {biomePools, getBiome} from '../data/biomes';
import type {Rarity} from '../data/dex';
import {species} from '../data/dex';
import {createMon, evolve, itemEvolutions, levelEvolutions, randomIvs} from './mon';
import {chance, pick, randInt, weightedPick} from './rng';
import type {Encounter, OwnedMon} from './types';

/** Fim da etapa 1. Na etapa 3, toda ronda múltipla disto vira um duelo PvP. */
export const STAGE_LENGTH = 30;
export const BIOME_CHANGE_EVERY = 5;
export const HEAL_EVERY = 10;

export function isBossWave(wave: number): boolean {
  return wave % 10 === 0;
}

/** Ronda marco (30, 60, 90...). Hoje é um chefe lendário; na etapa 3 será o duelo contra outro jogador. */
export function isMilestoneWave(wave: number): boolean {
  return wave % STAGE_LENGTH === 0;
}

function rarityWeights(wave: number, incense: boolean): [Rarity, number][] {
  const boost = incense ? 3 : 1;
  // Pokémon muito fortes (pseudo-lendários, Ultra Beasts, paradoxos, lendários) só depois de algumas rondas.
  return [
    ['common', Math.max(20, 70 - wave)],
    ['uncommon', 22 + wave * 0.3],
    ['rare', wave >= 4 ? (5 + wave * 0.3) * boost : 0],
    ['superRare', wave >= 12 ? (1 + wave * 0.08) * boost : 0],
    ['legendary', wave >= 15 ? (0.3 + wave * 0.02) * boost : 0],
  ];
}

const ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'superRare', 'legendary'];

function pickFromPools(biomeId: string, rarity: Rarity): [Species, Rarity] {
  const pools = biomePools(getBiome(biomeId));
  // Se a raridade estiver vazia no bioma, desce até achar alguém.
  for (let i = ORDER.indexOf(rarity); i >= 0; i--) {
    const pool = pools[ORDER[i]];
    if (pool.length) return [pick(pool), ORDER[i]];
  }
  return [species('Rattata'), 'common'];
}

/** Evolui o selvagem para combinar com o nível (evoluções por item a partir do 30). */
function evolveForLevel(mon: OwnedMon): void {
  for (let guard = 0; guard < 3; guard++) {
    const options = levelEvolutions(mon);
    if (!options.length && mon.level >= 30 && chance(0.5)) options.push(...itemEvolutions(mon));
    if (!options.length) return;
    evolve(mon, pick(options));
  }
}

function finalize(mon: OwnedMon): OwnedMon {
  // Recalcula golpes e HP após possíveis evoluções.
  const fresh = createMon(mon.species, {level: mon.level, ivs: mon.ivs});
  return {...mon, moves: fresh.moves, hp: fresh.hp};
}

export function generateEncounter(wave: number, biomeId: string, incense: boolean): Encounter {
  if (isMilestoneWave(wave)) {
    const [s] = pickFromPools(biomeId, 'legendary');
    const mon = createMon(s.name, {level: wave + 5, ivMin: 20});
    return {mon, rarity: 'legendary', boss: true};
  }
  const boss = isBossWave(wave);
  let rarity = weightedPick(rarityWeights(wave, incense));
  if (boss && ORDER.indexOf(rarity) < 2) rarity = 'rare';
  const [s, actual] = pickFromPools(biomeId, rarity);
  const base = Math.floor(wave * 0.9) + 2;
  const level = Math.max(2, boss ? base + 2 : base + randInt(-2, 1));
  let mon = createMon(s.name, {level, ivs: boss ? undefined : randomIvs(0, 20), ivMin: 15});
  if (actual !== 'legendary') {
    evolveForLevel(mon);
    mon = finalize(mon);
  }
  return {mon, rarity: actual, boss};
}
