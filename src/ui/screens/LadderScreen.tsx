// Quickplay "Escadinha" (offline): lutas de 1 contra 1 numa escada que vai piorando.
// Contra o computador ou contra um amigo no mesmo aparelho.
import {useMemo, useState} from 'react';
import {species} from '../../data/dex';
import {RIVALS} from '../../data/rivals';
import {LADDER, LADDER_STEPS, drawLadders, ladderAfter, ladderMon} from '../../game/ladder';
import {recordMatch} from '../../game/history';
import {useGame} from '../../game/store';
import {AVATARS} from '../../game/trainers';
import {PixelIcon, Sprite, Types} from '../components';
import {useMatchGuard} from '../leaveGuard';
import {playCry} from '../audio';
import {MonInfo} from './BiomeGuide';
import {TrainerAvatar} from './StartScreens';
import {LocalDuel, RushResult, type Player} from './QuickplayScreen';

type Step = 'setup' | 'board' | 'battle' | 'end';

const cpuFoe = (): Player => {
  const r = RIVALS[Math.floor(Math.random() * RIVALS.length)];
  return {name: r.name, avatar: r.avatar};
};

export function LadderGame({me, onExit}: {me: Player; onExit: () => void}) {
  const [step, setStep] = useState<Step>('setup');
  const [vsCpu, setVsCpu] = useState(true);
  const [mine, setMine] = useState<Player>(me);
  const [friend, setFriend] = useState<Player>(() => ({name: 'Amigo', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)]}));
  const [cpu, setCpu] = useState<Player>(cpuFoe);
  const [curtain, setCurtain] = useState(true);
  const players: [Player, Player] = [mine, vsCpu ? cpu : friend];
  const [ladders, setLadders] = useState<[string[], string[]]>([[], []]);
  const [steps, setSteps] = useState<[number, number]>([0, 0]);
  const [fights, setFights] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const [champion, setChampion] = useState<number | null>(null);

  const record = (won: boolean, note: string) =>
    recordMatch(useGame.getState().trainer?.id, {
      mode: 'ladder',
      online: false,
      won,
      vs: players[1].name,
      vsAvatar: players[1].avatar,
      vsKind: vsCpu ? 'cpu' : 'friend',
      mine: ladders[0].slice(0, steps[0] + 1),
      theirs: ladders[1].slice(0, steps[1] + 1),
      note,
    });
  // Sair no meio da escada conta como derrota (igual ao Rush).
  useMatchGuard(step === 'board' || step === 'battle', () => record(false, 'Saiu no meio da partida'));

  const start = () => {
    if (vsCpu) setCpu(cpuFoe());
    setLadders(drawLadders());
    setSteps([0, 0]);
    setFights(0);
    setLast(null);
    setChampion(null);
    setStep('board');
  };

  if (step === 'setup')
    return (
      <div className="screen quickplay">
        <header className="bar">
          <button className="btn small" onClick={onExit}>
            <PixelIcon name="back" /> Voltar
          </button>
          <h2>Escadinha</h2>
        </header>
        <div className="panel rush-setup">
          <h3>Como funciona</h3>
          <ul className="ladder-rules">
            <li>Cada um tem uma escada de {LADDER_STEPS} Pokémon, do mais forte (um lendário) até um filhote bem fraco.</li>
            <li>As lutas são de 1 Pokémon contra 1. Quem ganha desce um degrau e pega um Pokémon mais fraco. Quem perde fica onde está.</li>
            <li>Ganha quem vencer uma luta com o último degrau.</li>
          </ul>
          <h3>Contra quem?</h3>
          <div className="rush-modes ladder-vs">
            <button className={`rush-mode ${vsCpu ? 'on' : ''}`} onClick={() => setVsCpu(true)}>
              <b>
                <PixelIcon name="robot" /> Computador
              </b>
              <span>Você contra um rival controlado pelo jogo.</span>
            </button>
            <button className={`rush-mode ${!vsCpu ? 'on' : ''}`} onClick={() => setVsCpu(false)}>
              <b>
                <PixelIcon name="people" /> Amigo no mesmo aparelho
              </b>
              <span>Os dois jogam aqui, passando a vez.</span>
            </button>
          </div>
          {!vsCpu && (
            <>
              <div className="rush-players">
                {[mine, friend].map((p, i) => (
                  <label key={i} className="rush-player">
                    <TrainerAvatar avatar={p.avatar} name={p.name} size={72} />
                    <span>Jogador {i + 1}</span>
                    <input
                      value={p.name}
                      maxLength={12}
                      onChange={e => (i === 0 ? setMine({...p, name: e.target.value || 'Jogador 1'}) : setFriend({...p, name: e.target.value || 'Jogador 2'}))}
                    />
                    {i === 1 && (
                      <button className="btn small" onClick={() => setFriend({...friend, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)]})}>
                        Trocar visual
                      </button>
                    )}
                  </label>
                ))}
              </div>
              <label className="rush-check">
                <input type="checkbox" checked={curtain} onChange={e => setCurtain(e.target.checked)} /> Esconder as escolhas na batalha (passar a vez com cortina)
              </label>
            </>
          )}
          <button className="btn primary big" onClick={start}>
            Sortear as escadas
          </button>
        </div>
      </div>
    );

  if (step === 'battle')
    return (
      <Fight
        key={fights}
        players={players}
        names={[ladders[0][steps[0]], ladders[1][steps[1]]]}
        curtain={curtain && !vsCpu}
        cpu={vsCpu}
        onEnd={w => {
          const after = ladderAfter(steps, w);
          setFights(f => f + 1);
          setLast(w);
          if (after.champion !== null) {
            record(after.champion === 0, `Escadinha em ${fights + 1} lutas`);
            setChampion(after.champion);
            setStep('end');
          } else {
            setSteps(after.steps);
            setStep('board');
          }
        }}
      />
    );

  if (step === 'end' && champion !== null)
    return (
      <RushResult
        title={`${players[champion].name} venceu a Escadinha!`}
        newLabel="Nova Escadinha"
        winner={players[champion]}
        team={[]}
        teamNames={[ladders[champion][LADDER_STEPS - 1]]}
        onNew={() => setStep('setup')}
        onExit={onExit}
      />
    );

  return <Board players={players} ladders={ladders} steps={steps} last={last} fights={fights} onFight={() => setStep('battle')} onExit={onExit} />;
}

/** Uma luta de 1 contra 1: cada uma começa com os Pokémon novinhos (HP cheio). */
function Fight({players, names, curtain, cpu, onEnd}: {players: [Player, Player]; names: [string, string]; curtain: boolean; cpu: boolean; onEnd: (winner: number) => void}) {
  const teams = useMemo(() => [[ladderMon(names[0])], [ladderMon(names[1])]] as [ReturnType<typeof ladderMon>[], ReturnType<typeof ladderMon>[]], [names]);
  return <LocalDuel players={players} teams={teams} curtain={curtain} cpu={cpu} onEnd={w => onEnd(w)} />;
}

/** As duas escadas lado a lado, com o degrau de cada um marcado. */
function Board({players, ladders, steps, last, fights, onFight, onExit}: {
  players: [Player, Player];
  ladders: [string[], string[]];
  steps: [number, number];
  last: number | null;
  fights: number;
  onFight: () => void;
  onExit: () => void;
}) {
  const [info, setInfo] = useState<string | null>(null);
  const lead = steps[0] === steps[1] ? null : steps[0] > steps[1] ? 0 : 1;
  return (
    <div className="screen quickplay">
      <header className="bar">
        <button className="btn small" onClick={onExit}>
          <PixelIcon name="back" /> Sair
        </button>
        <h2>Escadinha</h2>
        <span className="muted">{fights ? `Luta ${fights + 1}` : 'Primeira luta'}</span>
      </header>
      <div className="ladder-board">
        <p className="ladder-news">
          {last === null
            ? 'Os dois começam no topo, com um lendário. Quem vencer desce para um Pokémon mais fraco.'
            : `${players[last].name} venceu e desceu um degrau! ${lead === null ? 'Empate na escada.' : `${players[lead].name} está na frente.`}`}
        </p>
        <div className="ladder-cols">
          {players.map((p, i) => (
            <div key={i} className="ladder-col">
              <div className="ladder-head">
                <TrainerAvatar avatar={p.avatar} name={p.name} size={56} />
                <b>{p.name}</b>
                <span className="muted">
                  Degrau {steps[i] + 1} de {LADDER_STEPS}
                </span>
              </div>
              <ol className="ladder-steps">
                {ladders[i].map((name, k) => (
                  <li key={k} className={k < steps[i] ? 'done' : k === steps[i] ? 'on' : ''}>
                    <button className="ladder-step" onClick={() => setInfo(name)} title={`Ver ${species(name).name}`}>
                      <span className="ladder-n">{k + 1}</span>
                      <Sprite name={name} size={k === steps[i] ? 56 : 36} still={k !== steps[i]} />
                      <span className="ladder-name">
                        <b>{species(name).name}</b>
                        <small>{LADDER[k].name}</small>
                        {k === steps[i] && <Types name={name} />}
                      </span>
                      {k < steps[i] && <PixelIcon name="check" />}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <button
          className="btn primary big"
          onClick={() => {
            playCry(ladders[0][steps[0]]);
            onFight();
          }}
        >
          Lutar: {species(ladders[0][steps[0]]).name} contra {species(ladders[1][steps[1]]).name}
        </button>
      </div>
      {info && <MonInfo name={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
