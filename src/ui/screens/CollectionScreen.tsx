// Coleção do treinador: cabeçalho com números, grade das linhas evolutivas e a
// ficha de cada linha (doces, corações, IVs, natures, habilidades, golpe inicial).
import {useEffect, useMemo, useState} from 'react';
import type {Species} from '@pkmn/sim';
import {ALL_TYPES, TYPE_COLORS, dex, species} from '../../data/dex';
import {
  COST_CUT_PRICE, HEART_PERKS, HEART_STEPS, MAX_COST_CUT, SHINY_CHANCE, SHINY_PRICE,
  baseCost, favoriteOf, heartProgress, heartsOf, lineRoot, lineSpecies, movePrice, peekEntry, startMoveOptions, statsOf, teamCost,
} from '../../game/meta';
import type {CollectionEntry} from '../../game/meta';
import {useGame} from '../../game/store';
import {STAT_LABEL} from '../../game/types';
import type {StatId} from '../../game/types';
import {IvWeb, Modal, MoveInfo, PixelIcon, Sprite, TypeBadge, TypeFilter, Types} from '../components';
import {playCry} from '../audio';
import {TrainerAvatar} from './StartScreens';

const candyColor = (line: string) => TYPE_COLORS[species(line).types[0]] ?? '#e0b43a';

export function Candies({line, n}: {line: string; n: number}) {
  return (
    <span className="candies" title={`Doces de ${species(lineRoot(line)).name}`}>
      <PixelIcon name="candy" size={16} color={candyColor(lineRoot(line))} />
      {n}
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

/** Ficha da linha evolutiva. */
export function LineSheet({line, onClose}: {line: string; onClose: () => void}) {
  const {collection, unlockMove, equipMove, equipNature, equipAbility, buyCostCut, buyShiny, setFavorite} = useGame();
  const root = lineRoot(line);
  const e = peekEntry(collection, root);
  const [view, setView] = useState<Species>(species(root));
  const [moveFilter, setMoveFilter] = useState<'type' | 'all'>('type');
  const [info, setInfo] = useState<string | null>(null);
  const options = useMemo(() => startMoveOptions(root), [root]);
  if (!e) return null;
  const types = species(root).types as string[];
  const shownMoves = options.filter(o => !e.moves.includes(o.id) && (moveFilter === 'all' || types.includes(dex.moves.get(o.id).type)));
  const fav = favoriteOf(collection) === root;
  const cost = teamCost(collection, root);
  return (
    <Modal onClose={onClose} wide>
      <div className="sheet">
        <div className="sheet-left">
          <EvoViewer name={root} shiny={e.shiny} onChange={setView} />
          <div className="row center">
            {view.types.map(t => (
              <TypeBadge key={t} type={t} info />
            ))}
          </div>
          <div className="sheet-numbers">
            <Candies line={root} n={e.candies} />
            <span>{e.caught ? `Capturado ${e.caught}x` : 'Parceiro inicial'}</span>
            <span>Custo no time: {cost}</span>
          </div>
          <Hearts entry={e} />
          <ul className="perks">
            {HEART_PERKS.map((p, i) => (
              <li key={p} className={i < heartsOf(e) ? 'on' : ''}>
                <PixelIcon name="heart" size={12} color={i < heartsOf(e) ? 'var(--pink-d)' : '#cfc6dd'} /> {i + 1}: {p}
              </li>
            ))}
          </ul>
          <p className="hint">Corações enchem quando esta linha luta e vence no seu time.</p>
          <button className={`btn small ${fav ? 'fav-on' : ''}`} onClick={() => setFavorite(fav ? null : root)}>
            <PixelIcon name="star" /> {fav ? 'Favorito do perfil' : 'Tornar favorito'}
          </button>
        </div>
        <div className="sheet-right">
          <section>
            <h3>IVs</h3>
            {e.caught ? (
              <IvWeb before={e.bestIvs} after={e.bestIvs} size={220} />
            ) : (
              <p className="hint">Capture um {species(root).name} selvagem para guardar os IVs dele. Repetidos melhoram a teia.</p>
            )}
          </section>
          <section>
            <h3>Nature para começar</h3>
            {e.natures.length ? (
              <div className="chips">
                <button className={`chip ${!e.nature ? 'active' : ''}`} onClick={() => equipNature(root, null)}>
                  Aleatória
                </button>
                {e.natures.map(n => (
                  <button key={n} className={`chip ${e.nature === n ? 'active' : ''}`} onClick={() => equipNature(root, n)}>
                    {natureLabel(n)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">Cada nature que você capturar desta linha fica liberada aqui.</p>
            )}
          </section>
          <section>
            <h3>Habilidade para começar</h3>
            {e.abilities.length ? (
              <div className="chips">
                <button className={`chip ${!e.ability ? 'active' : ''}`} onClick={() => equipAbility(root, null)}>
                  Aleatória
                </button>
                {e.abilities.map(a => (
                  <button key={a} className={`chip ${e.ability === a ? 'active' : ''}`} onClick={() => equipAbility(root, a)} title={dex.abilities.get(a).shortDesc}>
                    {a}
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">Habilidades vistas em capturas ficam liberadas aqui.</p>
            )}
          </section>
          <section>
            <h3>Golpe inicial</h3>
            <p className="hint">Libere com doces um golpe que {species(root).name} aprende. Ele começa a run já sabendo.</p>
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
            </ul>
          </section>
        </div>
      </div>
      {info && <MoveInfo move={info} onClose={() => setInfo(null)} />}
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
            <b>{st.defeated}</b> vitórias
          </span>
          <span>
            Melhor ronda <b>{st.bestWave}</b>
          </span>
          <span>
            <b>{st.stageClears}</b> etapas vencidas
          </span>
          <span>
            ₽ <b>{st.moneyEarned}</b> ganhos
          </span>
        </div>
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
      <p className="hint">
        Cada linha evolutiva tem uma ficha. Toque num Pokémon para ver doces, corações, IVs e para gastar doces em golpe
        inicial, custo menor no time e chance de shiny.
      </p>
      <TypeFilter value={type} onChange={setType} types={ALL_TYPES} />
      {!entries.length && <p className="hint">Nenhum Pokémon aqui ainda.</p>}
      <div className="grid">
        {entries.map(([id, raw]) => {
          const e = peekEntry(collection, id)!;
          return (
            <button key={id} className="cell" onClick={() => setOpen(id)}>
              <Sprite name={id} shiny={raw.shiny} size={80} />
              <span className="cell-name">{species(id).name}</span>
              <Types name={id} />
              <span className="cell-sub row center">
                <Candies line={id} n={e.candies} />
                {e.caught ? `x${e.caught}` : 'inicial'}
              </span>
              <Hearts entry={e} small />
            </button>
          );
        })}
      </div>
      {collection.runs.length > 0 && (
        <>
          <h3 className="section-title">Últimas runs</h3>
          <ul className="runs panel">
            {collection.runs.map(r => (
              <li key={r.endedAt}>
                {new Date(r.endedAt).toLocaleDateString('pt-BR')} · {r.starter} · ronda {r.wave} ·{' '}
                {r.result === 'stageClear' ? 'etapa concluída' : r.result === 'lost' ? 'derrota' : 'abandonada'}
              </li>
            ))}
          </ul>
        </>
      )}
      {open && <LineSheet line={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
