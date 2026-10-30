import {useMemo, useState} from 'react';
import type {Species} from '@pkmn/sim';
import {BIOMES, getBiome} from '../../data/biomes';
import type {Biome} from '../../data/biomes';
import {ALL_TYPES, isBaseStage, isLegendary, isPlayable, rarityOf, species} from '../../data/dex';
import {lineRoot} from '../../game/meta';
import {useGame} from '../../game/store';
import {shuffle} from '../../game/rng';
import {FX} from '../fx';
import {MatchupPanel, PixelIcon, RarityBadge, Sprite, TypeBadge, TypeFilter, Types} from '../components';
import {playCry} from '../audio';

export function TitleScreen() {
  const {run, setScreen, abandonRun, collection} = useGame();
  const [confirm, setConfirm] = useState(false);
  const active = run && run.phase !== 'gameOver' && run.phase !== 'stageClear';
  return (
    <div className="screen title-screen">
      <div className="logo">
        <div className="logo-top">POKÉMON</div>
        <div className="logo-main">ROAD TO GLORY</div>
        <div className="logo-sub">roguelike entre amigos</div>
      </div>
      <div className="title-mons">
        {['Venusaur', 'Charizard', 'Blastoise', 'Pikachu', 'Lucario', 'Gengar'].map(n => (
          <Sprite key={n} name={n} />
        ))}
      </div>
      <div className="menu panel">
        {active && (
          <button className="btn primary" onClick={() => setScreen('run')}>
            Continuar · ronda {run.wave}
          </button>
        )}
        <button
          className={`btn ${active ? '' : 'primary'}`}
          onClick={() => {
            if (active && !confirm) return setConfirm(true);
            abandonRun();
            useGame.setState({run: null});
            useGame.getState().setScreen('run');
          }}
        >
          {active && confirm ? 'Certeza? A run atual será perdida' : 'Nova run'}
        </button>
        <button className="btn" onClick={() => setScreen('collection')}>
          Coleção · {Object.keys(collection.entries).length}
        </button>
      </div>
      <p className="hint">Escolha seu inicial e sobreviva até a ronda 30.</p>
    </div>
  );
}

/** Os três iniciais de cada geração. */
export const STARTERS: string[][] = [
  ['Bulbasaur', 'Charmander', 'Squirtle'],
  ['Chikorita', 'Cyndaquil', 'Totodile'],
  ['Treecko', 'Torchic', 'Mudkip'],
  ['Turtwig', 'Chimchar', 'Piplup'],
  ['Snivy', 'Tepig', 'Oshawott'],
  ['Chespin', 'Fennekin', 'Froakie'],
  ['Rowlet', 'Litten', 'Popplio'],
  ['Grookey', 'Scorbunny', 'Sobble'],
  ['Sprigatito', 'Fuecoco', 'Quaxly'],
];
const STARTER_SET = new Set(STARTERS.flat());

function matchesType(s: Species, type: string | null): boolean {
  return !type || s.types.includes(type);
}

export function StarterSelect() {
  const {newRun, collection, setScreen} = useGame();
  const [type, setType] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Pokémon já capturados (primeiro estágio, não lendários) também podem ser iniciais.
  const unlocked = useMemo(
    () =>
      Object.keys(collection.entries)
        .map(id => species(id))
        .filter(s => isPlayable(s) && isBaseStage(s) && !isLegendary(s) && !STARTER_SET.has(s.name))
        .sort((a, b) => a.num - b.num),
    [collection],
  );
  const typesInUse = useMemo(() => {
    const set = new Set<string>();
    for (const n of STARTER_SET) species(n).types.forEach(t => set.add(t));
    for (const s of unlocked) s.types.forEach(t => set.add(t));
    return ALL_TYPES.filter(t => set.has(t));
  }, [unlocked]);

  const sel = selected ? species(selected) : null;
  const owned = sel ? collection.entries[lineRoot(sel.name)] : undefined;
  const pickCell = (name: string) => {
    setSelected(name);
    playCry(name);
  };

  const cell = (s: Species) => (
    <button
      key={s.id}
      className={`cell ${selected === s.name ? 'selected' : ''} ${collection.entries[lineRoot(s.name)] ? 'owned' : ''}`}
      onClick={() => pickCell(s.name)}
      title={s.name}
    >
      <Sprite name={s.name} still size={64} />
      <span className="cell-name">{s.name}</span>
    </button>
  );

  return (
    <div className="screen starter-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>Escolha seu inicial</h2>
        <span />
      </header>
      <TypeFilter value={type} onChange={setType} types={typesInUse} />
      <div className="starter-layout">
        <div className="starter-lists">
          <div className="gen-grid">
            {STARTERS.map((trio, g) => {
              const shown = trio.map(species).filter(s => matchesType(s, type));
              if (!shown.length) return null;
              return (
                <div key={g} className="gen-row panel">
                  <span className="gen-label">Gen {g + 1}</span>
                  <div className="gen-cells">{shown.map(cell)}</div>
                </div>
              );
            })}
          </div>
          {unlocked.length > 0 && (
            <>
              <h3 className="section-title">Da sua coleção</h3>
              <div className="grid">{unlocked.filter(s => matchesType(s, type)).map(cell)}</div>
            </>
          )}
        </div>
        <aside className={`detail panel ${sel ? '' : 'empty'}`}>
          {sel ? (
            <>
              <Sprite name={sel.name} className="big" />
              <h3>
                #{sel.num} {sel.name}
              </h3>
              <div className="row center">
                {sel.types.map(t => (
                  <TypeBadge key={t} type={t} />
                ))}
                <RarityBadge rarity={rarityOf(sel)} />
              </div>
              <div className="base-stats">
                {Object.entries(sel.baseStats).map(([k, v]) => (
                  <div key={k} className="bs">
                    <span>{k.toUpperCase()}</span>
                    <div className="bs-track">
                      <div className={`bs-fill bs-${k}`} style={{width: `${Math.min(100, (v / 160) * 100)}%`}} />
                    </div>
                    <span>{v}</span>
                  </div>
                ))}
                <div className="bs total">Total {sel.bst}</div>
              </div>
              <MatchupPanel types={sel.types} title="Fraquezas e resistências" />
              {owned && <p className="hint">Já capturado {owned.caught}x: começa com os melhores IVs da coleção.</p>}
              <button className="btn primary" onClick={() => newRun(sel.name)}>
                Começar com {sel.name}
              </button>
            </>
          ) : (
            <p className="hint">Toque num Pokémon para ver os detalhes.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

export function BiomeCard({biome, onClick, label}: {biome: Biome; onClick: () => void; label?: string}) {
  return (
    <button className="biome-card" onClick={onClick} style={{['--bc' as string]: biome.color}}>
      <span className="biome-thumb" style={{backgroundImage: `url(${FX(`bg/${biome.bg}.png`)})`, filter: biome.filter}} />
      <span className="biome-name">{label ?? biome.name}</span>
      <span className="row center wrap">
        {biome.types.map(t => (
          <TypeBadge key={t} type={t} small />
        ))}
      </span>
    </button>
  );
}

export function BiomeSelect({mode}: {mode: 'start' | 'next'}) {
  const {run, chooseStartBiome, chooseNextBiome} = useGame();
  const options = useMemo(() => {
    if (mode === 'start') return BIOMES;
    return shuffle(BIOMES.filter(b => b.id !== run?.biome)).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, run?.wave]);
  if (!run) return null;
  const current = getBiome(run.biome);
  return (
    <div className="screen biome-screen">
      <h2>{mode === 'start' ? 'Escolha seu primeiro bioma' : 'Hora de viajar! Para onde vamos?'}</h2>
      <p className="hint">Cada bioma tem Pokémon dos tipos mostrados no cartão.</p>
      <div className="biomes">
        {options.map(b => (
          <BiomeCard key={b.id} biome={b} onClick={() => (mode === 'start' ? chooseStartBiome(b.id) : chooseNextBiome(b.id))} />
        ))}
        {mode === 'next' && <BiomeCard biome={current} label={`Ficar: ${current.name}`} onClick={() => chooseNextBiome(null)} />}
      </div>
    </div>
  );
}

export function CollectionScreen() {
  const {collection, setScreen} = useGame();
  const [type, setType] = useState<string | null>(null);
  const entries = Object.entries(collection.entries)
    .filter(([id]) => matchesType(species(id), type))
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
      <p className="hint">
        Todo Pokémon capturado entra aqui e vira opção de inicial. Capturar repetido melhora os IVs dele. Doces, EVs,
        breeding e venda chegam na etapa 2.
      </p>
      <TypeFilter value={type} onChange={setType} types={ALL_TYPES} />
      {!entries.length && <p className="hint">Nenhum Pokémon aqui ainda.</p>}
      <div className="grid">
        {entries.map(([id, e]) => (
          <div key={id} className="cell">
            <Sprite name={id} still shiny={e.shiny} size={64} />
            <span className="cell-name">{species(id).name}</span>
            <Types name={id} />
            <span className="cell-sub">
              x{e.caught} · IVs {Object.values(e.bestIvs).reduce((a, b) => a + b, 0)}/186
            </span>
          </div>
        ))}
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
    </div>
  );
}
