import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {getBiome} from '../../data/biomes';
import {defensiveMatchups, species} from '../../data/dex';
import {getItem} from '../../data/items';
import type {BattleController, BattleEvent} from '../../game/battle';
import {isBossWave, isMilestoneWave, STAGE_LENGTH} from '../../game/encounters';
import {getBattle, useGame} from '../../game/store';
import {
  HpBar,
  ItemIcon,
  MatchupPanel,
  RarityBadge,
  Sprite,
  StatusBadge,
  TypeBadge,
  Types,
  effectivenessLabel,
} from '../components';
import {playBall, playCry, playHit, playJingle, playMove} from '../audio';

interface SideView {
  species: string;
  level: number;
  hp: number;
  maxhp: number;
  status?: string;
  shiny: boolean;
  anim?: string;
}

type Menu = 'main' | 'fight' | 'bag' | 'balls' | 'switch' | 'healTarget';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export function BattleScreen() {
  const run = useGame(s => s.run)!;
  const {finishBattle, consume} = useGame();
  const ctl = useMemo(() => getBattle(run), [run.encounter?.mon.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [player, setPlayer] = useState<SideView | null>(null);
  const [wild, setWild] = useState<SideView | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const [menu, setMenu] = useState<Menu>('main');
  const [healItem, setHealItem] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState<'wild' | 'player' | null>(null);
  const [ballAnim, setBallAnim] = useState<number | null>(null);
  const [, force] = useState(0);
  const started = useRef(false);
  const caughtRef = useRef(false);

  const biome = getBiome(run.biome);
  const enc = run.encounter!;

  const lookupPlayer = useCallback(
    (uid?: string) => run.party.find(m => m.uid === uid) ?? run.party.find(m => m.uid === ctl?.activeUid()),
    [run.party, ctl],
  );

  const play = useCallback(
    async (events: BattleEvent[]) => {
      setBusy(true);
      for (const ev of events) {
        if (ev.switchIn) {
          const s = ev.switchIn;
          if (s.side === 'p1') {
            const mon = lookupPlayer(s.uid);
            setPlayer({species: s.species, level: mon?.level ?? 1, hp: s.hp, maxhp: s.maxhp, shiny: !!mon?.shiny, anim: 'enter'});
          } else {
            setWild({species: s.species, level: enc.mon.level, hp: s.hp, maxhp: s.maxhp, shiny: enc.mon.shiny, anim: 'enter'});
          }
          playCry(s.species);
        }
        if (ev.move) {
          playMove(ev.move.move);
          const set = ev.move.side === 'p1' ? setPlayer : setWild;
          set(v => (v ? {...v, anim: 'attack'} : v));
        }
        if (ev.hit) {
          playHit(ev.hit.effect);
          const set = ev.hit.side === 'p1' ? setPlayer : setWild;
          set(v => (v ? {...v, anim: 'hit'} : v));
        }
        if (ev.hp) {
          const h = ev.hp;
          const set = h.side === 'p1' ? setPlayer : setWild;
          set(v => (v ? {...v, hp: h.status === 'fnt' ? 0 : h.hp, maxhp: h.status === 'fnt' ? v.maxhp : h.maxhp, status: h.status ?? v.status} : v));
        }
        if (ev.faint) {
          const set = ev.faint === 'p1' ? setPlayer : setWild;
          set(v => (v ? {...v, hp: 0, anim: 'faint'} : v));
          if (ev.faint === 'p1' && player) playCry(player.species);
        }
        if (ev.text) {
          setMessage(ev.text);
          await wait(ev.move ? 650 : 850);
        } else if (ev.hp) {
          await wait(350);
        }
        setPlayer(v => (v && v.anim !== 'faint' ? {...v, anim: undefined} : v));
        setWild(v => (v && v.anim !== 'faint' ? {...v, anim: undefined} : v));
      }
      setBusy(false);
      force(x => x + 1);
    },
    [enc, lookupPlayer, player],
  );

  // Começo da batalha.
  useEffect(() => {
    if (!ctl || started.current) return;
    started.current = true;
    void play(ctl.initialEvents());
  }, [ctl, play]);

  // Fim da batalha / troca obrigatória.
  useEffect(() => {
    if (!ctl || busy) return;
    if (caughtRef.current) return;
    if (ctl.ended) {
      const won = ctl.won || (ctl.wildActive.fainted && ctl.battle.p1.pokemon.some(p => !p.fainted));
      setMessage(won ? 'Vitória!' : 'Todos os seus Pokémon desmaiaram...');
      if (won) playJingle('levelUp');
      else playJingle('faint');
      const t = setTimeout(() => finishBattle(won ? 'won' : 'lost'), 1300);
      return () => clearTimeout(t);
    }
    if (ctl.mustSwitch) {
      setMenu('switch');
      setMessage('Escolha o próximo Pokémon!');
    } else {
      setMessage(`O que ${player?.species ?? 'seu Pokémon'} vai fazer?`);
    }
  }, [busy, ctl, finishBattle, player?.species]);

  if (!ctl) return null;

  const act = (fn: () => BattleEvent[]) => {
    setMenu('main');
    const events = fn();
    useGame.getState().touch();
    void play(events);
  };

  const balls = Object.entries(run.bag).filter(([id, n]) => n > 0 && getItem(id).kind === 'ball');
  const heals = Object.entries(run.bag).filter(([id, n]) => n > 0 && getItem(id).kind === 'heal');
  const moves = ctl.moveOptions();
  const party = ctl.partyStatus();
  const wildTypes = ctl.wildActive.getTypes();
  const playerActive = ctl.playerActive;

  const throwBall = async (id: string) => {
    if (!consume(id)) return;
    setMenu('main');
    setBusy(true);
    const {result, events} = ctl.throwBall(id);
    setMessage(`Você jogou uma ${getItem(id).name}!`);
    playBall();
    setBallAnim(0);
    await wait(500);
    for (let i = 0; i < Math.min(result.shakes, 3); i++) {
      setBallAnim(i + 1);
      await wait(550);
    }
    setBallAnim(null);
    if (result.caught) {
      caughtRef.current = true;
      setWild(v => (v ? {...v, anim: 'caught'} : v));
      playJingle('catch');
      setMessage(`Gotcha! ${enc.mon.species} foi capturado!`);
      await wait(1600);
      finishBattle('caught');
      return;
    }
    await play(events.slice(1));
  };

  const header = isMilestoneWave(run.wave)
    ? `Ronda ${run.wave} · Desafio final da etapa`
    : isBossWave(run.wave)
      ? `Ronda ${run.wave} · Chefe`
      : `Ronda ${run.wave}/${STAGE_LENGTH}`;

  return (
    <div className="screen battle-screen">
      <div className="battle-top">
        <span>{header}</span>
        <span>
          {biome.emoji} {biome.name}
        </span>
        <span>₽ {run.money}</span>
      </div>
      <div className="arena" style={{background: `linear-gradient(${biome.colors[0]} 0%, ${biome.colors[0]} 45%, ${biome.colors[1]} 100%)`}}>
        {wild && (
          <>
            <div className="info-box wild-box" onClick={() => setShowInfo(showInfo === 'wild' ? null : 'wild')}>
              <div className="info-name">
                {wild.shiny && <span className="shiny">★</span>}
                {species(wild.species).name} <span className="lv">Nv. {wild.level}</span>
              </div>
              <div className="row">
                <Types name={wild.species} />
                <RarityBadge rarity={enc.rarity} />
                <StatusBadge status={wild.status} />
              </div>
              <HpBar hp={wild.hp} maxhp={wild.maxhp} />
              <WeakLine types={wildTypes} />
              <div className="info-hint">toque para ver todas as fraquezas</div>
            </div>
            <div className={`mon-slot wild-slot ${wild.anim ?? ''} ${enc.boss ? 'boss' : ''}`}>
              {ballAnim !== null ? (
                <img
                  className={`ball-sprite shake-${ballAnim}`}
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
                  alt="Pokébola"
                />
              ) : (
                <Sprite name={wild.species} shiny={wild.shiny} />
              )}
            </div>
          </>
        )}
        {player && (
          <>
            <div className={`mon-slot player-slot ${player.anim ?? ''}`}>
              <Sprite name={player.species} back shiny={player.shiny} />
            </div>
            <div className="info-box player-box" onClick={() => setShowInfo(showInfo === 'player' ? null : 'player')}>
              <div className="info-name">
                {player.shiny && <span className="shiny">★</span>}
                {species(player.species).name} <span className="lv">Nv. {player.level}</span>
              </div>
              <div className="row">
                <Types name={player.species} />
                <StatusBadge status={player.status} />
              </div>
              <HpBar hp={player.hp} maxhp={player.maxhp} showNumbers />
            </div>
          </>
        )}
        {showInfo && (
          <div className="info-pop" onClick={() => setShowInfo(null)}>
            {showInfo === 'wild' ? (
              <MatchupPanel types={wildTypes} title={`Fraquezas de ${ctl.wildActive.name}`} />
            ) : playerActive ? (
              <MatchupPanel types={playerActive.getTypes()} title={`Fraquezas de ${playerActive.name}`} />
            ) : null}
          </div>
        )}
      </div>

      <div className="battle-bottom">
        <div className="message">{message}</div>
        <div className="actions">
          {busy ? null : menu === 'main' && !ctl.ended ? (
            <div className="main-actions">
              <button className="btn act fight" onClick={() => setMenu('fight')}>
                ⚔️ Lutar
              </button>
              <button className="btn act" onClick={() => setMenu('balls')} disabled={!balls.length}>
                🔴 Pokébola
              </button>
              <button className="btn act" onClick={() => setMenu('bag')} disabled={!heals.length}>
                🎒 Mochila
              </button>
              <button className="btn act" onClick={() => setMenu('switch')} disabled={!ctl.canSwitch() || party.filter(p => p.hp > 0).length < 2}>
                🔁 Trocar
              </button>
              <button className="btn act" onClick={() => finishBattle('fled')} disabled={!ctl.canFlee()}>
                🏃 Fugir
              </button>
            </div>
          ) : menu === 'fight' ? (
            <div className="move-grid">
              {moves.map(m => {
                const eff = effectivenessLabel(m.effectiveness);
                return (
                  <button
                    key={m.id + m.index}
                    className="move-btn"
                    disabled={m.disabled || m.pp <= 0}
                    style={{borderColor: `var(--t-${m.type})`}}
                    onClick={() => act(() => ctl.chooseMove(m.index))}
                  >
                    <span className="move-name">{m.name}</span>
                    <span className="move-meta">
                      <TypeBadge type={m.type} small />
                      <span className="cat">{m.category === 'Physical' ? 'Físico' : m.category === 'Special' ? 'Especial' : 'Status'}</span>
                      {m.basePower > 0 && <span>Poder {m.basePower}</span>}
                      <span>
                        PP {m.pp}/{m.maxpp}
                      </span>
                    </span>
                    {eff && <span className={`eff ${eff.cls}`}>{eff.text}</span>}
                  </button>
                );
              })}
              <button className="btn small back" onClick={() => setMenu('main')}>
                ← Voltar
              </button>
            </div>
          ) : menu === 'balls' ? (
            <div className="list-actions">
              {balls.map(([id, n]) => (
                <button key={id} className="btn item-btn" onClick={() => void throwBall(id)}>
                  <ItemIcon id={id} /> {getItem(id).name} x{n}
                </button>
              ))}
              <button className="btn small back" onClick={() => setMenu('main')}>
                ← Voltar
              </button>
            </div>
          ) : menu === 'bag' ? (
            <div className="list-actions">
              {heals.map(([id, n]) => (
                <button
                  key={id}
                  className="btn item-btn"
                  onClick={() => {
                    setHealItem(id);
                    setMenu('healTarget');
                  }}
                >
                  <ItemIcon id={id} /> {getItem(id).name} x{n}
                </button>
              ))}
              <button className="btn small back" onClick={() => setMenu('main')}>
                ← Voltar
              </button>
            </div>
          ) : menu === 'healTarget' && healItem ? (
            <div className="list-actions">
              {party
                .filter(p => p.hp > 0 && p.hp < p.maxhp)
                .map(p => (
                  <button
                    key={p.uid}
                    className="btn item-btn"
                    onClick={() => {
                      if (!consume(healItem)) return;
                      act(() => ctl.useHealItem(healItem, p.uid));
                    }}
                  >
                    <Sprite name={p.species} still size={32} /> {p.species} {p.hp}/{p.maxhp}
                  </button>
                ))}
              <button className="btn small back" onClick={() => setMenu('bag')}>
                ← Voltar
              </button>
            </div>
          ) : menu === 'switch' ? (
            <SwitchMenu ctl={ctl} onPick={uid => act(() => ctl.chooseSwitch(uid))} onBack={ctl.mustSwitch ? undefined : () => setMenu('main')} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SwitchMenu({ctl, onPick, onBack}: {ctl: BattleController; onPick: (uid: string) => void; onBack?: () => void}) {
  const party = ctl.partyStatus();
  const wildTypes = ctl.wildActive.getTypes();
  return (
    <div className="switch-list">
      {party.map(p => {
        const s = species(p.species);
        // Quão bem esse Pokémon aguenta os tipos do selvagem.
        const worst = Math.max(...wildTypes.map(t => ctl.battle.dex.getEffectiveness(t, [...s.types])));
        return (
          <button key={p.uid} className={`switch-btn ${p.active ? 'active' : ''}`} disabled={p.active || p.hp <= 0} onClick={() => onPick(p.uid)}>
            <Sprite name={p.species} still size={48} />
            <span className="switch-info">
              <span>
                {s.name} Nv.{p.level} <StatusBadge status={p.status} />
              </span>
              <Types name={p.species} />
              <HpBar hp={p.hp} maxhp={p.maxhp} showNumbers />
              {p.hp > 0 && !p.active && (
                <span className={`eff ${worst > 0 ? 'eff-2' : worst < 0 ? 'eff-h' : 'eff-1'}`}>
                  {worst > 0 ? 'Fraco contra o selvagem' : worst < 0 ? 'Resiste ao selvagem' : 'Neutro'}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {onBack && (
        <button className="btn small back" onClick={onBack}>
          ← Voltar
        </button>
      )}
    </div>
  );
}

/** Linha compacta com as fraquezas do selvagem, sempre visível. */
function WeakLine({types}: {types: readonly string[]}) {
  const m = defensiveMatchups(types);
  if (!m.x4.length && !m.x2.length) return null;
  return (
    <div className="weak-line">
      Fraco a:
      {m.x4.map(t => (
        <span key={t} className="row">
          <TypeBadge type={t} small />
          <b>4x</b>
        </span>
      ))}
      {m.x2.map(t => (
        <TypeBadge key={t} type={t} small />
      ))}
    </div>
  );
}
