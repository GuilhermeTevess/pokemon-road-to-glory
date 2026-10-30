import {ITEMS} from '../data/items';
import type {ItemDef, ItemTier} from '../data/items';
import {pick, weightedPick} from './rng';

function tierWeights(wave: number): [ItemTier, number][] {
  return [
    ['common', Math.max(25, 60 - wave)],
    ['great', 30 + wave * 0.5],
    ['ultra', 8 + wave * 0.6],
    ['master', wave >= 15 ? 1.5 : 0],
  ];
}

/** Três opções de recompensa para o fim da ronda (sem repetir). */
export function rollRewards(wave: number, count = 3): string[] {
  const out: string[] = [];
  for (let guard = 0; out.length < count && guard < 50; guard++) {
    const tier = weightedPick(tierWeights(wave));
    const pool = ITEMS.filter(i => i.tier === tier && !out.includes(i.id));
    if (pool.length) out.push(pick(pool).id);
  }
  return out;
}

export function moneyReward(wave: number, boss: boolean): number {
  return Math.round((100 + wave * 25) * (boss ? 2 : 1));
}

/** Valor da "Bolsa de Moedas". */
export function moneyBag(wave: number): number {
  return 300 + wave * 40;
}

export function rerollCost(rerolls: number, wave: number): number {
  return (rerolls + 1) * (100 + wave * 10);
}

export const SHOP: string[] = ['pokeball', 'greatball', 'ultraball', 'potion', 'superpotion', 'hyperpotion', 'revive', 'map'];

export function shopItems(): ItemDef[] {
  return SHOP.map(id => ITEMS.find(i => i.id === id)!).filter(Boolean);
}
