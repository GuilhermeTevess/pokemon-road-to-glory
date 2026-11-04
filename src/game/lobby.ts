// Salas abertas e "Procurar partida".
// Quem cria uma sala aberta deixa um cartãozinho em `careers/LOBBY/msgs` (nome, avatar, modo e
// o código da sala). Quem procura partida lê essa lista e entra numa sala; se não tiver nenhuma,
// cria a própria e espera. Nada de servidor: é só uma lista no mesmo banco das salas.
//
// Para gastar pouco do plano grátis do Firebase:
// - o cartão diz "ainda estou aqui" a cada 30 s (uma gravação);
// - cartões sem notícia há mais de 2 minutos somem da lista, e quem vê um cartão velho
//   apaga (as regras do banco deixam qualquer um apagar cartão velho);
// - a lista só é lida de tempos em tempos, e só enquanto a tela está aberta.
import {cloudId, cloudRaw} from './cloud';

export type LobbyGame = 'rush' | 'built';

export interface LobbyRoom {
  /** Código da sala (o mesmo que dá para mandar para um amigo). */
  code: string;
  game: LobbyGame;
  /** Modo do Rush (no Dream Team fica vazio). */
  mode?: string;
  name: string;
  avatar: string;
  /** Criada pelo "Procurar partida" (o dono também está procurando). */
  auto: boolean;
  /** Identidade de quem criou (faz parte do nome do documento). */
  uid: string;
  /** Quando a sala abriu. */
  opened: number;
  /** Última vez que o dono disse "ainda estou aqui". */
  at: number;
}

const FOLDER = 'careers/LOBBY/msgs';
const docPath = (uid: string, code: string) => `${FOLDER}/${encodeURIComponent(`${uid}_${code}`)}`;

/** Cartão sem notícia há mais que isso: o dono fechou o jogo sem avisar. */
export const STALE_MS = 2 * 60_000;
/** Para apagar o cartão de outro, as regras pedem um pouco mais de folga. */
const DELETE_MS = 3 * 60_000;
const BEAT_MS = 30_000;

const sane = (r: unknown): r is LobbyRoom => {
  const x = r as LobbyRoom;
  return (
    !!x &&
    typeof x.code === 'string' &&
    /^[A-Z0-9]{5}$/.test(x.code) &&
    (x.game === 'rush' || x.game === 'built') &&
    typeof x.name === 'string' &&
    typeof x.uid === 'string' &&
    typeof x.at === 'number' &&
    typeof x.opened === 'number'
  );
};

/** Salas abertas agora (mais antigas primeiro: quem espera há mais tempo é chamado antes). */
export async function listRooms(game?: LobbyGame, now = Date.now()): Promise<LobbyRoom[]> {
  const docs = await cloudRaw.listTimed<unknown>(FOLDER);
  const out: LobbyRoom[] = [];
  let cleaned = 0;
  for (const d of docs) {
    if (!sane(d.value)) continue;
    const room = d.value;
    const seen = Math.max(room.at, d.savedAt ?? 0);
    if (now - seen > STALE_MS) {
      // Faxina: no máximo 3 por vez, para não gastar gravações à toa.
      if (now - seen > DELETE_MS && cleaned++ < 3) void cloudRaw.del(docPath(room.uid, room.code)).catch(() => undefined);
      continue;
    }
    if (!game || room.game === game) out.push({...room, name: room.name.slice(0, 12)});
  }
  return out.sort((a, b) => a.opened - b.opened || a.code.localeCompare(b.code));
}

/**
 * Qual sala o "Procurar partida" escolhe: primeiro uma do mesmo modo, senão qualquer uma
 * do mesmo jogo (com pouca gente online, é melhor jogar outro modo do que ficar esperando).
 */
export function pickRoom(rooms: LobbyRoom[], game: LobbyGame, mode: string | undefined, skip: Iterable<string> = []): LobbyRoom | null {
  const no = new Set(skip);
  const ok = rooms.filter(r => r.game === game && !no.has(r.code));
  return ok.find(r => (r.mode ?? '') === (mode ?? '')) ?? ok[0] ?? null;
}

/**
 * Enquanto espero na minha sala do "Procurar partida", apareceu outra sala esperando?
 * - Sala aberta "normal" (o dono não está procurando): eu vou até ela.
 * - Outra pessoa também procurando: só um dos dois pode ir, senão eles se cruzam.
 *   Vai quem abriu a sala depois (empate: o código maior).
 */
export function deferTo(rooms: LobbyRoom[], mine: {code: string; game: LobbyGame; mode?: string; opened: number}): LobbyRoom | null {
  const others = rooms.filter(r => r.game === mine.game && r.code !== mine.code);
  const older = (r: LobbyRoom) => r.opened < mine.opened || (r.opened === mine.opened && r.code < mine.code);
  const can = others.filter(r => !r.auto || older(r));
  return pickRoom(can, mine.game, mine.mode);
}

export interface Listing {
  game: LobbyGame;
  mode?: string;
  name: string;
  avatar: string;
  auto: boolean;
  /** Quando a sala abriu (o mesmo número que a tela usa no `deferTo`). */
  opened: number;
}

/** Coloca a sala na lista e mantém o cartão vivo. `stop()` tira da lista. */
export function listRoom(code: string, info: Listing): {stop: () => void} {
  let stopped = false;
  let uid: string | null = null;
  // Uma gravação de cada vez, e o "apagar" do fim vem depois da última (senão o cartão voltaria).
  let chain: Promise<unknown> = Promise.resolve();
  const write = () => {
    chain = chain
      .then(async () => {
        uid ??= await cloudId();
        if (!uid || stopped) return;
        const at = Date.now();
        const room: LobbyRoom = {code, game: info.game, mode: info.mode, name: info.name.slice(0, 12), avatar: info.avatar, auto: info.auto, uid, opened: info.opened, at};
        await cloudRaw.put(docPath(uid, code), room, {at});
      })
      .catch(() => undefined);
  };
  write();
  const timer = setInterval(write, BEAT_MS);
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      chain = chain.then(async () => {
        const u = uid ?? (await cloudId());
        if (u) await cloudRaw.del(docPath(u, code));
      }).catch(() => undefined);
    },
  };
}
