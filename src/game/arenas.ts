// Arenas com plateia dos modos rápidos (Rush, Dream Team e torneio rápido).
// A carreira e a aventura continuam com os cenários próprios delas.
import {hashText} from './rng';

export interface ArenaInfo {
  id: 'praca' | 'coliseu' | 'noturno' | 'praia' | 'gelo' | 'coberto';
  name: string;
}

export const ARENAS: ArenaInfo[] = [
  {id: 'praca', name: 'Arena da Praça'},
  {id: 'coliseu', name: 'Coliseu ao Entardecer'},
  {id: 'noturno', name: 'Estádio Noturno'},
  {id: 'praia', name: 'Arena da Praia'},
  {id: 'gelo', name: 'Arena do Gelo'},
  {id: 'coberto', name: 'Ginásio Coberto'},
];

/** Arena fixa para uma sala: os dois jogadores online veem a mesma. */
export function arenaFor(seed: string): number {
  return hashText(seed.toUpperCase()) % ARENAS.length;
}

/** Arena sorteada (partidas no mesmo PC ou contra o computador). */
export function randomArena(): number {
  return Math.floor(Math.random() * ARENAS.length);
}
