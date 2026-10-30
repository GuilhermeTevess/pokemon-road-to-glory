// Estado global da run (zustand). Toda regra de jogo passa por aqui; a UI só chama ações.
import {create} from 'zustand';
import {BIOMES} from '../data/biomes';
import {dex, species, teachableMoves} from '../data/dex';
import {getItem} from '../data/items';
import {BattleController} from './battle';
import {BIOME_CHANGE_EVERY, HEAL_EVERY, STAGE_LENGTH, generateEncounter} from './encounters';
import {
  CANDY, COST_CUT_PRICE, HEART_PTS, MAX_COST_CUT, SHINY_PRICE, TEAM_BUDGET,
  addCandies, addHeartPts, applyEntry, entryOf, expBonus, heartsOf, lineRoot, loadCollection, movePrice,
  registerCatch, saveCollection, shinyChance, spendCandies, starterIvs, statsOf, teamCost,
} from './meta';
import type {Collection} from './meta';
import {cleanNickname, createMon, displayName, evolve, expYield, gainExp, itemEvolutions, levelUp, maxHp} from './mon';
import {pick, shuffle, uid} from './rng';
import {moneyReward, moneyValue, rerollCost, rollRewards} from './rewards';
import {MAX_TRAINERS, deleteTrainerData, loadTrainers, newTrainer, runKey, saveTrainers} from './trainers';
import type {Trainer} from './trainers';
import type {OwnedMon, PendingEvent, RunState, StatTable} from './types';

export const PARTY_SIZE = 6;
export const STARTER_LEVEL = 5;

function loadRun(trainerId: string | null): RunState | null {
  if (!trainerId) return null;
  try {
    const raw = localStorage.getItem(runKey(trainerId));
    if (raw) {
      const run = JSON.parse(raw) as RunState;
      if (run.version === 1) return run;
    }
  } catch {
    /* sem storage */
  }
  return null;
}

function saveRun(trainerId: string | null, run: RunState | null): void {
  if (!trainerId) return;
  try {
    if (run) localStorage.setItem(runKey(trainerId), JSON.stringify(run));
    else localStorage.removeItem(runKey(trainerId));
  } catch {
    /* ignora */
  }
}

// O controlador da batalha não é serializável, então fica fora do estado persistido.
let battle: BattleController | null = null;
let battleFor: string | null = null;

export function getBattle(run: RunState): BattleController | null {
  if (run.phase !== 'battle' || !run.encounter) return null;
  if (!battle || battleFor !== run.encounter.mon.uid) {
    const col = useGame.getState().collection;
    const hearts: Record<string, number> = {};
    for (const m of run.party) hearts[m.uid] = heartsOf(col.entries[lineRoot(m.species)]);
    battle = new BattleController(run.party, run.encounter, hearts);
    battleFor = run.encounter.mon.uid;
  }
  return battle;
}

export type Screen = 'title' | 'run' | 'collection';

export interface Toast {
  id: string;
  text: string;
}

interface Store {
  trainers: Trainer[];
  /** Treinador jogando agora; null mostra a tela de escolha de treinador. */
  trainer: Trainer | null;
  selectTrainer(id: string | null): void;
  createTrainer(name: string, avatar: string): void;
  removeTrainer(id: string): void;
  screen: Screen;
  run: RunState | null;
  collection: Collection;
  toasts: Toast[];
  /** Último repetido capturado: IVs antes/depois (teia de IVs). */
  ivGain: {species: string; before: StatTable; after: StatTable} | null;
  clearIvGain(): void;
  /** Calculadora de tipos aberta (tipos selecionados) ou null. */
  typeCalc: string[] | null;
  openTypeCalc(types: string[] | null): void;
  setScreen(s: Screen): void;
  toast(text: string): void;
  /** Começa a run com o time escolhido (o primeiro é quem abre). */
  newRun(team: string[], partner?: string): void;
  /** Apelido de um Pokémon da run (também vira o apelido da linha na coleção). */
  renameMon(monUid: string, name: string): void;
  setNickname(line: string, name: string): void;
  /** Ações da ficha da coleção (gastam doces). */
  unlockMove(line: string, move: string): void;
  equipMove(line: string, move: string | null): void;
  equipNature(line: string, nature: string | null): void;
  equipAbility(line: string, ability: string | null): void;
  buyCostCut(line: string): void;
  buyShiny(line: string): void;
  setFavorite(line: string | null): void;
  abandonRun(): void;
  chooseStartBiome(id: string): void;
  finishBattle(outcome: 'won' | 'caught' | 'fled' | 'lost'): void;
  resolvePending(choice: string | number | null): void;
  /** Pega a recompensa; com `target`, já usa/equipa o item nesse Pokémon. */
  pickReward(itemId: string, target?: string): void;
  reroll(): void;
  buy(itemId: string): void;
  skipReward(): void;
  chooseNextBiome(id: string | null): void;
  useItem(itemId: string, monUid: string): void;
  takeItem(monUid: string): void;
  setLead(monUid: string): void;
  swapWithBox(boxUid: string, partyUid: string | null): void;
  /** Consome um item da mochila (usado pela batalha). */
  consume(itemId: string): boolean;
  /** Atualiza o run atual após mexer no controlador de batalha. */
  touch(): void;
}

function emptyRun(): RunState {
  return {
    version: 1,
    id: uid(),
    startedAt: Date.now(),
    wave: 0,
    biome: BIOMES[0].id,
    phase: 'starter',
    party: [],
    box: [],
    bag: {pokeball: 5, potion: 3},
    money: 500,
    mapReady: false,
    incenseWaves: 0,
    pending: [],
    rewardOptions: [],
    rerolls: 0,
    log: [],
    stats: {defeated: 0, caught: 0, fled: 0},
  };
}

const boot = loadTrainers();
const bootTrainer = boot.list.find(t => t.id === boot.current) ?? null;

export const useGame = create<Store>((set, get) => {
  const tid = () => get().trainer?.id ?? null;
  /** Aplica uma mudança numa cópia do run e salva. */
  const mutate = (fn: (run: RunState, col: Collection) => void) => {
    const cur = get().run;
    if (!cur) return;
    const run = structuredClone(cur);
    const col = structuredClone(get().collection);
    fn(run, col);
    saveRun(tid(), run);
    saveCollection(tid(), col);
    set({run, collection: col});
  };

  /** Mexe só na coleção (tela da coleção, fora da run). */
  const editCollection = (fn: (col: Collection) => boolean | void) => {
    const col = structuredClone(get().collection);
    if (fn(col) === false) return;
    saveCollection(tid(), col);
    set({collection: col});
  };

  const findMon = (run: RunState, monUid: string): OwnedMon | undefined =>
    run.party.find(m => m.uid === monUid) ?? run.box.find(m => m.uid === monUid);

  const startWave = (run: RunState) => {
    run.wave++;
    run.encounter = generateEncounter(run.wave, run.biome, run.incenseWaves > 0);
    if (run.incenseWaves > 0) run.incenseWaves--;
    run.phase = 'battle';
    run.rerolls = 0;
    battle = null;
  };

  const goToReward = (run: RunState) => {
    run.rewardOptions = rollRewards(run.wave);
    run.phase = 'reward';
  };

  const afterReward = (run: RunState) => {
    if (run.wave >= STAGE_LENGTH) {
      run.phase = 'stageClear';
      return;
    }
    if (run.wave % HEAL_EVERY === 0) {
      for (const m of run.party) m.hp = maxHp(m);
      run.log.push('Centro Pokémon: seu time foi curado!');
    }
    if (run.wave % BIOME_CHANGE_EVERY === 0 || run.mapReady) run.phase = 'biomeChoice';
    else startWave(run);
  };

  const endRun = (run: RunState, col: Collection, result: 'lost' | 'stageClear' | 'abandoned') => {
    const st = statsOf(col);
    st.runs++;
    st.bestWave = Math.max(st.bestWave, run.wave);
    if (result === 'stageClear') {
      st.stageClears++;
      for (const m of run.party) addHeartPts(col, m.species, HEART_PTS.stageClear * (m.partner ? 2 : 1));
    }
    col.runs.unshift({
      endedAt: Date.now(),
      wave: run.wave,
      starter: run.party[0]?.species ?? '?',
      result,
      party: run.party.map(m => m.species),
    });
    col.runs = col.runs.slice(0, 30);
  };

  const flushPending = (run: RunState) => {
    if (run.pending.length) return;
    if (run.phase === 'postBattle') goToReward(run);
  };

  /** Usa um item da mochila (fora da batalha). Devolve a mensagem para o jogador. */
  const applyItem = (run: RunState, itemId: string, monUid: string): string => {
    if (!run.bag[itemId]) return '';
    const item = getItem(itemId);
    const mon = findMon(run, monUid);
    let used = false;
    let message = '';
    if (item.kind === 'map') {
      run.mapReady = true;
      used = true;
      message = 'Você poderá trocar de bioma depois da próxima vitória.';
    } else if (item.kind === 'incense') {
      run.incenseWaves += 5;
      used = true;
      message = 'Pokémon raros vão aparecer mais pelas próximas 5 rondas!';
    } else if (mon) {
      const max = maxHp(mon);
      switch (item.kind) {
        case 'heal':
          if (mon.hp > 0 && mon.hp < max) {
            mon.hp = item.power === 1 ? max : Math.min(max, mon.hp + (item.power ?? 20));
            used = true;
            message = `${mon.species} recuperou HP.`;
          }
          break;
        case 'revive':
          if (mon.hp <= 0) {
            mon.hp = Math.max(1, Math.floor(max * (item.power ?? 0.5)));
            used = true;
            message = `${mon.species} foi revivido!`;
          }
          break;
        case 'candy':
          if (mon.level < 100) {
            for (let i = 0; i < (item.power ?? 1) && mon.level < 100; i++) levelUp(mon, run.pending);
            message = `${mon.species} subiu para o nível ${mon.level}!`;
            used = true;
          }
          break;
        case 'evolution': {
          const into = itemEvolutions(mon);
          if (into.length) {
            run.pending.push({kind: 'evolve', uid: mon.uid, into});
            used = true;
          } else message = `${mon.species} não evolui com esse item.`;
          break;
        }
        case 'tm': {
          const options = shuffle(teachableMoves(species(mon.species)).filter(m => !mon.moves.includes(m)));
          if (options.length) {
            const move = pick(options.slice(0, 20));
            if (mon.moves.length < 4) {
              mon.moves.push(move);
              message = `${mon.species} aprendeu ${move}!`;
            } else run.pending.push({kind: 'learnMove', uid: mon.uid, move});
            used = true;
          }
          break;
        }
        case 'mint':
          if (item.nature && mon.nature !== item.nature) {
            mon.nature = item.nature;
            used = true;
            message = `${mon.species} agora tem natureza ${item.nature}.`;
          } else message = `${mon.species} já tem essa natureza.`;
          break;
        case 'ability': {
          const abilities = Object.entries(species(mon.species).abilities)
            .filter(([slot]) => slot !== 'H' && slot !== 'S')
            .map(([, a]) => a as string);
          const other = abilities.find(a => a !== mon.ability);
          if (other) {
            mon.ability = other;
            used = true;
            message = `${mon.species} agora tem a habilidade ${other}: ${dex.abilities.get(other).shortDesc}`;
          } else message = `${mon.species} só tem uma habilidade comum.`;
          break;
        }
        case 'held':
          if (mon.item) run.bag[mon.item] = (run.bag[mon.item] ?? 0) + 1;
          mon.item = itemId;
          used = true;
          message = `${mon.species} agora segura ${item.name}.`;
          break;
        default:
          break;
      }
    }
    if (used) {
      run.bag[itemId]--;
      if (!run.bag[itemId]) delete run.bag[itemId];
    } else if (!message) message = 'Não teria efeito.';
    return message;
  };

  return {
    trainers: boot.list,
    trainer: bootTrainer,
    selectTrainer(id) {
      const trainer = get().trainers.find(t => t.id === id) ?? null;
      saveTrainers(get().trainers, trainer?.id ?? null);
      battle = null;
      set({trainer, run: loadRun(trainer?.id ?? null), collection: loadCollection(trainer?.id ?? null), screen: 'title'});
    },
    createTrainer(name, avatar) {
      if (get().trainers.length >= MAX_TRAINERS) return;
      const t = newTrainer(name, avatar);
      set({trainers: [...get().trainers, t]});
      get().selectTrainer(t.id);
    },
    removeTrainer(id) {
      deleteTrainerData(id);
      const trainers = get().trainers.filter(t => t.id !== id);
      set({trainers});
      if (get().trainer?.id === id) get().selectTrainer(null);
      else saveTrainers(trainers, tid());
    },
    screen: 'title',
    run: loadRun(bootTrainer?.id ?? null),
    collection: loadCollection(bootTrainer?.id ?? null),
    toasts: [],
    ivGain: null,
    clearIvGain: () => set({ivGain: null}),
    typeCalc: null,
    openTypeCalc: types => set({typeCalc: types}),

    setScreen: screen => set({screen}),

    toast(text) {
      const t = {id: uid(), text};
      set({toasts: [...get().toasts, t]});
      setTimeout(() => set({toasts: get().toasts.filter(x => x.id !== t.id)}), 3500);
    },

    newRun(team, partner) {
      const col = structuredClone(get().collection);
      const picked = team.slice(0, PARTY_SIZE);
      if (!picked.length || picked.reduce((n, s) => n + teamCost(col, s), 0) > TEAM_BUDGET) return;
      const run = emptyRun();
      run.party = picked.map(name => {
        const mon = createMon(name, {
          level: STARTER_LEVEL,
          ivs: starterIvs(col, name),
          ivMin: 10,
          hiddenAbilityChance: 0,
          shinyChance: shinyChance(col, name),
        });
        applyEntry(col, mon);
        mon.metWave = 0;
        if (name === (partner ?? picked[0])) {
          mon.partner = true;
          col.favorite = lineRoot(name);
        }
        // Garante a ficha da linha para ela ganhar doces e corações nesta run.
        entryOf(col, name);
        return mon;
      });
      run.phase = 'biome';
      battle = null;
      saveRun(tid(), run);
      saveCollection(tid(), col);
      set({run, collection: col, screen: 'run'});
    },

    renameMon(monUid, name) {
      mutate((run, col) => {
        const mon = findMon(run, monUid);
        if (!mon) return;
        mon.nickname = cleanNickname(name);
        entryOf(col, mon.species).nickname = mon.nickname;
      });
    },
    setNickname(line, name) {
      editCollection(col => {
        entryOf(col, line).nickname = cleanNickname(name);
      });
    },

    unlockMove(line, move) {
      editCollection(col => {
        const e = entryOf(col, line);
        if (e.moves.includes(move) || !spendCandies(col, line, movePrice(move))) return false;
        e.moves.push(move);
        e.startMove = move;
      });
    },
    equipMove(line, move) {
      editCollection(col => {
        const e = entryOf(col, line);
        e.startMove = move && e.moves.includes(move) ? move : undefined;
      });
    },
    equipNature(line, nature) {
      editCollection(col => {
        const e = entryOf(col, line);
        e.nature = nature && e.natures.includes(nature) ? nature : undefined;
      });
    },
    equipAbility(line, ability) {
      editCollection(col => {
        const e = entryOf(col, line);
        e.ability = ability && e.abilities.includes(ability) ? ability : undefined;
      });
    },
    buyCostCut(line) {
      editCollection(col => {
        const e = entryOf(col, line);
        if (e.costCut >= MAX_COST_CUT || !spendCandies(col, line, COST_CUT_PRICE[e.costCut])) return false;
        e.costCut++;
      });
    },
    buyShiny(line) {
      editCollection(col => {
        const e = entryOf(col, line);
        if (e.shinyLv >= SHINY_PRICE.length || !spendCandies(col, line, SHINY_PRICE[e.shinyLv])) return false;
        e.shinyLv++;
      });
    },
    setFavorite(line) {
      editCollection(col => {
        col.favorite = line ?? undefined;
      });
    },

    abandonRun() {
      const cur = get().run;
      if (cur && cur.phase !== 'gameOver' && cur.party.length) {
        mutate((run, col) => endRun(run, col, cur.phase === 'stageClear' ? 'stageClear' : 'abandoned'));
      }
      battle = null;
      saveRun(tid(), null);
      set({run: null, screen: 'title'});
    },

    chooseStartBiome(id) {
      mutate(run => {
        run.biome = id;
        startWave(run);
      });
    },

    finishBattle(outcome) {
      const ctl = battle;
      mutate((run, col) => {
        const enc = run.encounter;
        if (!enc) return;
        ctl?.syncParty(run.party);
        battle = null;
        const events: PendingEvent[] = [];
        if (outcome === 'lost') {
          run.phase = 'gameOver';
          endRun(run, col, 'lost');
          return;
        }
        if (outcome === 'fled') {
          run.stats.fled++;
          afterReward(run);
          return;
        }
        // Descanso: quem não desmaiou recupera 20% do HP depois de cada ronda.
        for (const m of run.party) if (m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + Math.ceil(maxHp(m) * 0.2));
        const gained = new Map<string, number>();
        const candy = (name: string, n: number) => {
          addCandies(col, name, n);
          const k = species(lineRoot(name)).name;
          gained.set(k, (gained.get(k) ?? 0) + n);
        };
        const newHearts: string[] = [];
        for (const m of run.party) {
          if (m.hp <= 0) continue;
          const pts = (ctl?.participants.has(m.uid) ? HEART_PTS.win : HEART_PTS.inParty) * (m.partner ? 2 : 1);
          if (addHeartPts(col, m.species, pts) > 0) newHearts.push(displayName(m));
        }
        if (outcome === 'won') {
          run.stats.defeated++;
          statsOf(col).defeated++;
          const exp = expYield(enc.mon, enc.boss);
          for (const m of run.party) {
            if (m.hp <= 0) continue;
            const fought = ctl?.participants.has(m.uid);
            if (fought) candy(m.species, enc.boss ? CANDY.boss : CANDY.defeat);
            const share = fought ? 1 : 0.5;
            const bonus = expBonus(heartsOf(col.entries[lineRoot(m.species)]));
            const r = gainExp(m, Math.floor(exp * share * bonus));
            if (r.levelsGained) run.log.push(`${m.species} subiu para o nível ${m.level}!`);
            events.push(...r.events);
          }
        }
        if (outcome === 'caught') {
          run.stats.caught++;
          const mon = structuredClone(enc.mon);
          if (ctl) mon.hp = Math.max(1, ctl.wildActive.hp);
          mon.uid = uid();
          mon.metWave = run.wave;
          mon.metBiome = run.biome;
          const reg = registerCatch(col, mon);
          gained.set(species(lineRoot(mon.species)).name, reg.candies);
          if (reg.duplicate) set({ivGain: {species: mon.species, before: reg.before, after: reg.after}});
          if (reg.newNature || reg.newAbility) {
            const what = [reg.newNature && `nature ${mon.nature}`, reg.newAbility && `habilidade ${mon.ability}`].filter(Boolean).join(' e ');
            get().toast(`Ficha de ${species(lineRoot(mon.species)).name}: ${what} desbloqueada!`);
          }
          if (run.party.length < PARTY_SIZE) run.party.push(mon);
          else {
            run.box.push(mon);
            get().toast(`Time cheio: ${mon.species} foi para a caixa.`);
          }
        }
        const money = moneyReward(run.wave, enc.boss);
        run.money += money;
        statsOf(col).moneyEarned += money;
        if (gained.size) get().toast(`Doces: ${[...gained].map(([n, k]) => `+${k} ${n}`).join(' · ')}`);
        for (const n of newHearts) get().toast(`❤ ${n} ganhou um coração de amizade!`);
        run.pending.push(...events);
        run.phase = 'postBattle';
        flushPending(run);
      });
    },

    resolvePending(choice) {
      mutate((run, col) => {
        const ev = run.pending.shift();
        if (!ev) return;
        const mon = findMon(run, ev.uid);
        if (mon && choice !== null) {
          if (ev.kind === 'learnMove' && typeof choice === 'number') {
            mon.moves[choice] = ev.move;
          } else if (ev.kind === 'evolve' && typeof choice === 'string' && ev.into.includes(choice)) {
            const from = mon.species;
            evolve(mon, choice);
            addCandies(col, mon.species, CANDY.evolve);
            run.log.push(`${from} evoluiu para ${mon.species}! (+${CANDY.evolve} doces)`);
          }
        }
        flushPending(run);
      });
    },

    pickReward(itemId, target) {
      let message = '';
      mutate((run, col) => {
        if (!run.rewardOptions.includes(itemId)) return;
        const item = getItem(itemId);
        if (item.kind === 'money') {
          const v = moneyValue(item, run.wave);
          run.money += v;
          statsOf(col).moneyEarned += v;
          message = `+₽ ${v}`;
        } else {
          run.bag[itemId] = (run.bag[itemId] ?? 0) + 1;
          if (target !== undefined) message = applyItem(run, itemId, target);
        }
        run.rewardOptions = [];
        afterReward(run);
      });
      if (message) get().toast(message);
    },

    skipReward() {
      mutate(run => {
        run.rewardOptions = [];
        afterReward(run);
      });
    },

    reroll() {
      mutate(run => {
        const cost = rerollCost(run.rerolls, run.wave);
        if (run.money < cost) return;
        run.money -= cost;
        run.rerolls++;
        run.rewardOptions = rollRewards(run.wave);
      });
    },

    buy(itemId) {
      mutate(run => {
        const item = getItem(itemId);
        if (!item.price || run.money < item.price) return;
        run.money -= item.price;
        run.bag[itemId] = (run.bag[itemId] ?? 0) + 1;
      });
    },

    chooseNextBiome(id) {
      mutate(run => {
        if (id) run.biome = id;
        run.mapReady = false;
        startWave(run);
      });
    },

    consume(itemId) {
      const run = get().run;
      if (!run || !run.bag[itemId]) return false;
      mutate(r => {
        r.bag[itemId]--;
        if (!r.bag[itemId]) delete r.bag[itemId];
      });
      return true;
    },

    useItem(itemId, monUid) {
      if (!get().run?.bag[itemId]) return;
      let message = '';
      mutate(run => {
        message = applyItem(run, itemId, monUid);
      });
      if (message) get().toast(message);
    },

    takeItem(monUid) {
      mutate(run => {
        const mon = findMon(run, monUid);
        if (!mon?.item) return;
        run.bag[mon.item] = (run.bag[mon.item] ?? 0) + 1;
        mon.item = undefined;
      });
    },

    setLead(monUid) {
      mutate(run => {
        const i = run.party.findIndex(m => m.uid === monUid);
        if (i > 0) [run.party[0], run.party[i]] = [run.party[i], run.party[0]];
      });
    },

    swapWithBox(boxUid, partyUid) {
      mutate(run => {
        const bi = run.box.findIndex(m => m.uid === boxUid);
        if (bi < 0) return;
        if (partyUid === null) {
          if (run.party.length >= PARTY_SIZE) return;
          run.party.push(...run.box.splice(bi, 1));
          return;
        }
        const pi = run.party.findIndex(m => m.uid === partyUid);
        if (pi < 0) return;
        [run.party[pi], run.box[bi]] = [run.box[bi], run.party[pi]];
      });
    },

    touch() {
      set({run: get().run ? {...get().run!} : null});
    },
  };
});

