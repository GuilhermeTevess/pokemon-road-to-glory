// Partida ao vivo entre dois jogadores da carreira (nos torneios). Cada um no seu PC:
// quem tem o menor id "hospeda" e roda a batalha; o outro vê e manda as escolhas.
import {useEffect, useRef, useState} from 'react';
import {BattleController} from '../../game/battle';
import type {BattleEvent} from '../../game/battle';
import {duelBalls, duelChoose, duelNeeds, duelRequest} from '../../game/rush';
import type {DuelReq} from '../../game/rush';
import {hostRoom, joinRoom} from '../../game/net';
import type {Link} from '../../game/net';
import {highlightsFromLog} from '../../game/tournament';
import type {OwnedMon} from '../../game/types';
import {playCrowd, playFanfare} from '../audio';
import {BattleView} from './QuickplayScreen';
import type {Player} from './QuickplayScreen';
import {TrainerAvatar} from './StartScreens';

type Msg = Record<string, unknown>;

export interface DuelOutcome {
  won: boolean;
  highlights: string[];
  left: number;
  myTeam: string[];
  foeTeam: string[];
}

function Waiting({me, foe, text, onLeave}: {me: Player; foe: Player; text: string; onLeave: () => void}) {
  return (
    <div className="screen duel-wait">
      <div className="panel duel-wait-card">
        <h2>Partida ao vivo</h2>
        <div className="duel-vs">
          <span>
            <TrainerAvatar avatar={me.avatar} name={me.name} size={72} />
            <b>{me.name}</b>
          </span>
          <span className="vs">VS</span>
          <span>
            <TrainerAvatar avatar={foe.avatar} name={foe.name} size={72} />
            <b>{foe.name}</b>
          </span>
        </div>
        <p className="hint waiting">{text}</p>
        <button className="btn small ghost" onClick={onLeave}>
          Voltar para a chave
        </button>
      </div>
    </div>
  );
}

export function CareerDuel({room, host, me, foe, team, onDone, onLeave}: {
  /** Código da sala (o mesmo nos dois PCs). */
  room: string;
  host: boolean;
  me: Player;
  foe: Player;
  /** Seu time para esta partida (já curado). */
  team: OwnedMon[];
  onDone: (r: DuelOutcome) => void;
  onLeave: () => void;
}) {
  const link = useRef<Link | null>(null);
  const [status, setStatus] = useState(host ? `Esperando ${foe.name} entrar na partida...` : `Procurando a partida de ${foe.name}...`);
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  startedRef.current = started;
  const [batches, setBatches] = useState<BattleEvent[][]>([]);
  const [balls, setBalls] = useState<{p1: boolean[]; p2: boolean[]}>({p1: [], p2: []});
  const [req, setReq] = useState<DuelReq | null>(null);
  const [idle, setIdle] = useState(false);
  const ctl = useRef<BattleController | null>(null);
  const foeTeam = useRef<string[]>([]);
  const finished = useRef(false);
  const send = (msg: Msg) => link.current?.send(msg);
  const players: [Player, Player] = host ? [me, foe] : [foe, me];

  const finish = (r: DuelOutcome) => {
    if (finished.current) return;
    finished.current = true;
    setReq(null);
    setTimeout(() => {
      playFanfare(r.won ? 1 : 0);
      playCrowd(1, 2);
      onDone(r);
    }, 2500);
  };

  // ---------------- dono da partida
  const afterBatch = (events: BattleEvent[]) => {
    const c = ctl.current!;
    setIdle(false);
    setBatches(b => [...b, events]);
    setBalls(duelBalls(c.battle));
    send({t: 'events', events, balls: duelBalls(c.battle)});
    if (c.ended) {
      const hostWon = !!c.won;
      const side = hostWon ? c.battle.p1 : c.battle.p2;
      const left = side.pokemon.filter(p => !p.fainted).length;
      const highlights = highlightsFromLog(c.battle.log, me.name, foe.name, hostWon ? me.name : foe.name, left);
      const mine = team.map(m => m.species);
      send({t: 'end', hostWon, highlights, left, hostTeam: mine});
      finish({won: hostWon, highlights, left, myTeam: mine, foeTeam: foeTeam.current});
      return;
    }
    send({t: 'req', req: duelNeeds(c.battle, 'p2') ? duelRequest(c.battle, 'p2') : null});
  };

  const onHostMsg = (msg: Msg) => {
    if (msg.t === 'hello' && !ctl.current) {
      const theirs = msg.team as OwnedMon[];
      foeTeam.current = theirs.map(m => m.species);
      ctl.current = new BattleController(team, {mon: theirs[0], team: theirs, rarity: 'rare', boss: true, trainer: foe.name, versus: me.name});
      setStarted(true);
      send({t: 'start'});
      afterBatch(ctl.current.initialEvents());
    } else if (msg.t === 'choice' && ctl.current && duelNeeds(ctl.current.battle, 'p2')) {
      afterBatch(duelChoose(ctl.current, 'p2', msg.choice as string, !!msg.mega));
    }
  };

  // ---------------- quem entra
  const onGuestMsg = (msg: Msg) => {
    if (msg.t === 'start') setStarted(true);
    else if (msg.t === 'events') {
      setBatches(b => [...b, msg.events as BattleEvent[]]);
      setBalls(msg.balls as {p1: boolean[]; p2: boolean[]});
    } else if (msg.t === 'req') setReq(msg.req as DuelReq | null);
    else if (msg.t === 'end') {
      const hostWon = !!msg.hostWon;
      finish({won: !hostWon, highlights: msg.highlights as string[], left: msg.left as number, myTeam: team.map(m => m.species), foeTeam: msg.hostTeam as string[]});
    }
  };

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      if (!alive) return;
      const onError = (e: string) => {
        if (!alive || finished.current) return;
        // O outro ainda não abriu a partida (ou a sala antiga não fechou): tenta de novo.
        if (e === 'peer-unavailable' || e === 'unavailable-id') {
          link.current?.close();
          link.current = null;
          timer = setTimeout(connect, 3000);
        } else setStatus(`Problema de conexão (${e}). Tentando de novo...`);
      };
      const onClose = () => {
        if (!alive || finished.current) return;
        setStatus(`A conexão com ${foe.name} caiu. Tentando reconectar...`);
        // Antes da luta começar, dá para abrir a sala de novo (o outro saiu e voltou).
        if (!startedRef.current) {
          link.current?.close();
          link.current = null;
          if (timer) clearTimeout(timer);
          timer = setTimeout(connect, 3000);
        }
      };
      const opened = () => {
        if (host) return;
        setStatus(`Conectado! Esperando ${foe.name}...`);
        send({t: 'hello', player: me, team});
      };
      const p = host ? hostRoom(room, onHostMsg, () => undefined, onClose, onError) : joinRoom(room, onGuestMsg, opened, onClose, onError);
      void p.then(l => {
        if (alive) link.current = l;
        else l.close();
      });
    };
    connect();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      link.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!started) return <Waiting me={me} foe={foe} text={status} onLeave={onLeave} />;
  const c = ctl.current;
  const mine = host ? (c && idle && duelNeeds(c.battle, 'p1') ? duelRequest(c.battle, 'p1') : null) : req;
  return (
    <BattleView
      players={players}
      bottom={host ? 'p1' : 'p2'}
      batches={batches}
      balls={balls}
      req={mine}
      waiting={finished.current ? undefined : `Esperando ${foe.name} escolher...`}
      onIdle={() => setIdle(true)}
      onChoose={(choice, mega) => {
        if (host && c) afterBatch(duelChoose(c, 'p1', choice, mega));
        else {
          send({t: 'choice', choice, mega});
          setReq(null);
        }
      }}
    />
  );
}
