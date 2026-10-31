// Animações de golpes: um sistema de partículas em pixel art desenhado num canvas
// de baixa resolução por cima da arena (cada pixel do canvas vira um bloco 3x3).
// Cada golpe vira um formato (moveStyle.ts) e cada tipo tem sua paleta e física:
// fogo sobe e esfria de branco para fumaça, água cai, folhas giram, gelo brilha...
// Socos, chutes e mordidas ainda usam os sprites do Showdown (public/fx).
import {dex} from '../data/dex';
import {moveStyle} from './moveStyle';
import type {ContactKind} from './moveStyle';

export const FX = (file: string) => `${import.meta.env.BASE_URL}fx/${file}`;

type Point = {x: number; y: number};
/** Centro de cada Pokémon na arena, em % da largura/altura. */
const POS: Record<'p1' | 'p2', Point> = {p1: {x: 27, y: 70}, p2: {x: 72, y: 34}};

interface Particle {
  file: string;
  size: number;
  /** Endereço completo da imagem (no lugar de `file`). */
  src?: string;
  /** Filtro CSS para tingir sprites genéricos. */
  filter?: string;
}

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
  img.src = p.src ?? FX(p.file);
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

function shake(target: HTMLElement, ms = 600, px = 8) {
  target.animate(
    Array.from({length: 8}, (_, i) => ({transform: `translate(${i % 2 ? px : -px}px, ${i % 3 ? 2 : -2}px)`})).concat({transform: 'translate(0,0)'}),
    {duration: ms},
  );
}

// ------------------------------------------------------------ Partículas em pixel

/** Tamanho, em pixels da tela, de cada pixel do canvas de efeitos. */
const PX = 3;

type Shape = 'sq' | 'spark' | 'drop' | 'leaf' | 'shard' | 'star' | 'ring' | 'streak' | 'bubble';

interface TypeFx {
  /** Cores do nascimento à morte da partícula. */
  pal: string[];
  shape: Shape;
  /** Gravidade (px do canvas/s²); negativa sobe, como fogo. */
  g: number;
  size: [number, number];
  drag?: number;
  wobble?: number;
  flicker?: boolean;
}

const TFX: Record<string, TypeFx> = {
  Fire: {pal: ['#ffffff', '#fff3a0', '#ffd23f', '#ff9a2e', '#f2552c', '#b8322a', '#6e4b4b'], shape: 'sq', g: -90, size: [2, 4], drag: 2, flicker: true},
  Water: {pal: ['#ffffff', '#d4f1ff', '#7fcaf5', '#3d95e0', '#2a6fc0'], shape: 'drop', g: 160, size: [2, 3], drag: 0.6},
  Electric: {pal: ['#ffffff', '#fffbc2', '#ffe74a', '#f5c400', '#c99a00'], shape: 'spark', g: 0, size: [1, 2], drag: 4, flicker: true},
  Ice: {pal: ['#ffffff', '#e9fbff', '#b4ecfa', '#7fd0ea', '#4fa6cf'], shape: 'shard', g: 30, size: [1, 2], drag: 1.5},
  Grass: {pal: ['#f2ffc2', '#a8e86a', '#6cc94a', '#3f9a3a', '#2c6e2c'], shape: 'leaf', g: 40, size: [1, 2], drag: 1.5, wobble: 9},
  Poison: {pal: ['#f6dcff', '#d690f0', '#b05ad8', '#7e3aa8', '#562878'], shape: 'bubble', g: -50, size: [1, 2], drag: 1.5, wobble: 6},
  Psychic: {pal: ['#ffffff', '#ffd6f0', '#ff8fcf', '#f0559f', '#b8377a'], shape: 'ring', g: 0, size: [2, 3], drag: 1},
  Ghost: {pal: ['#f0e8ff', '#c4aef0', '#8f6fd8', '#5e44a8', '#3a2a6e'], shape: 'sq', g: -30, size: [2, 3], drag: 1.2, wobble: 5},
  Dark: {pal: ['#b8a8c8', '#7a6890', '#4e3f62', '#2e2440', '#1a1426'], shape: 'sq', g: 0, size: [2, 4], drag: 2},
  Dragon: {pal: ['#ffffff', '#ddd0ff', '#a88cff', '#7356e8', '#4a32b0'], shape: 'sq', g: -20, size: [2, 3], drag: 1.5, flicker: true},
  Fairy: {pal: ['#ffffff', '#fff0f8', '#ffc2e2', '#ff8cc6', '#e05aa0'], shape: 'star', g: -15, size: [1, 2], drag: 2, flicker: true},
  Fighting: {pal: ['#ffffff', '#ffe2c2', '#ffaf6e', '#e0703a', '#a8442a'], shape: 'star', g: 0, size: [1, 2], drag: 4},
  Flying: {pal: ['#ffffff', '#f2f8ff', '#d2e6f6', '#a8c8e2', '#86a8c8'], shape: 'streak', g: 0, size: [2, 3], drag: 1},
  Bug: {pal: ['#f6ffc2', '#d6ec6a', '#a8c83a', '#7a9a2a', '#526e1e'], shape: 'sq', g: 20, size: [1, 2], drag: 2, wobble: 12},
  Rock: {pal: ['#f0e2c0', '#cfb07c', '#a3824e', '#7a5e38', '#54402a'], shape: 'sq', g: 420, size: [2, 4], drag: 0.3},
  Ground: {pal: ['#f6e2b0', '#dcb46c', '#b48a46', '#8a6834', '#5e4626'], shape: 'sq', g: 320, size: [1, 3], drag: 0.5},
  Steel: {pal: ['#ffffff', '#eef2f8', '#c4ccda', '#94a0b6', '#68748c'], shape: 'shard', g: 60, size: [1, 2], drag: 2},
  Normal: {pal: ['#ffffff', '#fffbe8', '#ece4cc', '#c8bea4', '#a0967e'], shape: 'star', g: 0, size: [1, 2], drag: 3},
};
const tfx = (type: string) => TFX[type] ?? TFX.Normal;

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  fx: TypeFx;
  shape: Shape;
  seed: number;
}

type V = {x: number; y: number};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

class Stage {
  readonly c: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;
  /** Escala: 1 numa arena de ~720px de largura. */
  readonly u: number;
  parts: Part[] = [];
  /** Tarefas por quadro; devolvem false quando acabam. */
  tasks: ((t: number, dt: number) => boolean)[] = [];
  bolts: {pts: V[]; until: number; col: string}[] = [];
  flashes: {col: string; from: number; to: number}[] = [];
  t = 0;

  constructor(layer: HTMLElement) {
    this.c = document.createElement('canvas');
    this.w = Math.max(80, Math.round(layer.clientWidth / PX));
    this.h = Math.max(60, Math.round(layer.clientHeight / PX));
    this.u = this.w / 240;
    this.c.width = this.w;
    this.c.height = this.h;
    this.c.className = 'fx-canvas';
    layer.appendChild(this.c);
    this.g = this.c.getContext('2d')!;
  }

  pt(p: Point): V {
    return {x: (p.x / 100) * this.w, y: (p.y / 100) * this.h};
  }

  add(type: string, at: V, o: {speed: [number, number]; angle?: number; spread?: number; life: [number, number]; shape?: Shape; size?: number; jitter?: number}): void {
    const f = tfx(type);
    const ang = (o.angle ?? 0) + (o.spread === undefined ? rand(-Math.PI, Math.PI) : rand(-o.spread, o.spread));
    const sp = rand(o.speed[0], o.speed[1]) * this.u;
    const j = (o.jitter ?? 0) * this.u;
    this.parts.push({
      x: at.x + rand(-j, j),
      y: at.y + rand(-j, j),
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      age: 0,
      life: rand(o.life[0], o.life[1]),
      size: o.size ?? Math.round(rand(f.size[0], f.size[1] + 0.99)),
      fx: f,
      shape: o.shape ?? f.shape,
      seed: Math.random() * 100,
    });
  }

  burst(type: string, at: V, n: number, speed: [number, number] = [40, 130], life: [number, number] = [0.25, 0.6]): void {
    for (let i = 0; i < n; i++) this.add(type, at, {speed, life, jitter: 2});
  }

  at(ms: number, fn: () => void): void {
    this.tasks.push(t => {
      if (t < ms) return true;
      fn();
      return false;
    });
  }

  during(from: number, to: number, fn: (k: number, dt: number) => void): void {
    this.tasks.push((t, dt) => {
      if (t < from) return true;
      fn(Math.min(1, (t - from) / (to - from)), dt);
      return t < to;
    });
  }

  flash(col: string, ms: number): void {
    this.flashes.push({col, from: this.t, to: this.t + ms});
  }

  bolt(a: V, b: V, ms: number, col = '#fff59a'): void {
    const pts: V[] = [a];
    const n = 7;
    for (let i = 1; i < n; i++) {
      const k = i / n;
      pts.push({x: a.x + (b.x - a.x) * k + rand(-6, 6) * this.u, y: a.y + (b.y - a.y) * k + rand(-4, 4) * this.u});
    }
    pts.push(b);
    this.bolts.push({pts, until: this.t + ms, col});
  }

  private line(a: V, b: V, col: string, thick = 1): void {
    const g = this.g;
    g.fillStyle = col;
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) | 0;
    for (let i = 0; i <= steps; i++) {
      const k = steps ? i / steps : 0;
      const x = Math.round(a.x + (b.x - a.x) * k);
      const y = Math.round(a.y + (b.y - a.y) * k);
      g.fillRect(x - (thick >> 1), y - (thick >> 1), thick, thick);
    }
  }

  private draw(p: Part): void {
    const g = this.g;
    const f = p.age / p.life;
    const pal = p.fx.pal;
    const col = pal[Math.min(pal.length - 1, Math.floor(f * pal.length))];
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const s = Math.max(1, Math.round(p.size * (1 - f * 0.5)));
    g.globalAlpha = p.fx.flicker ? rand(0.65, 1) : f > 0.75 ? (1 - f) * 4 : 1;
    g.fillStyle = col;
    switch (p.shape) {
      case 'sq':
        g.fillRect(x - (s >> 1), y - (s >> 1), s, s);
        break;
      case 'spark':
        g.fillRect(x, y, 1, 1);
        if (Math.random() < 0.6) g.fillRect(x + (Math.random() < 0.5 ? 1 : -1), y + (Math.random() < 0.5 ? 1 : -1), 1, 1);
        if (s > 1) g.fillRect(x - 1, y, 3, 1);
        break;
      case 'drop':
        g.fillRect(x, y, s, s + 1);
        g.fillStyle = pal[0];
        g.fillRect(x, y, 1, 1);
        break;
      case 'leaf': {
        const d = Math.floor((p.age * 10 + p.seed) % 4);
        if (d === 0) g.fillRect(x - 1, y, 3, 1);
        else if (d === 2) g.fillRect(x, y - 1, 1, 3);
        else {
          const sx = d === 1 ? 1 : -1;
          g.fillRect(x - sx, y - 1, 1, 1);
          g.fillRect(x, y, 1, 1);
          g.fillRect(x + sx, y + 1, 1, 1);
        }
        if (s > 1) g.fillRect(x + 1, y + 1, 1, 1);
        break;
      }
      case 'shard':
      case 'star':
        g.fillRect(x, y - s, 1, s * 2 + 1);
        g.fillRect(x - s, y, s * 2 + 1, 1);
        g.fillStyle = pal[0];
        g.fillRect(x, y, 1, 1);
        break;
      case 'ring': {
        const r = Math.round(s + f * 6 * this.u);
        g.fillRect(x - r, y - r, r * 2 + 1, 1);
        g.fillRect(x - r, y + r, r * 2 + 1, 1);
        g.fillRect(x - r, y - r, 1, r * 2 + 1);
        g.fillRect(x + r, y - r, 1, r * 2 + 1);
        break;
      }
      case 'bubble':
        g.fillRect(x - 1, y - 2, 3, 1);
        g.fillRect(x - 1, y + 2, 3, 1);
        g.fillRect(x - 2, y - 1, 1, 3);
        g.fillRect(x + 2, y - 1, 1, 3);
        g.fillStyle = pal[0];
        g.fillRect(x - 1, y - 1, 1, 1);
        break;
      case 'streak': {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const len = 3 + s * 2;
        this.line({x, y}, {x: x - (p.vx / sp) * len, y: y - (p.vy / sp) * len}, col);
        break;
      }
    }
  }

  run(maxMs = 3500): Promise<void> {
    return new Promise(resolve => {
      let last = performance.now();
      const frame = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.t += dt * 1000;
        this.tasks = this.tasks.filter(fn => fn(this.t, dt));
        for (const p of this.parts) {
          p.age += dt;
          const drag = p.fx.drag ?? 0;
          p.vx *= Math.max(0, 1 - drag * dt);
          p.vy *= Math.max(0, 1 - drag * dt);
          p.vy += p.fx.g * this.u * dt;
          if (p.fx.wobble) p.vx += Math.sin(p.age * p.fx.wobble + p.seed) * 40 * this.u * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        this.parts = this.parts.filter(p => p.age < p.life);
        const g = this.g;
        g.clearRect(0, 0, this.w, this.h);
        for (const fl of this.flashes) {
          const k = (this.t - fl.from) / (fl.to - fl.from);
          if (k < 0 || k > 1) continue;
          g.globalAlpha = 0.55 * (1 - k);
          g.fillStyle = fl.col;
          g.fillRect(0, 0, this.w, this.h);
        }
        this.flashes = this.flashes.filter(fl => this.t < fl.to);
        for (const b of this.bolts) {
          g.globalAlpha = Math.random() < 0.25 ? 0.4 : 1;
          for (let i = 1; i < b.pts.length; i++) this.line(b.pts[i - 1], b.pts[i], b.col, 3);
          for (let i = 1; i < b.pts.length; i++) this.line(b.pts[i - 1], b.pts[i], '#ffffff', 1);
        }
        this.bolts = this.bolts.filter(b => this.t < b.until);
        for (const p of this.parts) this.draw(p);
        g.globalAlpha = 1;
        const done = !this.tasks.length && !this.parts.length && !this.bolts.length && !this.flashes.length;
        if (done || this.t > maxMs) {
          this.c.remove();
          resolve();
        } else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
}

const FLASH: Record<string, string> = {
  Fire: '#ffb36b', Electric: '#fff6a8', Ice: '#e6f8ff', Psychic: '#ffc2e0', Water: '#bfe3ff', Grass: '#d8ffc2',
  Ghost: '#cdb8f0', Dark: '#2a2236', Fairy: '#ffd6ec', Dragon: '#c9b3ff', Normal: '#ffffff', Fighting: '#ffd2a8',
};

const angleTo = (a: V, b: V) => Math.atan2(b.y - a.y, b.x - a.x);

/** Um "projétil" com rastro: a bolinha de fogo do Ember, a Shadow Ball, a Energy Ball... */
function projectile(st: Stage, type: string, a: V, b: V, start: number, ms: number, big: boolean): void {
  const f = tfx(type);
  const arc = (big ? 8 : 14) * st.u;
  st.during(start, start + ms, k => {
    const e = k * k * (3 - 2 * k);
    const pos = {x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * arc};
    // Núcleo: alguns pixels claros que somem logo, formando a "bola".
    const core = big ? 5 : 3;
    for (let i = 0; i < core + 3; i++) st.add(type, pos, {speed: [0, 8], life: [0.06, 0.1], jitter: core * 0.5, size: big ? 4 : 3, shape: 'sq'});
    // Rastro com a física do tipo (fogo sobe, água pinga, folhas giram).
    for (let i = 0; i < (big ? 4 : 2); i++) st.add(type, pos, {speed: [6, 26], life: [0.18, 0.45], jitter: 1.5, shape: f.shape === 'ring' ? 'sq' : undefined});
  });
  st.at(start + ms, () => {
    st.burst(type, b, big ? 34 : 18, big ? [50, 150] : [30, 100]);
    st.burst('Normal', b, 6, [60, 120], [0.1, 0.2]);
    if (big && FLASH[type]) st.flash(FLASH[type], 220);
  });
}

/** Jato contínuo do atacante ao alvo: Flamethrower, Water Gun, Ice Beam, Thunderbolt... */
function stream(st: Stage, type: string, a: V, b: V, ms: number, strong: boolean): void {
  const ang = angleTo(a, b);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const speed = 300;
  const life = dist / (speed * st.u);
  const beam = ['Psychic', 'Dragon', 'Ghost', 'Dark', 'Fairy', 'Normal', 'Steel', 'Bug', 'Fighting'].includes(type);
  st.during(0, ms, () => {
    for (let i = 0; i < (strong ? 7 : 5); i++) {
      st.add(type, a, {speed: [speed * 0.85, speed * 1.1], angle: ang, spread: strong ? 0.13 : 0.09, life: [life * 0.9, life * 1.1], jitter: 2});
    }
    if (type === 'Electric' && Math.random() < 0.35) st.bolt(a, b, 70);
    if (type === 'Ice' && Math.random() < 0.5) st.bolt(a, b, 50, '#bfefff');
    if (beam && Math.random() < 0.5) st.add(type, a, {speed: [speed, speed], angle: ang, spread: 0.02, life: [life, life], shape: 'ring'});
  });
  st.during(life * 1000, ms + life * 1000, () => {
    for (let i = 0; i < 3; i++) st.add(type, b, {speed: [30, 110], life: [0.15, 0.4], jitter: 3});
  });
  if (FLASH[type] && strong) st.at(ms * 0.7, () => st.flash(FLASH[type], 260));
}

/** Toca a animação do golpe; a promessa termina quando ela acaba. */
export async function playMoveFx(layer: HTMLElement, arena: HTMLElement, move: string, side: 'p1' | 'p2'): Promise<void> {
  const ms = moveStyle(move);
  const md = dex.moves.get(move);
  const type = ms.type;
  const st = new Stage(layer);
  const a = st.pt(POS[side]);
  const b = st.pt(POS[side === 'p1' ? 'p2' : 'p1']);
  const strong = ms.power >= 90;
  const ground = (p: V) => ({x: p.x, y: p.y + 14 * st.u});

  switch (ms.shape) {
    case 'contact': {
      const list = CONTACT[ms.contact];
      if (ms.contact === 'slash' || ms.contact === 'claw') {
        // Riscos brancos em diagonal desenhados pixel a pixel.
        const lines = ms.contact === 'claw' ? 3 : 2;
        for (let i = 0; i < lines; i++) {
          const off = (i - (lines - 1) / 2) * 6 * st.u;
          const p0 = {x: b.x - 14 * st.u + off, y: b.y - 14 * st.u};
          const p1 = {x: b.x + 14 * st.u + off, y: b.y + 14 * st.u};
          st.at(150 + i * 70, () => st.bolt(p0, p1, 160, type === 'Normal' ? '#d8d0ff' : tfx(type).pal[2]));
        }
      } else if (ms.contact === 'bite') {
        await sleep(180);
        const top = spawn(layer, list[0], {x: POS[side === 'p1' ? 'p2' : 'p1'].x, y: POS[side === 'p1' ? 'p2' : 'p1'].y - 10});
        const bot = spawn(layer, list[1], {x: POS[side === 'p1' ? 'p2' : 'p1'].x, y: POS[side === 'p1' ? 'p2' : 'p1'].y + 10});
        top.animate([{transform: 'translate(-50%,-90%)'}, {transform: 'translate(-50%,-50%)'}], {duration: 220, fill: 'forwards'});
        bot.animate([{transform: 'translate(-50%,-10%)'}, {transform: 'translate(-50%,-50%)'}], {duration: 220, fill: 'forwards'});
        setTimeout(() => {
          top.remove();
          bot.remove();
        }, 380);
      } else {
        const to = POS[side === 'p1' ? 'p2' : 'p1'];
        setTimeout(() => pop(layer, list[0], to, 340, {from: 0.6, to: 1.3}), 160);
      }
      st.at(220, () => {
        st.burst('Normal', b, 10, [60, 140], [0.12, 0.25]);
        if (type !== 'Normal') st.burst(type, b, strong ? 28 : 18, [40, 120]);
      });
      break;
    }
    case 'stream':
      stream(st, type, a, b, strong ? 650 : 480, strong);
      break;
    case 'projectile': {
      const n = ms.power >= 80 ? 1 : ms.power > 0 && ms.power <= 40 ? 2 : 1;
      for (let i = 0; i < n; i++) projectile(st, type, a, b, i * 160, 420, ms.power >= 80);
      break;
    }
    case 'rain': {
      if (type === 'Electric') {
        const top = {x: b.x + rand(-6, 6), y: -4};
        st.flash(FLASH.Electric, 300);
        st.bolt(top, b, 260);
        st.at(120, () => st.bolt({x: b.x + 4, y: -4}, b, 200));
        st.at(150, () => st.burst('Electric', b, 30, [40, 140]));
        break;
      }
      const drops = type === 'Rock' || type === 'Ice' ? 9 : 14;
      for (let i = 0; i < drops; i++) {
        const x = b.x + rand(-26, 26) * st.u;
        const land = {x, y: b.y + rand(-6, 10) * st.u};
        const top = {x: x - 20 * st.u, y: -6};
        projectile(st, type, top, land, i * 55, 300, type === 'Rock' || type === 'Ice');
      }
      if (FLASH[type]) st.at(drops * 55 + 200, () => st.flash(FLASH[type], 200));
      break;
    }
    case 'quake': {
      shake(arena, 750, 10);
      const g = ground(b);
      for (let i = 0; i < 7; i++) {
        st.at(i * 80, () => {
          const p = {x: g.x + rand(-30, 30) * st.u, y: g.y};
          for (let j = 0; j < 8; j++) st.add(type === 'Ground' ? 'Ground' : type, p, {speed: [60, 150], angle: -Math.PI / 2, spread: 0.6, life: [0.4, 0.7]});
          for (let j = 0; j < 3; j++) st.add('Rock', p, {speed: [70, 140], angle: -Math.PI / 2, spread: 0.4, life: [0.5, 0.8]});
        });
      }
      break;
    }
    case 'burst': {
      st.flash(FLASH[type] ?? '#ffffff', 450);
      shake(arena, 450, 7);
      st.burst(type, a, 50, [60, 220], [0.35, 0.8]);
      st.burst('Fire', a, 44, [50, 200], [0.3, 0.8]);
      st.at(180, () => st.burst(type, b, 36, [50, 160]));
      break;
    }
    case 'self': {
      const boosts = {...(md.boosts ?? {}), ...(md.self?.boosts ?? {})} as Record<string, number>;
      if (boosts.spe && boosts.spe > 0) {
        // Velocidade: rajadas horizontais passando pelo Pokémon.
        st.during(0, 500, () => {
          for (let i = 0; i < 2; i++) {
            st.add('Flying', {x: a.x + 30 * st.u, y: a.y + rand(-18, 14) * st.u}, {speed: [260, 340], angle: Math.PI, spread: 0.02, life: [0.15, 0.25], shape: 'streak', size: 3});
          }
        });
      } else if (md.heal || md.flags.heal) {
        st.during(0, 500, () => st.add('Grass', {x: a.x + rand(-16, 16) * st.u, y: a.y + 14 * st.u}, {speed: [40, 70], angle: -Math.PI / 2, spread: 0.1, life: [0.4, 0.6], shape: 'star'}));
      }
      // Brilhos do tipo subindo ao redor de quem usou o golpe.
      st.during(0, 550, () => {
        st.add(type, {x: a.x + rand(-18, 18) * st.u, y: a.y + 16 * st.u}, {speed: [45, 85], angle: -Math.PI / 2, spread: 0.12, life: [0.4, 0.65]});
        if (Math.random() < 0.3) st.add('Normal', {x: a.x + rand(-18, 18) * st.u, y: a.y + rand(-14, 14) * st.u}, {speed: [0, 5], life: [0.2, 0.35], shape: 'star'});
      });
      break;
    }
    case 'targetStatus': {
      const lowers = Object.values((md.boosts ?? {}) as Record<string, number>).some(v => v < 0);
      projectile(st, type, a, b, 0, 380, false);
      st.at(380, () => {
        for (let i = 0; i < 4; i++) st.add(type, b, {speed: [0, 0], life: [0.5, 0.7], shape: 'ring', size: 2 + i * 3});
      });
      if (lowers) {
        st.during(380, 800, () => st.add('Water', {x: b.x + rand(-16, 16) * st.u, y: b.y - 16 * st.u}, {speed: [50, 80], angle: Math.PI / 2, spread: 0.05, life: [0.3, 0.5], shape: 'streak', size: 2}));
      }
      break;
    }
  }
  await st.run();
}

/** Animação da pokébola indo até o selvagem. */
export function throwBallFx(layer: HTMLElement, src?: string): Promise<void> {
  fly(layer, {file: 'pokeball.png', src, size: 28}, {x: 20, y: 90}, POS.p2, 480, {spin: true});
  return sleep(500);
}
