// Animações de golpes desenhadas por cima da arena, com os sprites de efeito
// do Pokémon Showdown (public/fx). Cada golpe vira um formato (moveStyle.ts)
// e um conjunto de partículas do tipo dele.
import {moveStyle} from './moveStyle';
import type {ContactKind} from './moveStyle';

export const FX = (file: string) => `${import.meta.env.BASE_URL}fx/${file}`;

type Point = {x: number; y: number};
/** Centro de cada Pokémon na arena, em % da largura/altura. */
const POS: Record<'p1' | 'p2', Point> = {p1: {x: 27, y: 70}, p2: {x: 72, y: 34}};

interface Particle {
  file: string;
  size: number;
  /** Filtro CSS para tingir sprites genéricos. */
  filter?: string;
}

const TYPE_PARTICLES: Record<string, Particle[]> = {
  Fire: [{file: 'fireball.png', size: 34}],
  Water: [{file: 'waterwisp.png', size: 46}],
  Ice: [{file: 'iceball.png', size: 42}, {file: 'icicle.png', size: 34}],
  Electric: [{file: 'electroball.png', size: 44}],
  Grass: [{file: 'leaf1.png', size: 30}, {file: 'leaf2.png', size: 34}],
  Psychic: [{file: 'mistball.png', size: 48, filter: 'hue-rotate(290deg) saturate(1.6)'}],
  Ghost: [{file: 'shadowball.png', size: 50}],
  Dark: [{file: 'blackwisp.png', size: 48}],
  Poison: [{file: 'poisonwisp.png', size: 48}],
  Ground: [{file: 'mudwisp.png', size: 46}, {file: 'rock2.png', size: 26}],
  Rock: [{file: 'rock1.png', size: 32}, {file: 'rock2.png', size: 32}, {file: 'rock3.png', size: 32}],
  Steel: [{file: 'gear.png', size: 40}],
  Fighting: [{file: 'mistball.png', size: 44, filter: 'hue-rotate(160deg) saturate(2)'}],
  Flying: [{file: 'feather.png', size: 44}],
  Bug: [{file: 'energyball.png', size: 38, filter: 'hue-rotate(40deg) saturate(1.4)'}],
  Dragon: [{file: 'purplewisp.png', size: 50}],
  Fairy: [{file: 'heart.png', size: 26}, {file: 'petal.png', size: 30}],
  Normal: [{file: 'wisp.png', size: 40}],
};

const RAIN_PARTICLES: Record<string, Particle> = {
  Electric: {file: 'lightning.png', size: 120},
  Ice: {file: 'icicle.png', size: 40},
  Rock: {file: 'rock3.png', size: 40},
  Grass: {file: 'leaf2.png', size: 36},
  Water: {file: 'waterwisp.png', size: 54},
  Fire: {file: 'fireball.png', size: 40},
  Flying: {file: 'feather.png', size: 50},
  Fairy: {file: 'petal.png', size: 36},
};

const CONTACT: Record<ContactKind, Particle[]> = {
  fist: [{file: 'fist.png', size: 56}],
  foot: [{file: 'foot.png', size: 56}],
  claw: [{file: 'leftclaw.png', size: 50}, {file: 'rightclaw.png', size: 50}],
  slash: [{file: 'leftslash.png', size: 60}, {file: 'rightslash.png', size: 60}],
  bite: [{file: 'topbite.png', size: 80}, {file: 'bottombite.png', size: 80}],
  chop: [{file: 'leftchop.png', size: 60}],
  impact: [{file: 'impact.png', size: 70}],
};

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function spawn(layer: HTMLElement, p: Particle, at: Point, scale = 1): HTMLImageElement {
  const img = document.createElement('img');
  img.src = FX(p.file);
  img.className = 'fx';
  img.style.left = `${at.x}%`;
  img.style.top = `${at.y}%`;
  img.style.width = `${p.size * scale}px`;
  if (p.filter) img.style.filter = p.filter;
  layer.appendChild(img);
  return img;
}

function fly(layer: HTMLElement, p: Particle, from: Point, to: Point, ms: number, opts: {scaleFrom?: number; scaleTo?: number; jitter?: number; spin?: boolean} = {}) {
  const j = opts.jitter ?? 0;
  const dx = (Math.random() - 0.5) * j;
  const dy = (Math.random() - 0.5) * j;
  const el = spawn(layer, p, from);
  const s0 = opts.scaleFrom ?? 1;
  const s1 = opts.scaleTo ?? 1;
  const rot = opts.spin ? 'rotate(540deg)' : 'rotate(0deg)';
  el.animate(
    [
      {left: `${from.x}%`, top: `${from.y}%`, transform: `translate(-50%, -50%) scale(${s0})`, opacity: 0.2},
      {opacity: 1, offset: 0.15},
      {left: `${to.x + dx}%`, top: `${to.y + dy}%`, transform: `translate(-50%, -50%) scale(${s1}) ${rot}`, opacity: 1},
    ],
    {duration: ms, easing: 'ease-in'},
  ).onfinish = () => el.remove();
}

function pop(layer: HTMLElement, p: Particle, at: Point, ms: number, opts: {from?: number; to?: number; rotate?: number} = {}) {
  const el = spawn(layer, p, at);
  el.animate(
    [
      {transform: `translate(-50%, -50%) scale(${opts.from ?? 0.4}) rotate(0deg)`, opacity: 0},
      {opacity: 1, offset: 0.3},
      {transform: `translate(-50%, -50%) scale(${opts.to ?? 1.3}) rotate(${opts.rotate ?? 0}deg)`, opacity: 0},
    ],
    {duration: ms, easing: 'ease-out'},
  ).onfinish = () => el.remove();
}

function flash(layer: HTMLElement, color: string, ms = 250) {
  const el = document.createElement('div');
  el.className = 'fx-flash';
  el.style.background = color;
  layer.appendChild(el);
  el.animate([{opacity: 0.7}, {opacity: 0}], {duration: ms}).onfinish = () => el.remove();
}

function shake(target: HTMLElement, ms = 600, px = 8) {
  target.animate(
    Array.from({length: 8}, (_, i) => ({transform: `translate(${i % 2 ? px : -px}px, ${i % 3 ? 2 : -2}px)`})).concat({transform: 'translate(0,0)'}),
    {duration: ms},
  );
}

const FLASH: Record<string, string> = {
  Fire: '#ffb36b', Electric: '#fff6a8', Ice: '#dff6ff', Psychic: '#ffc2e0', Water: '#bfe3ff', Grass: '#d8ffc2',
  Ghost: '#cdb8f0', Dark: '#3a2f4a', Fairy: '#ffd6ec', Dragon: '#c9b3ff', Normal: '#ffffff',
};

/**
 * Toca a animação do golpe e devolve quanto tempo ela leva (ms),
 * para a tela esperar antes do próximo texto.
 */
export async function playMoveFx(layer: HTMLElement, arena: HTMLElement, move: string, side: 'p1' | 'p2'): Promise<void> {
  const st = moveStyle(move);
  const from = POS[side];
  const to = POS[side === 'p1' ? 'p2' : 'p1'];
  const parts = TYPE_PARTICLES[st.type] ?? TYPE_PARTICLES.Normal;
  const part = (i: number) => parts[i % parts.length];
  const strong = st.power >= 90;

  switch (st.shape) {
    case 'contact': {
      await sleep(180);
      const list = CONTACT[st.contact];
      if (st.contact === 'bite') {
        const top = spawn(layer, list[0], {x: to.x, y: to.y - 10});
        const bot = spawn(layer, list[1], {x: to.x, y: to.y + 10});
        top.animate([{transform: 'translate(-50%,-90%)'}, {transform: 'translate(-50%,-50%)'}], {duration: 260, fill: 'forwards'});
        bot.animate([{transform: 'translate(-50%,-10%)'}, {transform: 'translate(-50%,-50%)'}], {duration: 260, fill: 'forwards'});
        await sleep(380);
        top.remove();
        bot.remove();
      } else {
        list.forEach((p, i) => setTimeout(() => pop(layer, p, {x: to.x + (i ? 4 : -4), y: to.y}, 380, {from: 0.6, to: 1.4}), i * 130));
        if (st.type !== 'Normal' && TYPE_PARTICLES[st.type]) {
          for (let i = 0; i < 4; i++) setTimeout(() => pop(layer, part(i), {x: to.x + (Math.random() - 0.5) * 12, y: to.y + (Math.random() - 0.5) * 12}, 420, {from: 0.3, to: 1}), 120 + i * 60);
        }
        await sleep(450 + list.length * 100);
      }
      break;
    }
    case 'stream': {
      const n = strong ? 16 : 11;
      for (let i = 0; i < n; i++) {
        setTimeout(() => fly(layer, part(i), from, to, 380, {scaleFrom: 0.4, scaleTo: strong ? 1.6 : 1.2, jitter: 8}), i * 45);
      }
      if (FLASH[st.type] && strong) setTimeout(() => flash(layer, FLASH[st.type]), n * 45);
      await sleep(n * 45 + 420);
      break;
    }
    case 'projectile': {
      const n = st.power >= 80 ? 1 : st.power > 0 && st.power <= 40 ? 3 : 2;
      const big = n === 1;
      for (let i = 0; i < n; i++) {
        setTimeout(() => fly(layer, part(i), from, to, 420, {scaleFrom: 0.6, scaleTo: big ? 1.8 : 1, jitter: 6, spin: st.type === 'Steel'}), i * 110);
      }
      setTimeout(() => pop(layer, {file: 'hitmarker.png', size: 70}, to, 300), 420 + (n - 1) * 110);
      await sleep(460 + n * 110);
      break;
    }
    case 'rain': {
      const p = RAIN_PARTICLES[st.type] ?? part(0);
      if (st.type === 'Electric') {
        flash(layer, FLASH.Electric, 300);
        const el = spawn(layer, p, {x: to.x, y: to.y - 18});
        el.animate([{opacity: 0}, {opacity: 1}, {opacity: 0.3}, {opacity: 1}, {opacity: 0}], {duration: 500}).onfinish = () => el.remove();
        await sleep(520);
        break;
      }
      for (let i = 0; i < 7; i++) {
        const x = to.x + (Math.random() - 0.5) * 22;
        setTimeout(() => fly(layer, p, {x, y: -10}, {x, y: to.y + (Math.random() - 0.3) * 12}, 380, {scaleTo: 1.2}), i * 70);
      }
      if (FLASH[st.type]) setTimeout(() => flash(layer, FLASH[st.type], 200), 450);
      await sleep(7 * 70 + 420);
      break;
    }
    case 'quake': {
      shake(arena, 700, 10);
      for (let i = 0; i < 6; i++) {
        setTimeout(() => pop(layer, part(i), {x: to.x + (Math.random() - 0.5) * 26, y: to.y + 8}, 450, {from: 0.4, to: 1.4}), i * 90);
      }
      await sleep(750);
      break;
    }
    case 'burst': {
      pop(layer, {file: 'flareball.png', size: 110}, from, 500, {from: 0.3, to: 2.4});
      flash(layer, FLASH[st.type] ?? '#ffffff', 400);
      setTimeout(() => pop(layer, {file: 'impact.png', size: 90}, to, 450, {from: 0.4, to: 1.8}), 200);
      shake(arena, 400, 6);
      await sleep(650);
      break;
    }
    case 'self': {
      for (let i = 0; i < 5; i++) {
        const x = from.x + (Math.random() - 0.5) * 16;
        setTimeout(() => fly(layer, {file: 'shine.png', size: 26, filter: parts[0].filter}, {x, y: from.y + 10}, {x, y: from.y - 18}, 520, {scaleFrom: 0.5, scaleTo: 1}), i * 90);
      }
      await sleep(5 * 90 + 500);
      break;
    }
    case 'targetStatus': {
      const p = st.type === 'Bug' ? {file: 'web.png', size: 60} : part(0);
      fly(layer, p, from, to, 450, {scaleFrom: 0.4, scaleTo: 0.9});
      setTimeout(() => pop(layer, p, to, 400, {from: 0.8, to: 1.4}), 430);
      await sleep(850);
      break;
    }
  }
}

/** Animação da pokébola indo até o selvagem. */
export function throwBallFx(layer: HTMLElement): Promise<void> {
  fly(layer, {file: 'pokeball.png', size: 28}, {x: 20, y: 90}, POS.p2, 480, {spin: true});
  return sleep(500);
}
