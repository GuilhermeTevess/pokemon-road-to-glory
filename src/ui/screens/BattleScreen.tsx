import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {getBiome} from '../../data/biomes';
import {TYPE_COLORS, species} from '../../data/dex';
import {getItem} from '../../data/items';
import {moveDescPt} from '../../data/movesPt';
import type {BattleController, BattleEvent} from '../../game/battle';
import {isBossWave, isMilestoneWave, STAGE_LENGTH} from '../../game/encounters';
import {getBattle, useGame} from '../../game/store';
import {
  HpBar,
  ItemIcon,
  MatchupPanel,
  MonName,
  MoveInfo,
  PixelIcon,
  RarityBadge,
  Sprite,
  StatusBadge,
  TypeBadge,
  Types,
  effectivenessLabel,
} from '../components';
import {playBall, playCry, playHit, playJingle, playMove, playShake} from '../audio';
import {FX, playMoveFx, throwBallFx} from '../fx';
import {lineRoot} from '../../game/meta';
import type {OwnedMon} from '../../game/types';
import {Hearts} from './CollectionScreen';
import {itemSpriteUrl} from '../../data/dex';

interface SideView {
  species: string;
  level: number;
  hp: number;
  maxhp: number;
  status?: string;
  shiny: boolean;
  nickname?: string;
  partner?: boolean;
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
  const fxRef = useRef<HTMLDivElement>(null);
  const [moveInfo, setMoveInfo] = useState<string | null>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const caughtRef = useRef(false);

  const biome = getBiome(run.biome);
  const enc = run.encounter!;
  const collection = useGame(s => s.collection);
  const partner = run.party.find(m => m.partner);

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
            setPlayer({
              species: mon?.species ?? s.species, nickname: mon?.nickname, partner: mon?.partner,
              level: mon?.level ?? 1, hp: s.hp, maxhp: s.maxhp, shiny: !!mon?.shiny, anim: 'enter',
            });
          } else {
            setWild({species: s.species, level: enc.mon.level, hp: s.hp, maxhp: s.maxhp, shiny: enc.mon.shiny, anim: 'enter'});
          }
          playCry(s.species);
        }
        if (ev.forme) {
          const f = ev.forme;
          (f.side === 'p1' ? setPlayer : setWild)(v => (v ? {...v, species: f.species, anim: 'enter'} : v));
          playCry(f.species);
          await wait(700);
        }
        if (ev.move) {
          const mv = ev.move;
          if (ev.text) setMessage(ev.text);
          playMove(mv.move);
          const set = mv.side === 'p1' ? setPlayer : setWild;
          set(v => (v ? {...v, anim: 'attack'} : v));
          await Promise.all([
            fxRef.current && arenaRef.current ? playMoveFx(fxRef.current, arenaRef.current, mv.move, mv.side) : Promise.resolve(),
            wait(450),
          ]);
          setPlayer(v => (v && v.anim === 'attack' ? {...v, anim: undefined} : v));
          setWild(v => (v && v.anim === 'attack' ? {...v, anim: undefined} : v));
          continue;
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
          await wait(850);
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
      if (won) playJingle('victory');
      else playJingle('faint');
      const t = setTimeout(() => finishBattle(won ? 'won' : 'lost'), 1300);
      return () => clearTimeout(t);
    }
    if (ctl.mustSwitch) {
      setMenu('switch');
      setMessage('Escolha o próximo Pokémon!');
    } else {
      setMessage(`O que ${player ? player.nickname || species(player.species).name : 'seu Pokémon'} vai fazer?`);
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
  const heals = Object.entries(run.bag).filter(([id, n]) => n > 0 && ['heal', 'revive', 'battle'].includes(getItem(id).kind));
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
    if (fxRef.current) await throwBallFx(fxRef.current);
    setBallAnim(0);
    await wait(400);
    for (let i = 0; i < Math.min(result.shakes, 3); i++) {
      setBallAnim(i + 1);
      playShake();
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

  const header = enc.trainer
    ? `Desafio do rival ${enc.trainer}`
    : isMilestoneWave(run.wave)
    ? `Ronda ${run.wave} · Desafio final da etapa`
    : isBossWave(run.wave)
      ? `Ronda ${run.wave} · Chefe`
      : `Ronda ${run.wave}/${STAGE_LENGTH}`;

  return (
    <div className="screen battle-screen">
      {moveInfo && <MoveInfo move={moveInfo} onClose={() => setMoveInfo(null)} />}
      <div className="battle-top">
        <span>{header}</span>
        <span>
          {biome.name}
        </span>
        <span>₽ {run.money}</span>
      </div>
      {partner && (
        <div className="partner-corner" title="Seu parceiro nesta run">
          <Sprite name={partner.species} shiny={partner.shiny} size={36} still />
          <span>
            <MonName mon={partner} />
            <Hearts entry={collection.entries[lineRoot(partner.species)]} small />
          </span>
        </div>
      )}
      <div className="arena" ref={arenaRef} style={{backgroundColor: biome.color}}>
        <div className="arena-bg" style={{backgroundImage: `url(${FX(`bg/${biome.bg}.png`)})`, filter: biome.filter}} />
        <div className="fx-layer" ref={fxRef} />
        {wild && (
          <>
            <div className="info-box wild-box">
              <div className="info-name">
                {wild.shiny && <PixelIcon name="star" color="#e0a100" />}
                {species(wild.species).name} <span className="lv">Nv. {wild.level}</span>
              </div>
              <div className="row">
                <Types name={wild.species} />
                <RarityBadge rarity={enc.rarity} />
                <StatusBadge status={wild.status} />
              </div>
              <HpBar hp={wild.hp} maxhp={wild.maxhp} />
              <button className={`weak-btn ${showInfo === 'wild' ? 'open' : ''}`} onClick={() => setShowInfo(showInfo === 'wild' ? null : 'wild')}>
                Fraquezas {showInfo === 'wild' ? '▴' : '▾'}
              </button>
              {showInfo === 'wild' && (
                <div className="weak-pop below">
                  <MatchupPanel types={wildTypes} />
                  <p className="weak-pop-hint">Toque num tipo para abrir a calculadora.</p>
                </div>
              )}
            </div>
            <div className={`mon-slot wild-slot ${wild.anim ?? ''} ${enc.boss ? 'boss' : ''}`}>
              {ballAnim !== null ? (
                <img
                  className={`ball-sprite shake-${ballAnim}`}
                  src={FX('pokeball.png')}
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
            <div className="info-box player-box">
              {showInfo === 'player' && playerActive && (
                <div className="weak-pop above">
                  <MatchupPanel types={playerActive.getTypes()} />
                  <p className="weak-pop-hint">Toque num tipo para abrir a calculadora.</p>
                </div>
              )}
              <div className="info-name">
                {player.shiny && <PixelIcon name="star" color="#e0a100" />}
                <MonName mon={player} /> <span className="lv">Nv. {player.level}</span>
              </div>
              <div className="row">
                <Types name={player.species} />
                <StatusBadge status={player.status} />
              </div>
              <HpBar hp={player.hp} maxhp={player.maxhp} showNumbers />
              <button className={`weak-btn ${showInfo === 'player' ? 'open' : ''}`} onClick={() => setShowInfo(showInfo === 'player' ? null : 'player')}>
                Fraquezas {showInfo === 'player' ? '▴' : '▾'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="battle-bottom">
        <div className="message">{message}</div>
        <div className="actions">
          {busy ? null : menu === 'main' && !ctl.ended ? (
            <div className="main-actions">
              <button className="btn act fight" onClick={() => setMenu('fight')}>
                <img className="act-icon" src={FX('fist.png')} alt="" /> Lutar
              </button>
              <button className="btn act" onClick={() => setMenu('balls')} disabled={!balls.length || !!enc.trainer} title={enc.trainer ? 'Não dá para capturar o Pokémon de um treinador' : undefined}>
                <img className="act-icon" src={itemSpriteUrl('poke-ball')} alt="" /> Pokébola
              </button>
              <button className="btn act" onClick={() => setMenu('bag')} disabled={!heals.length}>
                <img className="act-icon" src={itemSpriteUrl('potion')} alt="" /> Mochila
              </button>
              <button className="btn act" onClick={() => setMenu('switch')} disabled={!ctl.canSwitch() || party.filter(p => p.hp > 0).length < 2}>
                <img className="act-icon" src={FX('switchright.png')} alt="" /> Trocar
              </button>
              <button className="btn act" onClick={() => finishBattle('fled')} disabled={!ctl.canFlee()}>
                <img className="act-icon" src={itemSpriteUrl('escape-rope')} alt="" /> Fugir
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
                    style={{['--mc' as string]: TYPE_COLORS[m.type]}}
                    onClick={() => act(() => ctl.chooseMove(m.index))}
                  >
                    <span className="move-name">
                      {m.name}
                      <span
                        className="move-info-btn"
                        role="button"
                        title="Detalhes do golpe"
                        onClick={e => {
                          e.stopPropagation();
                          setMoveInfo(m.name);
                        }}
                      >
                        ?
                      </span>
                    </span>
                    <span className="move-meta">
                      <TypeBadge type={m.type} small />
                      <span className="cat">{m.category === 'Physical' ? 'Físico' : m.category === 'Special' ? 'Especial' : 'Status'}</span>
                      {m.basePower > 0 && <span>Poder {m.basePower}</span>}
                      <span>
                        PP {m.pp}/{m.maxpp}
                      </span>
                    </span>
                    <span className="move-desc">{moveDescPt(m.name)}</span>
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
                    if (getItem(id).kind === 'battle') {
                      if (!consume(id)) return;
                      act(() => ctl.useBoostItem(id));
                      return;
                    }
                    setHealItem(id);
                    setMenu('healTarget');
                  }}
                >
                  <ItemIcon id={id} /> {getItem(id).name} x{n} <span className="muted small-desc">{getItem(id).desc}</span>
                </button>
              ))}
              {!heals.length && <p className="hint">Nenhum item de batalha na mochila. Poções, Reviver e itens X aparecem aqui.</p>}
              <button className="btn small back" onClick={() => setMenu('main')}>
                ← Voltar
              </button>
            </div>
          ) : menu === 'healTarget' && healItem ? (
            <div className="list-actions">
              {party
                .filter(p => (getItem(healItem).kind === 'revive' ? p.hp <= 0 : p.hp > 0 && p.hp < p.maxhp))
                .map(p => (
                  <button
                    key={p.uid}
                    className="btn item-btn"
                    onClick={() => {
                      if (!consume(healItem)) return;
                      act(() => ctl.useHealItem(healItem, p.uid));
                    }}
                  >
                    <Sprite name={p.species} size={36} /> {p.species} {p.hp}/{p.maxhp}
                  </button>
                ))}
              <button className="btn small back" onClick={() => setMenu('bag')}>
                ← Voltar
              </button>
            </div>
          ) : menu === 'switch' ? (
            <SwitchMenu ctl={ctl} party={run.party} onPick={uid => act(() => ctl.chooseSwitch(uid))} onBack={ctl.mustSwitch ? undefined : () => setMenu('main')} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SwitchMenu({ctl, party: owned, onPick, onBack}: {ctl: BattleController; party: OwnedMon[]; onPick: (uid: string) => void; onBack?: () => void}) {
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
            <Sprite name={p.species} size={56} />
            <span className="switch-info">
              <span>
                <MonName mon={owned.find(m => m.uid === p.uid) ?? p} /> Nv.{p.level} <StatusBadge status={p.status} />
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
