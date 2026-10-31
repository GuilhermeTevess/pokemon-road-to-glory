// Quickplay "Rush": dois jogadores no mesmo PC. Aparecem 2 Pokémon sorteados;
// quem está na vez fica com um e o outro vai para o adversário. Cada um faz 3 escolhas,
// então os dois terminam com 6 Pokémon (3 escolhidos + 3 recebidos).
import type {Species} from '@pkmn/sim';
import {PLAYABLE, isLegendary} from '../data/dex';
import {ITEMS, megaStonesFor} from '../data/items';
import {createMon} from './mon';
import type {OwnedMon} from './types';

export type RushMode = 'nv50' | 'evo1' | 'evo2' | 'evo3' | 'mega' | 'legend';

export interface RushModeInfo {
  id: RushMode;
  name: string;
  about: string;
  level: number;
}

export const RUSH_MODES: RushModeInfo[] = [
  {id: 'nv50', name: 'Clássico Nv. 50', about: 'Pokémon já evoluídos (sem lendários), todos no nível 50.', level: 50},
  {id: 'evo1', name: 'Evo 1', about: 'Só Pokémon no primeiro estágio (que ainda vão evoluir), nível 20.', level: 20},
  {id: 'evo2', name: 'Evo 2', about: 'Só estágios do meio (tipo Ivysaur e Charmeleon), nível 35.', level: 35},
  {id: 'evo3', name: 'Evo 3', about: 'Só a última evolução de linhas de 3 estágios, nível 50.', level: 50},
  {id: 'mega', name: 'Mega', about: 'Só Pokémon que mega-evoluem. Cada um ganha uma Mega Pedra coringa para dar a quem quiser.', level: 50},
  {id: 'legend', name: 'Lendários', about: 'Só lendários e míticos, nível 70. Caos garantido.', level: 70},
];

export function rushMode(id: RushMode): RushModeInfo {
  return RUSH_MODES.find(m => m.id === id)!;
}

const MEGA_SPECIES = new Set(ITEMS.filter(i => i.megaFor).map(i => i.megaFor!));

function fits(s: Species, mode: RushMode): boolean {
  const legend = isLegendary(s);
  switch (mode) {
    case 'nv50':
      return !s.nfe && !legend;
    case 'evo1':
      return !s.prevo && s.nfe && !legend;
    case 'evo2':
      return !!s.prevo && s.nfe;
    case 'evo3':
      return !!s.prevo && !s.nfe && !!PLAYABLE.find(p => p.name === s.prevo)?.prevo;
    case 'mega':
      return MEGA_SPECIES.has(s.name);
    case 'legend':
      return legend;
  }
}

const POOLS = new Map<RushMode, string[]>();

export function rushPool(mode: RushMode): string[] {
  if (!POOLS.has(mode)) POOLS.set(mode, PLAYABLE.filter(s => fits(s, mode)).map(s => s.name));
  return POOLS.get(mode)!;
}

/** `rounds` grupos de `size` Pokémon sorteados, sem repetir ninguém. */
export function drawGroups(mode: RushMode, rounds: number, size: number): string[][] {
  const pool = [...rushPool(mode)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({length: rounds}, (_, i) => pool.slice(i * size, i * size + size));
}

/** As duplas sorteadas: 6 rodadas de 2 Pokémon, sem repetir ninguém. */
export function drawPairs(mode: RushMode, rounds = 6): [string, string][] {
  const pool = [...rushPool(mode)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({length: rounds}, (_, i) => [pool[i * 2], pool[i * 2 + 1]] as [string, string]);
}

export function rushMon(name: string, mode: RushMode): OwnedMon {
  return createMon(name, {level: rushMode(mode).level, ivMin: 20, shinyChance: 0.02, hiddenAbilityChance: 0.2});
}

/** Mega Pedra coringa: vira a pedra certa do Pokémon escolhido. */
export function giveMegaStone(mon: OwnedMon): void {
  const stone = megaStonesFor(mon.species)[0];
  if (stone) mon.item = stone.id;
}
