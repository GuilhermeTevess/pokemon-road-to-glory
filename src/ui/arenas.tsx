// Cenários das arenas com plateia dos modos rápidos. Cada um tem três camadas:
// fundo (céu e arquibancada), a multidão no meio e a frente (mureta e campo).
import {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {ARENAS} from '../game/arenas';
import {ArenaBackdrop, CrowdMass, Flashes, seeded} from './scene';

const LINE = {fill: 'none', strokeWidth: 1, opacity: 0.9} as const;

/** Marcação do campo de batalha (retângulo, meio e círculo central). */
function Court({x = 12, y = 51, w = 136, h = 35, color = '#fff'}: {x?: number; y?: number; w?: number; h?: number; color?: string}) {
  const cy = y + h / 2;
  return (
    <g stroke={color} {...LINE}>
      <rect x={x} y={y} width={w} height={h} />
      <line x1="80" y1={y} x2="80" y2={y + h} />
      <ellipse cx="80" cy={cy} rx="7" ry="5.5" />
    </g>
  );
}

/** Degraus da arquibancada atrás da multidão. */
function Steps({from, to, base, line, step = 5.5}: {from: number; to: number; base: string; line: string; step?: number}) {
  const out: ReactNode[] = [<rect key="b" x="0" y={from} width="160" height={to - from} fill={base} />];
  for (let y = from + step; y < to; y += step) out.push(<rect key={y} x="0" y={y} width="160" height="0.8" fill={line} />);
  return <>{out}</>;
}

/** Pontinhos no chão (areia, terra) para não ficar liso. */
function Specks({seed, color, y0 = 47, n = 50, w = 1.2, h = 0.7}: {seed: number; color: string; y0?: number; n?: number; w?: number; h?: number}) {
  const r = seeded(seed);
  return (
    <>
      {Array.from({length: n}, (_, i) => (
        <rect key={i} x={r() * 158} y={y0 + r() * (89 - y0)} width={w} height={h} fill={color} />
      ))}
    </>
  );
}

function Coliseu() {
  return (
    <>
      <svg className="stage-back" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* céu do fim de tarde em faixas, com o sol se pondo */}
        <rect x="0" y="0" width="160" height="3" fill="#3a2a5a" />
        <rect x="0" y="3" width="160" height="3" fill="#7a3a6a" />
        <rect x="0" y="6" width="160" height="3" fill="#d0604a" />
        <rect x="0" y="9" width="160" height="4" fill="#f0a050" />
        <ellipse cx="122" cy="12" rx="7" ry="5" fill="#ffd870" />
        <Steps from={11} to={42} base="#b89c78" line="#8a7458" />
        {/* colunas no alto */}
        {[...Array(17)].map((_, i) => (
          <rect key={i} x={i * 10 + 2} y="8" width="3" height="5" fill="#cbb08a" />
        ))}
        <rect x="0" y="7" width="160" height="1.5" fill="#cbb08a" />
      </svg>
      <CrowdMass rows={5} seed={21} top={14} height={31} tone="#4a3024" arms={0.2} density={0.9} />
      <svg className="stage-front" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* muro de pedra com arcos */}
        <rect x="0" y="40" width="160" height="7" fill="#a08a68" />
        <rect x="0" y="40" width="160" height="1" fill="#cbb08a" />
        {[...Array(12)].map((_, i) => (
          <g key={i} fill="#3a2a1a">
            <rect x={i * 14 + 4} y="43" width="6" height="4" />
            <ellipse cx={i * 14 + 7} cy="43" rx="3" ry="1.6" />
          </g>
        ))}
        {/* estandartes */}
        {[46, 108].map(x => (
          <g key={x}>
            <rect x={x} y="38" width="6" height="9" fill="#b82a2a" />
            <rect x={x} y="38" width="6" height="1" fill="#f0c040" />
            <polygon points={`${x},47 ${x + 3},49 ${x + 6},47`} fill="#b82a2a" />
          </g>
        ))}
        {/* tochas */}
        {[18, 140].map(x => (
          <g key={x}>
            <rect x={x} y="34" width="1.6" height="7" fill="#5a3a20" />
            <rect className="flame" x={x - 0.8} y="31" width="3.2" height="3.4" fill="#f07020" />
            <rect className="flame f2" x={x} y="31.6" width="1.6" height="2" fill="#ffe060" />
          </g>
        ))}
        {/* areia */}
        <rect x="0" y="47" width="160" height="43" fill="#e2c48a" />
        <Specks seed={5} color="#c8a870" />
        <rect x="0" y="47" width="160" height="1.2" fill="rgba(0,0,0,.18)" />
        <Court color="#8a6a40" />
        <ellipse cx="80" cy="68.5" rx="22" ry="14" fill="none" stroke="#8a6a40" strokeWidth=".6" strokeDasharray="2 1.5" opacity=".7" />
      </svg>
    </>
  );
}

function Noturno() {
  const r = seeded(9);
  return (
    <>
      <svg className="stage-back" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        <rect x="0" y="0" width="160" height="12" fill="#0a0c20" />
        {Array.from({length: 22}, (_, i) => (
          <rect key={i} className={i % 3 ? undefined : 'twinkle'} x={r() * 158} y={r() * 9} width=".8" height=".8" fill="#fff" opacity={0.5 + r() * 0.5} />
        ))}
        <Steps from={10} to={42} base="#1a2038" line="#2a3252" />
      </svg>
      <CrowdMass rows={6} seed={33} top={11} height={33} tone="#1c2240" arms={0.28} />
      <Flashes count={14} seed={4} top={12} height={30} />
      <svg className="stage-front" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* torres de refletor */}
        {[3, 147].map(x => (
          <g key={x}>
            <rect x={x + 4.5} y="8" width="1.4" height="34" fill="#3a4058" />
            <rect x={x} y="2" width="10" height="6" fill="#3a4058" />
            {[0, 1, 2].map(k => (
              <rect key={k} x={x + 1 + k * 3} y="3" width="2.2" height="4" fill="#fffbe0" />
            ))}
          </g>
        ))}
        {/* placa de LED */}
        <rect x="0" y="41" width="160" height="5.5" fill="#0a0a14" />
        <g className="led">
          {[...Array(16)].map((_, i) => (
            <rect key={i} x={i * 20 + 2} y="42.5" width="14" height="2.4" fill={['#40e0f0', '#f040b0', '#f0e040', '#60f080'][i % 4]} opacity=".9" />
          ))}
        </g>
        {/* quadra azul com borda */}
        <rect x="0" y="46.5" width="160" height="43.5" fill="#2a4a7a" />
        <rect x="10" y="50" width="140" height="37" fill="#2f68b8" />
        <Court x={12} y={51.5} w={136} h={34} />
        {/* fachos de luz */}
        <polygon className="spot" points="5,4 12,4 70,90 30,90" fill="rgba(255,250,200,.07)" />
        <polygon className="spot s2" points="148,4 155,4 130,90 90,90" fill="rgba(255,250,200,.07)" />
      </svg>
    </>
  );
}

function Praia() {
  return (
    <>
      <svg className="stage-back" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        <rect x="0" y="0" width="160" height="10" fill="#8fd0f8" />
        <rect x="20" y="3" width="12" height="2" fill="#fff" />
        <rect x="23" y="2" width="6" height="1" fill="#fff" />
        <rect x="104" y="4" width="16" height="2" fill="#fff" />
        <rect x="108" y="3" width="7" height="1" fill="#fff" />
        {/* mar no horizonte */}
        <rect x="0" y="9" width="160" height="5" fill="#3a90d0" />
        {[...Array(10)].map((_, i) => (
          <rect key={i} className="wave" x={i * 17 + 3} y={10.5 + (i % 2)} width="5" height=".6" fill="#e8f6ff" />
        ))}
        {/* arquibancada de andaime, listrada */}
        <Steps from={13} to={42} base="#e8e0d0" line="#9aa8c0" step={5.8} />
        {[...Array(9)].map((_, i) => (
          <rect key={i} x={i * 20} y="13" width="1" height="29" fill="#9aa8c0" />
        ))}
      </svg>
      <CrowdMass rows={5} seed={47} top={15} height={30} tone="#7a4a34" arms={0.3} density={0.85} />
      <svg className="stage-front" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* cerca de corda com boias */}
        <rect x="0" y="43" width="160" height="0.8" fill="#c8a060" />
        {[...Array(11)].map((_, i) => (
          <g key={i}>
            <rect x={i * 16} y="40" width="1.4" height="6" fill="#8a5a2a" />
            <rect x={i * 16 + 6} y="42.2" width="3" height="2.2" fill={i % 2 ? '#f05a3a' : '#fff'} />
          </g>
        ))}
        {/* areia */}
        <rect x="0" y="46" width="160" height="44" fill="#f0dca0" />
        <Specks seed={13} color="#d8bc78" y0={46} n={60} />
        <Court color="#3a7ac8" />
        {/* coqueiros nos cantos */}
        {[{x: 6, f: 1}, {x: 152, f: -1}].map(({x, f}) => (
          <g key={x}>
            {[0, 1, 2, 3, 4, 5].map(k => (
              <rect key={k} x={x + k * 0.5 * f - 1} y={44 - k * 5} width="2.6" height="5" fill={k % 2 ? '#8a5a2a' : '#a06a34'} />
            ))}
            <g className="palm">
              <polygon points={`${x + 2 * f},14 ${x + 12 * f},12 ${x + 14 * f},17`} fill="#3a9a3a" />
              <polygon points={`${x + 2 * f},14 ${x - 8 * f},12 ${x - 9 * f},17`} fill="#2e8a32" />
              <polygon points={`${x + 2 * f},14 ${x + 7 * f},8 ${x + 11 * f},10`} fill="#4cae4c" />
              <polygon points={`${x + 2 * f},14 ${x + 4 * f},21 ${x + 9 * f},20`} fill="#2e8a32" />
              <rect x={x + 0.5 * f} y="14" width="2" height="2" fill="#6a4020" />
            </g>
          </g>
        ))}
      </svg>
    </>
  );
}

function Gelo() {
  return (
    <>
      <svg className="stage-back" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        <rect x="0" y="0" width="160" height="14" fill="#b8d8f0" />
        {/* montanhas nevadas */}
        <polygon points="0,14 18,3 34,14" fill="#8ab0d0" />
        <polygon points="12,8 18,3 24,8" fill="#fff" />
        <polygon points="40,14 64,1 90,14" fill="#9cbcd8" />
        <polygon points="56,6 64,1 72,6" fill="#fff" />
        <polygon points="96,14 120,4 146,14" fill="#8ab0d0" />
        <polygon points="113,8 120,4 127,8" fill="#fff" />
        <polygon points="138,14 152,6 168,14" fill="#9cbcd8" />
        <Steps from={12} to={42} base="#7a98b8" line="#5a7898" />
      </svg>
      <CrowdMass rows={5} seed={58} top={14} height={30} tone="#24304a" arms={0.18} density={0.8} />
      <svg className="stage-front" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* mureta de gelo com pingentes */}
        <rect x="0" y="40.5" width="160" height="6" fill="#d8f0ff" />
        <rect x="0" y="40.5" width="160" height="1" fill="#fff" />
        <rect x="0" y="45.5" width="160" height="1" fill="#6aa0d0" />
        {[...Array(20)].map((_, i) => (
          <polygon key={i} points={`${i * 8 + 2},46.5 ${i * 8 + 4},46.5 ${i * 8 + 3},${48.5 + (i % 3)}`} fill="#bfe4fa" />
        ))}
        {/* chão de gelo com brilhos */}
        <rect x="0" y="46.5" width="160" height="43.5" fill="#cfeefc" />
        {[...Array(9)].map((_, i) => (
          <rect key={i} x={(i * 41) % 150} y={50 + ((i * 13) % 36)} width="8" height=".7" fill="#fff" opacity=".9" />
        ))}
        <polyline points="20,80 26,76 25,72 31,70" fill="none" stroke="#9ccae8" strokeWidth=".5" />
        <polyline points="128,58 133,61 132,65 138,67" fill="none" stroke="#9ccae8" strokeWidth=".5" />
        <Court color="#4a8ac8" />
      </svg>
      <div className="snowfall" />
    </>
  );
}

function Coberto() {
  return (
    <>
      <svg className="stage-back" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* teto com treliça e luminárias */}
        <rect x="0" y="0" width="160" height="10" fill="#2a2a34" />
        {[...Array(10)].map((_, i) => (
          <g key={i}>
            <line x1={i * 16} y1="1" x2={i * 16 + 8} y2="7" stroke="#4a4a58" strokeWidth=".6" />
            <line x1={i * 16 + 16} y1="1" x2={i * 16 + 8} y2="7" stroke="#4a4a58" strokeWidth=".6" />
          </g>
        ))}
        <rect x="0" y="1" width="160" height=".8" fill="#4a4a58" />
        <rect x="0" y="7" width="160" height=".8" fill="#4a4a58" />
        <Steps from={9} to={42} base="#8a2a34" line="#5a1a24" />
      </svg>
      <CrowdMass rows={6} seed={64} top={10} height={34} tone="#2a1a24" arms={0.22} />
      <Flashes count={8} seed={6} top={11} height={30} />
      <svg className="stage-front" viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {[24, 64, 96, 136].map(x => (
          <g key={x}>
            <rect x={x - 0.3} y="0" width=".6" height="4" fill="#4a4a58" />
            <rect x={x - 3} y="4" width="6" height="1.6" fill="#fff4c0" />
          </g>
        ))}
        {/* placas de propaganda */}
        <rect x="0" y="41" width="160" height="5.5" fill="#1a1a22" />
        {[...Array(8)].map((_, i) => (
          <g key={i}>
            <rect x={i * 20 + 1} y="41.8" width="18" height="3.8" fill={['#3c64c8', '#f0d040', '#dc4646', '#4cae5c'][i % 4]} />
            <rect x={i * 20 + 4} y="43.2" width="12" height=".9" fill="rgba(255,255,255,.85)" />
          </g>
        ))}
        {/* piso de madeira */}
        <rect x="0" y="46.5" width="160" height="43.5" fill="#d89a58" />
        {[...Array(9)].map((_, k) => (
          <g key={k}>
            <rect x="0" y={48 + k * 5} width="160" height=".5" fill="#c08448" />
            <rect x={(k * 37) % 150} y={48 + k * 5} width=".5" height="5" fill="#c08448" />
            <rect x={(k * 37 + 70) % 150} y={48 + k * 5} width=".5" height="5" fill="#c08448" />
          </g>
        ))}
        {/* áreas pintadas nos fundos e a pokébola no meio */}
        <rect x="12" y="58" width="16" height="21" fill="#c0603a" opacity=".55" />
        <rect x="132" y="58" width="16" height="21" fill="#c0603a" opacity=".55" />
        <Court />
        <path d="M73,68.5 a7,5.5 0 0 1 14,0 Z" fill="#dc4646" opacity=".8" />
        <ellipse cx="80" cy="68.5" rx="1.8" ry="1.4" fill="#fff" stroke="#2a2a34" strokeWidth=".5" />
      </svg>
    </>
  );
}

const STAGES: Record<string, () => ReactNode> = {coliseu: Coliseu, noturno: Noturno, praia: Praia, gelo: Gelo, coberto: Coberto};

/**
 * Arena com plateia dos modos rápidos. Mostra o nome dela por alguns segundos
 * no começo da luta, sem atrapalhar.
 */
export function ArenaStage({arena}: {arena: number}) {
  const info = ARENAS[((arena % ARENAS.length) + ARENAS.length) % ARENAS.length];
  const [tag, setTag] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTag(false), 3500);
    return () => clearTimeout(t);
  }, []);
  const Stage = STAGES[info.id];
  return (
    <>
      {Stage ? (
        <div className={`arena-bg venue-bg arena-stage ${info.id}`}>
          <Stage />
        </div>
      ) : (
        <ArenaBackdrop tier={1} color="#7aa860" />
      )}
      {tag && <div className="arena-name">{info.name}</div>}
    </>
  );
}
