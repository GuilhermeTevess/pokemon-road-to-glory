// Onde a carreira fica salva: Firestore (pela API REST, sem SDK) ou, para testes, o próprio navegador.
// Cada documento guarda um único campo `json` com o objeto inteiro.
import {FIREBASE} from '../data/firebase';
import type {CareerDoc, PlayerDoc} from './career';
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

type Doc = {name?: string; fields?: {json?: {stringValue?: string}}};

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
  const res = await fetch(`${BASE()}/${path}?${KEY()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  return parse<T>(await res.json());
}

async function putDoc(path: string, value: unknown): Promise<void> {
  const body: Doc = {fields: {json: {stringValue: JSON.stringify(value)}}};
  if (localMode()) {
    localStorage.setItem(`rtg-fakecloud/${path}`, JSON.stringify(body));
    return;
  }
  const res = await fetch(`${BASE()}/${path}?${KEY()}`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
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
  const body: Doc = {fields: {json: {stringValue: JSON.stringify(value)}}};
  const res = await fetch(`${BASE()}/${path}?currentDocument.exists=false&${KEY()}`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  if (res.ok) return value;
  if (res.status === 409 || res.status === 400) {
    const existing = await getDoc<T>(path);
    if (existing) return existing;
  }
  throw new Error(`Firestore ${res.status}`);
}

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
    const res = await fetch(`${BASE()}/${path}?pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ''}&${KEY()}`);
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
  players: (c: string) => listDocs<PlayerDoc>(`careers/${code(c)}/players`),
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
