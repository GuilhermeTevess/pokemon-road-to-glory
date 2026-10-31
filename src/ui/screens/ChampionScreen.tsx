// Festa de campeão: palco, plateia, fogos e você no centro com o parceiro.
// O tamanho da festa cresce com o torneio: League Cup é modesta, o Mundial é enorme.
import {useEffect, useMemo} from 'react';
import type {Line} from '../../game/legend';
import type {TourKind} from '../../game/tournament';
import type {OwnedMon} from '../../game/types';
import {species} from '../../data/dex';
import {Sprite, PixelIcon} from '../components';
import {CrowdLayer, DialogueBar, seeded} from '../scene';
import {TrainerAvatar} from './StartScreens';
import {playCrowd, playFanfare, playFirework} from '../audio';

const SIZE: Record<TourKind, number> = {cup: 0, regional: 1, international: 2, worlds: 3};

/** Pokémon pequenos (até 70 cm) sobem no ombro; os maiores ficam de pé ao lado. */
export function onShoulder(name: string): boolean {
  const s = species(name);
  return s.heightm <= 0.7 && s.weightkg <= 25;
}

function lines(kind: TourKind, tour: string, me: string, foe: string, mon: string): Line[] {
  const n = (text: string): Line => ({who: 'narrator', text});
  const out: Line[] = [];
  if (kind === 'cup') {
    out.push(n(`E acabou! ${me} vence ${foe} e leva a ${tour}!`));
    out.push(n(`Pouca gente na arquibancada, mas quem veio não vai esquecer.`));
  } else if (kind === 'regional') {
    out.push(n(`É campeão! ${me} derrota ${foe} na grande final do ${tour}!`));
    out.push(n(`A arena inteira de pé! O nome de ${me} já corre pela região!`));
    out.push(n(`E ${mon}, o parceiro de sempre, divide o troféu com o treinador!`));
  } else if (kind === 'international') {
    out.push(n(`INACREDITÁVEL! ${me} é campeão do ${tour}!`));
    out.push(n(`${foe} lutou até o fim, mas hoje a noite é de ${me}!`));
    out.push(n(`Ouçam essa torcida! Gente de todos os continentes gritando um nome só!`));
    out.push(n(`${mon} sobe ao palco com o treinador. Que dupla!`));
  } else {
    out.push(n(`ACABOU! ACABOU! ${me} É CAMPEÃO MUNDIAL!`));
    out.push(n(`Diante de milhares de pessoas, ${me} derrota ${foe} na final do ${tour}!`));
    out.push(n(`Os fogos tomam conta do céu! O estádio treme!`));
    out.push(n(`Lá no centro do palco, ${me} e ${mon}. Do primeiro passo até o topo do mundo!`));
    out.push(n(`Guardem essa data: hoje nasceu uma lenda do Pokémon!`));
  }
  out.push({who: 'me', text: kind === 'worlds' ? `${mon}... a gente conseguiu. Somos os melhores do mundo!` : `Conseguimos, ${mon}! Valeu, pessoal!`});
  return out;
}

/** Fogos em CSS: cada um é um círculo de faíscas que explode e some. */
function Fireworks({count, seed}: {count: number; seed: number}) {
  const fw = useMemo(() => {
    const r = seeded(seed);
    const colors = ['#f0d040', '#f08cb4', '#6cc7f0', '#7be07b', '#ff8a3d', '#c69cf5'];
    return Array.from({length: count}, () => ({
      x: 8 + r() * 84,
      y: 6 + r() * 34,
      c: colors[Math.floor(r() * colors.length)],
      d: r() * 2.4,
      s: 0.7 + r() * 0.7,
    }));
  }, [count, seed]);
  return (
    <div className="fireworks" aria-hidden>
      {fw.map((f, i) => (
        <span key={i} className="fw" style={{left: `${f.x}%`, top: `${f.y}%`, color: f.c, animationDelay: `${f.d}s`, transform: `scale(${f.s})`}}>
          {Array.from({length: 12}, (_, k) => (
            <i key={k} style={{['--r' as string]: `${k * 30}deg`, animationDelay: `${f.d}s`}} />
          ))}
        </span>
      ))}
    </div>
  );
}

export function ChampionCelebration({kind, tour, me, foe, partner, prize, onClose, onFinish}: {
  kind: TourKind;
  tour: string;
  me: {name: string; avatar: string};
  foe: {name: string; avatar: string};
  partner?: OwnedMon;
  prize: string;
  onClose: () => void;
  onFinish: () => void;
}) {
  const size = SIZE[kind];
  const mon = partner ? partner.nickname || species(partner.species).name : 'meu time';
  const shoulder = partner ? onShoulder(partner.species) : false;
  const script = useMemo(() => lines(kind, tour, me.name, foe.name, mon), [kind, tour, me.name, foe.name, mon]);

  useEffect(() => {
    playFanfare(size);
    playCrowd(size, 3 + size * 1.5);
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Fogos: nenhum na League Cup, alguns no Regional, muitos no Mundial.
    const shots = [0, 3, 6, 14][size];
    for (let i = 0; i < shots; i++) timers.push(setTimeout(() => playFirework(), 600 + i * (size >= 3 ? 550 : 900)));
    // Nos grandes torneios a plateia continua vibrando.
    if (size >= 2) for (let i = 1; i <= size; i++) timers.push(setTimeout(() => playCrowd(size - 1, 4), i * 5000));
    return () => timers.forEach(clearTimeout);
  }, [size]);

  return (
    <div className={`champion-scene size-${size}`}>
      <div className="champ-sky" />
      {size >= 1 && <Fireworks count={[0, 4, 8, 16][size]} seed={size * 13 + 7} />}
      {size >= 3 && <div className="champ-spot l" />}
      {size >= 3 && <div className="champ-spot r" />}
      <CrowdLayer rows={[2, 3, 4, 6][size]} density={[0.35, 0.6, 0.8, 0.95][size]} seed={size + 3} silhouette={size >= 2} top={size >= 2 ? 18 : 30} height={size >= 2 ? 48 : 36} />
      {size >= 1 && <div className="confetti" />}
      <div className="champ-stage">
        <div className="champ-podium" />
        <div className="champ-hero">
          <span className="champ-trophy">
            <PixelIcon name="trophy" color="#e0a100" size={[34, 42, 50, 64][size]} />
          </span>
          <div className="champ-trainer">
            <TrainerAvatar avatar={me.avatar} name={me.name} size={[120, 130, 140, 160][size]} />
            {partner && shoulder && (
              <span className="champ-partner shoulder">
                <Sprite name={partner.species} shiny={partner.shiny} size={110} />
              </span>
            )}
          </div>
          {partner && !shoulder && (
            <span className="champ-partner beside">
              <Sprite name={partner.species} shiny={partner.shiny} size={150} />
            </span>
          )}
        </div>
      </div>
      <div className="champ-title">
        <small>{tour}</small>
        <b>{size >= 3 ? 'CAMPEÃO MUNDIAL!' : 'CAMPEÃO!'}</b>
      </div>
      <DialogueBar
        lines={script}
        other={foe}
        me={me}
        end={
          <div className="champ-end">
            <p>{prize}</p>
            <button className="btn" onClick={onClose}>
              Ver chaveamento
            </button>
            <button className="btn primary" onClick={onFinish}>
              Seguir a temporada
            </button>
          </div>
        }
      />
    </div>
  );
}
