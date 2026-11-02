// Resumo de uma partida para o histórico: quem desmaiou, em que rodada, por quem e com qual golpe.
// Lido do log do Showdown no fim da batalha. Fica curto de propósito (no máximo um registro por
// Pokémon desmaiado) porque vai junto com o histórico para a lista de jogadores online.

/** Um nocaute. `side` é de quem desmaiou: 0 = o dono do histórico, 1 = o adversário. */
export interface Ko {
  /** Rodada (turno) em que aconteceu. */
  r: number;
  side: 0 | 1;
  /** Espécie de quem desmaiou (a forma de antes da Mega, para casar com o time). */
  mon: string;
  /** Quem acertou (se foi um golpe do outro lado). */
  by?: string;
  /** Golpe que nocauteou (ou que o próprio usou, tipo Explosion). */
  move?: string;
  /** Outra causa: veneno, queimadura, tempestade de areia, recuo... */
  why?: string;
}

export const KO_KEEP = 12;

const WHY: Record<string, string> = {
  psn: 'veneno',
  tox: 'veneno',
  brn: 'queimadura',
  recoil: 'dano de recuo',
  sandstorm: 'tempestade de areia',
  hail: 'granizo',
  snow: 'neve',
  confusion: 'confusão',
  'leech seed': 'Leech Seed',
  curse: 'maldição',
  nightmare: 'pesadelo',
  'stealth rock': 'Stealth Rock',
  spikes: 'Spikes',
  'life orb': 'Life Orb',
  'rocky helmet': 'Rocky Helmet',
  'rough skin': 'Rough Skin',
  'iron barbs': 'Iron Barbs',
  'destiny bond': 'Destiny Bond',
  'perish song': 'Perish Song',
  struggle: 'Struggle',
};

/** "[from] item: Life Orb" → "Life Orb"; "[from] psn" → "veneno". */
function causeOf(from: string): string {
  const raw = from
    .replace(/^\[from\]\s*/, '')
    .replace(/^(item|ability|move):\s*/i, '')
    .trim();
  return WHY[raw.toLowerCase()] ?? raw;
}

/**
 * Nocautes de uma batalha, do ponto de vista de `me` (o lado do dono do histórico).
 * Funciona em simples e em duplas (p1a/p1b), com apelidos e com Mega Evolução.
 */
export function koFromLog(log: readonly string[], me: 'p1' | 'p2' = 'p1'): Ko[] {
  // "p1: Apelido" → espécie (a primeira vez que entrou em campo).
  const speciesOf = new Map<string, string>();
  const key = (ident: string) => ident.replace(/^(p\d)[a-z]?:\s*/, '$1: ');
  const sideOf = (ident: string) => ident.slice(0, 2);
  const mon = (ident: string) => speciesOf.get(key(ident)) ?? ident.replace(/^p\d[a-z]?:\s*/, '');
  const out: Ko[] = [];
  let turn = 0;
  let mover: {ident: string; move: string} | null = null;
  /** Último dano que cada um levou (para saber quem nocauteou). */
  const lastHit = new Map<string, {by?: string; move?: string; why?: string; self?: boolean}>();

  for (const line of log) {
    const p = line.split('|');
    const kind = p[1];
    if (kind === 'turn') {
      turn = Number(p[2]) || turn;
      lastHit.clear();
    }
    else if (kind === 'switch' || kind === 'drag' || kind === 'replace') {
      const k = key(p[2]);
      if (!speciesOf.has(k)) speciesOf.set(k, (p[3] ?? '').split(',')[0].trim() || mon(p[2]));
    } else if (kind === 'move') {
      // "Ação do Treinador" é coisa do jogo (itens), não um golpe.
      mover = p[3] && p[3] !== 'Ação do Treinador' ? {ident: p[2], move: p[3]} : null;
      if (mover) lastHit.delete(key(mover.ident));
    } else if (kind === '-damage') {
      const k = key(p[2]);
      const from = p.slice(4).find(x => x.startsWith('[from]'));
      if (from) lastHit.set(k, {why: causeOf(from)});
      else if (mover) {
        const self = key(mover.ident) === k;
        lastHit.set(k, self ? {move: mover.move, self} : {by: mon(mover.ident), move: mover.move});
      }
    } else if (kind === 'faint') {
      const k = key(p[2]);
      const hit = lastHit.get(k);
      // Explosion, Memento, Final Gambit: caiu pelo próprio golpe (sem dano registrado).
      const own: {by?: string; move?: string; why?: string} | undefined = !hit && mover && key(mover.ident) === k ? {move: mover.move} : undefined;
      const ko: Ko = {r: Math.max(1, turn), side: sideOf(p[2]) === me ? 0 : 1, mon: mon(p[2])};
      const info = hit ?? own;
      if (info?.by) ko.by = info.by;
      if (info?.move) ko.move = info.move;
      if (info?.why) ko.why = info.why;
      out.push(ko);
      lastHit.delete(k);
      if (out.length >= KO_KEEP) break;
    }
  }
  return out;
}

/** O mesmo resumo visto pelo outro lado. */
export const flipKo = (ko: Ko[] | undefined): Ko[] | undefined => ko?.map(k => ({...k, side: (1 - k.side) as 0 | 1}));

/** Limpa um resumo que veio da rede ou do banco. */
export function saneKo(x: unknown): Ko[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const s = (v: unknown, max = 40) => (typeof v === 'string' && v ? v.slice(0, max) : undefined);
  const out: Ko[] = [];
  for (const k of x.slice(0, KO_KEEP) as Partial<Ko>[]) {
    const mon = s(k?.mon);
    if (!mon || (k.side !== 0 && k.side !== 1)) continue;
    const r = typeof k.r === 'number' && Number.isFinite(k.r) ? Math.min(999, Math.max(1, Math.floor(k.r))) : 1;
    const ko: Ko = {r, side: k.side, mon};
    const by = s(k.by);
    const move = s(k.move);
    const why = s(k.why);
    if (by) ko.by = by;
    if (move) ko.move = move;
    if (why) ko.why = why;
    out.push(ko);
  }
  return out;
}

/**
 * Marca quem desmaiou num time (lista de espécies). Casa pela espécie, um por um,
 * para funcionar até com dois Pokémon iguais no time.
 */
export function faintedMask(team: readonly string[], ko: Ko[] | undefined, side: 0 | 1): boolean[] {
  const left = (ko ?? []).filter(k => k.side === side).map(k => norm(k.mon));
  return team.map(s => {
    const i = left.indexOf(norm(s));
    if (i < 0) return false;
    left.splice(i, 1);
    return true;
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
