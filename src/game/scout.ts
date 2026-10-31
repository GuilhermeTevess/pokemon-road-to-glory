// Estudo do adversário: em vez de mostrar o time exato, mostra as últimas batalhas dele
// (o que já foi visto em campo, itens e resultados). Dá uma ideia, não a resposta.
import {RIVALS, getRival} from '../data/rivals';

export interface ScoutMatch {
  vs: string;
  won: boolean;
  /** Pokémon que apareceram naquela luta. */
  seen: string[];
  items: string[];
}

export interface ScoutReport {
  matches: ScoutMatch[];
  /** Quem ele mais usou nas últimas lutas. */
  favorites: string[];
  /** Com quem costuma abrir. */
  lead?: string;
}

const ITEMS = ['Leftovers', 'Choice Scarf', 'Focus Sash', 'Life Orb', 'Sitrus Berry', 'Assault Vest', 'Choice Band', 'Expert Belt', 'Rocky Helmet'];

function seeded(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

export function scoutReport(name: string, wave: number): ScoutReport | null {
  const rival = getRival(name);
  if (!rival) return null;
  const rand = seeded([...name].reduce((a, c) => a * 31 + c.charCodeAt(0), wave) >>> 0);
  const pickN = <T,>(list: T[], n: number) => [...list].sort(() => rand() - 0.5).slice(0, n);
  const others = RIVALS.filter(r => r.name !== name);
  const count = new Map<string, number>();
  const matches: ScoutMatch[] = Array.from({length: 3}, () => {
    // Vê só uma parte do time, e às vezes Pokémon que ele deixou de fora hoje.
    const seen = pickN(rival.team, 2 + Math.floor(rand() * 2));
    for (const s of seen) count.set(s, (count.get(s) ?? 0) + 1);
    return {vs: others[Math.floor(rand() * others.length)].name, won: rand() < 0.6, seen, items: pickN(ITEMS, 1 + Math.floor(rand() * 2))};
  });
  const favorites = [...count].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
  return {matches, favorites, lead: rand() < 0.7 ? rival.team[0] : undefined};
}
