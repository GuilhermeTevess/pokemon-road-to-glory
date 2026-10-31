import {playerId, roundOf, seasonBlockers} from '../../game/career';
import {useEffect, useMemo, useState} from 'react';
import type {Species} from '@pkmn/sim';
import {BIOMES, biomePools, hiddenBiomeOf} from '../../data/biomes';
import {getHint} from '../../data/hints';
import type {Biome} from '../../data/biomes';
import {ALL_TYPES, dex, isBaseStage, isLegendary, isPlayable, rarityOf, species} from '../../data/dex';
import {careerOf, favoriteOf, lineRoot, loadCollection, peekEntry, statsOf, teamCost} from '../../game/meta';
import {AVATARS, MAX_TRAINERS, avatarUrl} from '../../game/trainers';
import {decodeLook, isCustom, lookFromName, lookPixels} from '../../game/look';
import {CHARACTERS, CLASSES, PROTAGONISTS} from '../../data/trainerSprites';
import type {Look} from '../../game/look';
import type {Trainer} from '../../game/trainers';
import {PARTY_SIZE, peekRun, runActive, useGame} from '../../game/store';
import type {Screen} from '../../game/store';
import {teamBudget} from '../../game/glory';
import {shuffle} from '../../game/rng';
import {REGIONS, getRegion, regionStay} from '../../data/regions';
import {ACHIEVEMENTS} from '../../game/achievements';
import type {Region} from '../../data/regions';
import {FX} from '../fx';
import {MatchupPanel, PixelIcon, RarityBadge, Sprite, TypeBadge, TypeFilter} from '../components';
import {playCry} from '../audio';
import {Candies, EvoViewer, Hearts, LineSheet} from './CollectionScreen';

/** Treinador em pixel art feito no editor (16×24, centralizado num quadrado). */
export function PixelTrainer({look, size = 80}: {look: Look; size?: number}) {
  const px = useMemo(() => lookPixels(look), [look]);
  return (
    <svg className="trainer-avatar pixel-trainer" viewBox="-4 0 24 24" width={size} height={size} shapeRendering="crispEdges" aria-hidden>
      {px.flatMap((row, y) => row.map((c, x) => (c ? <rect key={`${x}-${y}`} x={x} y={y} width={1.04} height={1.04} fill={c} /> : null)))}
    </svg>
  );
}

export function TrainerAvatar({avatar, name, size = 80}: {avatar: string; name: string; size?: number}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatar]);
  const look = useMemo(() => (isCustom(avatar) ? decodeLook(avatar) : null), [avatar]);
  if (look) return <PixelTrainer look={look} size={size} />;
  // Sem sprite: um treinador em pixel art com visual fixo para aquele nome.
  if (failed) return <PixelTrainer look={lookFromName(name)} size={size} />;
  return <img className="trainer-avatar" src={avatarUrl(avatar)} alt={name} width={size} height={size} onError={() => setFailed(true)} draggable={false} />;
}

const GALLERY_TABS = [
  {id: 'p', label: 'Protagonistas', list: PROTAGONISTS},
  {id: 'n', label: 'Personagens', list: CHARACTERS},
  {id: 'c', label: 'Classes de treinador', list: CLASSES},
] as const;
const PAGE = 60;

/** Galeria com os sprites oficiais de treinador: abas, busca e "mostrar mais". */
export function AvatarEditor({avatar, onChange}: {avatar: string; onChange: (a: string) => void}) {
  const [tab, setTab] = useState<'p' | 'n' | 'c'>('p');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const list = q ? [...PROTAGONISTS, ...CHARACTERS, ...CLASSES].filter(n => n.replace(/-/g, '').includes(q)) : GALLERY_TABS.find(t => t.id === tab)!.list;
  return (
    <div className="avatar-editor">
      <div className="avatar-current">
        <TrainerAvatar avatar={avatar} name={avatar} size={120} />
        <span className="muted">{spriteLabel(avatar)}</span>
      </div>
      <div className="row center wrap">
        {GALLERY_TABS.map(t => (
          <button key={t.id} className={`tab ${tab === t.id && !q ? 'active' : ''}`} onClick={() => (setTab(t.id), setQuery(''), setShown(PAGE))}>
            {t.label} · {t.list.length}
          </button>
        ))}
      </div>
      <input className="avatar-search" value={query} onChange={e => (setQuery(e.target.value), setShown(PAGE))} placeholder="Buscar (ex.: misty, ash, nurse, gen3...)" />
      <div className="avatar-pick">
        {list.slice(0, shown).map(a => (
          <button key={a} className={`avatar-opt ${avatar === a ? 'selected' : ''}`} onClick={() => onChange(a)} title={spriteLabel(a)}>
            <img className="trainer-avatar" src={avatarUrl(a)} alt={a} width={64} height={64} loading="lazy" draggable={false} />
          </button>
        ))}
      </div>
      {!list.length && <p className="muted">Nada encontrado.</p>}
      {list.length > shown && (
        <button className="btn small" onClick={() => setShown(n => n + PAGE * 2)}>
          Mostrar mais ({list.length - shown})
        </button>
      )}
    </div>
  );
}

/** "acetrainerf-gen3" → "acetrainerf (gen3)". */
const spriteLabel = (a: string) => (isCustom(a) ? 'Visual montado' : a.replace(/-(.+)$/, ' ($1)'));

function trainerStats(t: Trainer) {
  const col = loadCollection(t.id);
  const st = statsOf(col);
  return {species: Object.keys(col.entries).length, runs: st.runs, best: st.bestWave, clears: st.stageClears};
}

/** Escolha / criação de treinador. Cada treinador tem coleção e run próprias. */
export function TrainerSelect() {
  const {trainers: all, trainer, selectTrainer, createTrainer, removeTrainer, updateTrainer, setScreen, playSolo, playOnline} = useGame();
  const trainers = all.filter(t => !t.career);
  const careers = all.filter(t => t.career);
  const [creating, setCreating] = useState(all.length === 0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  /** Treinador cujo visual está sendo editado. */
  const [editing, setEditing] = useState<Trainer | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  /** Treinador cuja run vai ser apagada para começar outra (pede confirmação). */
  const [confirmNew, setConfirmNew] = useState<string | null>(null);
  return (
    <div className="screen trainer-screen">
      <div className="logo small">
        <div className="logo-top">POKÉMON</div>
        <div className="logo-main">ROAD TO GLORY</div>
      </div>
      <h2>Quem vai jogar?</h2>
      <p className="hint">
        Até {MAX_TRAINERS} treinadores, cada um com a sua coleção e a sua run: dá para ter {MAX_TRAINERS} runs ao mesmo tempo. Começar uma run nova com um treinador apaga a run que ele tinha.
      </p>
      <div className="trainer-slots">
        {trainers.map(t => {
          const st = trainerStats(t);
          const saved = peekRun(t.id);
          const going = runActive(saved);
          return (
            <div key={t.id} className={`trainer-card panel ${trainer?.id === t.id ? 'selected' : ''}`}>
              <TrainerAvatar avatar={t.avatar} name={t.name} />
              <h3>{t.name}</h3>
              <div className={`run-status ${going ? 'on' : ''}`}>{going ? `Run em andamento · ronda ${Math.max(1, roundOf(saved))}` : 'Sem run em andamento'}</div>
              <ul className="trainer-stats">
                <li>Coleção: {st.species}</li>
                <li>Runs: {st.runs}</li>
                <li>Melhor ronda: {st.best}</li>
                <li>Etapas concluídas: {st.clears}</li>
              </ul>
              {going ? (
                <>
                  <button className="btn primary" onClick={() => playSolo(t.id, false)}>
                    ▶ Continuar run
                  </button>
                  {confirmNew === t.id ? (
                    <button className="btn small danger" onClick={() => playSolo(t.id, true)}>
                      Apagar a run de agora e começar outra?
                    </button>
                  ) : (
                    <button className="btn small" onClick={() => setConfirmNew(t.id)}>
                      Nova run
                    </button>
                  )}
                </>
              ) : (
                <button className="btn primary" onClick={() => playSolo(t.id, true)}>
                  ▶ Nova run
                </button>
              )}
              <button className="btn small" onClick={() => selectTrainer(t.id)}>
                Menu do treinador
              </button>
              <button className="btn small" onClick={() => (setCreating(false), setEditing({...t}))}>
                Editar visual
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
          <button className="trainer-card panel new" onClick={() => (setEditing(null), setCreating(true))}>
            <span className="plus">+</span>
            Novo treinador
          </button>
        )}
      </div>
      <div className="panel career-strip">
        <h3>🌐 Carreira online com amigos</h3>
        <p className="hint">O host escolhe as regras, os amigos entram com o código e cada um joga no seu tempo. Nos torneios, vocês se enfrentam com os times de verdade.</p>
        {careers.length > 0 && (
          <div className="career-list">
            {careers.map(t => (
              <div key={t.id} className="career-chip">
                <TrainerAvatar avatar={t.avatar} name={t.name} size={40} />
                <div>
                  <b>{t.name}</b>
                  <div className="hint small">
                    Código {t.career!.code} · {t.career!.done ? 'carreira encerrada' : `temporada ${t.career!.season}`}
                    {(() => {
                      const r = peekRun(t.id);
                      return !t.career!.done && runActive(r) ? ` · ronda ${roundOf(r)}` : '';
                    })()}
                  </div>
                </div>
                <button className="btn small primary" onClick={() => void playOnline(t.id)}>
                  ▶ Jogar
                </button>
                <button className="btn small" onClick={() => (selectTrainer(t.id), setScreen('career'))}>
                  Classificação
                </button>
                {confirmDel === t.id ? (
                  <button className="btn small danger" onClick={() => removeTrainer(t.id)}>
                    Sair de vez?
                  </button>
                ) : (
                  <button className="btn small ghost" onClick={() => setConfirmDel(t.id)}>
                    Sair
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="row center">
          <button className="btn primary" onClick={() => setScreen('career')}>
            Criar ou entrar numa carreira
          </button>
        </div>
      </div>
      {creating && (
        <div className="panel trainer-new">
          <h3>Novo treinador</h3>
          <label className="field">
            Nome
            <input value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoFocus />
          </label>
          <AvatarEditor avatar={avatar} onChange={setAvatar} />
          <div className="row center">
            {all.length > 0 && (
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
      {editing && (
        <div className="panel trainer-new">
          <h3>Visual de {editing.name}</h3>
          <label className="field">
            Nome
            <input value={editing.name} maxLength={16} onChange={e => setEditing({...editing, name: e.target.value})} />
          </label>
          <AvatarEditor avatar={editing.avatar} onChange={a => setEditing({...editing, avatar: a})} />
          <div className="row center">
            <button className="btn" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button
              className="btn primary"
              disabled={!editing.name.trim()}
              onClick={() => (updateTrainer(editing.id, {name: editing.name, avatar: editing.avatar}), setEditing(null))}
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TitleScreen() {
  const {run, setScreen, abandonRun, collection, trainer, selectTrainer, career, careerPeers, trainers, playOnline} = useGame();
  const careers = trainers.filter(t => t.career);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const seasonWait = trainer?.career ? seasonBlockers(careerPeers, playerId(trainer.id), trainer.career.season) : [];
  const [confirm, setConfirm] = useState(false);
  if (!trainer) return <TrainerSelect />;
  const active = run && run.phase !== 'gameOver' && run.phase !== 'stageClear';
  const fav = favoriteOf(collection);
  const heroMons = fav ? [species(fav).name, 'Pikachu', 'Eevee'] : ['Charmander', 'Pikachu', 'Squirtle'];
  const st = statsOf(structuredClone(collection));
  const tiles: {icon: string; label: string; sub: string; go: Screen}[] = [
    {icon: 'star', label: 'Coleção', sub: `${Object.keys(collection.entries).length} Pokémon`, go: 'collection'},
    {icon: 'trophy', label: 'Torneios', sub: `${careerOf(structuredClone(collection)).cp} CP`, go: 'tournaments'},
    {icon: 'candy', label: 'Glória', sub: `${collection.glory ?? 0} para gastar`, go: 'glory'},
    {icon: 'egg', label: 'Creche', sub: collection.eggs?.length ? `${collection.eggs.length} ovo(s)` : 'fazer ovos', go: 'daycare'},
    {icon: 'map', label: 'Ranking', sub: `${careerOf(structuredClone(collection)).fame} de fama`, go: 'ranking'},
    {icon: 'heart', label: 'Conquistas', sub: `${ACHIEVEMENTS.filter(a => collection.achievements?.[a.id]).length}/${ACHIEVEMENTS.length}`, go: 'achievements'},
  ];
  return (
    <div className="screen title-screen">
      <div className="title-hero" style={{backgroundImage: `url(${FX('bg/route.png')})`}}>
        <div className="logo">
          <div className="logo-top">POKÉMON</div>
          <div className="logo-main">ROAD TO GLORY</div>
        </div>
        <div className="hero-mons">
          {heroMons.map((n, i) => (
            <span key={n} className="hero-mon" style={{animationDelay: `${i * 0.25}s`}}>
              <Sprite name={n} />
            </span>
          ))}
        </div>
      </div>
      <div className="title-row">
        <div className="panel trainer-badge">
          <TrainerAvatar avatar={trainer.avatar} name={trainer.name} size={64} />
          <div>
            <div className="trainer-name">{trainer.name}</div>
            <div className="hint small">
              {st.runs} runs · melhor ronda {st.bestWave}
            </div>
            <button className="link" onClick={() => selectTrainer(null)}>
              Trocar treinador
            </button>
          </div>
        </div>
        <div className="menu panel">
          {active && (
            <button className="btn primary big-play" onClick={() => setScreen('run')}>
              ▶ Continuar · ronda {roundOf(run)}
            </button>
          )}
          <button
            className={`btn ${active ? '' : 'primary big-play'}`}
            disabled={!!trainer.career?.done || (!!trainer.career && !career) || (!active && seasonWait.length > 0)}
            onClick={() => {
              if (active && !confirm) return setConfirm(true);
              abandonRun();
              useGame.setState({run: null});
              useGame.getState().setScreen('run');
            }}
          >
            {trainer.career?.done
              ? 'Carreira encerrada'
              : active && confirm
              ? trainer.career ? 'Certeza? A temporada atual acaba aqui' : 'Certeza? A run atual será perdida'
              : !active && seasonWait.length
              ? `Esperando ${seasonWait.map(p => p.name).join(', ')} terminar a temporada`
              : trainer.career
              ? `${active ? '' : '▶ '}${active ? 'Encerrar e ir para a' : 'Jogar'} temporada ${trainer.career.season + (active ? 1 : 0)}/${career?.rules.seasons ?? '?'}`
              : active ? 'Nova run' : '▶ Nova run'}
          </button>
          {trainer.career && (
            <button className="btn career-btn" onClick={() => setScreen('career')}>
              🌐 Carreira {trainer.career.code} <small>Classificação, regras e amigos</small>
            </button>
          )}
          {!trainer.career && (
            <button
              className="btn career-btn online-btn"
              onClick={() => {
                // Uma carreira só: entra direto nela. Várias: mostra a lista. Nenhuma: criar ou entrar com código.
                if (careers.length === 1) void playOnline(careers[0].id);
                else if (careers.length) setOnlineOpen(o => !o);
                else setScreen('career');
              }}
            >
              🌐 Jogar online{' '}
              <small>{careers.length === 1 ? `Continuar a carreira ${careers[0].career!.code}` : careers.length ? `${careers.length} carreiras: escolha uma` : 'Carreira com amigos: criar ou entrar com código'}</small>
            </button>
          )}
          {onlineOpen && !trainer.career && careers.length > 1 && (
            <div className="career-list">
              {careers.map(t => (
                <button key={t.id} className="career-chip pick" onClick={() => void playOnline(t.id)}>
                  <TrainerAvatar avatar={t.avatar} name={t.name} size={32} />
                  <div>
                    <b>{t.name}</b>
                    <div className="hint small">
                      Código {t.career!.code} · {t.career!.done ? 'encerrada' : `temporada ${t.career!.season}`}
                    </div>
                  </div>
                  <span>▶</span>
                </button>
              ))}
              <button className="btn small" onClick={() => setScreen('career')}>
                Criar ou entrar em outra carreira
              </button>
            </div>
          )}
          {careers.length === 1 && !trainer.career && (
            <button className="link small" onClick={() => setScreen('career')}>
              Criar ou entrar em outra carreira
            </button>
          )}
          <button className="btn quickplay-btn" onClick={() => setScreen('quickplay')}>
            ⚡ Quickplay <small>Rush com amigo · Campeonato rápido</small>
          </button>
          <div className="menu-tiles">
            {tiles.map(t => (
              <button key={t.label} className="menu-tile" onClick={() => setScreen(t.go)}>
                <PixelIcon name={t.icon} size={22} color="var(--ink)" />
                <b>{t.label}</b>
                <small>{t.sub}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
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
  const [view, setView] = useState<Species | null>(null);
  const [team, setTeam] = useState<string[]>([]);
  const [partnerPick, setPartner] = useState<string | null>(null);
  const partner = partnerPick && team.includes(partnerPick) ? partnerPick : team[0];
  const [sheet, setSheet] = useState<string | null>(null);
  const [eggId, setEggId] = useState<string | null>(null);
  const eggs = collection.eggs ?? [];
  const [tab, setTab] = useState<'starters' | 'collection'>('starters');

  // Pokémon já capturados por ESTE treinador (primeiro estágio, não lendários) também podem ser iniciais.
  const unlocked = useMemo(
    () =>
      Object.entries(collection.entries)
        .filter(([, e]) => e.caught > 0)
        .map(([id]) => species(id))
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

  const used = team.reduce((n, s) => n + teamCost(collection, s), 0);
  const TEAM_BUDGET = teamBudget(collection);
  const sel = selected ? species(selected) : null;
  const shown = view && sel && lineRoot(view.name) === lineRoot(sel.name) ? view : sel;
  const owned = sel ? peekEntry(collection, sel.name) : undefined;
  const selCost = sel ? teamCost(collection, sel.name) : 0;
  const inTeam = sel ? team.includes(sel.name) : false;
  const canAdd = !!sel && !inTeam && team.length < PARTY_SIZE && used + selCost <= TEAM_BUDGET;
  const pickCell = (name: string) => {
    setSelected(name);
    playCry(name);
  };
  const toggle = (name: string) => setTeam(t => (t.includes(name) ? t.filter(x => x !== name) : [...t, name]));

  const cell = (s: Species) => {
    const cost = teamCost(collection, s.name);
    return (
      <button
        key={s.id}
        className={`cell ${selected === s.name ? 'selected' : ''} ${collection.entries[lineRoot(s.name)] ? 'owned' : ''} ${team.includes(s.name) ? 'in-team' : ''}`}
        onClick={() => pickCell(s.name)}
        title={s.name}
      >
        <span className="cost-tag" title="Custo no time">
          {cost}
        </span>
        <Sprite name={s.name} size={80} />
        <span className="cell-name">{s.name}</span>
      </button>
    );
  };

  return (
    <div className="screen starter-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>Monte seu time inicial</h2>
        <span />
      </header>
      {firstRun && (
        <p className="banner">
          Primeira jornada! Cada Pokémon tem um custo (o número no canto) e você tem {TEAM_BUDGET} pontos. Dá para começar
          com um só ou juntar alguns. Tudo que você capturar vira opção nas próximas runs.
        </p>
      )}
      <div className="panel team-bar">
        <div className="team-slots">
          {team.map((n, i) => (
            <div key={n} className={`team-slot ${partner === n ? 'is-partner' : ''}`}>
              <Sprite name={n} size={56} />
              <span className="cost-tag">{teamCost(collection, n)}</span>
              {i === 0 && <span className="lead-tag">abre</span>}
              <button className="slot-x" onClick={() => toggle(n)} title="Tirar do time">
                ✕
              </button>
              <button className="slot-partner" onClick={() => setPartner(n)} title="Escolher como parceiro">
                <PixelIcon name="heart" size={14} color={partner === n ? 'var(--pink-d)' : '#cfc6dd'} />
              </button>
            </div>
          ))}
          {!team.length && <span className="hint">Escolha Pokémon abaixo e toque em "Pôr no time".</span>}
          {team.length > 0 && (
            <span className="hint partner-hint">
              <PixelIcon name="heart" size={12} color="var(--pink-d)" /> Parceiro: {peekEntry(collection, partner!)?.nickname ?? species(partner!).name}. Toque no
              coração de outro para trocar. O parceiro ganha corações em dobro.
            </span>
          )}
        </div>
        {eggs.length > 0 && (
          <div className="egg-pick">
            <span className="hint">Levar um ovo (não gasta pontos):</span>
            <div className="chips">
              <button className={`chip ${!eggId ? 'active' : ''}`} onClick={() => setEggId(null)}>
                Nenhum
              </button>
              {eggs.map(e => (
                <button key={e.id} className={`chip ${eggId === e.id ? 'active' : ''}`} onClick={() => setEggId(e.id)} title={`Choca em ${e.waves} rondas`}>
                  <PixelIcon name="egg" size={14} color="#c9b27a" /> {e.species} · {e.waves} rondas
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="budget">
          <div className="budget-label">
            Pontos <b>{used}</b>/{TEAM_BUDGET}
          </div>
          <div className="budget-track">
            <div className="budget-fill" style={{width: `${(used / TEAM_BUDGET) * 100}%`}} />
          </div>
          <button className="btn primary" disabled={!team.length} onClick={() => newRun(team, partner, eggId ?? undefined)}>
            Começar run
          </button>
        </div>
      </div>
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
                const list = trio.map(species).filter(s => matchesType(s, type));
                if (!list.length) return null;
                return (
                  <div key={g} className="gen-row panel">
                    <span className="gen-label">Gen {g + 1}</span>
                    <div className="gen-cells">{list.map(cell)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="panel">
              <p className="hint">Pokémon que você já capturou (forma básica). Eles começam com a ficha da coleção.</p>
              <div className="grid">{unlocked.filter(s => matchesType(s, type)).map(cell)}</div>
            </div>
          )}
        </div>
        <aside className={`detail panel ${sel ? '' : 'empty'}`}>
          {sel && shown ? (
            <>
              <EvoViewer name={sel.name} shiny={false} onChange={setView} />
              <h3>
                #{shown.num} {shown.name}
              </h3>
              <div className="row center">
                {shown.types.map(t => (
                  <TypeBadge key={t} type={t} info />
                ))}
                <RarityBadge rarity={rarityOf(sel)} />
              </div>
              <div className="base-stats">
                {Object.entries(shown.baseStats).map(([k, v]) => (
                  <div key={k} className="bs">
                    <span>{k.toUpperCase()}</span>
                    <div className="bs-track">
                      <div className={`bs-fill bs-${k}`} style={{width: `${Math.min(100, (v / 160) * 100)}%`}} />
                    </div>
                    <span>{v}</span>
                  </div>
                ))}
                <div className="bs total">Total {shown.bst}</div>
              </div>
              <MatchupPanel types={shown.types} title="Fraquezas e resistências" />
              {owned && (
                <div className="row center wrap">
                  <Candies line={sel.name} n={owned.candies} />
                  <Hearts entry={owned} small />
                  {owned.startMove && <span className="chip">Começa com {dex.moves.get(owned.startMove).name}</span>}
                  <button className="btn small" onClick={() => setSheet(sel.name)}>
                    Ver ficha
                  </button>
                </div>
              )}
              <p className="hint">
                Custo no time: <b>{selCost}</b>
                {!inTeam && !canAdd && team.length < PARTY_SIZE && ' · não cabe nos pontos que sobram'}
              </p>
              {inTeam ? (
                <button className="btn" onClick={() => toggle(sel.name)}>
                  Tirar do time
                </button>
              ) : (
                <button className="btn primary" disabled={!canAdd} onClick={() => toggle(sel.name)}>
                  Pôr no time ({selCost} {selCost === 1 ? 'ponto' : 'pontos'})
                </button>
              )}
            </>
          ) : (
            <p className="hint">Toque num Pokémon para ver os detalhes e as evoluções.</p>
          )}
        </aside>
      </div>
      {sheet && <LineSheet line={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

export function BiomeCard({biome, onClick, label}: {biome: Biome; onClick: () => void; label?: string}) {
  // Alguns moradores do bioma passeando no cartão.
  const locals = useMemo(() => {
    const p = biomePools(biome);
    return shuffle([...p.common, ...p.uncommon]).slice(0, 3);
  }, [biome]);
  return (
    <button className="biome-card" onClick={onClick} style={{['--bc' as string]: biome.color}}>
      <span className="biome-top">
        <span className="biome-thumb" style={{backgroundImage: `url(${FX(`bg/${biome.bg}.png`)})`, filter: biome.filter}} />
        <span className="biome-locals">
          {locals.map(s => (
            <Sprite key={s.id} name={s.name} size={44} />
          ))}
        </span>
      </span>
      <span className="biome-name">{label ?? biome.name}</span>
      {biome.region && <span className="biome-hidden">★ Bioma oculto</span>}
      <span className="row center wrap">
        {biome.types.map(t => (
          <TypeBadge key={t} type={t} small />
        ))}
      </span>
    </button>
  );
}

export function RegionCard({region, onClick, label}: {region: Region; onClick: () => void; label?: string}) {
  return (
    <button className="biome-card region-card" onClick={onClick} style={{['--bc' as string]: region.color}}>
      <span className="region-top">
        {region.icons.map(n => (
          <Sprite key={n} name={n} size={48} />
        ))}
      </span>
      <span className="biome-name">{label ?? region.name}</span>
      <span className="muted region-blurb">{region.blurb}</span>
    </button>
  );
}

/** Escolha da região: no começo (todas) ou com o Mapa de Região (3 sorteadas; para ficar, use o Passe de Estadia). */
export function RegionSelect() {
  const {run, chooseNextRegion} = useGame();
  const options = useMemo(
    () => shuffle(REGIONS.filter(r => r.id !== run?.region)).slice(0, 3 + (run?.perks?.regions ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run?.wave],
  );
  if (!run) return null;
  return (
    <div className="screen biome-screen">
      <h2>Mapa de Região: para onde vamos?</h2>
      <p className="hint">Na região nova você fica {regionStay(run)} rondas. Os Pokémon de lá aparecem mais.</p>
      <div className="biomes">
        {options.map(r => (
          <RegionCard key={r.id} region={r} onClick={() => chooseNextRegion(r.id)} />
        ))}
      </div>
    </div>
  );
}

export function BiomeSelect({mode}: {mode: 'start' | 'next'}) {
  const {run, chooseStartBiome, chooseNextBiome} = useGame();
  const [region, setRegion] = useState<string | null>(null);
  const options = useMemo(() => {
    if (mode === 'start') return BIOMES;
    const n = 3 + (run?.perks?.biomes ?? 0);
    const fresh = shuffle(BIOMES.filter(b => b.id !== run?.biome && !run?.visited?.includes(b.id)));
    const out = fresh.length >= n ? fresh.slice(0, n) : shuffle(BIOMES.filter(b => b.id !== run?.biome)).slice(0, n);
    // Com dica de viajante, o bioma oculto da região entra nas opções do Mapa.
    const hidden = hiddenBiomeOf(run?.region);
    if (hidden && hidden.id !== run?.biome && run?.diary?.some(id => getHint(id)?.biome === hidden.id)) out.unshift(hidden);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, run?.wave]);
  if (!run) return null;
  if (mode === 'start' && !region) {
    return (
      <div className="screen biome-screen">
        <h2>Escolha sua primeira região</h2>
        <p className="hint">Você fica 20 rondas em cada região. Depois, saem 4 regiões no sorteio e você escolhe (a atual só aparece se der sorte).</p>
        <div className="biomes">
          {REGIONS.map(r => (
            <RegionCard key={r.id} region={r} onClick={() => setRegion(r.id)} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="screen biome-screen">
      <h2>{mode === 'start' ? `${getRegion(region!).name}: escolha o primeiro bioma` : 'Mapa de Bioma: para onde vamos?'}</h2>
      <p className="hint">
        Cada bioma tem Pokémon dos tipos mostrados no cartão. Você fica 10 rondas nele.
        {mode === 'start' && (
          <>
            {' '}
            <button className="link" onClick={() => setRegion(null)}>
              Trocar região
            </button>
          </>
        )}
      </p>
      <div className="biomes">
        {options.map(b => (
          <BiomeCard key={b.id} biome={b} onClick={() => (mode === 'start' ? chooseStartBiome(b.id, region!) : chooseNextBiome(b.id))} />
        ))}
      </div>
    </div>
  );
}
