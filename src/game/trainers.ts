// Perfis de treinador. Cada treinador tem a própria coleção e a própria run salva:
// um treinador nunca vê os Pokémon de outro. Até 3 perfis (os "slots" de save).
import {uid} from './rng';

export interface Trainer {
  id: string;
  name: string;
  /** Sprite de treinador do Showdown (ex.: "juliana"). */
  avatar: string;
  createdAt: number;
}

interface TrainerStore {
  list: Trainer[];
  current: string | null;
}

export const MAX_TRAINERS = 3;
const KEY = 'rtg-trainers';

/** Protagonistas de cada geração, em pares. */
export const AVATARS = [
  'red', 'leaf', 'ethan', 'lyra', 'brendan', 'may', 'lucas', 'dawn', 'hilbert', 'hilda',
  'calem', 'serena', 'elio', 'selene', 'victor', 'gloria', 'florian', 'juliana',
];

export function avatarUrl(avatar: string): string {
  return `https://play.pokemonshowdown.com/sprites/trainers/${avatar}.png`;
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
