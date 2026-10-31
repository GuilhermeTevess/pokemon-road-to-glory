import type {Species} from '@pkmn/sim';
import {biomePools, getBiome} from '../data/biomes';
import type {Rarity} from '../data/dex';
import {species} from '../data/dex';
import {getRegion, regionWeight} from '../data/regions';
import type {Region} from '../data/regions';
import {createMon, evolve, itemEvolutions, levelEvolutions, randomIvs} from './mon';
import {chance, pick, randInt, weightedPick} from './rng';
import type {Encounter, OwnedMon} from './types';

/** Uma temporada: 120 rondas, com um torneio a cada 30 (League Cup, Regional, Internacional, Mundial). */
export const SEASON_LENGTH = 120;
export const TOURNAMENT_EVERY = 30;
export const HEAL_EVERY = 10;

export function isBossWave(wave: number): boolean {
  return wave % 10 === 0;
}

/** Ronda de torneio (30, 60, 90, 120). */
export function isMilestoneWave(wave: number): boolean {
  return wave % TOURNAMENT_EVERY === 0;
}

function rarityWeights(wave: number, incense: boolean, luck: number): [Rarity, number][] {
  const boost = (incense ? 3 : 1) * (1 + 0.25 * luck);
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

function pickFromPools(biomeId: string, rarity: Rarity, region?: Region, boss = false): [Species, Rarity] {
  const pools = biomePools(getBiome(biomeId));
  // Se a raridade estiver vazia no bioma, desce até achar alguém.
  for (let i = ORDER.indexOf(rarity); i >= 0; i--) {
    const pool = pools[ORDER[i]];
    if (!pool.length) continue;
    if (!region) return [pick(pool), ORDER[i]];
    // Chefes preferem bem mais os Pokémon da região.
    let weighted = pool.map(s => [s, regionWeight(s, region)] as [Species, number]).filter(([, w]) => w > 0);
    // Chefes são Pokémon da própria região sempre que o bioma tiver algum.
    const locals = weighted.filter(([, w]) => w > 1);
    if (boss && locals.length) weighted = locals;
    if (weighted.length) return [weightedPick(weighted), ORDER[i]];
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

/** `luck`: nível da melhoria Faro para raros (mais raros e mais shiny). */
export function generateEncounter(wave: number, biomeId: string, incense: boolean, luck = 0, regionId?: string): Encounter {
  const region = regionId ? getRegion(regionId) : undefined;
  if (isMilestoneWave(wave)) {
    const [s] = pickFromPools(biomeId, 'legendary', region, true);
    const mon = createMon(s.name, {level: wave + 5, ivMin: 20, shinyChance: (1 + luck) / 256});
    return {mon, rarity: 'legendary', boss: true};
  }
  const boss = isBossWave(wave);
  let rarity = weightedPick(rarityWeights(wave, incense, luck));
  if (boss && ORDER.indexOf(rarity) < 2) rarity = 'rare';
  const [s, actual] = pickFromPools(biomeId, rarity, region, boss);
  const base = Math.floor(wave * 0.9) + 2;
  const level = Math.max(2, boss ? base + 2 : base + randInt(-2, 1));
  let mon = createMon(s.name, {level, ivs: boss ? undefined : randomIvs(0, 20), ivMin: 15, shinyChance: (1 + luck) / 256});
  if (actual !== 'legendary') {
    evolveForLevel(mon);
    mon = finalize(mon);
  }
  return {mon, rarity: actual, boss};
}
