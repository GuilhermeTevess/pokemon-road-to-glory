// Parte D: Glória, a moeda permanente do treinador, ganha no fim de cada run e gasta
// em melhorias gerais (o lado roguelike).
import type {Collection} from './meta';
import type {RunPerks, RunState} from './types';

export interface Upgrade {
  id: keyof RunPerks;
  name: string;
  /** O que cada nível faz (índice = nível que vai comprar - 1). */
  levels: string[];
  costs: number[];
}

export const UPGRADES: Upgrade[] = [
  {id: 'budget', name: 'Orçamento do time', levels: ['7 pontos', '8 pontos', '9 pontos', '10 pontos'], costs: [30, 60, 100, 160]},
  {id: 'luck', name: 'Faro para raros', levels: ['Raros +25%, shiny 2x', 'Raros +50%, shiny 3x', 'Raros +75%, shiny 4x'], costs: [40, 90, 160]},
  {id: 'biomes', name: 'Mais caminhos', levels: ['4 biomas para escolher', '5 biomas para escolher'], costs: [25, 70]},
  {id: 'rewards', name: 'Mais recompensas', levels: ['4 itens por ronda'], costs: [120]},
  {id: 'money', name: 'Começo rico', levels: ['₽ 750 no início', '₽ 1000 no início', '₽ 1500 no início'], costs: [15, 35, 70]},
  {id: 'balls', name: 'Mochila cheia', levels: ['+2 Poké Balls e +1 Poção', '+4 Poké Balls e +2 Poções', '+1 Great Ball extra'], costs: [15, 35, 60]},
  {id: 'level', name: 'Treino em dia', levels: ['Time inicial começa no nível 7', 'Nível 9', 'Nível 12'], costs: [40, 90, 160]},
  {id: 'rest', name: 'Descanso caprichado', levels: ['Recupera 30% do HP depois de cada ronda', '40%'], costs: [35, 90]},
  {id: 'catch', name: 'Mão boa', levels: ['Capturas 15% mais fáceis', '30% mais fáceis'], costs: [35, 90]},
  {id: 'candy', name: 'Doceiro', levels: ['+1 doce por vitória', '+2 doces por vitória'], costs: [30, 80]},
  {id: 'evs', name: 'Treino pesado', levels: ['EVs das vitórias 50% maiores', 'EVs em dobro'], costs: [30, 80]},
  {id: 'hatch', name: 'Chocadeira', levels: ['Ovos chocam 20% mais rápido', '40% mais rápido'], costs: [25, 60]},
  {id: 'reroll', name: 'Segunda chance', levels: ['1º sorteio de novo grátis em cada ronda'], costs: [50]},
  {id: 'regions', name: 'Mapa detalhado', levels: ['Mapa de Região mostra 4 regiões', '5 regiões'], costs: [25, 70]},
  {id: 'stay', name: 'Estadia longa', levels: ['+5 rondas em cada região', '+10 rondas'], costs: [30, 80]},
  {id: 'trail', name: 'Faro de lenda', levels: ['Rastro da lenda sobe 50% mais rápido', 'Sobe em dobro'], costs: [40, 100]},
  {id: 'hint', name: 'Ouvido atento', levels: ['Lendário da dica: 40% por ronda', '50% por ronda'], costs: [40, 100]},
  {id: 'hidden', name: 'Trilha oculta', levels: ['Biomas ocultos aparecem 2x mais', '3x mais'], costs: [35, 90]},
  {id: 'tickets', name: 'Sócio dos ginásios', levels: ['Ingressos 25% mais baratos', '50% mais baratos'], costs: [25, 60]},
  {id: 'discount', name: 'Cliente fiel', levels: ['Loja e sorteio 10% mais baratos', '20% mais baratos', '30% mais baratos'], costs: [30, 70, 130]},
];

export const BASE_BUDGET = 6;

export function perksOf(c: Collection): RunPerks {
  const u = c.upgrades ?? {};
  return {
    budget: u.budget ?? 0, luck: u.luck ?? 0, biomes: u.biomes ?? 0, rewards: u.rewards ?? 0, money: u.money ?? 0, balls: u.balls ?? 0,
    discount: u.discount ?? 0, level: u.level ?? 0, rest: u.rest ?? 0, candy: u.candy ?? 0, catch: u.catch ?? 0, reroll: u.reroll ?? 0,
    hatch: u.hatch ?? 0, evs: u.evs ?? 0, regions: u.regions ?? 0, stay: u.stay ?? 0, trail: u.trail ?? 0, hint: u.hint ?? 0,
    hidden: u.hidden ?? 0, tickets: u.tickets ?? 0,
  };
}

export function teamBudget(c: Collection): number {
  return BASE_BUDGET + perksOf(c).budget;
}

/** Glória ganha numa run: 1 por ronda, bônus por chefes e por terminar a etapa. */
export function gloryFor(wave: number, result: 'lost' | 'stageClear' | 'abandoned'): number {
  if (result === 'abandoned' && wave < 3) return 0;
  return wave + Math.floor(wave / 10) * 5 + (result === 'stageClear' ? 20 : 0);
}

export function buyUpgrade(c: Collection, id: keyof RunPerks): boolean {
  const up = UPGRADES.find(u => u.id === id);
  if (!up) return false;
  const lv = c.upgrades?.[id] ?? 0;
  const cost = up.costs[lv];
  if (cost === undefined || (c.glory ?? 0) < cost) return false;
  c.glory = (c.glory ?? 0) - cost;
  c.upgrades = {...c.upgrades, [id]: lv + 1};
  return true;
}

/** Aplica as melhorias no começo da run. */
export function applyPerks(run: RunState, p: RunPerks): void {
  run.perks = p;
  run.money = [500, 750, 1000, 1500][p.money];
  if (p.balls >= 1) {
    run.bag.pokeball = (run.bag.pokeball ?? 0) + 2;
    run.bag.potion = (run.bag.potion ?? 0) + 1;
  }
  if (p.balls >= 2) {
    run.bag.pokeball += 2;
    run.bag.potion += 1;
  }
  if (p.balls >= 3) run.bag.greatball = (run.bag.greatball ?? 0) + 1;
}

export const START_LEVELS = [5, 7, 9, 12];

/** Custo do "sortear de novo": o primeiro é grátis com Segunda chance. */
export function rerollPrice(run: RunState, base: number): number {
  if ((run.perks?.reroll ?? 0) > 0 && run.rerolls === 0) return 0;
  return discounted(run, base);
}

export function discounted(run: RunState, price: number): number {
  return Math.round((price * (1 - 0.1 * (run.perks?.discount ?? 0))) / 10) * 10;
}
