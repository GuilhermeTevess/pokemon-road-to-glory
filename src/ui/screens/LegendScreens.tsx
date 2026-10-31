// Encontro com a lenda (ela te acha ou você a acha), a arena da luta e a conversa do fim.
import {useMemo, useState} from 'react';
import {getBiome} from '../../data/biomes';
import {getLegend} from '../../data/legends';
import {getRegion} from '../../data/regions';
import {VENUES, approachLines, challengeLines, foundLines, outroLines, venueName, venueTier} from '../../game/legend';
import type {Fame, Line} from '../../game/legend';
import {careerOf} from '../../game/meta';
import {useGame} from '../../game/store';
import {playJingle} from '../audio';
import {FX} from '../fx';
import {Modal} from '../components';
import {TrainerAvatar} from './StartScreens';

/** Gerador simples com semente: a plateia fica igual a cada render. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

const CROWD = ['#dc4646', '#3c64c8', '#f0d040', '#4cae5c', '#f08cb4', '#f4f4f4', '#8c54c8', '#f08c2c'];
const SKIN = ['#ffe0c4', '#f4c8a0', '#d9a074', '#a86c44', '#6e4428'];

/**
 * Fundo da arena da lenda em pixel art. Nível 0: quadra na cidade, quase vazia.
 * 1: arena com um pouco de gente. 2: estádio cheio com faixas. 3: grande estádio com holofotes e confete.
 */
export function ArenaBackdrop({tier, color}: {tier: number; color: string}) {
  const crowd = useMemo(() => {
    const rand = seeded(7 + tier);
    const density = [0, 0.3, 0.8, 1][tier];
    const out: {x: number; y: number; c: string; k: string; row: number}[] = [];
    for (let row = 0; row < 5; row++) {
      for (let x = 2; x < 158; x += 4) {
        if (rand() > density) continue;
        out.push({x: x + (row % 2) * 2, y: 12 + row * 7, c: CROWD[Math.floor(rand() * CROWD.length)], k: SKIN[Math.floor(rand() * SKIN.length)], row});
      }
    }
    return out;
  }, [tier]);
  if (tier === 0) {
    return (
      <div className="arena-bg venue-bg" style={{backgroundImage: `url(${FX('bg/city.png')})`}}>
        <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
          <rect x="10" y="58" width="140" height="32" fill="#c8b48c" />
          <rect x="14" y="61" width="132" height="26" fill="none" stroke="#fff" strokeWidth="1" />
          <line x1="80" y1="61" x2="80" y2="87" stroke="#fff" strokeWidth="1" />
          <circle cx="80" cy="74" r="5" fill="none" stroke="#fff" strokeWidth="1" />
          {[18, 140].map(x => (
            <g key={x} className="crowd-row r0">
              <rect x={x} y="50" width="3" height="3" fill="#f4c8a0" />
              <rect x={x - 1} y="53" width="5" height="5" fill={x < 50 ? '#3c64c8' : '#dc4646'} />
            </g>
          ))}
        </svg>
      </div>
    );
  }
  return (
    <div className={`arena-bg venue-bg tier${tier}`} style={{background: tier >= 3 ? '#1c1430' : tier === 2 ? '#2a2440' : '#5a6a8a'}}>
      <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {/* Arquibancada */}
        <rect x="0" y="8" width="160" height="40" fill={tier >= 2 ? '#3c3458' : '#7a86a0'} />
        {[0, 1, 2, 3, 4].map(r => (
          <rect key={r} x="0" y={17 + r * 7} width="160" height="1" fill="rgba(0,0,0,.25)" />
        ))}
        {[0, 1, 2, 3, 4].map(r => (
          <g key={r} className={`crowd-row r${r % 2}`}>
            {crowd
              .filter(p => p.row === r)
              .map((p, i) => (
                <g key={i}>
                  <rect x={p.x} y={p.y} width="2" height="2" fill={p.k} />
                  <rect x={p.x - 0.5} y={p.y + 2} width="3" height="3" fill={p.c} />
                </g>
              ))}
          </g>
        ))}
        {/* Faixas */}
        {tier >= 2 &&
          [20, 70, 120].map((x, i) => (
            <g key={x}>
              <rect x={x} y="44" width="22" height="6" fill={CROWD[i * 2]} />
              <rect x={x + 2} y="46" width="18" height="2" fill="rgba(255,255,255,.7)" />
            </g>
          ))}
        <rect x="0" y="48" width="160" height="3" fill="#222" />
        {/* Campo */}
        <rect x="0" y="51" width="160" height="39" fill={color} />
        <rect x="0" y="51" width="160" height="39" fill="rgba(0,0,0,.12)" />
        <rect x="12" y="56" width="136" height="30" fill="none" stroke="#fff" strokeWidth="1" opacity=".8" />
        <line x1="80" y1="56" x2="80" y2="86" stroke="#fff" strokeWidth="1" opacity=".8" />
        <circle cx="80" cy="71" r="7" fill="none" stroke="#fff" strokeWidth="1" opacity=".8" />
        {/* Holofotes e telão */}
        {tier >= 3 && (
          <>
            <polygon className="spot" points="10,0 18,0 70,90 30,90" fill="rgba(255,250,200,.18)" />
            <polygon className="spot s2" points="142,0 150,0 130,90 90,90" fill="rgba(255,250,200,.18)" />
            <rect x="66" y="0" width="28" height="9" fill="#111" />
            <rect x="67" y="1" width="26" height="7" fill="#3c64c8" />
            <rect x="70" y="3" width="20" height="3" fill="#f0d040" />
          </>
        )}
      </svg>
      {tier >= 3 && <div className="confetti" />}
    </div>
  );
}

export function fameNow(): Fame {
  const {trainer, collection} = useGame.getState();
  const c = careerOf(structuredClone(collection));
  return {name: trainer?.name ?? 'Você', fame: c.fame, worlds: c.titles.worlds ?? 0, titles: Object.values(c.titles).reduce((a, b) => a + (b ?? 0), 0)};
}

/** Uma fala com o nome de quem fala. */
export function Bubble({line, other, me}: {line: Line; other: string; me: string}) {
  const who = line.who === 'legend' ? other : line.who === 'me' ? me : line.who === 'narrator' ? 'Narrador' : null;
  return (
    <div className={`legend-bubble ${line.who}`}>
      {who && <b>{who}</b>}
      <p>{line.text}</p>
    </div>
  );
}

/** Cena do encontro: conversa, escolha e a ida para a arena. */
export function LegendMeetScreen() {
  const {run, trainer, answerLegend} = useGame();
  const meet = run?.legendMeet;
  const legend = meet ? getLegend(meet.id) : undefined;
  const me = useMemo(fameNow, []);
  const [lines, setLines] = useState<Line[]>(() => (legend && meet ? (meet.kind === 'approach' ? approachLines(legend, me) : foundLines(legend)) : []));
  const [shown, setShown] = useState(1);
  const [stage, setStage] = useState<'talk' | 'venue'>('talk');
  const [accepted, setAccepted] = useState(false);
  if (!run || !meet || !legend) return null;
  const biome = getBiome(run.biome);
  const regionName = getRegion(run.region).name;
  const tier = venueTier(me.fame);
  const more = shown < lines.length;

  const accept = (extra: Line[]) => {
    setAccepted(true);
    setLines([...lines, ...extra]);
    setShown(lines.length + 1);
  };

  if (stage === 'venue') {
    return (
      <div className="screen legend-screen">
        <h2>{venueName(tier, regionName)}</h2>
        <div className="legend-scene venue">
          <ArenaBackdrop tier={tier} color={biome.color} />
          <div className="legend-people">
            <TrainerAvatar avatar={trainer?.avatar ?? 'red'} name={me.name} size={120} />
            <span className="legend-vs">VS</span>
            <TrainerAvatar avatar={legend.avatar} name={legend.name} size={140} />
          </div>
        </div>
        <p className="note">{VENUES[tier].desc}</p>
        {tier < 2 && <p className="hint">Com mais fama, as lutas com lendas vão para estádios cheios, com torcida e narrador.</p>}
        <button className="btn primary big" onClick={() => answerLegend(true)}>
          Começar a batalha!
        </button>
      </div>
    );
  }

  return (
    <div className="screen legend-screen">
      <h2>
        {legend.name} <small className="muted">· {legend.title}</small>
      </h2>
      <div className="legend-scene" style={{backgroundColor: biome.color}}>
        <div className="arena-bg" style={{backgroundImage: `url(${FX(`bg/${biome.bg}.png`)})`, filter: biome.filter}} />
        <div className="legend-people">
          <TrainerAvatar avatar={trainer?.avatar ?? 'red'} name={me.name} size={120} />
          <TrainerAvatar avatar={legend.avatar} name={legend.name} size={140} />
        </div>
      </div>
      <div className="legend-dialog panel">
        {lines.slice(0, shown).map((l, i) => (
          <Bubble key={i} line={l} other={legend.name} me={me.name} />
        ))}
      </div>
      <div className="row center">
        {more ? (
          <button className="btn primary" onClick={() => setShown(n => n + 1)}>
            ▶ Continuar
          </button>
        ) : accepted ? (
          <button className="btn primary big" onClick={() => (playJingle('levelUp'), setStage('venue'))}>
            Ir para a arena
          </button>
        ) : meet.kind === 'approach' ? (
          <>
            <button className="btn primary big" onClick={() => accept([{who: 'me', text: 'Desafio aceito! Vamos nessa!'}, {who: 'legend', text: `Então vamos para a ${venueName(tier, regionName)}!`}])}>
              Aceitar o desafio
            </button>
            <button className="btn" onClick={() => answerLegend(false)}>
              Agora não
            </button>
          </>
        ) : (
          <>
            <button className="btn primary big" onClick={() => accept([...challengeLines(legend, me), {who: 'legend', text: `Aqui não tem espaço. Vamos para a ${venueName(tier, regionName)}!`}])}>
              Desafiar {legend.name}
            </button>
            <button className="btn" onClick={() => answerLegend(false)}>
              Deixar pra lá
            </button>
          </>
        )}
      </div>
      {!accepted && !more && <p className="hint">Se deixar para depois, o rastro da lenda cai pela metade e a ronda segue normal.</p>}
    </div>
  );
}

/** Conversa depois da luta com a lenda. */
export function LegendAfterModal() {
  const {run, trainer, closeLegendAfter} = useGame();
  const after = run?.legendAfter;
  const legend = after ? getLegend(after.id) : undefined;
  const me = useMemo(fameNow, []);
  if (!after || !legend) return null;
  const tier = venueTier(me.fame);
  return (
    <Modal onClose={closeLegendAfter}>
      <div className="legend-after">
        <TrainerAvatar avatar={legend.avatar} name={legend.name} size={120} />
        <h2>{after.won ? `Você venceu ${legend.name}!` : `${legend.name} venceu desta vez`}</h2>
        {outroLines(legend, me, after.won, tier).map((l, i) => (
          <Bubble key={i} line={l} other={legend.name} me={trainer?.name ?? 'Você'} />
        ))}
        <button className="btn primary" onClick={closeLegendAfter}>
          Continuar a jornada
        </button>
      </div>
    </Modal>
  );
}
