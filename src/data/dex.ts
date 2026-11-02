// Acesso aos dados do Pokémon Showdown (todas as gerações) e helpers de espécies,
// golpes, tipos e sprites.
import {Dex, toID} from '@pkmn/sim';
import type {Species} from '@pkmn/sim';
import {Sprites} from '@pkmn/img';

export const dex = Dex.forGen(9);
export {toID};

export type TypeName = string;
export type Rarity = 'common' | 'uncommon' | 'rare' | 'superRare' | 'legendary';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  superRare: 'Super raro',
  legendary: 'Lendário',
};

export const ALL_TYPES: TypeName[] = dex.types
  .all()
  .map(t => t.name)
  .filter(t => t !== 'Stellar');

const REGIONAL_FORMES = new Set(['Alola', 'Galar', 'Hisui', 'Paldea', 'Paldea-Combat', 'Paldea-Blaze', 'Paldea-Aqua']);
const BLOCKED_NONSTANDARD = new Set(['CAP', 'Custom', 'LGPE', 'Future']);

/** Espécie que pode aparecer no jogo (forma base ou regional, de qualquer geração). */
export function isPlayable(s: Species): boolean {
  if (!s.exists || s.num <= 0) return false;
  if (s.isNonstandard && BLOCKED_NONSTANDARD.has(s.isNonstandard)) return false;
  if (s.battleOnly || s.tags.includes('Pokestar' as never)) return false;
  if (s.forme && !REGIONAL_FORMES.has(s.forme)) return false;
  return true;
}

export const PLAYABLE: Species[] = dex.species.all().filter(isPlayable);

export function species(name: string): Species {
  return dex.species.get(name);
}

export function isLegendary(s: Species): boolean {
  return s.tags.some(t => t === 'Restricted Legendary' || t === 'Sub-Legendary' || t === 'Mythical');
}

/** Primeiro estágio da linha evolutiva (sem pré-evolução jogável). */
export function isBaseStage(s: Species): boolean {
  if (!s.prevo) return true;
  const p = dex.species.get(s.prevo);
  return !isPlayable(p);
}

export function playableEvos(s: Species): Species[] {
  return s.evos.map(e => dex.species.get(e)).filter(isPlayable);
}

/** Todas as espécies da linha a partir desta (inclusive). */
export function evolutionLine(s: Species): Species[] {
  const out = [s];
  for (const e of playableEvos(s)) out.push(...evolutionLine(e));
  return out;
}

export function rarityOf(s: Species): Rarity {
  if (isLegendary(s)) return 'legendary';
  if (s.tags.some(t => t === 'Ultra Beast' || t === 'Paradox')) return 'superRare';
  const maxBst = Math.max(...evolutionLine(s).map(x => x.bst));
  if (maxBst >= 600) return 'superRare';
  if (maxBst >= 530) return 'rare';
  if (maxBst >= 470) return 'uncommon';
  return 'common';
}

/** Espécies de primeiro estágio — a base para iniciais e encontros selvagens. */
export const BASE_STAGE: Species[] = PLAYABLE.filter(isBaseStage);

// ---------------------------------------------------------------- Golpes

export function learnsetFor(s: Species): Record<string, string[]> {
  const tries = [s.id, toID(s.changesFrom ?? ''), toID(s.baseSpecies)];
  for (const id of tries) {
    if (!id) continue;
    const data = dex.species.getLearnsetData(id as never);
    if (data?.learnset) return data.learnset;
  }
  return {};
}

export function isUsableMove(id: string): boolean {
  const m = dex.moves.get(id);
  return m.exists && !m.isZ && !m.isMax && m.isNonstandard !== 'CAP' && m.isNonstandard !== 'LGPE' && m.isNonstandard !== 'Future';
}

/** Golpes aprendidos por nível: [nível, id], usando a geração mais recente que o Pokémon teve. */
export function levelUpMoves(s: Species): [number, string][] {
  const out: [number, string][] = [];
  for (const [move, sources] of Object.entries(learnsetFor(s))) {
    if (!isUsableMove(move)) continue;
    let best: [number, number] | null = null; // [gen, level]
    for (const src of sources) {
      const m = /^(\d)L(\d+)$/.exec(src);
      if (!m) continue;
      const gen = +m[1];
      const lvl = Math.max(1, +m[2]);
      if (!best || gen > best[0]) best = [gen, lvl];
    }
    if (best) {
      // Nas gerações novas muitos golpes fortes ficam "no nível 1" (relembrar).
      // Empurramos esses para um nível proporcional ao poder, senão um Pokémon
      // de nível 2 já sairia usando Power Gem.
      const bp = dex.moves.get(move).basePower;
      const lvl = best[1] <= 1 && bp > 50 ? Math.floor(bp * 0.4) : best[1];
      out.push([lvl, move]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/** Moveset "natural" para um Pokémon nesse nível (últimos 4 golpes aprendidos). */
export function movesAtLevel(s: Species, level: number): string[] {
  const learned = [...new Set(levelUpMoves(s).filter(([l]) => l <= level).map(([, m]) => m))];
  const moves = learned.slice(-4);
  return moves.length ? moves : ['tackle'];
}

/** Golpes novos aprendidos exatamente nesse nível. */
export function movesLearnedAt(s: Species, level: number): string[] {
  return levelUpMoves(s).filter(([l]) => l === level).map(([, m]) => m);
}

/** Golpes que o Pokémon pode aprender por MT/tutor/ovo (para o item Disco Técnico). */
/** Golpes por MT/tutor. Sem `status`, só os que causam dano (as MTs da run). */
export function teachableMoves(s: Species, status = false): string[] {
  return Object.entries(learnsetFor(s))
    .filter(([m, srcs]) => isUsableMove(m) && srcs.some(x => /^\d[MTE]$/.test(x)) && (status || dex.moves.get(m).basePower > 0))
    .map(([m]) => m);
}

/** Golpes de ovo (só passam por breeding). */
export function eggMoves(s: Species): string[] {
  return Object.entries(learnsetFor(s))
    .filter(([m, srcs]) => isUsableMove(m) && srcs.some(x => /^\dE$/.test(x)))
    .map(([m]) => m);
}

/** Todos os golpes que a espécie aprende de algum jeito. */
export function allLearnable(s: Species): Set<string> {
  return new Set(Object.keys(learnsetFor(s)).filter(isUsableMove));
}

// ---------------------------------------------------------------- Tipos

/** Multiplicador de dano de um tipo atacante contra os tipos do defensor. */
export function typeMultiplier(attack: TypeName, defender: readonly TypeName[]): number {
  if (!dex.getImmunity(attack, defender as string[])) return 0;
  return 2 ** dex.getEffectiveness(attack, defender as string[]);
}

export interface Matchups {
  x4: TypeName[];
  x2: TypeName[];
  half: TypeName[];
  quarter: TypeName[];
  immune: TypeName[];
}

export function defensiveMatchups(types: readonly TypeName[]): Matchups {
  const r: Matchups = {x4: [], x2: [], half: [], quarter: [], immune: []};
  for (const t of ALL_TYPES) {
    const m = typeMultiplier(t, types);
    if (m === 0) r.immune.push(t);
    else if (m >= 4) r.x4.push(t);
    else if (m === 2) r.x2.push(t);
    else if (m === 0.5) r.half.push(t);
    else if (m <= 0.25) r.quarter.push(t);
  }
  return r;
}

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#a8a77a', Fire: '#ee8130', Water: '#6390f0', Electric: '#f7d02c', Grass: '#7ac74c',
  Ice: '#96d9d6', Fighting: '#c22e28', Poison: '#a33ea1', Ground: '#e2bf65', Flying: '#a98ff3',
  Psychic: '#f95587', Bug: '#a6b91a', Rock: '#b6a136', Ghost: '#735797', Dragon: '#6f35fc',
  Dark: '#705746', Steel: '#b7b7ce', Fairy: '#d685ad', '???': '#68a090',
};

export const TYPE_PT: Record<string, string> = {
  Normal: 'Normal', Fire: 'Fogo', Water: 'Água', Electric: 'Elétrico', Grass: 'Planta', Ice: 'Gelo',
  Fighting: 'Lutador', Poison: 'Veneno', Ground: 'Terra', Flying: 'Voador', Psychic: 'Psíquico',
  Bug: 'Inseto', Rock: 'Pedra', Ghost: 'Fantasma', Dragon: 'Dragão', Dark: 'Sombrio', Steel: 'Aço',
  Fairy: 'Fada', '???': '???',
};

// ---------------------------------------------------------------- Sprites

const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

/**
 * Lista de URLs em ordem de preferência: pixel art animada do Showdown (estilo gen 5),
 * estática do Showdown e, por fim, a do PokéAPI pelo número da Pokédex.
 */
export function spriteUrls(name: string, opts: {back?: boolean; shiny?: boolean; still?: boolean} = {}): string[] {
  const s = species(name);
  const side = opts.back ? 'p1' : 'p2';
  const urls = [
    ...(opts.still ? [] : [Sprites.getPokemon(name, {gen: 'gen5ani', side, shiny: opts.shiny}).url]),
    Sprites.getPokemon(name, {gen: 'gen5', side, shiny: opts.shiny}).url,
    `${POKEAPI}/${opts.back ? 'back/' : ''}${opts.shiny ? 'shiny/' : ''}${s.num}.png`,
  ];
  return [...new Set(urls)];
}

export function itemSpriteUrl(slug: string): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
}
