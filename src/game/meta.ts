// Progresso que sobrevive entre runs (coleção). É a base da etapa 2:
// doces, IVs melhores com repetidos, EVs, breeding e venda vão morar aqui.
import {species, toID} from '../data/dex';
import {zeroStats} from './mon';
import {STAT_IDS} from './types';
import type {OwnedMon, StatTable} from './types';

export interface CollectionEntry {
  /** Quantas vezes foi capturado (repetidos melhoram os IVs). */
  caught: number;
  bestIvs: StatTable;
  shiny: boolean;
  firstCaughtAt: number;
}

export interface RunSummary {
  endedAt: number;
  wave: number;
  starter: string;
  result: 'lost' | 'stageClear' | 'abandoned';
  party: string[];
}

export interface Collection {
  version: 1;
  /** Indexado pela espécie base da linha evolutiva (ex.: "charmander"). */
  entries: Record<string, CollectionEntry>;
  runs: RunSummary[];
}

const KEY = 'rtg-collection';

export function lineRoot(name: string): string {
  let s = species(name);
  for (let guard = 0; guard < 4 && s.prevo; guard++) s = species(s.prevo);
  return toID(s.name);
}

export function loadCollection(): Collection {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Collection;
  } catch {
    /* sem storage: começa vazio */
  }
  return {version: 1, entries: {}, runs: []};
}

export function saveCollection(c: Collection): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignora */
  }
}

/** Registra uma captura. Repetidos melhoram os IVs guardados (o maior de cada atributo, +1 de bônus). */
export function registerCatch(c: Collection, mon: OwnedMon): {duplicate: boolean; before: StatTable; after: StatTable} {
  const id = lineRoot(mon.species);
  const prev = c.entries[id];
  if (!prev) {
    c.entries[id] = {caught: 1, bestIvs: {...mon.ivs}, shiny: mon.shiny, firstCaughtAt: Date.now()};
    return {duplicate: false, before: zeroStats(), after: {...mon.ivs}};
  }
  const before = {...prev.bestIvs};
  const next = zeroStats();
  for (const s of STAT_IDS) next[s] = Math.min(31, Math.max(prev.bestIvs[s], mon.ivs[s]) + (prev.bestIvs[s] < 31 ? 1 : 0));
  prev.bestIvs = next;
  prev.caught++;
  prev.shiny ||= mon.shiny;
  return {duplicate: true, before, after: {...next}};
}

/** IVs para um inicial: os melhores da coleção ou aleatórios. */
export function starterIvs(c: Collection, name: string): StatTable | undefined {
  return c.entries[lineRoot(name)]?.bestIvs;
}
