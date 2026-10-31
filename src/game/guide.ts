// Guia dos biomas: quem pode aparecer em cada bioma e com que chance, na ronda escolhida.
// Usa as mesmas contas do sorteio dos selvagens (encounters.ts), então o guia nunca mente.
import type {Species} from '@pkmn/sim';
import {biomePools, getBiome} from '../data/biomes';
import type {Rarity} from '../data/dex';
import {species} from '../data/dex';
import {getRegion, regionWeight} from '../data/regions';
import {ORDER, rarityWeights} from './encounters';

export interface GuideRow {
  species: Species;
  rarity: Rarity;
  /** Chance (0 a 1) de ser este Pokémon numa ronda comum. */
  chance: number;
}

/** Chance de cada Pokémon numa ronda comum (sem ser chefe nem torneio). */
export function biomeOdds(biomeId: string, wave: number, regionId?: string, luck = 0): GuideRow[] {
  const biome = getBiome(biomeId);
  const pools = biomePools(biome);
  const region = regionId ? getRegion(regionId) : undefined;
  // Biomas ocultos já sorteiam como se tivessem incenso.
  const weights = rarityWeights(wave, !!biome.region, luck);
  const total = weights.reduce((a, [, w]) => a + w, 0);
  const out = new Map<string, GuideRow>();
  for (const [rarity, w] of weights) {
    if (w <= 0) continue;
    let found = false;
    // Raridade vazia no bioma: o sorteio desce até achar alguém (igual ao jogo).
    for (let i = ORDER.indexOf(rarity); i >= 0; i--) {
      const pool = pools[ORDER[i]]
        .map(s => [s, region ? regionWeight(s, region) : 1] as [Species, number])
        .filter(([, x]) => x > 0);
      if (!pool.length) continue;
      const sum = pool.reduce((a, [, x]) => a + x, 0);
      for (const [s, x] of pool) {
        const row = out.get(s.name) ?? {species: s, rarity: ORDER[i], chance: 0};
        row.chance += (w / total) * (x / sum);
        out.set(s.name, row);
      }
      found = true;
      break;
    }
    if (!found) {
      // Ninguém nessa raridade nem abaixo: o jogo manda um Rattata (igual a encounters.ts).
      const s = species('Rattata');
      const row = out.get(s.name) ?? {species: s, rarity: 'common' as Rarity, chance: 0};
      row.chance += w / total;
      out.set(s.name, row);
    }
  }
  return [...out.values()].sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity) || b.chance - a.chance);
}

/** Chance de cada raridade numa ronda comum (para a barrinha do topo do guia). */
export function rarityOdds(biomeId: string, wave: number, luck = 0): [Rarity, number][] {
  const weights = rarityWeights(wave, !!getBiome(biomeId).region, luck);
  const total = weights.reduce((a, [, w]) => a + w, 0);
  return weights.map(([r, w]) => [r, w / total]);
}
