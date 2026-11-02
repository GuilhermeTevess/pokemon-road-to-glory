// Sets "de Showdown" para o Quickplay: em vez dos 4 últimos golpes de nível e natureza
// sorteada, cada Pokémon vem com golpes fortes do próprio tipo, cobertura, às vezes um
// golpe de status útil, a natureza certa, a melhor habilidade e EVs no que ele faz de melhor.
import type {Move, Species} from '@pkmn/sim';
import {allLearnable, dex, typeMultiplier, ALL_TYPES} from '../data/dex';
import type {OwnedMon, StatTable} from './types';

/** Golpes de preparação: vale trocar um ataque por eles. */
const SETUP_PHYS = ['swordsdance', 'dragondance', 'bulkup', 'shiftgear', 'victorydance'];
const SETUP_SPEC = ['nastyplot', 'quiverdance', 'calmmind', 'tailglow', 'takeheart', 'torchsong'];
const RECOVERY = ['recover', 'roost', 'slackoff', 'softboiled', 'moonlight', 'synthesis', 'morningsun', 'milkdrink', 'shoreup', 'strengthsap', 'wish'];

/** Golpes com efeito ruim demais para um set simples. */
function badMove(m: Move): boolean {
  return (
    !!m.flags.charge || !!m.flags.recharge || !!m.selfdestruct || !!m.ohko || m.id === 'focuspunch' || m.id === 'dreameater' ||
    m.id === 'belch' || m.id === 'steelbeam' || m.id === 'mindblown' || m.id === 'lastresort' || m.id === 'synchronoise' ||
    m.id === 'futuresight' || m.id === 'doomdesire' || m.id === 'skyattack' || m.id === 'hyperbeam' || m.id === 'gigaimpact' ||
    m.id === 'explosion' || m.id === 'selfdestruct' || m.id === 'shellsidearm' || m.id === 'fling' || m.id === 'naturalgift' ||
    // Falham sem campo ou sem item segurado (no Rush ninguém segura item).
    m.id === 'steelroller' || m.id === 'poltergeist' || m.id === 'snore' || m.id === 'spitup'
  );
}

/** Força "de verdade" de um golpe para quem usa (precisão, STAB, vários acertos). */
function power(m: Move, types: readonly string[]): number {
  let bp = m.basePower;
  if (Array.isArray(m.multihit)) bp *= m.multihit[1] >= 5 ? 3 : m.multihit[0];
  else if (typeof m.multihit === 'number') bp *= m.multihit;
  const acc = m.accuracy === true ? 1 : m.accuracy / 100;
  const stab = types.includes(m.type) ? 1.5 : 1;
  // Golpes que baixam o próprio ataque (Draco Meteor, Overheat) valem um pouco menos.
  const drop = m.self?.boosts && Object.values(m.self.boosts).some(v => (v ?? 0) <= -2) ? 0.85 : 1;
  return bp * acc * stab * drop;
}

/** Tipos que pelo menos um dos golpes acerta com 2x (contra cada tipo puro). */
function coverage(moves: Move[]): Set<string> {
  const hit = new Set<string>();
  for (const t of ALL_TYPES) if (moves.some(m => typeMultiplier(m.type as never, [t]) > 1)) hit.add(t);
  return hit;
}

export interface RushSet {
  moves: string[];
  nature: string;
  ability: string;
  evs: StatTable;
}

/** Monta o set de um Pokémon. Determinístico: o mesmo Pokémon sempre vem igual. */
export function buildSet(s: Species): RushSet {
  const st = s.baseStats;
  const physical = st.atk >= st.spa;
  const cat = physical ? 'Physical' : 'Special';
  const learn = [...allLearnable(s)].map(id => dex.moves.get(id));
  const attacks = learn
    .filter(m => m.category === cat && m.basePower >= 50 && !badMove(m))
    .sort((a, b) => power(b, s.types) - power(a, s.types));

  const chosen: Move[] = [];
  // 1) O golpe mais forte de cada tipo do Pokémon.
  for (const t of s.types) {
    const best = attacks.find(m => m.type === t);
    if (best) chosen.push(best);
  }
  // 2) Golpe de status útil: preparação do lado certo, ou cura para quem aguenta pancada.
  const learnIds = new Set<string>(learn.map(m => m.id));
  const setup = (physical ? SETUP_PHYS : SETUP_SPEC).find(id => learnIds.has(id));
  const bulky = st.hp + st.def + st.spd > (st.atk + st.spa + st.spe) * 1.1;
  const heal = bulky ? RECOVERY.find(id => learnIds.has(id)) : undefined;
  const status = setup ?? heal;
  const attackSlots = status ? 3 : 4;
  // 3) Cobertura: golpes de outros tipos que acertam com 2x tipos que ainda não acertamos.
  while (chosen.length < attackSlots) {
    const have = coverage(chosen);
    const used = new Set(chosen.map(m => m.type));
    let best: Move | undefined;
    let bestScore = 0;
    for (const m of attacks) {
      if (used.has(m.type) || chosen.includes(m)) continue;
      const gain = [...coverage([m])].filter(t => !have.has(t)).length;
      const score = power(m, s.types) * (1 + 0.25 * gain);
      if (score > bestScore) {
        best = m;
        bestScore = score;
      }
    }
    if (!best) best = attacks.find(m => !chosen.includes(m));
    if (!best) break;
    chosen.push(best);
  }
  const moves: string[] = chosen.map(m => m.id);
  if (status) moves.push(status);
  // Pokémon com poucos golpes de ataque (Ditto, Wobbuffet...) ficam com o que tiverem.
  if (moves.length < 4) {
    for (const m of learn) {
      if (moves.length >= 4) break;
      if (!moves.includes(m.id) && !badMove(m) && (m.basePower > 0 || m.category === 'Status')) moves.push(m.id);
    }
  }

  const fast = st.spe >= 90;
  const nature = physical ? (fast ? 'Jolly' : 'Adamant') : fast ? 'Timid' : 'Modest';
  // Melhor habilidade pela nota do Showdown (assim ninguém vem com Truant ou Slow Start à toa).
  const abilities = [s.abilities[0], s.abilities[1], s.abilities.H].filter(Boolean) as string[];
  const ability = abilities.sort((a, b) => dex.abilities.get(b).rating - dex.abilities.get(a).rating)[0];
  const evs: StatTable = {hp: 4, atk: 0, def: 0, spa: 0, spd: 0, spe: 252};
  evs[physical ? 'atk' : 'spa'] = 252;
  return {moves: moves.slice(0, 4), nature, ability, evs};
}

const CACHE = new Map<string, RushSet>();

/** Aplica o set no Pokémon (golpes, natureza, habilidade e EVs). */
export function applySet(mon: OwnedMon): OwnedMon {
  const s = dex.species.get(mon.species);
  if (!CACHE.has(s.name)) CACHE.set(s.name, buildSet(s));
  const set = CACHE.get(s.name)!;
  mon.moves = [...set.moves];
  mon.nature = set.nature;
  mon.ability = set.ability;
  mon.evs = {...set.evs};
  return mon;
}
