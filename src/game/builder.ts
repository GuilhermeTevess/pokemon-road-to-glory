// Dream Team: o jogador monta o próprio time (Pokémon, habilidade, nature, EVs, golpes e item),
// guarda até 5 times no aparelho e batalha contra o computador ou contra os times dos amigos.
// Todo mundo luta no nível 50 com IVs perfeitos (como nos campeonatos de verdade).
import type {Species} from '@pkmn/sim';
import {allLearnable, dex, isLegendary, species, typeMultiplier} from '../data/dex';
import {ITEMS, getItem, megaStonesFor} from '../data/items';
import type {ItemDef} from '../data/items';
import {cloudRaw} from './cloud';
import {calcStats, zeroStats} from './mon';
import {uid} from './rng';
import {STAT_IDS} from './types';
import type {OwnedMon, StatId, StatTable} from './types';

export const BUILT_LEVEL = 50;
export const MAX_TEAMS = 5;
export const TEAM_SIZE = 6;
export const EV_MAX = 252;
export const EV_TOTAL = 510;

/** Um Pokémon montado (o "set"). */
export interface BuiltMon {
  species: string;
  ability: string;
  nature: string;
  evs: StatTable;
  /** Ids dos golpes (até 4). */
  moves: string[];
  /** Id do item do jogo (data/items.ts), se tiver. */
  item?: string;
  shiny?: boolean;
}

export interface BuiltTeam {
  id: string;
  name: string;
  mons: BuiltMon[];
  updated: number;
}

// ------------------------------------------------------------------ Guardar no aparelho

export const teamsKey = (trainerId: string) => `rtg-teams-${trainerId}`;

export function loadTeams(trainerId: string | null | undefined): BuiltTeam[] {
  if (!trainerId) return [];
  try {
    const raw = localStorage.getItem(teamsKey(trainerId));
    const list = raw ? (JSON.parse(raw) as BuiltTeam[]) : [];
    return Array.isArray(list) ? list.slice(0, MAX_TEAMS) : [];
  } catch {
    return [];
  }
}

export function saveTeams(trainerId: string, teams: BuiltTeam[]): void {
  try {
    localStorage.setItem(teamsKey(trainerId), JSON.stringify(teams.slice(0, MAX_TEAMS)));
  } catch {
    /* sem storage */
  }
}

// ------------------------------------------------------------------ Regras

/** Itens que dá para segurar no Dream Team (os do Showdown) + a Mega Pedra certa da espécie. */
export function itemsFor(name: string): ItemDef[] {
  const base = ITEMS.filter(i => i.kind === 'held' && i.showdown && !i.megaFor);
  return [...megaStonesFor(name), ...base];
}

export function evTotal(evs: StatTable): number {
  return STAT_IDS.reduce((a, s) => a + evs[s], 0);
}

/** Problemas do time (vazio = pode jogar). */
export function teamProblems(team: BuiltTeam): string[] {
  const out: string[] = [];
  if (!team.mons.length) out.push('O time está vazio.');
  const seen = new Set<string>();
  for (const m of team.mons) {
    const name = species(m.species).name;
    if (seen.has(name)) out.push(`${name} aparece duas vezes (só um de cada espécie).`);
    seen.add(name);
    if (!m.moves.length) out.push(`${name} está sem golpes.`);
    if (evTotal(m.evs) > EV_TOTAL) out.push(`${name} passou de ${EV_TOTAL} EVs.`);
  }
  const megas = team.mons.filter(m => m.item && getItem(m.item).megaFor);
  if (megas.length > 1) out.push('Só um Pokémon por time pode levar Mega Pedra.');
  return out;
}

/** Vira um Pokémon de batalha: nível 50, IVs 31. */
export function toOwned(m: BuiltMon): OwnedMon {
  const s = species(m.species);
  const gender = s.gender ? (s.gender as 'M' | 'F' | 'N') : Math.random() < s.genderRatio.M ? 'M' : 'F';
  const mon: OwnedMon = {
    uid: uid(),
    species: s.name,
    level: BUILT_LEVEL,
    exp: BUILT_LEVEL ** 3,
    moves: m.moves.length ? m.moves : ['tackle'],
    ability: m.ability,
    nature: m.nature,
    gender,
    shiny: !!m.shiny,
    ivs: zeroStats(31),
    evs: {...m.evs},
    item: m.item,
    hp: 0,
  };
  mon.hp = calcStats(mon).hp;
  return mon;
}

export function teamToOwned(team: BuiltTeam): OwnedMon[] {
  return team.mons.map(toOwned);
}

// ------------------------------------------------------------------ Sugestões (para quem está começando)

/** Golpes que dão dano mas atrapalham quem não conhece (se explodem, só funcionam em casos raros...). */
const AWKWARD = new Set([
  'explosion', 'selfdestruct', 'mistyexplosion', 'finalgambit', 'memento', 'dreameater', 'focuspunch', 'lastresort', 'belch',
  'steelbeam', 'mindblown', 'chloroblast', 'shelltrap', 'skydrop', 'synchronoise', 'spitup', 'futuresight', 'doomdesire',
  'burnup', 'doubleshock', 'hyperspacefury', 'skyattack', 'razorwind', 'solarbeam', 'solarblade', 'meteorbeam', 'electroshot',
  'fakeout', 'firstimpression', 'uproar', 'snore', 'echoedvoice', 'round', 'rollout', 'iceball', 'furycutter', 'gigaimpact',
  'hyperbeam', 'blastburn', 'frenzyplant', 'hydrocannon', 'rockwrecker', 'roaroftime', 'eternabeam', 'prismaticlaser', 'perishsong',
  'headsmash', 'lightofruin', 'healingwish', 'lunardance', 'struggle', 'naturalgift', 'fling', 'present', 'magnitude', 'beatup',
  'storedpower', 'powertrip', 'trumpcard', 'wringout', 'crushgrip', 'spitup', 'hiddenpower', 'judgment', 'multiattack',
]);

/** Golpes de status que ajudam muito e são fáceis de entender. */
const GOOD_STATUS: {id: string; for: 'atk' | 'spa' | 'any'}[] = [
  {id: 'swordsdance', for: 'atk'},
  {id: 'dragondance', for: 'atk'},
  {id: 'bulkup', for: 'atk'},
  {id: 'nastyplot', for: 'spa'},
  {id: 'calmmind', for: 'spa'},
  {id: 'quiverdance', for: 'spa'},
  {id: 'recover', for: 'any'},
  {id: 'roost', for: 'any'},
  {id: 'slackoff', for: 'any'},
  {id: 'synthesis', for: 'any'},
];

function moveScore(id: string, s: Species, physical: boolean): number {
  const mv = dex.moves.get(id);
  if (mv.category === 'Status' || !mv.basePower || AWKWARD.has(mv.id)) return 0;
  if (mv.flags.charge || mv.flags.recharge) return 0;
  const wantCat = physical ? 'Physical' : 'Special';
  let bp = mv.basePower;
  if (mv.multihit) bp *= Array.isArray(mv.multihit) ? 3 : mv.multihit;
  if (mv.recoil) bp *= 0.9;
  if (mv.self?.boosts && Object.values(mv.self.boosts).some(v => (v ?? 0) < 0)) bp *= 0.85;
  const acc = mv.accuracy === true ? 1 : mv.accuracy / 100;
  const stab = s.types.includes(mv.type) ? 1.5 : 1;
  const cat = mv.category === wantCat ? 1 : 0.45;
  const prio = mv.priority > 0 ? 0.9 : 1;
  return bp * acc * stab * cat * prio;
}

/** Ataca com o Ataque (físico) ou com o At. Esp. (especial)? Huge Power/Pure Power dobram o Ataque. */
function isPhysical(s: Species): boolean {
  const huge = Object.values(s.abilities).some(a => a === 'Huge Power' || a === 'Pure Power');
  return s.baseStats.atk * (huge ? 2 : 1) >= s.baseStats.spa;
}

/** Golpes de dano que ele aprende, do melhor para o pior (para o time sugerido e para a lista). */
export function bestMoves(name: string): string[] {
  const s = species(name);
  const physical = isPhysical(s);
  return learnable(s.name)
    .map(id => ({id, score: moveScore(id, s, physical)}))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.id);
}

/**
 * Set automático: ataca com o atributo mais forte, golpes do próprio tipo + cobertura
 * (tipos diferentes), nature e EVs de atacante, e um item seguro.
 */
export function suggestedSet(name: string): BuiltMon {
  const s = species(name);
  const b = s.baseStats;
  const physical = isPhysical(s);
  const fast = b.spe >= 75;
  const bulky = b.hp + b.def + b.spd > (physical ? b.atk : b.spa) * 2.6 + b.spe;

  const abilities = Object.values(s.abilities).filter(Boolean) as string[];
  const ability = [...abilities].sort((x, y) => (dex.abilities.get(y).rating ?? 0) - (dex.abilities.get(x).rating ?? 0))[0] ?? abilities[0];

  const nature = physical ? (fast ? 'Jolly' : 'Adamant') : fast ? 'Timid' : 'Modest';
  const atk: StatId = physical ? 'atk' : 'spa';
  const def: StatId = b.def >= b.spd ? 'spd' : 'def';
  // Rápido: ataque + velocidade. Lento: ataque + HP. Muralha: HP + a defesa mais fraca.
  const evs = presetEvs(fast && !bulky ? {[atk]: 252, spe: 252, hp: 4} : bulky ? {hp: 252, [def]: 252, [atk]: 4} : {[atk]: 252, hp: 252, [def]: 4});

  // Golpes: o melhor de cada tipo, priorizando um do próprio tipo e depois cobertura.
  const ranked = bestMoves(s.name);
  const moves: string[] = [];
  const used = new Set<string>();
  for (const t of s.types) {
    const best = ranked.find(id => dex.moves.get(id).type === t);
    if (best && moves.length < 4) {
      moves.push(best);
      used.add(t);
    }
  }
  // Cobertura: o golpe que mais acerta com 2x os tipos que os golpes atuais não acertam bem.
  const coverageScore = (type: string) => COVER_TYPES.filter(def => typeMultiplier(type, def) > 1 && !moves.some(m => typeMultiplier(dex.moves.get(m).type, def) > 1)).length;
  const setup = GOOD_STATUS.find(g => (g.for === 'any' ? bulky : g.for === (physical ? 'atk' : 'spa')) && learnable(s.name).includes(g.id));
  const attacks = setup ? 3 : 4;
  while (moves.length < attacks) {
    const next = ranked
      .filter(id => !moves.includes(id) && !used.has(dex.moves.get(id).type))
      .slice(0, 25)
      .sort((x, y) => coverageScore(dex.moves.get(y).type) * 40 + moveScore(y, s, physical) - (coverageScore(dex.moves.get(x).type) * 40 + moveScore(x, s, physical)))[0];
    if (!next) break;
    moves.push(next);
    used.add(dex.moves.get(next).type);
  }
  if (setup) moves.push(setup.id);
  if (!moves.length) moves.push(...learnable(s.name).slice(0, 4));

  const item = s.nfe ? 'eviolite' : bulky ? 'leftovers' : fast ? 'lifeorb' : 'sitrusberry';
  return {species: s.name, ability, nature, evs, moves: moves.slice(0, 4), item};
}

/** Tipos comuns dos adversários, para a cobertura do set sugerido. */
const COVER_TYPES: string[][] = [
  ['Water'], ['Fire'], ['Grass'], ['Electric'], ['Ground'], ['Steel'], ['Fairy'], ['Dragon'], ['Dark'], ['Ghost'], ['Flying'], ['Rock'], ['Psychic'], ['Fighting'], ['Ice'], ['Poison'], ['Bug'], ['Normal'],
];

// ------------------------------------------------------------------ Times prontos

/**
 * Times prontos, montados à mão para funcionar juntos. Servem de ponto de partida para quem
 * não quer montar do zero e são os times que o computador usa.
 * Formato de cada Pokémon: "Espécie|Habilidade|Nature|EVs|golpes|item".
 */
export const PREMADE: {name: string; about: string; sets: string[]}[] = [
  {
    name: 'Clássico de Kanto',
    about: 'Os famosos da primeira geração. Equilibrado e fácil de usar.',
    sets: [
      'Charizard|Blaze|Timid|spa252 spe252 hp4|flamethrower,airslash,dragonpulse,roost|lifeorb',
      'Blastoise|Torrent|Modest|hp252 spa252 spd4|surf,icebeam,darkpulse,flashcannon|sitrusberry',
      'Venusaur|Overgrow|Modest|hp252 spa252 def4|gigadrain,sludgebomb,earthpower,sleeppowder|blacksludge',
      'Pikachu|Static|Timid|spa252 spe252 hp4|thunderbolt,grassknot,surf,nastyplot|focussash',
      'Snorlax|Thick Fat|Adamant|hp252 atk252 spd4|bodyslam,crunch,earthquake,curse|leftovers',
      'Gengar|Cursed Body|Timid|spa252 spe252 hp4|shadowball,sludgebomb,focusblast,thunderbolt|lifeorb',
    ],
  },
  {
    name: 'Chuva',
    about: 'Pelipper faz chover quando entra: golpes de Água ficam mais fortes e quem tem Swift Swim fica super rápido.',
    sets: [
      'Pelipper|Drizzle|Modest|hp252 spa252 spd4|hurricane,surf,uturn,roost|leftovers',
      'Barraskewda|Swift Swim|Adamant|atk252 spe252 hp4|liquidation,closecombat,psychicfangs,aquajet|lifeorb',
      'Kingdra|Swift Swim|Modest|spa252 spe252 hp4|hydropump,dracometeor,icebeam,hurricane|wiseglasses',
      'Ludicolo|Swift Swim|Modest|spa252 spe252 hp4|hydropump,gigadrain,icebeam,raindance|lifeorb',
      'Ferrothorn|Iron Barbs|Relaxed|hp252 def252 spd4|gyroball,powerwhip,leechseed,protect|leftovers',
      'Gyarados|Intimidate|Adamant|hp252 atk252 spe4|waterfall,earthquake,icefang,dragondance|leftovers',
    ],
  },
  {
    name: 'Sol',
    about: 'Torkoal deixa o sol forte: Fogo bate mais, Solar Beam sai na hora e quem tem Chlorophyll fica rápido.',
    sets: [
      'Torkoal|Drought|Quiet|hp252 spa252 def4|eruption,solarbeam,earthpower,stealthrock|charcoal',
      'Venusaur|Chlorophyll|Modest|spa252 spe252 hp4|solarbeam,weatherball,sludgebomb,growth|lifeorb',
      'Charizard|Solar Power|Timid|spa252 spe252 hp4|flamethrower,airslash,solarbeam,focusblast|charcoal',
      'Arcanine|Intimidate|Adamant|hp252 atk252 def4|flareblitz,extremespeed,wildcharge,morningsun|sitrusberry',
      'Lilligant|Chlorophyll|Timid|spa252 spe252 hp4|quiverdance,energyball,sleeppowder,alluringvoice|lifeorb',
      'Excadrill|Mold Breaker|Jolly|atk252 spe252 hp4|earthquake,ironhead,rockslide,swordsdance|focussash',
    ],
  },
  {
    name: 'Pancada',
    about: 'Atacantes fortes que aumentam o próprio ataque e varrem o time inimigo.',
    sets: [
      'Garchomp|Rough Skin|Jolly|atk252 spe252 hp4|earthquake,dragonclaw,stoneedge,swordsdance|lifeorb',
      'Dragonite|Multiscale|Adamant|hp252 atk252 spe4|dragondance,outrage,extremespeed,earthquake|lumberry',
      'Metagross|Clear Body|Adamant|hp252 atk252 def4|meteormash,zenheadbutt,earthquake,bulletpunch|assaultvest',
      'Lucario|Justified|Adamant|atk252 spe252 hp4|closecombat,meteormash,extremespeed,swordsdance|lifeorb',
      'Weavile|Pressure|Jolly|atk252 spe252 hp4|knockoff,tripleaxel,iceshard,lowkick|focussash',
      'Scizor|Technician|Adamant|hp252 atk252 spd4|bulletpunch,uturn,knockoff,swordsdance|leftovers',
    ],
  },
  {
    name: 'Fofura perigosa',
    about: 'Pokémon fofos (e alguns nem tanto) com muita força de Fada.',
    sets: [
      'Sylveon|Pixilate|Modest|hp252 spa252 spd4|hypervoice,shadowball,calmmind,protect|leftovers',
      'Azumarill|Huge Power|Adamant|hp252 atk252 def4|liquidation,playrough,aquajet,knockoff|sitrusberry',
      'Togekiss|Serene Grace|Timid|hp4 spa252 spe252|airslash,dazzlinggleam,flamethrower,nastyplot|leftovers',
      'Mimikyu|Disguise|Jolly|atk252 spe252 hp4|playrough,shadowclaw,shadowsneak,swordsdance|lifeorb',
      'Clefable|Magic Guard|Modest|hp252 spa252 def4|moonblast,flamethrower,calmmind,moonlight|lifeorb',
      'Tinkaton|Mold Breaker|Jolly|atk252 spe252 hp4|playrough,gigatonhammer,knockoff,swordsdance|leftovers',
    ],
  },
  {
    name: 'Areia',
    about: 'Tyranitar traz a tempestade de areia: Excadrill fica super rápido e os de Pedra aguentam mais.',
    sets: [
      'Tyranitar|Sand Stream|Adamant|hp252 atk252 spd4|stoneedge,crunch,earthquake,dragondance|leftovers',
      'Excadrill|Sand Rush|Adamant|atk252 spe252 hp4|earthquake,ironhead,rockslide,swordsdance|lifeorb',
      'Skarmory|Sturdy|Impish|hp252 def252 spd4|bravebird,bodypress,irondefense,roost|leftovers',
      'Gastrodon|Storm Drain|Bold|hp252 def252 spa4|scald,earthpower,icebeam,recover|leftovers',
      'Hydreigon|Levitate|Timid|spa252 spe252 hp4|darkpulse,dracometeor,flamethrower,earthpower|lifeorb',
      'Volcarona|Flame Body|Timid|hp4 spa252 spe252|quiverdance,flamethrower,bugbuzz,gigadrain|leftovers',
    ],
  },
  {
    name: 'Paldea',
    about: 'Os mais fortes da nona geração, cada um com uma função.',
    sets: [
      'Kingambit|Supreme Overlord|Adamant|hp252 atk252 def4|kowtowcleave,suckerpunch,ironhead,swordsdance|leftovers',
      'Gholdengo|Good as Gold|Modest|hp252 spa252 spe4|makeitrain,shadowball,nastyplot,focusblast|lifeorb',
      'Skeledirge|Unaware|Modest|hp252 spa252 spd4|torchsong,shadowball,slackoff,earthpower|leftovers',
      'Garganacl|Purifying Salt|Careful|hp252 spd252 def4|saltcure,recover,bodypress,irondefense|leftovers',
      'Meowscarada|Overgrow|Jolly|atk252 spe252 hp4|flowertrick,knockoff,uturn,playrough|focussash',
      'Baxcalibur|Thermal Exchange|Adamant|hp252 atk252 def4|glaiverush,iciclecrash,iceshard,earthquake|lumberry',
    ],
  },
  {
    name: 'Mega Charizard',
    about: 'Charizard com a Mega Pedra Y faz sol sozinho e o time aproveita.',
    sets: [
      'Charizard|Blaze|Timid|spa252 spe252 hp4|flamethrower,airslash,solarbeam,focusblast|charizarditey',
      'Venusaur|Chlorophyll|Modest|spa252 spe252 hp4|solarbeam,sludgebomb,earthpower,sleeppowder|lifeorb',
      'Garchomp|Rough Skin|Jolly|atk252 spe252 hp4|earthquake,dragonclaw,stoneedge,swordsdance|lifeorb',
      'Gyarados|Intimidate|Adamant|hp252 atk252 spe4|waterfall,earthquake,icefang,dragondance|leftovers',
      'Scizor|Technician|Adamant|hp252 atk252 spd4|bulletpunch,uturn,knockoff,swordsdance|leftovers',
      'Sylveon|Pixilate|Modest|hp252 spa252 spd4|hypervoice,shadowball,calmmind,protect|leftovers',
    ],
  },
];

/** "Espécie|Habilidade|Nature|EVs|golpes|item" → set. */
export function parseSet(line: string): BuiltMon {
  const [name, ability, nature, evs, moves, item] = line.split('|');
  const table = zeroStats();
  for (const part of evs.split(' ')) {
    const m = /^([a-z]+)(\d+)$/.exec(part);
    if (m) table[m[1] as StatId] = Number(m[2]);
  }
  return {species: species(name).name, ability, nature, evs: table, moves: moves.split(','), item: item || undefined};
}

export function premadeTeam(i: number): BuiltTeam {
  const p = PREMADE[i];
  return {id: uid(), name: p.name, mons: p.sets.map(parseSet), updated: Date.now()};
}

/** Todos os golpes que a espécie pode aprender (incluindo os das pré-evoluções e da forma base). */
export function learnable(name: string): string[] {
  const out = new Set<string>();
  let s: Species | undefined = species(name);
  for (let i = 0; i < 4 && s?.exists; i++) {
    for (const m of allLearnable(s)) out.add(m);
    if (s.changesFrom || s.baseSpecies !== s.name) for (const m of allLearnable(species(s.changesFrom ?? s.baseSpecies))) out.add(m);
    s = s.prevo ? species(s.prevo) : undefined;
  }
  return [...out];
}

// ------------------------------------------------------------------ Times do computador

/** Time do computador: um dos times prontos (montados à mão, com estratégia). */
export function botTeam(): BuiltTeam {
  return premadeTeam(Math.floor(Math.random() * PREMADE.length));
}

export const isLegend = (name: string) => isLegendary(species(name));

/** Atributos finais no nível 50 (para mostrar no editor). */
export function builtStats(m: BuiltMon): StatTable {
  return calcStats(toOwned(m));
}

export const STAT_SHORT: Record<StatId, string> = {hp: 'HP', atk: 'Atq', def: 'Def', spa: 'AtE', spd: 'DfE', spe: 'Vel'};

/** Presets de EVs explicados para iniciantes. */
export const EV_PRESETS: {name: string; about: string; evs: Partial<StatTable>}[] = [
  {name: 'Atacante físico rápido', about: 'Ataque e Velocidade no máximo.', evs: {atk: 252, spe: 252, hp: 4}},
  {name: 'Atacante especial rápido', about: 'At. Esp. e Velocidade no máximo.', evs: {spa: 252, spe: 252, hp: 4}},
  {name: 'Atacante físico forte', about: 'Ataque e HP: bate forte e aguenta mais.', evs: {atk: 252, hp: 252, def: 4}},
  {name: 'Atacante especial forte', about: 'At. Esp. e HP: bate forte e aguenta mais.', evs: {spa: 252, hp: 252, spd: 4}},
  {name: 'Muralha física', about: 'HP e Defesa: aguenta golpes físicos.', evs: {hp: 252, def: 252, spd: 4}},
  {name: 'Muralha especial', about: 'HP e Def. Esp.: aguenta golpes especiais.', evs: {hp: 252, spd: 252, def: 4}},
];

export function presetEvs(p: Partial<StatTable>): StatTable {
  return {...zeroStats(), ...p};
}

// ------------------------------------------------------------------ Times dos amigos (na nuvem)

/** Time publicado: os amigos podem enfrentá-lo contra o computador. */
export interface SharedTeam {
  owner: string;
  ownerId: string;
  avatar: string;
  team: BuiltTeam;
}

const SHARED = 'careers/TEAMS-ALL/teams';

export async function publishTeam(ownerId: string, owner: string, avatar: string, team: BuiltTeam): Promise<void> {
  if (!team.mons.length || teamProblems(team).length) return;
  await cloudRaw.put(`${SHARED}/${encodeURIComponent(`${ownerId}-${team.id}`)}`, {owner, ownerId, avatar, team} satisfies SharedTeam);
}

export async function unpublishTeam(ownerId: string, teamId: string): Promise<void> {
  await cloudRaw.del(`${SHARED}/${encodeURIComponent(`${ownerId}-${teamId}`)}`);
}

/** Times que os outros jogadores montaram (sem os seus). */
export async function friendTeams(myId: string): Promise<SharedTeam[]> {
  const all = await cloudRaw.list<SharedTeam>(SHARED);
  return all.filter(t => t.ownerId !== myId && t.team?.mons?.length).sort((a, b) => b.team.updated - a.team.updated);
}
