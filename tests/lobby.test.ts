import {describe, expect, it} from 'vitest';
import {deferTo, pickRoom, type LobbyRoom} from '../src/game/lobby';
import {waited} from '../src/ui/lobby';

const room = (code: string, extra: Partial<LobbyRoom> = {}): LobbyRoom => ({code, game: 'rush', mode: 'nv50', name: code, avatar: 'red', auto: true, uid: 'u', opened: 1000, at: 1000, ...extra});

describe('procurar partida', () => {
  it('prefere o mesmo modo, senão qualquer sala do mesmo jogo', () => {
    const rooms = [room('AAAAA', {mode: 'mega'}), room('BBBBB'), room('CCCCC', {game: 'built', mode: undefined})];
    expect(pickRoom(rooms, 'rush', 'nv50')?.code).toBe('BBBBB');
    expect(pickRoom(rooms, 'rush', 'legend')?.code).toBe('AAAAA');
    expect(pickRoom(rooms, 'built', undefined)?.code).toBe('CCCCC');
    expect(pickRoom(rooms, 'rush', 'nv50', ['BBBBB', 'AAAAA'])).toBeNull();
  });

  it('dois procurando ao mesmo tempo: só quem abriu depois vai até o outro', () => {
    const a = room('AAAAA', {opened: 1000});
    const b = room('BBBBB', {opened: 2000});
    expect(deferTo([a, b], {...b, game: 'rush'})?.code).toBe('AAAAA');
    expect(deferTo([a, b], {...a, game: 'rush'})).toBeNull();
    // Mesma hora: desempata pelo código.
    const c = room('CCCCC', {opened: 1000});
    expect(deferTo([a, c], c)?.code).toBe('AAAAA');
    expect(deferTo([a, c], a)).toBeNull();
  });

  it('sala aberta normal (dono não está procurando): quem espera sempre vai até ela', () => {
    const mine = room('BBBBB', {opened: 1000});
    const open = room('ZZZZZ', {opened: 5000, auto: false});
    expect(deferTo([mine, open], mine)?.code).toBe('ZZZZZ');
  });

  it('não mistura Rush com Dream Team', () => {
    const mine = room('BBBBB', {opened: 5000});
    expect(deferTo([room('AAAAA', {game: 'built'}), mine], mine)).toBeNull();
  });

  it('tempo de espera legível', () => {
    expect(waited(0, 40_000)).toBe('40 s');
    expect(waited(0, 185_000)).toBe('3 min');
  });
});
