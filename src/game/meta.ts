// Progresso que sobrevive entre runs (coleção), separado por treinador. Cada linha
// evolutiva tem uma "ficha": IVs, natures e habilidades já vistas, doces, corações e
// golpes liberados. A ficha vale quando você COMEÇA com o Pokémon; os selvagens
// continuam aleatórios e só alimentam a ficha quando capturados.
import type {Species} from '@pkmn/sim';
import {dex, evolutionLine, isLegendary, levelUpMoves, species, teachableMoves, toID} from '../data/dex';
import {zeroStats} from './mon';
import {collectionKey} from './trainers';
import {STAT_IDS} from './types';
import type {OwnedMon, StatTable} from './types';

export interface CollectionEntry {
  /** Quantas vezes foi capturado (0 = só foi usado como inicial). */
  caught: number;
  bestIvs: StatTable;
  shiny: boolean;
  firstCaughtAt: number;
  /** Doces da linha. */
  candies?: number;
  /** Pontos de amizade; os corações saem de HEART_STEPS. */
  heartPts?: number;
  /** Natures e habilidades já vistas em capturas desta linha. */
  natures?: string[];
  abilities?: string[];
  /** Escolhidas para começar a run (precisam estar desbloqueadas). */
  nature?: string;
  ability?: string;
  /** Golpes liberados com doces e o que está equipado para o início. */
  moves?: string[];
  startMove?: string;
  /** Quantas vezes o custo de time foi reduzido. */
  costCut?: number;
  /** Nível do bônus de shiny (0 a 3). */
  shinyLv?: number;
}

export type Entry = Required<Omit<CollectionEntry, 'nature' | 'ability' | 'startMove'>> &
  Pick<CollectionEntry, 'nature' | 'ability' | 'startMove'>;

export interface RunSummary {
  endedAt: number;
  wave: number;
  starter: string;
  result: 'lost' | 'stageClear' | 'abandoned';
  party: string[];
}

export interface TrainerStats {
  runs: number;
  caught: number;
  defeated: number;
  stageClears: number;
  bestWave: number;
  moneyEarned: number;
}

export interface Collection {
  version: 1;
  /** Indexado pela espécie base da linha evolutiva (ex.: "charmander"). */
  entries: Record<string, CollectionEntry>;
  runs: RunSummary[];
  stats?: TrainerStats;
  /** Linha favorita escolhida pelo jogador (senão, a com mais corações). */
  favorite?: string;
}

export function lineRoot(name: string): string {
  let s = species(name);
  for (let guard = 0; guard < 4 && s.prevo; guard++) s = species(s.prevo);
  return toID(s.name);
}

/** Espécies da linha evolutiva (para as setinhas da ficha). */
export function lineSpecies(name: string): Species[] {
  return evolutionLine(species(lineRoot(name)));
}

function emptyStats(): TrainerStats {
  return {runs: 0, caught: 0, defeated: 0, stageClears: 0, bestWave: 0, moneyEarned: 0};
}

/** Completa saves antigos com os campos novos. */
function normalize(c: Collection): Collection {
  if (!c.stats) {
    const st = emptyStats();
    st.runs = c.runs.length;
    st.stageClears = c.runs.filter(r => r.result === 'stageClear').length;
    st.bestWave = c.runs.reduce((m, r) => Math.max(m, r.wave), 0);
    st.caught = Object.values(c.entries).reduce((n, e) => n + e.caught, 0);
    c.stats = st;
  }
  return c;
}

export function loadCollection(trainerId: string | null): Collection {
  try {
    const raw = trainerId ? localStorage.getItem(collectionKey(trainerId)) : null;
    if (raw) return normalize(JSON.parse(raw) as Collection);
  } catch {
    /* sem storage: começa vazio */
  }
  return {version: 1, entries: {}, runs: [], stats: emptyStats()};
}

export function saveCollection(trainerId: string | null, c: Collection): void {
  if (!trainerId) return;
  try {
    localStorage.setItem(collectionKey(trainerId), JSON.stringify(c));
  } catch {
    /* ignora */
  }
}

export function statsOf(c: Collection): TrainerStats {
  return (c.stats ??= emptyStats());
}

/** Ficha da linha com os padrões preenchidos (cria se não existir). */
export function entryOf(c: Collection, name: string): Entry {
  const id = lineRoot(name);
  const e = (c.entries[id] ??= {caught: 0, bestIvs: zeroStats(), shiny: false, firstCaughtAt: Date.now()});
  e.candies ??= 0;
  e.heartPts ??= 0;
  e.natures ??= [];
  e.abilities ??= [];
  e.moves ??= [];
  e.costCut ??= 0;
  e.shinyLv ??= 0;
  return e as Entry;
}

/** Leitura sem criar a ficha. */
export function peekEntry(c: Collection, name: string): Entry | undefined {
  const e = c.entries[lineRoot(name)];
  return e ? entryOf({version: 1, runs: [], entries: {[lineRoot(name)]: {...e}}}, name) : undefined;
}

function unlock(list: string[], v: string): boolean {
  if (list.includes(v)) return false;
  list.push(v);
  return true;
}

export interface CatchResult {
  duplicate: boolean;
  before: StatTable;
  after: StatTable;
  candies: number;
  newNature: boolean;
  newAbility: boolean;
}

/** Registra uma captura. Repetidos melhoram os IVs guardados (o maior de cada atributo, +1 de bônus). */
export function registerCatch(c: Collection, mon: OwnedMon): CatchResult {
  const fresh = !c.entries[lineRoot(mon.species)];
  const e = entryOf(c, mon.species);
  const duplicate = e.caught > 0;
  const before = {...e.bestIvs};
  if (!duplicate) {
    // Primeira captura (ou a linha só tinha sido usada como inicial).
    const next = zeroStats();
    for (const s of STAT_IDS) next[s] = Math.max(e.bestIvs[s], mon.ivs[s]);
    e.bestIvs = next;
    if (fresh) e.firstCaughtAt = Date.now();
  } else {
    const next = zeroStats();
    for (const s of STAT_IDS) next[s] = Math.min(31, Math.max(e.bestIvs[s], mon.ivs[s]) + (e.bestIvs[s] < 31 ? 1 : 0));
    e.bestIvs = next;
  }
  e.caught++;
  e.shiny ||= mon.shiny;
  const candies = duplicate ? CANDY.duplicate : CANDY.catch;
  e.candies += candies;
  const newNature = unlock(e.natures, mon.nature);
  const newAbility = unlock(e.abilities, mon.ability);
  statsOf(c).caught++;
  return {duplicate, before: duplicate ? before : zeroStats(), after: {...e.bestIvs}, candies, newNature, newAbility};
}

/** IVs para um inicial: os melhores da coleção ou aleatórios. */
export function starterIvs(c: Collection, name: string): StatTable | undefined {
  const e = c.entries[lineRoot(name)];
  return e && e.caught > 0 ? e.bestIvs : undefined;
}

// ---------------------------------------------------------------- Doces

/** Quantos doces cada coisa dá. */
export const CANDY = {catch: 3, duplicate: 5, defeat: 1, boss: 3, evolve: 2};

export function addCandies(c: Collection, name: string, n: number): void {
  entryOf(c, name).candies += n;
}

export function spendCandies(c: Collection, name: string, n: number): boolean {
  const e = entryOf(c, name);
  if (e.candies < n) return false;
  e.candies -= n;
  return true;
}

// ---------------------------------------------------------------- Corações

/** Pontos para cada coração (1 a 5). */
export const HEART_STEPS = [20, 60, 120, 200, 300];
export const HEART_PTS = {win: 2, inParty: 1, stageClear: 10};

export function heartsOf(e: CollectionEntry | undefined): number {
  const pts = e?.heartPts ?? 0;
  return HEART_STEPS.filter(s => pts >= s).length;
}

/** Progresso até o próximo coração (0 a 1). */
export function heartProgress(e: CollectionEntry | undefined): number {
  const pts = e?.heartPts ?? 0;
  const h = heartsOf(e);
  if (h >= HEART_STEPS.length) return 1;
  const lo = h ? HEART_STEPS[h - 1] : 0;
  return (pts - lo) / (HEART_STEPS[h] - lo);
}

export function addHeartPts(c: Collection, name: string, n: number): number {
  const e = entryOf(c, name);
  const before = heartsOf(e);
  e.heartPts = Math.min(HEART_STEPS[HEART_STEPS.length - 1], e.heartPts + n);
  return heartsOf(e) - before;
}

/** Buffs de amizade, do 1º ao 5º coração. */
export const HEART_PERKS = [
  '+5% de EXP',
  'Às vezes se cura de um status sozinho no fim do turno',
  'Às vezes aguenta com 1 HP um golpe que derrubaria',
  'Mais chance de acerto crítico',
  '+10% de EXP e enfeite de favorito',
];

export function expBonus(hearts: number): number {
  return hearts >= 5 ? 1.1 : hearts >= 1 ? 1.05 : 1;
}

/** Linha favorita: a escolhida ou a com mais pontos de amizade. */
export function favoriteOf(c: Collection): string | null {
  if (c.favorite && c.entries[c.favorite]) return c.favorite;
  let best: string | null = null;
  let pts = 0;
  for (const [id, e] of Object.entries(c.entries)) {
    if ((e.heartPts ?? 0) > pts) {
      pts = e.heartPts ?? 0;
      best = id;
    }
  }
  return best;
}

// ---------------------------------------------------------------- Custo de time

export const TEAM_BUDGET = 10;
export const MAX_COST_CUT = 2;
export const COST_CUT_PRICE = [15, 30];

/** Custo base da linha pela força da forma final (BST). */
export function baseCost(name: string): number {
  const line = lineSpecies(name);
  const bst = Math.max(...line.map(s => s.bst));
  let cost = bst <= 480 ? 1 : bst <= 510 ? 2 : bst <= 540 ? 3 : bst <= 580 ? 4 : bst < 600 ? 5 : bst < 660 ? 7 : 8;
  if (line.some(isLegendary)) cost = Math.max(cost, 8);
  return cost;
}

export function teamCost(c: Collection, name: string): number {
  const cut = c.entries[lineRoot(name)]?.costCut ?? 0;
  return Math.max(1, baseCost(name) - cut);
}

// ---------------------------------------------------------------- Shiny

export const SHINY_PRICE = [10, 20, 40];
export const SHINY_CHANCE = [1 / 256, 1 / 64, 1 / 24, 1 / 8];

export function shinyChance(c: Collection, name: string): number {
  return SHINY_CHANCE[c.entries[lineRoot(name)]?.shinyLv ?? 0];
}

// ---------------------------------------------------------------- Golpe inicial

/** Preço para liberar um golpe inicial, pelo poder. */
export function movePrice(move: string): number {
  const bp = dex.moves.get(move).basePower;
  return bp >= 95 ? 20 : bp >= 65 ? 10 : 5;
}

/** Golpes que a forma básica pode começar sabendo (de nível ou de MT/tutor). */
export function startMoveOptions(name: string): {id: string; how: 'level' | 'tm'}[] {
  const root = species(lineRoot(name));
  const level = new Set(levelUpMoves(root).map(([, m]) => m));
  const all = new Map<string, 'level' | 'tm'>();
  for (const m of level) all.set(m, 'level');
  for (const m of teachableMoves(root)) if (!all.has(m)) all.set(m, 'tm');
  return [...all]
    .map(([id, how]) => ({id, how}))
    .sort((a, b) => dex.moves.get(b.id).basePower - dex.moves.get(a.id).basePower || a.id.localeCompare(b.id));
}

/** Aplica a ficha num Pokémon recém-criado para começar a run. */
export function applyEntry(c: Collection, mon: OwnedMon): void {
  const e = c.entries[lineRoot(mon.species)];
  if (!e) return;
  if (e.nature && e.natures?.includes(e.nature)) mon.nature = e.nature;
  const s = species(mon.species);
  if (e.ability && e.abilities?.includes(e.ability) && Object.values(s.abilities).includes(e.ability)) mon.ability = e.ability;
  if (e.startMove && e.moves?.includes(e.startMove) && !mon.moves.includes(e.startMove)) {
    if (mon.moves.length < 4) mon.moves.push(e.startMove);
    else mon.moves[0] = e.startMove;
  }
}
