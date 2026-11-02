// Histórico da batalha e estágios de atributo, montados a partir dos eventos da UI.
// Só usa o que aparece na tela para os dois jogadores (golpes usados, quem entrou,
// quem desmaiou, +2 de Ataque...). Nada de item, habilidade, nature ou golpes não usados.
import type {BattleEvent, Side} from './battle';

export const BOOST_STATS = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'] as const;
export type BoostStat = (typeof BOOST_STATS)[number];
export type Boosts = Partial<Record<BoostStat, number>>;

/** Nome curto (para os selinhos) e completo de cada atributo. */
export const BOOST_LABEL: Record<BoostStat, {short: string; full: string}> = {
  atk: {short: 'Atq', full: 'Ataque'},
  def: {short: 'Def', full: 'Defesa'},
  spa: {short: 'AtqE', full: 'Ataque Especial'},
  spd: {short: 'DefE', full: 'Defesa Especial'},
  spe: {short: 'Vel', full: 'Velocidade'},
  accuracy: {short: 'Prec', full: 'Precisão'},
  evasion: {short: 'Eva', full: 'Evasão'},
};

/** Quanto o estágio multiplica o atributo (regra oficial). Precisão e Evasão usam outra escala. */
export function boostMultiplier(stat: BoostStat, stage: number): number {
  const base = stat === 'accuracy' || stat === 'evasion' ? 3 : 2;
  return stage >= 0 ? (base + stage) / base : base / (base - stage);
}

/** "x2", "x0,67"... */
export function multiplierText(m: number): string {
  return `x${(Math.round(m * 100) / 100).toString().replace('.', ',')}`;
}

export type LogEntry =
  | {kind: 'move'; turn: number; side: Side; species: string; move: string; results: ('super' | 'resisted' | 'crit' | 'miss' | 'immune' | 'fail')[]}
  | {kind: 'switch'; turn: number; side: Side; species: string}
  | {kind: 'faint'; turn: number; side: Side; species: string}
  | {kind: 'mega'; turn: number; side: Side; species: string}
  | {kind: 'boost'; turn: number; side: Side; species: string; stat: BoostStat; amount: number}
  | {kind: 'clear'; turn: number; side?: Side; species?: string};

const isStat = (s: string): s is BoostStat => (BOOST_STATS as readonly string[]).includes(s);
const clamp = (n: number) => Math.max(-6, Math.min(6, n));

/** Acompanha a batalha evento a evento. A UI chama `push` no mesmo ritmo em que mostra cada evento. */
export class BattleTracker {
  turn = 0;
  entries: LogEntry[] = [];
  /** Quem está em campo em cada posição. */
  field: Record<Side, (string | null)[]> = {p1: [], p2: []};
  /** Estágios de quem está em campo em cada posição. */
  boosts: Record<Side, Boosts[]> = {p1: [], p2: []};

  speciesAt(side: Side, slot = 0): string | null {
    return this.field[side][slot] ?? null;
  }

  boostsAt(side: Side, slot = 0): Boosts {
    return this.boosts[side][slot] ?? {};
  }

  push(ev: BattleEvent): void {
    const slot = ev.slot ?? 0;
    if (ev.turn != null) this.turn = ev.turn;
    if (ev.switchIn) {
      const s = ev.switchIn;
      this.field[s.side][slot] = s.species;
      this.boosts[s.side][slot] = {};
      this.entries.push({kind: 'switch', turn: this.turn, side: s.side, species: s.species});
    }
    if (ev.forme) {
      const f = ev.forme;
      this.field[f.side][slot] = f.species;
      if (/-Mega/.test(f.species)) this.entries.push({kind: 'mega', turn: this.turn, side: f.side, species: f.species});
    }
    if (ev.move) {
      const m = ev.move;
      this.entries.push({kind: 'move', turn: this.turn, side: m.side, species: this.speciesAt(m.side, slot) ?? '?', move: m.move, results: []});
    }
    const last = this.lastMove();
    if (ev.hit && ev.hit.effect !== 'normal' && last && !last.results.includes(ev.hit.effect)) last.results.push(ev.hit.effect);
    if (ev.outcome && last && !last.results.includes(ev.outcome)) last.results.push(ev.outcome);
    if (ev.boost && isStat(ev.boost.stat)) {
      const b = ev.boost;
      const stat = b.stat as BoostStat;
      const cur = this.boosts[b.side][slot] ?? {};
      const before = cur[stat] ?? 0;
      const after = clamp(b.set ?? before + (b.amount ?? 0));
      this.boosts[b.side][slot] = {...cur, [stat]: after};
      if (after !== before) this.entries.push({kind: 'boost', turn: this.turn, side: b.side, species: this.speciesAt(b.side, slot) ?? '?', stat, amount: after - before});
    }
    if (ev.clearBoosts) {
      const side = ev.clearBoosts.side;
      for (const s of side ? [side] : (['p1', 'p2'] as Side[])) {
        if (side) this.boosts[s][slot] = {};
        else this.boosts[s] = this.boosts[s].map(() => ({}));
      }
      this.entries.push({kind: 'clear', turn: this.turn, side, species: side ? this.speciesAt(side, slot) ?? undefined : undefined});
    }
    if (ev.boostSync) {
      for (const s of ev.boostSync) {
        const clean: Boosts = {};
        for (const [k, v] of Object.entries(s.boosts)) if (isStat(k) && v) clean[k] = clamp(v);
        this.boosts[s.side][s.slot] = clean;
      }
    }
    if (ev.faint) {
      const sp = this.speciesAt(ev.faint, slot);
      this.entries.push({kind: 'faint', turn: this.turn, side: ev.faint, species: sp ?? '?'});
      this.boosts[ev.faint][slot] = {};
    }
  }

  private lastMove(): Extract<LogEntry, {kind: 'move'}> | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      if (e.kind === 'move') return e;
      if (e.kind === 'switch' || e.kind === 'faint') return undefined;
    }
    return undefined;
  }

  /** As entradas agrupadas por rodada, na ordem. */
  byTurn(): {turn: number; entries: LogEntry[]}[] {
    const out: {turn: number; entries: LogEntry[]}[] = [];
    for (const e of this.entries) {
      const g = out[out.length - 1];
      if (g && g.turn === e.turn) g.entries.push(e);
      else out.push({turn: e.turn, entries: [e]});
    }
    return out;
  }
}
