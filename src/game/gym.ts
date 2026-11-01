// Ginásios: compre o ingresso na loja e marque a ronda da luta (dentro do tempo na região,
// fora das rondas de torneio). Numa ronda de chefe (10, 20...) o ginásio toma o lugar do chefe,
// e você abre mão da EXP e do Pokémon forte dele. Ginásio não dá EXP nem dinheiro: vale a
// insígnia e os pontos. Cada insígnia vale uma vez por temporada.
import {GYM_BIOME, gymsOf} from '../data/gyms';
import type {Gym} from '../data/gyms';
import {isMilestoneWave, SEASON_LENGTH} from './encounters';
import {waveStep} from './career';
import {discounted} from './glory';
import {createMon} from './mon';
import {LEADER_TALK} from '../data/gymTalk';
import {TYPE_PT, dex, isLegendary, isPlayable, playableEvos, species} from '../data/dex';
import type {Fame, Line} from './legend';
import {moneyReward} from './rewards';
import type {Encounter, RunState} from './types';

export const GYM_PRIZE = {glory: 10, book: 60};

export function ticketPrice(run: RunState): number {
  return discounted(run, (1200 + 3 * moneyReward(run.wave, false)) * (1 - 0.25 * (run.perks?.tickets ?? 0)));
}

/** Insígnias já ganhas na região. */
export function badgesIn(run: RunState, region = run.region): number {
  const ids = new Set(gymsOf(region).map(g => g.id));
  return (run.badges ?? []).filter(id => ids.has(id)).length;
}

/** Rondas livres para marcar um ginásio: dentro da estadia na região, sem torneio nem outro ginásio (chefe pode). */
export function gymWaves(run: RunState): number[] {
  const out: number[] = [];
  const taken = new Set((run.gyms ?? []).map(g => g.wave));
  const step = waveStep(run);
  const last = Math.min(SEASON_LENGTH, run.wave + (run.regionLeft ?? 0));
  for (let w = run.wave + step; w <= last; w += step) if (!isMilestoneWave(w) && !taken.has(w)) out.push(w);
  return out;
}

export function gymStatus(run: RunState, gym: Gym): 'won' | 'booked' | 'open' {
  if (run.badges?.includes(gym.id)) return 'won';
  if (run.gyms?.some(g => g.id === gym.id)) return 'booked';
  return 'open';
}

/** Evolui a espécie do líder conforme o nível (níveis altos não têm Geodude). */
function grownUp(name: string, level: number): string {
  let s = species(name);
  for (let i = 0; i < 3; i++) {
    const next = playableEvos(s)[0];
    if (!next) break;
    const need = next.evoLevel ?? (s.prevo ? 40 : 30);
    if (level < need) break;
    s = next;
  }
  return s.name;
}

/** Pokémon extra do tipo do ginásio para times grandes (sempre os mesmos para o mesmo líder). */
function extraOfType(gym: Gym, n: number): string[] {
  const pool = Object.values(dex.species.all())
    .filter(s => isPlayable(s) && !isLegendary(s) && s.types.includes(gym.type) && !s.evos.length && s.bst >= 440 && s.bst <= 560 && !gym.team.includes(s.name))
    .sort((a, b) => a.num - b.num);
  const seed = [...gym.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({length: n}, (_, i) => pool[(seed * 7 + i * 13) % pool.length]?.name).filter(Boolean) as string[];
}

/**
 * Força do líder. Começa fácil e cresce com: insígnias que você já tem na região,
 * o nível do seu time e o tamanho dele.
 */
export function gymDifficulty(gym: Gym, run: RunState) {
  const n = badgesIn(run, gym.region);
  const levels = run.party.map(m => m.level).sort((a, b) => b - a);
  const top = levels.slice(0, 3);
  const avg = top.length ? top.reduce((a, b) => a + b, 0) / top.length : 5;
  const size = Math.max(2, Math.min(6, 2 + Math.floor(n / 2) + (run.party.length >= 5 ? 1 : 0), run.party.length + 1));
  const level = Math.min(100, Math.max(Math.floor(run.wave * 0.9) + 2, Math.round(avg - 3 + n * 0.75)));
  return {badges: n, size, level, ace: Math.min(100, level + (n >= 5 ? 3 : 2)), ivMin: Math.min(31, 8 + n * 3)};
}

/** Nome do sprite de treinador do Showdown para o líder. */
export function leaderAvatar(gym: Gym): string {
  if (gym.leader === 'Tate e Liza') return 'tate';
  return gym.leader.toLowerCase().replace(/[^a-z]/g, '');
}

/** Conversa antes da luta: personalidade do líder + o quanto você é famoso. */
export function gymLines(gym: Gym, me: Fame, badges: number): Line[] {
  const type = TYPE_PT[gym.type] ?? gym.type;
  const [hi] = LEADER_TALK[gym.leader] ?? ['Vamos batalhar!'];
  const famous =
    me.fame >= 1200 ? `${me.name}?! A estrela da Liga no meu ginásio! A arquibancada lotou só pra te ver.`
    : me.fame >= 400 ? `${me.name}! Que honra receber alguém tão conhecido aqui.`
    : me.fame >= 100 ? `Espera... você é ${me.name}? Já ouvi falar de você!`
    : 'Um desafiante novo! Vamos ver do que você é capaz.';
  const out: Line[] = [
    {who: 'scene', text: gym.region === 'alola' ? `Você chega ao local da prova de ${gym.leader}. É uma prova do tipo ${type}.` : `Você entra no ginásio do tipo ${type}. No fim da arena, ${gym.leader} espera.`},
    {who: 'legend', text: famous},
  ];
  if (badges > 0) out.push({who: 'legend', text: `Já tem ${badges} ${badges === 1 ? 'insígnia' : 'insígnias'} daqui, né? Então não vou pegar leve.`});
  out.push({who: 'legend', text: hi});
  return out;
}

export function leaderWinLine(gym: Gym): string {
  return LEADER_TALK[gym.leader]?.[1] ?? 'Você venceu! A insígnia é sua.';
}

export function gymEncounter(gym: Gym, run: RunState, me: Fame): Encounter {
  const d = gymDifficulty(gym, run);
  const base = gym.team.slice(0, -1);
  const ace = gym.team[gym.team.length - 1];
  // Os primeiros do time, depois Pokémon extras do tipo; o ás sempre fecha.
  const others = [...base, ...extraOfType(gym, 6)].slice(0, d.size - 1);
  const team = [...others.map(n => createMon(grownUp(n, d.level), {level: d.level, ivMin: d.ivMin, shinyChance: 0, hiddenAbilityChance: 0})), createMon(grownUp(ace, d.ace), {level: d.ace, ivMin: Math.min(31, d.ivMin + 6), shinyChance: 0, hiddenAbilityChance: 0})];
  const intro = me.fame >= 400 ? [`🎙️ O ginásio de ${gym.leader} está lotado! ${me.name} quer a ${gym.badge}!`] : [`${gym.leader}: "${LEADER_TALK[gym.leader]?.[0] ?? 'Vamos batalhar!'}"`];
  return {mon: team[0], team, rarity: 'rare', boss: true, trainer: gym.leader, gym: gym.id, arena: GYM_BIOME[gym.type], intro};
}
