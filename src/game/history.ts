// Histórico do treinador: cada partida importante (Rush, campeonatos, ginásios, lendas,
// torneios, rivais, fim de run) vira um registro com quem ganhou, contra quem e os times.
// Fica no aparelho, um por treinador (rtg-history-<id>). A lista guarda só as últimas
// partidas, mas os totais de vitórias/derrotas de cada modo nunca se perdem.
import {RUSH_MODES} from './rush';

export type FoeKind = 'cpu' | 'friend' | 'player' | 'bot' | 'gym' | 'legend' | 'rival' | 'run';

export interface MatchLog {
  at: number;
  /** Modo (linha da tabela), ex.: "gym", "rush:nv50", "online-rush:mega", "qtour-online". */
  mode: string;
  online: boolean;
  won: boolean;
  /** Adversário (para uma run: "Ronda 37"). */
  vs: string;
  vsAvatar?: string;
  vsKind: FoeKind;
  /** Espécies do seu time e do time do adversário (o que você viu dele). */
  mine: string[];
  theirs: string[];
  /** Detalhe curto: "Final · Copa da Liga", "Insígnia da Rocha", "Venceu com 2 de pé"... */
  note?: string;
}

export interface ModeTotals {
  w: number;
  l: number;
  /** Campeonatos vencidos (só nos modos de torneio). */
  titles?: number;
  /** Melhor ronda (runs). */
  best?: number;
}

export interface History {
  version: 1;
  list: MatchLog[];
  totals: Record<string, ModeTotals>;
  /** Perfil de quem você enfrentou online (o que o aparelho dele mandou na última partida). */
  foes?: Record<string, FoeSnap>;
}

/** Resumo do histórico de alguém que mora em outro aparelho (mandado pela rede). */
export interface FoeSnap {
  name: string;
  avatar: string;
  at: number;
  list: MatchLog[];
  totals: Record<string, ModeTotals>;
}

const SNAP_KEEP = 20;
const FOES_KEEP = 30;

/** Seu perfil para mandar ao adversário (só as últimas partidas, para ficar leve). */
export function snapOf(h: History, name: string, avatar: string): FoeSnap {
  return {name, avatar, at: Date.now(), list: h.list.slice(0, SNAP_KEEP), totals: h.totals};
}

export function isSnap(x: unknown): x is FoeSnap {
  const s = x as FoeSnap | null;
  return !!s && typeof s.name === 'string' && Array.isArray(s.list) && typeof s.totals === 'object';
}

/** Guarda o perfil que o adversário mandou (o mais novo de cada nome). */
export function rememberFoe(trainerId: string | null | undefined, snap: unknown): void {
  if (!trainerId || !isSnap(snap)) return;
  const h = loadHistory(trainerId);
  const foes = {...h.foes, [snap.name]: {...snap, list: snap.list.slice(0, SNAP_KEEP)}};
  const keep = Object.values(foes).sort((a, b) => b.at - a.at).slice(0, FOES_KEEP);
  save(trainerId, {...h, foes: Object.fromEntries(keep.map(f => [f.name, f]))});
}

/** Histórico vindo de um resumo (para abrir o perfil). */
export function historyOfSnap(s: FoeSnap): History {
  return {version: 1, list: s.list, totals: s.totals};
}

/** Histórico de alguém sem perfil próprio (computador, amigo no mesmo PC): as suas partidas contra ele, ao contrário. */
export function mirrorHistory(h: History, vs: string, me: {name: string; avatar: string}): History {
  let out: History = {version: 1, list: [], totals: {}};
  for (const m of [...h.list].reverse().filter(x => x.vs === vs && x.vsKind !== 'run')) {
    out = addMatch(out, {...m, won: !m.won, mine: m.theirs, theirs: m.mine, vs: me.name, vsAvatar: me.avatar, vsKind: 'player'});
  }
  return out;
}

export const HISTORY_KEEP = 60;

export const historyKey = (trainerId: string) => `rtg-history-${trainerId}`;

function empty(): History {
  return {version: 1, list: [], totals: {}};
}

export function loadHistory(trainerId: string | null | undefined): History {
  if (!trainerId) return empty();
  try {
    const raw = localStorage.getItem(historyKey(trainerId));
    if (raw) {
      const h = JSON.parse(raw) as History;
      if (h.version === 1 && Array.isArray(h.list)) return {...h, totals: h.totals ?? {}};
    }
  } catch {
    /* sem storage */
  }
  return empty();
}

function save(trainerId: string, h: History): void {
  try {
    localStorage.setItem(historyKey(trainerId), JSON.stringify(h));
  } catch {
    /* ignora */
  }
}

/** Soma a partida nos totais e põe no topo da lista (sem mexer no storage). */
export function addMatch(h: History, m: MatchLog): History {
  const t = {...(h.totals[m.mode] ?? {w: 0, l: 0})};
  if (m.won) t.w++;
  else t.l++;
  return {...h, list: [m, ...h.list].slice(0, HISTORY_KEEP), totals: {...h.totals, [m.mode]: t}};
}

// Quem quer saber quando o histórico online muda (a lista de jogadores manda o perfil para a nuvem).
let onlineListener: ((trainerId: string) => void) | null = null;

export function onOnlineHistory(fn: ((trainerId: string) => void) | null): void {
  onlineListener = fn;
}

/** O modo é online (contra pessoas ou na carreira online)? */
export function isOnlineMode(mode: string): boolean {
  return ONLINE.some(r => (r.key.endsWith(':') ? mode.startsWith(r.key) : mode === r.key));
}

/** Grava uma partida no histórico do treinador. */
export function recordMatch(trainerId: string | null | undefined, m: Omit<MatchLog, 'at'> & {at?: number}): void {
  if (!trainerId) return;
  save(trainerId, addMatch(loadHistory(trainerId), {at: Date.now(), ...m}));
  if (m.online) onlineListener?.(trainerId);
}

/** Mexe num total sem criar partida (título de campeonato, melhor ronda). */
export function bumpTotals(trainerId: string | null | undefined, mode: string, fn: (t: ModeTotals) => void): void {
  if (!trainerId) return;
  const h = loadHistory(trainerId);
  const t = {...(h.totals[mode] ?? {w: 0, l: 0})};
  fn(t);
  save(trainerId, {...h, totals: {...h.totals, [mode]: t}});
  if (isOnlineMode(mode)) onlineListener?.(trainerId);
}

export function deleteHistory(trainerId: string): void {
  try {
    localStorage.removeItem(historyKey(trainerId));
  } catch {
    /* ignora */
  }
}

// ------------------------------------------------------------------ Tabelas do perfil

/** Linhas fixas de cada tabela, na ordem em que aparecem. Rush entra por modo (prefixo). */
const OFFLINE: {key: string; label: string; icon: string; about: string}[] = [
  {key: 'run', label: 'Runs solo', icon: 'map', about: 'Vitória = temporada completa (todas as rondas).'},
  {key: 'gym', label: 'Ginásios', icon: 'badge', about: 'Lutas contra líderes de ginásio nas runs.'},
  {key: 'legend', label: 'Lendas', icon: 'star', about: 'Desafios contra treinadores lendários.'},
  {key: 'tour', label: 'Torneios da temporada', icon: 'trophy', about: 'Partidas dos torneios dentro das runs.'},
  {key: 'rival', label: 'Rivais', icon: 'sword', about: 'Rivais que aparecem no caminho.'},
  {key: 'rush:', label: 'Rush', icon: 'bolt', about: 'Contra o computador ou um amigo no mesmo aparelho.'},
  {key: 'qtour', label: 'Campeonato rápido', icon: 'bracket', about: 'Partidas do campeonato rápido offline.'},
  {key: 'built', label: 'Dream Team', icon: 'ball', about: 'Seu time montado contra o computador ou contra os times dos amigos.'},
];

const ONLINE: {key: string; label: string; icon: string; about: string}[] = [
  {key: 'online-rush:', label: 'Rush online', icon: 'bolt', about: 'Contra um amigo em outro aparelho.'},
  {key: 'qtour-online', label: 'Campeonato rápido online', icon: 'bracket', about: 'Partidas do campeonato com amigos.'},
  {key: 'online-built', label: 'Dream Team online', icon: 'ball', about: 'Seu time montado contra o time de um amigo, cada um no seu aparelho.'},
  {key: 'career-pvp', label: 'Carreira · contra amigos', icon: 'people', about: 'Partidas ao vivo contra os amigos da carreira.'},
  {key: 'career', label: 'Carreira · contra o jogo', icon: 'globe', about: 'Ginásios, lendas, rivais e bots dentro da carreira online.'},
];

export interface TableRow {
  key: string;
  label: string;
  icon: string;
  about: string;
  w: number;
  l: number;
  titles: number;
  best?: number;
}

export const winRate = (w: number, l: number): number | null => (w + l ? Math.round((100 * w) / (w + l)) : null);

const rushName = (id: string) => RUSH_MODES.find(m => m.id === id)?.name ?? id;

/** Nome do modo para mostrar (ex.: "rush:mega" → "Rush · Mega"). */
export function modeLabel(mode: string): string {
  if (mode.startsWith('online-rush:')) return `Rush online · ${rushName(mode.slice(12))}`;
  if (mode.startsWith('rush:')) return `Rush · ${rushName(mode.slice(5))}`;
  return [...OFFLINE, ...ONLINE].find(r => r.key === mode)?.label ?? mode;
}

/** Tabela de um lado (offline ou online): uma linha por modo jogado (Rush abre por modo). */
export function tableOf(h: History, online: boolean): TableRow[] {
  const rows: TableRow[] = [];
  for (const r of online ? ONLINE : OFFLINE) {
    if (r.key.endsWith(':')) {
      const keys = Object.keys(h.totals)
        .filter(k => k.startsWith(r.key))
        .sort((a, b) => RUSH_MODES.findIndex(m => m.id === a.slice(r.key.length)) - RUSH_MODES.findIndex(m => m.id === b.slice(r.key.length)));
      for (const k of keys) {
        const t = h.totals[k];
        rows.push({key: k, label: modeLabel(k), icon: r.icon, about: r.about, w: t.w, l: t.l, titles: t.titles ?? 0, best: t.best});
      }
      continue;
    }
    const t = h.totals[r.key];
    if (t && (t.w || t.l || t.titles)) rows.push({...r, w: t.w, l: t.l, titles: t.titles ?? 0, best: t.best});
  }
  return rows;
}

/** Somatório de uma tabela. */
export function sumRows(rows: TableRow[]): {w: number; l: number; titles: number} {
  return rows.reduce((a, r) => ({w: a.w + r.w, l: a.l + r.l, titles: a.titles + r.titles}), {w: 0, l: 0, titles: 0});
}

/** Sequência atual (vitórias ou derrotas seguidas) nas partidas da lista. */
export function streakOf(list: MatchLog[]): {won: boolean; n: number} | null {
  if (!list.length) return null;
  const won = list[0].won;
  let n = 0;
  while (n < list.length && list[n].won === won) n++;
  return {won, n};
}

/** Adversário que você mais enfrentou (e o placar contra ele). */
export function nemesisOf(list: MatchLog[]): {vs: string; avatar?: string; w: number; l: number} | null {
  const by = new Map<string, {vs: string; avatar?: string; w: number; l: number}>();
  for (const m of list) {
    if (m.vsKind === 'run') continue;
    const e = by.get(m.vs) ?? {vs: m.vs, avatar: m.vsAvatar, w: 0, l: 0};
    if (m.won) e.w++;
    else e.l++;
    by.set(m.vs, e);
  }
  const all = [...by.values()].filter(e => e.w + e.l >= 2).sort((a, b) => b.w + b.l - (a.w + a.l) || b.l - a.l);
  return all[0] ?? null;
}

/** Pokémon que mais apareceu nos seus times da lista. */
export function mvpOf(list: MatchLog[]): {name: string; games: number; wins: number} | null {
  const by = new Map<string, {games: number; wins: number}>();
  for (const m of list) {
    for (const s of new Set(m.mine)) {
      const e = by.get(s) ?? {games: 0, wins: 0};
      e.games++;
      if (m.won) e.wins++;
      by.set(s, e);
    }
  }
  const best = [...by].sort((a, b) => b[1].games - a[1].games || b[1].wins - a[1].wins)[0];
  return best ? {name: best[0], ...best[1]} : null;
}

// ------------------------------------------------------------------ Tela de vitória

/** Resuminho do histórico de alguém: últimas partidas (mais recente primeiro) e V/D. */
export interface HistCard {
  who: string;
  dots: boolean[];
  w: number;
  l: number;
  /** Ex.: "contra você" quando o histórico é o seu, ao contrário. */
  note?: string;
  /** As mesmas últimas partidas, com o nome do adversário (aparelhos antigos não mandam). */
  last?: {vs: string; won: boolean}[];
}

/** O seu histórico (todas as partidas). */
export function cardOf(h: History, who: string): HistCard {
  const all = sumRows([...tableOf(h, false), ...tableOf(h, true)]);
  const last = h.list.slice(0, 5).map(m => ({vs: m.vs, won: m.won}));
  return {who, dots: last.map(m => m.won), w: all.w, l: all.l, last};
}

/** Histórico de quem só existe neste aparelho (computador, amigo no mesmo PC): o seu contra ele, ao contrário. */
export function mirrorCard(h: History, who: string, match: (m: MatchLog) => boolean, me = 'Você'): HistCard {
  const games = h.list.filter(match);
  const w = games.filter(m => !m.won).length;
  const last = games.slice(0, 5).map(m => ({vs: me, won: !m.won}));
  return {who, dots: last.map(m => m.won), w, l: games.length - w, note: 'contra você', last};
}

/** Soma uma vitória que acabou de acontecer num resumo recebido de outro aparelho. */
export function withWin(c: HistCard, vs?: string): HistCard {
  const last = vs && Array.isArray(c.last) ? [{vs, won: true}, ...c.last].slice(0, 5) : undefined;
  return {...c, dots: [true, ...c.dots].slice(0, 5), w: c.w + 1, last};
}
