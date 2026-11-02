// Campeonato rápido online: alguém cria a sala, os amigos entram com o código (até 8),
// cada um monta o time no próprio aparelho e todos jogam a mesma chave. Partidas entre
// jogadores são ao vivo; as vagas que sobram ficam com bots.
import {useEffect, useRef, useState} from 'react';
import {cloudRaw} from '../../game/cloud';
import {newRoomCode} from '../../game/net';
import {createMon} from '../../game/mon';
import {TOURS, tourInfo} from '../../game/tournament';
import type {TourKind} from '../../game/tournament';
import type {OwnedMon} from '../../game/types';
import {PixelIcon, Sprite} from '../components';
import {TrainerAvatar} from './StartScreens';
import {TourDraft} from './QuickplayScreen';
import type {Player} from './QuickplayScreen';

export const QT_MAX = 8;

export interface QuickPlayer {
  pid: string;
  name: string;
  avatar: string;
  at: number;
  team?: OwnedMon[];
}

interface LobbyDoc {
  kind: TourKind;
  host: string;
  started: boolean;
  members?: string[];
}

const base = (code: string) => `careers/${encodeURIComponent(`QT-${code.toUpperCase()}`)}`;
const lobbyPath = (code: string) => `${base(code)}/msgs/lobby`;
const playerPath = (code: string, pid: string) => `${base(code)}/players/${encodeURIComponent(pid)}`;

/** O mesmo nível e o mesmo jeito de criar os Pokémon do campeonato rápido offline. */
export function quickTeam(kind: TourKind, names: string[]): OwnedMon[] {
  const level = Math.max(5, Math.round(tourInfo(kind).wave * 0.9) + 1);
  return names.map(name => createMon(name, {level, ivMin: 15, shinyChance: 0.01, hiddenAbilityChance: 0.1}));
}

type Step = 'menu' | 'lobby' | 'draft' | 'wait';

export function QuickTourOnline({me, pid, onBack, onStart}: {
  me: Player;
  pid: string;
  onBack: () => void;
  onStart: (kind: TourKind, code: string, players: QuickPlayer[]) => void;
}) {
  const [step, setStep] = useState<Step>('menu');
  const [kind, setKind] = useState<TourKind>('cup');
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [lobby, setLobby] = useState<LobbyDoc | null>(null);
  const [players, setPlayers] = useState<QuickPlayer[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const host = lobby?.host === pid;
  const launched = useRef(false);

  const myDoc = (team?: OwnedMon[]): QuickPlayer => ({pid, name: me.name, avatar: me.avatar, at: Date.now(), ...(team ? {team} : {})});

  const create = async () => {
    setBusy(true);
    setError(undefined);
    const c = newRoomCode();
    const doc: LobbyDoc = {kind, host: pid, started: false};
    try {
      await cloudRaw.put(lobbyPath(c), doc);
      await cloudRaw.put(playerPath(c, pid), myDoc());
      setCode(c);
      setLobby(doc);
      setStep('lobby');
    } catch {
      setError('Não deu para criar a sala. Confira a internet e tente de novo.');
    }
    setBusy(false);
  };

  const join = async () => {
    setBusy(true);
    setError(undefined);
    const c = joinCode.toUpperCase();
    try {
      const doc = await cloudRaw.get<LobbyDoc>(lobbyPath(c));
      if (!doc) setError('Sala não encontrada. Confira o código com quem criou.');
      else if (doc.started && !doc.members?.includes(pid)) setError('Esse campeonato já começou. Peça para criarem outra sala.');
      else {
        const list = await cloudRaw.list<QuickPlayer>(`${base(c)}/players`);
        if (!list.some(p => p.pid === pid) && list.length >= QT_MAX) setError(`A sala já está cheia (${QT_MAX} jogadores).`);
        else {
          if (!list.some(p => p.pid === pid)) await cloudRaw.put(playerPath(c, pid), myDoc());
          setCode(c);
          setLobby(doc);
          setStep(doc.started ? 'draft' : 'lobby');
        }
      }
    } catch {
      setError('Sem conexão com a internet agora. Tente de novo.');
    }
    setBusy(false);
  };

  // Na sala e esperando os times: confere a sala e quem está nela de tempos em tempos.
  useEffect(() => {
    if (!code || (step !== 'lobby' && step !== 'wait')) return;
    let alive = true;
    const tick = async () => {
      try {
        const [doc, list] = await Promise.all([cloudRaw.get<LobbyDoc>(lobbyPath(code)), cloudRaw.list<QuickPlayer>(`${base(code)}/players`)]);
        if (!alive || !doc) return;
        const sorted = list.sort((a, b) => a.at - b.at);
        setLobby(doc);
        setPlayers(sorted);
        if (doc.started && step === 'lobby') {
          if (doc.members?.includes(pid)) setStep('draft');
          else setError('O campeonato começou sem você (a sala encheu).');
        }
        if (step === 'wait' && doc.started && doc.members) {
          const inn = doc.members.map(m => sorted.find(p => p.pid === m));
          if (inn.every(p => p?.team?.length) && !launched.current) {
            launched.current = true;
            onStart(doc.kind, code, inn as QuickPlayer[]);
          }
        }
      } catch {
        /* sem internet agora: tenta de novo */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  const startTour = async (members: string[]) => {
    if (!lobby) return;
    const doc = {...lobby, started: true, members};
    try {
      await cloudRaw.put(lobbyPath(code), doc);
      setLobby(doc);
    } catch {
      setError('Sem conexão com a internet agora. Tente de novo.');
    }
  };

  const header = (title: string, back: () => void) => (
    <header className="bar">
      <button className="btn small" onClick={back}>
        <PixelIcon name="back" /> Voltar
      </button>
      <h2>{title}</h2>
    </header>
  );

  if (step === 'draft' && lobby)
    return (
      <TourDraft
        kind={lobby.kind}
        onBack={() => setStep('lobby')}
        onDone={names => {
          const team = quickTeam(lobby.kind, names);
          setStep('wait');
          void cloudRaw.put(playerPath(code, pid), myDoc(team)).catch(() => setError('Não deu para enviar seu time. Confira a internet.'));
        }}
      />
    );

  if (step === 'lobby' || step === 'wait') {
    const info = tourInfo(lobby?.kind ?? kind);
    const members = lobby?.members ?? players.slice(0, QT_MAX).map(p => p.pid);
    const shown = players.filter(p => members.includes(p.pid));
    const ready = shown.filter(p => p.team?.length);
    return (
      <div className="screen quickplay">
        {header(`${info.name} online`, onBack)}
        <div className="panel rush-lobby">
          {step === 'lobby' && (
            <>
              <p>Mande este código para os amigos (até {QT_MAX} jogadores):</p>
              <div className="room-code">{code}</div>
              <p className="hint">Eles abrem o jogo, vão em Quickplay → Campeonato rápido → Online e entram com o código.</p>
            </>
          )}
          <div className="qt-players">
            {shown.map(p => (
              <span key={p.pid} className="qt-player">
                <TrainerAvatar avatar={p.avatar} name={p.name} size={56} />
                <b>{p.name}</b>
                {lobby?.host === p.pid && <small className="muted">dono da sala</small>}
                {step === 'wait' && (
                  <small className={p.team?.length ? 'win-tag' : 'muted'}>{p.team?.length ? 'time pronto' : 'montando o time...'}</small>
                )}
                {step === 'wait' && p.pid === pid && p.team && (
                  <span className="team-row">
                    {p.team.map(m => (
                      <Sprite key={m.uid} name={m.species} size={32} still />
                    ))}
                  </span>
                )}
              </span>
            ))}
          </div>
          <p className="hint">
            {shown.length} jogador{shown.length === 1 ? '' : 'es'} · as {Math.max(0, 8 - shown.length)} vagas que sobram ficam com bots.
          </p>
          {error && <p className="error">{error}</p>}
          {step === 'lobby' && host && (
            <button className="btn primary big" disabled={shown.length < 2} onClick={() => void startTour(shown.map(p => p.pid))}>
              {shown.length < 2 ? 'Esperando alguém entrar...' : 'Começar o campeonato'}
            </button>
          )}
          {step === 'lobby' && !host && <p className="hint waiting">Esperando o dono da sala começar...</p>}
          {step === 'wait' && <p className="hint waiting">Esperando todo mundo terminar de montar o time...</p>}
          {step === 'wait' && host && ready.length >= 1 && ready.length < shown.length && (
            <button className="btn small ghost" onClick={() => void startTour(ready.map(p => p.pid))}>
              Começar só com quem já montou o time
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen quickplay">
      {header('Campeonato rápido online', onBack)}
      <div className="panel rush-setup">
        <div className="rush-online">
          <h3>Criar uma sala</h3>
          <div className="rush-modes">
            {TOURS.map(t => (
              <button key={t.kind} className={`rush-mode ${kind === t.kind ? 'on' : ''}`} onClick={() => setKind(t.kind as TourKind)}>
                <b>{t.name}</b>
                <span>
                  Times de {t.teamSize}, nível ~{Math.round(t.wave * 0.9) + 1}
                </span>
              </button>
            ))}
          </div>
          <button className="btn primary big" disabled={busy} onClick={() => void create()}>
            Criar sala e pegar o código
          </button>
        </div>
        <div className="rush-online">
          <h3>Entrar na sala do amigo</h3>
          <div className="rush-online-row">
            <input placeholder="CÓDIGO" maxLength={5} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            <button className="btn primary" disabled={busy || joinCode.length < 5} onClick={() => void join()}>
              Entrar na sala
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <p className="hint">Cada um monta o time no próprio aparelho. Partidas entre amigos são ao vivo; contra bots, cada um joga a sua.</p>
      </div>
    </div>
  );
}
