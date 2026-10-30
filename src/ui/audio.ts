// Sons: gritos originais (arquivos do Showdown / PokéAPI) e efeitos de golpe
// sintetizados com Web Audio, variando por tipo.
import {dex, species, toID} from '../data/dex';

let enabled = (() => {
  try {
    return localStorage.getItem('rtg-sound') !== 'off';
  } catch {
    return true;
  }
})();
let volume = 0.5;

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
    `https://play.pokemonshowdown.com/audio/cries/${forme}.mp3`,
    `https://play.pokemonshowdown.com/audio/cries/${base}.mp3`,
    `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${s.num}.ogg`,
  ];
}

export function playCry(name: string): void {
  if (!enabled) return;
  const urls = [...new Set(cryUrls(name))];
  const tryAt = (i: number) => {
    if (i >= urls.length) return;
    const a = new Audio(urls[i]);
    a.volume = volume * 0.8;
    a.play().catch(() => tryAt(i + 1));
    a.onerror = () => tryAt(i + 1);
  };
  tryAt(0);
}

// ------------------------------------------------------------ Efeitos sintetizados

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

interface ToneOpts {
  type: OscillatorType;
  from: number;
  to: number;
  dur: number;
  gain?: number;
  delay?: number;
  vibrato?: number;
}

function tone(c: AudioContext, o: ToneOpts): void {
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
  if (o.vibrato) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = o.vibrato;
    lg.gain.value = o.from * 0.08;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.dur);
  }
  g.gain.setValueAtTime((o.gain ?? 0.3) * volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + o.dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

interface NoiseOpts {
  dur: number;
  filter: BiquadFilterType;
  from: number;
  to: number;
  gain?: number;
  delay?: number;
  q?: number;
}

function noise(c: AudioContext, o: NoiseOpts): void {
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, o.dur + 0.05);
  const f = c.createBiquadFilter();
  f.type = o.filter;
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime((o.gain ?? 0.4) * volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + o.dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + o.dur + 0.05);
}

const TYPE_SFX: Record<string, (c: AudioContext) => void> = {
  Fire: c => noise(c, {dur: 0.6, filter: 'lowpass', from: 3000, to: 200, gain: 0.5}),
  Water: c => {
    for (let i = 0; i < 5; i++) tone(c, {type: 'sine', from: 300 + i * 90, to: 900 + i * 60, dur: 0.12, delay: i * 0.07, gain: 0.25});
  },
  Electric: c => {
    for (let i = 0; i < 6; i++) tone(c, {type: 'square', from: 400 + Math.random() * 1600, to: 200 + Math.random() * 600, dur: 0.06, delay: i * 0.05, gain: 0.12});
  },
  Grass: c => noise(c, {dur: 0.45, filter: 'highpass', from: 2000, to: 6000, gain: 0.3}),
  Ice: c => {
    [1800, 2400, 3000].forEach((f, i) => tone(c, {type: 'sine', from: f, to: f * 1.02, dur: 0.35, delay: i * 0.06, gain: 0.15}));
  },
  Fighting: c => {
    tone(c, {type: 'sine', from: 180, to: 50, dur: 0.18, gain: 0.6});
    noise(c, {dur: 0.12, filter: 'lowpass', from: 1200, to: 300, gain: 0.4});
  },
  Normal: c => {
    tone(c, {type: 'triangle', from: 220, to: 70, dur: 0.15, gain: 0.5});
    noise(c, {dur: 0.1, filter: 'bandpass', from: 1500, to: 600, gain: 0.3});
  },
  Rock: c => {
    for (let i = 0; i < 3; i++) noise(c, {dur: 0.15, filter: 'lowpass', from: 800, to: 120, gain: 0.5, delay: i * 0.09});
  },
  Ground: c => {
    tone(c, {type: 'sine', from: 90, to: 30, dur: 0.6, gain: 0.7});
    noise(c, {dur: 0.5, filter: 'lowpass', from: 400, to: 60, gain: 0.5});
  },
  Flying: c => noise(c, {dur: 0.5, filter: 'bandpass', from: 600, to: 2500, gain: 0.4, q: 3}),
  Psychic: c => tone(c, {type: 'sine', from: 300, to: 1200, dur: 0.6, gain: 0.25, vibrato: 12}),
  Fairy: c => {
    [1200, 1500, 1800, 2400].forEach((f, i) => tone(c, {type: 'sine', from: f, to: f, dur: 0.18, delay: i * 0.06, gain: 0.12}));
  },
  Ghost: c => tone(c, {type: 'triangle', from: 500, to: 120, dur: 0.8, gain: 0.3, vibrato: 6}),
  Dark: c => {
    tone(c, {type: 'sawtooth', from: 160, to: 60, dur: 0.4, gain: 0.2});
    noise(c, {dur: 0.3, filter: 'lowpass', from: 600, to: 100, gain: 0.3});
  },
  Dragon: c => {
    tone(c, {type: 'sawtooth', from: 220, to: 70, dur: 0.7, gain: 0.25, vibrato: 18});
    noise(c, {dur: 0.6, filter: 'lowpass', from: 1500, to: 200, gain: 0.3});
  },
  Poison: c => tone(c, {type: 'sawtooth', from: 200, to: 140, dur: 0.5, gain: 0.15, vibrato: 25}),
  Bug: c => tone(c, {type: 'sawtooth', from: 600, to: 500, dur: 0.45, gain: 0.1, vibrato: 40}),
  Steel: c => {
    [880, 1320, 2093].forEach(f => tone(c, {type: 'triangle', from: f, to: f * 0.98, dur: 0.5, gain: 0.12}));
  },
};

/** Som do golpe, conforme tipo e categoria. */
export function playMove(moveName: string): void {
  const c = audio();
  if (!c) return;
  const m = dex.moves.get(moveName);
  if (m.category === 'Status') {
    [600, 900, 1200].forEach((f, i) => tone(c, {type: 'sine', from: f, to: f * 1.5, dur: 0.15, delay: i * 0.07, gain: 0.12}));
    return;
  }
  (TYPE_SFX[m.type] ?? TYPE_SFX.Normal)(c);
}

export function playHit(effect: 'normal' | 'super' | 'resisted' | 'crit'): void {
  const c = audio();
  if (!c) return;
  if (effect === 'resisted') {
    noise(c, {dur: 0.12, filter: 'lowpass', from: 500, to: 200, gain: 0.25});
    return;
  }
  noise(c, {dur: 0.15, filter: 'lowpass', from: 2000, to: 200, gain: 0.5});
  tone(c, {type: 'square', from: 160, to: 60, dur: 0.12, gain: 0.25});
  if (effect === 'super') {
    noise(c, {dur: 0.2, filter: 'lowpass', from: 3000, to: 300, gain: 0.6, delay: 0.1});
    tone(c, {type: 'square', from: 200, to: 50, dur: 0.18, gain: 0.3, delay: 0.1});
  }
  if (effect === 'crit') tone(c, {type: 'triangle', from: 1600, to: 2200, dur: 0.2, gain: 0.2, delay: 0.05});
}

export function playBall(): void {
  const c = audio();
  if (!c) return;
  tone(c, {type: 'sine', from: 400, to: 900, dur: 0.25, gain: 0.25});
  tone(c, {type: 'square', from: 900, to: 300, dur: 0.1, gain: 0.1, delay: 0.3});
}

export function playJingle(kind: 'catch' | 'levelUp' | 'faint'): void {
  const c = audio();
  if (!c) return;
  const notes = kind === 'catch' ? [523, 659, 784, 1047] : kind === 'levelUp' ? [784, 988, 1175] : [392, 330, 262];
  notes.forEach((f, i) => tone(c, {type: 'square', from: f, to: f, dur: 0.16, delay: i * 0.12, gain: 0.12}));
}
