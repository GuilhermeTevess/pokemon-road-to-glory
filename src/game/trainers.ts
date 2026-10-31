// Perfis de treinador. Cada treinador tem a própria coleção e a própria run salva:
// um treinador nunca vê os Pokémon de outro. Até 3 perfis (os "slots" de save).
import {uid} from './rng';

export interface Trainer {
  id: string;
  name: string;
  /** Sprite de treinador do Showdown (ex.: "dawn") ou visual próprio ("custom:..."). */
  avatar: string;
  createdAt: number;
  /** Treinador de uma carreira online (não conta no limite de 3). */
  career?: TrainerCareer;
}

export interface TrainerCareer {
  code: string;
  /** Treinador cuja coleção é usada (quando o host libera a coleção). */
  colFrom?: string;
  /** Temporada atual, pontos das temporadas terminadas e colocações nos torneios. */
  season: number;
  banked: number;
  results: {season: number; kind: string; placement: number}[];
  done?: boolean;
}

interface TrainerStore {
  list: Trainer[];
  current: string | null;
}

export const MAX_TRAINERS = 3;
const KEY = 'rtg-trainers';

/** Protagonistas de cada geração, em pares. */
export const AVATARS = [
  'red', 'leaf-gen3', 'ethan', 'lyra', 'brendan', 'may', 'lucas', 'dawn', 'hilbert', 'hilda',
  'nate', 'rosa', 'calem', 'serena', 'elio', 'selene', 'victor', 'gloria', 'florian-s', 'juliana-s',
];

/** Nomes antigos sem sprite no Showdown: saves com eles usam a versão que existe. */
const LEGACY: Record<string, string> = {leaf: 'leaf-gen3', florian: 'florian-s', juliana: 'juliana-s'};

export function avatarUrl(avatar: string): string {
  return `https://play.pokemonshowdown.com/sprites/trainers/${LEGACY[avatar] ?? avatar}.png`;
}

export const collectionKey = (trainerId: string) => `rtg-collection-${trainerId}`;
export const runKey = (trainerId: string) => `rtg-run-${trainerId}`;

function read(): TrainerStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as TrainerStore;
    // Saves de antes dos perfis: viram o primeiro treinador.
    const oldCol = localStorage.getItem('rtg-collection');
    const oldRun = localStorage.getItem('rtg-run');
    if (oldCol || oldRun) {
      const t: Trainer = {id: uid(), name: 'Treinador 1', avatar: 'red', createdAt: Date.now()};
      if (oldCol) localStorage.setItem(collectionKey(t.id), oldCol);
      if (oldRun) localStorage.setItem(runKey(t.id), oldRun);
      localStorage.removeItem('rtg-collection');
      localStorage.removeItem('rtg-run');
      const store = {list: [t], current: t.id};
      write(store);
      return store;
    }
  } catch {
    /* sem storage */
  }
  return {list: [], current: null};
}

function write(s: TrainerStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignora */
  }
}

export function loadTrainers(): TrainerStore {
  return read();
}

export function saveTrainers(list: Trainer[], current: string | null): void {
  write({list, current});
}

export function newTrainer(name: string, avatar: string): Trainer {
  return {id: uid(), name: name.trim().slice(0, 16) || 'Treinador', avatar, createdAt: Date.now()};
}

export function deleteTrainerData(id: string): void {
  try {
    localStorage.removeItem(collectionKey(id));
    localStorage.removeItem(runKey(id));
  } catch {
    /* ignora */
  }
}
