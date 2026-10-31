// Estado global da run (zustand). Toda regra de jogo passa por aqui; a UI só chama ações.
import {create} from 'zustand';
import {BIOMES, getBiome} from '../data/biomes';
import {getHint} from '../data/hints';
import {bookName, getGym, gymsOf} from '../data/gyms';
import type {Gym} from '../data/gyms';
import {ACHIEVEMENTS, checkAchievements} from './achievements';
import {POINTS, addPoints, finishSeason, leagueOf, legendsBeaten, rollRivalPoints} from './league';
import {GYM_PRIZE, badgesIn, gymEncounter, gymStatus, gymWaves, ticketPrice} from './gym';
import {hintHere, rollBiome, rollHintLegendary} from './travelers';
import {dex, species, teachableMoves} from '../data/dex';
import {POWER_EVS, VITAMIN_EVS, getItem, megaStonesFor} from '../data/items';
import {BattleController} from './battle';
import {HEAL_EVERY, SEASON_LENGTH, generateEncounter, isBossWave} from './encounters';
import {TRAIL, addTrail, legendEncounter, legendPrize, rollLegend, trailOf} from './legend';
import type {Fame} from './legend';
import {getLegend} from '../data/legends';
import {BIOME_STAY, REGIONS, REGION_STAY, getRegion, regionStay} from '../data/regions';
import {
  CANDY, COST_CUT_PRICE, EV_MAX_STAT, EV_MAX_TOTAL, EV_MULT, EV_PRESETS, EV_RESET_PRICE,
  HEART_STEPS, MEGA_STONE_PRICE, addStatEvs, lineMegaStones, allocateEvs, bankEvs, evTotal, evYield, resetEvs, tutorRoll, HEART_PTS, MAX_COST_CUT, SHINY_PRICE,
  addCandies, addHeartPts, applyEntry, entryOf, expBonus, heartsOf, lineRoot, loadCollection, movePrice,
  careerOf, registerCatch, registerStarter, shinyGlow, saveCollection, shinyChance, spendCandies, starterIvs, statsOf, teamCost,
} from './meta';
import type {Collection, TutorPlan} from './meta';
import {cleanNickname, createMon, displayName, evolve, expYield, gainExp, itemEvolutions, levelUp, maxHp} from './mon';
import {pick, shuffle, uid, withSeed} from './rng';
import {moneyReward, moneyValue, rerollCost, rollRewards, shopPrice, travelBlocked} from './rewards';
import {cheapestHeal, getPlace, rivalEncounter, rollEvent, shouldRollEvent, tutorMoves, tutorPrice} from './events';
import {START_LEVELS, applyPerks, buyUpgrade, rerollPrice, gloryFor, perksOf, teamBudget} from './glory';
import {DAYCARE_ITEMS, EGG_PRICE, MAX_EGGS, hatch, makeEgg} from './daycare';
import {
  adoptShared, applyToCareer, botPending, createSharedTournament, simulateBotMatch, createTournament, currentRound, highlightsFromLog, matchKey, myPending, placementLabel, playerIndex, playerMatch,
  prizeIndex, recordPlayerResult, sharedAdvance, tourAt, tourInfo,
  tourName,
} from './tournament';
import type {MatchResult, TourKind, Tournament} from './tournament';
import {introLines} from './narration';
import {MAX_TRAINERS, deleteTrainerData, loadTrainers, newTrainer, runKey, saveTrainers} from './trainers';
import type {TrainerCareer} from './trainers';
import {careerBoost, deviceId, enforceRules, fromSnap, groupLog, playerId, roundBlockers, seasonBlockers, snapMon, waveStep} from './career';
import type {CareerDoc, CareerFight, PlayerDoc} from './career';
import {cacheCareer, cachedCareer, cloud, cloudMatches, cloudTours, cloudWorld} from './cloud';
import {listPt, newWorld, nextSeasonWorld, stepWorld, worldTournament} from './world';
import {seasonPoints} from './league';
import type {Trainer} from './trainers';
import {STAT_LABEL} from './types';
import type {Encounter, OwnedMon, PendingEvent, RunPerks, RunState, StatId, StatTable} from './types';

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

/** Run salva de um treinador (sem trocar de treinador). Cada treinador tem a sua. */
export function peekRun(trainerId: string): RunState | null {
  return loadRun(trainerId);
}

/** Run ainda em andamento (não acabou nem fechou a etapa). */
export function runActive(run: RunState | null): run is RunState {
  return !!run && run.party.length > 0 && run.phase !== 'gameOver' && run.phase !== 'stageClear';
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

export type Screen = 'title' | 'run' | 'quickplay' | 'career' | 'collection' | 'daycare' | 'glory' | 'tournaments' | 'ranking' | 'achievements';

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
  /** Muda nome e/ou visual de um treinador. */
  updateTrainer(id: string, patch: {name?: string; avatar?: string}): void;
  removeTrainer(id: string): void;
  /** Carreira online do treinador atual e os outros jogadores dela (última leitura). */
  career: CareerDoc | null;
  careerPeers: PlayerDoc[];
  /** Cria (host) ou entra numa carreira: vira um treinador novo ligado a ela. */
  enterCareer(doc: CareerDoc, name: string, avatar: string, colFrom?: string): void;
  /** Busca a carreira e os jogadores na nuvem. */
  refreshCareer(): Promise<void>;
  /** Manda o seu progresso para a nuvem. */
  pushCareer(): void;
  screen: Screen;
  run: RunState | null;
  collection: Collection;
  toasts: Toast[];
  /** Conquistas recém-desbloqueadas (aparecem na lateral da tela). */
  achievePops: {id: string; name: string; icon: string; desc: string}[];
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
  /** Quem já tem o shiny escolhe começar com a cor shiny ou normal. */
  setShinyPref(line: string, off: boolean): void;
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
  /** Escolhe o treinador e vai direto para a run dele (fresh: apaga a que ele tinha e começa outra). */
  playSolo(trainerId: string, fresh: boolean): void;
  /** Entra numa carreira online e já vai jogando: continua a temporada ou começa a próxima. */
  playOnline(trainerId: string): Promise<void>;
  /** Continua a carreira do treinador atual (ou mostra a carreira se precisa esperar). */
  continueCareer(): void;
  chooseStartBiome(id: string, region?: string): void;
  finishBattle(outcome: 'won' | 'caught' | 'fled' | 'lost'): void;
  resolvePending(choice: string | number | null): void;
  /** Pega a recompensa; com `target`, já usa/equipa o item nesse Pokémon. */
  pickReward(itemId: string, target?: string): void;
  reroll(): void;
  buy(itemId: string): void;
  skipReward(): void;
  chooseNextBiome(id: string | null): void;
  /** Mapa de Região: escolhe a próxima região (null = ficar). */
  chooseNextRegion(id: string | null): void;
  /** Depois da roleta de viagem, segue para a próxima ronda. */
  continueTravel(): void;
  /** Fim da estadia: escolhe a região (e depois o bioma) entre as opções sorteadas. */
  travelPick(id: string): void;
  /** Encontro com a lenda: aceitar (vai para a arena) ou deixar para outra hora. */
  answerLegend(accept: boolean): void;
  /** Fecha a conversa de depois da luta com a lenda. */
  closeLegendAfter(): void;
  /** Ginásio: sai da conversa com o líder e começa a luta. */
  startGymBattle(): void;
  closeBadgeWon(): void;
  /** Compra o ingresso e marca a ronda da luta de ginásio. */
  scheduleGym(id: string, wave: number): void;
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
  /** Carreira online: busca os resultados das partidas com jogadores e avança a chave. */
  tourSync(): Promise<void>;
  /** Carreira: usa o mundo (bots) da nuvem nesta ronda, igual para todos. */
  worldSync(): Promise<void>;
  /** Torneio da carreira: pega (ou grava) a chave na nuvem para todo mundo jogar a mesma. */
  tourLoad(): Promise<void>;
  /** Resultado da partida ao vivo contra outro jogador. */
  tourDuelResult(r: {won: boolean; highlights: string[]; left: number; myTeam: string[]; foeTeam: string[]; host: boolean}): void;
  /** Carreira online: tenta seguir para a próxima ronda (se todo mundo já terminou a atual). */
  careerContinue(): Promise<void>;
  /** Quickplay: começa um campeonato avulso com o time escolhido. */
  startQuickTour(kind: TourKind, team: string[]): void;
  /** Atualiza o run atual após mexer no controlador de batalha. */
  touch(): void;
}

/** Passe de Estadia e Passe Regional: não ficam na mochila, valem assim que você ganha ou compra. */
const isStayPass = (item: {travel?: string}) => item.travel === 'biomeStay' || item.travel === 'regionStay';

function emptyRun(): RunState {
  return {
    version: 1,
    id: uid(),
    startedAt: Date.now(),
    wave: 0,
    biome: BIOMES[0].id,
    region: REGIONS[0].id,
    regionLeft: REGION_STAY,
    biomeLeft: BIOME_STAY,
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

/** Chance de dois selvagens aparecerem juntos (batalha em dupla). */
/** Quantas opções sorteadas aparecem no fim da estadia (a atual pode ou não estar entre elas). */
const TRAVEL_OPTIONS = 4;
/** Chance de ganhar a insígnia por mérito mesmo perdendo (raro, como no anime). */
const MERIT_CHANCE = 0.03;
const TOUR_HYPE = {cup: 0, regional: 1, international: 2, worlds: 3} as const;
const DOUBLE_CHANCE = 0.05;

const boot = loadTrainers();
const bootTrainer = boot.list.find(t => t.id === boot.current) ?? null;

export const useGame = create<Store>((set, get) => {
  const tid = () => get().trainer?.id ?? null;
  /** De quem é a coleção (numa carreira com coleção liberada, a do treinador escolhido). */
  const cid = () => get().trainer?.career?.colFrom ?? tid();
  /** Muda os dados de carreira do treinador atual (temporada, pontos guardados, resultados). */
  const patchCareer = (patch: Partial<TrainerCareer>) => {
    const t = get().trainer;
    if (!t?.career) return;
    const trainer = {...t, career: {...t.career, ...patch}};
    const trainers = get().trainers.map(x => (x.id === t.id ? trainer : x));
    saveTrainers(trainers, trainer.id);
    set({trainers, trainer});
  };

  /** Seu progresso como os outros jogadores veem. */
  const playerDoc = (run: RunState | null, ended: boolean): PlayerDoc | null => {
    const t = get().trainer;
    if (!t?.career) return null;
    const live = run?.career && !ended && run.career.season === t.career.season ? run : null;
    return {
      id: playerId(t.id),
      name: t.name,
      avatar: t.avatar,
      season: Math.min(t.career.season, get().career?.rules.seasons ?? t.career.season),
      round: live ? Math.ceil(live.wave / waveStep(live)) : 0,
      points: live ? seasonPoints(live) : 0,
      banked: t.career.banked,
      team: (live ?? run)?.party.map(snapMon) ?? [],
      tours: live?.career?.tours ?? {},
      results: t.career.results,
      done: t.career.done,
      cleared: live ? live.cleared ?? 0 : 0,
      out: !!run?.career && run.career.season === t.career.season && (ended || run.phase === 'gameOver'),
      log: live ? groupLog(live.pointLog ?? []) : [],
      usage: live ? (live.usage ?? live.career?.usage ?? {}) : {},
      fights: live ? (live.fights ?? live.career?.fights ?? []) : [],
      badges: live ? (live.badges ?? []).map(id => ({gym: id, ...(live.badgeInfo?.[id] ?? {wave: 0, team: [], tries: 1})})) : [],
      legends: live ? legendsBeaten(live) : [],
      partner: (live ?? run)?.party.find(m => m.partner)?.species,
      updatedAt: Date.now(),
    };
  };

  const pushNow = (run: RunState | null, ended = false) => {
    const t = get().trainer;
    const doc = playerDoc(run, ended);
    if (!t?.career || !doc) return;
    cloud.putPlayer(t.career.code, doc).catch(() => undefined);
  };

  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Junta várias mudanças seguidas num envio só. */
  const schedulePush = () => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      pushNow(get().run);
    }, 2500);
  };

  /** Jogadores que ainda não terminaram a ronda atual (carreira online). */
  const waitingFor = (run: RunState) => {
    const t = get().trainer;
    if (!run.career || !t) return [];
    return roundBlockers(get().careerPeers, playerId(t.id), run.career.season, run.wave);
  };

  /** Resultados das partidas com jogadores (nuvem), por chave. */
  let tourResults: Record<string, MatchResult> = {};

  /** Aplica uma mudança numa cópia do run e salva. */
  const mutate = (fn: (run: RunState, col: Collection) => void) => {
    const cur = get().run;
    if (!cur) return;
    const run = structuredClone(cur);
    const col = structuredClone(get().collection);
    fn(run, col);
    if (run.quick) {
      // Campeonato rápido: nada vai para a coleção nem para o save da run de verdade.
      set({run});
      return;
    }
    if (run.career) enforceRules(run).forEach(n => get().toast(n));
    const fresh = tid() ? checkAchievements(col, run) : [];
    saveRun(tid(), run);
    if (run.career) schedulePush();
    saveCollection(cid(), col);
    set({run, collection: col});
    fresh.forEach((name, i) => {
      const a = ACHIEVEMENTS.find(x => x.name === name);
      const pop = {id: uid(), name, icon: a?.icon ?? 'star', desc: a?.desc ?? ''};
      // Uma de cada vez, com um respiro entre elas.
      setTimeout(() => {
        set({achievePops: [...get().achievePops, pop]});
        setTimeout(() => set({achievePops: get().achievePops.filter(x => x.id !== pop.id)}), 5200);
      }, i * 900);
    });
  };

  /** Mexe só na coleção (tela da coleção, fora da run). */
  const editCollection = (fn: (col: Collection) => boolean | void) => {
    const col = structuredClone(get().collection);
    if (fn(col) === false) return;
    saveCollection(cid(), col);
    set({collection: col});
  };

  const findMon = (run: RunState, monUid: string): OwnedMon | undefined =>
    run.party.find(m => m.uid === monUid) ?? run.box.find(m => m.uid === monUid);

  const healAll = (run: RunState) => {
    for (const m of run.party) m.hp = maxHp(m);
  };

  /** Cola a insígnia: caderneta (registro da vitória), pontos e Glória. `merit`: dada mesmo com a derrota. */
  const awardBadge = (run: RunState, col: Collection, gym: Gym, enc: Encounter, turns: number, merit: boolean) => {
    const prev = col.badgeLog?.[gym.id];
    const team = enc.team ?? [enc.mon];
    col.badgeLog = {
      ...col.badgeLog,
      [gym.id]: prev
        ? {...prev, wins: prev.wins + 1}
        : {at: Date.now(), wave: run.wave, turns, team: run.party.map(m => m.species), leaderTeam: team.map(m => m.species), leaderLevel: Math.max(...team.map(m => m.level)), wins: 1, merit},
    };
    if (run.badges?.includes(gym.id)) return;
    run.badgeInfo = {...run.badgeInfo, [gym.id]: {wave: run.wave, team: run.party.map(m => m.species), tries: (run.gymTries?.[gym.id] ?? 0) + 1}};
    run.badgeWon = gym.id;
    run.badgeMerit = merit;
    run.badges = [...(run.badges ?? []), gym.id];
    addPoints(run, col, 'gyms', POINTS.badge, true, `${gym.badge} (${gym.leader})${merit ? ' por mérito' : ''}`);
    col.glory = (col.glory ?? 0) + GYM_PRIZE.glory;
    run.tourGlory = (run.tourGlory ?? 0) + GYM_PRIZE.glory;
    if (badgesIn(run, gym.region) === gymsOf(gym.region).length) {
      col.glory += GYM_PRIZE.book;
      run.tourGlory += GYM_PRIZE.book;
      addPoints(run, col, 'books', POINTS.book, true, `${bookName(gym.region)} de ${getRegion(gym.region).name} completa`);
      col.badgeBooks = {...col.badgeBooks, [gym.region]: (col.badgeBooks?.[gym.region] ?? 0) + 1};
    }
  };

  /** Você aos olhos das lendas: nome, fama e títulos. */
  const fameOf = (): Fame => {
    const c = careerOf(get().collection);
    return {name: get().trainer?.name ?? 'Você', fame: c.fame, worlds: c.titles.worlds ?? 0, titles: Object.values(c.titles).reduce((a, b) => a + (b ?? 0), 0)};
  };

  /** Notícias dos amigos da carreira (insígnias e lendas) para o jornal. */
  const peerNews = (run: RunState) => {
    if (!run.career) return [];
    const me = get().trainer ? playerId(get().trainer!.id) : '';
    return get()
      .careerPeers.filter(p => p.id !== me && p.season === run.career!.season)
      .flatMap(p => [
        ...(p.badges ?? []).map(b => {
          const g = getGym(b.gym);
          return {wave: b.wave, who: p.name, weight: 3, text: `${p.name} ganhou a ${g?.badge ?? 'insígnia'} de ${g?.leader ?? '?'}${b.tries > 1 ? ` na ${b.tries}ª tentativa` : ''}, com ${listPt(b.team.slice(0, 3))}.`};
        }),
        ...(p.legends ?? []).map(l => ({wave: p.cleared ?? run.wave, who: p.name, weight: 6, text: `${p.name} venceu ${l}! Todo mundo está falando disso.`})),
      ]);
  };

  const startWave = (run: RunState) => {
    // Carreira online: a próxima ronda só começa quando todo mundo terminou esta.
    if (run.career && waitingFor(run).length) {
      run.phase = 'waiting';
      return;
    }
    run.wave += waveStep(run);
    run.event = undefined;
    if (run.world) stepWorld(run.world, run.wave, waveStep(run));
    // Runs antigas, de antes das regiões, começam em Kanto.
    if (!run.region) Object.assign(run, {region: REGIONS[0].id, regionLeft: REGION_STAY, biomeLeft: BIOME_STAY});
    // Estadias contam em rondas de jogo: numa carreira curta, cada ronda gasta mais.
    run.regionLeft = (run.regionLeft ?? REGION_STAY) - waveStep(run);
    run.biomeLeft = (run.biomeLeft ?? BIOME_STAY) - waveStep(run);
    const info = tourAt(run.wave);
    if (info) {
      if (run.career) run.career.tours = {...run.career.tours, [info.kind]: run.party.map(snapMon)};
      const t = get().trainer;
      const c = careerOf(get().collection);
      const meE = {name: t?.name ?? 'Você', avatar: t?.avatar, titles: c.titles, runnerUps: c.runnerUps, fame: c.fame};
      if (run.career && t) {
        // Carreira online: a mesma chave em todos os PCs, com os jogadores de verdade.
        const myId = playerId(t.id);
        const humans = get()
          .careerPeers.filter(p => p.id !== myId && !p.done && !p.out && p.season === run.career!.season)
          .map(p => ({name: p.name, avatar: p.avatar, titles: {}, runnerUps: 0, fame: p.banked + p.points, pid: p.id, team: p.team.slice(0, info.teamSize).map(fromSnap)}));
        const tid = `s${run.career.season}-${info.kind}`;
        const region = withSeed(`${run.career.code}-${tid}`, () => pick(REGIONS).id);
        run.tournament = createSharedTournament(info, [...humans, {...meE, pid: myId, team: run.party.slice(0, info.teamSize).map(m => structuredClone(m))}], myId, `${run.career.code}-${tid}`, region, run.world);
      } else run.tournament = createTournament(info, meE, run.region, [], run.world);
      run.encounter = undefined;
      run.upcoming = undefined;
      run.phase = 'tournament';
      battle = null;
      return;
    }
    // Ginásio marcado para esta ronda.
    const booked = run.gyms?.find(g => g.wave === run.wave);
    if (booked) {
      run.gyms = run.gyms!.filter(g => g !== booked);
      const gym = getGym(booked.id);
      if (gym && gym.region === run.region) {
        run.encounter = gymEncounter(gym, run, fameOf());
        run.phase = 'gymIntro';
        run.rerolls = 0;
        battle = null;
        return;
      }
      run.money += booked.paid ?? 0;
      get().toast('Você saiu da região do ginásio: o ingresso foi devolvido.');
    }
    run.encounter = run.upcoming?.shift();
    const hinted = !run.encounter && !isBossWave(run.wave) ? rollHintLegendary(run) : null;
    if (hinted) {
      const h = hintHere(run)!;
      run.encounter = hinted;
      run.diary = run.diary?.filter(id => id !== h.id);
      run.found = [...(run.found ?? []), h.id];
    }
    const legend = !run.encounter && !isBossWave(run.wave) ? rollLegend(run) : null;
    if (legend) {
      // Antes da luta tem o encontro: a lenda te acha (e desafia) ou você a acha.
      run.legendMeet = {id: legend.id, kind: Math.random() < 0.5 ? 'approach' : 'found'};
      run.phase = 'legend';
      battle = null;
      return;
    }
    fillEncounter(run);
  };

  /** Encontro normal da ronda (selvagem, às vezes em dupla). */
  const fillEncounter = (run: RunState) => {
    if (!run.encounter) {
      // Evita repetir a mesma espécie das últimas rondas (biomas pareciam sempre iguais).
      for (let i = 0; i < 4; i++) {
        run.encounter = generateEncounter(run.wave, run.biome, run.incenseWaves > 0 || !!getBiome(run.biome).region, run.perks?.luck, run.region);
        if (!run.recent?.includes(run.encounter.mon.species)) break;
      }
    }
    // Amuleto Brilhante: chance extra de shiny (fica ~3x mais comum).
    if (run.bag.shinycharm && !run.encounter!.trainer && !run.encounter!.mon.shiny && Math.random() < 2 / 256) run.encounter!.mon.shiny = true;
    // Shinies no time atraem mais shinies: cada um soma conforme a raridade.
    const glow = shinyGlow(run.party);
    if (glow > 0 && !run.encounter!.trainer && !run.encounter!.mon.shiny && Math.random() < glow / 256) run.encounter!.mon.shiny = true;
    // Dupla: às vezes (5%) dois selvagens aparecem juntos. Nunca com chefes, lendas ou ginásios.
    const enc0 = run.encounter!;
    if (!enc0.boss && !enc0.trainer && !enc0.team && run.wave >= 5 && run.party.filter(m => m.hp > 0).length >= 2 && Math.random() < DOUBLE_CHANCE) {
      const second = generateEncounter(run.wave, run.biome, run.incenseWaves > 0, run.perks?.luck, run.region).mon;
      run.encounter = {...enc0, team: [enc0.mon, second], double: true};
    }
    if (!run.encounter!.legend) run.recent = [run.encounter!.mon.species, ...(run.recent ?? [])].slice(0, 8);
    if (!run.upcoming?.length) run.upcoming = undefined;
    if (run.incenseWaves > 0) run.incenseWaves--;
    run.phase = 'battle';
    run.rerolls = 0;
    battle = null;
  };

  const goToReward = (run: RunState) => {
    run.cleared = run.wave;
    run.rewardTaken = undefined;
    run.rewardOptions = rollRewards(run.wave, 3 + (run.perks?.rewards ?? 0), run.skipStreak ?? 0, run.bag);
    run.phase = 'reward';
  };

  const afterReward = (run: RunState) => {
    run.cleared = run.wave;
    if (run.wave >= SEASON_LENGTH) {
      run.phase = 'stageClear';
      return;
    }
    if (run.wave % HEAL_EVERY === 0) {
      for (const m of run.party) m.hp = maxHp(m);
      run.log.push('Centro Pokémon: seu time foi curado!');
    }
    // Fim da estadia: sorteia 4 opções entre todas (a atual pode ou não aparecer) e o jogador escolhe.
    const fromRegion = run.region;
    const fromBiome = run.biome;
    if ((run.regionLeft ?? 1) <= 0) {
      const regionOptions = shuffle(REGIONS.map(r => r.id)).slice(0, TRAVEL_OPTIONS + (run.perks?.regions ?? 0));
      run.travel = {fromRegion, fromBiome, regionOptions};
      run.phase = 'travel';
      return;
    }
    if ((run.biomeLeft ?? 1) <= 0) {
      run.travel = {fromBiome, biomeOptions: travelBiomes(run)};
      run.phase = 'travel';
      return;
    }
    nextStop(run);
  };

  /** Opções de bioma da viagem: 4 sorteados entre todos; o oculto da região às vezes entra no lugar de um. */
  const travelBiomes = (run: RunState): string[] => {
    const options = shuffle(BIOMES.map(b => b.id)).slice(0, TRAVEL_OPTIONS + (run.perks?.biomes ?? 0));
    const special = rollBiome(run);
    if (getBiome(special).region && !options.includes(special)) options[Math.floor(Math.random() * options.length)] = special;
    return options;
  };

  /** Troca o bioma e reinicia a estadia nele. */
  const setBiome = (run: RunState, id: string) => {
    if (id !== run.biome) run.visited = [run.biome, ...(run.visited ?? [])].slice(0, 4);
    run.biome = id;
    run.biomeLeft = BIOME_STAY;
    run.biomePass = false;
    run.upcoming = undefined;
  };

  /** Mapas abertos primeiro, depois um evento ou a próxima ronda. */
  const nextStop = (run: RunState) => {
    run.travel = undefined;
    if (run.regionMapReady) run.phase = 'regionChoice';
    else if (run.mapReady) run.phase = 'biomeChoice';
    else if (shouldRollEvent(run) && !run.gyms?.some(g => g.wave === run.wave + waveStep(run))) {
      run.event = rollEvent(run, {fame: careerOf(get().collection).fame, news: peerNews(run)});
      run.lastEventWave = run.wave;
      if (run.event.kind === 'seer') run.upcoming = run.event.upcoming;
      run.phase = 'event';
    } else startWave(run);
  };

  const endRun = (run: RunState, col: Collection, result: 'lost' | 'stageClear' | 'abandoned') => {
    const t = get().trainer;
    if (run.career && t?.career && t.career.season === run.career.season) {
      // Fim da temporada da carreira: guarda os pontos e passa para a próxima.
      const pts = seasonPoints(run);
      const season = t.career.season + 1;
      patchCareer({banked: t.career.banked + pts, season, done: season > run.career.rules.seasons});
      pushNow(run, true);
      void pts;
    }
    run.season = finishSeason(col, run, {name: t?.name ?? 'Você', avatar: t?.avatar});
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
      if (travelBlocked(run, {...item, id: '_'})) return '';
      used = true;
      switch (item.travel) {
        case 'region':
          run.regionMapReady = true;
          message = 'Você vai escolher a próxima região depois da próxima vitória.';
          break;
        case 'biomeStay':
          run.biomePass = true;
          run.biomeLeft = (run.biomeLeft ?? 0) + BIOME_STAY;
          message = `Estadia dobrada: mais ${BIOME_STAY} rondas neste bioma.`;
          break;
        case 'regionStay':
          run.regionPass = true;
          run.regionLeft = (run.regionLeft ?? 0) + regionStay(run);
          message = `Estadia dobrada: mais ${regionStay(run)} rondas em ${getRegion(run.region).name}.`;
          break;
        default:
          run.mapReady = true;
          message = 'Você vai escolher o bioma depois da próxima vitória.';
      }
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
          const options = shuffle(teachableMoves(species(mon.species), true).filter(m => !mon.moves.includes(m)));
          if (options.length) {
            // 3 sorteados, e um deles tende a ser forte (poder 80+ ou de preparar).
            const strong = options.find(m => movePrice(m) >= 20);
            const moves = [...new Set([...(strong ? [strong] : []), ...options])].slice(0, 3);
            run.pending.push({kind: 'tmChoice', uid: mon.uid, moves: shuffle(moves)});
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
      const cached = trainer?.career ? cachedCareer(trainer.career.code) : {doc: null, peers: []};
      set({trainer, run: loadRun(trainer?.id ?? null), collection: loadCollection(trainer?.career?.colFrom ?? trainer?.id ?? null), screen: 'title', career: cached.doc, careerPeers: cached.peers});
      if (trainer?.career) void get().refreshCareer();
    },
    createTrainer(name, avatar) {
      if (get().trainers.filter(t => !t.career).length >= MAX_TRAINERS) return;
      const t = newTrainer(name, avatar);
      set({trainers: [...get().trainers, t]});
      get().selectTrainer(t.id);
    },
    updateTrainer(id, patch) {
      const trainers = get().trainers.map(t =>
        t.id === id ? {...t, avatar: patch.avatar ?? t.avatar, name: patch.name?.trim().slice(0, 16) || t.name} : t,
      );
      saveTrainers(trainers, tid());
      set({trainers, trainer: trainers.find(t => t.id === get().trainer?.id) ?? null});
    },
    removeTrainer(id) {
      deleteTrainerData(id);
      const trainers = get().trainers.filter(t => t.id !== id);
      set({trainers});
      if (get().trainer?.id === id) get().selectTrainer(null);
      else saveTrainers(trainers, tid());
    },
    career: bootTrainer?.career ? cachedCareer(bootTrainer.career.code).doc : null,
    careerPeers: bootTrainer?.career ? cachedCareer(bootTrainer.career.code).peers : [],
    enterCareer(doc, name, avatar, colFrom) {
      const base = newTrainer(name, avatar);
      const t: Trainer = {...base, career: {code: doc.code, colFrom, season: 1, banked: 0, results: []}};
      const trainers = [...get().trainers, t];
      saveTrainers(trainers, t.id);
      battle = null;
      // Quem criou vê o código para mandar aos amigos; quem entrou já vai escolher o time.
      const screen: Screen = doc.host === deviceId() ? 'career' : 'run';
      set({trainers, trainer: t, run: null, collection: loadCollection(colFrom ?? t.id), career: doc, careerPeers: [], screen});
      cacheCareer(doc.code, doc, []);
      pushNow(null);
      setTimeout(() => void get().refreshCareer(), 600);
    },
    async refreshCareer() {
      const t = get().trainer;
      if (!t?.career) return;
      try {
        const [doc, peers] = await Promise.all([cloud.getCareer(t.career.code), cloud.players(t.career.code)]);
        if (get().trainer?.id !== t.id) return;
        set({career: doc ?? get().career, careerPeers: peers});
        cacheCareer(t.career.code, get().career, peers);
      } catch {
        /* sem internet: fica com a última leitura */
      }
    },
    pushCareer() {
      pushNow(get().run);
    },
    screen: 'title',
    run: loadRun(bootTrainer?.id ?? null),
    collection: loadCollection(bootTrainer?.career?.colFrom ?? bootTrainer?.id ?? null),
    toasts: [],
    achievePops: [],
    ivGain: null,
    clearIvGain: () => set({ivGain: null}),
    typeCalc: null,
    openTypeCalc: types => set({typeCalc: types}),

    setScreen: screen => {
      // Sair de um campeonato rápido no meio encerra ele e volta para a run de verdade.
      if (screen !== 'run' && get().run?.quick) {
        battle = null;
        return set({screen, run: loadRun(tid())});
      }
      set({screen});
    },

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
      const tc = get().trainer?.career;
      if (tc) {
        const doc = get().career;
        if (!doc || tc.done) return;
        run.career = {code: tc.code, season: tc.season, rules: doc.rules};
      }
      applyPerks(run, perksOf(col));
      run.regionLeft = regionStay(run);
      run.rivalPoints = rollRivalPoints(col);
      // Os rivais jogam a temporada junto. Na carreira, a temporada seguinte continua com os mesmos.
      const prevRun = get().run;
      run.world = run.career
        ? prevRun?.career?.code === run.career.code && prevRun.world && prevRun.career.season < run.career.season
          ? nextSeasonWorld(prevRun.world)
          : newWorld()
        : newWorld(leagueOf(col).npcs);
      const unlockNotes: string[] = [];
      run.party = picked.map(name => {
        const mon = createMon(name, {
          level: START_LEVELS[perksOf(col).level ?? 0] ?? STARTER_LEVEL,
          ivs: starterIvs(col, name),
          ivMin: 10,
          hiddenAbilityChance: 0,
          shinyChance: shinyChance(col, name),
        });
        applyEntry(col, mon);
        // Já tem o shiny desta linha: começa shiny, a não ser que prefira a cor normal.
        const line = col.entries[lineRoot(name)];
        if (line?.shiny) mon.shiny = !line.shinyOff;
        const reg = registerStarter(col, mon);
        const news = [reg.newNature && `nature ${mon.nature}`, reg.newAbility && `habilidade ${mon.ability}`, reg.betterIvs && 'IVs melhores'].filter(Boolean);
        if (news.length) unlockNotes.push(`${species(lineRoot(name)).name}: ${news.join(', ')} guardado(s) na ficha!`);
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
      saveCollection(cid(), col);
      set({run, collection: col, screen: 'run'});
      unlockNotes.forEach(n => get().toast(n));
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
              addTrail(run, TRAIL.event);
              ev.mon.hp = maxHp(ev.mon);
              join(ev.mon, HEART_STEPS[1]);
            } else {
              const gift = rollRewards(run.wave, 1, 0, run.bag).find(id => getItem(id).kind !== 'money') ?? 'potion';
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
              addTrail(run, TRAIL.event);
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
          case 'tutor': {
            const [monUid, move] = (choice ?? '').split('|');
            const mon = run.party.find(m => m.uid === monUid);
            if (!mon || !move || !tutorMoves(mon).includes(move)) break;
            const price = tutorPrice(run, move);
            if (run.money < price) return;
            run.money -= price;
            if (mon.moves.length < 4) {
              mon.moves.push(move);
              message = `${displayName(mon)} aprendeu ${dex.moves.get(move).name}!`;
            } else run.pending.push({kind: 'learnMove', uid: mon.uid, move});
            break;
          }
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
          case 'news':
            if (choice === 'read') {
              addTrail(run, TRAIL.news);
              if (trailOf(run) > 0) message = `Uma das notícias falava de pistas de uma lenda em ${getRegion(run.region).name}. Rastro: ${Math.min(trailOf(run), 40)}%`;
            }
            break;
          case 'place': {
            if (choice !== 'yes') break;
            const t = getPlace(ev.theme);
            addTrail(run, TRAIL.event);
            if (ev.mon) {
              const name = species(ev.mon.species).name;
              join(ev.mon, HEART_STEPS[0]);
              message = `${name} gostou de você e entrou no time!`;
            } else if (ev.item) {
              run.bag[ev.item] = (run.bag[ev.item] ?? 0) + 1;
              message = `No fundo do navio você achou ${getItem(ev.item).name}!`;
            } else if (t.reward === 'heal') {
              healAll(run);
              for (const m of run.party) addHeartPts(col, m.species, HEART_PTS.win);
              message = 'O time inteiro descansou na água quentinha: todos curados e mais felizes.';
            } else if (t.reward === 'exp') {
              run.bag.rarecandy = (run.bag.rarecandy ?? 0) + 1;
              for (const m of run.party) addHeartPts(col, m.species, HEART_PTS.win);
              message = 'O mestre gostou do treino e te deu um Doce Raro.';
            }
            break;
          }
          case 'life': {
            if (ev.theme === 'mom') {
              const gift = 200 + run.wave * 15;
              run.money += gift;
              run.bag.potion = (run.bag.potion ?? 0) + 2;
              message = `A mãe mandou ₽ ${gift} e 2 Poções. "Se cuida, viu?"`;
            } else if (ev.theme === 'center') {
              healAll(run);
              message = 'Noite bem dormida no Centro Pokémon: time curado.';
            } else if (ev.theme === 'birthday') {
              const mon = run.party.find(m => m.uid === ev.uid);
              if (mon) {
                addHeartPts(col, mon.species, HEART_PTS.stageClear);
                addCandies(col, mon.species, 5);
                message = `Festa para ${displayName(mon)}! +corações e +5 doces.`;
              }
            }
            break;
          }
          case 'fan':
            if (choice === 'sign') {
              addTrail(run, TRAIL.fan);
              const gift = 100 + run.wave * 10;
              run.money += gift;
              message = `O fã ficou radiante e te deu ₽ ${gift}. Ele contou um boato de lenda: rastro ${Math.min(trailOf(run), 40)}%.`;
            }
            break;
          case 'traveler':
            if (choice === 'help') {
              if (ev.ask === 'money') {
                if (run.money < (ev.cost ?? 0)) return;
                run.money -= ev.cost ?? 0;
              } else {
                const id = ev.ask === 'heal' ? cheapestHeal(run) : ev.item;
                if (!id || !run.bag[id]) return;
                run.bag[id]--;
                if (!run.bag[id]) delete run.bag[id];
              }
              run.diary = [...(run.diary ?? []), ev.hint];
              addPoints(run, col, 'travelers', POINTS.traveler, true, `Viajante ajudado (${getRegion(run.region).name})`);
              addTrail(run, TRAIL.traveler);
              const h = getHint(ev.hint);
              message = `Dica anotada no diário!${h ? ` (${getRegion(h.region).name} · ${getBiome(h.biome).name})` : ''}`;
            }
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
    setShinyPref(line, off) {
      editCollection(col => {
        const e = col.entries[lineRoot(line)];
        if (!e?.shiny) return false;
        e.shinyOff = off || undefined;
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

    playSolo(trainerId, fresh) {
      if (get().trainer?.id !== trainerId) get().selectTrainer(trainerId);
      if (fresh || !runActive(get().run)) get().abandonRun();
      set({screen: 'run'});
    },

    async playOnline(trainerId) {
      if (get().trainer?.id !== trainerId) get().selectTrainer(trainerId);
      if (!get().trainer?.career) return;
      if (!get().career || !runActive(get().run)) await get().refreshCareer();
      if (get().trainer?.id === trainerId) get().continueCareer();
    },

    continueCareer() {
      const {trainer, career, careerPeers, run} = get();
      const tc = trainer?.career;
      if (!trainer || !tc) return;
      if (runActive(run)) return set({screen: 'run'});
      // Carreira acabou, sem internet ou esperando os amigos fecharem a temporada: mostra a carreira.
      if (tc.done || !career || seasonBlockers(careerPeers, playerId(trainer.id), tc.season).length) return set({screen: 'career'});
      get().abandonRun();
      set({screen: 'run'});
    },

    chooseStartBiome(id, region) {
      mutate(run => {
        run.biome = id;
        if (region) run.region = region;
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
        if (ctl && !run.quick) {
          // Para o seu perfil (e para os amigos estudarem você): quem jogou cada ronda e as lutas importantes.
          const used = run.party.filter(m => ctl.participants.has(m.uid)).map(m => m.species);
          const usage = {...run.usage};
          for (const sp of used) usage[sp] = (usage[sp] ?? 0) + 1;
          run.usage = usage;
          const kind: CareerFight['kind'] | null = enc.gym ? 'gym' : enc.tournament ? 'tour' : enc.legend ? 'legend' : enc.trainer ? 'rival' : enc.boss ? 'boss' : null;
          if (kind && outcome !== 'fled')
            run.fights = [{vs: enc.trainer ?? species(enc.mon.species).name, won: outcome === 'won' || outcome === 'caught', seen: used, kind, wave: run.wave}, ...(run.fights ?? [])].slice(0, 12);
        }
        if (enc.tournament && run.tournament && ctl) {
          // Partida de torneio: perder não acaba a run, só tira você do torneio.
          const t = run.tournament;
          const won = outcome === 'won';
          const me = get().trainer?.name ?? 'Você';
          const foe = enc.trainer ?? '?';
          const left = won ? ctl.battle.p1.pokemon.filter(p => !p.fainted).length : ctl.battle.p2.pokemon.filter(p => !p.fainted).length;
          const mine = t.shared ? myPending(t) : null;
          recordPlayerResult(t, won, run.party.map(m => m.species), highlightsFromLog(ctl.battle.log, me, foe, won ? me : foe, left), left);
          if (mine && run.career) {
            // Partida contra bot no torneio da carreira: o resultado vai para a nuvem para os outros.
            const m = t.rounds[mine.round][mine.index];
            void cloud.putMatch(run.career.code, {tid: t.shared!.tid, key: matchKey(mine.round, mine.index), winner: m.winner!, teams: m.teams, highlights: m.highlights, left: m.left}).catch(() => undefined);
            sharedAdvance(t, tourResults);
          }
          if (!won) {
            healAll(run);
            run.phase = 'tournament';
            get().toast(`${foe} venceu. Fim do torneio para você, mas a temporada continua!`);
            return;
          }
        } else if (outcome === 'lost' && enc.gym) {
          healAll(run);
          run.gymTries = {...run.gymTries, [enc.gym]: (run.gymTries?.[enc.gym] ?? 0) + 1};
          // Muito raro, como no anime: o líder dá a insígnia por mérito mesmo com a derrota
          // (só se você derrubou pelo menos metade do time dele).
          const gymLost = getGym(enc.gym);
          const downed = ctl ? ctl.battle.p2.pokemon.filter(p => p.fainted).length : 0;
          if (gymLost && !run.badges?.includes(gymLost.id) && downed * 2 >= (enc.team?.length ?? 1) && Math.random() < MERIT_CHANCE) {
            awardBadge(run, col, gymLost, enc, ctl?.battle.turn ?? 0, true);
          } else get().toast(`${enc.trainer} venceu. Seu time foi curado; dá para tentar de novo com outro ingresso.`);
          afterReward(run);
          return;
        } else if (outcome === 'lost' && enc.legend) {
          // Perder para uma lenda não acaba a run: o time é curado e a jornada segue.
          healAll(run);
          run.legendAfter = {id: enc.legend, won: false};
          get().toast(`${enc.trainer} venceu desta vez. Seu time foi curado: a jornada continua!`);
          afterReward(run);
          return;
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
          // Em dupla, a EXP soma os dois selvagens.
          const exp = enc.double ? (enc.team ?? [enc.mon]).reduce((a, m) => a + expYield(m, false), 0) : expYield(enc.mon, enc.boss || !!enc.trainer);
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
            const share = (fought ? 1 : run.bag.expall ? 0.8 : 0.5) * (run.bag.luckyegg ? 1.5 : 1);
            const bonus = expBonus(heartsOf(col.entries[lineRoot(m.species)]));
            const r = gainExp(m, Math.floor(exp * share * bonus * careerBoost(run)));
            if (r.levelsGained) run.log.push(`${m.species} subiu para o nível ${m.level}!`);
            events.push(...r.events);
          }
        }
        if (outcome === 'caught') {
          run.stats.caught++;
          // Em dupla, captura o selvagem que sobrou em campo.
          const mon = structuredClone(enc.double && ctl ? enc.team?.[ctl.caughtIndex] ?? enc.mon : enc.mon);
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
        const money = enc.tournament ? 0 : Math.round(moneyReward(run.wave, enc.boss || !!enc.trainer) * (enc.trainer ? 2 : 1) * (run.bag.amuletcoin ? 1.5 : 1) * careerBoost(run));
        run.money += money;
        // Chefe vencido ou capturado deixa a lenda da região de olho em você.
        if ((outcome === 'won' || outcome === 'caught') && enc.boss && !enc.trainer && !enc.hinted) {
          const before = trailOf(run);
          addTrail(run, TRAIL.boss);
          if (trailOf(run) > before) get().toast(`Rastro da lenda de ${getRegion(run.region).name}: ${Math.min(trailOf(run), 40)}%`);
        }
        if ((outcome === 'won' || outcome === 'caught') && enc.hinted) addPoints(run, col, 'legendaries', POINTS.legendary, true, `Lendário pela dica: ${species(enc.mon.species).name}`);
        const gym = outcome === 'won' && enc.gym ? getGym(enc.gym) : undefined;
        if (gym) awardBadge(run, col, gym, enc, ctl?.battle.turn ?? 0, false);
        if (outcome === 'won' && enc.legend) {
          run.legendAfter = {id: enc.legend, won: true};
          const prize = legendPrize(run.wave);
          col.legends = {...col.legends, [enc.legend]: (col.legends?.[enc.legend] ?? 0) + 1};
          addPoints(run, col, 'legends', POINTS.legend, true, `Vitória sobre ${enc.trainer}`);
          col.glory = (col.glory ?? 0) + prize.glory;
          run.tourGlory = (run.tourGlory ?? 0) + prize.glory;
          run.money += prize.money;
          statsOf(col).moneyEarned += prize.money;
          for (const m of run.party) addHeartPts(col, m.species, HEART_PTS.stageClear * (m.partner ? 2 : 1));
          get().toast(`Você venceu ${enc.trainer}! +₽ ${prize.money} · +${prize.glory} Glória`);
        }
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
          // Palco do torneio: arena improvisada na League Cup, estádio lotado no Mundial.
          venue: TOUR_HYPE[t.kind],
          hype: TOUR_HYPE[t.kind],
          intro: introLines({...me, titles: c.titles, runnerUps: c.runnerUps, fame: c.fame}, foe, info.name, currentRound(t), !!c.defending[t.kind], TOUR_HYPE[t.kind]),
        };
        run.phase = 'battle';
        battle = null;
      });
    },

    startQuickTour(kind, team) {
      const info = tourInfo(kind);
      const run = emptyRun();
      run.quick = true;
      run.wave = info.wave;
      const level = Math.max(5, Math.round(info.wave * 0.9) + 1);
      run.party = team.map(name => createMon(name, {level, ivMin: 15, shinyChance: 0.01, hiddenAbilityChance: 0.1}));
      const t = get().trainer;
      run.tournament = createTournament(info, {name: t?.name ?? 'Você', avatar: t?.avatar, titles: {}, runnerUps: 0, fame: 0}, run.region);
      run.phase = 'tournament';
      battle = null;
      set({run, screen: 'run'});
    },

    async worldSync() {
      const run = get().run;
      const w = run?.world;
      if (!run?.career || !w) return;
      const {code, season} = run.career;
      try {
        const doc = await cloudWorld.createOnce(code, season, w.wave, w);
        if (JSON.stringify(doc) === JSON.stringify(w)) return;
        mutate(r => {
          if (r.career?.season === season && r.world?.wave === doc.wave) r.world = doc;
        });
      } catch {
        // Sem internet agora: fica com o mundo daqui e tenta na próxima ronda.
      }
    },

    async tourLoad() {
      const run = get().run;
      const t = run?.tournament;
      if (!run?.career || !t?.shared || t.shared.ready) return;
      try {
        const doc = await cloudTours.createOnce(run.career.code, t.shared.tid, {region: t.region, entrants: t.entrants.map(e => ({...e, player: false, friend: false}))});
        mutate(r => {
          if (r.tournament?.shared?.tid === t.shared!.tid && !r.tournament.shared.ready) adoptShared(r.tournament, doc);
        });
      } catch {
        // Sem internet agora: a tela tenta de novo.
      }
    },

    async tourSync() {
      const run = get().run;
      const t = run?.tournament;
      if (!run?.career || !t?.shared?.ready) return;
      const code = run.career.code;
      const tid = t.shared.tid;
      try {
        const list = await cloudMatches.list(code, tid);
        tourResults = Object.fromEntries(list.map(m => [m.key, m]));
        // Partidas entre bots: quem chegar primeiro simula e grava; todo mundo usa o mesmo resultado.
        for (let guard = 0; guard < 4; guard++) {
          const cur = get().run?.tournament;
          if (!cur?.shared || cur.shared.tid !== tid) return;
          const probe = structuredClone(cur);
          sharedAdvance(probe, tourResults);
          const todo = botPending(probe).filter(b => !tourResults[b.key]);
          if (!todo.length) break;
          for (const b of todo) {
            const res = await cloudMatches.createOnce(code, simulateBotMatch(probe, b.round, b.index));
            tourResults[res.key] = res;
          }
        }
      } catch {
        return;
      }
      mutate(r => {
        if (r.tournament?.shared?.tid === tid) sharedAdvance(r.tournament, tourResults);
      });
    },

    tourDuelResult({won, highlights, left, myTeam, foeTeam, host}) {
      mutate(run => {
        const t = run.tournament;
        const mine = t?.shared ? myPending(t) : null;
        if (!t || !mine || !run.career) return;
        recordPlayerResult(t, won, myTeam, highlights, left);
        const m = t.rounds[mine.round][mine.index];
        const me = playerIndex(t);
        m.teams = m.a === me ? [myTeam, foeTeam] : [foeTeam, myTeam];
        if (host) void cloud.putMatch(run.career.code, {tid: t.shared!.tid, key: matchKey(mine.round, mine.index), winner: m.winner!, teams: m.teams, highlights, left}).catch(() => undefined);
        healAll(run);
        sharedAdvance(t, tourResults);
      });
    },

    async careerContinue() {
      await get().refreshCareer();
      mutate(run => {
        if (run.phase === 'waiting') startWave(run);
      });
    },

    tourFinish() {
      const quick = get().run;
      if (quick?.quick) {
        const t = quick.tournament;
        if (t) get().toast(`${tourName(t)}: ${placementLabel(t.placement ?? 5)}! Fim do campeonato rápido.`);
        // Volta para a run de verdade (que ficou guardada).
        set({run: loadRun(tid()), screen: 'quickplay'});
        battle = null;
        return;
      }
      mutate((run, col) => {
        const t = run.tournament;
        if (!t || t.stage !== 'done') return;
        const info = tourInfo(t.kind);
        const i = prizeIndex(t.placement ?? 5);
        applyToCareer(careerOf(col), t);
        if (run.world) worldTournament(run.world, t, tourName(t), info.fame);
        const tc = get().trainer?.career;
        if (run.career && tc) patchCareer({results: [...tc.results, {season: run.career.season, kind: t.kind, placement: t.placement ?? 5}]});
        addPoints(run, col, 'tournaments', info.fame[i], false, `${tourName(t)}: ${placementLabel(t.placement ?? 5)}`);
        col.glory = (col.glory ?? 0) + info.glory[i];
        run.tourGlory = (run.tourGlory ?? 0) + info.glory[i];
        run.money += info.money[i];
        statsOf(col).moneyEarned += info.money[i];
        if (t.placement === 1) for (const m of run.party) addHeartPts(col, m.species, HEART_PTS.stageClear * (m.partner ? 2 : 1));
        get().toast(`${tourName(t)}: ${placementLabel(t.placement ?? 5)}! +₽ ${info.money[i]} · +${info.glory[i]} Glória${info.cp[i] ? ` · +${info.cp[i]} CP` : ''}`);
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
        // Desistir do Disco Técnico devolve o disco para a mochila.
        if (ev.kind === 'tmChoice' && choice === null) run.bag.tm = (run.bag.tm ?? 0) + 1;
        if (mon && choice !== null) {
          if (ev.kind === 'learnMove' && typeof choice === 'number') {
            mon.moves[choice] = ev.move;
          } else if (ev.kind === 'tmChoice' && typeof choice === 'string' && ev.moves.includes(choice)) {
            if (mon.moves.length < 4) {
              mon.moves.push(choice);
              get().toast(`${displayName(mon)} aprendeu ${choice}!`);
            } else run.pending.unshift({kind: 'learnMove', uid: mon.uid, move: choice});
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
          if (target !== undefined || isStayPass(item)) message = applyItem(run, col, itemId, target ?? '');
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
        run.rewardOptions = rollRewards(run.wave, 3 + (run.perks?.rewards ?? 0), run.skipStreak ?? 0, run.bag);
      });
    },

    buy(itemId) {
      mutate((run, col) => {
        const item = getItem(itemId);
        const price = shopPrice(run, item);
        if (!item.price || run.money < price || travelBlocked(run, item)) return;
        run.money -= price;
        if (item.kind === 'breed') col.items = {...col.items, [itemId]: (col.items?.[itemId] ?? 0) + 1};
        else run.bag[itemId] = (run.bag[itemId] ?? 0) + 1;
        // Passes de estadia valem na hora: estendem o bioma ou a região onde você está.
        if (isStayPass(item)) {
          const msg = applyItem(run, col, itemId, '');
          if (msg) get().toast(msg);
        }
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
        if (id && id !== run.biome) setBiome(run, id);
        run.mapReady = false;
        nextStop(run);
      });
    },
    chooseNextRegion(id) {
      mutate(run => {
        if (id && id !== run.region) {
          run.region = id;
          run.regionLeft = regionStay(run);
          run.regionPass = false;
          run.upcoming = undefined;
        }
        run.regionMapReady = false;
        nextStop(run);
      });
    },
    scheduleGym(id, wave) {
      mutate(run => {
        const gym = getGym(id);
        const price = ticketPrice(run);
        if (!gym || gym.region !== run.region || gymStatus(run, gym) !== 'open') return;
        if (!gymWaves(run).includes(wave) || run.money < price) return;
        run.money -= price;
        run.gyms = [...(run.gyms ?? []), {id, wave, paid: price}].sort((a, b) => a.wave - b.wave);
      });
    },
    continueTravel() {
      mutate(run => {
        if (run.phase === 'travel') nextStop(run);
      });
    },
    travelPick(id) {
      mutate(run => {
        const t = run.travel;
        if (run.phase !== 'travel' || !t) return;
        if (t.regionOptions && !t.region) {
          if (!t.regionOptions.includes(id)) return;
          run.region = id;
          run.regionLeft = regionStay(run);
          run.regionPass = false;
          t.region = id;
          t.biomeOptions = travelBiomes(run);
          return;
        }
        if (!t.biomeOptions?.includes(id)) return;
        setBiome(run, id);
        nextStop(run);
      });
    },
    answerLegend(accept) {
      mutate(run => {
        const legend = run.legendMeet && getLegend(run.legendMeet.id);
        if (run.phase !== 'legend' || !legend) return;
        run.legendMeet = undefined;
        battle = null;
        if (accept) {
          run.trail = {...run.trail, [run.region!]: 0};
          run.encounter = legendEncounter(legend, run.party, fameOf(), getRegion(run.region).name);
          run.phase = 'battle';
          run.rerolls = 0;
          return;
        }
        // Deixou para depois: o rastro cai pela metade e a ronda segue normal.
        run.trail = {...run.trail, [run.region!]: Math.floor(trailOf(run) / 2)};
        fillEncounter(run);
      });
    },
    startGymBattle() {
      mutate(run => {
        if (run.phase !== 'gymIntro') return;
        run.phase = 'battle';
        run.rerolls = 0;
        battle = null;
      });
    },
    closeBadgeWon() {
      mutate(run => {
        run.badgeWon = undefined;
        run.badgeMerit = undefined;
      });
    },
    closeLegendAfter() {
      mutate(run => {
        run.legendAfter = undefined;
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

