// Ginásios: compre o ingresso na loja e marque a ronda da luta (dentro do tempo na região,
// fora das rondas de torneio e de chefe). Cada insígnia vale uma vez por temporada.
import {GYM_BIOME, gymsOf} from '../data/gyms';
import type {Gym} from '../data/gyms';
import {isBossWave, isMilestoneWave, SEASON_LENGTH} from './encounters';
import {discounted} from './glory';
import {createMon} from './mon';
import {moneyReward} from './rewards';
import type {Encounter, RunState} from './types';

export const GYM_PRIZE = {glory: 10, book: 60};

export function ticketPrice(run: RunState): number {
  return discounted(run, (1200 + 3 * moneyReward(run.wave, false)) * (1 - 0.25 * (run.perks?.tickets ?? 0)));
}

/** Insígnias já ganhas na região. */
export function badgesIn(run: RunState, region = run.region): number {
  const ids = new Set(gymsOf(region).map(g => g.id));
  return (run.badges ?? []).filter(id => ids.has(id)).length;
}

/** Rondas livres para marcar um ginásio: dentro da estadia na região, sem torneio, chefe ou outro ginásio. */
export function gymWaves(run: RunState): number[] {
  const out: number[] = [];
  const taken = new Set((run.gyms ?? []).map(g => g.wave));
  const last = Math.min(SEASON_LENGTH, run.wave + (run.regionLeft ?? 0));
  for (let w = run.wave + 1; w <= last; w++) if (!isMilestoneWave(w) && !isBossWave(w) && !taken.has(w)) out.push(w);
  return out;
}

export function gymStatus(run: RunState, gym: Gym): 'won' | 'booked' | 'open' {
  if (run.badges?.includes(gym.id)) return 'won';
  if (run.gyms?.some(g => g.id === gym.id)) return 'booked';
  return 'open';
}

/** Time do líder: cresce com as insígnias que você já tem na região; o ás vem por último e mais forte. */
export function gymEncounter(gym: Gym, run: RunState): Encounter {
  const n = badgesIn(run);
  const best = Math.max(1, ...run.party.map(m => m.level));
  const level = Math.min(100, Math.max(Math.floor(run.wave * 0.9) + 3, best - 1) + Math.floor(n / 2));
  const size = Math.min(gym.team.length, 3 + Math.floor(n / 3));
  const names = gym.team.slice(gym.team.length - size);
  const team = names.map((name, i) => createMon(name, {level: i === names.length - 1 ? level + 2 : level, ivMin: 15, shinyChance: 0}));
  return {
    mon: team[0], team, rarity: 'rare', boss: true, trainer: gym.leader, gym: gym.id, arena: GYM_BIOME[gym.type],
    intro: [`Líder ${gym.leader}: "Bem-vindo ao meu ginásio! Mostre que merece a ${gym.badge}!"`],
  };
}
