import {ITEMS} from '../data/items';
import type {ItemDef, ItemTier} from '../data/items';
import {weightedPick} from './rng';

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
    if (pool.length) out.push(weightedPick(pool.map(i => [i, i.weight ?? 1] as [ItemDef, number])).id);
  }
  return out;
}

export function moneyReward(wave: number, boss: boolean): number {
  return Math.round((100 + wave * 25) * (boss ? 2 : 1));
}

/** Quanto um item de dinheiro (Bolsa, Pepita, Pepita Grande) vale nesta ronda. */
export function moneyValue(item: ItemDef, wave: number): number {
  return Math.round(((300 + wave * 40) * (item.power ?? 1)) / 10) * 10;
}

export function rerollCost(rerolls: number, wave: number): number {
  return (rerolls + 1) * (100 + wave * 10);
}

/** Prateleiras da loja. */
export const SHOP: {title: string; items: string[]}[] = [
  {title: 'Pokébolas', items: ['pokeball', 'greatball', 'ultraball']},
  {title: 'Cura', items: ['potion', 'superpotion', 'hyperpotion', 'maxpotion', 'revive']},
  {title: 'Para a batalha', items: ['xattack', 'xdefense', 'xspatk', 'xspdef', 'xspeed', 'xaccuracy']},
  {title: 'Treino (EVs)', items: ['hpup', 'protein', 'iron', 'calcium', 'zinc', 'carbos']},
  {title: 'Viagem', items: ['map']},
];

export function shopItems(): ItemDef[] {
  return SHOP.flatMap(s => s.items).map(id => ITEMS.find(i => i.id === id)!).filter(Boolean);
}
