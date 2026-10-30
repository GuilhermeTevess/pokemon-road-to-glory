import {useMemo, useState} from 'react';
import {BIOMES, getBiome} from '../../data/biomes';
import {BASE_STAGE, isLegendary, rarityOf, species} from '../../data/dex';
import {lineRoot} from '../../game/meta';
import {useGame} from '../../game/store';
import {pick, shuffle} from '../../game/rng';
import {MatchupPanel, RarityBadge, Sprite, TypeBadge, Types} from '../components';
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
        {['Charizard', 'Lucario', 'Gengar', 'Garchomp', 'Greninja'].map(n => (
          <Sprite key={n} name={n} />
        ))}
      </div>
      <div className="menu">
        {active && (
          <button className="btn primary" onClick={() => setScreen('run')}>
            Continuar (ronda {run.wave})
          </button>
        )}
        <button
          className="btn"
          onClick={() => {
            if (active && !confirm) return setConfirm(true);
            abandonRun();
            useGame.setState({run: null});
            useGame.getState().setScreen('run');
          }}
        >
          {active && confirm ? 'Tem certeza? A run atual será perdida' : 'Nova run'}
        </button>
        <button className="btn" onClick={() => setScreen('collection')}>
          Coleção ({Object.keys(collection.entries).length})
        </button>
      </div>
      <p className="hint">Etapa 1: escolha um inicial de qualquer geração e sobreviva até a ronda 30.</p>
    </div>
  );
}

const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function StarterSelect() {
  const {newRun, collection, setScreen} = useGame();
  const [gen, setGen] = useState<number | 'all'>(1);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BASE_STAGE.filter(s => !isLegendary(s))
      .filter(s => (q ? s.name.toLowerCase().includes(q) : gen === 'all' || s.gen === gen))
      .sort((a, b) => a.num - b.num || a.name.localeCompare(b.name));
  }, [gen, query]);

  const sel = selected ? species(selected) : null;
  const owned = sel ? collection.entries[lineRoot(sel.name)] : undefined;

  return (
    <div className="screen starter-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          ← Voltar
        </button>
        <h2>Escolha seu inicial</h2>
        <button
          className="btn small"
          onClick={() => {
            const s = pick(BASE_STAGE.filter(x => !isLegendary(x)));
            setSelected(s.name);
            playCry(s.name);
          }}
        >
          🎲 Aleatório
        </button>
      </header>
      <div className="filters">
        <input placeholder="Buscar Pokémon..." value={query} onChange={e => setQuery(e.target.value)} />
        <div className="tabs">
          {GENS.map(g => (
            <button key={g} className={`tab ${gen === g && !query ? 'active' : ''}`} onClick={() => setGen(g)}>
              Gen {g}
            </button>
          ))}
          <button className={`tab ${gen === 'all' && !query ? 'active' : ''}`} onClick={() => setGen('all')}>
            Todas
          </button>
        </div>
      </div>
      <div className="starter-layout">
        <div className="grid">
          {list.map(s => (
            <button
              key={s.id}
              className={`cell ${selected === s.name ? 'selected' : ''} ${collection.entries[lineRoot(s.name)] ? 'owned' : ''}`}
              onClick={() => {
                setSelected(s.name);
                playCry(s.name);
              }}
              title={s.name}
            >
              <Sprite name={s.name} still size={64} />
              <span className="cell-name">{s.name}</span>
            </button>
          ))}
        </div>
        {sel && (
          <aside className="detail">
            <Sprite name={sel.name} className="big" />
            <h3>
              #{sel.num} {sel.name}
            </h3>
            <div className="row">
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
                    <div className="bs-fill" style={{width: `${Math.min(100, (v / 180) * 100)}%`}} />
                  </div>
                  <span>{v}</span>
                </div>
              ))}
              <div className="bs total">Total {sel.bst}</div>
            </div>
            <MatchupPanel types={sel.types} title="Fraquezas e resistências" />
            {owned && <p className="hint">Na coleção: capturado {owned.caught}x, começa com os melhores IVs da coleção.</p>}
            <button className="btn primary" onClick={() => newRun(sel.name)}>
              Começar com {sel.name}
            </button>
          </aside>
        )}
      </div>
    </div>
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
      {mode === 'next' && <p className="hint">Ronda {run.wave + 1} em diante. Você pode continuar em {current.name}.</p>}
      <div className="biomes">
        {options.map(b => (
          <button
            key={b.id}
            className="biome-card"
            style={{background: `linear-gradient(${b.colors[0]}, ${b.colors[1]})`}}
            onClick={() => (mode === 'start' ? chooseStartBiome(b.id) : chooseNextBiome(b.id))}
          >
            <span className="biome-emoji">{b.emoji}</span>
            <span className="biome-name">{b.name}</span>
            <span className="row">
              {b.types.map(t => (
                <TypeBadge key={t} type={t} small />
              ))}
            </span>
          </button>
        ))}
        {mode === 'next' && (
          <button
            className="biome-card stay"
            style={{background: `linear-gradient(${current.colors[0]}, ${current.colors[1]})`}}
            onClick={() => chooseNextBiome(null)}
          >
            <span className="biome-emoji">{current.emoji}</span>
            <span className="biome-name">Ficar em {current.name}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function CollectionScreen() {
  const {collection, setScreen} = useGame();
  const entries = Object.entries(collection.entries).sort((a, b) => species(a[0]).num - species(b[0]).num);
  return (
    <div className="screen collection-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          ← Voltar
        </button>
        <h2>Coleção</h2>
        <span />
      </header>
      <p className="hint">
        Cada Pokémon capturado entra aqui. Repetidos melhoram os IVs, e o inicial começa com os melhores IVs da linha
        evolutiva. Doces, EVs, breeding e venda chegam na etapa 2.
      </p>
      {!entries.length && <p>Nenhum Pokémon ainda. Bora jogar!</p>}
      <div className="grid">
        {entries.map(([id, e]) => (
          <div key={id} className="cell">
            <Sprite name={id} still shiny={e.shiny} size={64} />
            <span className="cell-name">{species(id).name}</span>
            <Types name={id} />
            <span className="cell-sub">x{e.caught} · IVs {Object.values(e.bestIvs).reduce((a, b) => a + b, 0)}/186</span>
          </div>
        ))}
      </div>
      {collection.runs.length > 0 && (
        <>
          <h3>Últimas runs</h3>
          <ul className="runs">
            {collection.runs.map(r => (
              <li key={r.endedAt}>
                {new Date(r.endedAt).toLocaleDateString('pt-BR')} · {r.starter} · ronda {r.wave} ·{' '}
                {r.result === 'stageClear' ? '🏆 etapa concluída' : r.result === 'lost' ? '💀 derrota' : 'abandonada'}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
