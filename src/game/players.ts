// Lista de jogadores: quem já jogou online manda um resumo do próprio histórico online
// para o banco (uma gravação no fim de cada partida online, e quando muda nome ou avatar).
// Assim dá para abrir o perfil de qualquer amigo e ver as partidas dele contra todo mundo.
// Quem só joga offline nunca grava nada aqui.
import {cloudId, cloudRaw, cloudReady} from './cloud';
import {isOnlineMode, loadHistory, onOnlineHistory, type History, type MatchLog, type ModeTotals} from './history';
import {loadTrainers} from './trainers';
import {saneKo} from './recap';
import {RAISE_GAP, RANK_KEYS, emptyScore, nextCloudScore, type CloudScore} from './ranking';

/** Resumo de um jogador na nuvem (só a parte online do histórico). */
export interface PlayerCard {
  /** Id do documento (identidade do navegador + treinador). */
  key: string;
  tid: string;
  name: string;
  avatar: string;
  /** Última vez que gravou. */
  at: number;
  list: MatchLog[];
  totals: Record<string, ModeTotals>;
  /** Treinador apagado: some da lista. */
  gone?: boolean;
  /** Pontos do ranking que o banco aceitou (conferidos pelas regras, não pelo aparelho dele). */
  score?: CloudScore;
}

export const PLAYERS_PATH = 'careers/PLAYERS/players';
/** Partidas online guardadas no resumo (o documento fica pequeno). */
export const PLAYER_KEEP = 40;

const pushedKey = (tid: string) => `rtg-pl-${tid}`;

function wasPushed(tid: string): boolean {
  try {
    return localStorage.getItem(pushedKey(tid)) === '1';
  } catch {
    return false;
  }
}

function markPushed(tid: string): void {
  try {
    localStorage.setItem(pushedKey(tid), '1');
  } catch {
    /* ignora */
  }
}

/** Só a parte online do histórico. */
export function onlinePart(h: History): {list: MatchLog[]; totals: Record<string, ModeTotals>} {
  return {
    list: h.list.filter(m => m.online).slice(0, PLAYER_KEEP),
    totals: Object.fromEntries(Object.entries(h.totals).filter(([k]) => isOnlineMode(k))),
  };
}

export const hasOnline = (h: History) => h.list.some(m => m.online) || Object.keys(h.totals).some(isOnlineMode);

/** Histórico para abrir o perfil. */
export const historyOfCard = (p: PlayerCard): History => ({version: 1, list: p.list, totals: p.totals, points: p.score?.pts});

// ------------------------------------------------------------------ Gravar o seu

const sentKey = (tid: string) => `rtg-score-${tid}`;

/** Últimos pontos que o banco aceitou deste treinador. */
function loadSent(tid: string): CloudScore {
  try {
    const s = saneScore(JSON.parse(localStorage.getItem(sentKey(tid)) ?? 'null'));
    if (s) return s;
  } catch {
    /* sem storage */
  }
  return emptyScore();
}

function saveSent(tid: string, s: CloudScore): void {
  try {
    localStorage.setItem(sentKey(tid), JSON.stringify(s));
  } catch {
    /* ignora */
  }
}

/** Gravações seguidas recusadas (para não insistir para sempre). */
const fails = new Map<string, number>();

async function push(tid: string, gone = false): Promise<void> {
  const me = await cloudId();
  if (!me) return;
  const t = loadTrainers().list.find(x => x.id === tid);
  if (!t && !gone) return;
  const key = `${me}_${tid}`;
  const h = loadHistory(tid);
  const card: PlayerCard = gone
    ? {key, tid, name: '', avatar: '', at: Date.now(), list: [], totals: {}, gone: true}
    : {key, tid, name: t!.name, avatar: t!.avatar, at: Date.now(), ...onlinePart(h)};
  const path = `${PLAYERS_PATH}/${encodeURIComponent(key)}`;
  const sent = loadSent(tid);
  // Treinador apagado: os pontos ficam como estão (o documento some da lista mesmo assim).
  const next = gone ? {score: sent, more: false, raises: false} : nextCloudScore(h.points ?? {}, sent, Date.now());
  try {
    await cloudRaw.put(path, card, {score: next.score as unknown as Record<string, number>});
  } catch (e) {
    if (!/403/.test(String(e))) throw e; // sem internet: vai na próxima partida
    // Recusado: talvez o banco tenha outros pontos guardados (outro navegador, aparelho resetado).
    // Lê o que está lá e tenta de novo daqui a pouco.
    const there = await cloudRaw.getField(path, 'score').then(
      v => ({ok: true, v}),
      () => ({ok: false, v: undefined}),
    );
    if (!there.ok) throw e;
    if (there.v === undefined) {
      // Banco sem pontos (regras antigas, de antes do ranking): grava o resto sem eles.
      await cloudRaw.put(path, card);
      markPushed(tid);
      cache = null;
      return;
    }
    const n = (fails.get(tid) ?? 0) + 1;
    fails.set(tid, n);
    saveSent(tid, saneScore(there.v) ?? emptyScore());
    if (n <= 3) later(tid, RAISE_GAP + 5000);
    throw e;
  }
  fails.delete(tid);
  saveSent(tid, next.score);
  // Ganhou duas seguidas muito rápido: o resto dos pontos vai na próxima gravação.
  if (next.more) later(tid, RAISE_GAP + 5000);
  markPushed(tid);
  cache = null;
}

function later(tid: string, ms: number): void {
  if (!cloudReady()) return;
  clearTimeout(timers.get(tid));
  timers.set(
    tid,
    setTimeout(() => {
      timers.delete(tid);
      void push(tid).catch(() => {});
    }, ms),
  );
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Manda o resumo daqui a pouco (várias mudanças seguidas, como partida + título, viram uma gravação só). */
export function queuePush(tid: string): void {
  fails.delete(tid);
  later(tid, 1500);
}

/** Mudou nome ou avatar: atualiza só se ele já está na lista (quem só joga offline não grava). */
export function profileChanged(tid: string): void {
  if (wasPushed(tid)) queuePush(tid);
}

/** Treinador apagado: tira da lista. */
export function trainerRemoved(tid: string): void {
  if (!wasPushed(tid) || !cloudReady()) return;
  clearTimeout(timers.get(tid));
  void push(tid, true).catch(() => {});
}

/** Ao abrir o jogo: quem já tinha partidas online antes desta lista existir entra nela (uma vez só). */
export function syncOldPlayers(): void {
  if (!cloudReady()) return;
  for (const t of loadTrainers().list) {
    if (!wasPushed(t.id) && hasOnline(loadHistory(t.id))) queuePush(t.id);
  }
}

let started = false;

/** Liga o envio automático no fim de cada partida online. */
export function startPlayerSync(): void {
  if (started) return;
  started = true;
  onOnlineHistory(queuePush);
  syncOldPlayers();
}

// ------------------------------------------------------------------ Ler a lista

const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');
const strs = (x: unknown) => (Array.isArray(x) ? x.filter(s => typeof s === 'string').slice(0, 6).map(s => s.slice(0, 40)) : []);
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x < 1e6 ? Math.floor(x) : 0);

function saneMatch(x: unknown): MatchLog | null {
  const m = x as MatchLog | null;
  if (!m || typeof m !== 'object' || typeof m.mode !== 'string' || typeof m.won !== 'boolean' || typeof m.at !== 'number') return null;
  return {
    at: m.at,
    mode: str(m.mode, 40),
    online: true,
    won: m.won,
    vs: str(m.vs, 30) || '?',
    vsAvatar: str(m.vsAvatar, 200) || undefined,
    vsKind: m.vsKind,
    mine: strs(m.mine),
    theirs: strs(m.theirs),
    note: str(m.note, 80) || undefined,
    ko: saneKo(m.ko),
    pts: typeof m.pts === 'number' && Number.isFinite(m.pts) && Math.abs(m.pts) <= 50 ? Math.round(m.pts) : undefined,
  };
}

/** Pontos lidos do banco (ou do aparelho): só inteiros, sem negativos, só os modos do ranking. */
export function saneScore(x: unknown): CloudScore | null {
  const s = x as CloudScore | null;
  if (!s || typeof s !== 'object' || !s.pts || typeof s.pts !== 'object') return null;
  const pts = emptyScore().pts;
  for (const k of RANK_KEYS) pts[k] = num(s.pts[k]);
  return {pts, n: num(s.n), t: typeof s.t === 'number' && Number.isFinite(s.t) && s.t >= 0 ? Math.floor(s.t) : 0};
}

/** Limpa o que veio do banco (um amigo esperto poderia gravar qualquer coisa). */
export function sanePlayerCard(x: unknown): PlayerCard | null {
  const p = x as PlayerCard | null;
  if (!p || typeof p !== 'object' || typeof p.key !== 'string' || typeof p.tid !== 'string') return null;
  if (p.gone) return {key: p.key, tid: p.tid, name: '', avatar: '', at: num(p.at), list: [], totals: {}, gone: true};
  const name = str(p.name, 20).trim();
  if (!name || !Array.isArray(p.list) || !p.totals || typeof p.totals !== 'object') return null;
  const totals: Record<string, ModeTotals> = {};
  for (const [k, t] of Object.entries(p.totals).slice(0, 40)) {
    if (!isOnlineMode(k) || !t || typeof t !== 'object') continue;
    totals[k] = {w: num(t.w), l: num(t.l), ...(t.titles ? {titles: num(t.titles)} : {})};
  }
  return {
    key: p.key,
    tid: p.tid,
    name,
    avatar: str(p.avatar, 200),
    at: typeof p.at === 'number' ? p.at : 0,
    list: p.list.slice(0, PLAYER_KEEP).map(saneMatch).filter((m): m is MatchLog => !!m),
    totals,
  };
}

let cache: {at: number; list: PlayerCard[]} | null = null;

/** Todos os jogadores (quem jogou por último primeiro). Guarda por 30 s para não ler o banco à toa. */
export async function listPlayers(force = false): Promise<PlayerCard[]> {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.list;
  const raw = await cloudRaw.listWith<unknown>(PLAYERS_PATH, 'score');
  const list = raw
    .map(({value, extra}) => {
      const p = sanePlayerCard(value);
      const score = saneScore(extra);
      return p && score ? {...p, score} : p;
    })
    .filter((p): p is PlayerCard => !!p && !p.gone)
    .sort((a, b) => b.at - a.at);
  cache = {at: Date.now(), list};
  return list;
}
