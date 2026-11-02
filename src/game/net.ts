// Conexão entre dois aparelhos (Rush online e partidas ao vivo da carreira).
// Antes era direto entre os navegadores (PeerJS/WebRTC), mas isso falha muito entre celular
// (4G) e PC: a conexão nunca abre e a tela fica carregando. Agora cada lado deixa as mensagens
// numa "caixa de correio" no Firestore (o mesmo da carreira online) e o outro lado vai buscando.
// É um pouquinho mais lento (meio segundo por mensagem), mas funciona em qualquer rede.
// Com `?net=local` a caixa fica no localStorage (duas abas do mesmo navegador, para testes).
import {cloudRaw} from './cloud';

export interface Link {
  send(msg: unknown): void;
  close(): void;
}

export type OnMsg = (msg: Record<string, unknown>) => void;

export function newRoomCode(): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({length: 5}, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const rid = () => Math.random().toString(36).slice(2, 10);

/** Pasta da sala no Firestore (dentro de `careers/`, que é onde o banco deixa gravar). */
export const roomBase = (code: string) => `careers/${encodeURIComponent(`LINK-${code.toUpperCase()}`)}/msgs`;

interface RoomDoc {
  sid: string;
  at: number;
}

/**
 * Uma ponta da conversa: manda as mensagens numeradas (0, 1, 2...) e busca as do outro na ordem.
 * Se a internet piscar, tenta de novo; nada se perde porque as mensagens ficam guardadas.
 */
class Mailbox implements Link {
  private outSeq = 0;
  private inSeq = 0;
  private queue: {n: number; msg: unknown}[] = [];
  private sending = false;
  private stopped = false;
  private lastActive = Date.now();

  constructor(
    private readonly base: string,
    private readonly sid: string,
    private readonly mine: 'h' | 'g',
    private readonly onMsg: (msg: Record<string, unknown>) => void,
  ) {
    void this.loop();
  }

  private path(side: 'h' | 'g', n: number) {
    return `${this.base}/${this.sid}-${side}-${String(n).padStart(5, '0')}`;
  }

  send(msg: unknown): void {
    if (this.stopped) return;
    this.queue.push({n: this.outSeq++, msg});
    this.lastActive = Date.now();
    void this.flush();
  }

  private async flush() {
    if (this.sending) return;
    this.sending = true;
    while (this.queue.length && !this.stopped) {
      const m = this.queue[0];
      try {
        await cloudRaw.put(this.path(this.mine, m.n), m.msg);
        this.queue.shift();
      } catch {
        await sleep(1500);
      }
    }
    this.sending = false;
  }

  /** Mais rápido logo depois de alguma mensagem, mais devagar quando está tudo parado. */
  private delay() {
    const idle = Date.now() - this.lastActive;
    return idle < 8000 ? 400 : idle < 40000 ? 1000 : 2500;
  }

  private async loop() {
    const theirs = this.mine === 'h' ? 'g' : 'h';
    while (!this.stopped) {
      try {
        const msg = await cloudRaw.get<Record<string, unknown>>(this.path(theirs, this.inSeq));
        if (this.stopped) return;
        if (msg) {
          this.inSeq++;
          this.lastActive = Date.now();
          this.onMsg(msg);
          continue;
        }
      } catch {
        // Sem internet agora: tenta de novo daqui a pouco.
      }
      await sleep(this.delay());
    }
  }

  close(): void {
    if (this.stopped) return;
    // Avisa o outro lado (se der) e para de buscar.
    void cloudRaw.put(this.path(this.mine, this.outSeq++), {t: '__bye'}).catch(() => undefined);
    this.stopped = true;
  }
}

/** Cria a sala e espera o amigo entrar. */
export async function hostRoom(code: string, onMsg: OnMsg, onOpen: () => void, onClose: () => void, onError: (e: string) => void): Promise<Link> {
  const base = roomBase(code);
  const sid = rid();
  let box: Mailbox | null = null;
  let closed = false;
  let beat: ReturnType<typeof setInterval> | null = null;
  const room: RoomDoc = {sid, at: Date.now()};
  const open = async () => {
    for (let tries = 0; !closed; tries++) {
      try {
        await cloudRaw.put(`${base}/room`, room);
        return true;
      } catch {
        if (tries === 2) onError('network');
        await sleep(2000);
      }
    }
    return false;
  };
  void open().then(ok => {
    if (!ok || closed) return;
    box = new Mailbox(base, sid, 'h', msg => {
      if (msg.t === '__hello') return onOpen();
      if (msg.t === '__bye') return onClose();
      onMsg(msg);
    });
    // "Ainda estou aqui" de vez em quando (quem entra vê que a sala está viva).
    beat = setInterval(() => !closed && void cloudRaw.put(`${base}/room`, {sid, at: Date.now()}).catch(() => undefined), 20000);
  });
  return {
    send: msg => box?.send(msg),
    close: () => {
      closed = true;
      if (beat) clearInterval(beat);
      box?.close();
      // Só apaga a sala se ela ainda for desta conexão (pode já existir outra com o mesmo código).
      void cloudRaw
        .get<RoomDoc>(`${base}/room`)
        .then(now => (now?.sid === sid ? cloudRaw.del(`${base}/room`) : undefined))
        .catch(() => undefined);
    },
  };
}

/**
 * Entra na sala do amigo pelo código. Se a sala ainda não existe, insiste por uns segundos
 * (o amigo pode estar criando agora) e então avisa com o erro 'peer-unavailable'.
 */
export async function joinRoom(code: string, onMsg: OnMsg, onOpen: () => void, onClose: () => void, onError: (e: string) => void, waitMs = 12000): Promise<Link> {
  const base = roomBase(code);
  const me = rid();
  let box: Mailbox | null = null;
  let closed = false;
  let watch: ReturnType<typeof setInterval> | null = null;
  const start = async () => {
    const until = Date.now() + waitMs;
    let room: RoomDoc | null = null;
    let fails = 0;
    while (!closed && !room) {
      try {
        room = await cloudRaw.get<RoomDoc>(`${base}/room`);
      } catch {
        if (++fails === 3) onError('network');
      }
      if (room || closed) break;
      if (Date.now() > until) return onError('peer-unavailable');
      await sleep(1500);
    }
    if (!room || closed) return;
    // Só um amigo por sala: quem pegar a vaga primeiro fica.
    let seat: {id: string} | null = null;
    while (!closed && !seat) {
      try {
        seat = await cloudRaw.createOnce(`${base}/${room.sid}-seat`, {id: me});
      } catch {
        await sleep(1500);
      }
    }
    if (closed || !seat) return;
    if (seat.id !== me) return onError('room-full');
    const sid = room.sid;
    box = new Mailbox(base, sid, 'g', msg => {
      if (msg.t === '__bye') return onClose();
      onMsg(msg);
    });
    box.send({t: '__hello'});
    onOpen();
    // Se o dono fechou a sala (ou abriu outra com o mesmo código), a conexão acabou.
    watch = setInterval(async () => {
      try {
        const now = await cloudRaw.get<RoomDoc>(`${base}/room`);
        if (!closed && (!now || now.sid !== sid)) {
          if (watch) clearInterval(watch);
          onClose();
        }
      } catch {
        /* sem internet agora */
      }
    }, 6000);
  };
  void start();
  return {
    send: msg => box?.send(msg),
    close: () => {
      closed = true;
      if (watch) clearInterval(watch);
      box?.close();
    },
  };
}
