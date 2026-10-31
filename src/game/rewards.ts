import {ITEMS} from '../data/items';
import type {ItemDef, ItemTier} from '../data/items';
import {weightedPick} from './rng';
import {discounted} from './glory';
import type {RunState} from './types';

function tierWeights(wave: number): [ItemTier, number][] {
  return [
    ['common', Math.max(25, 60 - wave)],
    ['great', 30 + wave * 0.5],
    ['ultra', 8 + wave * 0.6],
    ['master', wave >= 15 ? 1.5 : 0],
  ];
}

/** Três opções de recompensa para o fim da ronda (sem repetir). `bonus`: rondas puladas seguidas (até 2). */
export function rollRewards(wave: number, count = 3, bonus = 0): string[] {
  const out: string[] = [];
  for (let guard = 0; out.length < count && guard < 50; guard++) {
    // Cada recompensa pulada deixa a próxima como se fosse ~8 rondas à frente (raros um pouco mais comuns).
    const tier = weightedPick(tierWeights(wave + 8 * Math.min(2, bonus)));
    const pool = ITEMS.filter(i => i.tier === tier && !out.includes(i.id) && i.weight !== 0 && wave >= (i.minWave ?? 0));
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
  {title: 'Viagem', items: ['map', 'regionmap', 'staypass', 'regionpass']},
  {title: 'Especial', items: ['megastone', 'everstone', 'destinyknot']},
];

export function shopItems(): ItemDef[] {
  return SHOP.flatMap(s => s.items).map(id => ITEMS.find(i => i.id === id)!).filter(Boolean);
}

/** Preço na loja da run: mapas e passes ficam mais caros com a ronda e com o dinheiro guardado. */
export function shopPrice(run: RunState, item: ItemDef): number {
  if (!item.scales) return discounted(run, item.price);
  return discounted(run, item.price + 4 * moneyReward(run.wave, false) + 0.05 * run.money);
}

/** Por que um mapa ou passe não serve agora (null = pode usar/comprar). */
export function travelBlocked(run: RunState, item: ItemDef): string | null {
  const has = (run.bag[item.id] ?? 0) > 0;
  switch (item.travel) {
    case 'biomeStay':
      return run.biomePass ? 'Já dobrou a estadia neste bioma.' : has ? 'Você já tem um na mochila.' : null;
    case 'regionStay':
      return run.regionPass ? 'Já dobrou a estadia nesta região.' : has ? 'Você já tem um na mochila.' : null;
    case 'biome':
      return run.mapReady ? 'Mapa já aberto: vale na próxima vitória.' : null;
    case 'region':
      return run.regionMapReady ? 'Mapa já aberto: vale na próxima vitória.' : null;
  }
  return null;
}
