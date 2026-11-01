import {roundOf} from '../../game/career';
// Ginásios: entrada com conversa do líder, cenário do ginásio, cerimônia da insígnia e as cadernetas.
import {useEffect, useState} from 'react';
import {TYPE_PT, species} from '../../data/dex';
import {GYMS, bookName, getGym, gymsOf} from '../../data/gyms';
import type {Gym} from '../../data/gyms';
import {REGIONS, getRegion} from '../../data/regions';
import {isBossWave} from '../../game/encounters';
import {GYM_PRIZE, badgesIn, gymDifficulty, gymLines, gymStatus, gymWaves, leaderAvatar, leaderWinLine, ticketPrice} from '../../game/gym';
import {useGame} from '../../game/store';
import {playCoins, playJingle, playSticker} from '../audio';
import {Modal, Sprite, TypeBadge} from '../components';
import {fast} from '../settings';
import {fameNow} from './LegendScreens';
import {DialogueBar, GymBackdrop} from '../scene';
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

/** Chegada ao ginásio: o líder aparece e conversa antes da luta. */
export function GymIntroScreen() {
  const {run, trainer, startGymBattle} = useGame();
  const enc = run?.encounter;
  const gym = enc?.gym ? getGym(enc.gym) : undefined;
  const [me] = useState(fameNow);
  const [lines] = useState(() => (gym && run ? gymLines(gym, me, badgesIn(run, gym.region)) : []));
  if (!run || !gym || !enc) return null;
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
      <DialogueBar
        lines={lines}
        other={{name: gym.leader, avatar: leaderAvatar(gym)}}
        me={{name: me.name, avatar: trainer?.avatar ?? 'red'}}
        end={
          <>
            <p className="hint">
              Time do líder: {enc.team?.length ?? 1} Pokémon, até o nível {Math.max(...(enc.team ?? [enc.mon]).map(m => m.level))}. Fica mais forte com cada insígnia que
              você já tem aqui e com o tamanho e o nível do seu time.
            </p>
            <button className="btn primary big" onClick={() => (playJingle('levelUp'), startGymBattle())}>
              Batalhar!
            </button>
          </>
        }
      />
    </div>
  );
}

/**
 * Cerimônia logo depois da vitória: no ginásio, o líder entrega a insígnia, ela brilha e
 * vai para a mão do treinador, que comemora e cola na caderneta. O líder fecha com uma fala.
 */
export function BadgeCeremony() {
  const {run, trainer, closeBadgeWon} = useGame();
  const gym = run?.badgeWon ? getGym(run.badgeWon) : undefined;
  const [step, setStep] = useState<'talk' | 'give' | 'cheer' | 'book' | 'bye'>('talk');
  useEffect(() => {
    if (step === 'give') {
      playJingle('levelUp');
      const t = setTimeout(() => setStep('cheer'), fast() ? 200 : 1300);
      return () => clearTimeout(t);
    }
    if (step === 'cheer') {
      const t = setTimeout(() => setStep('book'), fast() ? 200 : 1600);
      return () => clearTimeout(t);
    }
    if (step === 'book') {
      const t = setTimeout(() => (playSticker(), setStep('bye')), fast() ? 200 : 1400);
      return () => clearTimeout(t);
    }
  }, [step]);
  if (!run || !gym) return null;
  const list = gymsOf(gym.region);
  const skin = skinOf(gym.region);
  const complete = badgesIn(run, gym.region) === list.length;
  const merit = run.badgeMerit;
  const me = {name: trainer?.name ?? 'Você', avatar: trainer?.avatar ?? 'red'};
  const leader = {name: gym.leader, avatar: leaderAvatar(gym)};
  const talk = merit
    ? [
        {who: 'legend' as const, text: 'Você perdeu a luta... mas eu vi como você e seus Pokémon lutaram juntos até o fim.'},
        {who: 'legend' as const, text: `Isso vale mais que uma vitória. Leve a ${gym.badge}. Você mereceu!`},
      ]
    : [
        {who: 'legend' as const, text: leaderWinLine(gym)},
        {who: 'legend' as const, text: `Como prova da sua vitória, aceite a ${gym.badge}!`},
      ];
  const bye = complete
    ? `Com essa, a ${bookName(gym.region).toLowerCase()} de ${getRegion(gym.region).name} está completa! Agora vá mostrar seu valor na Liga.`
    : badgesIn(run, gym.region) === 1
      ? 'É a sua primeira insígnia daqui! Ainda tem muito ginásio pela frente.'
      : 'Boa sorte nos próximos ginásios. Vou torcer por você!';
  const inBook = step === 'book' || step === 'bye';
  return (
    <Modal wide>
      <div className="ceremony">
        <h2>{inBook ? `${gym.badge} na caderneta!` : merit ? `Insígnia por mérito!` : `Você venceu ${gym.leader}!`}</h2>
        <div className={`legend-scene ceremony-scene step-${step}`}>
          <GymBackdrop gym={gym} />
          <div className="legend-people close">
            <span className={step === 'cheer' || inBook ? 'cheer-loop' : ''}>
              <TrainerAvatar avatar={me.avatar} name={me.name} size={130} />
            </span>
            <TrainerAvatar avatar={leader.avatar} name={leader.name} size={140} />
          </div>
          {!inBook && step !== 'talk' && <img className={`ceremony-badge2 ${step}`} src={badgeImg(gym)} alt={gym.badge} />}
          {step === 'bye' && <div className="screen-sparkles" aria-hidden>{Array.from({length: 18}, (_, i) => <i key={i} style={{left: `${(i * 37) % 100}%`, top: `${(i * 53) % 90}%`, animationDelay: `${(i % 6) * 0.18}s`}} />)}</div>}
          {inBook && (
            <div className="ceremony-book open" style={{['--cover' as string]: skin.cover, ['--trim' as string]: skin.trim, ['--felt' as string]: skin.felt}}>
              {list.map(g => {
                const has = run.badges?.includes(g.id) && (g.id !== gym.id || step === 'bye');
                return (
                  <span key={g.id} className={`book-slot ${has ? 'has' : ''} ${g.id === gym.id && step === 'bye' ? 'stamped' : ''}`}>
                    {has && <img src={badgeImg(g)} alt="" />}
                    {g.id === gym.id && step === 'bye' && <Sparkles />}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {step === 'talk' && <DialogueBar key="talk" lines={talk} other={leader} me={me} onDone={() => setStep('give')} />}
        {step === 'bye' && (
          <DialogueBar
            key="bye"
            lines={[{who: 'legend', text: bye}]}
            other={leader}
            me={me}
            end={
              <>
                <p className="note">
                  +{GYM_PRIZE.glory} Glória{complete ? ` · caderneta completa! +${GYM_PRIZE.book} Glória` : ''}
                </p>
                <button className="btn primary" onClick={closeBadgeWon}>
                  Continuar
                </button>
              </>
            }
          />
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
              {st === 'booked' && <span className="gym-when">Luta na ronda {booked && run ? roundOf({...run, wave: booked.wave}) : ''}</span>}
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
              <button key={w} className={`btn small ${w === wave ? 'primary' : ''}`} onClick={() => setWave(w)} title={isBossWave(w) ? 'Ronda de chefe' : undefined}>
                {roundOf({...run, wave: w})}
                {isBossWave(w) && ' 👑'}
              </button>
            ))}
          </div>
          {isBossWave(wave) && <p className="hint">👑 Ronda de chefe: o ginásio toma o lugar do chefe. Você não ganha a EXP dele nem a chance de capturar um Pokémon forte.</p>}
          <p className="muted">Ginásio não dá XP nem dinheiro: vale a insígnia e os pontos no ranking.</p>
          <p className="muted">Time previsto: {gymDifficulty(picking, run).size} Pokémon, nível ~{gymDifficulty(picking, run).level}.</p>
          <div className="row center">
            <button className="btn" onClick={() => setPicking(null)}>
              Cancelar
            </button>
            <button className="btn primary" onClick={() => (playCoins(), scheduleGym(picking.id, wave), setPicking(null))}>
              Pagar ₽ {price} e marcar ronda {roundOf({...run, wave})}
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

/** Estrelinhas em volta da insígnia que acabou de ser colada. */
function Sparkles() {
  return (
    <span className="slot-sparkles" aria-hidden>
      {Array.from({length: 8}, (_, i) => (
        <i key={i} style={{['--r' as string]: `${i * 45}deg`, animationDelay: `${(i % 2) * 0.12}s`}} />
      ))}
    </span>
  );
}
