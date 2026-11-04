// Quickplay "Escadinha": partidas rápidas de 1 Pokémon contra 1. Cada jogador tem uma escada de 8
// degraus que vai PIORANDO (lendário no topo, um filhote bem fraco no último). Ganhou a luta, desce
// um degrau; perdeu, fica onde está. Ganha quem vencer uma luta no último degrau.
import type {Species} from '@pkmn/sim';
import {PLAYABLE, isLegendary} from '../data/dex';
import {rushMon} from './rush';
import type {OwnedMon} from './types';

export interface LadderTier {
  name: string;
  fits: (s: Species) => boolean;
}

// Pokémon que não funcionam bem num 1 contra 1 (habilidade que trava, sem golpes de verdade, imune a quase tudo).
const LEFT_OUT = new Set(['Shedinja', 'Slaking', 'Regigigas', 'Ditto', 'Smeargle', 'Unown', 'Wobbuffet', 'Wynaut', 'Wishiwashi', 'Magikarp', 'Feebas', 'Kricketot', 'Burmy', 'Combee', 'Tynamo', 'Cosmog', 'Cosmoem', 'Kakuna', 'Metapod', 'Silcoon', 'Cascoon', 'Spewpa']);

const final = (s: Species, lo: number, hi: number) => !isLegendary(s) && !s.nfe && s.bst >= lo && s.bst <= hi;

export const LADDER: LadderTier[] = [
  {name: 'Lendário', fits: s => isLegendary(s) && s.bst >= 570 && s.bst <= 600},
  {name: 'Quase lendário', fits: s => final(s, 580, 720)},
  {name: 'Muito forte', fits: s => final(s, 525, 579)},
  {name: 'Forte', fits: s => final(s, 495, 524)},
  {name: 'Bom', fits: s => final(s, 460, 494)},
  {name: 'Médio', fits: s => final(s, 410, 459)},
  {name: 'Ainda vai evoluir', fits: s => !isLegendary(s) && s.nfe && !!s.prevo && s.bst >= 380 && s.bst <= 430},
  {name: 'Filhote', fits: s => !isLegendary(s) && s.nfe && !s.prevo && s.bst >= 250 && s.bst <= 320},
];

export const LADDER_STEPS = LADDER.length;

const POOLS = LADDER.map(t => PLAYABLE.filter(s => !LEFT_OUT.has(s.name) && t.fits(s)).map(s => s.name));

export function ladderPool(step: number): string[] {
  return POOLS[step];
}

const pickOne = (list: string[], taken: Set<string>) => {
  const free = list.filter(n => !taken.has(n));
  const name = free[Math.floor(Math.random() * free.length)];
  taken.add(name);
  return name;
};

/** As duas escadas, sem repetir Pokémon entre elas. */
export function drawLadders(): [string[], string[]] {
  const taken = new Set<string>();
  const one = () => POOLS.map(p => pickOne(p, taken));
  return [one(), one()];
}

/** Pokémon de um degrau, com set pensado e HP cheio (toda luta começa do zero). */
export function ladderMon(name: string): OwnedMon {
  return rushMon(name, 'nv50');
}

/** Depois de uma luta: quem venceu desce um degrau. Se já estava no último, é o campeão. */
export function ladderAfter(steps: [number, number], winner: number): {steps: [number, number]; champion: number | null} {
  if (steps[winner] >= LADDER_STEPS - 1) return {steps, champion: winner};
  const next: [number, number] = [steps[0], steps[1]];
  next[winner]++;
  return {steps: next, champion: null};
}
