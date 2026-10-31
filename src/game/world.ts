// O mundo da temporada: os rivais (bots) jogam a temporada junto com você, ronda a ronda.
// Eles treinam o time, viajam, desafiam ginásios, enfrentam lendas e jogam os torneios.
// Tudo o que fazem vira estatística (para estudar) e notícia (para o jornal).
// Na carreira online o mundo fica na nuvem: todo mundo vê os mesmos bots.
import {glimpse} from './scout';
import {GYMS, getGym, gymsOf} from '../data/gyms';
import {legendsOf} from '../data/legends';
import {REGIONS, getRegion} from '../data/regions';
import {RIVALS, getRival} from '../data/rivals';
import type {CareerFight} from './career';
import {POINTS} from './league';
import {chance, pick, shuffle} from './rng';

export interface WorldBadge {
  gym: string;
  wave: number;
  /** Time que levou para a luta (espécies). */
  team: string[];
  /** Quantas vezes tentou até ganhar. */
  tries: number;
}

export interface WorldBot {
  name: string;
  avatar: string;
  /** Região onde está agora. */
  region: string;
  /** 0,4 (iniciante) a 1,6 (craque). */
  skill: number;
  /** Pokémon parceiro (o primeiro do elenco). */
  partner: string;
  /** Time atual (espécies); cresce ao longo da temporada. */
  team: string[];
  badges: WorldBadge[];
  /** Tentativas que ainda não deram certo, por ginásio. */
  tries: Record<string, number>;
  legends: string[];
  usage: Record<string, number>;
  fights: CareerFight[];
  log: {label: string; pts: number; wave: number}[];
  points: number;
  /** Pontos das temporadas anteriores (na carreira). */
  banked: number;
}

export interface WorldNews {
  wave: number;
  who: string;
  text: string;
  /** Quanto mais importante, mais chance de sair no jornal. */
  weight: number;
}

export interface World {
  wave: number;
  bots: WorldBot[];
  news: WorldNews[];
}

/** "A, B e C". */
export const listPt = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs[0] ?? '');

const teamSizeAt = (wave: number) => Math.min(6, 2 + Math.floor(wave / 20));

function newBot(r: (typeof RIVALS)[number], skill: number, banked = 0): WorldBot {
  return {
    name: r.name, avatar: r.avatar, region: r.region, skill, partner: r.team[0], team: r.team.slice(0, 2),
    badges: [], tries: {}, legends: [], usage: {}, fights: [], log: [], points: 0, banked,
  };
}

/** Mundo novo. `npcs` mantém os rivais do circuito (com a habilidade de cada um). */
export function newWorld(npcs?: {name: string; skill: number; total?: number}[]): World {
  const picked = npcs?.length
    ? npcs.flatMap(n => {
        const r = getRival(n.name);
        return r ? [newBot(r, n.skill, n.total ?? 0)] : [];
      })
    : shuffle(RIVALS)
        .slice(0, 12)
        .map((r, i) => newBot(r, 0.4 + (i / 12) * 1.1 + Math.random() * 0.15));
  return {wave: 0, bots: picked, news: []};
}

/** Começa a temporada seguinte com os mesmos rivais (os pontos vão para o acumulado). */
export function nextSeasonWorld(w: World): World {
  return {
    wave: 0,
    news: [],
    bots: w.bots.map(b => ({...newBot(getRival(b.name) ?? RIVALS[0], b.skill, b.banked + b.points), name: b.name, avatar: b.avatar})),
  };
}

function addPts(b: WorldBot, pts: number, label: string, wave: number) {
  b.points += pts;
  b.log.push({label, pts, wave});
}

function fight(b: WorldBot, f: Omit<CareerFight, 'seen'>) {
  const seen = shuffle(b.team).slice(0, Math.min(b.team.length, 2 + (Math.random() < 0.5 ? 1 : 0)));
  b.fights = [{...f, seen}, ...b.fights].slice(0, 12);
  return seen;
}

function news(w: World, n: WorldNews) {
  w.news = [n, ...w.news].slice(0, 40);
}

/** Uma ronda de jogo na vida de um rival. */
function tick(w: World, b: WorldBot, wave: number, boost: number) {
  // O time cresce: entra mais um do elenco.
  const roster = getRival(b.name)?.team ?? b.team;
  while (b.team.length < teamSizeAt(wave)) {
    const free = roster.filter(s => !b.team.includes(s));
    if (!free.length) break;
    b.team = [...b.team, pick(free)];
  }
  for (const s of b.team) b.usage[s] = (b.usage[s] ?? 0) + 1;

  // Ginásio: o próximo da região, quando o time já aguenta.
  const gyms = gymsOf(b.region);
  const i = gyms.findIndex(g => !b.badges.some(x => x.gym === g.id));
  const next = i >= 0 ? gyms[i] : undefined;
  if (next && wave >= (i + 1) * 5 && chance(Math.min(0.8, (0.08 + 0.07 * b.skill) * boost))) {
    const tries = (b.tries[next.id] ?? 0) + 1;
    const won = chance(Math.min(0.9, Math.max(0.15, 0.35 + 0.35 * b.skill - i * 0.03)));
    const seen = fight(b, {vs: next.leader, won, kind: 'gym', wave});
    if (won) {
      delete b.tries[next.id];
      b.badges.push({gym: next.id, wave, team: [...b.team], tries});
      addPts(b, POINTS.badge, `${next.badge} (${next.leader})`, wave);
      news(w, {wave, who: b.name, weight: 1 + i / 4, text: `${b.name} ganhou a ${next.badge} de ${next.leader}${tries > 1 ? ` na ${tries}ª tentativa` : ''}, com ${listPt(glimpse(seen, `gym|${next.leader}|${wave}`))} em destaque.`});
      if (b.badges.filter(x => getGym(x.gym)?.region === b.region).length === gyms.length) {
        addPts(b, POINTS.book, `Caderneta de ${getRegion(b.region).name} completa`, wave);
        news(w, {wave, who: b.name, weight: 4, text: `${b.name} completou a caderneta de insígnias de ${getRegion(b.region).name}!`});
      }
    } else {
      b.tries[next.id] = tries;
      if (tries >= 3) news(w, {wave, who: b.name, weight: 1, text: `${next.leader} derrotou ${b.name} pela ${tries}ª vez. Será que vem revanche?`});
    }
  }

  // Lenda da região: raro, e mais para os bons.
  const legend = legendsOf(b.region).find(l => !b.legends.includes(l.id));
  if (legend && wave >= 20 && chance(0.006 * b.skill * boost)) {
    const won = chance(0.25 + 0.2 * b.skill);
    fight(b, {vs: legend.name, won, kind: 'legend', wave});
    if (won) {
      b.legends.push(legend.id);
      addPts(b, POINTS.legend, `Vitória sobre ${legend.name}`, wave);
      news(w, {wave, who: b.name, weight: 6, text: `Que batalha! ${b.name} venceu ${legend.name} em ${getRegion(b.region).name}.`});
    } else news(w, {wave, who: b.name, weight: 3, text: `${b.name} desafiou ${legend.name}, mas não deu desta vez.`});
  }

  // Viajantes ajudados (pontinhos de vez em quando).
  if (chance(0.03 * boost)) addPts(b, POINTS.traveler, `Viajante ajudado (${getRegion(b.region).name})`, wave);

  // Viaja: caderneta completa ou vontade de conhecer outro lugar.
  const done = next === undefined;
  if ((done && chance(0.3 * boost)) || chance(0.015 * boost)) {
    const options = REGIONS.filter(r => r.id !== b.region && gymsOf(r.id).length);
    const to = pick(options.length ? options : REGIONS);
    b.region = to.id;
    if (done) news(w, {wave, who: b.name, weight: 1, text: `${b.name} partiu para ${to.name} atrás de novas insígnias.`});
  }
}

/**
 * Avança o mundo até a ronda `wave` (cada rival joga as rondas que faltam).
 * `step`: numa carreira curta cada ronda vale várias rondas de jogo (os rivais jogam uma por ronda, como você).
 */
export function stepWorld(w: World, wave: number, step = 1): void {
  while (w.wave < wave) {
    w.wave++;
    if (w.wave % step) continue;
    for (const b of w.bots) tick(w, b, w.wave, Math.min(3, step));
  }
}

/** Nível do time de um rival nesta ronda. */
export function botLevel(b: WorldBot, wave: number): number {
  return Math.max(5, Math.min(100, Math.round(wave * 0.9) + 1 + Math.round((b.skill - 1) * 3)));
}

/** Resultado de um torneio para os rivais que jogaram: pontos, lutas e notícia do campeão. */
export function worldTournament(
  w: World,
  t: {wave: number; entrants: {name: string; player?: boolean; friend?: boolean; pid?: string}[]; rounds: {a: number; b: number; winner?: number}[][]},
  title: string,
  fame: number[],
): void {
  const stage = ['Quartas', 'Semifinal', 'Final'];
  t.rounds.forEach((round, r) =>
    round.forEach(m => {
      if (m.winner === undefined) return;
      for (const [me, foe] of [[m.a, m.b], [m.b, m.a]]) {
        const bot = w.bots.find(x => x.name === t.entrants[me].name && !t.entrants[me].pid && !t.entrants[me].player);
        if (bot) fight(bot, {vs: `${t.entrants[foe].name} (${title}, ${stage[r] ?? ''})`, won: m.winner === me, kind: 'tour', wave: t.wave});
      }
    }),
  );
  const placeOf = (idx: number) => {
    const last = t.rounds.findIndex(round => round.some(m => (m.a === idx || m.b === idx) && m.winner !== undefined && m.winner !== idx));
    if (last < 0) return t.rounds.length === 3 && t.rounds[2][0]?.winner === idx ? 1 : 0;
    return [5, 3, 2][last];
  };
  const label = ['Campeão', 'Vice', 'Semifinal', 'Quartas'];
  t.entrants.forEach((e, idx) => {
    const bot = !e.pid && !e.player ? w.bots.find(x => x.name === e.name) : undefined;
    const place = placeOf(idx);
    if (!bot || !place) return;
    const i = place === 1 ? 0 : place === 2 ? 1 : place === 3 ? 2 : 3;
    addPts(bot, fame[i], `${title}: ${label[i]}`, t.wave);
    if (place === 1) news(w, {wave: t.wave, who: bot.name, weight: 5, text: `${bot.name} é campeão do ${title}! O parceiro ${bot.partner} brilhou na final.`});
  });
}

/** Pokémon mais jogado. */
export function favoriteOf(usage: Record<string, number> | undefined): string | undefined {
  return Object.entries(usage ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Insígnias por ordem (para o perfil). */
export function sortBadges<T extends {gym: string}>(badges: T[]): T[] {
  const order = new Map(GYMS.map((g, i) => [g.id, i]));
  return [...badges].sort((a, b) => (order.get(a.gym) ?? 0) - (order.get(b.gym) ?? 0));
}
