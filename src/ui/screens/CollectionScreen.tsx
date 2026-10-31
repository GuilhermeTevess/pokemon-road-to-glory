// Coleção do treinador: cabeçalho com números, grade das linhas evolutivas e a
// ficha de cada linha (doces, corações, IVs, natures, habilidades, golpe inicial).
import {useEffect, useMemo, useState} from 'react';
import type {Species} from '@pkmn/sim';
import {ALL_TYPES, TYPE_COLORS, dex, species} from '../../data/dex';
import {
  ALL_NATURES, CANDY, COST_CUT_PRICE, EV_MAX_STAT, EV_MAX_TOTAL, EV_PRESETS, EV_RESET_PRICE, HEART_PERKS, TUTOR_PLANS, evTotal, lineAbilities, lineMegaStones, MEGA_STONE_PRICE, tutorPrice, HEART_STEPS, MAX_COST_CUT, SHINY_CHANCE, SHINY_PRICE,
  baseCost, favoriteOf, heartProgress, heartsOf, lineRoot, lineSpecies, movePrice, peekEntry, startMoveOptions, statsOf, teamCost,
} from '../../game/meta';
import type {CollectionEntry, Entry} from '../../game/meta';
import {NICK_MAX} from '../../game/mon';
import {useGame} from '../../game/store';
import {STAT_IDS, STAT_LABEL} from '../../game/types';
import type {StatId} from '../../game/types';
import {IvWeb, ItemIcon, Modal, MoveInfo, PixelIcon, ShinyStar, Sprite, TypeBadge, TypeFilter, Types} from '../components';
import {playCry} from '../audio';
import {TrainerAvatar} from './StartScreens';
import {CareerCard} from './TournamentScreen';

const candyColor = (line: string) => TYPE_COLORS[species(line).types[0]] ?? '#e0b43a';

const CANDY_HOW = `Como ganhar doces: capturar +${CANDY.catch} (repetido +${CANDY.duplicate}) · vencer lutando +${CANDY.defeat} · chefe ou treinador +${CANDY.boss} · evoluir +${CANDY.evolve}`;

export function Candies({line, n}: {line: string; n: number}) {
  return (
    <span className="candies" title={`Doces de ${species(lineRoot(line)).name}. ${CANDY_HOW}`}>
      <PixelIcon name="candy" size={16} color={candyColor(lineRoot(line))} />
      {n}
    </span>
  );
}

/** Doces com um balãozinho (toque ou mouse) explicando como ganhar mais. */
function CandyInfo({line, n}: {line: string; n: number}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="candy-info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="link candy-btn" onClick={() => setOpen(o => !o)}>
        <Candies line={line} n={n} /> doces
      </button>
      {open && (
        <span className="candy-pop">
          <b>Como ganhar</b>
          <span>Capturar: +{CANDY.catch} (repetido +{CANDY.duplicate})</span>
          <span>Vencer lutando: +{CANDY.defeat}</span>
          <span>Chefe ou treinador: +{CANDY.boss}</span>
          <span>Evoluir: +{CANDY.evolve}</span>
        </span>
      )}
    </span>
  );
}

export function Hearts({entry, small}: {entry: CollectionEntry | undefined; small?: boolean}) {
  const h = heartsOf(entry);
  const prog = heartProgress(entry);
  return (
    <span className={`hearts ${small ? 'small' : ''}`} title={`${h} de 5 corações de amizade`}>
      {!small && h < HEART_STEPS.length && <span className="heart-next">{Math.round(prog * 100)}% para o próximo</span>}
      {HEART_STEPS.map((_, i) => (
        <span key={i} className={`heart ${i < h ? 'full' : ''}`}>
          <PixelIcon name="heart" size={small ? 12 : 18} color={i < h ? 'var(--pink-d)' : '#d9d0e6'} />
        </span>
      ))}
    </span>
  );
}

/** Sprite com setinhas para passar pela linha evolutiva. */
export function EvoViewer({name, shiny, onChange}: {name: string; shiny?: boolean; onChange?: (s: Species) => void}) {
  const line = useMemo(() => lineSpecies(name), [name]);
  const start = Math.max(0, line.findIndex(s => s.name === species(name).name));
  const [i, setI] = useState(start);
  useEffect(() => setI(start), [name, start]);
  const cur = line[Math.min(i, line.length - 1)];
  useEffect(() => onChange?.(cur), [cur, onChange]);
  const go = (d: number) => {
    const next = (i + d + line.length) % line.length;
    setI(next);
    playCry(line[next].name);
  };
  return (
    <div className="evo-viewer">
      <button className="evo-arrow" onClick={() => go(-1)} disabled={line.length < 2} aria-label="Evolução anterior">
        ‹
      </button>
      <div className="evo-center">
        <Sprite name={cur.name} shiny={shiny} className="big" />
        <div className="evo-name">{cur.name}</div>
        {line.length > 1 && (
          <div className="evo-dots">
            {line.map((s, k) => (
              <button key={s.id} className={`evo-dot ${k === i ? 'on' : ''}`} onClick={() => setI(k)} title={s.name} />
            ))}
          </div>
        )}
      </div>
      <button className="evo-arrow" onClick={() => go(1)} disabled={line.length < 2} aria-label="Próxima evolução">
        ›
      </button>
    </div>
  );
}

function natureLabel(n: string): string {
  const nat = dex.natures.get(n);
  if (!nat.plus || !nat.minus) return `${n} (neutra)`;
  const short = (s: string) => STAT_LABEL[s as StatId].replace('Velocidade', 'Vel.');
  return `${n} (+${short(nat.plus)} −${short(nat.minus)})`;
}

const NAT_STATS: StatId[] = ['atk', 'def', 'spa', 'spd', 'spe'];
const NAT_SHORT: Record<string, string> = {atk: 'Atq', def: 'Def', spa: 'At.Esp', spd: 'Df.Esp', spe: 'Vel'};
/** Nature de cada célula: linha = atributo que sobe, coluna = atributo que desce. */
const NATURE_AT: Record<string, string> = {};
for (const n of ALL_NATURES) {
  const nat = dex.natures.get(n);
  if (nat.plus && nat.minus) NATURE_AT[`${nat.plus}-${nat.minus}`] = n;
}
/** Neutras na diagonal, na ordem tradicional da tabela. */
const NEUTRAL = ['Hardy', 'Docile', 'Bashful', 'Quirky', 'Serious'];

/** Tabela das natures: linhas = sobe, colunas = desce. Verde = liberada, estrela = equipada. */
function NatureGrid({e, selected, onPick}: {e: Entry; selected: string | null; onPick: (n: string) => void}) {
  const cell = (n: string) => {
    const owned = e.natures.includes(n);
    return (
      <button
        key={n}
        className={`nat-cell ${owned ? 'owned' : ''} ${e.nature === n ? 'equipped' : ''} ${selected === n ? 'sel' : ''}`}
        onClick={() => onPick(n)}
        title={natureLabel(n)}
      >
        {e.nature === n && '★ '}
        {n}
      </button>
    );
  };
  return (
    <div className="nat-grid-wrap">
      <table className="nat-grid">
        <thead>
          <tr>
            <th className="nat-corner">
              <span className="up">▲ sobe</span>
              <span className="down">▼ desce</span>
            </th>
            {NAT_STATS.map(st => (
              <th key={st} className="down">
                ▼ {NAT_SHORT[st]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NAT_STATS.map(up => (
            <tr key={up}>
              <th className="up">▲ {NAT_SHORT[up]}</th>
              {NAT_STATS.map(down => (
                <td key={down}>{up === down ? cell(NEUTRAL[NAT_STATS.indexOf(up)]) : cell(NATURE_AT[`${up}-${down}`])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint small">Na diagonal ficam as neutras (não mexem em nada). Verde = já tem. Toque para equipar ou pedir ao Tutor.</p>
    </div>
  );
}

/** Aba Treinar: natures (tabela), habilidades pelo Tutor e EVs. */
function TrainPanel({root}: {root: string}) {
  const {collection, tutor, equipNature, equipAbility} = useGame();
  const e = peekEntry(collection, root);
  const [kind, setKind] = useState<'nature' | 'ability' | 'evs'>('nature');
  const [target, setTarget] = useState<string | null>(null);
  const [result, setResult] = useState('');
  useEffect(() => (setTarget(null), setResult('')), [root]);
  if (!e) return null;
  const abilities = lineAbilities(root);
  const owned = kind === 'nature' ? e.natures.includes(target ?? '') : e.abilities.includes(target ?? '');
  const hidden = kind === 'ability' && abilities.find(a => a.name === target)?.hidden;
  const pick = (k: 'nature' | 'ability', name: string) => {
    setResult('');
    if (k === 'nature' ? e.natures.includes(name) : e.abilities.includes(name)) {
      if (k === 'nature') equipNature(root, e.nature === name ? null : name);
      else equipAbility(root, e.ability === name ? null : name);
      setTarget(null);
    } else setTarget(name);
  };
  return (
    <div className="train-panel">
      <div className="train-head">
        <Sprite name={species(root).name} shiny={e.shiny} size={48} still />
        <b>Treinar {species(root).name}</b>
        <CandyInfo line={root} n={e.candies} />
      </div>
      <div className="tabs">
        <button className={`tab ${kind === 'nature' ? 'active' : ''}`} onClick={() => (setKind('nature'), setTarget(null))}>
          Natures
        </button>
        <button className={`tab ${kind === 'ability' ? 'active' : ''}`} onClick={() => (setKind('ability'), setTarget(null))}>
          Habilidades
        </button>
        <button className={`tab ${kind === 'evs' ? 'active' : ''}`} onClick={() => (setKind('evs'), setTarget(null))}>
          EVs
        </button>
      </div>
      {kind === 'nature' && <NatureGrid e={e} selected={target} onPick={n => pick('nature', n)} />}
      {kind === 'ability' && (
        <div className="ability-list">
          {abilities.map(a => {
            const has = e.abilities.includes(a.name);
            return (
              <button
                key={a.name}
                className={`ability-row ${has ? 'owned' : ''} ${e.ability === a.name ? 'equipped' : ''} ${target === a.name ? 'sel' : ''}`}
                onClick={() => pick('ability', a.name)}
              >
                <b>
                  {e.ability === a.name && '★ '}
                  {a.name}
                  {a.hidden && <small> (oculta)</small>}
                </b>
                <span className="muted">{dex.abilities.get(a.name).shortDesc}</span>
              </button>
            );
          })}
        </div>
      )}
      {kind === 'evs' && <EvBox root={root} e={e} />}
      {target && !owned && kind !== 'evs' && (
        <div className="panel tutor-plans">
          <b>Tutor: tentar {kind === 'nature' ? natureLabel(target) : target}</b>
          <span className="hint small">Se não sair, você ganha outra que ainda não tem.</span>
          <div className="row center wrap">
            {TUTOR_PLANS.map(p => {
              const price = tutorPrice(root, kind, target, p.id);
              if (price === null) return null;
              return (
                <button
                  key={p.id}
                  className="btn small"
                  disabled={e.candies < price}
                  onClick={() => {
                    setResult(tutor(root, kind, target, p.id));
                    setTarget(null);
                  }}
                >
                  {p.name} · {Math.round(p.chance * 100)}% · <Candies line={root} n={price} />
                </button>
              );
            })}
          </div>
          {hidden && <span className="hint small">Habilidade oculta: só no plano Garantido.</span>}
        </div>
      )}
      {result && <p className="tutor-result">{result}</p>}
    </div>
  );
}

function EvBox({root, e}: {root: string; e: Entry}) {
  const {allocateEv, resetLineEvs, presetEvs} = useGame();
  const total = evTotal(e.evs);
  return (
    <section className="ev-box">
      <p className="hint small">Vitórias enchem o banco. Até {EV_MAX_STAT} por atributo e {EV_MAX_TOTAL} no total.</p>
      <div className="ev-bank">
        Banco: <b>{e.evBank}</b> · Distribuídos: {total}/{EV_MAX_TOTAL}
      </div>
      <div className="ev-rows">
        {STAT_IDS.map(st => (
          <div key={st} className="ev-row">
            <span className="ev-label">{STAT_LABEL[st]}</span>
            <div className="bs-track">
              <div className={`bs-fill bs-${st}`} style={{width: `${(e.evs[st] / EV_MAX_STAT) * 100}%`}} />
            </div>
            <span className="ev-val">{e.evs[st]}</span>
            <button className="btn small" disabled={!e.evBank || e.evs[st] >= EV_MAX_STAT} onClick={() => allocateEv(root, st, 4)}>
              +4
            </button>
            <button className="btn small" disabled={!e.evBank || e.evs[st] >= EV_MAX_STAT} onClick={() => allocateEv(root, st, EV_MAX_STAT)}>
              Máx
            </button>
          </div>
        ))}
      </div>
      <div className="chips">
        {EV_PRESETS.map((p, i) => (
          <button
            key={p.name}
            className="chip"
            title={p.desc}
            disabled={total > 0 ? e.candies < EV_RESET_PRICE : !e.evBank}
            onClick={() => presetEvs(root, i)}
          >
            {p.name}
            <small className="species-sub">{p.desc}</small>
          </button>
        ))}
      </div>
      <div className="row center">
        <button className="btn small" disabled={!total || e.candies < EV_RESET_PRICE} onClick={() => resetLineEvs(root)}>
          Redistribuir (volta tudo pro banco) · <Candies line={root} n={EV_RESET_PRICE} />
        </button>
      </div>
      {total > 0 && <p className="hint">Usar uma sugestão quando já tem EVs distribuídos também custa {EV_RESET_PRICE} doces.</p>}
    </section>
  );
}

/** Painel do Pokémon (ficha da linha): visual, apelido, corações, IVs, golpe inicial e melhorias. */
export function PokemonPanel({line, onTrain}: {line: string; onTrain?: () => void}) {
  const {collection, setNickname, unlockMove, equipMove, buyCostCut, buyShiny, setFavorite, buyMegaStone, setShinyPref} = useGame();
  const root = lineRoot(line);
  const e = peekEntry(collection, root);
  const [view, setView] = useState<Species>(species(root));
  const [moveFilter, setMoveFilter] = useState<'type' | 'all'>('type');
  const [info, setInfo] = useState<string | null>(null);
  const [nick, setNick] = useState(collection.entries[root]?.nickname ?? '');
  useEffect(() => setNick(collection.entries[root]?.nickname ?? ''), [root]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = useMemo(() => startMoveOptions(root), [root]);
  const stones = useMemo(() => lineMegaStones(root), [root]);
  if (!e) return null;
  const types = species(root).types as string[];
  const shownMoves = options.filter(o => !e.moves.includes(o.id) && (moveFilter === 'all' || types.includes(dex.moves.get(o.id).type)));
  const fav = favoriteOf(collection) === root;
  const cost = teamCost(collection, root);
  const h = heartsOf(e);
  return (
    <div className="mon-panel">
      <EvoViewer name={root} shiny={e.shiny} onChange={setView} />
      <div className="row center">
        {view.types.map(t => (
          <TypeBadge key={t} type={t} info />
        ))}
      </div>
      <form
        className="rename"
        onSubmit={ev => {
          ev.preventDefault();
          setNickname(root, nick);
        }}
      >
        <input value={nick} maxLength={NICK_MAX} onChange={ev => setNick(ev.target.value)} placeholder="Apelido" />
        <button className="btn small" type="submit" disabled={(e.nickname ?? '') === nick.trim()}>
          Salvar
        </button>
      </form>
      <div className="sheet-numbers">
        <CandyInfo line={root} n={e.candies} />
        <span>{e.caught ? `Capturado ${e.caught}x` : 'Inicial'}</span>
        <span>Custo {cost}</span>
      </div>
      <div className="hearts-line" title={HEART_PERKS.map((p, i) => `${i + 1}: ${p}`).join('\n')}>
        <Hearts entry={e} />
        <span className="hint small">{h ? `Bônus: ${HEART_PERKS.slice(0, h).join(' · ')}` : 'Lute com ele no time para ganhar corações.'}</span>
      </div>
      <div className="row center wrap">
        {onTrain && (
          <button className="btn small primary" onClick={onTrain}>
            Treinar
          </button>
        )}
        <button className={`btn small ${fav ? 'fav-on' : ''}`} onClick={() => setFavorite(fav ? null : root)}>
          <PixelIcon name="star" /> {fav ? 'Favorito' : 'Tornar favorito'}
        </button>
      </div>
      <dl className="mon-facts">
        <dt>Nature</dt>
        <dd>{e.nature ? natureLabel(e.nature) : 'aleatória'}</dd>
        <dt>Habilidade</dt>
        <dd>{e.ability ?? 'aleatória'}</dd>
        <dt>EVs</dt>
        <dd>
          {evTotal(e.evs)}/{EV_MAX_TOTAL}
          {e.evBank ? ` (+${e.evBank} no banco)` : ''}
        </dd>
      </dl>
      <div className="sheet-right">
        <section>
          <h3>IVs</h3>
          {e.caught ? (
            <IvWeb before={e.bestIvs} after={e.bestIvs} size={200} />
          ) : (
            <p className="hint small">Capture um selvagem para guardar os IVs. Repetidos melhoram a teia.</p>
          )}
        </section>
        <section>
          <h3>Golpe inicial</h3>
          <p className="hint small">Libere com doces: ele começa a run já sabendo.</p>
          {e.moves.length > 0 && (
            <div className="chips">
              <button className={`chip ${!e.startMove ? 'active' : ''}`} onClick={() => equipMove(root, null)}>
                Nenhum
              </button>
              {e.moves.map(m => (
                <button key={m} className={`chip ${e.startMove === m ? 'active' : ''}`} onClick={() => equipMove(root, m)}>
                  {dex.moves.get(m).name}
                </button>
              ))}
            </div>
          )}
          <div className="tabs">
            <button className={`tab ${moveFilter === 'type' ? 'active' : ''}`} onClick={() => setMoveFilter('type')}>
              Do tipo dele
            </button>
            <button className={`tab ${moveFilter === 'all' ? 'active' : ''}`} onClick={() => setMoveFilter('all')}>
              Todos
            </button>
          </div>
          <ul className="unlock-list">
            {shownMoves.map(o => {
              const m = dex.moves.get(o.id);
              const price = movePrice(o.id);
              return (
                <li key={o.id}>
                  <TypeBadge type={m.type} small />
                  <button className="link" onClick={() => setInfo(o.id)}>
                    {m.name}
                  </button>
                  <span className="hint">
                    {m.basePower ? `Poder ${m.basePower}` : 'Status'} · {o.how === 'level' ? 'nível' : 'MT/tutor'}
                  </span>
                  <button className="btn small" disabled={e.candies < price} onClick={() => unlockMove(root, o.id)}>
                    <Candies line={root} n={price} />
                  </button>
                </li>
              );
            })}
            {!shownMoves.length && <li className="hint">Nada para liberar aqui.</li>}
          </ul>
        </section>
        <section>
          <h3>Melhorias da linha</h3>
          <ul className="unlock-list">
            <li>
              <span>
                Custo no time: <b>{cost}</b>
                {e.costCut > 0 && <span className="hint"> (era {baseCost(root)})</span>}
              </span>
              {e.costCut < MAX_COST_CUT && cost > 1 ? (
                <button className="btn small" disabled={e.candies < COST_CUT_PRICE[e.costCut]} onClick={() => buyCostCut(root)}>
                  −1 custo · <Candies line={root} n={COST_CUT_PRICE[e.costCut]} />
                </button>
              ) : (
                <span className="hint">no mínimo</span>
              )}
            </li>
            {e.shiny ? (
              <li>
                <span>
                  <ShinyStar /> Você já tem o shiny! Começar a run com a cor:
                </span>
                <span className="row">
                  <button className={`btn small ${!e.shinyOff ? 'primary' : ''}`} onClick={() => setShinyPref(root, false)}>
                    Shiny
                  </button>
                  <button className={`btn small ${e.shinyOff ? 'primary' : ''}`} onClick={() => setShinyPref(root, true)}>
                    Normal
                  </button>
                </span>
              </li>
            ) : (
            <li>
              <span>
                Chance de shiny ao começar: <b>1 em {Math.round(1 / SHINY_CHANCE[e.shinyLv])}</b>
              </span>
              {e.shinyLv < SHINY_PRICE.length ? (
                <button className="btn small" disabled={e.candies < SHINY_PRICE[e.shinyLv]} onClick={() => buyShiny(root)}>
                  Aumentar · <Candies line={root} n={SHINY_PRICE[e.shinyLv]} />
                </button>
              ) : (
                <span className="hint">no máximo</span>
              )}
            </li>
            )}
            {stones.length > 0 && (
              <li>
                <span>
                  Começar com a Mega Pedra própria
                  <small className="species-sub">Funciona quando ele estiver na forma que mega-evolui. Só 1 mega por time.</small>
                </span>
                {stones.map(st => (
                  <button
                    key={st.id}
                    className={`btn small ${e.megaStone === st.id ? 'fav-on' : ''}`}
                    disabled={!e.megaStone && e.candies < MEGA_STONE_PRICE}
                    onClick={() => buyMegaStone(root, st.id)}
                    title={st.desc}
                  >
                    <ItemIcon id={st.id} size={18} /> {st.name}
                    {!e.megaStone && (
                      <>
                        {' · '}
                        <Candies line={root} n={MEGA_STONE_PRICE} />
                      </>
                    )}
                  </button>
                ))}
              </li>
            )}
          </ul>
        </section>
      </div>
      {info && <MoveInfo move={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

/** Ficha em janela (usada na montagem do time). */
export function LineSheet({line, onClose}: {line: string; onClose: () => void}) {
  const [tab, setTab] = useState<'mon' | 'train'>('mon');
  return (
    <Modal onClose={onClose} wide>
      <div className="tabs">
        <button className={`tab ${tab === 'mon' ? 'active' : ''}`} onClick={() => setTab('mon')}>
          Pokémon
        </button>
        <button className={`tab ${tab === 'train' ? 'active' : ''}`} onClick={() => setTab('train')}>
          Treinar
        </button>
      </div>
      {tab === 'mon' ? <PokemonPanel line={line} onTrain={() => setTab('train')} /> : <TrainPanel root={lineRoot(line)} />}
    </Modal>
  );
}

function TrainerHeader() {
  const {collection, trainer} = useGame();
  if (!trainer) return null;
  const st = statsOf(structuredClone(collection));
  const fav = favoriteOf(collection);
  const favE = fav ? peekEntry(collection, fav) : undefined;
  return (
    <div className="panel trainer-header">
      <TrainerAvatar avatar={trainer.avatar} name={trainer.name} size={88} />
      <div className="th-main">
        <div className="trainer-name">{trainer.name}</div>
        <div className="th-stats">
          <span>
            <b>{Object.keys(collection.entries).length}</b> na coleção
          </span>
          <span>
            <b>{st.runs}</b> runs
          </span>
          <span>
            <b>{st.caught}</b> capturas
          </span>
          <span>
            Melhor ronda <b>{st.bestWave}</b>
          </span>
          <span>
            <b>{st.stageClears}</b> temporadas completas
          </span>
        </div>
        <CareerCard />
      </div>
      {fav && (
        <div className="th-fav">
          <span className="hint">Favorito</span>
          <Sprite name={species(fav).name} shiny={favE?.shiny} size={72} />
          <Hearts entry={favE} small />
        </div>
      )}
    </div>
  );
}

export function CollectionScreen() {
  const {collection, setScreen} = useGame();
  const [type, setType] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'grid' | 'train'>('grid');
  const entries = Object.entries(collection.entries)
    .filter(([id]) => !type || species(id).types.includes(type))
    .sort((a, b) => species(a[0]).num - species(b[0]).num);
  return (
    <div className="screen collection-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>Coleção</h2>
        <span />
      </header>
      <TrainerHeader />
      <div className={`col-layout ${open ? 'has-open' : ''}`}>
        <aside className="panel col-side">
          {open ? (
            <>
              <button className="modal-close" onClick={() => (setOpen(null), setTab('grid'))} aria-label="Fechar">
                ✕
              </button>
              <PokemonPanel line={open} onTrain={() => setTab('train')} />
            </>
          ) : (
            <p className="hint col-empty">Toque num Pokémon para ver a ficha dele aqui.</p>
          )}
        </aside>
        <div className="col-main">
          <div className="tabs big-tabs">
            <button className={`tab ${tab === 'grid' ? 'active' : ''}`} onClick={() => setTab('grid')}>
              Coleção · {Object.keys(collection.entries).length}
            </button>
            <button
              className={`tab ${tab === 'train' ? 'active' : ''}`}
              onClick={() => setTab('train')}
              disabled={!open}
              title={open ? undefined : 'Escolha um Pokémon primeiro'}
            >
              Treinar{open ? ` ${species(open).name}` : ''}
            </button>
          </div>
          {tab === 'train' && open ? (
            <div className="panel">
              <TrainPanel root={open} />
            </div>
          ) : (
            <>
              <TypeFilter value={type} onChange={setType} types={ALL_TYPES} />
              {!entries.length && <p className="hint">Nenhum Pokémon aqui ainda.</p>}
              <div className="grid">
                {entries.map(([id, raw]) => {
                  const e = peekEntry(collection, id)!;
                  return (
                    <button key={id} className={`cell ${open === id ? 'selected' : ''}`} onClick={() => setOpen(id)}>
                      <Sprite name={id} shiny={raw.shiny} size={72} />
                      <span className="cell-name">{species(id).name}</span>
                      <Types name={id} />
                      <span className="cell-sub row center">
                        <Candies line={id} n={e.candies} />
                      </span>
                      <Hearts entry={e} small />
                    </button>
                  );
                })}
              </div>
              {collection.runs.length > 0 && (
                <details className="runs-details">
                  <summary>Últimas runs</summary>
                  <ul className="runs panel">
                    {collection.runs.map(r => (
                      <li key={r.endedAt}>
                        {new Date(r.endedAt).toLocaleDateString('pt-BR')} · {r.starter} · ronda {r.wave} ·{' '}
                        {r.result === 'stageClear' ? 'temporada completa' : r.result === 'lost' ? 'derrota' : 'abandonada'}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
