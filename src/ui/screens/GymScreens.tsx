// Ginásios: entrada com conversa do líder, cenário do ginásio, cerimônia da insígnia e as cadernetas.
import {useEffect, useState} from 'react';
import {TYPE_COLORS, TYPE_PT, species} from '../../data/dex';
import {getBiome} from '../../data/biomes';
import {GYMS, GYM_BIOME, bookName, getGym, gymsOf} from '../../data/gyms';
import type {Gym} from '../../data/gyms';
import {REGIONS, getRegion} from '../../data/regions';
import {GYM_PRIZE, badgesIn, gymDifficulty, gymLines, gymStatus, gymWaves, leaderAvatar, leaderWinLine, ticketPrice} from '../../game/gym';
import {useGame} from '../../game/store';
import {playCoins, playJingle, playPlin} from '../audio';
import {FX} from '../fx';
import {Modal, Sprite, TypeBadge} from '../components';
import {fast} from '../settings';
import {Bubble, fameNow} from './LegendScreens';
import {TrainerAvatar} from './StartScreens';

export const badgeImg = (gym: Gym) => `${import.meta.env.BASE_URL}badges/${gym.id}.png`;

/** Capa de cada caderneta (cores do estojo de insígnias de cada região). */
const BOOK_SKINS: Record<string, {cover: string; trim: string; felt: string}> = {
  kanto: {cover: '#b8322f', trim: '#f2c94c', felt: '#5a1a1a'},
  johto: {cover: '#8a5a2b', trim: '#f5d76e', felt: '#3e2a14'},
  hoenn: {cover: '#2f6fb8', trim: '#9fd3ff', felt: '#173a63'},
  sinnoh: {cover: '#5b3d8f', trim: '#d9c3ff', felt: '#2b1c47'},
  unova: {cover: '#2b2b2b', trim: '#f4f4f4', felt: '#111'},
  kalos: {cover: '#d65a8c', trim: '#7fc8ff', felt: '#5c2340'},
  alola: {cover: '#f2a33a', trim: '#fff2b0', felt: '#7a4a12'},
  galar: {cover: '#6b2a8c', trim: '#e8c45c', felt: '#2e1240'},
  paldea: {cover: '#e86a2c', trim: '#a46cd8', felt: '#5a2410'},
};
const skinOf = (region: string) => BOOK_SKINS[region] ?? BOOK_SKINS.kanto;

/** Interior do ginásio: parede com o tema do tipo, piso quadriculado e o emblema no meio. */
export function GymBackdrop({gym, crowd}: {gym: Gym; crowd?: boolean}) {
  const color = TYPE_COLORS[gym.type] ?? '#888';
  const biome = getBiome(gymBiome(gym));
  return (
    <div className="arena-bg gym-bg">
      <div className="gym-wall" style={{backgroundImage: `url(${FX(`bg/${biome.bg}.png`)})`, filter: biome.filter}} />
      <svg viewBox="0 0 160 90" preserveAspectRatio="none" shapeRendering="crispEdges">
        {crowd &&
          Array.from({length: 38}, (_, i) => (
            <g key={i} className={`crowd-row r${i % 2}`}>
              <rect x={3 + i * 4.1} y={30} width="2" height="2" fill="#f4c8a0" />
              <rect x={2.5 + i * 4.1} y={32} width="3" height="3" fill={['#dc4646', '#3c64c8', color, '#f0d040'][i % 4]} />
            </g>
          ))}
        <rect x="0" y="36" width="160" height="3" fill="#222" />
        {Array.from({length: 8}, (_, r) =>
          Array.from({length: 16}, (_, c) => (
            <rect key={`${r}-${c}`} x={c * 10} y={39 + r * 6.5} width="10" height="6.5" fill={(r + c) % 2 ? color : '#f4f0e6'} opacity={(r + c) % 2 ? 0.75 : 0.9} />
          )),
        )}
        <g opacity=".55">
          <circle cx="80" cy="64" r="9" fill="#fff" stroke="#222" strokeWidth="1.2" />
          <rect x="71" y="63.4" width="18" height="1.2" fill="#222" />
          <path d="M71 64 A9 9 0 0 1 89 64 Z" fill={color} />
          <circle cx="80" cy="64" r="2.5" fill="#fff" stroke="#222" strokeWidth="1" />
        </g>
        {[6, 142].map(x => (
          <g key={x}>
            <rect x={x} y="4" width="12" height="26" fill={color} />
            <rect x={x + 2} y="6" width="8" height="2" fill="#fff" opacity=".7" />
            <polygon points={`${x},30 ${x + 6},34 ${x + 12},30`} fill={color} />
          </g>
        ))}
      </svg>
    </div>
  );
}

const gymBiome = (gym: Gym) => GYM_BIOME[gym.type] ?? 'city';

/** Chegada ao ginásio: o líder aparece e conversa antes da luta. */
export function GymIntroScreen() {
  const {run, trainer, startGymBattle} = useGame();
  const enc = run?.encounter;
  const gym = enc?.gym ? getGym(enc.gym) : undefined;
  const [me] = useState(fameNow);
  const [lines] = useState(() => (gym && run ? gymLines(gym, me, badgesIn(run, gym.region)) : []));
  const [shown, setShown] = useState(fast() ? lines.length : 1);
  if (!run || !gym || !enc) return null;
  const more = shown < lines.length;
  return (
    <div className="screen legend-screen gym-intro">
      <h2>
        {gym.region === 'alola' ? `Prova de ${gym.leader}` : `Ginásio de ${gym.leader}`} <small className="muted">· {gym.badge}</small>
      </h2>
      <div className="legend-scene">
        <GymBackdrop gym={gym} crowd={me.fame >= 400} />
        <div className="legend-people">
          <TrainerAvatar avatar={trainer?.avatar ?? 'red'} name={me.name} size={120} />
          <TrainerAvatar avatar={leaderAvatar(gym)} name={gym.leader} size={140} />
        </div>
      </div>
      <div className="legend-dialog panel">
        {lines.slice(0, shown).map((l, i) => (
          <Bubble key={i} line={l} other={gym.leader} me={me.name} />
        ))}
      </div>
      <p className="hint">
        Time do líder: {enc.team?.length ?? 1} Pokémon, até o nível {Math.max(...(enc.team ?? [enc.mon]).map(m => m.level))}. Fica mais forte com cada insígnia que você já tem
        aqui e com o tamanho e o nível do seu time.
      </p>
      <div className="row center">
        {more ? (
          <button className="btn primary" onClick={() => setShown(n => n + 1)}>
            ▶ Continuar
          </button>
        ) : (
          <button className="btn primary big" onClick={() => (playJingle('levelUp'), startGymBattle())}>
            Batalhar!
          </button>
        )}
      </div>
    </div>
  );
}

/** Cerimônia da insígnia: brilha, vai para a mão do treinador e é colada na caderneta. */
export function BadgeCeremony() {
  const {run, trainer, closeBadgeWon} = useGame();
  const gym = run?.badgeWon ? getGym(run.badgeWon) : undefined;
  const [step, setStep] = useState(fast() ? 3 : 0);
  useEffect(() => {
    if (step >= 3) return;
    const t = setTimeout(() => {
      setStep(s => s + 1);
      if (step === 0) playJingle('levelUp');
      if (step === 2) playPlin();
    }, [1500, 1300, 1100][step]);
    return () => clearTimeout(t);
  }, [step]);
  if (!run || !gym) return null;
  const list = gymsOf(gym.region);
  const idx = list.findIndex(g => g.id === gym.id);
  const skin = skinOf(gym.region);
  const complete = badgesIn(run, gym.region) === list.length;
  // Posição da vaga na caderneta (4 colunas × 2 linhas, no lado direito).
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  const slot = {left: `${56 + (38 * (col + 0.5)) / 4}%`, top: `${22 + (64 * (row + 0.5)) / 2}%`};
  const pos = step === 0 ? {left: '50%', top: '30%'} : step === 1 ? {left: '26%', top: '72%'} : slot;
  return (
    <Modal onClose={step >= 3 ? closeBadgeWon : undefined} wide>
      <div className="ceremony">
        <h2>{step < 3 ? `Você venceu ${gym.leader}!` : `${gym.badge} na caderneta!`}</h2>
        <Bubble line={{who: 'legend', text: leaderWinLine(gym)}} other={gym.leader} me="" />
        <div className={`ceremony-stage step${step}`}>
          <div className={`ceremony-trainer ${step >= 1 ? 'cheer' : ''}`}>
            <TrainerAvatar avatar={trainer?.avatar ?? 'red'} name={trainer?.name ?? 'Você'} size={140} />
          </div>
          <div className={`ceremony-book ${step >= 2 ? 'open' : ''}`} style={{['--cover' as string]: skin.cover, ['--trim' as string]: skin.trim, ['--felt' as string]: skin.felt}}>
            {list.map((g, i) => {
              const has = run.badges?.includes(g.id) && (g.id !== gym.id || step >= 3);
              return (
                <span key={g.id} className={`book-slot ${has ? 'has' : ''} ${g.id === gym.id && step >= 3 ? 'stamped' : ''}`} style={{gridColumn: (i % 4) + 1}}>
                  {has && <img src={badgeImg(g)} alt="" />}
                </span>
              );
            })}
          </div>
          {step < 3 && (
            <img className={`ceremony-badge step${step}`} src={badgeImg(gym)} alt={gym.badge} style={pos} />
          )}
        </div>
        {step >= 3 && (
          <>
            <p className="note">
              +{GYM_PRIZE.glory} Glória{complete ? ` · ${bookName(gym.region)} de ${getRegion(gym.region).name} completa! +${GYM_PRIZE.book} Glória` : ''}
            </p>
            <button className="btn primary" onClick={closeBadgeWon}>
              Continuar
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Estante com as cadernetas de todas as regiões; a da região atual também marca os ginásios. */
export function BadgeBooksModal({onClose}: {onClose: () => void}) {
  const {run, collection} = useGame();
  const [open, setOpen] = useState<string | null>(run?.region ?? null);
  const log = collection.badgeLog ?? {};
  const owned = (region: string) => gymsOf(region).filter(g => log[g.id]).length;
  return (
    <Modal onClose={onClose} wide>
      <h2>Cadernetas de insígnias</h2>
      <div className="book-shelf">
        {REGIONS.map(r => {
          const skin = skinOf(r.id);
          return (
            <button
              key={r.id}
              className={`book-cover ${open === r.id ? 'active' : ''}`}
              style={{['--cover' as string]: skin.cover, ['--trim' as string]: skin.trim}}
              onClick={() => setOpen(r.id)}
            >
              {run?.region === r.id && <span className="roulette-here">Você está aqui</span>}
              <Sprite name={r.icons[0]} size={40} still />
              <b>{r.name}</b>
              <small>
                {owned(r.id)}/{gymsOf(r.id).length}
              </small>
            </button>
          );
        })}
      </div>
      {open && <BadgeBook region={open} />}
    </Modal>
  );
}

function BadgeBook({region}: {region: string}) {
  const {run, collection, scheduleGym} = useGame();
  const [detail, setDetail] = useState<Gym | null>(null);
  const [picking, setPicking] = useState<Gym | null>(null);
  const [wave, setWave] = useState(0);
  const list = gymsOf(region);
  const skin = skinOf(region);
  const log = collection.badgeLog ?? {};
  const here = !!run && run.region === region && run.phase !== 'gameOver' && run.phase !== 'stageClear';
  const price = run ? ticketPrice(run) : 0;
  const waves = here && run ? gymWaves(run) : [];
  const rec = detail ? log[detail.id] : undefined;
  return (
    <div className="badge-book-open" style={{['--cover' as string]: skin.cover, ['--trim' as string]: skin.trim, ['--felt' as string]: skin.felt}}>
      <div className="book-title">
        {bookName(region)} · {getRegion(region).name}
      </div>
      <div className="book-page">
        {list.map(g => {
          const st = here && run ? gymStatus(run, g) : null;
          const booked = run?.gyms?.find(x => x.id === g.id);
          const has = !!log[g.id];
          return (
            <div key={g.id} className={`book-cell ${has ? 'has' : ''}`}>
              <button className="book-slot big" onClick={() => setDetail(g)} title={g.badge}>
                <img src={badgeImg(g)} alt={g.badge} className={has ? '' : 'missing'} />
                {st === 'won' && <span className="season-tick">✓</span>}
              </button>
              <b>{g.leader}</b>
              <TypeBadge type={g.type} small />
              {here && run && st === 'open' && (
                <button className="btn small primary" disabled={!waves.length || run.money < price} onClick={() => (setPicking(g), setWave(waves[0]))}>
                  Ingresso ₽ {price}
                </button>
              )}
              {st === 'booked' && <span className="gym-when">Luta na ronda {booked?.wave}</span>}
            </div>
          );
        })}
      </div>
      {here && (
        <p className="book-note">
          ✓ = ganha nesta temporada. Compre o ingresso e escolha a ronda (enquanto estiver aqui). Perder não acaba a run.
          {!waves.length && ' Não sobra ronda livre nesta região para marcar ginásio.'}
        </p>
      )}
      {picking && run && (
        <div className="panel gym-pick">
          <p>
            Ginásio de <b>{picking.leader}</b>: escolha a ronda
          </p>
          <div className="row center wrap">
            {waves.slice(0, 12).map(w => (
              <button key={w} className={`btn small ${w === wave ? 'primary' : ''}`} onClick={() => setWave(w)}>
                {w}
              </button>
            ))}
          </div>
          <p className="muted">Time previsto: {gymDifficulty(picking, run).size} Pokémon, nível ~{gymDifficulty(picking, run).level}.</p>
          <div className="row center">
            <button className="btn" onClick={() => setPicking(null)}>
              Cancelar
            </button>
            <button className="btn primary" onClick={() => (playCoins(), scheduleGym(picking.id, wave), setPicking(null))}>
              Pagar ₽ {price} e marcar ronda {wave}
            </button>
          </div>
        </div>
      )}
      {detail && (
        <div className="panel badge-detail">
          <img src={badgeImg(detail)} alt="" className={rec ? 'shine' : 'missing'} />
          <div>
            <h3>{detail.badge}</h3>
            <p className="muted">
              Líder {detail.leader} · tipo {TYPE_PT[detail.type] ?? detail.type}
            </p>
            {rec ? (
              <>
                <p>
                  Ganha em {new Date(rec.at).toLocaleDateString('pt-BR')}, na ronda {rec.wave}
                  {rec.turns ? `, em ${rec.turns} turnos` : ''}. Vitórias contra {detail.leader}: {rec.wins}.
                </p>
                <p className="muted">Seu time:</p>
                <div className="row wrap">
                  {rec.team.map((s, i) => (
                    <Sprite key={i} name={species(s).name} size={44} still />
                  ))}
                </div>
                <p className="muted">Time do líder (nível {rec.leaderLevel}):</p>
                <div className="row wrap">
                  {rec.leaderTeam.map((s, i) => (
                    <Sprite key={i} name={species(s).name} size={44} still />
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">Ainda não conquistada. Vença {detail.leader} para colar esta insígnia.</p>
            )}
          </div>
          <button className="btn small" onClick={() => setDetail(null)}>
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}

/** Total de insígnias na caderneta (todas as regiões). */
export const badgeTotal = (log: Record<string, unknown> | undefined) => GYMS.filter(g => log?.[g.id]).length;
