// Dream Team online: cada um no seu aparelho, com o time que montou.
// Igual ao Rush online: quem cria a sala roda a batalha e manda tudo para o amigo.
import {useEffect, useRef, useState} from 'react';
import {BattleController} from '../../game/battle';
import type {BattleEvent} from '../../game/battle';
import {teamToOwned} from '../../game/builder';
import type {BuiltTeam} from '../../game/builder';
import {recordMatch} from '../../game/history';
import {flipKo, koFromLog, saneKo} from '../../game/recap';
import type {Ko} from '../../game/recap';
import {hostRoom, joinRoom, newRoomCode} from '../../game/net';
import {arenaFor} from '../../game/arenas';
import type {Link} from '../../game/net';
import {duelBalls, duelChoose, duelNeeds, duelRequest} from '../../game/rush';
import type {DuelReq} from '../../game/rush';
import {useGame} from '../../game/store';
import type {OwnedMon} from '../../game/types';
import {PixelIcon} from '../components';
import {playCrowd, playFanfare} from '../audio';
import {BattleView, PrepScreen, RushResult} from './QuickplayScreen';
import {quitTitle} from './OnlineRush';
import {requestLeave, useMatchGuard} from '../leaveGuard';
import type {Player} from './QuickplayScreen';

type Msg = Record<string, unknown>;

interface Shared {
  step: 'lobby' | 'prep' | 'battle' | 'end';
  players: [Player, Player];
  /** Nomes dos times montados. */
  names: [string, string];
  teams: [string[], string[]];
  winner?: number;
}

const ERRORS: Record<string, string> = {
  'peer-unavailable': 'Sala não encontrada. Confira o código (e se o seu amigo ainda está com a sala aberta).',
  'room-full': 'Essa sala já tem dois jogadores. Peça para o seu amigo criar outra.',
  network: 'Sem conexão com a internet agora. Confira o Wi-Fi ou os dados móveis.',
};

function log(s: Shared, me: 0 | 1, winner: number, note?: string, ko?: Ko[]) {
  const foe = s.players[1 - me];
  recordMatch(useGame.getState().trainer?.id, {
    mode: 'online-built',
    online: true,
    won: winner === me,
    vs: foe.name,
    vsAvatar: foe.avatar,
    vsKind: 'player',
    mine: s.teams[me],
    theirs: s.teams[1 - me],
    note: note ?? `${s.names[me]} contra ${s.names[1 - me]}`,
    ko,
  });
}

const playing = (step?: Shared['step']) => step === 'prep' || step === 'battle';
const QUIT = 'Saiu no meio da partida';
const FOE_QUIT = 'O adversário saiu da partida';

function Lobby({code, status, error, onExit}: {code?: string; status: string; error?: string; onExit: () => void}) {
  return (
    <div className="screen quickplay">
      <header className="bar">
        <button className="btn small" onClick={onExit}>
          <PixelIcon name="back" /> Sair
        </button>
        <h2>Dream Team online</h2>
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

export function OnlineBuilt({role, code, me, team, onExit}: {role: 'host' | 'guest'; code?: string; me: Player; team: BuiltTeam; onExit: () => void}) {
  return role === 'host' ? <Host me={me} team={team} onExit={onExit} /> : <Guest me={me} team={team} code={code ?? ''} onExit={onExit} />;
}

// ------------------------------------------------------------------ Dono da sala

function Host({me, team, onExit}: {me: Player; team: BuiltTeam; onExit: () => void}) {
  const [code] = useState(newRoomCode);
  const link = useRef<Link | null>(null);
  const [error, setError] = useState<string>();
  const teams = useRef<[OwnedMon[], OwnedMon[]]>([teamToOwned(team), []]);
  const [shared, setShared] = useState<Shared>({step: 'lobby', players: [me, {name: '...', avatar: 'red'}], names: [team.name, ''], teams: [teams.current[0].map(m => m.species), []]});
  const prepped = useRef<[boolean, boolean]>([false, false]);
  const [myPrep, setMyPrep] = useState(false);
  const ctl = useRef<BattleController | null>(null);
  const [batches, setBatches] = useState<BattleEvent[][]>([]);
  const [idle, setIdle] = useState(false);
  const sharedRef = useRef(shared);
  sharedRef.current = shared;
  const [foeQuit, setFoeQuit] = useState(false);
  const foeLeft = () => {
    const s = sharedRef.current;
    if (!playing(s.step) || ctl.current?.ended) return false;
    log(s, 0, 0, FOE_QUIT);
    setFoeQuit(true);
    sharedRef.current = {...s, step: 'end', winner: 0};
    setShared(sharedRef.current);
    playFanfare(1);
    return true;
  };
  useMatchGuard(playing(shared.step) && !error, () => {
    if (ctl.current?.ended) return;
    log(sharedRef.current, 0, 1, QUIT);
    send({t: 'forfeit'});
  });
  const leave = () => requestLeave(onExit);

  const send = (msg: Msg) => link.current?.send(msg);
  const publish = (s: Shared) => {
    setShared(s);
    send({t: 'state', s});
  };

  const afterBatch = (events: BattleEvent[]) => {
    const c = ctl.current!;
    setIdle(false);
    setBatches(b => [...b, events]);
    send({t: 'events', events, balls: duelBalls(c.battle)});
    if (c.ended) {
      const winner = c.won ? 0 : 1;
      const ko = koFromLog(c.battle.log, 'p1');
      send({t: 'end', winner, ko});
      log(sharedRef.current, 0, winner, undefined, ko);
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
      teams.current[1] = msg.team as OwnedMon[];
      publish({...s, players: [s.players[0], msg.player as Player], names: [s.names[0], msg.name as string], teams: [s.teams[0], teams.current[1].map(m => m.species)], step: 'prep'});
    } else if (msg.t === 'forfeit') {
      foeLeft();
    } else if (msg.t === 'prepDone' && s.step === 'prep') {
      const order = msg.order as string[];
      const t = teams.current[1];
      teams.current[1] = order.map(id => t.find(m => m.uid === id)!).filter(Boolean);
      prepped.current[1] = true;
      if (prepped.current[0]) startBattle();
      else setShared({...s});
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
  if (error && s.step !== 'end') return <Lobby code={code} status="" error={error} onExit={onExit} />;
  if (s.step === 'lobby') return <Lobby code={code} status="Esperando o amigo entrar na sala..." onExit={onExit} />;
  if (s.step === 'prep') {
    if (myPrep) return <Lobby status={`Esperando ${s.players[1].name} escolher quem abre...`} onExit={leave} />;
    return (
      <PrepScreen
        player={s.players[0]}
        team={teams.current[0]}
        foe={{player: s.players[1], team: s.teams[1]}}
        mega={false}
        keepItems
        curtain={false}
        onDone={t => {
          teams.current[0] = t;
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
  return <RushResult title={foeQuit ? quitTitle(s.players, w) : `${s.players[w].name} venceu!`} winner={s.players[w]} team={[]} teamNames={s.teams[w]} newLabel="Voltar" onNew={onExit} onExit={onExit} />;
}

// ------------------------------------------------------------------ Amigo que entrou

function Guest({me, team, code, onExit}: {me: Player; team: BuiltTeam; code: string; onExit: () => void}) {
  const link = useRef<Link | null>(null);
  const [mine] = useState(() => teamToOwned(team));
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [shared, setShared] = useState<Shared | null>(null);
  const [prepSent, setPrepSent] = useState(false);
  const [batches, setBatches] = useState<BattleEvent[][]>([]);
  const [balls, setBalls] = useState<{p1: boolean[]; p2: boolean[]}>({p1: [], p2: []});
  const [req, setReq] = useState<DuelReq | null>(null);
  const [ended, setEnded] = useState<number | null>(null);
  const sharedRef = useRef(shared);
  sharedRef.current = shared;
  const over = useRef(false);
  const [foeQuit, setFoeQuit] = useState(false);

  const send = (msg: Msg) => link.current?.send(msg);
  const foeLeft = () => {
    const s = sharedRef.current;
    if (over.current || !s || !playing(s.step)) return false;
    over.current = true;
    log(s, 1, 1, FOE_QUIT);
    setReq(null);
    setFoeQuit(true);
    setEnded(1);
    playFanfare(1);
    return true;
  };
  useMatchGuard(connected && playing(shared?.step) && ended === null && !error, () => {
    over.current = true;
    if (sharedRef.current) log(sharedRef.current, 1, 0, QUIT);
    send({t: 'forfeit'});
  });
  const leave = () => requestLeave(onExit);

  useEffect(() => {
    let alive = true;
    void joinRoom(
      code,
      msg => {
        if (msg.t === 'state') setShared(msg.s as Shared);
        else if (msg.t === 'events') {
          setBatches(b => [...b, msg.events as BattleEvent[]]);
          setBalls(msg.balls as {p1: boolean[]; p2: boolean[]});
        } else if (msg.t === 'req') setReq(msg.req as DuelReq | null);
        else if (msg.t === 'forfeit') foeLeft();
        else if (msg.t === 'end') {
          over.current = true;
          setReq(null);
          if (sharedRef.current) log(sharedRef.current, 1, msg.winner as number, undefined, flipKo(saneKo(msg.ko)));
          setTimeout(() => {
            playFanfare(1);
            playCrowd(1, 3);
            setEnded(msg.winner as number);
          }, 2500);
        }
      },
      () => {
        setConnected(true);
        send({t: 'hello', player: me, team: mine, name: team.name});
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

  if (error && ended === null) return <Lobby status="" error={error} onExit={onExit} />;
  if (!connected || !shared || shared.step === 'lobby') return <Lobby status={connected ? 'Conectado! Esperando o dono da sala...' : `Entrando na sala ${code}...`} onExit={onExit} />;
  if (ended !== null)
    return <RushResult title={foeQuit ? quitTitle(shared.players, ended) : `${shared.players[ended].name} venceu!`} winner={shared.players[ended]} team={[]} teamNames={shared.teams[ended]} newLabel="Voltar" onNew={onExit} onExit={onExit} />;
  const s = shared;
  if (s.step === 'prep') {
    if (prepSent) return <Lobby status={`Esperando ${s.players[0].name} escolher quem abre...`} onExit={leave} />;
    return (
      <PrepScreen
        player={s.players[1]}
        team={mine}
        foe={{player: s.players[0], team: s.teams[0]}}
        mega={false}
        keepItems
        curtain={false}
        onDone={t => {
          send({t: 'prepDone', order: t.map(m => m.uid)});
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
