// Ponte entre o jogo e o simulador do Pokémon Showdown (@pkmn/sim).
// O simulador roda inteiro no navegador; aqui montamos a batalha, escolhemos as
// ações do Pokémon selvagem e traduzimos o log do Showdown para eventos da UI.
import {Battle} from '@pkmn/sim';
import type {Pokemon} from '@pkmn/sim';
import {dex, species, typeMultiplier} from '../data/dex';
import {getItem} from '../data/items';
import {maxHp, toSet} from './mon';
import {chance} from './rng';
import {withNarration} from './narration';
import type {Encounter, OwnedMon} from './types';

/**
 * Golpe invisível usado para "gastar" o turno quando o jogador usa uma pokébola
 * ou um item: o Showdown não tem essas ações em batalhas selvagens.
 */
const ACTION_MOVE = 'rtgtraineraction';
const ACTION_NAME = 'Ação do Treinador';
(dex.data.Moves as Record<string, unknown>)[ACTION_MOVE] = {
  num: -9001,
  accuracy: true,
  basePower: 0,
  category: 'Status',
  name: ACTION_NAME,
  pp: 64,
  priority: 7,
  flags: {},
  target: 'self',
  type: '???',
  onTry() {
    return null;
  },
};

export type Side = 'p1' | 'p2';

export interface BattleEvent {
  text?: string;
  /** Posição em campo (0 ou 1, só muda em batalhas em dupla). */
  slot?: number;
  /** Atualização de HP de quem está em campo. */
  hp?: {side: Side; hp: number; maxhp: number; status?: string};
  switchIn?: {side: Side; species: string; hp: number; maxhp: number; uid?: string; level?: number; shiny?: boolean};
  faint?: Side;
  /** Golpe usado (para animação e som). */
  move?: {side: Side; move: string};
  hit?: {side: Side; effect: 'normal' | 'super' | 'resisted' | 'crit'};
  /** Mudou de forma (mega evolução). */
  forme?: {side: Side; species: string};
  /** Fala do narrador (torneios). */
  narrator?: boolean;
}

export interface MoveOption {
  index: number;
  id: string;
  name: string;
  type: string;
  category: string;
  basePower: number;
  pp: number;
  maxpp: number;
  disabled: boolean;
  /** Multiplicador de tipo contra o selvagem em campo (null para golpes de status). */
  effectiveness: number | null;
  /** Em dupla: o golpe pede para escolher qual selvagem atacar. */
  needsTarget?: boolean;
}

/** Alvo possível de um golpe em batalha dupla. */
export interface TargetOption {
  loc: number;
  name: string;
  species: string;
  effectiveness: number | null;
}

export const STATUS_PT: Record<string, string> = {
  brn: 'QUE', par: 'PAR', slp: 'DOR', frz: 'CON', psn: 'ENV', tox: 'ENV+',
};

const BOOST_PT: Record<string, string> = {
  atk: 'O Ataque', def: 'A Defesa', spa: 'O Ataque Especial', spd: 'A Defesa Especial',
  spe: 'A Velocidade', accuracy: 'A Precisão', evasion: 'A Evasão',
};

const STATUS_TEXT: Record<string, string> = {
  brn: 'foi queimado', par: 'foi paralisado', slp: 'adormeceu', frz: 'foi congelado',
  psn: 'foi envenenado', tox: 'foi gravemente envenenado',
};

const CANT_TEXT: Record<string, string> = {
  par: 'está paralisado e não consegue se mover', slp: 'está dormindo', frz: 'está congelado',
  flinch: 'recuou e não atacou', recharge: 'precisa recarregar', nopp: 'não tem PP',
};

const WEATHER_TEXT: Record<string, string> = {
  RainDance: 'Começou a chover!', SunnyDay: 'O sol ficou forte!', Sandstorm: 'Uma tempestade de areia começou!',
  Snowscape: 'Começou a nevar!', Hail: 'Começou a cair granizo!', none: 'O clima voltou ao normal.',
};

export interface CatchResult {
  caught: boolean;
  shakes: number;
}

/** Chances dos buffs de amizade. */
const FRIEND_ENDURE = 0.15;
const FRIEND_CURE = 0.2;

const RARITY_CATCH: Record<string, number> = {common: 0.6, uncommon: 0.45, rare: 0.3, superRare: 0.15, legendary: 0.06};

export class BattleController {
  readonly battle: Battle;
  readonly encounter: Encounter;
  /** Pokémon do jogador que entraram em campo (recebem XP). */
  readonly participants = new Set<string>();
  private readonly uidOf = new Map<Pokemon, string>();
  private cursor = 0;
  /** Batalha em dupla (2 contra 2). */
  readonly doubles: boolean;
  /** Em dupla: escolhas já feitas neste turno (uma por Pokémon em campo). */
  private pending: string[] = [];
  /** Qual Pokémon do oponente foi capturado (índice no time, para a dupla). */
  caughtIndex = 0;

  /** `hearts`: corações de amizade de cada Pokémon do jogador (por uid). */
  /** `catchBonus`: multiplicador de captura das melhorias (Mão boa). */
  constructor(party: OwnedMon[], encounter: Encounter, hearts: Record<string, number> = {}, private readonly catchBonus = 1) {
    this.encounter = encounter;
    const alive = party.filter(m => m.hp > 0);
    if (!alive.length) throw new Error('Nenhum Pokémon em condições de lutar');
    this.doubles = !!encounter.double;
    this.battle = new Battle({formatid: (this.doubles ? 'gen9doublescustomgame' : 'gen9customgame') as never});
    this.battle.setPlayer('p1', {name: 'Você', team: alive.map(toSet)});
    this.battle.p1.pokemon.forEach((p, i) => {
      this.uidOf.set(p, alive[i].uid);
      p.sethp(alive[i].hp);
      p.m.hearts = hearts[alive[i].uid] ?? 0;
    });
    this.addFriendship();
    this.battle.setPlayer('p2', {name: encounter.trainer ?? 'Selvagem', team: (encounter.team ?? [encounter.mon]).map(toSet)});
    if (this.battle.p1.requestState === 'teampreview') {
      this.battle.choose('p1', 'default');
      this.battle.choose('p2', 'default');
    }
    this.markParticipant();
  }

  // ------------------------------------------------------------ Estado

  get ended(): boolean {
    return this.battle.ended;
  }

  get won(): boolean {
    return this.battle.ended && this.battle.winner === 'Você';
  }

  /** Posições do jogador que precisam de uma escolha neste turno. */
  private slotsToChoose(): number[] {
    const side = this.battle.p1;
    if (side.requestState === 'switch') return side.active.map((p, i) => (p?.switchFlag ? i : -1)).filter(i => i >= 0);
    return side.active.map((p, i) => (p && !p.fainted ? i : -1)).filter(i => i >= 0);
  }

  /** Posição em campo que está escolhendo agora (0 em batalhas simples). */
  get slot(): number {
    return this.slotsToChoose()[this.pending.length] ?? 0;
  }

  /** Já escolheu a ação de algum Pokémon neste turno (dupla). */
  get hasPending(): boolean {
    return this.pending.length > 0;
  }

  get playerActive(): Pokemon | undefined {
    return this.battle.p1.active[this.slot] ?? this.battle.p1.active[0];
  }

  /** Pokémon do oponente em campo (selvagem ou do treinador). Em dupla, o primeiro de pé. */
  get wildActive(): Pokemon {
    const b = this.battle.p2;
    return b.active.find(p => p && !p.fainted) ?? b.active[0] ?? b.pokemon[0];
  }

  /** Selvagens de pé em campo (dupla). */
  foesUp(): Pokemon[] {
    return this.battle.p2.active.filter(p => p && !p.fainted);
  }

  /** Quantos Pokémon o oponente ainda tem de pé (para as bolinhas do treinador). */
  foeStatus(): boolean[] {
    return this.battle.p2.pokemon.map(p => !p.fainted);
  }

  get mustSwitch(): boolean {
    return this.battle.p1.requestState === 'switch';
  }

  activeUid(): string | undefined {
    const p = this.playerActive;
    return p ? this.uidOf.get(p) : undefined;
  }

  canSwitch(): boolean {
    const req = this.battle.p1.activeRequest as {active?: {trapped?: boolean}[]} | null;
    return this.mustSwitch || !req?.active?.[this.slot]?.trapped;
  }

  moveOptions(): MoveOption[] {
    const req = this.battle.p1.activeRequest as {active?: {moves: {id: string; pp?: number; maxpp?: number; disabled?: boolean}[]}[]} | null;
    const moves = req?.active?.[this.slot]?.moves ?? [];
    const target = this.wildActive;
    const foes = this.doubles ? this.foesUp() : [target];
    return moves
      .map((m, i) => {
        const data = dex.moves.get(m.id);
        const user = this.playerActive;
        const type = user ? this.battle.dex.moves.get(m.id).type : data.type;
        return {
          index: i + 1,
          id: data.id,
          name: data.name,
          type,
          category: data.category,
          basePower: data.basePower,
          pp: m.pp ?? 0,
          maxpp: m.maxpp ?? 0,
          disabled: !!m.disabled,
          effectiveness: data.category === 'Status' ? null : Math.max(...foes.map(f => typeMultiplier(type, f.getTypes()))),
          needsTarget: this.doubles && ['normal', 'any', 'adjacentFoe'].includes(this.battle.dex.moves.get(m.id).target) && foes.length > 1,
        };
      })
      .filter(m => m.id !== ACTION_MOVE);
  }

  // ------------------------------------------------------------ Ações

  /** Com `mega`, o Pokémon mega-evolui antes de atacar (se puder). Em dupla, `target` é o selvagem (1 ou 2). */
  chooseMove(index: number, mega = false, target?: number): BattleEvent[] {
    if (!this.doubles) return this.commit(`move ${index}`, mega);
    return this.queue(`move ${index}${this.targetFor(index, target)}${mega && this.canMega() ? ' mega' : ''}`);
  }

  /** Alvos possíveis (selvagens de pé) para o golpe, com a eficácia contra cada um. */
  targetOptions(index: number): TargetOption[] {
    const req = this.battle.p1.activeRequest as {active?: {moves: {id: string}[]}[]} | null;
    const id = req?.active?.[this.slot]?.moves?.[index - 1]?.id ?? '';
    const move = this.battle.dex.moves.get(id);
    return this.battle.p2.active
      .map((p, i) => ({p, i}))
      .filter(({p}) => p && !p.fainted)
      .map(({p, i}) => ({
        loc: i + 1, name: p.name, species: p.species.name,
        effectiveness: move.category === 'Status' ? null : typeMultiplier(move.type, p.getTypes()),
      }));
  }

  /** Volta a escolha do Pokémon anterior (dupla). */
  undoChoice(): void {
    this.pending.pop();
  }

  /** Sufixo de alvo da escolha em dupla. */
  private targetFor(index: number, target?: number): string {
    const req = this.battle.p1.activeRequest as {active?: {moves: {id: string}[]}[]} | null;
    const id = req?.active?.[this.slot]?.moves?.[index - 1]?.id ?? '';
    const kind = this.battle.dex.moves.get(id).target;
    if (kind === 'adjacentAlly') return ` -${2 - this.slot}`;
    if (kind === 'adjacentAllyOrSelf') return ` -${this.slot + 1}`;
    if (!this.battle.actions.targetTypeChoices(kind)) return '';
    const up = this.targetOptions(index);
    const loc = up.find(t => t.loc === target)?.loc ?? up[0]?.loc ?? 1;
    return ` ${loc}`;
  }

  /** Dupla: guarda a escolha deste Pokémon e só roda o turno quando todos escolheram. */
  private queue(choice: string): BattleEvent[] {
    this.pending.push(choice);
    if (this.pending.length < this.slotsToChoose().length) return [];
    const all = this.pending.join(', ');
    this.pending = [];
    return this.commit(all);
  }

  /** Nome da forma mega, se o Pokémon em campo pode mega-evoluir agora. */
  canMega(): string | null {
    const f = this.playerActive?.canMegaEvo;
    return typeof f === 'string' ? f : null;
  }

  chooseSwitch(uid: string): BattleEvent[] {
    const idx = this.battle.p1.pokemon.findIndex(p => this.uidOf.get(p) === uid);
    if (idx < 0) return [];
    if (this.doubles) {
      // Não deixa o mesmo Pokémon entrar em duas posições.
      if (this.pending.includes(`switch ${idx + 1}`)) return [];
      const events = this.queue(`switch ${idx + 1}`);
      this.markParticipant();
      return events;
    }
    const events = this.commit(`switch ${idx + 1}`);
    this.markParticipant();
    return events;
  }

  /** Tenta capturar. Se falhar, o turno é gasto e o selvagem ataca. */
  throwBall(ballId: string): {result: CatchResult; events: BattleEvent[]} {
    const ball = getItem(ballId);
    const wild = this.wildActive;
    this.caughtIndex = this.battle.p2.pokemon.indexOf(wild);
    const intro: BattleEvent[] = [{text: `Você jogou uma ${ball.name}!`}];
    let p: number;
    if ((ball.power ?? 1) >= 255) p = 1;
    else {
      const base = RARITY_CATCH[this.encounter.rarity] ?? 0.4;
      const hpFactor = 1 - (2 / 3) * (wild.hp / wild.maxhp);
      const statusBonus = wild.status === 'slp' || wild.status === 'frz' ? 2 : wild.status ? 1.5 : 1;
      p = base * (ball.power ?? 1) * hpFactor * 1.5 * statusBonus * (this.encounter.boss ? 0.5 : 1) * this.catchBonus;
    }
    p = Math.min(1, p);
    // Cada "balançada" passa com p^(1/4), igual aos jogos.
    let shakes = 0;
    const shakeP = Math.pow(p, 1 / 4);
    while (shakes < 4 && chance(shakeP)) shakes++;
    const caught = shakes >= 4;
    if (caught) {
      this.battle.ended = true;
      return {result: {caught, shakes: 3}, events: [...intro, {text: `Gotcha! ${wild.name} foi capturado!`}]};
    }
    const msg = ['Ah não! Ele escapou!', 'Quase! Ele escapou!', 'Por pouco! Ele escapou!', 'Droga! Estava tão perto!'][shakes];
    return {result: {caught, shakes}, events: [...intro, {text: msg}, ...this.spendTurn()]};
  }

  /** Usa uma poção/reviver em um Pokémon e gasta o turno. */
  useHealItem(itemId: string, uid: string): BattleEvent[] {
    const item = getItem(itemId);
    const p = [...this.uidOf.entries()].find(([, u]) => u === uid)?.[0];
    if (!p) return [];
    const events: BattleEvent[] = [];
    if (item.kind === 'revive') {
      if (!p.fainted) return [];
      p.fainted = false;
      p.faintQueued = false;
      p.hp = Math.max(1, Math.floor(p.maxhp * (item.power ?? 0.5)));
      p.status = '' as never;
      events.push({text: `${p.name} foi revivido!`});
    } else {
      if (p.fainted || p.hp >= p.maxhp) return [];
      const amount = item.power === 1 ? p.maxhp : item.power ?? 20;
      p.hp = Math.min(p.maxhp, p.hp + amount);
      events.push({text: `${p.name} recuperou HP com ${item.name}.`});
      if (p.isActive) events.push({hp: {side: 'p1', hp: p.hp, maxhp: p.maxhp, status: p.status}});
    }
    return [...events, ...this.spendTurn()];
  }

  /** Itens X: +2 estágios no atributo do Pokémon ativo, gastando o turno. */
  useBoostItem(itemId: string): BattleEvent[] {
    const item = getItem(itemId);
    const p = this.playerActive;
    if (!p || p.fainted || !item.stat) return [];
    const cur = p.boosts[item.stat];
    if (cur >= 6) return [{text: `O atributo de ${p.name} já está no máximo.`}];
    p.boosts[item.stat] = Math.min(6, cur + 2);
    const label: Record<string, string> = {atk: 'Ataque', def: 'Defesa', spa: 'Ataque Especial', spd: 'Defesa Especial', spe: 'Velocidade', accuracy: 'Precisão'};
    return [{text: `${item.name}: ${label[item.stat]} de ${p.name} subiu muito!`}, ...this.spendTurn()];
  }

  /** Situação dos Pokémon do jogador dentro da batalha. */
  partyStatus(): {uid: string; species: string; level: number; hp: number; maxhp: number; status: string; active: boolean}[] {
    return [...this.uidOf.entries()].map(([p, uid]) => ({
      uid,
      species: p.species.name,
      level: p.level,
      hp: p.fainted ? 0 : p.hp,
      maxhp: p.maxhp,
      status: p.status,
      active: p.isActive,
    }));
  }

  /** Fugir funciona sempre, exceto contra chefes. */
  canFlee(): boolean {
    return !this.encounter.boss && !this.encounter.trainer;
  }

  /** Copia HP de volta para o time (fora da batalha). */
  syncParty(party: OwnedMon[]): void {
    for (const [p, uid] of this.uidOf) {
      const mon = party.find(m => m.uid === uid);
      if (!mon) continue;
      mon.hp = p.fainted ? 0 : Math.min(p.hp, maxHp(mon));
    }
  }

  /** Eventos iniciais (entradas em campo). */
  /** Quickplay no mesmo PC: a escolha do jogador 2 (golpe ou troca, no formato do simulador). */
  chooseP2(choice: string): BattleEvent[] {
    const b = this.battle;
    if (!b.choose('p2', choice)) b.choose('p2', 'default');
    return this.readLog();
  }

  initialEvents(): BattleEvent[] {
    const intro = (this.encounter.intro ?? []).map(text => ({text, narrator: true}));
    return [...intro, ...this.readLog()];
  }

  // ------------------------------------------------------------ Internos

  private spendTurn(): BattleEvent[] {
    if (this.mustSwitch) return [];
    this.pending = [];
    // Todos os Pokémon do jogador em campo gastam o turno com a "ação do treinador".
    const slots = this.slotsToChoose();
    const actives = slots.map(i => this.battle.p1.active[i]).filter(Boolean);
    if (!actives.length) return [];
    for (const a of actives) {
      a.moveSlots.push({
        move: ACTION_NAME, id: ACTION_MOVE as never, pp: 64, maxpp: 64, target: 'self', disabled: false, used: false,
      } as never);
    }
    this.battle.makeRequest();
    const req = (this.battle.p1.activeRequest as {active?: {moves: {id: string; disabled?: boolean}[]}[]} | null)?.active ?? [];
    const choices = slots.map(i => {
      const opts = req[i]?.moves ?? [];
      const idx = opts.findIndex(m => m.id === ACTION_MOVE);
      return idx >= 0 && !opts[idx].disabled ? `move ${idx + 1}` : null;
    });
    let events: BattleEvent[];
    if (choices.every(Boolean)) {
      events = this.commit(choices.join(', '));
    } else {
      // Preso a um golpe (ex.: Choice Band): o item é usado sem gastar o turno.
      events = this.readLog();
    }
    for (const a of actives) a.moveSlots = a.moveSlots.filter(m => m.id !== ACTION_MOVE);
    if (!this.battle.ended && this.battle.p1.requestState === 'move') this.battle.makeRequest();
    return events;
  }

  private commit(choice: string, mega = false): BattleEvent[] {
    const b = this.battle;
    this.foeSwitch();
    if (!this.encounter.versus && b.p2.requestState === 'move' && !b.p2.isChoiceDone()) b.choose('p2', aiMoveChoice(b, 'p2'));
    // Mega evolução quando o jogador pede (só 1 mega por time, controlado na loja/mochila).
    if (mega && choice.startsWith('move') && this.canMega() && b.choose('p1', `${choice} mega`)) {
      this.foeSwitch();
      this.friendshipCure();
      this.markParticipant();
      return this.readLog();
    }
    if (!b.choose('p1', choice)) {
      // Escolha inválida (ex.: golpe desabilitado): deixa o simulador decidir.
      b.choose('p1', 'default');
    }
    this.foeSwitch();
    this.friendshipCure();
    this.markParticipant();
    return this.readLog();
  }

  /**
   * Buffs de amizade (corações), no estilo dos jogos: aguentar com 1 HP (3+),
   * mais crítico (4+). A cura de status (2+) roda no fim de cada turno, em commit().
   */
  private addFriendship(): void {
    const b = this.battle;
    const hearts = (p: Pokemon | null | undefined) => (p && p.side === b.p1 ? (p.m.hearts as number) || 0 : 0);
    b.onEvent('Damage', b.format, (damage: number, target: Pokemon, _source: Pokemon, effect: {effectType?: string}) => {
      if (effect?.effectType !== 'Move' || hearts(target) < 3 || target.m.endured) return damage;
      if (damage >= target.hp && target.hp > 1 && chance(FRIEND_ENDURE)) {
        target.m.endured = true;
        b.add('-message', `${target.name} aguentou firme pela amizade com você!`);
        return target.hp - 1;
      }
      return damage;
    });
    b.onEvent('ModifyCritRatio', b.format, (ratio: number, source: Pokemon) => (hearts(source) >= 4 ? ratio + 1 : ratio));
  }

  private friendshipCure(): void {
    for (const p of this.battle.p1.active) {
      if (this.battle.ended || !p || p.fainted || !p.status || ((p.m.hearts as number) || 0) < 2) continue;
      if (!chance(FRIEND_CURE)) continue;
      this.battle.add('-message', `${p.name} se esforçou para não deixar você preocupado!`);
      p.cureStatus();
    }
  }

  private markParticipant(): void {
    for (const p of this.battle.p1.active) {
      const uid = p ? this.uidOf.get(p) : undefined;
      if (uid) this.participants.add(uid);
    }
  }

  /** Treinador com o Pokémon em campo desmaiado: manda o próximo (o melhor contra o seu). */
  private foeSwitch(): void {
    const b = this.battle;
    if (this.encounter.versus) return;
    if (!b.ended && b.p2.requestState === 'switch' && !b.p2.isChoiceDone()) b.choose('p2', aiSwitchChoice(b, 'p2'));
  }

  /** Posição em campo a partir do "p2a"/"p2b" do log. */
  private slotOf(ident: string): number {
    return ident[2] === 'b' ? 1 : 0;
  }

  /** Pokémon em campo a partir do "p1a: Nome" do log. */
  private pokeOf(ident: string): Pokemon | undefined {
    const side = this.battle[ident.slice(0, 2) as Side];
    return side?.active[this.slotOf(ident)];
  }

  private name(ident: string): {side: Side; name: string} {
    const side = ident.slice(0, 2) as Side;
    const raw = ident.replace(/^p\d[a-z]?: /, '');
    if (side !== 'p2') return {side, name: this.encounter.versus ? `${raw} de ${this.encounter.versus}` : raw};
    if (this.encounter.trainer) return {side, name: `${raw} de ${this.encounter.trainer}`};
    return {side, name: `${raw} ${this.encounter.boss ? 'chefe' : 'selvagem'}`};
  }

  private readLog(): BattleEvent[] {
    const lines = this.battle.log.slice(this.cursor);
    this.cursor = this.battle.log.length;
    const out: BattleEvent[] = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (line.startsWith('|split|')) {
        line = lines[i + 1]; // versão "secreta" (com HP exato)
        i += 2;
      }
      const parts = line.split('|').slice(1);
      const ev = this.translate(parts);
      if (ev) {
        // Marca a posição em campo (dupla) de quem fez a ação.
        const ident = /^p[12][ab]/.test(parts[1] ?? '') ? parts[1] : '';
        if (ident) for (const e of ev) e.slot ??= this.slotOf(ident);
        out.push(...ev);
      }
    }
    if (this.encounter.tournament || this.encounter.legend) return withNarration(out, this.foeStatus().filter(Boolean).length, this.battle.p1.pokemon.filter(p => !p.fainted).length, this.encounter.hype);
    return out;
  }

  private hpOf(arg: string): {hp: number; maxhp: number; status?: string} {
    const [frac, status] = arg.split(' ');
    if (frac === '0') return {hp: 0, maxhp: 1, status: 'fnt'};
    const [hp, maxhp] = frac.split('/').map(Number);
    return {hp, maxhp: maxhp || 100, status};
  }

  private translate(parts: string[]): BattleEvent[] | null {
    const [cmd, a = '', b = '', c = ''] = parts;
    const kw = parts.find(p => p.startsWith('[from]'))?.replace('[from] ', '').replace(/^(item|ability): /, '');
    switch (cmd) {
      case 'switch':
      case 'drag': {
        const {side, name} = this.name(a);
        const hp = this.hpOf(c);
        const speciesName = b.split(',')[0];
        const level = Number(/, L(\d+)/.exec(b)?.[1] ?? 100);
        const shiny = b.includes('shiny');
        const poke = side === 'p1' ? this.pokeOf(a) : undefined;
        return [
          {
            switchIn: {side, species: speciesName, hp: hp.hp, maxhp: hp.maxhp, uid: poke ? this.uidOf.get(poke) : undefined, level, shiny},
            text: side === 'p1'
              ? `Vai, ${name}!`
              : this.encounter.trainer
                ? `${this.encounter.trainer} mandou ${speciesName}!`
                : this.encounter.boss ? `Um ${name} poderoso apareceu!` : `Um ${name} apareceu!`,
          },
        ];
      }
      case 'move': {
        if (b === ACTION_NAME) return null;
        const {side, name} = this.name(a);
        return [{move: {side, move: b}, text: `${name} usou ${b}!`}];
      }
      case 'cant': {
        if (c === ACTION_NAME) return null;
        const {name} = this.name(a);
        return [{text: `${name} ${CANT_TEXT[b] ?? 'não conseguiu se mover'}!`}];
      }
      case '-damage': {
        const {side, name} = this.name(a);
        const hp = this.hpOf(b);
        const ev: BattleEvent = {hp: {side, ...hp}};
        if (kw) ev.text = `${name} foi ferido por ${kw === 'brn' ? 'queimadura' : kw === 'psn' || kw === 'tox' ? 'veneno' : kw}.`;
        else ev.hit = {side, effect: 'normal'};
        return [ev];
      }
      case '-heal': {
        const {side, name} = this.name(a);
        return [{hp: {side, ...this.hpOf(b)}, text: `${name} recuperou HP${kw ? ` (${kw})` : ''}.`}];
      }
      case '-sethp': {
        const {side} = this.name(a);
        return [{hp: {side, ...this.hpOf(b)}}];
      }
      case 'faint': {
        const {side, name} = this.name(a);
        return [{faint: side, text: `${name} desmaiou!`}];
      }
      case '-supereffective':
        return [{text: 'É super efetivo!', hit: {side: this.name(a).side, effect: 'super'}}];
      case '-resisted':
        return [{text: 'Não é muito efetivo...', hit: {side: this.name(a).side, effect: 'resisted'}}];
      case '-immune':
        return [{text: `Não afeta ${this.name(a).name}...`}];
      case '-crit':
        return [{text: 'Acerto crítico!', hit: {side: this.name(a).side, effect: 'crit'}}];
      case '-miss':
        return [{text: `${this.name(a).name} errou!`}];
      case '-fail':
        return [{text: 'Mas falhou!'}];
      case '-status': {
        const {side, name} = this.name(a);
        const poke = this.pokeOf(a);
        return [{text: `${name} ${STATUS_TEXT[b] ?? b}!`, hp: poke ? {side, hp: poke.hp, maxhp: poke.maxhp, status: b} : undefined}];
      }
      case '-curestatus': {
        const {side, name} = this.name(a);
        const poke = this.pokeOf(a);
        return [{text: `${name} se curou.`, hp: poke ? {side, hp: poke.hp, maxhp: poke.maxhp, status: ''} : undefined}];
      }
      case '-boost':
      case '-unboost': {
        const n = Number(c);
        const dir = cmd === '-boost' ? (n >= 2 ? 'aumentou muito' : 'aumentou') : n >= 2 ? 'diminuiu muito' : 'diminuiu';
        return [{text: `${BOOST_PT[b] ?? b} de ${this.name(a).name} ${dir}!`}];
      }
      case '-weather':
        if (parts.includes('[upkeep]')) return null;
        return [{text: WEATHER_TEXT[a] ?? `O clima mudou: ${a}.`}];
      case '-ability':
        return [{text: `[${b}] de ${this.name(a).name}`}];
      case '-enditem':
        return [{text: `${this.name(a).name} usou/perdeu ${b}.`}];
      case '-item':
        return [{text: `${this.name(a).name} obteve ${b}.`}];
      case 'detailschange': {
        const {side} = this.name(a);
        return [{forme: {side, species: b.split(',')[0]}}];
      }
      case '-mega':
        return [{text: `${this.name(a).name} mega-evoluiu!`}];
      case '-start':
        if (b === 'confusion') return [{text: `${this.name(a).name} ficou confuso!`}];
        if (b.startsWith('move: ')) return [{text: `${this.name(a).name}: ${b.slice(6)}!`}];
        return null;
      case '-message':
        return [{text: a}];
      case 'win':
        return null;
      default:
        return null;
    }
  }
}

export function speciesTypes(name: string): string[] {
  return [...species(name).types];
}

/** IA simples: prefere golpes fortes e efetivos, com um pouco de aleatoriedade. Serve para selvagens, treinadores e bots. */
export function aiMoveChoice(battle: Battle, side: Side): string {
  const me = battle[side];
  const foe = battle[side === 'p1' ? 'p2' : 'p1'];
  const req = me.activeRequest as {active?: {moves: {id: string; disabled?: boolean}[]}[]} | null;
  const doubles = me.active.length > 1;
  const choices: string[] = [];
  me.active.forEach((self, slot) => {
    if (!self || self.fainted) return;
    const moves = req?.active?.[slot]?.moves ?? [];
    const targets = foe.active.map((t, i) => ({t, loc: i + 1})).filter(x => x.t && !x.t.fainted);
    let best = 'default';
    let bestScore = -1;
    moves.forEach((m, i) => {
      if (m.disabled || m.id === ACTION_MOVE) return;
      const move = dex.moves.get(m.id);
      const kind = battle.dex.moves.get(m.id).target;
      for (const {t, loc} of targets.length ? targets : [{t: undefined, loc: 1}]) {
        let score: number;
        if (move.category === 'Status' || !t) score = 35;
        else {
          const stab = self.getTypes().includes(move.type) ? 1.5 : 1;
          score = (move.basePower || 60) * stab * typeMultiplier(move.type, t.getTypes());
        }
        score *= 0.6 + Math.random() * 0.8;
        if (score > bestScore) {
          bestScore = score;
          const aim = doubles && battle.actions.targetTypeChoices(kind) ? (kind.startsWith('adjacentAlly') ? ` -${slot + 1}` : ` ${loc}`) : '';
          best = `move ${i + 1}${aim}`;
        }
      }
    });
    choices.push(best);
  });
  return choices.length ? choices.join(', ') : 'default';
}

/** Escolhe quem entra depois de um desmaio: o que tem os melhores golpes contra o adversário em campo. */
export function aiSwitchChoice(battle: Battle, side: Side): string {
  const me = battle[side];
  const target = battle[side === 'p1' ? 'p2' : 'p1'].active.find(p => p && !p.fainted);
  const used = new Set<number>();
  const pickOne = (): string => {
    let best = '';
    let bestScore = -1;
    me.pokemon.forEach((p, i) => {
      if (p.fainted || p.isActive || used.has(i)) return;
      let score = p.hp / p.maxhp;
      if (target) {
        for (const slot of p.moveSlots) {
          const mv = dex.moves.get(slot.id);
          if (mv.category === 'Status') continue;
          score = Math.max(score, typeMultiplier(mv.type, target.getTypes()) * (p.hp / p.maxhp));
        }
      }
      score *= 0.8 + Math.random() * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = `switch ${i + 1}`;
      }
    });
    if (best) used.add(Number(best.split(' ')[1]) - 1);
    return best || 'pass';
  };
  if (me.active.length < 2) {
    const one = pickOne();
    return one === 'pass' ? 'default' : one;
  }
  const out = me.active.map(p => (p?.switchFlag ? pickOne() : null)).filter((c): c is string => c !== null);
  return out.length ? out.join(', ') : 'default';
}
