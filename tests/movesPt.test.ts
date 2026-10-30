import {describe, expect, it} from 'vitest';
import {Dex} from '@pkmn/sim';
import {moveDescPt, untranslatedSentences} from '../src/data/movesPt';

describe('descrições dos golpes em português', () => {
  it('traduz todas as frases das descrições curtas', () => {
    const d = Dex.forGen(9);
    const descs = [...new Set(d.moves.all().filter(m => (!m.isNonstandard || m.isNonstandard === 'Past') && !m.isZ && !m.isMax).map(m => m.shortDesc))].filter(Boolean);
    expect(untranslatedSentences(descs)).toEqual([]);
  });

  it('usa modelos para efeitos comuns', () => {
    expect(moveDescPt('Ember')).toBe('10% de chance de queimar o alvo.');
    expect(moveDescPt('Swords Dance')).toBe('Aumenta o Ataque do usuário em 2.');
    expect(moveDescPt('Close Combat')).toBe('Baixa Defesa e Def. Esp. do usuário em 1.');
    expect(moveDescPt('Icy Wind')).toBe('Baixa a Velocidade dos inimigos em 1.');
  });
});
