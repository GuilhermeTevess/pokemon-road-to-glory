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
            filter: silhouette ? 'brightness(0)' : `brightness(${0.45 + p.row * 0.12}) saturate(.7)`,
            transform: p.flip ? 'scaleX(-1)' : undefined,
            animationDelay: `${p.delay}s`,
          }}
          onError={e => (e.currentTarget.style.display = 'none')}
        />
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
 * Arena da lenda conforme a fama. 0: quadra na cidade, 1: arena com pouca gente,
 * 2: estádio cheio, 3: grande estádio (plateia em silhueta, holofotes e confete).
 */
export function ArenaBackdrop({tier, color}: {tier: number; color: string}) {
  if (tier === 0) {
    return (
      <div className="arena-bg venue-bg" style={{backgroundImage: `url(${FX('bg/city.png')})`}}>
        <CrowdLayer rows={1} density={0.18} seed={3} top={38} height={18} />
        <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
          <rect x="6" y="56" width="148" height="34" fill="#b9a27a" />
          <rect x="12" y="60" width="136" height="28" fill="none" stroke="#fff" strokeWidth="1" />
          <line x1="80" y1="60" x2="80" y2="88" stroke="#fff" strokeWidth="1" />
          <circle cx="80" cy="74" r="5" fill="none" stroke="#fff" strokeWidth="1" />
        </svg>
      </div>
    );
  }
  const rows = [0, 2, 3, 4][tier];
  return (
    <div className={`arena-bg venue-bg tier${tier}`}>
      <div className="stands" style={{background: tier >= 3 ? 'linear-gradient(#0c0818, #2a1f48)' : tier === 2 ? 'linear-gradient(#3a3458, #5a5078)' : 'linear-gradient(#8a96b0, #a8b2c8)'}} />
      <CrowdLayer rows={rows} density={[0, 0.35, 0.85, 1][tier]} seed={tier} silhouette={tier >= 3} top={6} height={44} />
      <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        <rect x="0" y="50" width="160" height="2.5" fill="#222" />
        {tier >= 2 &&
          [18, 68, 118].map((x, i) => (
            <g key={x}>
              <rect x={x} y="45" width="24" height="5" fill={['#dc4646', '#f0d040', '#3c64c8'][i]} />
              <rect x={x + 3} y="46.8" width="18" height="1.4" fill="rgba(255,255,255,.8)" />
            </g>
          ))}
        <rect x="0" y="52.5" width="160" height="37.5" fill={color} />
        <rect x="0" y="52.5" width="160" height="37.5" fill="rgba(0,0,0,.12)" />
        <rect x="12" y="57" width="136" height="29" fill="none" stroke="#fff" strokeWidth="1" opacity=".85" />
        <line x1="80" y1="57" x2="80" y2="86" stroke="#fff" strokeWidth="1" opacity=".85" />
        <circle cx="80" cy="71.5" r="7" fill="none" stroke="#fff" strokeWidth="1" opacity=".85" />
        {tier >= 3 && (
          <>
            <polygon className="spot" points="10,0 18,0 70,90 30,90" fill="rgba(255,250,200,.16)" />
            <polygon className="spot s2" points="142,0 150,0 130,90 90,90" fill="rgba(255,250,200,.16)" />
            <rect x="64" y="1" width="32" height="10" fill="#111" />
            <rect x="65" y="2" width="30" height="8" fill="#3c64c8" />
            <rect x="68" y="4.5" width="24" height="3" fill="#f0d040" />
          </>
        )}
      </svg>
      {tier >= 3 && <div className="confetti" />}
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
  const y0 = 40;
  const els: ReactNode[] = [<rect key="bg" x="0" y={y0} width="160" height={90 - y0} fill={f.floor} />];
  const rand = seeded(type.length * 31);
  if (f.kind === 'tiles' || f.kind === 'ice')
    for (let r = 0; r < 7; r++)
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
export function GymBackdrop({gym, crowd}: {gym: Gym; crowd?: boolean}) {
  const color = TYPE_COLORS[gym.type] ?? '#888';
  const biome = getBiome(GYM_BIOME[gym.type] ?? 'city');
  const ace = gym.team[gym.team.length - 1];
  return (
    <div className="arena-bg gym-bg">
      {crowd && <CrowdLayer rows={2} density={0.6} seed={gym.id.length} top={4} height={34} />}
      <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* Parede interna: painéis, pilares, janelas com a paisagem do tipo e o emblema da Liga */}
        <rect x="0" y="0" width="160" height="37" fill="#4a4658" />
        <rect x="0" y="0" width="160" height="37" fill={color} opacity=".35" />
        {[20, 46, 72, 98, 124].map(x => (
          <g key={x}>
            <rect x={x} y="8" width="16" height="16" fill="#222" />
            <image href={FX(`bg/${biome.bg}.png`)} x={x + 1} y="9" width="14" height="14" preserveAspectRatio="xMidYMid slice" style={{filter: biome.filter}} />
            <rect x={x + 7.5} y="9" width="1" height="14" fill="#222" />
          </g>
        ))}
        {[0, 39, 65, 91, 117, 156].map(x => (
          <rect key={x} x={x} y="0" width="4" height="37" fill="rgba(0,0,0,.25)" />
        ))}
        <rect x="0" y="28" width="160" height="2" fill="rgba(255,255,255,.25)" />
        {crowd && <rect x="0" y="0" width="160" height="37" fill="rgba(20,16,30,.55)" />}
        <rect x="0" y="37" width="160" height="3" fill="#222" />
        <Floor type={gym.type} />
        {/* Tablado do líder */}
        <rect x="56" y="40" width="48" height="9" fill="rgba(0,0,0,.25)" />
        <rect x="58" y="40" width="44" height="7" fill={color} opacity=".85" />
        {/* Faixas */}
        {[4, 144].map(x => (
          <g key={x}>
            <rect x={x} y="3" width="12" height="28" fill={color} />
            <rect x={x + 2} y="6" width="8" height="1.5" fill="#fff" opacity=".7" />
            <polygon points={`${x},31 ${x + 6},35 ${x + 12},31`} fill={color} />
          </g>
        ))}
        {/* Pedestais das estátuas */}
        {[10, 138].map(x => (
          <g key={x}>
            <rect x={x} y="80" width="12" height="9" fill="#8a8a92" />
            <rect x={x} y="80" width="12" height="2" fill="#b8b8c0" />
            <rect x={x + 3} y="84" width="6" height="2" fill="#5a5a62" />
          </g>
        ))}
      </svg>
      {[0, 1].map(i => (
        <span key={i} className={`gym-statue s${i}`}>
          <Sprite name={ace} size={56} still />
        </span>
      ))}
    </div>
  );
}
