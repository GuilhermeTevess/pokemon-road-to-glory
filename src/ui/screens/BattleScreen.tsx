import {roundOf, roundsOf} from '../../game/career';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {getBiome} from '../../data/biomes';
import {TYPE_COLORS, species} from '../../data/dex';
import {getItem} from '../../data/items';
import {moveDescPt} from '../../data/movesPt';
import type {BattleController, BattleEvent} from '../../game/battle';
import {isBossWave, isMilestoneWave} from '../../game/encounters';
import {getBattle, useGame} from '../../game/store';
import {ROUND_NAMES, tourName} from '../../game/tournament';
import {getRegion} from '../../data/regions';
import {getGym} from '../../data/gyms';
import {venueName} from '../../game/legend';
import {ArenaBackdrop, GymBackdrop} from '../scene';
import {
  CategoryIcon,
  HpBar,
  ItemIcon,
  MatchupPanel,
  MonName,
  MoveInfo,
  ShinyStar,
  RarityBadge,
  Sprite,
  StatusBadge,
  TypeBadge,
  Types,
  effectivenessLabel,
} from '../components';
import {playBall, playCry, playHit, playJingle, playMove, playPlin, playShake} from '../audio';
import {askLead, fast, setAskLead} from '../settings';
import {asksLead, firstFoes, leadAdvice} from '../../game/lead';
import {FX, playMoveFx, throwBallFx} from '../fx';
import {lineRoot} from '../../game/meta';
import type {OwnedMon} from '../../game/types';
import {Hearts} from './CollectionScreen';
import {maxHp as maxHpOf} from '../../game/mon';
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

type Menu = 'main' | 'fight' | 'bag' | 'balls' | 'switch' | 'healTarget' | 'target';

type Views = (SideView | null)[];
/** Troca a visão de uma posição (0 ou 1) do lado. */
const at = (fn: (v: SideView | null) => SideView | null, slot = 0) => (list: Views): Views => {
  const out = [...list];
  out[slot] = fn(list[slot] ?? null);
  return out;
};
const each = (fn: (v: SideView) => SideView) => (list: Views): Views => list.map(v => (v ? fn(v) : v));

const LOCKED_TIP = 'Seu Pokémon está no meio de um golpe (no ar, embaixo da terra, carregando...) e só pode continuar ele';
const wait = (ms: number) => new Promise(r => setTimeout(r, fast() ? ms * 0.3 : ms));

/** Quem está esperando uma fala terminar; um clique na caixa de texto pula a espera. */
let skipText: (() => void) | null = null;
const waitText = (ms: number) =>
  new Promise<void>(r => {
    const done = () => {
      clearTimeout(t);
      skipText = null;
      r();
    };
    const t = setTimeout(done, fast() ? ms * 0.3 : ms);
    skipText = done;
  });

export function BattleScreen() {
  const run = useGame(s => s.run)!;
  const {finishBattle, consume} = useGame();
  // Antes da luta: mostra quem veio e pergunta "Quer trocar o Pokémon?". A batalha só nasce depois.
  const [ready, setReady] = useState(() => !askLead() || !asksLead(run.encounter, run.party));
  const ctl = useMemo(() => (ready ? getBattle(run) : null), [run.encounter?.mon.uid, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const [players, setPlayers] = useState<Views>([]);
  const [wilds, setWilds] = useState<Views>([]);
  const [targetMove, setTargetMove] = useState<number | null>(null);
  const [ballSlot, setBallSlot] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const [menu, setMenu] = useState<Menu>('main');
  const [healItem, setHealItem] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState<string | null>(null);
  /** Pokébola no lugar do selvagem: número = balançada, 'caught' = fechou. */
  const [ballAnim, setBallAnim] = useState<number | 'caught' | null>(null);
  const [ballId, setBallId] = useState('pokeball');
  const [, force] = useState(0);
  const started = useRef(false);
  const fxRef = useRef<HTMLDivElement>(null);
  const [moveInfo, setMoveInfo] = useState<string | null>(null);
  const [megaOn, setMegaOn] = useState(false);
  const arenaRef = useRef<HTMLDivElement>(null);
  const caughtRef = useRef(false);

  const biome = getBiome(run.encounter?.arena ?? run.biome);
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
      const setterOf = (side: 'p1' | 'p2') => (side === 'p1' ? setPlayers : setWilds);
      for (const ev of events) {
        const slot = ev.slot ?? 0;
        if (ev.switchIn) {
          const s = ev.switchIn;
          if (s.side === 'p1') {
            const mon = lookupPlayer(s.uid);
            setPlayers(at(() => ({
              species: mon?.species ?? s.species, nickname: mon?.nickname, partner: mon?.partner,
              level: mon?.level ?? 1, hp: s.hp, maxhp: s.maxhp, shiny: !!mon?.shiny, anim: 'enter',
            }), slot));
          } else {
            setWilds(at(() => ({species: s.species, level: s.level ?? enc.mon.level, hp: s.hp, maxhp: s.maxhp, shiny: s.shiny ?? enc.mon.shiny, anim: 'enter'}), slot));
          }
          playCry(s.species);
        }
        if (ev.forme) {
          const f = ev.forme;
          setterOf(f.side)(at(v => (v ? {...v, species: f.species, anim: 'enter'} : v), slot));
          playCry(f.species);
          await wait(700);
        }
        if (ev.move) {
          const mv = ev.move;
          if (ev.text) setMessage(ev.text);
          playMove(mv.move);
          setterOf(mv.side)(at(v => (v ? {...v, anim: 'attack'} : v), slot));
          await Promise.all([
            fxRef.current && arenaRef.current && !fast() ? playMoveFx(fxRef.current, arenaRef.current, mv.move, mv.side) : Promise.resolve(),
            wait(450),
          ]);
          setPlayers(each(v => (v.anim === 'attack' ? {...v, anim: undefined} : v)));
          setWilds(each(v => (v.anim === 'attack' ? {...v, anim: undefined} : v)));
          continue;
        }
        if (ev.hit) {
          playHit(ev.hit.effect);
          setterOf(ev.hit.side)(at(v => (v ? {...v, anim: 'hit'} : v), slot));
        }
        if (ev.hp) {
          const h = ev.hp;
          setterOf(h.side)(at(v => (v ? {...v, hp: h.status === 'fnt' ? 0 : h.hp, maxhp: h.status === 'fnt' ? v.maxhp : h.maxhp, status: h.status ?? v.status} : v), slot));
        }
        if (ev.faint) {
          setterOf(ev.faint)(at(v => {
            if (v && ev.faint === 'p1') playCry(v.species);
            return v ? {...v, hp: 0, anim: 'faint'} : v;
          }, slot));
        }
        if (ev.text) {
          setMessage(ev.text);
          // O narrador fala mais devagar, para dar tempo de ler.
          await waitText(ev.narrator ? Math.min(3800, 1400 + ev.text.length * 28) : 850);
        } else if (ev.hp) {
          await wait(350);
        }
        setPlayers(each(v => (v.anim !== 'faint' ? {...v, anim: undefined} : v)));
        setWilds(each(v => (v.anim !== 'faint' ? {...v, anim: undefined} : v)));
      }
      setBusy(false);
      force(x => x + 1);
    },
    [enc, lookupPlayer],
  );
  const player = players[ctl?.slot ?? 0] ?? players.find(Boolean) ?? null;

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
  }, [busy, ctl, finishBattle, player?.species, player?.nickname, player]);

  if (!ready) return <LeadPrompt onDone={() => setReady(true)} />;
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
  // Em dupla: Pokébola só quando sobra um selvagem; itens só na escolha do primeiro Pokémon (gastam o turno dos dois).
  const ballBlock = enc.trainer ? 'Não dá para capturar o Pokémon de um treinador' : ctl.doubles && ctl.foesUp().length > 1 ? 'Na dupla, derrote um selvagem antes de capturar o outro' : ctl.hasPending ? 'Só na escolha do primeiro Pokémon' : ctl.anyLocked() ? LOCKED_TIP : undefined;
  const bagBlock = ctl.hasPending ? 'Só na escolha do primeiro Pokémon' : ctl.anyLocked() ? LOCKED_TIP : undefined;

  const throwBall = async (id: string) => {
    if (!consume(id)) return;
    setMenu('main');
    setBusy(true);
    setBallSlot(Math.max(0, ctl.battle.p2.active.indexOf(ctl.wildActive)));
    const {result, events} = ctl.throwBall(id);
    const ballSrc = itemSpriteUrl(getItem(id).sprite);
    setBallId(id);
    setMessage(`Você jogou uma ${getItem(id).name}!`);
    playBall();
    if (fxRef.current && !fast()) await throwBallFx(fxRef.current, ballSrc);
    setBallAnim(0);
    await wait(400);
    for (let i = 0; i < Math.min(result.shakes, 3); i++) {
      setBallAnim(i + 1);
      playShake();
      await wait(650);
    }
    if (result.caught) {
      // Fecha: estrelinhas e "plin". O Pokémon não reaparece.
      caughtRef.current = true;
      setBallAnim('caught');
      playPlin();
      setMessage(`Gotcha! ${ctl.wildActive.species.name} foi capturado!`);
      await wait(500);
      playJingle('catch');
      await wait(1400);
      finishBattle('caught');
      return;
    }
    setBallAnim(null);
    await play(events.slice(1));
  };

  const tour = run.tournament;
  const header = enc.tournament && tour
    ? `${tourName(tour)} · ${ROUND_NAMES[tour.rounds.length - 1]} · contra ${enc.trainer}`
    : enc.gym
    ? `Ginásio · Líder ${enc.trainer} · ${getGym(enc.gym)?.badge ?? ''}`
    : enc.legend
    ? `${enc.trainer} · Lenda de ${getRegion(run.region).name}`
    : enc.trainer
    ? `Desafio do rival ${enc.trainer}`
    : isMilestoneWave(run.wave)
    ? `Ronda ${roundOf(run)} · Desafio final da etapa`
    : isBossWave(run.wave)
      ? `Ronda ${roundOf(run)} · Chefe de ${getRegion(run.region).name}`
      : `Ronda ${roundOf(run)}/${roundsOf(run)}`;

  return (
    <div className="screen battle-screen">
      {moveInfo && <MoveInfo move={moveInfo} onClose={() => setMoveInfo(null)} />}
      <div className="battle-sub">
        <div className="battle-left">
          <span className="battle-tag">{header}</span>
          {partner && (
            <div className="partner-corner" title="Seu parceiro nesta run">
              <Sprite name={partner.species} shiny={partner.shiny} size={36} still />
              <span>
                <MonName mon={partner} />
                <Hearts entry={collection.entries[lineRoot(partner.species)]} small />
              </span>
            </div>
          )}
        </div>
        <div className="arena-biome" style={{['--bc' as string]: biome.color}}>
          {enc?.tournament && run.tournament ? tourName(run.tournament) : enc?.venue != null ? venueName(enc.venue, getRegion(run.region).name) : (
            <>
              {run.region ? `${getRegion(run.region).name} · ` : ''}
              {enc?.gym ? `Ginásio de ${enc.trainer}` : biome.name}
            </>
          )}
        </div>
        <span className="battle-tag money">₽ {run.money}</span>
      </div>
      <div className={`arena ${ctl.doubles ? 'doubles' : ''}`} ref={arenaRef} style={{backgroundColor: biome.color}}>
        {enc?.venue != null ? (
          <ArenaBackdrop tier={enc.venue} color={biome.color} bg={biome.bg} filter={biome.filter} />
        ) : enc?.gym && getGym(enc.gym) ? (
          <GymBackdrop gym={getGym(enc.gym)!} crowd={!!enc.intro?.[0]?.startsWith('🎙️')} />
        ) : (
          <div className="arena-bg" style={{backgroundImage: `url(${FX(`bg/${biome.bg}.png`)})`, filter: biome.filter}} />
        )}
        <div className="fx-layer" ref={fxRef} />
        {wilds.map((wild, i) =>
          wild ? (
            <div key={`w${i}`} className="slot-group">
              <div className={`info-box wild-box s${i}`}>
                <div className="info-name">
                  {species(wild.species).name}{wild.shiny && <ShinyStar />} <span className="lv">Nv. {wild.level}</span>
                </div>
                <div className="row">
                  <Types name={wild.species} />
                  {enc.team && !enc.double ? (
                    <span className="foe-balls" title="Pokémon do treinador ainda de pé">
                      {ctl.foeStatus().map((up, j) => (
                        <i key={j} className={up ? 'up' : 'down'} />
                      ))}
                    </span>
                  ) : (
                    !ctl.doubles && <RarityBadge rarity={enc.rarity} />
                  )}
                  <StatusBadge status={wild.status} />
                </div>
                <HpBar hp={wild.hp} maxhp={wild.maxhp} />
                <button className={`weak-btn ${showInfo === `w${i}` ? 'open' : ''}`} onClick={() => setShowInfo(showInfo === `w${i}` ? null : `w${i}`)}>
                  Fraquezas {showInfo === `w${i}` ? '▴' : '▾'}
                </button>
                {showInfo === `w${i}` && (
                  <div className="weak-pop below">
                    <MatchupPanel types={[...species(wild.species).types]} />
                    <p className="weak-pop-hint">Toque num tipo para abrir a calculadora.</p>
                  </div>
                )}
              </div>
              <div className={`mon-slot wild-slot s${i} ${wild.anim ?? ''} ${enc.boss ? 'boss' : ''}`}>
                {ballAnim !== null && ballSlot === i ? (
                  <span className={`ball-wrap ${ballAnim === 'caught' ? 'caught' : ''}`}>
                    <img className={`ball-sprite shake-${ballAnim}`} src={itemSpriteUrl(getItem(ballId).sprite)} alt={getItem(ballId).name} />
                    {ballAnim === 'caught' && (
                      <span className="catch-stars">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </span>
                ) : (
                  <Sprite name={wild.species} shiny={wild.shiny} />
                )}
              </div>
            </div>
          ) : null,
        )}
        {players.map((pv, i) =>
          pv ? (
            <div key={`p${i}`} className="slot-group">
              <div className={`mon-slot player-slot s${i} ${pv.anim ?? ''} ${ctl.doubles && !busy && ctl.slot === i ? 'choosing' : ''}`}>
                <Sprite name={pv.species} back shiny={pv.shiny} />
              </div>
              <div className={`info-box player-box s${i}`}>
                {showInfo === `p${i}` && (
                  <div className="weak-pop above">
                    <MatchupPanel types={[...species(pv.species).types]} />
                    <p className="weak-pop-hint">Toque num tipo para abrir a calculadora.</p>
                  </div>
                )}
                <div className="info-name">
                  <MonName mon={pv} /> <span className="lv">Nv. {pv.level}</span>
                </div>
                <div className="row">
                  <Types name={pv.species} />
                  <StatusBadge status={pv.status} />
                </div>
                <HpBar hp={pv.hp} maxhp={pv.maxhp} showNumbers />
                <button className={`weak-btn ${showInfo === `p${i}` ? 'open' : ''}`} onClick={() => setShowInfo(showInfo === `p${i}` ? null : `p${i}`)}>
                  Fraquezas {showInfo === `p${i}` ? '▴' : '▾'}
                </button>
              </div>
            </div>
          ) : null,
        )}
      </div>

      <div className="battle-bottom">
        <div className={`message ${message.startsWith('🎙️') ? 'narrator' : ''}`} onClick={() => skipText?.()} title="Clique para pular a fala">
          {message}
        </div>
        <div className="actions">
          {busy ? null : menu === 'main' && !ctl.ended ? (
            <div className="main-actions">
              <button className="btn act fight" onClick={() => setMenu('fight')}>
                <img className="act-icon" src={FX('fist.png')} alt="" /> Lutar
              </button>
              <button className="btn act" onClick={() => setMenu('balls')} disabled={!balls.length || !!ballBlock} title={ballBlock}>
                <img className="act-icon" src={itemSpriteUrl('poke-ball')} alt="" /> Pokébola
              </button>
              <button className="btn act" onClick={() => setMenu('bag')} disabled={!heals.length || !!bagBlock} title={bagBlock}>
                <img className="act-icon" src={itemSpriteUrl('potion')} alt="" /> Mochila
              </button>
              <button className="btn act" onClick={() => setMenu('switch')} disabled={!ctl.canSwitch() || party.filter(p => p.hp > 0).length < 2}>
                <img className="act-icon" src={FX('switchright.png')} alt="" /> Trocar
              </button>
              <button className="btn act" onClick={() => finishBattle('fled')} disabled={!ctl.canFlee()}>
                <img className="act-icon" src={itemSpriteUrl('escape-rope')} alt="" /> Fugir
              </button>
              {ctl.hasPending && (
                <button
                  className="btn small back"
                  onClick={() => {
                    ctl.undoChoice();
                    force(x => x + 1);
                  }}
                >
                  ← Mudar a escolha do Pokémon anterior
                </button>
              )}
            </div>
          ) : menu === 'fight' ? (
            <div className="move-grid">
              {ctl.canMega() && run.career?.rules.megas !== false && (
                <button className={`mega-toggle ${megaOn ? 'on' : ''}`} onClick={() => setMegaOn(v => !v)}>
                  <span className="mega-box">{megaOn ? '✓' : ''}</span> Mega evoluir → <MonName mon={{species: ctl.canMega()!}} />
                </button>
              )}
              {moves.map(m => {
                const eff = effectivenessLabel(m.effectiveness);
                return (
                  <button
                    key={m.id + m.index}
                    className="move-btn"
                    title={moveDescPt(m.name)}
                    disabled={m.disabled || (!m.locked && m.pp <= 0)}
                    style={{['--mc' as string]: TYPE_COLORS[m.type]}}
                    onClick={() => {
                      if (m.needsTarget) {
                        setTargetMove(m.index);
                        setMenu('target');
                      } else act(() => ctl.chooseMove(m.index, megaOn));
                    }}
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
                      {eff && (
                        <span className={`eff ${eff.cls}`} title={eff.text}>
                          {eff.text.replace('Super efetivo', 'Super').replace('Pouco efetivo', 'Fraco').replace('Efeito normal', 'Normal')}
                        </span>
                      )}
                    </span>
                    <span className="move-meta">
                      <TypeBadge type={m.type} small />
                      <CategoryIcon category={m.category} />
                      {m.basePower > 0 && <span>Poder {m.basePower}</span>}
                      {m.locked ? <span>Continua o golpe</span> : <span>PP {m.pp}/{m.maxpp}</span>}
                    </span>
                    <span className="move-desc">{moveDescPt(m.name)}</span>
                  </button>
                );
              })}
              <button className="btn small back" onClick={() => setMenu('main')}>
                ← Voltar
              </button>
            </div>
          ) : menu === 'target' && targetMove !== null ? (
            <div className="list-actions">
              <p className="hint">Em quem?</p>
              {ctl.targetOptions(targetMove).map(t => {
                const eff = effectivenessLabel(t.effectiveness);
                return (
                  <button key={t.loc} className="btn item-btn" onClick={() => act(() => ctl.chooseMove(targetMove, megaOn, t.loc))}>
                    <Sprite name={t.species} size={40} /> {species(t.species).name}
                    {eff && <span className={`eff ${eff.cls}`}>{eff.text}</span>}
                  </button>
                );
              })}
              <button className="btn small back" onClick={() => setMenu('fight')}>
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

/** Quem veio, os tipos e as fraquezas dele, e "Quer trocar o Pokémon?" antes da luta começar. */
function LeadPrompt({onDone}: {onDone: () => void}) {
  const run = useGame(s => s.run)!;
  const setLead = useGame(s => s.setLead);
  const enc = run.encounter!;
  const [picking, setPicking] = useState(false);
  const [always, setAlways] = useState(askLead());
  const foes = firstFoes(enc);
  const foeNames = foes.map(f => species(f.species).name);
  const alive = run.party.filter(m => m.hp > 0);
  const lead = alive[0];
  const mate = enc.double ? alive[1] : undefined;
  const advice = new Map(alive.map(m => [m.uid, leadAdvice(m, foes.map(f => f.species))]));
  const best = [...alive].sort((a, b) => advice.get(b.uid)!.score - advice.get(a.uid)!.score)[0];
  const bestIsGood = advice.get(best.uid)!.score > advice.get(lead.uid)!.score + 0.5;
  const biome = getBiome(enc.arena ?? run.biome);

  const title = enc.trainer
    ? `${enc.trainer} vai começar com ${foeNames[0]}!`
    : enc.double
      ? `Dois selvagens apareceram: ${foeNames.join(' e ')}!`
      : enc.boss
        ? `O chefe ${foeNames[0]} apareceu!`
        : `Um ${foeNames[0]} selvagem apareceu!`;

  const finish = (uid?: string) => {
    if (uid && uid !== run.party[0]?.uid) setLead(uid);
    setAskLead(always);
    onDone();
  };

  const tips = (m: OwnedMon) => {
    const a = advice.get(m.uid)!;
    const out: {text: string; cls: string}[] = [];
    if (a.attack >= 2) out.push({text: `${a.move} é super efetivo ${a.attack >= 4 ? '4x' : '2x'}`, cls: a.attack >= 4 ? 'eff-4' : 'eff-2'});
    else if (a.attack === 0) out.push({text: 'Seus golpes não pegam nele', cls: 'eff-0'});
    else if (a.attack < 1) out.push({text: 'Golpes pouco efetivos', cls: 'eff-h'});
    if (a.defend >= 2) out.push({text: `Toma dano ${a.defend >= 4 ? '4x' : 'dobrado'} dele`, cls: 'eff-4'});
    else if (a.defend < 1) out.push({text: 'Resiste aos tipos dele', cls: 'eff-h'});
    if (!out.length) out.push({text: 'Neutro', cls: 'eff-1'});
    return out;
  };

  const leadName = (m: OwnedMon) => m.nickname || species(m.species).name;

  return (
    <div className="screen battle-screen lead-prompt">
      <div className="lead-foe panel" style={{['--bc' as string]: biome.color}}>
        <h2>{title}</h2>
        <div className="lead-foes">
          {foes.map(f => (
            <div key={f.uid} className="lead-foe-card">
              <Sprite name={f.species} shiny={f.shiny} size={96} />
              <div className="lead-foe-name">
                {species(f.species).name}
                {f.shiny && <ShinyStar />} <span className="lv">Nv. {f.level}</span>
              </div>
              <div className="row">
                {species(f.species).types.map(t => (
                  <TypeBadge key={t} type={t} info />
                ))}
              </div>
              <MatchupPanel types={[...species(f.species).types]} title="Fraquezas dele" />
            </div>
          ))}
        </div>
        {enc.team && !enc.double && enc.team.length > 1 && (
          <p className="hint">
            O time tem {enc.team.length} Pokémon. Você só vê quem entra primeiro.
          </p>
        )}
        <p className="hint">Toque num tipo para abrir a calculadora de tipos.</p>
      </div>

      <div className="battle-bottom lead-ask">
        {!picking ? (
          <>
            <div className="lead-current">
              <Sprite name={lead.species} shiny={lead.shiny} size={56} still />
              <div>
                <div>
                  Vai entrar: <strong>{leadName(lead)}</strong>
                  {mate && (
                    <>
                      {' '}e <strong>{leadName(mate)}</strong>
                    </>
                  )}
                </div>
                <div className="row wrap">
                  {tips(lead).map(t => (
                    <span key={t.text} className={`eff ${t.cls}`}>
                      {t.text}
                    </span>
                  ))}
                </div>
                {bestIsGood && best.uid !== lead.uid && (
                  <div className="lead-tip">
                    💡 Dica: {leadName(best)} tem vantagem de tipo aqui.
                  </div>
                )}
              </div>
            </div>
            <p className="lead-q">Quer trocar o Pokémon?</p>
            <div className="row lead-buttons">
              <button className="btn primary" onClick={() => setPicking(true)}>
                Sim, escolher outro
              </button>
              <button className="btn" onClick={() => finish()}>
                Não, lutar com {leadName(lead)}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="lead-q">Quem começa a luta{enc.double ? ' (o outro entra junto, ao lado)' : ''}?</p>
            <div className="switch-list">
              {alive.map(m => (
                <button key={m.uid} className={`switch-btn ${m.uid === lead.uid ? 'active' : ''}`} onClick={() => finish(m.uid)}>
                  <Sprite name={m.species} shiny={m.shiny} size={56} />
                  <span className="switch-info">
                    <span>
                      <MonName mon={m} /> Nv.{m.level}
                      {m.uid === best.uid && bestIsGood && <span className="lead-best"> 👍 Boa escolha</span>}
                    </span>
                    <Types name={m.species} />
                    <HpBar hp={m.hp} maxhp={maxHpOf(m)} showNumbers />
                    <span className="row wrap">
                      {tips(m).map(t => (
                        <span key={t.text} className={`eff ${t.cls}`}>
                          {t.text}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              ))}
              <button className="btn small back" onClick={() => setPicking(false)}>
                ← Voltar
              </button>
            </div>
          </>
        )}
        <label className="lead-always">
          <input type="checkbox" checked={always} onChange={e => setAlways(e.target.checked)} /> Perguntar antes de toda luta
          <span className="muted"> (dá para ligar de novo no Painel, aba Time)</span>
        </label>
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
