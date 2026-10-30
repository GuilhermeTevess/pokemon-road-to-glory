import type {Species} from '@pkmn/sim';
import {BASE_STAGE, PLAYABLE, evolutionLine, isLegendary, rarityOf} from './dex';
import type {Rarity} from './dex';

export interface Biome {
  id: string;
  name: string;
  emoji: string;
  types: string[];
  /** Cores do gradiente de fundo da batalha (céu, chão). */
  colors: [string, string];
}

export const BIOMES: Biome[] = [
  {id: 'plains', name: 'Campos', emoji: '🌾', types: ['Normal', 'Grass', 'Bug'], colors: ['#9fd7ff', '#7fc06a']},
  {id: 'forest', name: 'Floresta', emoji: '🌲', types: ['Grass', 'Bug', 'Poison'], colors: ['#6aa66f', '#2f6b3a']},
  {id: 'lake', name: 'Lago', emoji: '🏞️', types: ['Water', 'Flying', 'Bug'], colors: ['#a8e0ff', '#4b9fd8']},
  {id: 'sea', name: 'Mar Aberto', emoji: '🌊', types: ['Water', 'Ice'], colors: ['#7fc8ff', '#1f5fa8']},
  {id: 'beach', name: 'Praia', emoji: '🏖️', types: ['Water', 'Ground', 'Normal'], colors: ['#bfe8ff', '#f0d98c']},
  {id: 'cave', name: 'Caverna', emoji: '🕳️', types: ['Rock', 'Ground', 'Dark'], colors: ['#5a4c44', '#2e2622']},
  {id: 'mountain', name: 'Montanha', emoji: '⛰️', types: ['Rock', 'Flying', 'Fighting'], colors: ['#b9c6d6', '#7d6e5d']},
  {id: 'volcano', name: 'Vulcão', emoji: '🌋', types: ['Fire', 'Ground', 'Rock'], colors: ['#ff9b6a', '#6b2a1a']},
  {id: 'snow', name: 'Tundra Gelada', emoji: '❄️', types: ['Ice', 'Water', 'Steel'], colors: ['#e3f4ff', '#bcd9ea']},
  {id: 'desert', name: 'Deserto', emoji: '🏜️', types: ['Ground', 'Rock', 'Fire'], colors: ['#ffe2a1', '#d9a95a']},
  {id: 'swamp', name: 'Pântano', emoji: '🐸', types: ['Poison', 'Water', 'Ghost'], colors: ['#8fa88a', '#3f5a3c']},
  {id: 'city', name: 'Cidade', emoji: '🏙️', types: ['Normal', 'Electric', 'Steel'], colors: ['#c9d3e0', '#7a8594']},
  {id: 'powerplant', name: 'Usina', emoji: '⚡', types: ['Electric', 'Steel'], colors: ['#fff3a0', '#6d6d7a']},
  {id: 'graveyard', name: 'Cemitério', emoji: '🪦', types: ['Ghost', 'Dark', 'Poison'], colors: ['#5d4f7a', '#2a2238']},
  {id: 'ruins', name: 'Ruínas Antigas', emoji: '🏛️', types: ['Psychic', 'Rock', 'Ghost'], colors: ['#e8d7b0', '#9d8a63']},
  {id: 'fairy', name: 'Bosque Encantado', emoji: '🍄', types: ['Fairy', 'Psychic', 'Grass'], colors: ['#ffd1f0', '#b78bd6']},
  {id: 'dojo', name: 'Dojo', emoji: '🥋', types: ['Fighting', 'Normal'], colors: ['#f2d9b5', '#a0703e']},
  {id: 'sky', name: 'Céu', emoji: '☁️', types: ['Flying', 'Dragon', 'Psychic'], colors: ['#d8f0ff', '#8cc3f2']},
  {id: 'dragon', name: 'Covil do Dragão', emoji: '🐉', types: ['Dragon', 'Fire', 'Dark'], colors: ['#7a5fb0', '#2b1f45']},
  {id: 'abyss', name: 'Abismo', emoji: '🌑', types: ['Dark', 'Ghost', 'Psychic'], colors: ['#3a3355', '#0f0d18']},
];

export function getBiome(id: string): Biome {
  return BIOMES.find(b => b.id === id) ?? BIOMES[0];
}

export type Pools = Record<Rarity, Species[]>;

const poolCache = new Map<string, Pools>();

/**
 * Pokémon de cada raridade que vivem no bioma. Para os comuns a raros usamos o
 * primeiro estágio (eles evoluem conforme o nível); lendários usam a própria espécie.
 */
export function biomePools(biome: Biome): Pools {
  const cached = poolCache.get(biome.id);
  if (cached) return cached;
  const fits = (s: Species) => evolutionLine(s).some(x => x.types.some(t => biome.types.includes(t)));
  const pools: Pools = {common: [], uncommon: [], rare: [], superRare: [], legendary: []};
  for (const s of BASE_STAGE) {
    if (isLegendary(s) || !fits(s)) continue;
    pools[rarityOf(s)].push(s);
  }
  pools.legendary = PLAYABLE.filter(s => isLegendary(s) && s.types.some(t => biome.types.includes(t)));
  poolCache.set(biome.id, pools);
  return pools;
}
