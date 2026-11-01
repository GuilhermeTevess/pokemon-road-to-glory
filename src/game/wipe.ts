// Carreira online: perder o time inteiro para selvagens (ou chefe, ou rival de rota) não acaba
// a temporada. Você foge para o Centro Pokémon, mas sai machucado: o time perde níveis, algo cai
// da mochila na correria, um pouco do dinheiro some e o ranking desconta alguns pontos.
// Offline continua como sempre: perdeu, a run acaba.
import {ITEMS} from '../data/items';
import {losePoints, seasonPoints} from './league';
import type {Collection} from './meta';
import {calcStats, expForLevel} from './mon';
import {shuffle} from './rng';
import type {RunState} from './types';

export const WIPE = {
  /** Níveis que cada Pokémon do time perde (nunca abaixo de `minLevel`). */
  levels: 3,
  minLevel: 5,
  /** Quantos itens diferentes podem cair da mochila (cada um perde até `itemUnits`). */
  items: 2,
  itemUnits: 2,
  /** Parte do dinheiro perdida. */
  money: 0.15,
  /** Pontos do ranking: base + parte dos pontos da temporada, com teto. */
  pointsBase: 10,
  pointsShare: 0.05,
  pointsMax: 40,
};

export interface WipeLoss {
  /** Quem venceu (para a cena). */
  foe: string;
  /** Derrota no ginásio: o time volta com 1 HP (sem perder pontos, dinheiro nem itens). */
  gym?: boolean;
  levels: number;
  items: {id: string; n: number}[];
  money: number;
  points: number;
}

/** Itens que podem cair: nada de item-chave nem Mega Pedra (perder isso seria cruel demais). */
function droppable(id: string): boolean {
  const it = ITEMS.find(i => i.id === id);
  return !!it && it.kind !== 'key' && it.kind !== 'mega';
}

/** Pontos que a derrota custa nesta temporada. */
export function wipePoints(run: RunState): number {
  return Math.min(WIPE.pointsMax, Math.round(WIPE.pointsBase + seasonPoints(run) * WIPE.pointsShare));
}

/** Aplica as penalidades na run (e na fama da coleção) e cura o time. */
export function applyWipe(run: RunState, col: Collection | null, foe: string): WipeLoss {
  let levels = 0;
  for (const m of run.party) {
    const to = Math.max(Math.min(m.level, WIPE.minLevel), m.level - WIPE.levels);
    levels = Math.max(levels, m.level - to);
    m.level = to;
    m.exp = expForLevel(to);
    m.hp = calcStats(m).hp;
  }
  const items: WipeLoss['items'] = [];
  for (const id of shuffle(Object.keys(run.bag).filter(id => run.bag[id] > 0 && droppable(id))).slice(0, WIPE.items)) {
    const n = Math.min(run.bag[id], WIPE.itemUnits);
    run.bag[id] -= n;
    if (!run.bag[id]) delete run.bag[id];
    items.push({id, n});
  }
  const money = Math.floor(run.money * WIPE.money);
  run.money -= money;
  const points = losePoints(run, col, wipePoints(run), `Fuga depois de perder para ${foe}`);
  return {foe, levels, items, money, points};
}

/**
 * Perdeu no ginásio: o ingresso já pagou a cura ANTES da luta, então depois não tem cura de graça.
 * Quem caiu volta machucado, com 1 HP (dá para usar Poções, Revivers ou esperar o Centro Pokémon).
 * Não mexe em pontos, dinheiro nem mochila.
 */
export function applyGymLoss(run: RunState, foe: string): WipeLoss {
  for (const m of run.party) if (m.hp <= 0) m.hp = 1;
  return {foe, gym: true, levels: 0, items: [], money: 0, points: 0};
}
