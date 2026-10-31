// Regiões dos jogos. A região pesa no sorteio dos selvagens (a geração dela aparece mais)
// e é a única onde as formas regionais aparecem (Vulpix de Alola só em Alola...).
import type {Species} from '@pkmn/sim';

export interface Region {
  id: string;
  name: string;
  /** Faixa da Pokédex nacional da geração da região. */
  nums: [number, number];
  /** Formas regionais que vivem aqui. */
  formes: string[];
  color: string;
  /** Frase curta para o cartão. */
  blurb: string;
  /** Iniciais da região, para o cartão. */
  icons: string[];
}

export const REGIONS: Region[] = [
  {id: 'kanto', name: 'Kanto', nums: [1, 151], formes: [], color: '#e8705f', blurb: 'Onde tudo começou.', icons: ['Bulbasaur', 'Charmander', 'Squirtle']},
  {id: 'johto', name: 'Johto', nums: [152, 251], formes: [], color: '#d9b25a', blurb: 'Tradição, torres e lendas antigas.', icons: ['Chikorita', 'Cyndaquil', 'Totodile']},
  {id: 'hoenn', name: 'Hoenn', nums: [252, 386], formes: [], color: '#4fb39a', blurb: 'Mar, vulcões e muito clima.', icons: ['Treecko', 'Torchic', 'Mudkip']},
  {id: 'sinnoh', name: 'Sinnoh', nums: [387, 493], formes: ['Hisui'], color: '#8f8fd8', blurb: 'Montanhas geladas e mitos do tempo e espaço.', icons: ['Turtwig', 'Chimchar', 'Piplup']},
  {id: 'unova', name: 'Unova', nums: [494, 649], formes: [], color: '#7a7a8c', blurb: 'Cidade grande, ideais e verdades.', icons: ['Snivy', 'Tepig', 'Oshawott']},
  {id: 'kalos', name: 'Kalos', nums: [650, 721], formes: [], color: '#4a8bd6', blurb: 'Elegância e mega evolução.', icons: ['Chespin', 'Fennekin', 'Froakie']},
  {id: 'alola', name: 'Alola', nums: [722, 809], formes: ['Alola'], color: '#f2a65a', blurb: 'Ilhas, provas e formas de Alola.', icons: ['Rowlet', 'Litten', 'Popplio']},
  {id: 'galar', name: 'Galar', nums: [810, 905], formes: ['Galar'], color: '#b65c8f', blurb: 'Estádios lotados e formas de Galar.', icons: ['Grookey', 'Scorbunny', 'Sobble']},
  {id: 'paldea', name: 'Paldea', nums: [906, 1025], formes: ['Paldea', 'Paldea-Combat', 'Paldea-Blaze', 'Paldea-Aqua'], color: '#c9503a', blurb: 'Mundo aberto e formas de Paldea.', icons: ['Sprigatito', 'Fuecoco', 'Quaxly']},
];

/** Rondas em cada região e em cada bioma antes do novo sorteio. */
export const REGION_STAY = 20;
export const BIOME_STAY = 10;

export function getRegion(id: string | undefined): Region {
  return REGIONS.find(r => r.id === id) ?? REGIONS[0];
}

/** Forma regional que não é desta região (não aparece aqui). */
export function isForeignForme(s: Species, region: Region): boolean {
  return !!s.forme && !region.formes.includes(s.forme);
}

/** Peso de uma espécie no sorteio da região: a geração dela e as formas regionais aparecem 3x mais. */
export function regionWeight(s: Species, region: Region): number {
  if (s.forme) return region.formes.includes(s.forme) ? 3 : 0;
  return s.num >= region.nums[0] && s.num <= region.nums[1] ? 3 : 1;
}
