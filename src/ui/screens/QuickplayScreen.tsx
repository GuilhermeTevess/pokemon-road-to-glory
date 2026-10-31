// Quickplay: Rush (dois jogadores no mesmo PC) e Campeonato rápido.
import {useEffect, useMemo, useRef, useState} from 'react';
import {TYPE_COLORS, dex, species, typeMultiplier} from '../../data/dex';
import {getItem} from '../../data/items';
import {moveDescPt} from '../../data/movesPt';
import {BattleController} from '../../game/battle';
import type {BattleEvent, Side} from '../../game/battle';
import {RUSH_MODES, drawGroups, drawPairs, giveMegaStone, rushMode, rushMon} from '../../game/rush';
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
import {FX, playMoveFx} from '../fx';

const wait = (ms: number) => new Promise(r => setTimeout(r, fast() ? ms * 0.3 : ms));

interface Player {
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

  const start = () => {
    setPairs(drawPairs(mode));
    setTeams([[], []]);
    setRound(0);
    setStep('draft');
  };

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
            Começar o sorteio
          </button>
        </div>
      </div>
    );

  if (step === 'draft') {
    const who = round % 2;
    const pair = pairs[round];
    const pickMon = (k: 0 | 1) => {
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
    return (
      <div className="screen quickplay">
        <header className="bar">
          <h2>Rush · {rushMode(mode).name}</h2>
          <span className="muted">
            Escolha {round + 1} de {pairs.length}
          </span>
        </header>
        <div className="rush-draft">
          <div className="rush-turn">
            <TrainerAvatar avatar={players[who].avatar} name={players[who].name} size={64} />
            <b>Vez de {players[who].name}</b>
            <span className="muted">Fique com um. O outro vai para {players[1 - who].name}.</span>
          </div>
          <div className="rush-pair">
            {pair.map((name, k) => (
              <button key={name} className="rush-pick" onClick={() => pickMon(k as 0 | 1)}>
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
                  {teams[i].map(m => (
                    <Sprite key={m.uid} name={m.species} size={44} still />
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
      <VersusBattle
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
function PrepScreen({player, team, mega, curtain, onDone}: {player: Player; team: OwnedMon[]; mega: boolean; curtain: boolean; onDone: (team: OwnedMon[]) => void}) {
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

// ------------------------------------------------------------------ Batalha no mesmo PC

interface View {
  species: string;
  level: number;
  hp: number;
  maxhp: number;
  status?: string;
  shiny?: boolean;
  anim?: string;
}

function VersusBattle({players, teams, curtain, onEnd}: {players: [Player, Player]; teams: [OwnedMon[], OwnedMon[]]; curtain: boolean; onEnd: (winner: number) => void}) {
  const ctl = useMemo(
    () => new BattleController(teams[0], {mon: teams[1][0], team: teams[1], rarity: 'rare', boss: true, trainer: players[1].name, versus: players[0].name}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const b = ctl.battle;
  const [views, setViews] = useState<Record<Side, View | null>>({p1: null, p2: null});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState<Side | null>(null);
  const [menu, setMenu] = useState<'main' | 'switch'>('main');
  const [mega, setMega] = useState(false);
  const [, force] = useState(0);
  const fxRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);

  const play = async (events: BattleEvent[]) => {
    setBusy(true);
    for (const ev of events) {
      if (ev.switchIn) {
        const s = ev.switchIn;
        setViews(v => ({...v, [s.side]: {species: s.species, level: s.level ?? 50, hp: s.hp, maxhp: s.maxhp, shiny: s.shiny, anim: 'enter'}}));
        playCry(s.species);
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
        await Promise.all([fxRef.current && arenaRef.current && !fast() ? playMoveFx(fxRef.current, arenaRef.current, mv.move, mv.side) : Promise.resolve(), wait(450)]);
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
    setBusy(false);
    force(x => x + 1);
  };

  useEffect(() => {
    void play(ctl.initialEvents());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!busy && ctl.ended) {
      playFanfare(1);
      playCrowd(1, 3);
      const t = setTimeout(() => onEnd(ctl.won ? 0 : 1), 1200);
      return () => clearTimeout(t);
    }
  }, [busy, ctl, onEnd]);

  // Quem precisa escolher agora (jogador 1 primeiro).
  const needs = (side: Side) => {
    const s = b[side];
    return (s.requestState === 'move' || s.requestState === 'switch') && !s.isChoiceDone();
  };
  const turn: Side | null = busy || ctl.ended ? null : needs('p1') ? 'p1' : needs('p2') ? 'p2' : null;
  const who = turn === 'p2' ? 1 : 0;
  const side = turn ? b[turn] : null;
  const req = side?.activeRequest as {active?: {moves: {id: string; pp?: number; maxpp?: number; disabled?: boolean}[]; trapped?: boolean; canMegaEvo?: boolean}[]; forceSwitch?: boolean[]} | null;
  const forced = side?.requestState === 'switch';
  const showCurtain = curtain && turn && ready !== turn;

  const choose = (choice: string) => {
    if (!turn) return;
    const events = turn === 'p1' ? choiceP1(choice) : ctl.chooseP2(choice);
    setMenu('main');
    setMega(false);
    setReady(null);
    void play(events);
  };
  const choiceP1 = (choice: string) => {
    if (choice.startsWith('switch')) {
      const idx = Number(choice.split(' ')[1]) - 1;
      return ctl.chooseSwitch(ctl.partyStatus()[idx].uid);
    }
    return ctl.chooseMove(Number(choice.split(' ')[1]), mega);
  };

  const foeOf = (s: Side) => b[s === 'p1' ? 'p2' : 'p1'].active[0];

  return (
    <div className="screen battle versus">
      <div className="versus-head">
        {players.map((p, i) => (
          <span key={i} className={`versus-name ${turn && who === i ? 'on' : ''}`}>
            <TrainerAvatar avatar={p.avatar} name={p.name} size={36} /> {p.name}
            <span className="foe-balls">
              {b[i === 0 ? 'p1' : 'p2'].pokemon.map((m, k) => (
                <i key={k} className={m.fainted ? 'down' : 'up'} />
              ))}
            </span>
          </span>
        ))}
      </div>
      <div className="arena" ref={arenaRef}>
        <ArenaBackdrop tier={1} color="#7aa860" />
        <div className="fx-layer" ref={fxRef} />
        {views.p2 && (
          <div className="slot-group">
            <div className="info-box wild-box s0">
              <div className="info-name">
                {species(views.p2.species).name} <span className="lv">Nv. {views.p2.level}</span>
              </div>
              <div className="row">
                <Types name={views.p2.species} />
                <StatusBadge status={views.p2.status} />
              </div>
              <HpBar hp={views.p2.hp} maxhp={views.p2.maxhp} showNumbers />
            </div>
            <div className={`mon-slot wild-slot s0 ${views.p2.anim ?? ''}`}>
              <Sprite name={views.p2.species} shiny={views.p2.shiny} />
            </div>
          </div>
        )}
        {views.p1 && (
          <div className="slot-group">
            <div className={`mon-slot player-slot s0 ${views.p1.anim ?? ''}`}>
              <Sprite name={views.p1.species} back shiny={views.p1.shiny} />
            </div>
            <div className="info-box player-box s0">
              <div className="info-name">
                {species(views.p1.species).name} <span className="lv">Nv. {views.p1.level}</span>
              </div>
              <div className="row">
                <Types name={views.p1.species} />
                <StatusBadge status={views.p1.status} />
              </div>
              <HpBar hp={views.p1.hp} maxhp={views.p1.maxhp} showNumbers />
            </div>
          </div>
        )}
      </div>
      <div className="battle-bottom">
        <div className="message">{message}</div>
        <div className="actions">
          {showCurtain && turn ? (
            <div className="rush-curtain inline">
              <b>Vez de {players[who].name}</b>
              <span className="muted">{players[1 - who].name}, não olhe!</span>
              <button className="btn primary" onClick={() => setReady(turn)}>
                Sou {players[who].name}, mostrar golpes
              </button>
            </div>
          ) : turn && side ? (
            <>
              <p className="versus-turn">
                <b>{players[who].name}</b>, {forced ? 'escolha quem entra' : 'o que vai fazer?'}
              </p>
              {menu === 'main' && !forced ? (
                <div className="move-grid">
                  {req?.active?.[0]?.canMegaEvo && (
                    <button className={`mega-toggle ${mega ? 'on' : ''}`} onClick={() => setMega(v => !v)}>
                      <span className="mega-box">{mega ? '✓' : ''}</span> Mega evoluir
                    </button>
                  )}
                  {(req?.active?.[0]?.moves ?? []).map((m, i) => {
                    const mv = dex.moves.get(m.id);
                    const foe = foeOf(turn);
                    const eff = effectivenessLabel(mv.category === 'Status' || !foe ? null : typeMultiplier(mv.type, foe.getTypes()));
                    return (
                      <button
                        key={m.id + i}
                        className="move-btn"
                        disabled={m.disabled || (m.pp ?? 1) <= 0}
                        style={{['--mc' as string]: TYPE_COLORS[mv.type]}}
                        onClick={() => choose(turn === 'p2' && mega ? `move ${i + 1} mega` : `move ${i + 1}`)}
                      >
                        <span className="move-name">{mv.name}</span>
                        <span className="move-meta">
                          <TypeBadge type={mv.type} small />
                          <CategoryIcon category={mv.category} />
                          {mv.basePower > 0 && <span>Poder {mv.basePower}</span>}
                          <span>
                            PP {m.pp ?? '?'}/{m.maxpp ?? '?'}
                          </span>
                        </span>
                        <span className="move-desc">{moveDescPt(mv.name)}</span>
                        {eff && <span className={`eff ${eff.cls}`}>{eff.text}</span>}
                      </button>
                    );
                  })}
                  <button className="btn small back" onClick={() => setMenu('switch')} disabled={!!req?.active?.[0]?.trapped}>
                    <img className="act-icon" src={FX('switchright.png')} alt="" /> Trocar
                  </button>
                </div>
              ) : (
                <div className="list-actions">
                  {side.pokemon.map((p, i) =>
                    p.isActive || p.fainted ? null : (
                      <button key={i} className="btn item-btn" onClick={() => choose(`switch ${i + 1}`)}>
                        <Sprite name={p.species.name} size={40} still /> {p.species.name}
                        <span className="muted">
                          {' '}
                          HP {p.hp}/{p.maxhp}
                          {p.item ? ` · ${getItem(p.item).name ?? p.item}` : ''}
                        </span>
                      </button>
                    ),
                  )}
                  {!forced && (
                    <button className="btn small back" onClick={() => setMenu('main')}>
                      ← Voltar
                    </button>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RushResult({winner, team, onRematch, onNew, onExit}: {winner: Player; team: OwnedMon[]; onRematch: () => void; onNew: () => void; onExit: () => void}) {
  return (
    <div className="screen quickplay rush-result">
      <div className="confetti" />
      <PixelIcon name="trophy" color="#e0a100" size={56} />
      <TrainerAvatar avatar={winner.avatar} name={winner.name} size={140} />
      <h2>{winner.name} venceu o Rush!</h2>
      <span className="team-row">
        {team.map(m => (
          <Sprite key={m.uid} name={m.species} size={56} />
        ))}
      </span>
      <div className="rush-result-actions">
        <button className="btn" onClick={onRematch}>
          Revanche (mesmos times)
        </button>
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
