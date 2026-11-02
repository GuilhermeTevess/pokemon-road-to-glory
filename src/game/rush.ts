// Quickplay "Rush": dois jogadores (online, no mesmo aparelho ou contra o computador). Aparecem 2 Pokémon sorteados;
// quem está na vez fica com um e o outro vai para o adversário. Cada um faz 3 escolhas,
// então os dois terminam com 6 Pokémon (3 escolhidos + 3 recebidos).
import type {Species} from '@pkmn/sim';
import {PLAYABLE, isLegendary, species} from '../data/dex';
import {ITEMS, megaStonesFor} from '../data/items';
import {createMon} from './mon';
import type {OwnedMon} from './types';

export type RushMode = 'nv50' | 'evo1' | 'evo2' | 'evo3' | 'mega' | 'legend' | 'mix' | 'lucky';

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
  {id: 'mix', name: 'Misturado', about: 'Normais, Pokémon que mega-evoluem e lendários no mesmo sorteio, todos no nível 50. Cada um ganha uma Mega Pedra coringa.', level: 50},
  {id: 'lucky', name: 'Tiro de sorte', about: 'Igual ao Clássico, mas no fim a sorte escolhe um dos dois para ganhar um lendário MUITO mais forte que todo mundo.', level: 50},
];

/** Modos em que cada um ganha a Mega Pedra coringa. */
export function megaMode(mode: RushMode): boolean {
  return mode === 'mega' || mode === 'mix';
}

export function rushMode(id: RushMode): RushModeInfo {
  return RUSH_MODES.find(m => m.id === id)!;
}

const MEGA_SPECIES = new Set(ITEMS.filter(i => i.megaFor).map(i => i.megaFor!));

function fits(s: Species, mode: RushMode): boolean {
  const legend = isLegendary(s);
  switch (mode) {
    case 'mix':
      return (!s.nfe && !legend) || MEGA_SPECIES.has(s.name) || legend;
    case 'nv50':
    case 'lucky':
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

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * `n` Pokémon sorteados sem repetir. No Misturado, cada vaga sorteia antes a categoria
 * (metade normais, um quarto megas, um quarto lendários) para os lendários não sumirem
 * no meio de centenas de normais.
 */
export function drawNames(mode: RushMode, n: number): string[] {
  if (mode !== 'mix') return shuffle(rushPool(mode)).slice(0, n);
  const legends = shuffle(PLAYABLE.filter(isLegendary).map(s => s.name));
  const megas = shuffle([...MEGA_SPECIES].filter(name => PLAYABLE.some(p => p.name === name)));
  const normals = shuffle(rushPool('nv50'));
  const out: string[] = [];
  while (out.length < n) {
    const r = Math.random();
    const from = r < 0.5 ? normals : r < 0.75 ? megas : legends;
    const name = from.pop() ?? normals.pop();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** `rounds` grupos de `size` Pokémon sorteados, sem repetir ninguém. */
export function drawGroups(mode: RushMode, rounds: number, size: number): string[][] {
  const pool = drawNames(mode, rounds * size);
  return Array.from({length: rounds}, (_, i) => pool.slice(i * size, i * size + size));
}

/** As duplas sorteadas: 6 rodadas de 2 Pokémon, sem repetir ninguém. */
export function drawPairs(mode: RushMode, rounds = 6): [string, string][] {
  const pool = drawNames(mode, rounds * 2);
  return Array.from({length: rounds}, (_, i) => [pool[i * 2], pool[i * 2 + 1]] as [string, string]);
}

export function rushMon(name: string, mode: RushMode): OwnedMon {
  return createMon(name, {level: rushMode(mode).level, ivMin: 20, shinyChance: 0.02, hiddenAbilityChance: 0.2});
}

// ------------------------------------------------------------------ Tiro de sorte

/** Os "quebrados": lendários com os maiores atributos do jogo (Mewtwo, Arceus, Rayquaza...). */
// Regigigas fica de fora: com Slow Start ele passa 5 turnos fraco, não tem graça como prêmio.
export const LUCKY_POOL: string[] = PLAYABLE.filter(s => isLegendary(s) && bst(s) >= 670 && s.name !== 'Regigigas').map(s => s.name);
export const LUCKY_LEVEL = 60;

function bst(s: Species): number {
  return Object.values(s.baseStats).reduce((a, b) => a + b, 0);
}

export interface LuckyShot {
  /** Quem ganhou (0 = jogador 1, 1 = jogador 2). */
  side: 0 | 1;
  /** O Pokémon quebrado que entrou no time. */
  species: string;
  /** Quem saiu para abrir a vaga (o mais fraco do time). */
  out: string;
}

/** Sorteia quem ganha o Pokémon quebrado e troca pelo mais fraco do time dele. Mexe em `teams`. */
export function rollLucky(teams: [OwnedMon[], OwnedMon[]]): LuckyShot {
  const side: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
  const team = teams[side];
  const used = new Set([...teams[0], ...teams[1]].map(m => m.species));
  const options = LUCKY_POOL.filter(n => !used.has(n));
  const name = options[Math.floor(Math.random() * options.length)];
  const weakest = [...team].sort((a, b) => bst(species(a.species)) - bst(species(b.species)))[0];
  const mon = createMon(name, {level: LUCKY_LEVEL, ivMin: 31, shinyChance: 0.1, hiddenAbilityChance: 0.3});
  team[team.indexOf(weakest)] = mon;
  return {side, species: mon.species, out: weakest.species};
}

/** Mega Pedra coringa: vira a pedra certa do Pokémon escolhido. */
export function giveMegaStone(mon: OwnedMon): void {
  const stone = megaStonesFor(mon.species)[0];
  if (stone) mon.item = stone.id;
}

// ------------------------------------------------------------------ Duelo (mesmo PC ou online)

import type {Battle} from '@pkmn/sim';
import {dex, typeMultiplier} from '../data/dex';
import type {BattleController, BattleEvent, Side} from './battle';

export interface DuelMove {
  index: number;
  id: string;
  name: string;
  type: string;
  category: string;
  basePower: number;
  pp: number;
  maxpp: number;
  disabled: boolean;
  /** Golpe em andamento (Bounce/Fly/Dig no 2º turno, Outrage, recarga): única opção, sem PP. */
  locked?: boolean;
  /** Eficácia contra quem está em campo do outro lado (null = golpe de status). */
  eff: number | null;
}

/** O que um lado pode fazer agora (vai pela rede para o amigo no online). */
export interface DuelReq {
  side: Side;
  forced: boolean;
  trapped: boolean;
  canMega: boolean;
  moves: DuelMove[];
  switches: {index: number; species: string; hp: number; maxhp: number; item?: string}[];
}

export function duelNeeds(b: Battle, side: Side): boolean {
  const s = b[side];
  return !b.ended && (s.requestState === 'move' || s.requestState === 'switch') && !s.isChoiceDone();
}

export function duelRequest(b: Battle, side: Side): DuelReq {
  const s = b[side];
  const req = s.activeRequest as {active?: {moves: {id: string; pp?: number; maxpp?: number; disabled?: boolean}[]; trapped?: boolean; canMegaEvo?: boolean}[]} | null;
  const act = req?.active?.[0];
  const foe = b[side === 'p1' ? 'p2' : 'p1'].active[0];
  return {
    side,
    forced: s.requestState === 'switch',
    trapped: !!act?.trapped,
    canMega: !!act?.canMegaEvo,
    moves: (act?.moves ?? []).map((m, i) => {
      const mv = dex.moves.get(m.id);
      // O simulador manda o golpe travado sem PP: é o 2º turno de um golpe de vários turnos.
      const locked = m.pp === undefined;
      return {
        index: i + 1, id: mv.id, name: mv.name, type: mv.type, category: mv.category, basePower: mv.basePower,
        pp: m.pp ?? 0, maxpp: m.maxpp ?? 0, disabled: !locked && !!m.disabled, locked,
        eff: mv.category === 'Status' || !foe ? null : typeMultiplier(mv.type, foe.getTypes()),
      };
    }),
    switches: s.pokemon
      .map((p, i) => ({p, i}))
      .filter(({p}) => !p.isActive && !p.fainted)
      .map(({p, i}) => ({index: i + 1, species: p.species.name, hp: p.hp, maxhp: p.maxhp, item: p.item || undefined})),
  };
}

/** Quem ainda está de pé em cada lado (as bolinhas do placar). */
export function duelBalls(b: Battle): {p1: boolean[]; p2: boolean[]} {
  return {p1: b.p1.pokemon.map(p => !p.fainted), p2: b.p2.pokemon.map(p => !p.fainted)};
}

/** Aplica a escolha ("move 2", "switch 3") de um lado e devolve o que aconteceu. */
export function duelChoose(ctl: BattleController, side: Side, choice: string, mega: boolean): BattleEvent[] {
  const [kind, n] = choice.split(' ');
  if (side === 'p2') return ctl.chooseP2(kind === 'move' && mega ? `${choice} mega` : choice);
  if (kind === 'switch') return ctl.chooseSwitchSlot(Number(n));
  return ctl.chooseMove(Number(n), mega);
}
