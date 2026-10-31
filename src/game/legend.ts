// Treinadores lendários: o "Rastro da lenda" de cada região sobe com chefes, eventos e
// viajantes. A cada ronda na região, a chance de a lenda te desafiar é o rastro (até 40%).
import {toID} from '@pkmn/sim';
import {ITEMS} from '../data/items';
import {legendsOf} from '../data/legends';
import type {Legend} from '../data/legends';
import {createMon} from './mon';
import {pick} from './rng';
import type {Encounter, OwnedMon, RunState} from './types';

export const TRAIL_CAP = 40;
/** Quanto o rastro sobe com cada coisa. */
export const TRAIL = {boss: 10, event: 10, traveler: 25};

export function trailOf(run: RunState, region = run.region): number {
  return region ? (run.trail?.[region] ?? 0) : 0;
}

export function addTrail(run: RunState, amount: number, region = run.region): void {
  if (!region || !legendsOf(region).length) return;
  const boost = 1 + 0.5 * (run.perks?.trail ?? 0);
  run.trail = {...run.trail, [region]: Math.min(100, trailOf(run, region) + Math.round(amount * boost))};
}

/** Chance (0 a 1) de a lenda aparecer nesta ronda. */
export function legendChance(run: RunState): number {
  return Math.min(TRAIL_CAP, trailOf(run)) / 100;
}

/** Time da lenda: mesmo tamanho do seu (mínimo 3), nível do seu mais forte +3, IVs no máximo. */
export function legendTeam(legend: Legend, party: OwnedMon[]): OwnedMon[] {
  const size = Math.min(6, Math.max(3, party.length));
  const level = Math.min(100, Math.max(5, ...party.map(m => m.level)) + 3);
  return legend.team.slice(0, size).map(l => {
    const mon = createMon(l.species, {level, ivMin: 31, shinyChance: 0, hiddenAbilityChance: 0});
    mon.moves = [...l.moves];
    const item = l.item ? toID(l.item) : '';
    if (item && ITEMS.some(i => i.id === item)) mon.item = item;
    return mon;
  });
}

/** Quem você é para a lenda (fama e títulos). */
export interface Fame {
  name: string;
  fame: number;
  worlds: number;
  titles: number;
}

/** Local da luta: quanto mais fama, mais chique (e com torcida e narrador). */
export const VENUES = [
  {name: 'Quadra da cidade', desc: 'Uma quadra de batalha simples no centro da cidade. Ninguém te conhece ainda, então a plateia é pequena.'},
  {name: 'Arena da cidade', desc: 'Uma arena de verdade! Algumas pessoas vieram assistir e torcem de leve.'},
  {name: 'Estádio', desc: 'O estádio lotou para ver vocês! Tem até narrador.'},
  {name: 'Grande Estádio', desc: 'Luzes, telão, fogos e a torcida inteira gritando seu nome!'},
];

export function venueTier(fame: number): number {
  return fame >= 1200 ? 3 : fame >= 400 ? 2 : fame >= 100 ? 1 : 0;
}

export function venueName(tier: number, regionName: string): string {
  return tier >= 2 ? `${VENUES[tier].name} de ${regionName}` : VENUES[tier].name;
}

export interface Line {
  who: 'legend' | 'me' | 'scene' | 'narrator';
  text: string;
}

/** Como a lenda te cumprimenta, de acordo com a sua fama. */
function greeting(legend: Legend, me: Fame): string {
  if (me.worlds > 0) return `${me.name}! Com título mundial no currículo! Eu não ia perder a chance de te enfrentar.`;
  if (me.fame >= 1200) return `${me.name}, a estrela do circuito! Faz tempo que espero por esta batalha.`;
  if (me.fame >= 400) return `${me.name}! Seu nome está em todo lugar na Liga. Eu queria muito te conhecer.`;
  if (me.fame >= 100) return `Espera... você é ${me.name}? Já ouvi falar de você por aí!`;
  return `Ei, você aí! Não te conheço, mas vi como você trata seus Pokémon. ${legend.catchphrase}`;
}

/** A lenda vem até você e desafia. */
export function approachLines(legend: Legend, me: Fame): Line[] {
  const quote = legend.intro[1] ?? `"${legend.catchphrase}"`;
  return [
    {who: 'scene', text: legend.intro[0]},
    {who: 'legend', text: greeting(legend, me)},
    {who: 'legend', text: quote.replace(/^"|"$/g, '')},
  ];
}

/** Você encontra a lenda pelo caminho (a conversa só acontece se você for desafiar). */
export function foundLines(legend: Legend): Line[] {
  return [{who: 'scene', text: legend.found}];
}

export function challengeLines(legend: Legend, me: Fame): Line[] {
  const known = me.fame >= 100 || me.titles > 0;
  return [
    {
      who: 'me',
      text: known
        ? `Oi, ${legend.name}! Sou ${me.name}. Bora ver quem é mais forte?`
        : `Com licença... você é ${legend.name}?! Será que eu posso te desafiar?`,
    },
    {who: 'legend', text: known ? `${me.name}? Claro que eu sei quem é! ${legend.catchphrase}` : `Um desafio? Gosto de gente corajosa. ${legend.catchphrase}`},
  ];
}

/** Falas da entrada da luta: com narrador a partir do estádio. */
export function venueIntro(legend: Legend, me: Fame, tier: number, regionName: string): string[] {
  const place = venueName(tier, regionName);
  if (tier >= 2) {
    const out = [
      `🎙️ Boa noite, ${regionName}! Hoje tem lenda no ${place}: ${legend.name}, ${legend.title.charAt(0).toLowerCase() + legend.title.slice(1)}!`,
      `🎙️ E do outro lado, ${me.name}, que veio para fazer história!`,
    ];
    if (tier >= 3) out.push(`🎙️ Escutem essa torcida! Todo mundo quer ver ${me.name} contra ${legend.name}!`);
    return out;
  }
  return [tier === 1 ? `Algumas pessoas se juntam em volta da ${place} para assistir.` : `Vocês vão até a ${place}. Só um ou outro curioso para ver.`];
}

/** O que acontece no fim da luta (fala da lenda e, no estádio, o narrador). */
export function outroLines(legend: Legend, me: Fame, won: boolean, tier: number): Line[] {
  const out: Line[] = [];
  if (tier >= 2) {
    out.push({
      who: 'narrator',
      text: won ? `🎙️ ACABOU! ${me.name} venceu ${legend.name}! O estádio vem abaixo!` : `🎙️ ${legend.name} vence! Mas que batalha, ${me.name} sai sob aplausos!`,
    });
  }
  out.push({who: 'legend', text: won ? legend.win : legend.lose});
  return out;
}

export function legendEncounter(legend: Legend, party: OwnedMon[], me: Fame, regionName: string): Encounter {
  const team = legendTeam(legend, party);
  const venue = venueTier(me.fame);
  return {mon: team[0], team, rarity: 'legendary', boss: true, trainer: legend.name, legend: legend.id, venue, intro: venueIntro(legend, me, venue, regionName)};
}

/** Sorteia a lenda da região para esta ronda (ou null). */
export function rollLegend(run: RunState): Legend | null {
  const options = legendsOf(run.region);
  if (!options.length || Math.random() >= legendChance(run)) return null;
  return pick(options);
}

/** Prêmio por vencer uma lenda. */
export function legendPrize(wave: number): {glory: number; money: number} {
  return {glory: 40, money: 3000 + wave * 100};
}
