// "Quer trocar o Pokémon?": antes da luta da run, mostra quem veio e ajuda a escolher
// quem começa, comparando tipos (golpes seus contra ele, tipos dele contra você).
import {dex, species, typeMultiplier} from '../data/dex';
import type {Encounter, OwnedMon} from './types';

export interface LeadAdvice {
  /** Melhor multiplicador entre os golpes de dano do seu Pokémon contra o adversário (1 se não tiver golpe de dano). */
  attack: number;
  /** Golpe que dá esse multiplicador. */
  move?: string;
  /** Pior multiplicador dos tipos do adversário contra o seu Pokémon. */
  defend: number;
  /** Nota para ordenar: maior é melhor. */
  score: number;
}

/** Quão bom é começar com `mon` contra os adversários de `foes` (espécies). */
export function leadAdvice(mon: OwnedMon, foes: string[]): LeadAdvice {
  const myTypes = species(mon.species).types;
  let attack = 0;
  let move: string | undefined;
  let any = false;
  for (const id of mon.moves) {
    const m = dex.moves.get(id);
    if (!m.exists || m.category === 'Status' || !m.basePower) continue;
    any = true;
    // Contra dois selvagens: vale o pior dos dois (o golpe precisa servir para ambos).
    const mult = Math.min(...foes.map(f => typeMultiplier(m.type, species(f).types)));
    if (mult > attack) {
      attack = mult;
      move = m.name;
    }
  }
  if (!any) attack = 1;
  const defend = Math.max(...foes.flatMap(f => species(f).types.map(t => typeMultiplier(t, myTypes))));
  const score = Math.log2(Math.max(attack, 0.125)) - Math.log2(Math.max(defend, 0.125)) + mon.level / 1000;
  return {attack, move, defend, score};
}

/** Adversários que entram primeiro (dois na dupla). */
export function firstFoes(enc: Encounter): OwnedMon[] {
  return enc.double && enc.team ? enc.team.slice(0, 2) : [enc.mon];
}

/** Pergunta "Quer trocar?" nesta luta? Torneio tem a escalação própria; precisa de alguém para trocar. */
export function asksLead(enc: Encounter | undefined, party: OwnedMon[]): boolean {
  if (!enc || enc.tournament || enc.versus) return false;
  const alive = party.filter(m => m.hp > 0).length;
  return alive >= (enc.double ? 3 : 2);
}
