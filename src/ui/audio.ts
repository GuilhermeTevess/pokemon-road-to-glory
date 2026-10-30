// Sons: gritos dos Pokémon (versões modernas do PokéAPI, com os do Showdown como
// reserva) e efeitos de golpe sintetizados com Web Audio. Cada tipo tem um timbre
// próprio e cada formato de golpe (moveStyle.ts) tem seu ritmo: soco, jato, chuva...
import {species, toID} from '../data/dex';
import {moveStyle} from './moveStyle';

let enabled = (() => {
  try {
    return localStorage.getItem('rtg-sound') !== 'off';
  } catch {
    return true;
  }
})();
const volume = 0.55;

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem('rtg-sound', on ? 'on' : 'off');
  } catch {
    /* ignora */
  }
}

// ------------------------------------------------------------ Gritos

function cryUrls(name: string): string[] {
  const s = species(name);
  const base = toID(s.baseSpecies);
  const forme = s.forme ? `${base}-${toID(s.forme)}` : base;
  return [
    // Gritos modernos (X/Y em diante).
    `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${s.num}.ogg`,
    // Reserva (ex.: Safari antigo sem .ogg).
    `https://play.pokemonshowdown.com/audio/cries/${forme}.mp3`,
    `https://play.pokemonshowdown.com/audio/cries/${base}.mp3`,
  ];
}

export function playCry(name: string): void {
  if (!enabled) return;
  const urls = [...new Set(cryUrls(name))];
  const tryAt = (i: number) => {
    if (i >= urls.length) return;
    const a = new Audio(urls[i]);
    a.volume = volume * 0.7;
    let failed = false;
    const fail = () => {
      if (failed) return;
      failed = true;
      tryAt(i + 1);
    };
    a.onerror = fail;
    a.play().catch(fail);
  };
  tryAt(0);
}

// ------------------------------------------------------------ Motor de síntese

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;

function audio(): {c: AudioContext; out: AudioNode} | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      // Compressor + um pouco de reverb deixam os efeitos mais "cheios".
      const comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      const dry = ctx.createGain();
      dry.gain.value = 0.85;
      dry.connect(comp);
      const verb = ctx.createConvolver();
      verb.buffer = impulse(ctx, 1.2);
      const wet = ctx.createGain();
      wet.gain.value = 0.25;
      verb.connect(wet).connect(comp);
      const bus = ctx.createGain();
      bus.connect(dry);
      bus.connect(verb);
      out = bus;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return {c: ctx, out: out!};
  } catch {
    return null;
  }
}

function impulse(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return buf;
}

let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

interface ToneOpts {
  wave: OscillatorType;
  from: number;
  to: number;
  dur: number;
  gain?: number;
  at?: number;
  vibrato?: number;
  attack?: number;
}

function tone(a: {c: AudioContext; out: AudioNode}, o: ToneOpts): void {
  const {c} = a;
  const t = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.wave;
  osc.frequency.setValueAtTime(o.from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
  if (o.vibrato) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = o.vibrato;
    lg.gain.value = o.from * 0.06;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.dur);
  }
  const peak = (o.gain ?? 0.25) * volume;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

interface NoiseOpts {
  filter: BiquadFilterType;
  from: number;
  to: number;
  dur: number;
  gain?: number;
  at?: number;
  q?: number;
  attack?: number;
}

function noise(a: {c: AudioContext; out: AudioNode}, o: NoiseOpts): void {
  const {c} = a;
  const t = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = o.filter;
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
  const g = c.createGain();
  const peak = (o.gain ?? 0.35) * volume;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(a.out);
  src.start(t, Math.random());
  src.stop(t + o.dur + 0.05);
}

type A = {c: AudioContext; out: AudioNode};

/**
 * Timbre de cada tipo. `dur` é a duração do trecho e `k` a intensidade (0–1.5).
 * O mesmo timbre é usado curto (acerto), longo (jato) ou repetido (chuva).
 */
const VOICES: Record<string, (a: A, at: number, dur: number, k: number) => void> = {
  Fire: (a, at, dur, k) => {
    noise(a, {filter: 'lowpass', from: 3200, to: 500, dur, gain: 0.45 * k, at, attack: 0.03});
    noise(a, {filter: 'bandpass', from: 900, to: 300, dur: dur * 0.8, gain: 0.25 * k, at, q: 2});
    for (let i = 0; i < Math.ceil(dur * 14); i++) noise(a, {filter: 'highpass', from: 3000, to: 3000, dur: 0.02, gain: 0.15 * k, at: at + Math.random() * dur});
  },
  Water: (a, at, dur, k) => {
    noise(a, {filter: 'bandpass', from: 700, to: 1400, dur, gain: 0.3 * k, at, q: 1.5, attack: 0.04});
    for (let i = 0; i < Math.ceil(dur * 12); i++) {
      const f = 300 + Math.random() * 500;
      tone(a, {wave: 'sine', from: f, to: f * 2.2, dur: 0.07, gain: 0.18 * k, at: at + Math.random() * dur});
    }
  },
  Electric: (a, at, dur, k) => {
    noise(a, {filter: 'highpass', from: 2500, to: 5000, dur, gain: 0.22 * k, at});
    for (let i = 0; i < Math.ceil(dur * 18); i++) {
      const f = 200 + Math.random() * 1800;
      tone(a, {wave: 'square', from: f, to: f * (0.5 + Math.random()), dur: 0.045, gain: 0.09 * k, at: at + (i / 18)});
    }
  },
  Grass: (a, at, dur, k) => {
    noise(a, {filter: 'highpass', from: 2500, to: 6500, dur, gain: 0.28 * k, at, attack: 0.05});
    tone(a, {wave: 'triangle', from: 500, to: 800, dur: dur * 0.6, gain: 0.08 * k, at});
  },
  Ice: (a, at, dur, k) => {
    noise(a, {filter: 'highpass', from: 6000, to: 9000, dur, gain: 0.18 * k, at});
    [1760, 2349, 2794, 3520].forEach((f, i) => tone(a, {wave: 'sine', from: f, to: f * 1.01, dur: 0.4, gain: 0.1 * k, at: at + i * Math.min(0.08, dur / 5)}));
  },
  Fighting: (a, at, dur, k) => {
    tone(a, {wave: 'sine', from: 170, to: 45, dur: Math.min(0.25, dur), gain: 0.6 * k, at});
    noise(a, {filter: 'lowpass', from: 1800, to: 300, dur: 0.15, gain: 0.4 * k, at});
  },
  Poison: (a, at, dur, k) => {
    tone(a, {wave: 'sawtooth', from: 180, to: 120, dur, gain: 0.12 * k, at, vibrato: 18});
    for (let i = 0; i < Math.ceil(dur * 8); i++) tone(a, {wave: 'sine', from: 150, to: 420, dur: 0.1, gain: 0.15 * k, at: at + Math.random() * dur});
  },
  Ground: (a, at, dur, k) => {
    tone(a, {wave: 'sine', from: 80, to: 35, dur, gain: 0.6 * k, at});
    noise(a, {filter: 'lowpass', from: 500, to: 80, dur, gain: 0.45 * k, at});
  },
  Flying: (a, at, dur, k) => noise(a, {filter: 'bandpass', from: 400, to: 2600, dur, gain: 0.4 * k, at, q: 3, attack: dur * 0.3}),
  Psychic: (a, at, dur, k) => {
    tone(a, {wave: 'sine', from: 330, to: 1320, dur, gain: 0.2 * k, at, vibrato: 9, attack: 0.08});
    tone(a, {wave: 'sine', from: 495, to: 1980, dur, gain: 0.1 * k, at, vibrato: 7, attack: 0.08});
  },
  Bug: (a, at, dur, k) => tone(a, {wave: 'sawtooth', from: 520, to: 460, dur, gain: 0.09 * k, at, vibrato: 45}),
  Rock: (a, at, dur, k) => {
    for (let i = 0; i < Math.max(2, Math.ceil(dur * 6)); i++) noise(a, {filter: 'lowpass', from: 900, to: 150, dur: 0.14, gain: 0.45 * k, at: at + i * 0.09});
  },
  Ghost: (a, at, dur, k) => {
    tone(a, {wave: 'triangle', from: 600, to: 150, dur: dur + 0.2, gain: 0.22 * k, at, vibrato: 5, attack: 0.1});
    tone(a, {wave: 'sine', from: 900, to: 220, dur: dur + 0.2, gain: 0.08 * k, at: at + 0.05, vibrato: 4});
  },
  Dragon: (a, at, dur, k) => {
    tone(a, {wave: 'sawtooth', from: 200, to: 70, dur: dur + 0.15, gain: 0.2 * k, at, vibrato: 14, attack: 0.06});
    noise(a, {filter: 'lowpass', from: 1400, to: 200, dur: dur + 0.15, gain: 0.3 * k, at});
  },
  Dark: (a, at, dur, k) => {
    tone(a, {wave: 'sawtooth', from: 140, to: 55, dur, gain: 0.16 * k, at});
    noise(a, {filter: 'bandpass', from: 500, to: 150, dur, gain: 0.3 * k, at, q: 2});
  },
  Steel: (a, at, dur, k) => {
    [523, 1307, 2091, 3137].forEach(f => tone(a, {wave: 'triangle', from: f, to: f * 0.99, dur: Math.max(0.35, dur), gain: 0.09 * k, at}));
    noise(a, {filter: 'highpass', from: 4000, to: 4000, dur: 0.05, gain: 0.25 * k, at});
  },
  Fairy: (a, at, dur, k) => {
    [1568, 1976, 2349, 3136].forEach((f, i) => tone(a, {wave: 'sine', from: f, to: f, dur: 0.25, gain: 0.08 * k, at: at + i * Math.min(0.07, dur / 4)}));
    noise(a, {filter: 'highpass', from: 7000, to: 9000, dur, gain: 0.1 * k, at});
  },
  Normal: (a, at, dur, k) => {
    tone(a, {wave: 'triangle', from: 260, to: 90, dur: Math.min(0.2, dur), gain: 0.4 * k, at});
    noise(a, {filter: 'bandpass', from: 1600, to: 500, dur: Math.min(0.15, dur), gain: 0.3 * k, at});
  },
};

function impact(a: A, at: number, k = 1): void {
  tone(a, {wave: 'sine', from: 150, to: 45, dur: 0.18, gain: 0.55 * k, at});
  noise(a, {filter: 'lowpass', from: 2500, to: 250, dur: 0.12, gain: 0.45 * k, at});
}

function whoosh(a: A, at: number, dur: number): void {
  noise(a, {filter: 'bandpass', from: 300, to: 1800, dur, gain: 0.25, at, q: 2, attack: dur * 0.5});
}

/** Som do golpe: timbre do tipo + ritmo do formato. */
export function playMove(moveName: string): void {
  const a = audio();
  if (!a) return;
  const st = moveStyle(moveName);
  const voice = VOICES[st.type] ?? VOICES.Normal;
  const k = st.power >= 100 ? 1.25 : st.power >= 70 ? 1 : 0.8;
  switch (st.shape) {
    case 'contact':
      whoosh(a, 0, 0.18);
      impact(a, 0.18, k);
      if (st.type !== 'Normal') voice(a, 0.18, 0.22, 0.8 * k);
      if (st.contact === 'claw' || st.contact === 'slash') noise(a, {filter: 'highpass', from: 3000, to: 7000, dur: 0.12, gain: 0.3, at: 0.2});
      break;
    case 'stream':
      voice(a, 0, st.power >= 90 ? 0.9 : 0.65, k);
      break;
    case 'projectile': {
      const n = st.power >= 80 ? 1 : st.power > 0 && st.power <= 40 ? 3 : 2;
      for (let i = 0; i < n; i++) voice(a, i * 0.11, 0.3, 0.8 * k);
      impact(a, 0.42 + (n - 1) * 0.11, 0.7 * k);
      break;
    }
    case 'rain':
      if (st.type === 'Electric') {
        noise(a, {filter: 'highpass', from: 1500, to: 300, dur: 0.25, gain: 0.6});
        tone(a, {wave: 'sine', from: 70, to: 30, dur: 1, gain: 0.5, at: 0.05});
        noise(a, {filter: 'lowpass', from: 300, to: 60, dur: 1, gain: 0.4, at: 0.1});
      } else {
        for (let i = 0; i < 6; i++) voice(a, i * 0.08, 0.2, 0.6 * k);
        impact(a, 0.5, k);
      }
      break;
    case 'quake':
      VOICES.Ground(a, 0, 0.9, 1.2);
      break;
    case 'burst':
      noise(a, {filter: 'lowpass', from: 4000, to: 100, dur: 1, gain: 0.7});
      tone(a, {wave: 'sine', from: 100, to: 30, dur: 0.9, gain: 0.6});
      voice(a, 0.05, 0.5, k);
      break;
    case 'self': {
      const wave: OscillatorType = st.type === 'Electric' || st.type === 'Steel' ? 'square' : 'sine';
      [523, 659, 784, 1047].forEach((f, i) => tone(a, {wave, from: f, to: f, dur: 0.14, gain: 0.12, at: i * 0.08}));
      voice(a, 0.1, 0.3, 0.4);
      break;
    }
    case 'targetStatus':
      [880, 740, 587].forEach((f, i) => tone(a, {wave: 'triangle', from: f, to: f * 0.97, dur: 0.15, gain: 0.12, at: i * 0.09}));
      voice(a, 0.25, 0.3, 0.5);
      break;
  }
}

export function playHit(effect: 'normal' | 'super' | 'resisted' | 'crit'): void {
  const a = audio();
  if (!a) return;
  if (effect === 'resisted') {
    noise(a, {filter: 'lowpass', from: 600, to: 200, dur: 0.12, gain: 0.25});
    return;
  }
  if (effect === 'super') {
    impact(a, 0, 1.2);
    impact(a, 0.09, 1);
    tone(a, {wave: 'square', from: 300, to: 80, dur: 0.2, gain: 0.15, at: 0.05});
  }
  if (effect === 'crit') {
    tone(a, {wave: 'triangle', from: 1700, to: 2300, dur: 0.18, gain: 0.18});
    tone(a, {wave: 'triangle', from: 2550, to: 3400, dur: 0.18, gain: 0.12, at: 0.05});
  }
}

export function playBall(): void {
  const a = audio();
  if (!a) return;
  whoosh(a, 0, 0.35);
  tone(a, {wave: 'square', from: 900, to: 400, dur: 0.08, gain: 0.12, at: 0.45});
}

export function playShake(): void {
  const a = audio();
  if (!a) return;
  tone(a, {wave: 'square', from: 260, to: 220, dur: 0.06, gain: 0.1});
  noise(a, {filter: 'bandpass', from: 1200, to: 900, dur: 0.06, gain: 0.15});
}

export function playJingle(kind: 'catch' | 'victory' | 'levelUp' | 'faint'): void {
  const a = audio();
  if (!a) return;
  const notes =
    kind === 'catch' ? [523, 659, 784, 1047, 784, 1047] : kind === 'victory' ? [659, 784, 988, 1319] : kind === 'levelUp' ? [784, 988, 1175] : [392, 330, 262, 196];
  notes.forEach((f, i) => tone(a, {wave: 'square', from: f, to: f, dur: 0.15, gain: 0.08, at: i * 0.11}));
  notes.forEach((f, i) => tone(a, {wave: 'triangle', from: f / 2, to: f / 2, dur: 0.15, gain: 0.1, at: i * 0.11}));
}

export function playClick(): void {
  const a = audio();
  if (!a) return;
  tone(a, {wave: 'square', from: 1200, to: 1000, dur: 0.04, gain: 0.05});
}
