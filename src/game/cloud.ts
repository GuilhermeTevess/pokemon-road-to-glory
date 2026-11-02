// Onde a carreira fica salva: Firestore (pela API REST, sem SDK) ou, para testes, o próprio navegador.
// Cada documento guarda um único campo `json` com o objeto inteiro.
import {FIREBASE} from '../data/firebase';
import {sanePlayer, type CareerDoc, type PlayerDoc} from './career';
import type {World} from './world';
import type {Entrant, MatchResult} from './tournament';

function localMode(): boolean {
  try {
    return new URLSearchParams(location.search).get('net') === 'local';
  } catch {
    return false;
  }
}

/** A carreira online está disponível (Firebase configurado ou modo de teste). */
export function cloudReady(): boolean {
  return localMode() || !!(FIREBASE.apiKey && FIREBASE.projectId);
}

const BASE = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;
const KEY = () => `key=${encodeURIComponent(FIREBASE.apiKey)}`;

type Doc = {name?: string; fields?: {json?: {stringValue?: string}; owner?: {stringValue?: string}}};

// ---------- Login anônimo ----------
// Ninguém digita nada: na primeira vez o navegador ganha uma identidade secreta do Firebase
// (fica guardada aqui) e manda junto em cada pedido. As regras do banco (firestore.rules)
// usam essa identidade para deixar cada um mexer só nas próprias coisas.
// Se o login anônimo ainda não estiver ligado no Firebase, o jogo continua sem ele.
interface Auth {
  uid: string;
  idToken: string;
  refreshToken: string;
  exp: number;
}

const AUTH_KEY = 'rtg-auth';
let authInFlight: Promise<Auth | null> | null = null;
let authFailedAt = 0;

function loadAuth(): Auth | null {
  try {
    const a = JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null') as Auth | null;
    return a?.uid && a.refreshToken ? a : null;
  } catch {
    return null;
  }
}

function saveAuth(a: Auth): void {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(a));
  } catch {
    /* ignora */
  }
}

async function signIn(): Promise<Auth | null> {
  const key = encodeURIComponent(FIREBASE.apiKey);
  const old = loadAuth();
  if (old) {
    // Renova o passe (dura 1 hora) mantendo a mesma identidade.
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${key}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(old.refreshToken)}`,
    });
    if (res.ok) {
      const r = (await res.json()) as {id_token: string; refresh_token: string; expires_in: string; user_id: string};
      const a: Auth = {uid: r.user_id, idToken: r.id_token, refreshToken: r.refresh_token, exp: Date.now() + Number(r.expires_in) * 1000};
      saveAuth(a);
      return a;
    }
    // Só cria uma identidade nova se a antiga não existe mais (com internet ruim, tenta depois).
    if (res.status !== 400) throw new Error(`auth ${res.status}`);
  }
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({returnSecureToken: true}),
  });
  if (!res.ok) throw new Error(`auth ${res.status}`);
  const r = (await res.json()) as {idToken: string; refreshToken: string; expiresIn: string; localId: string};
  const a: Auth = {uid: r.localId, idToken: r.idToken, refreshToken: r.refreshToken, exp: Date.now() + Number(r.expiresIn) * 1000};
  saveAuth(a);
  return a;
}

/** Identidade atual (renova sozinha). `null` = sem login (modo de teste ou login desligado). */
async function auth(): Promise<Auth | null> {
  if (localMode() || !FIREBASE.apiKey) return null;
  const a = loadAuth();
  if (a && a.idToken && a.exp > Date.now() + 60_000) return a;
  if (Date.now() - authFailedAt < 60_000) return null;
  authInFlight ??= signIn()
    .catch(() => {
      authFailedAt = Date.now();
      return null;
    })
    .finally(() => {
      authInFlight = null;
    });
  return authInFlight;
}

/** Identidade deste navegador no banco (para o documento do jogador). `null` = sem login. */
export async function cloudId(): Promise<string | null> {
  if (localMode()) return 'local';
  return (await auth())?.uid ?? null;
}

async function headers(json = false): Promise<Record<string, string>> {
  const h: Record<string, string> = json ? {'Content-Type': 'application/json'} : {};
  const a = await auth();
  if (a) h.Authorization = `Bearer ${a.idToken}`;
  return h;
}

/** Pedido ao Firestore com a identidade. Se o passe venceu ou ficou inválido (401), renova e tenta de novo uma vez. */
async function call(url: string, init: RequestInit = {}, json = false): Promise<Response> {
  const res = await fetch(url, {...init, headers: await headers(json)});
  if (localMode() || !(res.status === 401 || (res.status === 400 && /jwt|token|credential/i.test(await res.clone().text())))) return res;
  const a = loadAuth();
  if (a) saveAuth({...a, exp: 0});
  return fetch(url, {...init, headers: await headers(json)});
}

async function body(value: unknown): Promise<string> {
  const a = await auth();
  const doc: Doc = {fields: {json: {stringValue: JSON.stringify(value)}, ...(a ? {owner: {stringValue: a.uid}} : {})}};
  return JSON.stringify(doc);
}

function parse<T>(d: Doc | null | undefined): T | null {
  const raw = d?.fields?.json?.stringValue;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function getDoc<T>(path: string): Promise<T | null> {
  if (localMode()) return parse<T>(JSON.parse(localStorage.getItem(`rtg-fakecloud/${path}`) ?? 'null'));
  const res = await call(`${BASE()}/${path}?${KEY()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  return parse<T>(await res.json());
}

async function putDoc(path: string, value: unknown): Promise<void> {
  if (localMode()) {
    localStorage.setItem(`rtg-fakecloud/${path}`, JSON.stringify({fields: {json: {stringValue: JSON.stringify(value)}}}));
    return;
  }
  const data = await body(value);
  // keepalive: mensagens pequenas ainda saem se a pessoa fechar a aba (ex.: avisar que saiu da partida).
  // O navegador só aceita keepalive até 64 KB, então as grandes (turnos da batalha) vão sem.
  const res = await call(`${BASE()}/${path}?${KEY()}`, {method: 'PATCH', body: data, keepalive: data.length < 30000}, true);
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
}

/**
 * Cria o documento só se ainda não existir e devolve o que ficou na nuvem: o primeiro
 * jogador a chegar decide (a chave do torneio, o resultado de uma partida entre bots).
 */
async function createOnce<T>(path: string, value: T): Promise<T> {
  if (localMode()) {
    const existing = await getDoc<T>(path);
    if (existing) return existing;
    await putDoc(path, value);
    return value;
  }
  const res = await call(`${BASE()}/${path}?currentDocument.exists=false&${KEY()}`, {method: 'PATCH', body: await body(value)}, true);
  if (res.ok) return value;
  // 409/400: já existia. 403: as regras não deixam mudar um documento que já existe.
  if (res.status === 409 || res.status === 400 || res.status === 403) {
    const existing = await getDoc<T>(path);
    if (existing) return existing;
  }
  throw new Error(`Firestore ${res.status}`);
}

async function delDoc(path: string): Promise<void> {
  if (localMode()) {
    localStorage.removeItem(`rtg-fakecloud/${path}`);
    return;
  }
  const res = await call(`${BASE()}/${path}?${KEY()}`, {method: 'DELETE'});
  if (!res.ok && res.status !== 404) throw new Error(`Firestore ${res.status}`);
}

/** Acesso direto a documentos (as salas do Rush e do campeonato rápido online usam). */
export const cloudRaw = {get: getDoc, put: putDoc, del: delDoc, createOnce, list: listDocs};

async function listDocs<T>(path: string): Promise<T[]> {
  if (localMode()) {
    const out: T[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!k.startsWith(`rtg-fakecloud/${path}/`)) continue;
      const v = parse<T>(JSON.parse(localStorage.getItem(k) ?? 'null'));
      if (v) out.push(v);
    }
    return out;
  }
  // Lê todas as páginas (uma carreira longa passa de 100 partidas).
  const out: T[] = [];
  let token = '';
  for (let page = 0; page < 50; page++) {
    const res = await call(`${BASE()}/${path}?pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ''}&${KEY()}`);
    if (!res.ok) throw new Error(`Firestore ${res.status}`);
    const data = (await res.json()) as {documents?: Doc[]; nextPageToken?: string};
    for (const d of data.documents ?? []) {
      const v = parse<T>(d);
      if (v) out.push(v);
    }
    if (!data.nextPageToken) break;
    token = data.nextPageToken;
  }
  return out;
}

const code = (c: string) => encodeURIComponent(c.toUpperCase());

export const cloud = {
  getCareer: (c: string) => getDoc<CareerDoc>(`careers/${code(c)}`),
  putCareer: (doc: CareerDoc) => putDoc(`careers/${code(doc.code)}`, doc),
  players: async (c: string) => (await listDocs<unknown>(`careers/${code(c)}/players`)).filter(sanePlayer),
  putPlayer: (c: string, p: PlayerDoc) => putDoc(`careers/${code(c)}/players/${encodeURIComponent(p.id)}`, p),
  putMatch: (c: string, m: MatchResult) => cloudMatches.put(c, m),
};

/** Última cópia da carreira e dos jogadores neste navegador (para abrir sem internet). */
export function cachedCareer(c: string): {doc: CareerDoc | null; peers: PlayerDoc[]} {
  try {
    return JSON.parse(localStorage.getItem(`rtg-career-${c.toUpperCase()}`) ?? '') as {doc: CareerDoc | null; peers: PlayerDoc[]};
  } catch {
    return {doc: null, peers: []};
  }
}

export function cacheCareer(c: string, doc: CareerDoc | null, peers: PlayerDoc[]): void {
  try {
    localStorage.setItem(`rtg-career-${c.toUpperCase()}`, JSON.stringify({doc, peers}));
  } catch {
    /* ignora */
  }
}


/** Partidas dos torneios da carreira (as que têm jogadores). */
const matchPath = (c: string, m: {tid: string; key: string}) => `careers/${code(c)}/matches/${encodeURIComponent(`${m.tid}_${m.key}`)}`;

export const cloudMatches = {
  put: (c: string, m: MatchResult) => putDoc(matchPath(c, m), m),
  /** Partida entre bots: quem simular primeiro grava, os outros usam o mesmo resultado. */
  createOnce: (c: string, m: MatchResult) => createOnce(matchPath(c, m), m),
  list: async (c: string, tid: string) => (await listDocs<MatchResult>(`careers/${code(c)}/matches`)).filter(m => m.tid === tid),
};

/** Chave do torneio da carreira: montada pelo primeiro jogador que chega e igual para todos. */
export interface SharedTourDoc {
  region?: string;
  entrants: Entrant[];
}

/** Mundo da temporada (os bots) em cada ronda: o primeiro a chegar grava, os outros usam o mesmo. */
export const cloudWorld = {
  createOnce: (c: string, season: number, wave: number, w: World) => createOnce(`careers/${code(c)}/world/s${season}-w${wave}`, w),
};

export const cloudTours = {
  createOnce: (c: string, tid: string, doc: SharedTourDoc) => createOnce(`careers/${code(c)}/tours/${encodeURIComponent(tid)}`, doc),
};
