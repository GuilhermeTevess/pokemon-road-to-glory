// Eventos entre as rondas (Parte C): em vez de ir direto para a próxima batalha,
// às vezes aparece uma escolha. Eventos não gastam ronda.
import {getItem, ITEMS} from '../data/items';
import {generateEncounter, isBossWave, isMilestoneWave, SEASON_LENGTH} from './encounters';
import {waveStep} from './career';
import {allLearnable, dex, species as speciesOf} from '../data/dex';
import {getBiome} from '../data/biomes';
import {createMon} from './mon';
import {movePrice} from './meta';
import type {OwnedMon} from './types';
import {chance, pick} from './rng';
import {travelerEvent} from './travelers';
import type {Encounter, RunEvent, RunState} from './types';

export const EVENT_CHANCE = 0.1;
export const RIVAL_NAMES = ['Léo', 'Bia', 'Caio', 'Duda', 'Rafa', 'Nina', 'Theo', 'Malu'];
export const BERRIES = ['sitrusberry', 'lumberry', 'oranberry'];

/** Um selvagem "tranquilo" (sem super raros nem lendários) para a casa e o machucado. */
function calmMon(run: RunState): Encounter['mon'] {
  for (let i = 0; i < 20; i++) {
    const enc = generateEncounter(Math.max(1, run.wave), run.biome, false, 0, run.region);
    if (enc.rarity === 'common' || enc.rarity === 'uncommon' || enc.rarity === 'rare') return enc.mon;
  }
  return generateEncounter(1, run.biome, false, 0, run.region).mon;
}

/** Eventos do lugar: o bioma muda a cena (casa assombrada no pântano, naufrágio no mar...). */
export interface PlaceTheme {
  id: string;
  title: string;
  /** Tipos do bioma que puxam esta cena. */
  biomeTypes: string[];
  /** Tipos do Pokémon que aparece (se tiver). */
  monTypes?: string[];
  /** Se o bioma não tiver ninguém do tipo, aparece este. */
  fallback?: string;
  reward: 'mon' | 'heal' | 'exp' | 'item';
  yes: string;
  no: string;
}

export const PLACE_THEMES: PlaceTheme[] = [
  {id: 'haunted', fallback: 'Gastly', title: 'Casa assombrada', biomeTypes: ['Ghost'], monTypes: ['Ghost'], reward: 'mon', yes: 'Entrar e investigar', no: 'Dar meia-volta'},
  {id: 'cavein', fallback: 'Geodude', title: 'Desabamento', biomeTypes: ['Rock', 'Ground'], monTypes: ['Rock', 'Ground', 'Steel'], reward: 'mon', yes: 'Tirar as pedras', no: 'Avisar os guardas e seguir'},
  {id: 'wreck', title: 'Naufrágio', biomeTypes: ['Water'], reward: 'item', yes: 'Mergulhar no navio', no: 'Melhor não'},
  {id: 'hotspring', title: 'Fonte termal', biomeTypes: ['Fire'], reward: 'heal', yes: 'Descansar na fonte', no: 'Seguir viagem'},
  {id: 'nest', fallback: 'Caterpie', title: 'Ninho na árvore', biomeTypes: ['Grass', 'Bug', 'Fairy'], monTypes: ['Grass', 'Bug', 'Fairy', 'Flying'], reward: 'mon', yes: 'Devolver o filhote ao ninho', no: 'Deixar quieto'},
  {id: 'blackout', fallback: 'Magnemite', title: 'Apagão', biomeTypes: ['Electric', 'Steel'], monTypes: ['Electric', 'Steel'], reward: 'mon', yes: 'Ajudar a religar a energia', no: 'Seguir no escuro'},
  {id: 'blizzard', fallback: 'Snorunt', title: 'Nevasca', biomeTypes: ['Ice'], monTypes: ['Ice'], reward: 'mon', yes: 'Dividir o abrigo', no: 'Enfrentar a neve sozinho'},
  {id: 'dojo', title: 'Dojo de beira de estrada', biomeTypes: ['Fighting'], reward: 'exp', yes: 'Treinar com o mestre', no: 'Agradecer e seguir'},
  {id: 'cliff', fallback: 'Pidgey', title: 'Ninho no penhasco', biomeTypes: ['Flying', 'Dragon', 'Psychic'], monTypes: ['Flying', 'Dragon', 'Psychic'], reward: 'mon', yes: 'Escalar e ajudar', no: 'É alto demais'},
];

export const getPlace = (id: string) => PLACE_THEMES.find(t => t.id === id) ?? PLACE_THEMES[0];

/** Itens que dá para achar num naufrágio. */
const WRECK_ITEMS = ['rarecandy', 'ultraball', 'tm'];

function placeTheme(run: RunState): PlaceTheme | null {
  const types = getBiome(run.biome).types;
  const fits = PLACE_THEMES.filter(t => t.biomeTypes.some(x => types.includes(x)));
  return fits.length ? pick(fits) : null;
}

/** Um Pokémon do tipo da cena (do bioma, sem super raros nem lendários). */
function themedMon(run: RunState, t: PlaceTheme): Encounter['mon'] {
  for (let i = 0; i < 60; i++) {
    const mon = calmMon(run);
    if (speciesOf(mon.species).types.some(x => t.monTypes?.includes(x))) return mon;
  }
  const mon = calmMon(run);
  return t.fallback ? createMon(t.fallback, {level: mon.level}) : mon;
}

export function shouldRollEvent(run: RunState): boolean {
  const next = run.wave + waveStep(run);
  if (run.wave < 2 || next >= SEASON_LENGTH || isBossWave(next)) return false;
  if (run.lastEventWave === run.wave) return false;
  return chance(EVENT_CHANCE);
}

/** Fama a partir da qual aparecem fãs. */
export const FAN_FAME = 150;
const FAN_AVATARS = ['lass', 'youngster', 'schoolkid', 'twins', 'beauty', 'pokefan', 'picnicker', 'camper'];

/** Manchetes do jornal: o que os rivais (e os amigos, na carreira) andaram fazendo. */
export function headlines(run: RunState, extra: {who: string; text: string; weight: number; wave: number}[] = []): {who: string; text: string}[] {
  const recent = [...(run.world?.news ?? []), ...extra].filter(n => n.wave > run.wave - 25);
  const sorted = recent.sort((a, b) => b.weight + b.wave / 30 - (a.weight + a.wave / 30));
  const out: {who: string; text: string}[] = [];
  for (const n of sorted) {
    if (out.length >= 3) break;
    if (!out.some(o => o.who === n.who)) out.push({who: n.who, text: n.text});
  }
  // Quem lidera o ranking sempre rende uma nota.
  const top = [...(run.world?.bots ?? [])].sort((a, b) => b.points - a.points)[0];
  if (top && top.points > 0 && out.length < 4) out.push({who: top.name, text: `${top.name} lidera o ranking da temporada com ${top.points} pontos.`});
  return out;
}

export function rollEvent(run: RunState, ctx: {fame?: number; news?: {who: string; text: string; weight: number; wave: number}[]} = {}): RunEvent {
  const tradable = Object.keys(run.bag).filter(id => run.bag[id] > 0 && getItem(id).tier !== 'ultra' && getItem(id).tier !== 'master');
  const kinds: RunEvent['kind'][] = ['house', 'berries', 'hurt', 'rival', 'seer', 'traveler', 'traveler', 'tutor'];
  if (tradable.length) kinds.push('merchant');
  const news = headlines(run, ctx.news);
  if (news.length) kinds.push('news');
  if ((ctx.fame ?? 0) >= FAN_FAME) kinds.push('fan');
  // O lugar puxa a cena (dobrado: é o evento mais comum quando combina com o bioma).
  const theme = placeTheme(run);
  if (theme) kinds.push('place', 'place');
  // Vida do treinador.
  kinds.push('life');
  const kind = pick(kinds);
  switch (kind) {
    case 'house':
      return {kind, mon: calmMon(run)};
    case 'hurt': {
      const mon = calmMon(run);
      mon.hp = 1;
      return {kind, mon};
    }
    case 'berries':
      return {kind, options: [...BERRIES]};
    case 'merchant': {
      const give = pick(tradable);
      const better = ITEMS.filter(i => i.tier === 'ultra' && i.kind !== 'money');
      return {kind, give, get: pick(better).id};
    }
    case 'traveler': {
      const ev = travelerEvent(run);
      if (ev) return ev;
      return {kind: 'seer', upcoming: upcomingEncounters(run, 3)};
    }
    case 'tutor':
      return {kind};
    case 'news':
      return {kind, items: news};
    case 'place': {
      const t = theme!;
      if (t.reward === 'mon') return {kind, theme: t.id, mon: themedMon(run, t)};
      if (t.reward === 'item') return {kind, theme: t.id, item: pick(WRECK_ITEMS.filter(id => ITEMS.some(i => i.id === id)))};
      return {kind, theme: t.id};
    }
    case 'life': {
      const partner = run.party.find(m => m.partner);
      const options: ('mom' | 'center' | 'birthday')[] = ['mom', 'center'];
      if (partner) options.push('birthday');
      return {kind, theme: pick(options), uid: partner?.uid, chat: news[0]?.text};
    }
    case 'fan': {
      // O fã também comenta de quem anda famoso por aí.
      const star = news[0];
      return {kind, avatar: pick(FAN_AVATARS), heard: star?.text};
    }
    case 'rival': {
      // Um rival de verdade da temporada que está na mesma região, quando tem.
      const here = run.world?.bots.filter(b => b.region === run.region) ?? [];
      return {kind, name: here.length ? pick(here).name : pick(RIVAL_NAMES)};
    }
    case 'seer':
    default:
      return {kind: 'seer', upcoming: upcomingEncounters(run, 3)};
  }
}

/** Gera os próximos selvagens antes (a Vidente mostra os tipos deles). */
export function upcomingEncounters(run: RunState, n: number): Encounter[] {
  const out: Encounter[] = [];
  const step = waveStep(run);
  for (let w = run.wave + step; w <= run.wave + n * step && w <= SEASON_LENGTH && !isMilestoneWave(w); w += step) out.push(generateEncounter(w, run.biome, run.incenseWaves > 0, run.perks?.luck, run.region));
  return out;
}

/** Pokémon do rival: um pouco mais forte que o selvagem da ronda. */
export function rivalEncounter(run: RunState, name: string): Encounter {
  const enc = generateEncounter(run.wave + waveStep(run), run.biome, false, 0, run.region);
  enc.mon.level += 3;
  return {...enc, boss: false, trainer: name};
}

/** Cura mais barata da mochila (para o Pokémon machucado). */
export function cheapestHeal(run: RunState): string | null {
  const heals = Object.keys(run.bag)
    .filter(id => run.bag[id] > 0 && getItem(id).kind === 'heal')
    .sort((a, b) => getItem(a).price - getItem(b).price);
  return heals[0] ?? null;
}

/** Professor de golpes: tudo o que o Pokémon aprende (nível, MT, tutor, ovo), do mais forte ao mais fraco. */
export function tutorMoves(mon: OwnedMon): string[] {
  return [...allLearnable(speciesOf(mon.species))]
    .filter(m => !mon.moves.some(k => dex.moves.get(k).id === dex.moves.get(m).id))
    .sort((a, b) => dex.moves.get(b).basePower - dex.moves.get(a).basePower || a.localeCompare(b));
}

/** Preço do professor: golpes fortes e de preparar custam bem mais, e tudo encarece com as rondas. */
export function tutorPrice(run: RunState, move: string): number {
  return Math.round(((movePrice(move) / 5) * (300 + run.wave * 20)) / 50) * 50;
}
