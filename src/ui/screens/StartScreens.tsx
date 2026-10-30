import {useEffect, useMemo, useState} from 'react';
import type {Species} from '@pkmn/sim';
import {BIOMES, getBiome} from '../../data/biomes';
import type {Biome} from '../../data/biomes';
import {ALL_TYPES, isBaseStage, isLegendary, isPlayable, rarityOf, species} from '../../data/dex';
import {lineRoot, loadCollection} from '../../game/meta';
import {AVATARS, MAX_TRAINERS, avatarUrl} from '../../game/trainers';
import type {Trainer} from '../../game/trainers';
import {useGame} from '../../game/store';
import {shuffle} from '../../game/rng';
import {FX} from '../fx';
import {MatchupPanel, PixelIcon, RarityBadge, Sprite, TypeBadge, TypeFilter, Types} from '../components';
import {playCry} from '../audio';

export function TrainerAvatar({avatar, name, size = 80}: {avatar: string; name: string; size?: number}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatar]);
  if (failed) {
    return (
      <span className="avatar-fallback" style={{width: size, height: size}}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img className="trainer-avatar" src={avatarUrl(avatar)} alt={name} width={size} height={size} onError={() => setFailed(true)} draggable={false} />;
}

function trainerStats(t: Trainer) {
  const col = loadCollection(t.id);
  const best = col.runs.reduce((m, r) => Math.max(m, r.wave), 0);
  const clears = col.runs.filter(r => r.result === 'stageClear').length;
  return {species: Object.keys(col.entries).length, runs: col.runs.length, best, clears};
}

/** Escolha / criação de treinador. Cada treinador tem coleção e run próprias. */
export function TrainerSelect() {
  const {trainers, trainer, selectTrainer, createTrainer, removeTrainer} = useGame();
  const [creating, setCreating] = useState(trainers.length === 0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[17]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  return (
    <div className="screen trainer-screen">
      <div className="logo small">
        <div className="logo-top">POKÉMON</div>
        <div className="logo-main">ROAD TO GLORY</div>
      </div>
      <h2>Quem vai jogar?</h2>
      <p className="hint">Cada treinador tem sua própria coleção e sua própria run salva. Até {MAX_TRAINERS} treinadores.</p>
      <div className="trainer-slots">
        {trainers.map(t => {
          const st = trainerStats(t);
          return (
            <div key={t.id} className={`trainer-card panel ${trainer?.id === t.id ? 'selected' : ''}`}>
              <TrainerAvatar avatar={t.avatar} name={t.name} />
              <h3>{t.name}</h3>
              <ul className="trainer-stats">
                <li>Coleção: {st.species}</li>
                <li>Runs: {st.runs}</li>
                <li>Melhor ronda: {st.best}</li>
                <li>Etapas concluídas: {st.clears}</li>
              </ul>
              <button className="btn primary" onClick={() => selectTrainer(t.id)}>
                Jogar
              </button>
              {confirmDel === t.id ? (
                <button className="btn small danger" onClick={() => removeTrainer(t.id)}>
                  Apagar de vez?
                </button>
              ) : (
                <button className="btn small ghost" onClick={() => setConfirmDel(t.id)}>
                  Apagar
                </button>
              )}
            </div>
          );
        })}
        {trainers.length < MAX_TRAINERS && !creating && (
          <button className="trainer-card panel new" onClick={() => setCreating(true)}>
            <span className="plus">+</span>
            Novo treinador
          </button>
        )}
      </div>
      {creating && (
        <div className="panel trainer-new">
          <h3>Novo treinador</h3>
          <label className="field">
            Nome
            <input value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoFocus />
          </label>
          <div className="avatar-pick">
            {AVATARS.map(a => (
              <button key={a} className={`avatar-opt ${avatar === a ? 'selected' : ''}`} onClick={() => setAvatar(a)} title={a}>
                <TrainerAvatar avatar={a} name={a} size={64} />
              </button>
            ))}
          </div>
          <div className="row center">
            {trainers.length > 0 && (
              <button className="btn" onClick={() => setCreating(false)}>
                Cancelar
              </button>
            )}
            <button className="btn primary" disabled={!name.trim()} onClick={() => createTrainer(name, avatar)}>
              Criar e jogar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TitleScreen() {
  const {run, setScreen, abandonRun, collection, trainer, selectTrainer} = useGame();
  const [confirm, setConfirm] = useState(false);
  if (!trainer) return <TrainerSelect />;
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
      <div className="title-row">
        <div className="panel trainer-badge">
          <TrainerAvatar avatar={trainer.avatar} name={trainer.name} size={72} />
          <div>
            <div className="trainer-name">{trainer.name}</div>
            <div className="hint">
              {Object.keys(collection.entries).length} na coleção · {collection.runs.length} runs
            </div>
            <button className="btn small" onClick={() => selectTrainer(null)}>
              Trocar treinador
            </button>
          </div>
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
  const [tab, setTab] = useState<'starters' | 'collection'>('starters');

  // Pokémon já capturados por ESTE treinador (primeiro estágio, não lendários) também podem ser iniciais.
  const unlocked = useMemo(
    () =>
      Object.keys(collection.entries)
        .map(id => species(id))
        .filter(s => isPlayable(s) && isBaseStage(s) && !isLegendary(s) && !STARTER_SET.has(s.name))
        .sort((a, b) => a.num - b.num),
    [collection],
  );
  const firstRun = collection.runs.length === 0 && unlocked.length === 0;
  const typesInUse = useMemo(() => {
    const set = new Set<string>();
    if (tab === 'starters') for (const n of STARTER_SET) species(n).types.forEach(t => set.add(t));
    else for (const s of unlocked) s.types.forEach(t => set.add(t));
    return ALL_TYPES.filter(t => set.has(t));
  }, [unlocked, tab]);

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
      <Sprite name={s.name} size={80} />
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
      {firstRun && (
        <p className="banner">
          Primeira jornada! Escolha um dos iniciais clássicos. Tudo que você capturar vira opção de inicial nas próximas runs.
        </p>
      )}
      <div className="tabs">
        <button className={`tab ${tab === 'starters' ? 'active' : ''}`} onClick={() => setTab('starters')}>
          Iniciais por geração
        </button>
        <button className={`tab ${tab === 'collection' ? 'active' : ''}`} onClick={() => setTab('collection')} disabled={!unlocked.length}>
          Sua coleção · {unlocked.length}
        </button>
      </div>
      <TypeFilter value={type} onChange={setType} types={typesInUse} />
      <div className="starter-layout">
        <div className="starter-lists">
          {tab === 'starters' ? (
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
          ) : (
            <div className="panel">
              <p className="hint">Pokémon que você já capturou (forma básica). Eles começam com os melhores IVs da coleção.</p>
              <div className="grid">{unlocked.filter(s => matchesType(s, type)).map(cell)}</div>
            </div>
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
        Coleção de {useGame.getState().trainer?.name}. Todo Pokémon capturado entra aqui e vira opção de inicial. Capturar
        repetido melhora os IVs dele. Doces, EVs, breeding e venda chegam na etapa 2.
      </p>
      <TypeFilter value={type} onChange={setType} types={ALL_TYPES} />
      {!entries.length && <p className="hint">Nenhum Pokémon aqui ainda.</p>}
      <div className="grid">
        {entries.map(([id, e]) => (
          <div key={id} className="cell">
            <Sprite name={id} shiny={e.shiny} size={80} />
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
