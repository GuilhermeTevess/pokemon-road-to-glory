import {describe, expect, it} from 'vitest';
import {ARENAS, arenaFor, randomArena} from '../src/game/arenas';

describe('arenas dos modos rápidos', () => {
  it('a mesma sala dá a mesma arena nos dois PCs (código em maiúscula ou não)', () => {
    expect(arenaFor('ab12c')).toBe(arenaFor('AB12C'));
    expect(arenaFor('XYZ99')).toBe(arenaFor('XYZ99'));
  });

  it('salas diferentes caem em arenas variadas', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(arenaFor(`SALA${i}`));
    expect(seen.size).toBe(ARENAS.length);
  });

  it('o sorteio sempre cai numa arena que existe', () => {
    for (let i = 0; i < 100; i++) {
      const a = randomArena();
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(ARENAS.length);
    }
  });
});
