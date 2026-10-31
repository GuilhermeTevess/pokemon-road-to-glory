// Narrador dos torneios: comenta golpes, nocautes e apresenta os treinadores conforme a fama.
import type {BattleEvent} from './battle';
import {pick} from './rng';

/** Ficha do treinador que o narrador conhece. */
export interface NarratorCtx {
  name: string;
  /** Títulos por torneio (ex.: {worlds: 1, cup: 3}). */
  titles: Partial<Record<string, number>>;
  /** Quantas vezes chegou à final e perdeu. */
  runnerUps: number;
  fame: number;
}

const ROUND_HYPE = [
  'Começam as quartas de final!',
  'Semifinal! Só quatro sobraram, e a tensão está no ar.',
  'É A GRANDE FINAL! O estádio inteiro está de pé!',
];

/** Apresentação antes da partida. `round`: 0 quartas, 1 semi, 2 final. */
export function introLines(me: NarratorCtx, foe: NarratorCtx, tournamentName: string, round: number, defending: boolean): string[] {
  const out = [`🎙️ ${ROUND_HYPE[round] ?? 'Mais uma partida!'} ${tournamentName}.`];
  const titles = Object.values(me.titles).reduce<number>((a, b) => a + (b ?? 0), 0);
  if (defending) out.push(`🎙️ Senhoras e senhores, a fera que levou este torneio da última vez: ${me.name} vem defender o título!`);
  else if (me.titles.worlds) out.push(`🎙️ Olha quem chegou: ${me.name}, com título MUNDIAL no currículo! A arena explode!`);
  else if (me.runnerUps >= 3) out.push(pick([`🎙️ ${me.name}, o eterno vice (${me.runnerUps} finais perdidas!). Será que hoje sai?`, `🎙️ ${me.name} de novo... dizem que coleciona medalhas de prata. 😅`]));
  else if (me.runnerUps === 2 && round === 2) out.push(`🎙️ ${me.name} já perdeu duas finais. A torcida pede: dessa vez vai!`);
  else if (titles >= 3) out.push(`🎙️ ${me.name} chega com ${titles} títulos na bagagem. Respeito!`);
  else if (titles >= 1) out.push(`🎙️ ${me.name} já sabe o que é levantar um troféu.`);
  else if (me.fame < 100) out.push(pick([`🎙️ Uma cara nova no circuito: ${me.name}! Vamos ver do que é capaz.`, `🎙️ ${me.name}, ninguém conhece ainda... por enquanto!`]));
  else out.push(`🎙️ ${me.name}, nome que já está ficando conhecido por aqui.`);
  if (foe.titles.worlds) out.push(`🎙️ Do outro lado, ${foe.name}, com título mundial. Que pedreira!`);
  else if (foe.runnerUps >= 2) out.push(`🎙️ Do outro lado, ${foe.name}, que vive batendo na trave.`);
  else out.push(`🎙️ Do outro lado: ${foe.name}!`);
  return out;
}

const CRIT = ['QUE CRÍTICO! A torcida vai à loucura!', 'Na mosca! Que golpe!', 'Crítico! Isso vai doer.'];
const SUPER = ['Escolha certeira de tipo!', 'Esse matchup foi estudado!', 'Super efetivo, como manda o manual!'];
const FOE_DOWN = ['E cai mais um do lado adversário!', 'Nocaute! O placar mudou!', 'Derrubou! Que jogada!'];
const MY_DOWN = ['Ai! Uma baixa importante!', 'Caiu! A partida está esquentando!', 'Perdeu uma peça! E agora?'];
const RESIST = ['Hmm, esse não foi o melhor golpe...', 'Pouco efeito. A torcida murmura.'];

/** Acrescenta comentários do narrador (não em todo evento, para não cansar). */
export function withNarration(events: BattleEvent[], foeLeft: number, myLeft: number): BattleEvent[] {
  const out: BattleEvent[] = [];
  for (const ev of events) {
    out.push(ev);
    let line: string | null = null;
    if (ev.hit?.effect === 'crit' && Math.random() < 0.7) line = pick(CRIT);
    else if (ev.hit?.effect === 'super' && Math.random() < 0.35) line = pick(SUPER);
    else if (ev.hit?.effect === 'resisted' && Math.random() < 0.25) line = pick(RESIST);
    else if (ev.faint === 'p2') line = foeLeft === 1 ? 'O adversário está no ÚLTIMO Pokémon!' : foeLeft === 0 ? 'ACABOU! Que vitória!' : pick(FOE_DOWN);
    else if (ev.faint === 'p1') line = myLeft === 1 ? 'Último Pokémon! Tudo ou nada!' : myLeft === 0 ? 'Fim de jogo... foi bonito enquanto durou.' : pick(MY_DOWN);
    if (line) out.push({text: `🎙️ ${line}`, narrator: true});
  }
  return out;
}
