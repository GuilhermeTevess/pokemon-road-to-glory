// Telas e ganchos das salas abertas e do "Procurar partida" (Rush e Dream Team online).
import {useEffect, useRef, useState} from 'react';
import {deferTo, listRooms, pickRoom} from '../game/lobby';
import type {LobbyGame, LobbyRoom} from '../game/lobby';
import {rushMode} from '../game/rush';
import type {RushMode} from '../game/rush';
import {PixelIcon} from './components';
import {TrainerAvatar} from './screens/StartScreens';

/** Como a tela online entrou na partida. */
export interface OnlineEntry {
  role: 'host' | 'guest';
  code?: string;
  /** Veio do "Procurar partida": se a sala sumir ou lotar, procura de novo sozinho. */
  auto?: boolean;
  /** Sala aparece em "Salas abertas". */
  listed?: boolean;
  /** Muda a cada tentativa (a tela da sala começa do zero). */
  seq?: number;
}

/** Chave da tela da sala: outra sala = outra tela (a conexão começa de novo). */
export const entryKey = (o: OnlineEntry) => `${o.role}-${o.code ?? ''}-${o.seq ?? 0}`;

/** Nome do modo para mostrar na lista. */
export function roomModeLabel(r: Pick<LobbyRoom, 'game' | 'mode'>): string {
  if (r.game === 'built') return 'Times montados';
  try {
    return rushMode((r.mode ?? 'nv50') as RushMode).name;
  } catch {
    return 'Rush';
  }
}

/** Erros em que o "Procurar partida" tenta outra sala em vez de mostrar a mensagem. */
export const MISS_ERRORS = new Set(['peer-unavailable', 'room-full']);

/**
 * "Procurar partida": olha a lista e devolve a melhor sala para entrar (ou `null` = ninguém
 * esperando, então quem procura cria a própria sala e espera).
 */
export async function findRoom(game: LobbyGame, mode: string | undefined, skip: Iterable<string>): Promise<string | null> {
  try {
    return pickRoom(await listRooms(game), game, mode, skip)?.code ?? null;
  } catch {
    return null;
  }
}

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * Enquanto a minha sala do "Procurar partida" espera, de vez em quando confere se apareceu
 * outra sala esperando (alguém que procurou ao mesmo tempo). Se for a minha vez de ir, chama `onSwitch`.
 */
export function useDeferWatch(on: boolean, mine: {code: string; game: LobbyGame; mode?: string; opened: number}, onSwitch: (code: string) => void) {
  const cb = useRef(onSwitch);
  cb.current = onSwitch;
  useEffect(() => {
    if (!on) return;
    let alive = true;
    const t = setInterval(async () => {
      if (hidden()) return;
      try {
        const other = deferTo(await listRooms(mine.game), mine);
        if (alive && other) cb.current(other.code);
      } catch {
        /* sem internet agora */
      }
    }, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, mine.code]);
}

/** Atualiza sozinha a cada 10 s por até 3 minutos (depois, só no botão), para não gastar leituras. */
const REFRESH_MS = 10_000;
const AUTO_FOR_MS = 3 * 60_000;

/** Lista das salas com alguém esperando adversário. */
export function OpenRooms({game, onJoin}: {game: LobbyGame; onJoin: (code: string) => void}) {
  const [rooms, setRooms] = useState<LobbyRoom[] | null>(null);
  const [err, setErr] = useState(false);
  const [auto, setAuto] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const started = Date.now();
    const load = async () => {
      try {
        const r = await listRooms(game);
        if (!alive) return;
        setRooms(r);
        setErr(false);
      } catch {
        if (alive) setErr(true);
      }
    };
    void load();
    const t = setInterval(() => {
      if (Date.now() - started > AUTO_FOR_MS) {
        clearInterval(t);
        if (alive) setAuto(false);
        return;
      }
      if (!hidden()) void load();
    }, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [game, tick]);
  const refresh = () => {
    setAuto(true);
    setTick(x => x + 1);
  };
  return (
    <div className="open-rooms">
      <div className="open-rooms-head">
        <h3>
          <PixelIcon name="people" /> Salas abertas
        </h3>
        <button className="btn small" onClick={refresh}>
          Atualizar
        </button>
      </div>
      <p className="hint small">Gente esperando adversário agora. Toque em "Entrar" para jogar.{!auto && ' (Toque em Atualizar para ver as novas.)'}</p>
      {rooms === null && !err && <p className="hint waiting">Buscando salas...</p>}
      {err && <p className="hint">Sem internet agora: não deu para ver as salas.</p>}
      {rooms?.length === 0 && <p className="hint">Nenhuma sala aberta agora. Use "Procurar partida" e espere alguém entrar.</p>}
      <ul className="open-rooms-list">
        {rooms?.map(r => (
          <li key={r.code} className="open-room">
            <TrainerAvatar avatar={r.avatar} name={r.name} size={32} />
            <span className="open-room-info">
              <b>{r.name}</b>
              <small>
                {roomModeLabel(r)} · esperando há {waited(r.opened)}
              </small>
            </span>
            <button className="btn primary small" onClick={() => onJoin(r.code)}>
              Entrar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "40 s", "3 min". */
export function waited(opened: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - opened) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min`;
}

/** Tela de "Procurando partida..." enquanto lê a lista (é rapidinho). */
export function Searching({title, onExit}: {title: string; onExit: () => void}) {
  return (
    <div className="screen quickplay">
      <header className="bar">
        <button className="btn small" onClick={onExit}>
          <PixelIcon name="back" /> Sair
        </button>
        <h2>{title}</h2>
      </header>
      <div className="panel rush-lobby">
        <p className="hint waiting">Procurando partida...</p>
      </div>
    </div>
  );
}

/**
 * Controla o "Procurar partida": procura, entra, e se a sala lotou ou sumiu procura de novo
 * (sem repetir as salas que já deram errado). Sem ninguém esperando, cria a própria sala.
 */
export function useMatchmaking(game: LobbyGame, mode: string | undefined, setOnline: (o: OnlineEntry | null) => void) {
  const [searching, setSearching] = useState(false);
  const tried = useRef<string[]>([]);
  /** Cada busca ganha um número; se a pessoa saiu ou começou outra, a resposta antiga é ignorada. */
  const gen = useRef(0);
  const seq = useRef(0);
  useEffect(
    () => () => {
      gen.current++;
    },
    [],
  );
  const search = async () => {
    const my = ++gen.current;
    setOnline(null);
    setSearching(true);
    const code = await findRoom(game, mode, tried.current);
    if (my !== gen.current) return;
    setSearching(false);
    seq.current++;
    if (code) {
      tried.current.push(code);
      setOnline({role: 'guest', code, auto: true, seq: seq.current});
    } else setOnline({role: 'host', auto: true, listed: true, seq: seq.current});
  };
  return {
    searching,
    /** Botão "Procurar partida". */
    start: () => {
      tried.current = [];
      void search();
    },
    /** A sala escolhida lotou ou sumiu: tenta outra. */
    miss: () => void search(),
    /** Esperando na minha sala, apareceu outra em que eu devo entrar. */
    switchTo: (code: string) => {
      tried.current.push(code);
      seq.current++;
      setOnline({role: 'guest', code, auto: true, seq: seq.current});
    },
    /** Saiu da tela de procura. */
    cancel: () => {
      gen.current++;
      setSearching(false);
    },
  };
}
