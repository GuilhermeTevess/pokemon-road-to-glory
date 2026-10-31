// Conexão direta entre dois navegadores (Rush online), sem servidor nosso.
// Usa o PeerJS: o servidor gratuito deles só apresenta os dois PCs; depois os dados vão direto.
// Para testar no mesmo navegador, `?net=local` troca a internet por um BroadcastChannel.
import type {DataConnection, Peer as PeerT} from 'peerjs';

export interface Link {
  send(msg: unknown): void;
  close(): void;
}

export type OnMsg = (msg: Record<string, unknown>) => void;

const PREFIX = 'rtg-rush-';

export function newRoomCode(): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({length: 5}, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}

function localMode(): boolean {
  try {
    return new URLSearchParams(location.search).get('net') === 'local';
  } catch {
    return false;
  }
}

/** Canal local (mesmo navegador, duas abas): só para testes. */
function localLink(code: string, me: 'host' | 'guest', onMsg: OnMsg, onOpen: () => void): Link {
  const ch = new BroadcastChannel(PREFIX + code);
  let open = false;
  let retry: ReturnType<typeof setInterval> | null = null;
  ch.onmessage = e => {
    const {from, msg} = e.data as {from: string; msg: Record<string, unknown>};
    if (from === me) return;
    if (msg.t === '__hello' && me === 'host') {
      ch.postMessage({from: me, msg: {t: '__hello'}});
      onOpen();
      return;
    }
    if (msg.t === '__hello') {
      if (open) return;
      open = true;
      if (retry) clearInterval(retry);
      return onOpen();
    }
    onMsg(msg);
  };
  // Como no PeerJS, o convidado insiste até o anfitrião abrir a sala.
  if (me === 'guest') {
    ch.postMessage({from: me, msg: {t: '__hello'}});
    retry = setInterval(() => ch.postMessage({from: me, msg: {t: '__hello'}}), 1000);
  }
  return {
    send: msg => ch.postMessage({from: me, msg}),
    close: () => {
      if (retry) clearInterval(retry);
      ch.close();
    },
  };
}

function wire(conn: DataConnection, onMsg: OnMsg, onOpen: () => void, onClose: () => void): Link {
  conn.on('open', onOpen);
  conn.on('data', d => onMsg(d as Record<string, unknown>));
  conn.on('close', onClose);
  conn.on('error', onClose);
  return {send: msg => conn.open && conn.send(msg), close: () => conn.close()};
}

/** Cria a sala e espera o amigo entrar. */
export async function hostRoom(code: string, onMsg: OnMsg, onOpen: () => void, onClose: () => void, onError: (e: string) => void): Promise<Link> {
  if (localMode()) return localLink(code, 'host', onMsg, onOpen);
  const {Peer} = await import('peerjs');
  const peer: PeerT = new Peer(PREFIX + code.toUpperCase());
  let link: Link | null = null;
  peer.on('error', e => onError(String((e as {type?: string}).type ?? e)));
  peer.on('connection', conn => {
    if (link) return conn.close(); // sala cheia
    link = wire(conn, onMsg, onOpen, onClose);
  });
  return {
    send: msg => link?.send(msg),
    close: () => {
      link?.close();
      peer.destroy();
    },
  };
}

/** Entra na sala do amigo pelo código. */
export async function joinRoom(code: string, onMsg: OnMsg, onOpen: () => void, onClose: () => void, onError: (e: string) => void): Promise<Link> {
  if (localMode()) return localLink(code, 'guest', onMsg, onOpen);
  const {Peer} = await import('peerjs');
  const peer: PeerT = new Peer();
  return new Promise(resolve => {
    peer.on('error', e => onError(String((e as {type?: string}).type ?? e)));
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code.toUpperCase(), {reliable: true});
      const link = wire(conn, onMsg, onOpen, onClose);
      resolve({send: link.send, close: () => (link.close(), peer.destroy())});
    });
  });
}
