// Peças de cena compartilhadas: plateia feita com sprites de treinador, fala em linha de chat,
// arena das lendas e interior dos ginásios.
import {useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {TYPE_COLORS} from '../data/dex';
import {getBiome} from '../data/biomes';
import {GYM_BIOME} from '../data/gyms';
import type {Gym} from '../data/gyms';
import {CLASSES} from '../data/trainerSprites';
import type {Line} from '../game/legend';
import {avatarUrl} from '../game/trainers';
import {Sprite} from './components';
import {FX} from './fx';
import {fast} from './settings';
import {TrainerAvatar} from './screens/StartScreens';

/** Gerador simples com semente: a mesma cena sai sempre igual. */
export function seeded(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

/** Pessoas comuns para a plateia (classes de treinador no estilo atual). */
const PEOPLE = CLASSES.filter(n => !n.includes('-'));

/**
 * Plateia: fileiras de sprites de treinador pequenos, escurecidos para ficarem de fundo.
 * `silhouette` deixa todo mundo como sombra (estádios gigantes).
 */
export function CrowdLayer({rows, density, seed = 1, silhouette, top = 0, height = 45}: {
  rows: number;
  density: number;
  seed?: number;
  silhouette?: boolean;
  top?: number;
  height?: number;
}) {
  const people = useMemo(() => {
    const rand = seeded(seed * 97 + rows);
    const out: {x: number; row: number; name: string; flip: boolean; delay: number}[] = [];
    for (let row = 0; row < rows; row++) {
      for (let x = -2; x < 100; x += 5.2) {
        if (rand() > density) continue;
        out.push({x: x + (row % 2) * 2.6 + rand() * 1.5, row, name: PEOPLE[Math.floor(rand() * PEOPLE.length)], flip: rand() < 0.5, delay: rand()});
      }
    }
    return out;
  }, [rows, density, seed]);
  return (
    <div className={`crowd ${silhouette ? 'silhouette' : ''}`} style={{top: `${top}%`, height: `${height}%`}}>
      {people.map((p, i) => (
        <img
          key={i}
          src={avatarUrl(p.name)}
          alt=""
          className="crowd-person"
          loading="lazy"
          draggable={false}
          style={{
            left: `${p.x}%`,
            top: `${(p.row / Math.max(1, rows)) * 78}%`,
            zIndex: p.row,
            // Sempre silhueta (sem rosto nem cor): é plateia de fundo, não personagens.
            filter: silhouette ? 'brightness(0)' : `brightness(0) opacity(${0.5 + (p.row / Math.max(1, rows)) * 0.45})`,
            // Mais esguios que o sprite original.
            transform: `scaleX(${p.flip ? -0.88 : 0.88})`,
            animationDelay: `${p.delay}s`,
          }}
          onError={e => (e.currentTarget.style.display = 'none')}
        />
      ))}
    </div>
  );
}


/**
 * Multidão em pixel art: fileiras de cabeças e ombros (silhuetas), com gente de braço
 * levantado. Fileiras de trás menores e mais escuras. Usada quando a plateia é grande.
 */
export function CrowdMass({rows, seed = 1, top = 0, height = 45, tone = '#2a2540', arms = 0.15}: {
  rows: number;
  seed?: number;
  top?: number;
  height?: number;
  tone?: string;
  arms?: number;
}) {
  const W = 320;
  // Cada fileira tem ~11 unidades de altura; o SVG escala por igual (sem esticar as pessoas).
  const H = rows * 11 + 3;
  const shapes = useMemo(() => {
    const rand = seeded(seed * 131 + rows);
    const out: {row: number; y: number; gap: number; els: ReactNode[]}[] = [];
    const gap = 11;
    for (let r = 0; r < rows; r++) {
      const scale = 0.6 + (r / Math.max(1, rows - 1)) * 0.5; // de trás (pequeno) para a frente
      const y = r * gap + 3;
      const step = 8.5 * scale;
      const els: ReactNode[] = [];
      for (let x = -4 + (r % 2) * step * 0.5; x < W + 4; x += step * (0.85 + rand() * 0.35)) {
        const hx = x + rand() * 1.5;
        const hy = y + rand() * 1.5 * scale;
        const head = 3.6 * scale;
        const body = 6.2 * scale;
        // Cada pessoa com um tom um pouco diferente, para dar para separar uma da outra.
        const shade = 0.75 + rand() * 0.5;
        const key = `${r}-${Math.round(x * 10)}`;
        els.push(
          <g key={key} style={{opacity: shade > 1 ? 1 : shade}}>
            <rect x={hx - body / 2} y={hy + head + 0.3 * scale} width={body} height={gap + 2} rx={1.5 * scale} />
            <rect x={hx - 0.8 * scale} y={hy + head - 0.2} width={1.6 * scale} height={1} />
            <rect x={hx - head / 2} y={hy} width={head} height={head} rx={head * 0.45} />
            {rand() < arms && <rect x={hx + body / 2 - 1.3 * scale} y={hy - 2.8 * scale} width={1.3 * scale} height={5 * scale} rx={0.6} />}
            {rand() < arms * 0.6 && <rect x={hx - body / 2} y={hy - 2.8 * scale} width={1.3 * scale} height={5 * scale} rx={0.6} />}
            {rand() < 0.1 && <rect x={hx - head / 2 - 0.5} y={hy - 0.4} width={head + 1} height={1.1 * scale} />}
          </g>,
        );
      }
      out.push({row: r, y, gap, els});
    }
    return out;
  }, [rows, seed, arms]);
  return (
    <svg className="crowd-mass" style={{top: `${top}%`, height: `${height}%`}} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden>
      {shapes.map(({row, y, gap, els}) => (
        <g key={row}>
          {/* degrau da arquibancada atrás da fileira (mais claro), para as cabeças se destacarem */}
          <rect x="0" y={y - 1} width={W} height={gap + 1} fill="#ffffff" opacity={0.05 + row * 0.015} />
          <rect x="0" y={y + gap - 0.6} width={W} height="0.6" fill="#ffffff" opacity=".12" />
          <g className={`mass-row r${row % 3}`} fill={tone} style={{filter: `brightness(${0.7 + (row / Math.max(1, shapes.length - 1)) * 0.9})`}}>
            {els}
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Flashes de câmera piscando aqui e ali na plateia. */
export function Flashes({count, seed = 1, top = 0, height = 45}: {count: number; seed?: number; top?: number; height?: number}) {
  const pts = useMemo(() => {
    const r = seeded(seed * 17 + count);
    return Array.from({length: count}, () => ({x: r() * 98, y: top + r() * height * 0.85, d: r() * 4, s: 0.6 + r() * 0.8}));
  }, [count, seed, top, height]);
  return (
    <div className="flashes" aria-hidden>
      {pts.map((p, i) => (
        <i key={i} style={{left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}s`, transform: `scale(${p.s})`}} />
      ))}
    </div>
  );
}

/** Busto de quem fala (metade de cima do sprite). */
export function Bust({avatar, name}: {avatar: string; name: string}) {
  return (
    <span className="bust">
      <TrainerAvatar avatar={avatar} name={name} size={110} />
    </span>
  );
}

export interface Speaker {
  name: string;
  avatar: string;
}

/**
 * Linha de chat embaixo da cena: busto, nome e a fala aparecendo letra por letra.
 * Um toque completa a fala; outro passa para a próxima. No fim chama `onDone` (ou mostra `end`).
 */
export function DialogueBar({lines, other, me, onDone, end}: {
  lines: Line[];
  other: Speaker;
  me: Speaker;
  onDone?: () => void;
  end?: ReactNode;
}) {
  const [i, setI] = useState(0);
  const [chars, setChars] = useState(0);
  const line = lines[Math.min(i, lines.length - 1)];
  const done = i >= lines.length;
  const full = !line || chars >= line.text.length;
  useEffect(() => {
    if (done || full) return;
    const t = setTimeout(() => setChars(c => c + (fast() ? 99 : 2)), 22);
    return () => clearTimeout(t);
  }, [done, full, chars]);
  useEffect(() => {
    if (done) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  if (done) return end ? <div className="dialogue-end">{end}</div> : null;
  const next = () => {
    if (!full) return setChars(line.text.length);
    setI(n => n + 1);
    setChars(0);
  };
  const who = line.who === 'legend' ? other : line.who === 'me' ? me : null;
  return (
    <button className={`dialogue ${line.who}`} onClick={next}>
      {who ? <Bust avatar={who.avatar} name={who.name} /> : <span className="bust narrator-bust">{line.who === 'narrator' ? '🎙️' : '…'}</span>}
      <span className="dialogue-body">
        {who && <b>{who.name}</b>}
        {line.who === 'narrator' && <b>Narrador</b>}
        <span className="dialogue-text">{line.text.replace(/^🎙️ /, '').slice(0, chars)}</span>
      </span>
      <span className="dialogue-next">{full ? (i < lines.length - 1 ? '▶' : '✔') : ''}</span>
    </button>
  );
}

/**
 * Onde a luta acontece, conforme a importância. 0: no meio da rua (marcação de giz no asfalto,
 * meia dúzia de curiosos), 1: arena pequena (arquibancada de madeira), 2: estádio cheio
 * (multidão, faixas, flashes), 3: grande estádio (multidão gigante, telão, holofotes, confete).
 */
export function ArenaBackdrop({tier, color}: {tier: number; color: string}) {
  if (tier <= 0) {
    return (
      <div className="arena-bg venue-bg tier0" style={{backgroundImage: `url(${FX('bg/city.png')})`}}>
        <CrowdLayer rows={1} density={0.22} seed={3} top={22} height={22} />
        <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
          {/* calçada e meio-fio */}
          <rect x="0" y="40" width="160" height="5" fill="#b8b0a0" />
          <rect x="0" y="45" width="160" height="1.5" fill="#7a7468" />
          {/* asfalto */}
          <rect x="0" y="46.5" width="160" height="43.5" fill="#55565e" />
          {[...Array(40)].map((_, i) => (
            <rect key={i} x={(i * 37) % 158} y={48 + ((i * 23) % 40)} width="1" height="0.6" fill="#6a6b74" />
          ))}
          {/* faixa de pedestre ao fundo */}
          {[0, 1, 2, 3, 4].map(i => (
            <rect key={`z${i}`} x={132 + i * 5} y="47.5" width="3" height="5" fill="#d8d8d0" opacity=".8" />
          ))}
          {/* campo desenhado com giz */}
          <rect x="16" y="52" width="128" height="34" fill="none" stroke="#f4f4ec" strokeWidth="0.8" strokeDasharray="3 1" />
          <line x1="80" y1="52" x2="80" y2="86" stroke="#f4f4ec" strokeWidth="0.8" strokeDasharray="3 1" />
          <circle cx="80" cy="69" r="5" fill="none" stroke="#f4f4ec" strokeWidth="0.8" />
          {/* cones */}
          {[14, 142].map(x => (
            <g key={x}>
              <polygon points={`${x},50 ${x + 2},50 ${x + 3},55 ${x - 1},55`} fill="#f07020" />
              <rect x={x - 0.2} y="52" width="2.4" height="0.8" fill="#fff" />
            </g>
          ))}
          {/* banco de praça */}
          <rect x="6" y="38" width="14" height="1.5" fill="#8a5a2a" />
          <rect x="7" y="39.5" width="1" height="2" fill="#333" />
          <rect x="18" y="39.5" width="1" height="2" fill="#333" />
        </svg>
      </div>
    );
  }
  if (tier === 1) {
    return (
      <div className="arena-bg venue-bg tier1">
        <div className="stands" style={{background: 'linear-gradient(#9fc4e8, #cfe3f5 40%, #b98a52 41%, #a37440)'}} />
        <svg className="bleachers" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
          {[0, 1, 2, 3].map(i => (
            <g key={i}>
              <rect x="0" y={18 + i * 6} width="160" height="1.4" fill="#7a5228" />
              <rect x="0" y={19.4 + i * 6} width="160" height="4.6" fill={i % 2 ? '#c8955a' : '#b98448'} />
            </g>
          ))}
        </svg>
        <CrowdMass rows={3} seed={11} top={12} height={30} tone="#3a3048" arms={0.12} />
        <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
          {/* cerca */}
          <rect x="0" y="40" width="160" height="4" fill="#e8dcc0" />
          {[...Array(33)].map((_, i) => (
            <rect key={i} x={i * 5} y="40" width="0.8" height="4" fill="#a08860" />
          ))}
          <rect x="0" y="44" width="160" height="1" fill="#6a5030" />
          {/* chão de terra batida com marcação */}
          <rect x="0" y="45" width="160" height="45" fill="#c8a46a" />
          <rect x="0" y="45" width="160" height="45" fill={color} opacity=".18" />
          <rect x="12" y="50" width="136" height="36" fill="none" stroke="#fff" strokeWidth="1" opacity=".9" />
          <line x1="80" y1="50" x2="80" y2="86" stroke="#fff" strokeWidth="1" opacity=".9" />
          <circle cx="80" cy="68" r="6" fill="none" stroke="#fff" strokeWidth="1" opacity=".9" />
          {/* bandeirinhas */}
          {[...Array(16)].map((_, i) => (
            <polygon key={`b${i}`} points={`${i * 10 + 2},6 ${i * 10 + 8},6 ${i * 10 + 5},10`} fill={['#dc4646', '#f0d040', '#3c64c8', '#4cae5c'][i % 4]} />
          ))}
          <line x1="0" y1="6" x2="160" y2="6" stroke="#555" strokeWidth=".4" />
        </svg>
      </div>
    );
  }
  const big = tier >= 3;
  return (
    <div className={`arena-bg venue-bg tier${tier}`}>
      <div className="stands" style={{background: big ? 'linear-gradient(#05040c, #1c1636 60%, #2a2148)' : 'linear-gradient(#2c3a5c, #46507a 60%, #5a5f88)'}} />
      <CrowdMass rows={big ? 8 : 6} seed={tier * 7} top={big ? 10 : 12} height={big ? 36 : 32} tone={big ? '#141022' : '#262038'} arms={big ? 0.3 : 0.18} />
      <Flashes count={big ? 26 : 10} seed={tier} top={big ? 10 : 12} height={big ? 34 : 30} />
      <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* telão */}
        {big ? (
          <g>
            <rect x="62" y="1" width="36" height="11" fill="#111" />
            <rect x="63" y="2" width="34" height="9" fill="#1d3a8a" />
            <rect x="66" y="4.5" width="28" height="1.6" fill="#f0d040" />
            <rect x="70" y="7.2" width="20" height="1.2" fill="#fff" opacity=".8" />
          </g>
        ) : (
          <rect x="66" y="2" width="28" height="7" fill="#222" />
        )}
        {/* muretas com faixas de patrocínio */}
        <rect x="0" y="43" width="160" height="4.5" fill="#1a1a22" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <g key={i}>
            <rect x={i * 20 + 1} y="43.8" width="18" height="3" fill={['#dc4646', '#f0d040', '#3c64c8', '#4cae5c'][i % 4]} />
            <rect x={i * 20 + 4} y="44.9" width="12" height="0.8" fill="rgba(255,255,255,.85)" />
          </g>
        ))}
        {/* gramado listrado */}
        <rect x="0" y="47.5" width="160" height="42.5" fill={color} />
        {[...Array(8)].map((_, i) => (
          <rect key={`s${i}`} x={i * 20} y="47.5" width="10" height="42.5" fill="rgba(255,255,255,.07)" />
        ))}
        <rect x="0" y="47.5" width="160" height="42.5" fill="rgba(0,0,0,.1)" />
        <rect x="10" y="52" width="140" height="35" fill="none" stroke="#fff" strokeWidth="1" opacity=".9" />
        <line x1="80" y1="52" x2="80" y2="87" stroke="#fff" strokeWidth="1" opacity=".9" />
        <circle cx="80" cy="69.5" r="7" fill="none" stroke="#fff" strokeWidth="1" opacity=".9" />
        <rect x="76" y="66" width="8" height="7" fill="none" stroke="#fff" strokeWidth=".6" opacity=".6" />
        {big && (
          <>
            <polygon className="spot" points="10,0 18,0 70,90 30,90" fill="rgba(255,250,200,.14)" />
            <polygon className="spot s2" points="142,0 150,0 130,90 90,90" fill="rgba(255,250,200,.14)" />
          </>
        )}
      </svg>
      {big && <div className="confetti" />}
    </div>
  );
}

/** Como é o chão de cada tipo de ginásio (inspirado nos ginásios dos jogos). */
const GYM_FLOORS: Record<string, {floor: string; alt: string; kind: 'tiles' | 'planks' | 'pool' | 'grid' | 'grass' | 'stone' | 'ice' | 'sand'}> = {
  Rock: {floor: '#a08058', alt: '#8a6a44', kind: 'stone'},
  Water: {floor: '#4a90d8', alt: '#d8b880', kind: 'pool'},
  Electric: {floor: '#8c96a0', alt: '#f0d040', kind: 'grid'},
  Grass: {floor: '#6cc04a', alt: '#4c9a3a', kind: 'grass'},
  Fire: {floor: '#7a2a1a', alt: '#f07020', kind: 'stone'},
  Ice: {floor: '#c8ecff', alt: '#9ad4f4', kind: 'ice'},
  Ghost: {floor: '#3a2a50', alt: '#5a4478', kind: 'tiles'},
  Psychic: {floor: '#e070b0', alt: '#a050c0', kind: 'tiles'},
  Fighting: {floor: '#c89858', alt: '#a87838', kind: 'planks'},
  Steel: {floor: '#a8b0b8', alt: '#7c848c', kind: 'grid'},
  Dragon: {floor: '#3a3a5a', alt: '#5a5a8a', kind: 'stone'},
  Fairy: {floor: '#f8c8e0', alt: '#f0a0c8', kind: 'tiles'},
  Bug: {floor: '#7aa040', alt: '#5a7a2a', kind: 'grass'},
  Normal: {floor: '#d8b888', alt: '#c09868', kind: 'planks'},
  Ground: {floor: '#e0c888', alt: '#c8a868', kind: 'sand'},
  Flying: {floor: '#a8d8f8', alt: '#ffffff', kind: 'tiles'},
  Poison: {floor: '#7a4a98', alt: '#5a3478', kind: 'tiles'},
  Dark: {floor: '#2a2a32', alt: '#8a2a2a', kind: 'grid'},
};

function Floor({type}: {type: string}) {
  const f = GYM_FLOORS[type] ?? GYM_FLOORS.Normal;
  const y0 = 33;
  const els: ReactNode[] = [<rect key="bg" x="0" y={y0} width="160" height={90 - y0} fill={f.floor} />];
  const rand = seeded(type.length * 31);
  if (f.kind === 'tiles' || f.kind === 'ice')
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 16; c++)
        if ((r + c) % 2) els.push(<rect key={`t${r}-${c}`} x={c * 10} y={y0 + r * 7.2} width="10" height="7.2" fill={f.alt} opacity={f.kind === 'ice' ? 0.6 : 0.8} />);
  if (f.kind === 'ice') for (let k = 0; k < 10; k++) els.push(<rect key={`s${k}`} x={rand() * 150} y={y0 + rand() * 45} width="6" height="0.8" fill="#fff" opacity=".9" />);
  if (f.kind === 'planks') for (let r = 0; r < 10; r++) els.push(<rect key={`p${r}`} x="0" y={y0 + r * 5} width="160" height="0.7" fill={f.alt} />, <rect key={`q${r}`} x={(r * 37) % 150} y={y0 + r * 5} width="0.7" height="5" fill={f.alt} />);
  if (f.kind === 'grid') {
    for (let c = 0; c <= 16; c++) els.push(<rect key={`g${c}`} x={c * 10} y={y0} width="0.6" height={90 - y0} fill="rgba(0,0,0,.25)" />);
    for (let r = 0; r <= 7; r++) els.push(<rect key={`h${r}`} x="0" y={y0 + r * 7} width="160" height="0.6" fill="rgba(0,0,0,.25)" />);
    for (let c = 0; c < 20; c++) els.push(<rect key={`z${c}`} x={c * 8} y={y0} width="4" height="2" fill={f.alt} />);
  }
  if (f.kind === 'stone')
    for (let k = 0; k < 26; k++) els.push(<rect key={`st${k}`} x={rand() * 155} y={y0 + 2 + rand() * 45} width={3 + rand() * 6} height={2 + rand() * 3} fill={f.alt} opacity=".8" />);
  if (f.kind === 'grass' || f.kind === 'sand')
    for (let k = 0; k < 60; k++) els.push(<rect key={`gr${k}`} x={rand() * 158} y={y0 + rand() * 48} width="1.4" height={f.kind === 'grass' ? 2.2 : 0.8} fill={f.alt} />);
  if (f.kind === 'pool') {
    els.push(<rect key="pool" x="0" y={y0} width="160" height={90 - y0} fill={f.floor} />);
    for (let k = 0; k < 18; k++) els.push(<rect key={`w${k}`} x={rand() * 150} y={y0 + rand() * 46} width="7" height="0.7" fill="#fff" opacity=".5" />);
    els.push(<rect key="walk" x="0" y={y0 + 21} width="160" height="8" fill={f.alt} />, <rect key="walk2" x="70" y={y0} width="20" height={50} fill={f.alt} />);
  }
  return <>{els}</>;
}

/**
 * Interior do ginásio: parede com faixas do tipo, chão temático, o tablado do líder
 * no fundo e as duas estátuas da entrada (como nos jogos).
 */
/** Regiões onde, nos jogos, as estátuas da entrada do ginásio são de Rhydon. */
const RHYDON_STATUES = new Set(['kanto', 'johto', 'hoenn', 'sinnoh']);

export function GymBackdrop({gym, crowd}: {gym: Gym; crowd?: boolean}) {
  const color = TYPE_COLORS[gym.type] ?? '#888';
  const biome = getBiome(GYM_BIOME[gym.type] ?? 'city');
  const ace = gym.team[gym.team.length - 1];
  // Como nos jogos: Rhydon na entrada até Sinnoh; depois, o Pokémon que representa o ginásio.
  const statue = RHYDON_STATUES.has(gym.region) ? 'Rhydon' : ace;
  return (
    <div className="arena-bg gym-bg">
      {crowd && <CrowdMass rows={3} seed={gym.id.length} top={2} height={24} tone="#2a2540" arms={0.2} />}
      <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* Parede do fundo: painéis, pilares e janelas com a paisagem do tipo */}
        <rect x="0" y="0" width="160" height="31" fill="#4a4658" />
        <rect x="0" y="0" width="160" height="31" fill={color} opacity=".35" />
        {[18, 40, 104, 126].map(x => (
          <g key={x}>
            <rect x={x} y="6" width="16" height="14" fill="#222" />
            <image href={FX(`bg/${biome.bg}.png`)} x={x + 1} y="7" width="14" height="12" preserveAspectRatio="xMidYMid slice" style={{filter: biome.filter}} />
            <rect x={x + 7.5} y="7" width="1" height="12" fill="#222" />
          </g>
        ))}
        {[0, 37, 59, 99, 121, 156].map(x => (
          <rect key={x} x={x} y="0" width="4" height="31" fill="rgba(0,0,0,.25)" />
        ))}
        <rect x="0" y="24" width="160" height="1.5" fill="rgba(255,255,255,.25)" />
        {crowd && <rect x="0" y="0" width="160" height="31" fill="rgba(20,16,30,.45)" />}
        <rect x="0" y="31" width="160" height="2" fill="#222" />
        <Floor type={gym.type} />
        {/* Marcação do campo de batalha */}
        <rect x="22" y="44" width="116" height="40" fill="none" stroke="#fff" strokeWidth="0.8" opacity=".75" />
        <line x1="22" y1="64" x2="138" y2="64" stroke="#fff" strokeWidth="0.8" opacity=".75" />
        <circle cx="80" cy="64" r="5" fill="none" stroke="#fff" strokeWidth="0.8" opacity=".75" />
        {/* Tablado do líder, com degraus, no fundo do ginásio */}
        <rect x="62" y="31" width="36" height="10" fill="rgba(0,0,0,.3)" />
        <rect x="63" y="31" width="34" height="8" fill={color} />
        <rect x="63" y="31" width="34" height="1.2" fill="rgba(255,255,255,.35)" />
        <rect x="70" y="39" width="20" height="2" fill="#6a6a72" />
        <rect x="72" y="41" width="16" height="1.6" fill="#8a8a92" />
        {/* Cadeira do líder */}
        <g>
          <rect x="74" y="12" width="12" height="20" fill="#3a2a18" />
          <rect x="75" y="13" width="10" height="17" fill={color} />
          <rect x="75" y="13" width="10" height="2" fill="#f0d040" />
          <rect x="79" y="16" width="2" height="2" fill="#f0d040" />
          <rect x="72" y="25" width="16" height="4" fill="#3a2a18" />
          <rect x="73" y="25.5" width="14" height="2.5" fill={color} opacity=".85" />
          <rect x="71" y="22" width="3" height="8" fill="#3a2a18" />
          <rect x="86" y="22" width="3" height="8" fill="#3a2a18" />
          <rect x="71" y="22" width="3" height="1" fill="#f0d040" />
          <rect x="86" y="22" width="3" height="1" fill="#f0d040" />
          <rect x="73" y="29" width="1.5" height="3" fill="#3a2a18" />
          <rect x="85.5" y="29" width="1.5" height="3" fill="#3a2a18" />
        </g>
        {/* Faixas com o tipo */}
        {[4, 144].map(x => (
          <g key={x}>
            <rect x={x} y="2" width="12" height="23" fill={color} />
            <rect x={x + 2} y="5" width="8" height="1.5" fill="#fff" opacity=".7" />
            <polygon points={`${x},25 ${x + 6},29 ${x + 12},25`} fill={color} />
          </g>
        ))}
        {/* Pedestais das estátuas da entrada (perto de quem chega) */}
        {[6, 140].map(x => (
          <g key={x}>
            <rect x={x} y="78" width="14" height="11" fill="#8a8a92" />
            <rect x={x} y="78" width="14" height="2" fill="#c8c8d0" />
            <rect x={x + 3} y="83" width="8" height="3" fill="#5a5a62" />
            <rect x={x + 4} y="84" width="6" height="1" fill="#d8c060" />
          </g>
        ))}
      </svg>
      {[0, 1].map(i => (
        <span key={i} className={`gym-statue s${i}`}>
          <Sprite name={statue} size={104} still />
        </span>
      ))}
    </div>
  );
}
