import {describe, expect, it} from 'vitest';
import {asksOnEntry, parseTutorial} from '../src/ui/tutorialState';
import {TOURS} from '../src/ui/tutorialTours';

describe('Tutorial', () => {
  it('pergunta na entrada só quando não está ligado nem recusado de vez', () => {
    expect(asksOnEntry(parseTutorial(null))).toBe(true);
    expect(asksOnEntry(parseTutorial('{"mode":"off","seen":["title"]}'))).toBe(true);
    expect(asksOnEntry(parseTutorial('{"mode":"on","seen":[]}'))).toBe(false);
    expect(asksOnEntry(parseTutorial('{"mode":"never","seen":[]}'))).toBe(false);
  });
  it('save quebrado volta ao padrão', () => {
    expect(parseTutorial('{lixo')).toEqual({mode: 'off', seen: []});
    expect(parseTutorial('{"mode":"x","seen":[1,"a"]}')).toEqual({mode: 'off', seen: ['a']});
  });
  it('cada parte tem id único e passos com título e texto', () => {
    const ids = TOURS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOURS) {
      expect(t.steps.length).toBeGreaterThan(0);
      for (const s of t.steps) expect(s.title && s.text).toBeTruthy();
    }
  });
  it('sem emojis coloridos nos textos (estilo pixel art)', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    const ok = new Set(['✕', '✓', '★', '▶', '←', '→']);
    for (const t of TOURS)
      for (const s of t.steps) for (const ch of s.title + s.text) if (emoji.test(ch)) expect(ok.has(ch)).toBe(true);
  });
});
