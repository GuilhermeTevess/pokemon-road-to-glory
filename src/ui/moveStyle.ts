// Classifica cada golpe num "formato" visual/sonoro. Usado pelas animações (fx.ts)
// e pelos efeitos sonoros (audio.ts), para que os dois combinem.
import {dex} from '../data/dex';

export type MoveShape =
  | 'contact' // encosta no alvo: soco, chute, garra, mordida...
  | 'stream' // jato contínuo: lança-chamas, hidro bomba, raios
  | 'projectile' // algo arremessado: bolas, tiros, folhas
  | 'rain' // cai do céu: trovão, nevasca, deslizamento de pedras
  | 'quake' // tremor de terra
  | 'burst' // explosão
  | 'self' // golpe de status em si mesmo (buff)
  | 'targetStatus'; // golpe de status no alvo

export type ContactKind = 'fist' | 'foot' | 'claw' | 'slash' | 'bite' | 'chop' | 'impact';

export interface MoveStyle {
  shape: MoveShape;
  type: string;
  power: number;
  contact: ContactKind;
}

const has = (name: string, re: RegExp) => re.test(name.toLowerCase());

export function moveStyle(moveName: string): MoveStyle {
  const m = dex.moves.get(moveName);
  const name = m.name;
  const power = m.basePower || 0;
  let contact: ContactKind = 'impact';
  if (has(name, /punch|hammer|fist|arm|uppercut|jab/)) contact = 'fist';
  else if (has(name, /kick|stomp|jump|trop/)) contact = 'foot';
  else if (has(name, /claw|scratch|swipe/)) contact = 'claw';
  else if (has(name, /slash|cut|blade|sword|scissor|cross|sacred sword|razor shell|aqua cutter/)) contact = 'slash';
  else if (has(name, /bite|fang|crunch|jaw/)) contact = 'bite';
  else if (has(name, /chop/)) contact = 'chop';

  let shape: MoveShape;
  if (m.category === 'Status') {
    shape = ['self', 'allySide', 'adjacentAllyOrSelf', 'allies', 'all'].includes(m.target) ? 'self' : 'targetStatus';
  } else if (has(name, /earthquake|magnitude|bulldoze|fissure|earth power|stomping tantrum|high horsepower|precipice/)) {
    shape = 'quake';
  } else if (has(name, /explosion|self-destruct|misty explosion|eruption|overheat|boomburst|mind blown|draco meteor|v-create/)) {
    shape = 'burst';
  } else if (
    has(name, /^thunder$|blizzard|hail|rock slide|stone edge|meteor|hurricane|heat wave|surf|leaf storm|petal blizzard|icicle crash|bleakwind|sandsear|wildbolt|springtide|thunderclap|bolt strike|wave crash|rock tomb|sky attack|razor leaf|magical leaf/)
  ) {
    shape = 'rain';
  } else if (m.flags.contact) {
    shape = 'contact';
  } else if (has(name, /thunderbolt|beam|thrower|pump|cannon|jet|spray|stream|breath|hose|wheel|laser|ray|flash cannon|torrent|blast burn|fire spin|whirlpool|scald|discharge|vine/)) {
    shape = 'stream';
  } else {
    shape = 'projectile';
  }
  return {shape, type: m.type, power, contact};
}
