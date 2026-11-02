// Rush online: cada um no seu PC. Quem cria a sala é o "dono": roda o sorteio e a batalha
// e manda tudo para o amigo; o amigo só mostra e manda as escolhas dele.
import {useEffect, useRef, useState} from 'react';
import {BattleController} from '../../game/battle';
import type {BattleEvent} from '../../game/battle';
import {drawPairs, duelBalls, duelChoose, duelNeeds, duelRequest, giveAllMegaStones, megaMode, rollLucky, rushMon} from '../../game/rush';
import type {DuelReq, LuckyShot, RushMode} from '../../game/rush';
import {hostRoom, joinRoom, newRoomCode} from '../../game/net';
import {arenaFor} from '../../game/arenas';
import type {Link} from '../../game/net';
import type {OwnedMon} from '../../game/types';
import {PixelIcon} from '../components';
import {cardOf, loadHistory, recordMatch, rememberFoe, snapOf, withWin} from '../../game/history';
import type {HistCard} from '../../game/history';
import {flipKo, koFromLog, saneKo} from '../../game/recap';
import type {Ko} from '../../game/recap';
import {useGame} from '../../game/store';
import {playCrowd, playCry, playFanfare} from '../audio';
import {fast} from '../settings';
import {requestLeave, useMatchGuard} from '../leaveGuard';
import {BattleView, DraftView, LuckyReveal, PrepScreen, RushResult} from './QuickplayScreen';
import type {Player} from './QuickplayScreen';

type Msg = Record<string, unknown>;

/** Resuminho do seu histórico agora (vai para o outro aparelho mostrar se você vencer). */
const myCard = (name: string): HistCard => cardOf(loadHistory(useGame.getState().trainer?.id), name);
/** Seu perfil para o amigo poder abrir depois (tocando no seu nome no histórico dele). */
const mySnap = (p: Player) => snapOf(loadHistory(useGame.getState().trainer?.id), p.name, p.avatar);
const keepFoe = (snap: unknown) => rememberFoe(useGame.getState().trainer?.id, snap);

/** Histórico de quem venceu: o seu (já com esta partida) ou o do amigo (o que ele mandou + esta vitória). */
function winnerCard(meIdx: 0 | 1, winner: number, players: [Player, Player], foe: HistCard | null): HistCard | null {
  if (winner === meIdx) return myCard(players[meIdx].name);
  return foe ? withWin(foe, players[meIdx].name) : null;
}

/** Histórico do perfil: grava o Rush online do ponto de vista de quem está neste aparelho. */
function logRush(s: Shared, me: 0 | 1, winner: number, note = 'Cada um no seu aparelho', ko?: Ko[]) {
  const foe = s.players[1 - me];
  recordMatch(useGame.getState().trainer?.id, {
    mode: `online-rush:${s.mode}`,
    online: true,
    won: winner === me,
    vs: foe.name,
    vsAvatar: foe.avatar,
    vsKind: 'player',
    mine: s.teams[me],
    theirs: s.teams[1 - me],
    note,
    ko,
  });
}

/** Partida em andamento (do sorteio até o fim da batalha): sair conta como derrota. */
const playing = (step?: Shared['step']) => step === 'draft' || step === 'lucky' || step === 'prep' || step === 'battle';
const QUIT = 'Saiu no meio da partida';
const FOE_QUIT = 'O adversário saiu da partida';

/** "Fulano venceu! Ciclano saiu da partida." */
export const quitTitle = (players: [Player, Player], winner: number) => `${players[winner].name} venceu! ${players[1 - winner].name} saiu da partida.`;

interface Shared {
  step: 'lobby' | 'draft' | 'lucky' | 'prep' | 'battle' | 'end';
  players: [Player, Player];
  mode: RushMode;
  round: number;
  pairs: [string, string][];
  teams: [string[], string[]];
  winner?: number;
  /** Tiro de sorte: quem ganhou o Pokémon quebrado. */
  lucky?: LuckyShot;
}

const ERRORS: Record<string, string> = {
  'peer-unavailable': 'Sala não encontrada. Confira o código (e se o seu amigo ainda está com a sala aberta).',
  'room-full': 'Essa sala já tem dois jogadores. Peça para o seu amigo criar outra.',
  network: 'Sem conexão com a internet agora. Confira o Wi-Fi ou os dados móveis.',
};

export function OnlineRush({role, code: joinCode, me, mode, onExit}: {role: 'host' | 'guest'; code?: string; me: Player; mode: RushMode; onExit: () => void}) {
  return role === 'host' ? <Host me={me} mode={mode} onExit={onExit} /> : <Guest me={me} code={joinCode ?? ''} onExit={onExit} />;
}

function Lobby({title, code, status, error, onExit}: {title: string; code?: string; status: string; error?: string; onExit: () => void}) {
  return (
    <div className="screen quickplay">
      <header className="bar">
        <button className="btn small" onClick={onExit}>
          <PixelIcon name="back" /> Sair
        </button>
        <h2>{title}</h2>
      </header>
      <div className="panel rush-lobby">
        {code && (
          <>
            <p>Mande este código para o seu amigo:</p>
            <div className="room-code">{code}</div>
          </>
        )}
        <p className={error ? 'error' : 'hint waiting'}>{error ?? status}</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Dono da sala

function Host({me, mode, onExit}: {me: Player; mode: RushMode; onExit: () => void}) {
  const [code] = useState(newRoomCode);
  const link = useRef<Link | null>(null);
  const [error, setError] = useState<string>();
  const [shared, setShared] = useState<Shared>({step: 'lobby', players: [me, {name: '...', avatar: 'red'}], mode, round: 0, pairs: [], teams: [[], []]});
  const teams = useRef<[OwnedMon[], OwnedMon[]]>([[], []]);
  const prepped = useRef<[boolean, boolean]>([false, false]);
  const [myPrep, setMyPrep] = useState(false);
  // Batalha
  const ctl = useRef<BattleController | null>(null);
  const [batches, setBatches] = useState<BattleEvent[][]>([]);
  const [idle, setIdle] = useState(false);
  const [, force] = useState(0);
  const sharedRef = useRef(shared);
  sharedRef.current = shared;
  /** Histórico que o amigo mandou ao entrar (para mostrar se ele vencer). */
  const foeHist = useRef<HistCard | null>(null);
  /** O amigo saiu no meio: vitória sua. */
  const [foeQuit, setFoeQuit] = useState(false);
  const foeLeft = () => {
    const s = sharedRef.current;
    if (!playing(s.step) || ctl.current?.ended) return false;
    logRush(s, 0, 0, FOE_QUIT);
    setFoeQuit(true);
    sharedRef.current = {...s, step: 'end', winner: 0};
    setShared(sharedRef.current);
    playFanfare(1);
    return true;
  };
  useMatchGuard(playing(shared.step) && !error, () => {
    if (ctl.current?.ended) return;
    logRush(sharedRef.current, 0, 1, QUIT);
    send({t: 'forfeit'});
  });
  const leave = () => requestLeave(onExit);

  const send = (msg: Msg) => link.current?.send(msg);
  const publish = (s: Shared) => {
    setShared(s);
    send({t: 'state', s});
  };

  const pick = (k: 0 | 1) => {
    const s = sharedRef.current;
    if (s.step !== 'draft') return;
    const who = s.round % 2;
    const pair = s.pairs[s.round];
    teams.current[who].push(rushMon(pair[k], mode));
    teams.current[1 - who].push(rushMon(pair[1 - k], mode));
    playCry(pair[k]);
    const names = (): [string[], string[]] => [teams.current[0].map(m => m.species), teams.current[1].map(m => m.species)];
    const toPrep = () => {
      // O amigo pode ter saído durante a roleta.
      if (sharedRef.current.step !== 'draft' && sharedRef.current.step !== 'lucky') return;
      publish({...sharedRef.current, teams: names(), step: 'prep'});
      send({t: 'prep', team: teams.current[1], mega: megaMode(mode)});
    };
    if (s.round + 1 >= s.pairs.length) {
      if (mode === 'lucky') {
        // A roleta roda nos dois aparelhos; depois de uns segundos vai para a preparação.
        const lucky = rollLucky(teams.current);
        publish({...s, teams: names(), step: 'lucky', lucky});
        setTimeout(toPrep, fast() ? 4000 : 12000);
      } else toPrep();
    } else publish({...s, teams: names(), round: s.round + 1});
  };

  const afterBatch = (events: BattleEvent[]) => {
    const c = ctl.current!;
    setIdle(false);
    setBatches(b => [...b, events]);
    send({t: 'events', events, balls: duelBalls(c.battle)});
    if (c.ended) {
      const winner = c.won ? 0 : 1;
      const ko = koFromLog(c.battle.log, 'p1');
      send({t: 'end', winner, hist: myCard(sharedRef.current.players[0].name), ko});
      logRush(sharedRef.current, 0, winner, undefined, ko);
      send({t: 'snap', snap: mySnap(sharedRef.current.players[0])});
      setTimeout(() => {
        playFanfare(1);
        playCrowd(1, 3);
        publish({...sharedRef.current, step: 'end', winner});
      }, 400);
      return;
    }
    send({t: 'req', req: duelNeeds(c.battle, 'p2') ? duelRequest(c.battle, 'p2') : null});
  };

  const startBattle = () => {
    const [a, b] = teams.current;
    const s = sharedRef.current;
    ctl.current = new BattleController(a, {mon: b[0], team: b, rarity: 'rare', boss: true, trainer: s.players[1].name, versus: s.players[0].name});
    publish({...s, step: 'battle'});
    afterBatch(ctl.current.initialEvents());
  };

  const onMsg = (msg: Msg) => {
    const s = sharedRef.current;
    if (msg.t === 'hello' && s.step === 'lobby') {
      foeHist.current = (msg.hist as HistCard | undefined) ?? null;
      keepFoe(msg.snap);
      publish({...s, players: [s.players[0], msg.player as Player], step: 'draft', pairs: drawPairs(mode)});
    } else if (msg.t === 'snap') {
      keepFoe(msg.snap);
    } else if (msg.t === 'forfeit') {
      foeLeft();
    } else if (msg.t === 'pick' && s.step === 'draft' && s.round % 2 === 1) {
      pick(msg.k as 0 | 1);
    } else if (msg.t === 'prepDone' && s.step === 'prep') {
      const order = msg.order as string[];
      const t = teams.current[1];
      teams.current[1] = order.map(uid => t.find(m => m.uid === uid)!).filter(Boolean).map(m => ({...m, item: undefined}));
      if (megaMode(mode)) giveAllMegaStones(teams.current[1]);
      prepped.current[1] = true;
      if (prepped.current[0]) startBattle();
      else force(x => x + 1);
    } else if (msg.t === 'choice' && s.step === 'battle' && ctl.current && duelNeeds(ctl.current.battle, 'p2')) {
      afterBatch(duelChoose(ctl.current, 'p2', msg.choice as string, !!msg.mega));
    }
  };

  useEffect(() => {
    let alive = true;
    void hostRoom(
      code,
      m => onMsg(m),
      () => send({t: 'state', s: sharedRef.current}),
      () => alive && !foeLeft() && sharedRef.current.step !== 'end' && setError('Seu amigo saiu da sala.'),
      e => setError(ERRORS[e] ?? `Erro de conexão: ${e}`),
    ).then(l => {
      if (alive) link.current = l;
      else l.close();
    });
    return () => {
      alive = false;
      link.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = shared;
  if (error && s.step !== 'end') return <Lobby title="Rush online" code={code} status="" error={error} onExit={onExit} />;
  if (s.step === 'lobby') return <Lobby title="Rush online" code={code} status="Esperando o amigo entrar na sala..." onExit={onExit} />;
  if (s.step === 'draft') return <DraftView players={s.players} mode={s.mode} round={s.round} total={s.pairs.length} pair={s.pairs[s.round]} teams={s.teams} canPick={s.round % 2 === 0} onPick={pick} />;
  if (s.step === 'lucky' && s.lucky) return <LuckyReveal players={s.players} lucky={s.lucky} />;
  if (s.step === 'prep') {
    if (myPrep) return <Lobby title="Preparação" status={`Esperando ${s.players[1].name} terminar a preparação...`} onExit={leave} />;
    return (
      <PrepScreen
        player={s.players[0]}
        team={teams.current[0]}
        foe={{player: s.players[1], team: s.teams[1]}}
        mega={megaMode(mode)}
        curtain={false}
        onDone={team => {
          teams.current[0] = team;
          prepped.current[0] = true;
          setMyPrep(true);
          if (prepped.current[1]) startBattle();
        }}
      />
    );
  }
  if (s.step === 'battle' && ctl.current) {
    const c = ctl.current;
    const mine = idle && duelNeeds(c.battle, 'p1') ? duelRequest(c.battle, 'p1') : null;
    return (
      <BattleView
        arena={arenaFor(code)}
        players={s.players}
        teams={s.teams}
        bottom="p1"
        batches={batches}
        balls={duelBalls(c.battle)}
        req={mine}
        waiting={!c.ended && duelNeeds(c.battle, 'p2') ? `Esperando ${s.players[1].name} escolher...` : undefined}
        onIdle={() => setIdle(true)}
        onChoose={(choice, mega) => afterBatch(duelChoose(c, 'p1', choice, mega))}
      />
    );
  }
  const w = s.winner ?? 0;
  return <RushResult title={foeQuit ? quitTitle(s.players, w) : undefined} winner={s.players[w]} team={teams.current[w]} history={winnerCard(0, w, s.players, foeHist.current)} onRematch={undefined} onNew={onExit} onExit={onExit} />;
}

// ------------------------------------------------------------------ Amigo que entrou

function Guest({me, code, onExit}: {me: Player; code: string; onExit: () => void}) {
  const link = useRef<Link | null>(null);
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [shared, setShared] = useState<Shared | null>(null);
  const [prepTeam, setPrepTeam] = useState<{team: OwnedMon[]; mega: boolean} | null>(null);
  const [prepSent, setPrepSent] = useState(false);
  const [batches, setBatches] = useState<BattleEvent[][]>([]);
  const [balls, setBalls] = useState<{p1: boolean[]; p2: boolean[]}>({p1: [], p2: []});
  const [req, setReq] = useState<DuelReq | null>(null);
  const [ended, setEnded] = useState<number | null>(null);
  const [hostHist, setHostHist] = useState<HistCard | null>(null);
  const sharedRef = useRef(shared);
  sharedRef.current = shared;
  /** A batalha já acabou (o resultado chega uns segundos depois). */
  const over = useRef(false);
  const [foeQuit, setFoeQuit] = useState(false);

  const send = (msg: Msg) => link.current?.send(msg);
  /** O dono da sala saiu no meio: vitória sua. */
  const foeLeft = () => {
    const s = sharedRef.current;
    if (over.current || !s || !playing(s.step)) return false;
    over.current = true;
    logRush(s, 1, 1, FOE_QUIT);
    setReq(null);
    setFoeQuit(true);
    setEnded(1);
    playFanfare(1);
    return true;
  };
  useMatchGuard(connected && playing(shared?.step) && ended === null && !error, () => {
    over.current = true;
    if (sharedRef.current) logRush(sharedRef.current, 1, 0, QUIT);
    send({t: 'forfeit'});
  });
  const leave = () => requestLeave(onExit);

  useEffect(() => {
    let alive = true;
    void joinRoom(
      code,
      msg => {
        if (msg.t === 'state') setShared(msg.s as Shared);
        else if (msg.t === 'prep') setPrepTeam({team: msg.team as OwnedMon[], mega: !!msg.mega});
        else if (msg.t === 'events') {
          setBatches(b => [...b, msg.events as BattleEvent[]]);
          setBalls(msg.balls as {p1: boolean[]; p2: boolean[]});
        } else if (msg.t === 'req') setReq(msg.req as DuelReq | null);
        else if (msg.t === 'forfeit') foeLeft();
        else if (msg.t === 'end') {
          over.current = true;
          setReq(null);
          if (sharedRef.current) logRush(sharedRef.current, 1, msg.winner as number, undefined, flipKo(saneKo(msg.ko)));
          setHostHist((msg.hist as HistCard | undefined) ?? null);
          const sh = sharedRef.current;
          if (sh) send({t: 'snap', snap: mySnap(sh.players[1])});
        } else if (msg.t === 'snap') {
          keepFoe(msg.snap);
          setTimeout(() => {
            playFanfare(1);
            playCrowd(1, 3);
            setEnded(msg.winner as number);
          }, 2500);
        }
      },
      () => {
        setConnected(true);
        send({t: 'hello', player: me, hist: myCard(me.name), snap: mySnap(me)});
      },
      () => alive && !foeLeft() && !over.current && setError('A conexão com a sala caiu.'),
      e => setError(ERRORS[e] ?? `Erro de conexão: ${e}`),
    ).then(l => {
      if (alive) link.current = l;
      else l.close();
    });
    return () => {
      alive = false;
      link.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && ended === null) return <Lobby title="Rush online" status="" error={error} onExit={onExit} />;
  if (!connected || !shared || shared.step === 'lobby') return <Lobby title="Rush online" status={connected ? 'Conectado! Esperando o dono da sala...' : `Entrando na sala ${code}...`} onExit={onExit} />;
  if (ended !== null) return <RushResult title={foeQuit ? quitTitle(shared.players, ended) : undefined} winner={shared.players[ended]} team={[]} teamNames={shared.teams[ended]} history={winnerCard(1, ended, shared.players, hostHist)} onRematch={undefined} onNew={onExit} onExit={onExit} />;
  const s = shared;
  if (s.step === 'draft') return <DraftView players={s.players} mode={s.mode} round={s.round} total={s.pairs.length} pair={s.pairs[s.round]} teams={s.teams} canPick={s.round % 2 === 1} onPick={k => send({t: 'pick', k})} />;
  if (s.step === 'lucky' && s.lucky) return <LuckyReveal players={s.players} lucky={s.lucky} />;
  if (s.step === 'prep') {
    if (!prepTeam || prepSent) return <Lobby title="Preparação" status={prepSent ? `Esperando ${s.players[0].name} terminar a preparação...` : 'Carregando seu time...'} onExit={leave} />;
    return (
      <PrepScreen
        player={s.players[1]}
        team={prepTeam.team}
        foe={{player: s.players[0], team: s.teams[0]}}
        mega={prepTeam.mega}
        curtain={false}
        onDone={team => {
          send({t: 'prepDone', order: team.map(m => m.uid)});
          setPrepSent(true);
        }}
      />
    );
  }
  return (
    <BattleView
      arena={arenaFor(code)}
      players={s.players}
      teams={s.teams}
      bottom="p2"
      batches={batches}
      balls={balls}
      req={req}
      waiting={`Esperando ${s.players[0].name}...`}
      onChoose={(choice, mega) => {
        send({t: 'choice', choice, mega});
        setReq(null);
      }}
    />
  );
}

