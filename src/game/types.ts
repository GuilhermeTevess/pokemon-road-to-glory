// Modelos persistidos (vão para o localStorage). Mantenha-os serializáveis em JSON.
import type {Egg} from './daycare';
import type {Tournament} from './tournament';

export type StatId = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatTable = Record<StatId, number>;

export const STAT_IDS: StatId[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABEL: Record<StatId, string> = {hp: 'HP', atk: 'Ataque', def: 'Defesa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidade'};

export interface OwnedMon {
  uid: string;
  species: string;
  level: number;
  /** Experiência total acumulada (curva "médio-rápida": nível³). */
  exp: number;
  moves: string[];
  ability: string;
  nature: string;
  gender: 'M' | 'F' | 'N';
  shiny: boolean;
  ivs: StatTable;
  /** EVs: na etapa 2 o jogador vai poder distribuir antes da run. */
  evs: StatTable;
  /** Apelido dado pelo jogador (até 12 letras). */
  nickname?: string;
  /** Parceiro do treinador nesta run (só um por time): corações em dobro. */
  partner?: boolean;
  /** Id do item de segurar (ver data/items.ts). */
  item?: string;
  /** HP atual (absoluto). 0 = desmaiado. */
  hp: number;
  /** Onde foi capturado (para estatísticas e para a etapa 2). */
  metWave?: number;
  metBiome?: string;
}

export type Phase =
  | 'starter'
  | 'biome'
  | 'battle'
  | 'postBattle'
  | 'reward'
  | 'biomeChoice'
  | 'event'
  | 'tournament'
  | 'gameOver'
  | 'stageClear';

/** Encontro da ronda atual. */
export interface Encounter {
  mon: OwnedMon;
  rarity: string;
  boss: boolean;
  /** Nome do treinador rival (batalha de evento: não dá para capturar nem fugir). */
  trainer?: string;
  /** Time inteiro do treinador (o primeiro é `mon`). */
  team?: OwnedMon[];
  /** Partida de torneio: tem narrador e não acaba a run se perder. */
  tournament?: boolean;
  /** Falas do narrador na entrada (dependem da fama e dos títulos). */
  intro?: string[];
}

/** Evento entre rondas (ver game/events.ts). */
export type RunEvent =
  | {kind: 'house'; mon: OwnedMon}
  | {kind: 'hurt'; mon: OwnedMon}
  | {kind: 'berries'; options: string[]}
  | {kind: 'merchant'; give: string; get: string}
  | {kind: 'rival'; name: string}
  | {kind: 'seer'; upcoming: Encounter[]};

/** Algo que precisa da decisão do jogador depois da batalha (golpe novo, evolução). */
export type PendingEvent =
  | {kind: 'learnMove'; uid: string; move: string}
  | {kind: 'evolve'; uid: string; into: string[]};

/** Melhorias gerais (Glória) congeladas no começo da run. */
export interface RunPerks {
  budget: number;
  luck: number;
  biomes: number;
  rewards: number;
  money: number;
  balls: number;
  discount: number;
  level?: number;
  rest?: number;
  candy?: number;
  catch?: number;
  reroll?: number;
  hatch?: number;
  evs?: number;
}

export interface RunState {
  version: 1;
  id: string;
  startedAt: number;
  wave: number;
  biome: string;
  phase: Phase;
  party: OwnedMon[];
  /** Pokémon capturados com o time cheio. */
  box: OwnedMon[];
  bag: Record<string, number>;
  money: number;
  /** Trocar de bioma está liberado após a próxima vitória (Mapa). */
  mapReady: boolean;
  incenseWaves: number;
  encounter?: Encounter;
  pending: PendingEvent[];
  /** Opções de recompensa da ronda (ids de itens). */
  rewardOptions: string[];
  rerolls: number;
  /** Recompensa já pega nesta ronda (a tela fica aberta para a loja). */
  rewardTaken?: string;
  /** Recompensas puladas seguidas (deixam as próximas um pouco melhores). */
  skipStreak?: number;
  /** Biomas visitados por último (não aparecem de novo logo) e espécies das últimas rondas. */
  visited?: string[];
  recent?: string[];
  /** Evento atual (fase 'event'). */
  event?: RunEvent;
  lastEventWave?: number;
  perks?: RunPerks;
  /** Glória ganha quando a run terminou (para a tela final). */
  gloryEarned?: number;
  /** Ovo levado da Creche: `left` rondas vencidas para chocar. */
  egg?: Egg & {left: number};
  /** Torneio em andamento (fase 'tournament'). */
  tournament?: Tournament;
  /** Glória já ganha em torneios nesta run (para a tela final). */
  tourGlory?: number;
  /** Selvagens já sorteados (a Vidente mostrou). */
  upcoming?: Encounter[];
  log: string[];
  stats: {defeated: number; caught: number; fled: number};
}
