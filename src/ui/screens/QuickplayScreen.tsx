// Quickplay: Rush (dois jogadores no mesmo PC) e Campeonato rápido.
import {useEffect, useMemo, useRef, useState} from 'react';
import {TYPE_COLORS, species} from '../../data/dex';
import {getItem} from '../../data/items';
import {moveDescPt} from '../../data/movesPt';
import {BattleController} from '../../game/battle';
import type {BattleEvent, Side} from '../../game/battle';
import {RUSH_MODES, drawGroups, drawPairs, duelBalls, duelChoose, duelNeeds, duelRequest, giveMegaStone, rushMode, rushMon} from '../../game/rush';
import type {DuelReq} from '../../game/rush';
import type {RushMode} from '../../game/rush';
import {useGame} from '../../game/store';
import {AVATARS} from '../../game/trainers';
import {TOURS, tourInfo} from '../../game/tournament';
import type {TourKind} from '../../game/tournament';
import type {OwnedMon} from '../../game/types';
import {CategoryIcon, HpBar, PixelIcon, Sprite, StatusBadge, TypeBadge, Types, effectivenessLabel} from '../components';
import {ArenaBackdrop} from '../scene';
import {TrainerAvatar} from './StartScreens';
import {playCrowd, playCry, playFanfare, playHit, playMove} from '../audio';
import {fast} from '../settings';
import {OnlineRush} from './OnlineRush';
import {FX, playMoveFx} from '../fx';

const wait = (ms: number) => new Promise(r => setTimeout(r, fast() ? ms * 0.3 : ms));

export interface Player {
  name: string;
  avatar: string;
}

/** Menu do Quickplay. */
export function QuickplayScreen() {
  const {setScreen, trainer, startQuickTour} = useGame();
  const [mode, setMode] = useState<'menu' | 'rush' | 'tour'>('menu');
  const [kind, setKind] = useState<TourKind | null>(null);
  if (kind) return <TourDraft kind={kind} onBack={() => setKind(null)} onDone={team => startQuickTour(kind, team)} />;
  if (mode === 'rush') return <RushGame me={{name: trainer?.name ?? 'Jogador 1', avatar: trainer?.avatar ?? 'red'}} onExit={() => setMode('menu')} />;
  return (
    <div className="screen quickplay">
      <header className="bar">
        <button className="btn small" onClick={() => (mode === 'menu' ? setScreen('title') : setMode('menu'))}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>Quickplay</h2>
      </header>
      {mode === 'menu' && (
        <div className="qp-cards">
          <button className="qp-card" onClick={() => setMode('rush')}>
            <span className="qp-icon">⚡</span>
            <b>Rush</b>
            <span>Dois jogadores no mesmo PC. Aparecem 2 Pokémon: você fica com um e o outro vai para o seu amigo. Depois, batalha!</span>
          </button>
          <button className="qp-card" onClick={() => setMode('tour')}>
            <span className="qp-icon">🏆</span>
            <b>Campeonato rápido</b>
            <span>Monte um time na hora e jogue um campeonato inteiro. Acabou o campeonato, acabou o save. Não mexe na sua run nem na coleção.</span>
          </button>
        </div>
      )}
      {mode === 'tour' && (
        <div className="qp-cards">
          {TOURS.map(t => (
            <button key={t.kind} className="qp-card" onClick={() => setKind(t.kind as TourKind)}>
              <span className="qp-icon">🏆</span>
              <b>{t.name}</b>
              <span>
                Times de {t.teamSize} Pokémon, nível ~{Math.round(t.wave * 0.9) + 1}. Você escolhe {t.teamSize} Pokémon, um de cada trio sorteado.
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Campeonato rápido: monta o time escolhendo 1 de cada trio. */
function TourDraft({kind, onBack, onDone}: {kind: TourKind; onBack: () => void; onDone: (team: string[]) => void}) {
  const info = tourInfo(kind);
  const [groups] = useState(() => drawGroups('nv50', info.teamSize, 3));
  const [team, setTeam] = useState<string[]>([]);
  const group = groups[team.length];
  return (
    <div className="screen quickplay">
      <header className="bar">
        <button className="btn small" onClick={onBack}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>{info.name} rápido</h2>
        <span className="muted">
          Escolha {team.length + 1} de {info.teamSize}
        </span>
      </header>
      <div className="rush-draft">
        <div className="rush-pair three">
          {group?.map(name => (
            <button
              key={name}
              className="rush-pick"
              onClick={() => {
                playCry(name);
                const next = [...team, name];
                if (next.length >= info.teamSize) onDone(next);
                else setTeam(next);
              }}
            >
              <Sprite name={name} size={110} />
              <b>{species(name).name}</b>
              <Types name={name} />
              <StatLine name={name} />
              <span className="muted">{abilityLine(name)}</span>
            </button>
          ))}
        </div>
        <div className="rush-teams">
          <div className="rush-team on">
            <b>Seu time</b>
            <span className="team-row">
              {team.map(s => (
                <Sprite key={s} name={s} size={44} still />
              ))}
              {Array.from({length: info.teamSize - team.length}, (_, k) => (
                <span key={k} className="rush-empty" />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Rush

type Step = 'setup' | 'draft' | 'prep' | 'battle' | 'end';

function RushGame({me, onExit}: {me: Player; onExit: () => void}) {
  const [step, setStep] = useState<Step>('setup');
  const [players, setPlayers] = useState<[Player, Player]>(() => [me, {name: 'Amigo', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)]}]);
  const [mode, setMode] = useState<RushMode>('nv50');
  const [curtain, setCurtain] = useState(true);
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const [teams, setTeams] = useState<[OwnedMon[], OwnedMon[]]>([[], []]);
  const [round, setRound] = useState(0);
  const [prepFor, setPrepFor] = useState(0);
  const [winner, setWinner] = useState<number | null>(null);

  const [online, setOnline] = useState<{role: 'host' | 'guest'; code?: string} | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const start = () => {
    setPairs(drawPairs(mode));
    setTeams([[], []]);
    setRound(0);
    setStep('draft');
  };

  if (online) return <OnlineRush role={online.role} code={online.code} me={players[0]} mode={mode} onExit={() => setOnline(null)} />;
  if (step === 'setup')
    return (
      <div className="screen quickplay">
        <header className="bar">
          <button className="btn small" onClick={onExit}>
            <PixelIcon name="back" /> Voltar
          </button>
          <h2>Rush</h2>
        </header>
        <div className="panel rush-setup">
          <div className="rush-players">
            {players.map((p, i) => (
              <label key={i} className="rush-player">
                <TrainerAvatar avatar={p.avatar} name={p.name} size={72} />
                <span>Jogador {i + 1}</span>
                <input
                  value={p.name}
                  maxLength={12}
                  onChange={e => setPlayers(ps => ps.map((x, k) => (k === i ? {...x, name: e.target.value || `Jogador ${i + 1}`} : x)) as [Player, Player])}
                />
                {i === 1 && (
                  <button className="btn small" onClick={() => setPlayers(ps => [ps[0], {...ps[1], avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)]}])}>
                    Trocar visual
                  </button>
                )}
              </label>
            ))}
          </div>
          <h3>Modo</h3>
          <div className="rush-modes">
            {RUSH_MODES.map(m => (
              <button key={m.id} className={`rush-mode ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
                <b>{m.name}</b>
                <span>{m.about}</span>
              </button>
            ))}
          </div>
          <label className="rush-check">
            <input type="checkbox" checked={curtain} onChange={e => setCurtain(e.target.checked)} /> Esconder as escolhas na batalha (passar a vez com cortina)
          </label>
          <p className="hint">Cada um escolhe 3 vezes. Em cada vez aparecem 2 Pokémon: quem está na vez fica com um e o outro vai para o adversário. No fim, cada um tem 6.</p>
          <button className="btn primary big" onClick={start}>
            Começar o sorteio (mesmo PC)
          </button>
          <div className="rush-online">
            <h3>Jogar cada um no seu PC</h3>
            <p className="hint">Crie uma sala e mande o código para o seu amigo. Ele abre o jogo, vai em Quickplay → Rush e entra com o código.</p>
            <div className="rush-online-row">
              <button className="btn primary" onClick={() => setOnline({role: 'host'})}>
                Criar sala online
              </button>
              <input placeholder="CÓDIGO" maxLength={5} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} />
              <button className="btn" disabled={joinCode.length < 5} onClick={() => setOnline({role: 'guest', code: joinCode})}>
                Entrar na sala
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  if (step === 'draft') {
    const who = round % 2;
    const pair = pairs[round];
    const pickMon = (k: 0 | 1) => {
    void who;
      const mine = rushMon(pair[k], mode);
      const theirs = rushMon(pair[1 - k], mode);
      const next: [OwnedMon[], OwnedMon[]] = [[...teams[0]], [...teams[1]]];
      next[who].push(mine);
      next[1 - who].push(theirs);
      setTeams(next);
      playCry(pair[k]);
      if (round + 1 >= pairs.length) {
        setPrepFor(0);
        setStep('prep');
      } else setRound(round + 1);
    };
    return <DraftView players={players} mode={mode} round={round} total={pairs.length} pair={pair} teams={[teams[0].map(m => m.species), teams[1].map(m => m.species)]} canPick onPick={pickMon} />;
  }

  if (step === 'prep')
    return (
      <PrepScreen
        key={prepFor}
        player={players[prepFor]}
        team={teams[prepFor]}
        mega={mode === 'mega'}
        curtain={curtain}
        onDone={team => {
          const next: [OwnedMon[], OwnedMon[]] = [[...teams[0]], [...teams[1]]];
          next[prepFor] = team;
          setTeams(next);
          if (prepFor === 0) setPrepFor(1);
          else setStep('battle');
        }}
      />
    );

  if (step === 'battle')
    return (
      <LocalDuel
        players={players}
        teams={teams}
        curtain={curtain}
        onEnd={w => {
          setWinner(w);
          setStep('end');
        }}
      />
    );

  return (
    <RushResult
      winner={players[winner ?? 0]}
      team={teams[winner ?? 0]}
      onRematch={() => setStep('battle')}
      onNew={() => setStep('setup')}
      onExit={onExit}
    />
  );
}

/** Sorteio do Rush (o mesmo desenho no mesmo PC e no online). */
export function DraftView({players, mode, round, total, pair, teams, canPick, onPick}: {
  players: [Player, Player];
  mode: RushMode;
  round: number;
  total: number;
  pair: [string, string];
  teams: [string[], string[]];
  canPick: boolean;
  onPick: (k: 0 | 1) => void;
}) {
  const who = round % 2;
  return (
    <div className="screen quickplay">
      <header className="bar">
        <h2>Rush · {rushMode(mode).name}</h2>
        <span className="muted">
          Escolha {round + 1} de {total}
        </span>
      </header>
      <div className="rush-draft">
        <div className="rush-turn">
          <TrainerAvatar avatar={players[who].avatar} name={players[who].name} size={64} />
          <b>Vez de {players[who].name}</b>
          <span className="muted">{canPick ? `Fique com um. O outro vai para ${players[1 - who].name}.` : `Esperando ${players[who].name} escolher...`}</span>
        </div>
        <div className="rush-pair">
          {pair.map((name, k) => (
            <button key={name} className="rush-pick" disabled={!canPick} onClick={() => onPick(k as 0 | 1)}>
              <Sprite name={name} size={120} />
              <b>{species(name).name}</b>
              <Types name={name} />
              <StatLine name={name} />
              <span className="muted">{abilityLine(name)}</span>
            </button>
          ))}
        </div>
        <div className="rush-teams">
          {players.map((p, i) => (
            <div key={i} className={`rush-team ${who === i ? 'on' : ''}`}>
              <b>{p.name}</b>
              <span className="team-row">
                {teams[i].map((sp, k) => (
                  <Sprite key={k} name={sp} size={44} still />
                ))}
                {Array.from({length: 6 - teams[i].length}, (_, k) => (
                  <span key={k} className="rush-empty" />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatLine({name}: {name: string}) {
  const s = species(name).baseStats;
  const labels: [keyof typeof s, string][] = [['hp', 'HP'], ['atk', 'Atq'], ['def', 'Def'], ['spa', 'AtE'], ['spd', 'DfE'], ['spe', 'Vel']];
  return (
    <span className="rush-stats">
      {labels.map(([k, l]) => (
        <span key={k}>
          <small>{l}</small>
          <i style={{width: `${Math.min(100, (s[k] / 160) * 100)}%`}} />
        </span>
      ))}
    </span>
  );
}

function abilityLine(name: string): string {
  const a = species(name).abilities;
  return [a[0], a[1]].filter(Boolean).join(' / ');
}

/** Antes da luta: cada um escolhe quem abre (e, no modo Mega, quem leva a pedra). */
export function PrepScreen({player, team, mega, curtain, onDone}: {player: Player; team: OwnedMon[]; mega: boolean; curtain: boolean; onDone: (team: OwnedMon[]) => void}) {
  const [hidden, setHidden] = useState(curtain);
  const [lead, setLead] = useState(team[0].uid);
  const megaOk = team.filter(m => giveMegaTest(m));
  const [stone, setStone] = useState(megaOk[0]?.uid ?? '');
  if (hidden) return <Curtain player={player} text="Hora de montar a estratégia. O outro jogador não pode olhar!" onReady={() => setHidden(false)} />;
  return (
    <div className="screen quickplay">
      <header className="bar">
        <h2>Preparação · {player.name}</h2>
      </header>
      <div className="panel rush-prep">
        <p>Toque em quem vai abrir a luta.</p>
        <div className="rush-prep-grid">
          {team.map(m => (
            <button key={m.uid} className={`rush-prep-mon ${lead === m.uid ? 'lead' : ''}`} onClick={() => setLead(m.uid)}>
              <Sprite name={m.species} size={72} />
              <b>{species(m.species).name}</b>
              <Types name={m.species} />
              {lead === m.uid && <span className="win-tag">Abre</span>}
              {mega && stone === m.uid && <span className="mega-tag">Mega</span>}
            </button>
          ))}
        </div>
        {mega && megaOk.length > 0 && (
          <>
            <p>Quem leva a Mega Pedra coringa?</p>
            <div className="rush-prep-grid small">
              {megaOk.map(m => (
                <button key={m.uid} className={`rush-prep-mon ${stone === m.uid ? 'lead' : ''}`} onClick={() => setStone(m.uid)}>
                  <Sprite name={m.species} size={48} still />
                  {species(m.species).name}
                </button>
              ))}
            </div>
          </>
        )}
        <button
          className="btn primary big"
          onClick={() => {
            const ordered = [...team.filter(m => m.uid === lead), ...team.filter(m => m.uid !== lead)].map(m => ({...m, item: undefined as string | undefined}));
            const holder = ordered.find(m => m.uid === stone);
            if (mega && holder) giveMegaStone(holder);
            onDone(ordered);
          }}
        >
          Pronto!
        </button>
      </div>
    </div>
  );
}

function giveMegaTest(m: OwnedMon): boolean {
  const copy = {...m};
  giveMegaStone(copy);
  return !!copy.item;
}

function Curtain({player, text, onReady}: {player: Player; text: string; onReady: () => void}) {
  return (
    <div className="rush-curtain">
      <TrainerAvatar avatar={player.avatar} name={player.name} size={110} />
      <h2>Vez de {player.name}</h2>
      <p>{text}</p>
      <button className="btn primary big" onClick={onReady}>
        Sou {player.name}, pode mostrar
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ Batalha (mesmo PC ou online)

interface View {
  species: string;
  level: number;
  hp: number;
  maxhp: number;
  status?: string;
  shiny?: boolean;
  anim?: string;
}

/**
 * Tela da batalha do Rush. Só mostra: quem decide o que acontece é o "driver"
 * (o mesmo PC revezando, ou a rede no online). `batches` cresce a cada turno resolvido.
 */
export function BattleView({players, bottom, batches, balls, req, waiting, curtainFor, onChoose, onIdle}: {
  players: [Player, Player];
  /** Lado que aparece embaixo (o seu). */
  bottom: Side;
  batches: BattleEvent[][];
  balls: {p1: boolean[]; p2: boolean[]};
  /** O que o jogador deste PC pode escolher agora (null = nada). */
  req: DuelReq | null;
  /** Texto enquanto espera o outro jogador. */
  waiting?: string;
  /** Mostrar cortina antes do menu (mesmo PC). */
  curtainFor?: Player | null;
  onChoose: (choice: string, mega: boolean) => void;
  /** Avisado quando terminou de mostrar tudo o que chegou. */
  onIdle?: () => void;
}) {
  const [views, setViews] = useState<Record<Side, View | null>>({p1: null, p2: null});
  const [message, setMessage] = useState('');
  const [played, setPlayed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<'main' | 'switch'>('main');
  const [mega, setMega] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const top: Side = bottom === 'p1' ? 'p2' : 'p1';

  useEffect(() => {
    if (busy || played >= batches.length) return;
    const events = batches[played];
    setBusy(true);
    void (async () => {
      for (const ev of events) {
        if (ev.switchIn) {
          const sw = ev.switchIn;
          setViews(v => ({...v, [sw.side]: {species: sw.species, level: sw.level ?? 50, hp: sw.hp, maxhp: sw.maxhp, shiny: sw.shiny, anim: 'enter'}}));
          playCry(sw.species);
        }
        if (ev.forme) {
          const f = ev.forme;
          setViews(v => ({...v, [f.side]: v[f.side] ? {...v[f.side]!, species: f.species, anim: 'enter'} : null}));
          playCry(f.species);
          await wait(700);
        }
        if (ev.move) {
          const mv = ev.move;
          if (ev.text) setMessage(ev.text);
          playMove(mv.move);
          setViews(v => ({...v, [mv.side]: v[mv.side] ? {...v[mv.side]!, anim: 'attack'} : null}));
          // A animação usa "p1" para quem está embaixo.
          const fxSide = mv.side === bottom ? 'p1' : 'p2';
          // Com a aba em segundo plano a animação pode parar: nunca espera mais que 2,5 s.
          await Promise.all([
            fxRef.current && arenaRef.current && !fast() ? Promise.race([playMoveFx(fxRef.current, arenaRef.current, mv.move, fxSide), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve(),
            wait(450),
          ]);
          continue;
        }
        if (ev.hit) {
          const h = ev.hit;
          playHit(h.effect);
          setViews(v => ({...v, [h.side]: v[h.side] ? {...v[h.side]!, anim: 'hit'} : null}));
        }
        if (ev.hp) {
          const h = ev.hp;
          setViews(v => ({...v, [h.side]: v[h.side] ? {...v[h.side]!, hp: h.status === 'fnt' ? 0 : h.hp, maxhp: h.status === 'fnt' ? v[h.side]!.maxhp : h.maxhp, status: h.status ?? v[h.side]!.status} : null}));
        }
        if (ev.faint) {
          const side = ev.faint;
          setViews(v => ({...v, [side]: v[side] ? {...v[side]!, hp: 0, anim: 'faint'} : null}));
        }
        if (ev.text) {
          setMessage(ev.text);
          await wait(850);
        } else if (ev.hp) await wait(350);
      }
      setPlayed(n => n + 1);
      setBusy(false);
    })();
  }, [batches, played, busy, bottom]);

  const idle = !busy && played >= batches.length;
  useEffect(() => {
    if (idle) onIdle?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, batches.length]);

  // Cada pedido novo volta para o menu principal.
  const reqKey = req ? `${req.side}-${batches.length}-${req.forced}` : null;
  useEffect(() => {
    setMenu('main');
    setMega(false);
  }, [reqKey]);

  const who = req ? (req.side === 'p1' ? 0 : 1) : 0;
  const showCurtain = idle && req && curtainFor && shown !== reqKey;
  const choose = (choice: string) => {
    onChoose(choice, mega);
    setShown(null);
  };

  const box = (side: Side, isBottom: boolean) => {
    const v = views[side];
    if (!v) return null;
    const info = (
      <div className={`info-box ${isBottom ? 'player-box' : 'wild-box'} s0`}>
        <div className="info-name">
          {species(v.species).name} <span className="lv">Nv. {v.level}</span>
        </div>
        <div className="row">
          <Types name={v.species} />
          <StatusBadge status={v.status} />
        </div>
        <HpBar hp={v.hp} maxhp={v.maxhp} showNumbers />
      </div>
    );
    const sprite = (
      <div className={`mon-slot ${isBottom ? 'player-slot' : 'wild-slot'} s0 ${v.anim ?? ''}`}>
        <Sprite name={v.species} back={isBottom} shiny={v.shiny} />
      </div>
    );
    return <div className="slot-group">{isBottom ? <>{sprite}{info}</> : <>{info}{sprite}</>}</div>;
  };

  return (
    <div className="screen battle versus">
      <div className="versus-head">
        {(['p1', 'p2'] as Side[]).map((side, i) => (
          <span key={side} className={`versus-name ${req && req.side === side ? 'on' : ''}`}>
            <TrainerAvatar avatar={players[i].avatar} name={players[i].name} size={36} /> {players[i].name}
            <span className="foe-balls">
              {balls[side].map((up, k) => (
                <i key={k} className={up ? 'up' : 'down'} />
              ))}
            </span>
          </span>
        ))}
      </div>
      <div className="arena" ref={arenaRef}>
        <ArenaBackdrop tier={1} color="#7aa860" />
        <div className="fx-layer" ref={fxRef} />
        {box(top, false)}
        {box(bottom, true)}
      </div>
      <div className="battle-bottom">
        <div className="message">{message}</div>
        <div className="actions">
          {!idle ? null : showCurtain && req && curtainFor ? (
            <div className="rush-curtain inline">
              <b>Vez de {curtainFor.name}</b>
              <span className="muted">{players[1 - who].name}, não olhe!</span>
              <button className="btn primary" onClick={() => setShown(reqKey)}>
                Sou {curtainFor.name}, mostrar golpes
              </button>
            </div>
          ) : req ? (
            <>
              <p className="versus-turn">
                <b>{players[who].name}</b>, {req.forced ? 'escolha quem entra' : 'o que vai fazer?'}
              </p>
              {menu === 'main' && !req.forced ? (
                <div className="move-grid">
                  {req.canMega && (
                    <button className={`mega-toggle ${mega ? 'on' : ''}`} onClick={() => setMega(v => !v)}>
                      <span className="mega-box">{mega ? '✓' : ''}</span> Mega evoluir
                    </button>
                  )}
                  {req.moves.map(m => {
                    const eff = effectivenessLabel(m.eff);
                    return (
                      <button key={m.id + m.index} className="move-btn" disabled={m.disabled || (!m.locked && m.pp <= 0)} style={{['--mc' as string]: TYPE_COLORS[m.type]}} onClick={() => choose(`move ${m.index}`)}>
                        <span className="move-name">{m.name}</span>
                        <span className="move-meta">
                          <TypeBadge type={m.type} small />
                          <CategoryIcon category={m.category} />
                          {m.basePower > 0 && <span>Poder {m.basePower}</span>}
                          {m.locked ? <span>Continua o golpe</span> : <span>PP {m.pp}/{m.maxpp}</span>}
                        </span>
                        <span className="move-desc">{moveDescPt(m.name)}</span>
                        {eff && <span className={`eff ${eff.cls}`}>{eff.text}</span>}
                      </button>
                    );
                  })}
                  <button className="btn small back" onClick={() => setMenu('switch')} disabled={req.trapped || !req.switches.length}>
                    <img className="act-icon" src={FX('switchright.png')} alt="" /> Trocar
                  </button>
                </div>
              ) : (
                <div className="list-actions">
                  {req.switches.map(sw => (
                    <button key={sw.index} className="btn item-btn" onClick={() => choose(`switch ${sw.index}`)}>
                      <Sprite name={sw.species} size={40} still /> {species(sw.species).name}
                      <span className="muted">
                        {' '}
                        HP {sw.hp}/{sw.maxhp}
                        {sw.item ? ` · ${getItem(sw.item).name ?? sw.item}` : ''}
                      </span>
                    </button>
                  ))}
                  {!req.forced && (
                    <button className="btn small back" onClick={() => setMenu('main')}>
                      ← Voltar
                    </button>
                  )}
                </div>
              )}
            </>
          ) : waiting ? (
            <p className="hint waiting">{waiting}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Mesmo PC: os dois lados decidem aqui, um de cada vez. */
function LocalDuel({players, teams, curtain, onEnd}: {players: [Player, Player]; teams: [OwnedMon[], OwnedMon[]]; curtain: boolean; onEnd: (winner: number) => void}) {
  const ctl = useMemo(
    () => new BattleController(teams[0], {mon: teams[1][0], team: teams[1], rarity: 'rare', boss: true, trainer: players[1].name, versus: players[0].name}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [batches, setBatches] = useState<BattleEvent[][]>(() => [ctl.initialEvents()]);
  const [idle, setIdle] = useState(false);
  const turn: Side | null = !idle || ctl.ended ? null : duelNeeds(ctl.battle, 'p1') ? 'p1' : duelNeeds(ctl.battle, 'p2') ? 'p2' : null;
  useEffect(() => {
    if (idle && ctl.ended) {
      playFanfare(1);
      playCrowd(1, 3);
      const t = setTimeout(() => onEnd(ctl.won ? 0 : 1), 1200);
      return () => clearTimeout(t);
    }
  }, [idle, ctl, onEnd]);
  return (
    <BattleView
      players={players}
      bottom="p1"
      batches={batches}
      balls={duelBalls(ctl.battle)}
      req={turn ? duelRequest(ctl.battle, turn) : null}
      curtainFor={curtain && turn ? players[turn === 'p1' ? 0 : 1] : null}
      onIdle={() => setIdle(true)}
      onChoose={(choice, mega) => {
        if (!turn) return;
        const events = duelChoose(ctl, turn, choice, mega);
        setIdle(false);
        setBatches(b => [...b, events]);
      }}
    />
  );
}

export function RushResult({winner, team, teamNames, onRematch, onNew, onExit}: {
  winner: Player;
  team: OwnedMon[];
  teamNames?: string[];
  onRematch?: () => void;
  onNew: () => void;
  onExit: () => void;
}) {
  const names = teamNames ?? team.map(m => m.species);
  return (
    <div className="screen quickplay rush-result">
      <div className="confetti" />
      <PixelIcon name="trophy" color="#e0a100" size={56} />
      <TrainerAvatar avatar={winner.avatar} name={winner.name} size={140} />
      <h2>{winner.name} venceu o Rush!</h2>
      <span className="team-row">
        {names.map((sp, k) => (
          <Sprite key={k} name={sp} size={56} />
        ))}
      </span>
      <div className="rush-result-actions">
        {onRematch && (
          <button className="btn" onClick={onRematch}>
            Revanche (mesmos times)
          </button>
        )}
        <button className="btn primary" onClick={onNew}>
          Novo Rush
        </button>
        <button className="btn" onClick={onExit}>
          Sair
        </button>
      </div>
    </div>
  );
}
