// Onde a carreira fica salva: Firestore (pela API REST, sem SDK) ou, para testes, o próprio navegador.
// Cada documento guarda um único campo `json` com o objeto inteiro.
import {FIREBASE} from '../data/firebase';
import type {CareerDoc, PlayerDoc} from './career';

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
  const res = await fetch(`${BASE()}/${path}?pageSize=100&${KEY()}`);
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const data = (await res.json()) as {documents?: Doc[]};
  return (data.documents ?? []).map(d => parse<T>(d)).filter((x): x is T => !!x);
}

const code = (c: string) => encodeURIComponent(c.toUpperCase());

export const cloud = {
  getCareer: (c: string) => getDoc<CareerDoc>(`careers/${code(c)}`),
  putCareer: (doc: CareerDoc) => putDoc(`careers/${code(doc.code)}`, doc),
  players: (c: string) => listDocs<PlayerDoc>(`careers/${code(c)}/players`),
  putPlayer: (c: string, p: PlayerDoc) => putDoc(`careers/${code(c)}/players/${encodeURIComponent(p.id)}`, p),
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
