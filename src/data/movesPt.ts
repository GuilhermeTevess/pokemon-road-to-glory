// Descrições dos golpes em português. Os nomes continuam em inglês (como no
// Showdown); a descrição curta do Showdown é traduzida frase a frase: primeiro
// por modelos ("30% de chance de queimar o alvo."), depois por um dicionário.
import {dex} from './dex';
import {MOVE_SENTENCES_PT} from './movesPtDict';

const STAT_PT: Record<string, string> = {
  attack: 'Ataque',
  atk: 'Ataque',
  defense: 'Defesa',
  def: 'Defesa',
  'sp. atk': 'Atq. Esp.',
  spa: 'Atq. Esp.',
  'sp. def': 'Def. Esp.',
  spd: 'Def. Esp.',
  speed: 'Velocidade',
  spe: 'Velocidade',
  accuracy: 'precisão',
  evasiveness: 'evasão',
  evasion: 'evasão',
  'critical hit ratio': 'chance de crítico',
};

function stats(list: string): string | null {
  const parts = list.split(/, and |, | and /).map(p => STAT_PT[p.trim().toLowerCase()]);
  if (parts.some(p => !p)) return null;
  if (parts.length > 1) return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
  return `${FEMININE.has(parts[0]) ? 'a' : 'o'} ${parts[0]}`;
}

const FEMININE = new Set(['Defesa', 'Def. Esp.', 'Velocidade', 'precisão', 'evasão', 'chance de crítico']);

const WHO: Record<string, string> = {
  'the target': 'do alvo',
  target: 'do alvo',
  "the target's": 'do alvo',
  "target's": 'do alvo',
  "the user's": 'do usuário',
  "user's": 'do usuário',
  user: 'do usuário',
  'the foe(s)': 'dos inimigos',
  'foe(s)': 'dos inimigos',
  "an ally's": 'de um aliado',
  "the user's and ally's": 'do usuário e do aliado',
};

const STATUS_PT: Record<string, string> = {
  burn: 'queimar',
  paralyze: 'paralisar',
  poison: 'envenenar',
  'badly poison': 'envenenar gravemente',
  freeze: 'congelar',
  confuse: 'confundir',
  sleep: 'fazer dormir',
  flinch: 'fazer recuar',
};

const TARGET_PT: Record<string, string> = {
  'the target': 'o alvo',
  target: 'o alvo',
  'the foe(s)': 'os inimigos',
  'foe(s)': 'os inimigos',
  'adjacent pokemon': 'os Pokémon ao lado',
};

const SHORT_PT: Record<string, string> = {
  burn: 'de queimar',
  psn: 'de envenenar',
  paralyze: 'de paralisar',
  confusion: 'de confundir',
  flinch: 'de fazer recuar',
  'flinch chance': 'de fazer recuar',
};

type Rule = [RegExp, (...m: string[]) => string | null];

const RULES: Rule[] = [
  [
    /^(\d+)% chance to (burn|paralyze|poison|badly poison|freeze|confuse|sleep)(?: (the target|target|the foe\(s\)|foe\(s\)|adjacent Pokemon))?\.$/i,
    (_, n, st, who) => `${n}% de chance de ${STATUS_PT[st.toLowerCase()]}${who ? ` ${TARGET_PT[who.toLowerCase()]}` : ''}.`,
  ],
  [/^(\d+)% chance to make (the target|the foe\(s\)) flinch\.$/i, (_, n, who) => `${n}% de chance de fazer ${TARGET_PT[who.toLowerCase()]} recuar.`],
  [/^(\d+)% chance to flinch(?: target)?\.$/i, (_, n) => `${n}% de chance de fazer o alvo recuar.`],
  [/^(\d+)% (burn|psn|paralyze|confusion|flinch|flinch chance)\.$/i, (_, n, k) => `${n}% de chance ${SHORT_PT[k.toLowerCase()]}.`],
  [
    /^(\d+)% (?:chance )?(?:to )?(lower|raise) (the target's|target's|the user's|user's|user|the foe\(s\)|foe\(s\)) (.+?) by (\d)\.$/i,
    (_, n, dir, who, list, k) => {
      const s = stats(list);
      if (!s) return null;
      const verb = dir.toLowerCase() === 'lower';
      if (n === '100') return `${verb ? 'Baixa' : 'Aumenta'} ${s} ${WHO[who.toLowerCase()]} em ${k}.`;
      return `${n}% de chance de ${verb ? 'baixar' : 'aumentar'} ${s} ${WHO[who.toLowerCase()]} em ${k}.`;
    },
  ],
  [
    /^(Lowers|Raises) (the target's|target's|the user's|user's|the foe\(s\)|an ally's|the user's and ally's) (.+?) by (\d)\.$/i,
    (_, dir, who, list, k) => {
      const s = stats(list);
      return s ? `${dir === 'Lowers' ? 'Baixa' : 'Aumenta'} ${s} ${WHO[who.toLowerCase()]} em ${k}.` : null;
    },
  ],
  [/^Hits (\d+(?:-\d+)?) times(?: in one turn)?\.$/i, (_, n) => `Acerta ${n.replace('-', ' a ')} vezes.`],
  [/^Has (1\/2|1\/4|33%) recoil\.$/i, (_, n) => `O usuário sofre ${n} do dano causado.`],
  [/^High crit(?:ical hit)?(?: ratio)?\.$/i, () => 'Alta chance de acerto crítico.'],
  [/^(\d+)% chance to raise all stats by 1 \(not acc\/eva\)\.$/i, (_, n) => `${n}% de chance de aumentar todos os atributos em 1.`],
];

const PROTECT: [RegExp, string][] = [
  [/Sp\. Atk/g, 'Sp@Atk'],
  [/Sp\. Def/g, 'Sp@Def'],
  [/Phys\. /g, 'Phys@ '],
];

function sentencePt(s: string): string {
  const exact = MOVE_SENTENCES_PT[s];
  if (exact) return exact;
  for (const [re, fn] of RULES) {
    const m = re.exec(s);
    if (m) {
      const out = fn(...m);
      if (out) return out;
    }
  }
  return s;
}

const cache = new Map<string, string>();

/** Descrição curta do golpe em português (cai no inglês se faltar tradução). */
export function moveDescPt(move: string): string {
  const m = dex.moves.get(move);
  const en = m.shortDesc || m.desc || '';
  const hit = cache.get(en);
  if (hit !== undefined) return hit;
  let txt = en;
  for (const [re, to] of PROTECT) txt = txt.replace(re, to);
  const out = txt
    .split(/(?<=\.)\s+/)
    .map(s => s.replace(/@/g, '. ').replace(/Phys\.  /g, 'Phys. '))
    .map(s => sentencePt(s))
    .join(' ');
  cache.set(en, out);
  return out;
}

/** Só para testes: frases que ainda não têm tradução. */
export function untranslatedSentences(descs: string[]): string[] {
  const out = new Set<string>();
  for (const en of descs) {
    let txt = en;
    for (const [re, to] of PROTECT) txt = txt.replace(re, to);
    for (const raw of txt.split(/(?<=\.)\s+/)) {
      const s = raw.replace(/@/g, '. ').replace(/Phys\.  /g, 'Phys. ');
      if (s && sentencePt(s) === s) out.add(s);
    }
  }
  return [...out];
}
