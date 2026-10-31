// Estado global da run (zustand). Toda regra de jogo passa por aqui; a UI só chama ações.
import {create} from 'zustand';
import {BIOMES} from '../data/biomes';
import {dex, species, teachableMoves} from '../data/dex';
import {POWER_EVS, VITAMIN_EVS, getItem, megaStonesFor} from '../data/items';
import {BattleController} from './battle';
import {BIOME_CHANGE_EVERY, HEAL_EVERY, SEASON_LENGTH, generateEncounter} from './encounters';
import {
  CANDY, COST_CUT_PRICE, EV_MAX_STAT, EV_MAX_TOTAL, EV_MULT, EV_PRESETS, EV_RESET_PRICE,
  HEART_STEPS, MEGA_STONE_PRICE, addStatEvs, lineMegaStones, allocateEvs, bankEvs, evTotal, evYield, resetEvs, tutorRoll, HEART_PTS, MAX_COST_CUT, SHINY_PRICE,
  addCandies, addHeartPts, applyEntry, entryOf, expBonus, heartsOf, lineRoot, loadCollection, movePrice,
  careerOf, registerCatch, saveCollection, shinyChance, spendCandies, starterIvs, statsOf, teamCost,
} from './meta';
import type {Collection, TutorPlan} from './meta';
import {cleanNickname, createMon, displayName, evolve, expYield, gainExp, itemEvolutions, levelUp, maxHp} from './mon';
import {pick, shuffle, uid} from './rng';
import {moneyReward, moneyValue, rerollCost, rollRewards} from './rewards';
import {cheapestHeal, rivalEncounter, rollEvent, shouldRollEvent} from './events';
import {START_LEVELS, applyPerks, buyUpgrade, discounted, rerollPrice, gloryFor, perksOf, teamBudget} from './glory';
import {DAYCARE_ITEMS, EGG_PRICE, MAX_EGGS, hatch, makeEgg} from './daycare';
import {
  applyToCareer, createTournament, currentRound, highlightsFromLog, placementLabel, playerIndex, playerMatch,
  prizeIndex, recordPlayerResult, tourAt, tourInfo,
} from './tournament';
import type {Tournament} from './tournament';
import {introLines} from './narration';
import {MAX_TRAINERS, deleteTrainerData, loadTrainers, newTrainer, runKey, saveTrainers} from './trainers';
import type {Trainer} from './trainers';
import {STAT_LABEL} from './types';
import type {OwnedMon, PendingEvent, RunPerks, RunState, StatId, StatTable} from './types';

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
    // Buffs de batalha (curar status, aguentar com 1 HP, crítico) são só do parceiro.
    for (const m of run.party) hearts[m.uid] = m.partner ? heartsOf(col.entries[lineRoot(m.species)]) : 0;
    battle = new BattleController(run.party, run.encounter, hearts, 1 + 0.15 * (run.perks?.catch ?? 0));
    battleFor = run.encounter.mon.uid;
  }
  return battle;
}

export type Screen = 'title' | 'run' | 'collection' | 'daycare' | 'glory' | 'tournaments';

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
  newRun(team: string[], partner?: string, eggId?: string): void;
  /** Creche: faz um ovo com dois Pokémon da coleção. Devolve a mensagem. */
  breed(mother: string, father: string, items: [string | null, string | null]): string;
  discardEgg(id: string): void;
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
  buyUpgrade(id: keyof RunPerks): void;
  /** Compra a Mega Pedra própria da linha (ou troca qual pedra usar, se já comprou). */
  buyMegaStone(line: string, stone: string): void;
  /** Resolve o evento atual (a escolha depende do tipo do evento). */
  resolveEvent(choice: string | null): void;
  /** Aula do Tutor; devolve a mensagem do resultado. */
  tutor(line: string, kind: 'nature' | 'ability', target: string, plan: TutorPlan): string;
  allocateEv(line: string, stat: StatId, n: number): void;
  resetLineEvs(line: string): void;
  presetEvs(line: string, preset: number): void;
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
  /** Torneio: avança a tela (explicação → sorteio → chave). */
  tourStage(stage: Tournament['stage']): void;
  /** Torneio: começa a partida do jogador (time curado). */
  tourFight(): void;
  /** Torneio acabou: prêmios, carreira e segue a run. */
  tourFinish(): void;
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

  const healAll = (run: RunState) => {
    for (const m of run.party) m.hp = maxHp(m);
  };

  const startWave = (run: RunState) => {
    run.wave++;
    run.event = undefined;
    const info = tourAt(run.wave);
    if (info) {
      const t = get().trainer;
      const c = careerOf(get().collection);
      run.tournament = createTournament(info, {name: t?.name ?? 'Você', avatar: t?.avatar, titles: c.titles, runnerUps: c.runnerUps, fame: c.fame});
      run.encounter = undefined;
      run.upcoming = undefined;
      run.phase = 'tournament';
      battle = null;
      return;
    }
    run.encounter = run.upcoming?.shift();
    if (!run.encounter) {
      // Evita repetir a mesma espécie das últimas rondas (biomas pareciam sempre iguais).
      for (let i = 0; i < 4; i++) {
        run.encounter = generateEncounter(run.wave, run.biome, run.incenseWaves > 0, run.perks?.luck);
        if (!run.recent?.includes(run.encounter.mon.species)) break;
      }
    }
    run.recent = [run.encounter!.mon.species, ...(run.recent ?? [])].slice(0, 8);
    if (!run.upcoming?.length) run.upcoming = undefined;
    if (run.incenseWaves > 0) run.incenseWaves--;
    run.phase = 'battle';
    run.rerolls = 0;
    battle = null;
  };

  const goToReward = (run: RunState) => {
    run.rewardTaken = undefined;
    run.rewardOptions = rollRewards(run.wave, 3 + (run.perks?.rewards ?? 0), run.skipStreak ?? 0);
    run.phase = 'reward';
  };

  const afterReward = (run: RunState) => {
    if (run.wave >= SEASON_LENGTH) {
      run.phase = 'stageClear';
      return;
    }
    if (run.wave % HEAL_EVERY === 0) {
      for (const m of run.party) m.hp = maxHp(m);
      run.log.push('Centro Pokémon: seu time foi curado!');
    }
    if (run.wave % BIOME_CHANGE_EVERY === 0 || run.mapReady) run.phase = 'biomeChoice';
    else if (shouldRollEvent(run)) {
      run.event = rollEvent(run);
      run.lastEventWave = run.wave;
      if (run.event.kind === 'seer') run.upcoming = run.event.upcoming;
      run.phase = 'event';
    } else startWave(run);
  };

  const endRun = (run: RunState, col: Collection, result: 'lost' | 'stageClear' | 'abandoned') => {
    const st = statsOf(col);
    st.runs++;
    const glory = gloryFor(run.wave, result);
    col.glory = (col.glory ?? 0) + glory;
    run.gloryEarned = glory + (run.tourGlory ?? 0);
    st.bestWave = Math.max(st.bestWave, run.wave);
    if (result === 'stageClear') {
      st.stageClears++;
      for (const m of run.party) addHeartPts(col, m.species, HEART_PTS.stageClear * (m.partner ? 2 : 1));
    }
    // O que sobrou para a creche volta para a coleção: itens Power e o ovo que não chocou.
    for (const m of [...run.party, ...run.box]) {
      if (m.item && DAYCARE_ITEMS.includes(m.item)) col.items = {...col.items, [m.item]: (col.items?.[m.item] ?? 0) + 1};
    }
    for (const [id, n] of Object.entries(run.bag)) {
      if (n > 0 && DAYCARE_ITEMS.includes(id)) col.items = {...col.items, [id]: (col.items?.[id] ?? 0) + n};
    }
    if (run.egg && (col.eggs?.length ?? 0) < MAX_EGGS) {
      const {left: _left, ...egg} = run.egg;
      col.eggs = [...(col.eggs ?? []), egg];
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
    if (run.phase !== 'postBattle') return;
    if (run.tournament) run.phase = 'tournament';
    else goToReward(run);
  };

  /** Usa um item da mochila (fora da batalha). Devolve a mensagem para o jogador. */
  const applyItem = (run: RunState, col: Collection, itemId: string, monUid: string): string => {
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
        case 'vitamin': {
          const stat = item.evStat!;
          const total = Object.values(mon.evs).reduce((a, b) => a + b, 0);
          const add = Math.min(VITAMIN_EVS, EV_MAX_STAT - mon.evs[stat], EV_MAX_TOTAL - total);
          if (add > 0) {
            mon.evs[stat] += add;
            addStatEvs(col, mon.species, stat, add);
            used = true;
            message = `${displayName(mon)} ganhou ${add} EVs de ${STAT_LABEL[stat]} (também na ficha da coleção).`;
          } else message = `${displayName(mon)} já está no máximo de EVs aí.`;
          break;
        }
        case 'mega': {
          const stones = megaStonesFor(species(mon.species).name);
          const other = [...run.party, ...run.box].find(m => m.uid !== mon.uid && m.item && getItem(m.item).megaFor);
          if (!stones.length) message = `${displayName(mon)} não tem mega evolução.`;
          else if (other) message = `Só 1 mega por time: ${displayName(other)} já segura uma Mega Pedra.`;
          else {
            const stone = pick(stones);
            if (mon.item) run.bag[mon.item] = (run.bag[mon.item] ?? 0) + 1;
            mon.item = stone.id;
            used = true;
            message = `${displayName(mon)} agora segura ${stone.name} e vai mega-evoluir nas batalhas!`;
          }
          break;
        }
        case 'held':
          if (item.megaFor) {
            const other = [...run.party, ...run.box].find(m => m.uid !== mon.uid && m.item && getItem(m.item).megaFor);
            if (item.megaFor !== species(mon.species).name) {
              message = `${item.name} só serve em ${item.megaFor}.`;
              break;
            }
            if (other) {
              message = `Só 1 mega por time: ${displayName(other)} já segura uma Mega Pedra.`;
              break;
            }
          }
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

    newRun(team, partner, eggId) {
      const col = structuredClone(get().collection);
      const picked = team.slice(0, PARTY_SIZE);
      if (!picked.length || picked.reduce((n, s) => n + teamCost(col, s), 0) > teamBudget(col)) return;
      const run = emptyRun();
      applyPerks(run, perksOf(col));
      run.party = picked.map(name => {
        const mon = createMon(name, {
          level: START_LEVELS[perksOf(col).level ?? 0] ?? STARTER_LEVEL,
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
      // Mega Pedra própria: só 1 por time, no primeiro da ordem que tiver.
      const megaMon = run.party.find(m => col.entries[lineRoot(m.species)]?.megaStone);
      if (megaMon) {
        if (megaMon.item) run.bag[megaMon.item] = (run.bag[megaMon.item] ?? 0) + 1;
        megaMon.item = col.entries[lineRoot(megaMon.species)]!.megaStone;
      }
      const egg = eggId ? col.eggs?.find(e => e.id === eggId) : undefined;
      if (egg) {
        run.egg = {...egg, left: Math.max(1, Math.ceil(egg.waves * (1 - 0.2 * (run.perks?.hatch ?? 0))))};
        col.eggs = col.eggs!.filter(e => e.id !== egg.id);
      }
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
    tutor(line, kind, target, plan) {
      let msg = '';
      editCollection(col => {
        const r = tutorRoll(col, line, kind, target, plan);
        if (!r) return false;
        const what = kind === 'nature' ? 'nature' : 'habilidade';
        msg = r.wanted ? `Deu certo! ${what} ${r.got} desbloqueada.` : `Não saiu ${target}, mas você desbloqueou a ${what} ${r.got}.`;
      });
      return msg;
    },
    allocateEv(line, stat, n) {
      editCollection(col => allocateEvs(entryOf(col, line), stat, n));
    },
    resetLineEvs(line) {
      editCollection(col => {
        const e = entryOf(col, line);
        if (!evTotal(e.evs) || !spendCandies(col, line, EV_RESET_PRICE)) return false;
        resetEvs(e);
      });
    },
    presetEvs(line, preset) {
      editCollection(col => {
        const e = entryOf(col, line);
        const p = EV_PRESETS[preset];
        if (!p) return false;
        if (evTotal(e.evs)) {
          if (!spendCandies(col, line, EV_RESET_PRICE)) return false;
          resetEvs(e);
        }
        for (const [k, v] of Object.entries(p.evs)) allocateEvs(e, k as StatId, v);
      });
    },
    resolveEvent(choice) {
      let message = '';
      mutate((run, col) => {
        const ev = run.event;
        if (run.phase !== 'event' || !ev) return;
        const join = (mon: OwnedMon, hearts: number) => {
          mon.uid = uid();
          mon.metWave = run.wave;
          mon.metBiome = run.biome;
          run.stats.caught++;
          const reg = registerCatch(col, mon);
          addHeartPts(col, mon.species, hearts);
          if (run.party.length < PARTY_SIZE) run.party.push(mon);
          else run.box.push(mon);
          message = `${species(mon.species).name} entrou no seu time! (+${reg.candies} doces)`;
        };
        switch (ev.kind) {
          case 'house':
            if (choice === 'care') {
              ev.mon.hp = maxHp(ev.mon);
              join(ev.mon, HEART_STEPS[1]);
            } else {
              const gift = rollRewards(run.wave, 1).find(id => getItem(id).kind !== 'money') ?? 'potion';
              run.bag[gift] = (run.bag[gift] ?? 0) + 1;
              message = `${species(ev.mon.species).name} deixou um presente: ${getItem(gift).name}.`;
            }
            break;
          case 'hurt':
            if (choice === 'heal') {
              const heal = cheapestHeal(run);
              if (!heal) return;
              run.bag[heal]--;
              if (!run.bag[heal]) delete run.bag[heal];
              ev.mon.hp = maxHp(ev.mon);
              join(ev.mon, HEART_STEPS[0]);
            }
            break;
          case 'berries':
            if (choice && ev.options.includes(choice)) {
              run.bag[choice] = (run.bag[choice] ?? 0) + 1;
              message = `Você pegou ${getItem(choice).name}.`;
            }
            break;
          case 'merchant':
            if (choice === 'trade' && run.bag[ev.give]) {
              run.bag[ev.give]--;
              if (!run.bag[ev.give]) delete run.bag[ev.give];
              run.bag[ev.get] = (run.bag[ev.get] ?? 0) + 1;
              message = `Troca feita: você ganhou ${getItem(ev.get).name}!`;
            }
            break;
          case 'rival':
            if (choice === 'fight') {
              run.encounter = rivalEncounter(run, ev.name);
              run.event = undefined;
              run.phase = 'battle';
              battle = null;
              return;
            }
            break;
          case 'seer':
            break;
        }
        run.event = undefined;
        startWave(run);
      });
      if (message) get().toast(message);
    },

    buyMegaStone(line, stone) {
      editCollection(col => {
        const e = entryOf(col, line);
        if (!lineMegaStones(line).some(i => i.id === stone)) return false;
        if (!e.megaStone && !spendCandies(col, line, MEGA_STONE_PRICE)) return false;
        e.megaStone = stone;
      });
    },
    buyUpgrade(id) {
      editCollection(col => buyUpgrade(col, id));
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
        if (enc.tournament && run.tournament && ctl) {
          // Partida de torneio: perder não acaba a run, só tira você do torneio.
          const t = run.tournament;
          const won = outcome === 'won';
          const me = get().trainer?.name ?? 'Você';
          const foe = enc.trainer ?? '?';
          const left = won ? ctl.battle.p1.pokemon.filter(p => !p.fainted).length : ctl.battle.p2.pokemon.filter(p => !p.fainted).length;
          recordPlayerResult(t, won, run.party.map(m => m.species), highlightsFromLog(ctl.battle.log, me, foe, won ? me : foe, left), left);
          if (!won) {
            healAll(run);
            run.phase = 'tournament';
            get().toast(`${foe} venceu. Fim do torneio para você, mas a temporada continua!`);
            return;
          }
        } else if (outcome === 'lost') {
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
        const rest = 0.2 + 0.1 * (run.perks?.rest ?? 0);
        for (const m of run.party) if (m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + Math.ceil(maxHp(m) * rest));
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
          const exp = expYield(enc.mon, enc.boss || !!enc.trainer);
          for (const m of run.party) {
            if (m.hp <= 0) continue;
            const fought = ctl?.participants.has(m.uid);
            if (fought) {
              const big = enc.boss || !!enc.trainer;
              candy(m.species, (big ? CANDY.boss : CANDY.defeat) + (run.perks?.candy ?? 0));
              const evBoost = 1 + 0.5 * (run.perks?.evs ?? 0);
              bankEvs(col, m.species, Math.round(evYield(enc.mon.species).amount * EV_MULT * (big ? 2 : 1) * evBoost));
            }
            const power = m.item ? getItem(m.item).evStat : undefined;
            if (power) {
              const total = Object.values(m.evs).reduce((a, b) => a + b, 0);
              const add = Math.min(POWER_EVS, EV_MAX_STAT - m.evs[power], EV_MAX_TOTAL - total);
              if (add > 0) m.evs[power] += add;
              addStatEvs(col, m.species, power, POWER_EVS);
            }
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
        const money = enc.tournament ? 0 : moneyReward(run.wave, enc.boss || !!enc.trainer) * (enc.trainer ? 2 : 1);
        run.money += money;
        statsOf(col).moneyEarned += money;
        if (gained.size) get().toast(`Doces: ${[...gained].map(([n, k]) => `+${k} ${n}`).join(' · ')}`);
        for (const n of newHearts) get().toast(`❤ ${n} ganhou um coração de amizade!`);
        if (run.egg && (outcome === 'won' || outcome === 'caught')) {
          run.egg.left--;
          if (run.egg.left <= 0) {
            const baby = hatch(run.egg, Math.max(5, Math.floor(run.wave * 0.9)));
            baby.metWave = run.wave;
            baby.metBiome = run.biome;
            run.egg = undefined;
            const reg = registerCatch(col, baby);
            addHeartPts(col, baby.species, HEART_STEPS[0]);
            if (run.party.length < PARTY_SIZE) run.party.push(baby);
            else run.box.push(baby);
            get().toast(`O ovo chocou! Nasceu um ${baby.species}${baby.shiny ? ' shiny' : ''}! (+${reg.candies} doces)`);
          }
        }
        if (enc.tournament) healAll(run);
        run.pending.push(...events);
        run.phase = 'postBattle';
        flushPending(run);
      });
    },

    tourStage(stage) {
      mutate(run => {
        if (run.tournament) run.tournament.stage = stage;
      });
    },

    tourFight() {
      mutate((run, col) => {
        const t = run.tournament;
        const m = t && playerMatch(t);
        if (!t || !m) return;
        healAll(run);
        const me = t.entrants[playerIndex(t)];
        const foe = t.entrants[m.a === playerIndex(t) ? m.b : m.a];
        const c = careerOf(col);
        const info = tourInfo(t.kind);
        run.encounter = {
          mon: foe.team[0],
          team: foe.team,
          rarity: 'rare',
          boss: true,
          trainer: foe.name,
          tournament: true,
          intro: introLines({...me, titles: c.titles, runnerUps: c.runnerUps, fame: c.fame}, foe, info.name, currentRound(t), !!c.defending[t.kind]),
        };
        run.phase = 'battle';
        battle = null;
      });
    },

    tourFinish() {
      mutate((run, col) => {
        const t = run.tournament;
        if (!t || t.stage !== 'done') return;
        const info = tourInfo(t.kind);
        const i = prizeIndex(t.placement ?? 5);
        applyToCareer(careerOf(col), t);
        col.glory = (col.glory ?? 0) + info.glory[i];
        run.tourGlory = (run.tourGlory ?? 0) + info.glory[i];
        run.money += info.money[i];
        statsOf(col).moneyEarned += info.money[i];
        if (t.placement === 1) for (const m of run.party) addHeartPts(col, m.species, HEART_PTS.stageClear * (m.partner ? 2 : 1));
        get().toast(`${info.name}: ${placementLabel(t.placement ?? 5)}! +₽ ${info.money[i]} · +${info.glory[i]} Glória${info.cp[i] ? ` · +${info.cp[i]} CP` : ''}`);
        run.tournament = undefined;
        run.encounter = undefined;
        healAll(run);
        goToReward(run);
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
        } else if (item.kind === 'breed') {
          col.items = {...col.items, [itemId]: (col.items?.[itemId] ?? 0) + 1};
          message = `${item.name} foi guardado na Creche.`;
        } else {
          run.bag[itemId] = (run.bag[itemId] ?? 0) + 1;
          if (target !== undefined) message = applyItem(run, col, itemId, target);
        }
        // Fica na tela da recompensa para dar tempo de passar na loja.
        run.rewardOptions = [];
        run.rewardTaken = itemId;
        run.skipStreak = 0;
      });
      if (message) get().toast(message);
    },

    skipReward() {
      mutate(run => {
        // Pular sem pegar nada melhora um pouco as próximas recompensas (até 2 vezes seguidas).
        if (run.rewardOptions.length && !run.rewardTaken) run.skipStreak = Math.min(2, (run.skipStreak ?? 0) + 1);
        run.rewardOptions = [];
        run.rewardTaken = undefined;
        afterReward(run);
      });
    },

    reroll() {
      mutate(run => {
        const cost = rerollPrice(run, rerollCost(run.rerolls, run.wave));
        if (run.money < cost) return;
        run.money -= cost;
        run.rerolls++;
        run.rewardOptions = rollRewards(run.wave, 3 + (run.perks?.rewards ?? 0), run.skipStreak ?? 0);
      });
    },

    buy(itemId) {
      mutate((run, col) => {
        const item = getItem(itemId);
        const price = discounted(run, item.price);
        if (!item.price || run.money < price) return;
        run.money -= price;
        if (item.kind === 'breed') col.items = {...col.items, [itemId]: (col.items?.[itemId] ?? 0) + 1};
        else run.bag[itemId] = (run.bag[itemId] ?? 0) + 1;
      });
    },

    breed(mother, father, items) {
      let msg = '';
      editCollection(col => {
        if ((col.eggs?.length ?? 0) >= MAX_EGGS) return false;
        const store = {...col.items};
        for (const it of items) {
          if (!it) continue;
          if (!store[it]) return false;
          store[it]--;
        }
        if (!spendCandies(col, mother, EGG_PRICE)) return false;
        const egg = makeEgg(col, mother, father, items);
        if (!egg) return false;
        col.items = store;
        col.eggs = [...(col.eggs ?? []), egg];
        msg = `Um ovo de ${egg.species} apareceu! Ele choca depois de ${egg.waves} rondas vencidas numa run.`;
      });
      return msg;
    },
    discardEgg(id) {
      editCollection(col => {
        col.eggs = col.eggs?.filter(e => e.id !== id);
      });
    },

    chooseNextBiome(id) {
      mutate(run => {
        if (id && id !== run.biome) {
          run.visited = [run.biome, ...(run.visited ?? [])].slice(0, 4);
          run.biome = id;
          run.upcoming = undefined;
        }
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
      mutate((run, col) => {
        message = applyItem(run, col, itemId, monUid);
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

