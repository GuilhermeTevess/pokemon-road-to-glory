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
/** O clima de cada evento (0 League Cup ... 3 Mundial). */
const STAGE_HYPE = [
  ['Ginásio da cidade cheio de curiosos.'],
  ['Arena regional lotada, com torcida organizada!'],
  ['Estádio internacional, transmissão para o mundo todo!', 'Gente de todas as regiões na arquibancada!'],
  ['É o MUNDIAL! Os melhores treinadores do planeta estão aqui!', 'Milhões assistindo de casa. Que noite!'],
];

export function introLines(me: NarratorCtx, foe: NarratorCtx, tournamentName: string, round: number, defending: boolean, hype = 0): string[] {
  const out = [`🎙️ ${ROUND_HYPE[round] ?? 'Mais uma partida!'} ${tournamentName}.`];
  if (round === 0 || hype >= 2) out.push(`🎙️ ${pick(STAGE_HYPE[hype] ?? STAGE_HYPE[0])}`);
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
  if (round === 2) out.push(hype >= 3 ? '🎙️ Quem vencer agora é CAMPEÃO DO MUNDO. Valendo tudo!' : '🎙️ Quem ganhar leva o troféu para casa!');
  return out;
}

const CRIT = ['QUE CRÍTICO! A torcida vai à loucura!', 'Na mosca! Que golpe!', 'Crítico! Isso vai doer.', 'Acertou em cheio, no ponto fraco!'];
const SUPER = ['Escolha certeira de tipo!', 'Esse matchup foi estudado!', 'Super efetivo, como manda o manual!', 'Que leitura de jogo! Super efetivo!'];
const FOE_DOWN = ['E cai mais um do lado adversário!', 'Nocaute! O placar mudou!', 'Derrubou! Que jogada!', 'Fora de combate! A arquibancada levanta!'];
const MY_DOWN = ['Ai! Uma baixa importante!', 'Caiu! A partida está esquentando!', 'Perdeu uma peça! E agora?', 'Golpe duro! Dá para virar?'];
const RESIST = ['Hmm, esse não foi o melhor golpe...', 'Pouco efeito. A torcida murmura.', 'Quase nada! Vai precisar mudar de plano.'];
const SEND_FOE = ['Troca do lado de lá! Vamos ver a resposta.', 'Entra em campo um novo desafiante!', 'E vem reforço do outro lado!'];
const SEND_ME = ['Troca estratégica! O público aprova.', 'Mudança de peça! Será que deu certo?'];
/** Gritos de torcida (só nos torneios grandes). */
const CROWD = ['A torcida canta o seu nome!', 'Olha esse barulho! O estádio treme!', 'Bandeiras para todo lado na arquibancada!', 'Que clima! Ninguém está sentado!'];
const LOW = ['Por um fio! Ainda está de pé!', 'HP no vermelho! Que tensão!'];

/**
 * Acrescenta comentários do narrador. `hype` (0 a 3) cresce com o tamanho do evento:
 * quanto maior, mais falas e mais torcida.
 */
export function withNarration(events: BattleEvent[], foeLeft: number, myLeft: number, hype = 1): BattleEvent[] {
  const out: BattleEvent[] = [];
  const rate = 0.6 + 0.25 * hype;
  for (const ev of events) {
    out.push(ev);
    let line: string | null = null;
    if (ev.hit?.effect === 'crit' && Math.random() < 0.7 * rate) line = pick(CRIT);
    else if (ev.hit?.effect === 'super' && Math.random() < 0.35 * rate) line = pick(SUPER);
    else if (ev.hit?.effect === 'resisted' && Math.random() < 0.25 * rate) line = pick(RESIST);
    else if (ev.faint === 'p2') line = foeLeft === 1 ? 'O adversário está no ÚLTIMO Pokémon!' : foeLeft === 0 ? 'ACABOU! Que vitória!' : pick(FOE_DOWN);
    else if (ev.faint === 'p1') line = myLeft === 1 ? 'Último Pokémon! Tudo ou nada!' : myLeft === 0 ? 'Fim de jogo... foi bonito enquanto durou.' : pick(MY_DOWN);
    else if (ev.switchIn && hype >= 1 && Math.random() < 0.2 * rate) line = pick(ev.switchIn.side === 'p2' ? SEND_FOE : SEND_ME);
    else if (ev.hp && ev.hp.hp > 0 && ev.hp.hp / ev.hp.maxhp < 0.15 && Math.random() < 0.3 * rate) line = pick(LOW);
    else if (ev.move && hype >= 2 && Math.random() < 0.06 * hype) line = pick(CROWD);
    if (line) out.push({text: `🎙️ ${line}`, narrator: true});
  }
  return out;
}
