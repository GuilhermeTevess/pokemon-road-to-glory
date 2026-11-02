import {describe, expect, it} from 'vitest';
import {Battle} from '@pkmn/sim';
import {faintedMask, flipKo, koFromLog, saneKo} from '../src/game/recap';
import {rushMon} from '../src/game/rush';
import {toSet} from '../src/game/mon';
import {aiMoveChoice, aiSwitchChoice} from '../src/game/battle';

const LOG = [
  '|switch|p1a: Faisca|Pikachu, L50, M|100/100',
  '|switch|p2a: Onix|Onix, L50|100/100',
  '|turn|1',
  '|move|p1a: Faisca|Thunderbolt|p2a: Onix',
  '|-immune|p2a: Onix',
  '|move|p2a: Onix|Rock Slide|p1a: Faisca',
  '|-damage|p1a: Faisca|0 fnt',
  '|faint|p1a: Faisca',
  '|switch|p1a: Charizard|Charizard, L50|100/100',
  '|turn|2',
  '|detailschange|p1a: Charizard|Charizard-Mega-X, L50',
  '|move|p1a: Charizard|Flare Blitz|p2a: Onix',
  '|-damage|p2a: Onix|0 fnt',
  '|-damage|p1a: Charizard|20/100|[from] Recoil',
  '|faint|p2a: Onix',
  '|switch|p2a: Golem|Golem, L50|100/100',
  '|turn|3',
  '|move|p2a: Golem|Explosion|p1a: Charizard',
  '|-damage|p1a: Charizard|0 fnt',
  '|faint|p2a: Golem',
  '|faint|p1a: Charizard',
  '|switch|p2a: Muk|Muk, L50|100/100',
  '|turn|4',
  '|-damage|p1a: Ninguem|0 fnt|[from] psn',
  '|faint|p1a: Ninguem',
];

describe('resumo da partida (nocautes)', () => {
  it('lê rodada, quem nocauteou e com qual golpe', () => {
    const ko = koFromLog(LOG, 'p1');
    expect(ko[0]).toEqual({r: 1, side: 0, mon: 'Pikachu', by: 'Onix', move: 'Rock Slide'});
    // Mega: continua com o nome de antes, para casar com o time.
    expect(ko[1]).toEqual({r: 2, side: 1, mon: 'Onix', by: 'Charizard', move: 'Flare Blitz'});
    // Explosion: quem usou cai pelo próprio golpe; o alvo foi nocauteado por ele.
    expect(ko[2]).toEqual({r: 3, side: 1, mon: 'Golem', move: 'Explosion'});
    expect(ko[3]).toEqual({r: 3, side: 0, mon: 'Charizard', by: 'Golem', move: 'Explosion'});
    expect(ko[4]).toMatchObject({r: 4, side: 0, why: 'veneno'});
  });

  it('o outro lado vê o contrário', () => {
    const a = koFromLog(LOG, 'p1');
    expect(koFromLog(LOG, 'p2')).toEqual(flipKo(a));
  });

  it('marca quem desmaiou no time, mesmo com repetidos', () => {
    const ko = [
      {r: 1, side: 0 as const, mon: 'Snorlax'},
      {r: 2, side: 1 as const, mon: 'Pikachu'},
    ];
    expect(faintedMask(['Snorlax', 'Snorlax', 'Eevee'], ko, 0)).toEqual([true, false, false]);
    expect(faintedMask(['Pikachu'], ko, 1)).toEqual([true]);
    expect(faintedMask(['Pikachu'], undefined, 1)).toEqual([false]);
  });

  it('limpa o que vem da rede', () => {
    expect(saneKo('x')).toBeUndefined();
    expect(saneKo([{r: -3, side: 2, mon: 'A'}, {r: 2.7, side: 1, mon: 'B'.repeat(80), move: 5}, null])).toEqual([{r: 2, side: 1, mon: 'B'.repeat(40)}]);
  });

  it('funciona numa batalha de verdade', () => {
    const battle = new Battle({formatid: 'gen9customgame' as never});
    const a = ['Charizard', 'Gengar', 'Garchomp'].map(n => rushMon(n, 'nv50'));
    const b = ['Snorlax', 'Lapras', 'Machamp'].map(n => rushMon(n, 'nv50'));
    battle.setPlayer('p1', {name: 'A', team: a.map(toSet)});
    battle.setPlayer('p2', {name: 'B', team: b.map(toSet)});
    for (let g = 0; !battle.ended && g < 400; g++) {
      for (const side of ['p1', 'p2'] as const) {
        const s = battle[side];
        if (battle.ended || s.isChoiceDone()) continue;
        if (s.requestState === 'move') battle.choose(side, aiMoveChoice(battle, side));
        else if (s.requestState === 'switch') battle.choose(side, aiSwitchChoice(battle, side));
      }
    }
    const ko = koFromLog(battle.log, 'p1');
    const fainted = [...battle.p1.pokemon, ...battle.p2.pokemon].filter(p => p.fainted).length;
    expect(ko.length).toBe(fainted);
    expect(ko.every(k => k.r >= 1 && (k.by || k.move || k.why))).toBe(true);
    expect(faintedMask(a.map(m => m.species), ko, 0)).toEqual(battle.p1.pokemon.map(p => p.fainted));
  });
});

describe('resumo no histórico', () => {
  it('o histórico espelhado (computador, amigo) inverte os lados', async () => {
    const {addMatch, mirrorHistory} = await import('../src/game/history');
    const h = addMatch({version: 1, list: [], totals: {}}, {at: 1, mode: 'rush:nv50', online: false, won: true, vs: 'CPU', vsKind: 'cpu', mine: ['Pikachu'], theirs: ['Onix'], ko: [{r: 2, side: 1, mon: 'Onix', by: 'Pikachu', move: 'Thunderbolt'}]});
    const mirror = mirrorHistory(h, 'CPU', {name: 'Ju', avatar: 'red'});
    expect(mirror.list[0].ko).toEqual([{r: 2, side: 0, mon: 'Onix', by: 'Pikachu', move: 'Thunderbolt'}]);
    expect(mirror.list[0].mine).toEqual(['Onix']);
  });
});
