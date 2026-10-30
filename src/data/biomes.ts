import type {Species} from '@pkmn/sim';
import {BASE_STAGE, PLAYABLE, evolutionLine, isLegendary, rarityOf} from './dex';
import type {Rarity} from './dex';

export interface Biome {
  id: string;
  name: string;
  types: string[];
  /** Fundo em pixel art (public/fx/bg/<bg>.png, do Pokémon Showdown). */
  bg: string;
  /** Filtro CSS para variar fundos reaproveitados. */
  filter?: string;
  /** Cor de destaque do bioma (cartões e reserva do fundo). */
  color: string;
}

export const BIOMES: Biome[] = [
  {id: 'plains', name: 'Campos', types: ['Normal', 'Grass', 'Bug'], bg: 'route', color: '#a7d98b'},
  {id: 'forest', name: 'Floresta', types: ['Grass', 'Bug', 'Poison'], bg: 'forest', color: '#7cc47f'},
  {id: 'lake', name: 'Lago', types: ['Water', 'Flying', 'Bug'], bg: 'beachshore', color: '#8fd3f0'},
  {id: 'sea', name: 'Mar Profundo', types: ['Water', 'Ice'], bg: 'deepsea', filter: 'brightness(1.25) saturate(1.2)', color: '#6aa6d8'},
  {id: 'beach', name: 'Praia', types: ['Water', 'Ground', 'Normal'], bg: 'beach', color: '#f4e3a1'},
  {id: 'cave', name: 'Caverna', types: ['Rock', 'Ground', 'Dark'], bg: 'earthycave', color: '#c9a77c'},
  {id: 'mountain', name: 'Montanha', types: ['Rock', 'Flying', 'Fighting'], bg: 'mountain', color: '#d6b98a'},
  {id: 'volcano', name: 'Vulcão', types: ['Fire', 'Ground', 'Rock'], bg: 'volcanocave', color: '#f0937a'},
  {id: 'snow', name: 'Caverna de Gelo', types: ['Ice', 'Water', 'Steel'], bg: 'icecave', color: '#a9e6ef'},
  {id: 'desert', name: 'Deserto', types: ['Ground', 'Rock', 'Fire'], bg: 'desert', color: '#f2cf86'},
  {id: 'swamp', name: 'Pântano', types: ['Poison', 'Water', 'Ghost'], bg: 'river', filter: 'hue-rotate(-25deg) saturate(0.85)', color: '#a3b26f'},
  {id: 'city', name: 'Cidade', types: ['Normal', 'Electric', 'Steel'], bg: 'city', color: '#c7b8a8'},
  {id: 'powerplant', name: 'Planície Elétrica', types: ['Electric', 'Steel'], bg: 'thunderplains', color: '#f2e27a'},
  {id: 'graveyard', name: 'Gruta Sombria', types: ['Ghost', 'Dark', 'Poison'], bg: 'dampcave', filter: 'hue-rotate(220deg) saturate(1.3) brightness(0.9)', color: '#a08cc8'},
  {id: 'ruins', name: 'Ruínas Antigas', types: ['Psychic', 'Rock', 'Ghost'], bg: 'desert', filter: 'sepia(0.4) hue-rotate(-15deg)', color: '#d9c39a'},
  {id: 'fairy', name: 'Bosque Encantado', types: ['Fairy', 'Psychic', 'Grass'], bg: 'meadow', filter: 'hue-rotate(250deg) saturate(1.1)', color: '#f2b8de'},
  {id: 'dojo', name: 'Pradaria', types: ['Fighting', 'Normal'], bg: 'meadow', color: '#b9d98a'},
  {id: 'sky', name: 'Pico Celeste', types: ['Flying', 'Dragon', 'Psychic'], bg: 'mountain', filter: 'hue-rotate(170deg) brightness(1.1)', color: '#a8c8f0'},
  {id: 'dragon', name: 'Covil do Dragão', types: ['Dragon', 'Fire', 'Dark'], bg: 'volcanocave', filter: 'hue-rotate(230deg) saturate(1.2)', color: '#b39ae0'},
  {id: 'abyss', name: 'Abismo', types: ['Dark', 'Ghost', 'Psychic'], bg: 'deepsea', filter: 'hue-rotate(60deg) saturate(1.2)', color: '#8a7fb8'},
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
