// Pontos e elos online: cada partida contra outra pessoa (Rush online, campeonato rápido online,
// Dream Team online e carreira contra amigos) dá ou tira pontos no modo dela. O ranking geral
// é a soma dos modos. Ganhar com o time inteiro de pé vale mais que ganhar por um fio.
// Partidas contra o computador (e a carreira contra o jogo) não contam.

export type RankKey = 'rush' | 'qtour' | 'built' | 'pvp';

export const RANK_MODES: {key: RankKey; label: string; short: string; icon: string}[] = [
  {key: 'rush', label: 'Rush online', short: 'Rush', icon: 'bolt'},
  {key: 'qtour', label: 'Campeonato online', short: 'Campeonato', icon: 'bracket'},
  {key: 'built', label: 'Dream Team online', short: 'Dream Team', icon: 'ball'},
  {key: 'pvp', label: 'Carreira · amigos', short: 'Carreira', icon: 'people'},
];

export const RANK_KEYS = RANK_MODES.map(m => m.key);

/** Modo do histórico → modo do ranking (ou null se não conta pontos). */
export function rankKeyOf(mode: string): RankKey | null {
  if (mode.startsWith('online-rush:')) return 'rush';
  if (mode === 'qtour-online') return 'qtour';
  if (mode === 'online-built') return 'built';
  if (mode === 'career-pvp') return 'pvp';
  return null;
}

/** Como um lado terminou a batalha. */
export interface SideScore {
  /** Pokémon de pé no fim. */
  alive: number;
  /** Tamanho do time. */
  size: number;
  /** Vida que sobrou no time inteiro (0 a 1). */
  hp: number;
}

export interface MatchScore {
  mine: SideScore;
  theirs: SideScore;
}

/** Placar de um lado a partir dos Pokémon da batalha (vida atual e máxima). */
export function sideScore(mons: {hp: number; maxhp: number; fainted?: boolean}[]): SideScore {
  const max = mons.reduce((a, p) => a + Math.max(0, p.maxhp), 0);
  const left = mons.reduce((a, p) => a + (p.fainted ? 0 : Math.max(0, p.hp)), 0);
  return {alive: mons.filter(p => !p.fainted && p.hp > 0).length, size: mons.length, hp: max ? left / max : 0};
}

export function isScore(x: unknown): x is MatchScore {
  const ok = (s: unknown) => {
    const v = s as SideScore | null;
    return !!v && [v.alive, v.size, v.hp].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) && v.size >= 1 && v.size <= 6 && v.alive <= v.size && v.hp <= 1;
  };
  const m = x as MatchScore | null;
  return !!m && ok(m.mine) && ok(m.theirs);
}

/** O placar visto pelo outro lado. */
export const flipScore = (s: MatchScore): MatchScore => ({mine: s.theirs, theirs: s.mine});

/** Maior ganho de uma partida (o banco recusa mais que isso de uma vez). */
export const MAX_GAIN = 50;
/** Abaixo disso (Bronze), derrota não tira ponto: quem está começando não fica no negativo. */
export const SAFE_ZONE = 100;

/**
 * Pontos de uma partida.
 * Vitória: 20 + até 20 pelos Pokémon de pé + até 10 pela vida que sobrou (6 de pé e vida cheia = 50;
 * 1 de pé com pouca vida ≈ 24). Adversário saiu no meio: 15.
 * Derrota: −10, mas cada Pokémon que você derrubou devolve um pouco (perder por pouco custa ≈ −3).
 * Saiu no meio: −10.
 */
export function matchPoints(won: boolean, score?: MatchScore | null, quit?: 'me' | 'foe'): number {
  if (won) {
    if (quit === 'foe' || !score) return 15;
    const {alive, size, hp} = score.mine;
    return Math.min(MAX_GAIN, 20 + Math.round((20 * alive) / size) + Math.round(10 * hp));
  }
  if (quit === 'me' || !score) return -10;
  const kos = score.theirs.size - score.theirs.alive;
  return -Math.max(2, 10 - Math.round((8 * kos) / score.theirs.size));
}

/** Aplica os pontos: no Bronze a derrota não tira, e ninguém fica abaixo de zero. */
export function applyPoints(current: number, delta: number): number {
  if (delta < 0 && current < SAFE_ZONE) return current;
  return Math.max(0, current + delta);
}

export type Points = Partial<Record<RankKey, number>>;

/** Ranking geral: soma dos modos. */
export const totalPoints = (p: Points | undefined): number => RANK_KEYS.reduce((a, k) => a + (p?.[k] ?? 0), 0);

// ------------------------------------------------------------------ Elos

export interface Elo {
  id: 'bronze' | 'prata' | 'ouro' | 'platina' | 'diamante' | 'mestre';
  name: string;
  /** Pontos para entrar (num modo; no geral é o dobro). */
  min: number;
  color: string;
  dark: string;
  light: string;
}

export const ELOS: Elo[] = [
  {id: 'bronze', name: 'Bronze', min: 0, color: '#c07a3e', dark: '#6e3f1a', light: '#e8a96a'},
  {id: 'prata', name: 'Prata', min: 100, color: '#aeb8c4', dark: '#5d6773', light: '#e4ebf2'},
  {id: 'ouro', name: 'Ouro', min: 250, color: '#e6b422', dark: '#8a6510', light: '#ffe27a'},
  {id: 'platina', name: 'Platina', min: 450, color: '#4fc2b0', dark: '#1f6e62', light: '#a6efe2'},
  {id: 'diamante', name: 'Diamante', min: 700, color: '#5b8ff0', dark: '#23408a', light: '#b5d0ff'},
  {id: 'mestre', name: 'Mestre', min: 1000, color: '#a45ee0', dark: '#552682', light: '#dcb4ff'},
];

/** O geral soma vários modos, então pede o dobro. */
export const GENERAL_MULT = 2;

/** Elo de uma pontuação, e quanto falta para o próximo. */
export function eloOf(pts: number, general = false): {elo: Elo; next: Elo | null; toNext: number; progress: number} {
  const mult = general ? GENERAL_MULT : 1;
  let i = 0;
  while (i + 1 < ELOS.length && pts >= ELOS[i + 1].min * mult) i++;
  const elo = ELOS[i];
  const next = ELOS[i + 1] ?? null;
  if (!next) return {elo, next, toNext: 0, progress: 1};
  const from = elo.min * mult;
  const to = next.min * mult;
  return {elo, next, toNext: to - pts, progress: (pts - from) / (to - from)};
}

// ------------------------------------------------------------------ Envio para a nuvem

/** Pontos guardados no banco (campos que as regras conseguem conferir). */
export interface CloudScore {
  pts: Record<RankKey, number>;
  /** Partidas que já contaram pontos. */
  n: number;
  /** Quando gravou (ms). As regras exigem 1 minuto entre gravações que sobem pontos. */
  t: number;
}

export const emptyScore = (): CloudScore => ({pts: {rush: 0, qtour: 0, built: 0, pvp: 0}, n: 0, t: 0});

/** Intervalo mínimo entre duas gravações que sobem pontos (as regras do banco cobram o mesmo). */
export const RAISE_GAP = 60_000;

/**
 * O que mandar agora: chega perto dos seus pontos sem subir mais de MAX_GAIN por modo de uma vez
 * (se ganhou duas seguidas rapidinho, a segunda vai na próxima gravação). `more` = ainda falta mandar.
 */
export function nextCloudScore(local: Points, sent: CloudScore, now: number): {score: CloudScore; more: boolean; raises: boolean} {
  const pts = {...sent.pts};
  let raises = false;
  let more = false;
  const canRaise = now - sent.t >= RAISE_GAP;
  for (const k of RANK_KEYS) {
    const want = Math.max(0, Math.floor(local[k] ?? 0));
    if (want <= sent.pts[k]) pts[k] = want;
    else if (canRaise) {
      pts[k] = Math.min(want, sent.pts[k] + MAX_GAIN);
      raises = true;
      if (pts[k] < want) more = true;
    } else more = true;
  }
  return {score: {pts, n: raises ? sent.n + 1 : sent.n, t: raises ? now : sent.t}, more, raises};
}
