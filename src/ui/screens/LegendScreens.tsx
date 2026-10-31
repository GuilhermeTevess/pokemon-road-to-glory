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
import {ArenaBackdrop, DialogueBar} from '../scene';
import {TrainerAvatar} from './StartScreens';

export function fameNow(): Fame {
  const {trainer, collection} = useGame.getState();
  const c = careerOf(structuredClone(collection));
  return {name: trainer?.name ?? 'Você', fame: c.fame, worlds: c.titles.worlds ?? 0, titles: Object.values(c.titles).reduce((a, b) => a + (b ?? 0), 0)};
}

/** Cena do encontro: conversa, escolha e a ida para a arena. */
export function LegendMeetScreen() {
  const {run, trainer, answerLegend} = useGame();
  const meet = run?.legendMeet;
  const legend = meet ? getLegend(meet.id) : undefined;
  const me = useMemo(fameNow, []);
  const [stage, setStage] = useState<'talk' | 'accepted' | 'venue'>('talk');
  const [extra, setExtra] = useState<Line[]>([]);
  if (!run || !meet || !legend) return null;
  const biome = getBiome(run.biome);
  const regionName = getRegion(run.region).name;
  const tier = venueTier(me.fame);
  const speakers = {other: {name: legend.name, avatar: legend.avatar}, me: {name: me.name, avatar: trainer?.avatar ?? 'red'}};
  const lines = meet.kind === 'approach' ? approachLines(legend, me) : foundLines(legend);
  const accept = (more: Line[]) => (setExtra(more), setStage('accepted'));

  if (stage === 'venue') {
    return (
      <div className="screen legend-screen">
        <h2>{venueName(tier, regionName)}</h2>
        <div className="legend-scene venue">
          <ArenaBackdrop tier={tier} color={biome.color} bg={biome.bg} filter={biome.filter} />
          <div className="legend-people">
            <TrainerAvatar avatar={speakers.me.avatar} name={me.name} size={120} />
            <span className="legend-vs">VS</span>
            <TrainerAvatar avatar={legend.avatar} name={legend.name} size={140} />
          </div>
        </div>
        <DialogueBar
          key="venue"
          lines={[{who: 'scene', text: VENUES[tier].desc}]}
          {...speakers}
          end={
            <>
              {tier < 2 && <p className="hint">Com mais fama, as lutas com lendas vão para estádios cheios, com torcida e narrador.</p>}
              <button className="btn primary big" onClick={() => answerLegend(true)}>
                Começar a batalha!
              </button>
            </>
          }
        />
      </div>
    );
  }

  const choice =
    meet.kind === 'approach' ? (
      <div className="row center">
        <button className="btn primary big" onClick={() => accept([{who: 'me', text: 'Desafio aceito! Vamos nessa!'}, {who: 'legend', text: `Então vamos para a ${venueName(tier, regionName)}!`}])}>
          Aceitar o desafio
        </button>
        <button className="btn" onClick={() => answerLegend(false)}>
          Agora não
        </button>
      </div>
    ) : (
      <div className="row center">
        <button className="btn primary big" onClick={() => accept([...challengeLines(legend, me), {who: 'legend', text: `Aqui não tem espaço. Vamos para a ${venueName(tier, regionName)}!`}])}>
          Desafiar {legend.name}
        </button>
        <button className="btn" onClick={() => answerLegend(false)}>
          Deixar pra lá
        </button>
      </div>
    );

  return (
    <div className="screen legend-screen">
      <h2>
        {legend.name} <small className="muted">· {legend.title}</small>
      </h2>
      <div className="legend-scene" style={{backgroundColor: biome.color}}>
        <div className="arena-bg" style={{backgroundImage: `url(${FX(`bg/${biome.bg}.png`)})`, filter: biome.filter}} />
        <div className="legend-people">
          <TrainerAvatar avatar={speakers.me.avatar} name={me.name} size={120} />
          <TrainerAvatar avatar={legend.avatar} name={legend.name} size={140} />
        </div>
      </div>
      {stage === 'talk' ? (
        <DialogueBar
          key="talk"
          lines={lines}
          {...speakers}
          end={
            <>
              {choice}
              <p className="hint">Se deixar para depois, o rastro da lenda cai pela metade e a ronda segue normal.</p>
            </>
          }
        />
      ) : (
        <DialogueBar
          key="accepted"
          lines={extra}
          {...speakers}
          end={
            <button className="btn primary big" onClick={() => (playJingle('levelUp'), setStage('venue'))}>
              Ir para a arena
            </button>
          }
        />
      )}
    </div>
  );
}

/** Logo depois da luta: os dois na arena, o narrador e a fala da lenda. */
export function LegendAfterModal() {
  const {run, trainer, closeLegendAfter} = useGame();
  const after = run?.legendAfter;
  const legend = after ? getLegend(after.id) : undefined;
  const me = useMemo(fameNow, []);
  if (!run || !after || !legend) return null;
  const tier = venueTier(me.fame);
  return (
    <Modal wide>
      <div className="legend-after">
        <h2>{after.won ? `Você venceu ${legend.name}!` : `${legend.name} venceu desta vez`}</h2>
        <div className="legend-scene venue">
          <ArenaBackdrop tier={tier} color={getBiome(run.biome).color} bg={getBiome(run.biome).bg} filter={getBiome(run.biome).filter} />
          <div className="legend-people close">
            <span className={after.won ? 'cheer-loop' : ''}>
              <TrainerAvatar avatar={trainer?.avatar ?? 'red'} name={me.name} size={130} />
            </span>
            <TrainerAvatar avatar={legend.avatar} name={legend.name} size={130} />
          </div>
        </div>
        <DialogueBar
          lines={outroLines(legend, me, after.won, tier)}
          other={{name: legend.name, avatar: legend.avatar}}
          me={{name: me.name, avatar: trainer?.avatar ?? 'red'}}
          end={
            <button className="btn primary" onClick={closeLegendAfter}>
              Continuar a jornada
            </button>
          }
        />
      </div>
    </Modal>
  );
}
