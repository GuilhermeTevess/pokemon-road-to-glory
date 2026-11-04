// Dream Team: monta o próprio time (até 5 guardados) e batalha contra o computador,
// contra os times dos amigos (o computador joga com eles) ou online, cada um no seu aparelho.
import {useEffect, useMemo, useState} from 'react';
import {ALL_TYPES, PLAYABLE, TYPE_PT, dex, isLegendary, species} from '../../data/dex';
import {getItem} from '../../data/items';
import {moveDescPt} from '../../data/movesPt';
import {
  BUILT_LEVEL, EV_MAX, EV_PRESETS, EV_TOTAL, MAX_TEAMS, PREMADE, STAT_SHORT, TEAM_SIZE, bestMoves, botTeam, builtStats, evTotal,
  friendTeams, itemsFor, learnable, loadTeams, premadeTeam, presetEvs, publishTeam, saveTeams, suggestedSet, teamProblems, teamToOwned, unpublishTeam,
} from '../../game/builder';
import type {BuiltMon, BuiltTeam, SharedTeam} from '../../game/builder';
import {recordMatch} from '../../game/history';
import {uid} from '../../game/rng';
import {quickPid, useGame} from '../../game/store';
import {STAT_IDS} from '../../game/types';
import type {OwnedMon, StatId} from '../../game/types';
import {RIVALS} from '../../data/rivals';
import {CategoryIcon, MatchupPanel, PixelIcon, ShinyStar, Sprite, TeamWeakness, TypeBadge, Types} from '../components';
import {playCry} from '../audio';
import {LocalDuel, PrepScreen, RushResult} from './QuickplayScreen';
import type {Player} from './QuickplayScreen';
import {TrainerAvatar} from './StartScreens';
import {OnlineBuilt} from './OnlineBuilt';
import {OpenRooms, Searching, entryKey, useMatchmaking} from '../lobby';
import type {OnlineEntry} from '../lobby';
import {useMatchGuard} from '../leaveGuard';

export const BUILDER_NAME = 'Dream Team';

const ALL_NATURES = dex.natures.all().map(n => n.name).sort();

function natureLabel(n: string): string {
  const nat = dex.natures.get(n);
  if (!nat.plus || !nat.minus) return `${n} (neutra)`;
  return `${n} (+${STAT_SHORT[nat.plus as StatId]} −${STAT_SHORT[nat.minus as StatId]})`;
}

const emptyTeam = (): BuiltTeam => ({id: uid(), name: 'Meu time', mons: [], updated: Date.now()});

/** Tela principal: os times guardados e os botões para criar, editar e jogar. */
export function BuilderScreen() {
  const {setScreen, trainer} = useGame();
  const tid = trainer?.id;
  const [teams, setTeams] = useState<BuiltTeam[]>(() => loadTeams(tid));
  const [editing, setEditing] = useState<BuiltTeam | null>(null);
  const [playing, setPlaying] = useState<BuiltTeam | null>(null);
  const [premades, setPremades] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const persist = (list: BuiltTeam[]) => {
    setTeams(list);
    if (tid) saveTeams(tid, list);
  };
  const saveTeam = (t: BuiltTeam) => {
    const next = {...t, updated: Date.now()};
    const list = teams.some(x => x.id === t.id) ? teams.map(x => (x.id === t.id ? next : x)) : [...teams, next];
    persist(list);
    // Os amigos podem enfrentar o seu time contra o computador (se der erro de internet, tudo bem).
    if (trainer) void publishTeam(quickPid(trainer.id), trainer.name, trainer.avatar, next).catch(() => undefined);
    setEditing(null);
  };
  const removeTeam = (id: string) => {
    persist(teams.filter(t => t.id !== id));
    if (trainer) void unpublishTeam(quickPid(trainer.id), id).catch(() => undefined);
    setConfirmDel(null);
  };

  if (editing) return <TeamEditor initial={editing} onSave={saveTeam} onCancel={() => setEditing(null)} />;
  if (playing) return <PlayBuilt team={playing} onExit={() => setPlaying(null)} />;

  const full = teams.length >= MAX_TEAMS;
  return (
    <div className="screen quickplay builder">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>{BUILDER_NAME}</h2>
        <span className="muted">
          {teams.length}/{MAX_TEAMS} times
        </span>
      </header>
      <p className="hint tb-intro">
        Monte o seu time do jeito que quiser: Pokémon, habilidade, nature, EVs, golpes e item. Todo mundo luta no nível {BUILT_LEVEL} com IVs perfeitos, então
        quem ganha é quem monta melhor. Dá para jogar contra o computador, contra os times dos amigos ou online.
      </p>
      <div className="tb-teams">
        {teams.map(t => {
          const problems = teamProblems(t);
          return (
            <div key={t.id} className="panel tb-team">
              <div className="tb-team-head">
                <b>{t.name}</b>
                <small className="muted">{t.mons.length}/{TEAM_SIZE} Pokémon</small>
              </div>
              <span className="team-row">
                {t.mons.map((m, i) => (
                  <Sprite key={i} name={m.species} size={48} still />
                ))}
              </span>
              {problems.length > 0 && <p className="tb-warn">
                  <PixelIcon name="warning" size={12} /> {problems[0]}
                </p>}
              <div className="tb-team-actions">
                <button className="btn primary" disabled={problems.length > 0} onClick={() => setPlaying(t)}>
                  Jogar
                </button>
                <button className="btn small" onClick={() => setEditing(structuredClone(t))}>
                  Editar
                </button>
                {confirmDel === t.id ? (
                  <button className="btn small danger" onClick={() => removeTeam(t.id)}>
                    Apagar mesmo?
                  </button>
                ) : (
                  <button className="btn small" onClick={() => setConfirmDel(t.id)} title="Apagar time" aria-label="Apagar time">
                    <PixelIcon name="trash" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!full && (
          <div className="panel tb-team tb-new">
            <b>Novo time</b>
            <button className="btn primary" onClick={() => setEditing(emptyTeam())}>
              Montar do zero
            </button>
            <button className="btn" onClick={() => setPremades(p => !p)}>
              Começar de um time pronto {premades ? '▴' : '▾'}
            </button>
          </div>
        )}
        {full && <p className="hint">Você já tem {MAX_TEAMS} times. Apague um para criar outro.</p>}
      </div>
      {premades && !full && (
        <div className="tb-premades">
          <p className="hint">Times montados com estratégia. Escolha um para editar do seu jeito (o computador também usa esses times).</p>
          {PREMADE.map((p, i) => (
            <button key={p.name} className="panel tb-premade" onClick={() => setEditing(premadeTeam(i))}>
              <b>{p.name}</b>
              <span className="team-row">
                {p.sets.map(s => (
                  <Sprite key={s} name={s.split('|')[0]} size={40} still />
                ))}
              </span>
              <small className="muted">{p.about}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Editor do time

function TeamEditor({initial, onSave, onCancel}: {initial: BuiltTeam; onSave: (t: BuiltTeam) => void; onCancel: () => void}) {
  const [team, setTeam] = useState<BuiltTeam>(initial);
  const [slot, setSlot] = useState<number | null>(initial.mons.length ? 0 : null);
  const [picking, setPicking] = useState(initial.mons.length === 0);
  const [weak, setWeak] = useState(false);
  const problems = teamProblems(team);
  const party = useMemo(() => teamToOwned(team), [team]);

  const setMon = (i: number, m: BuiltMon) => setTeam(t => ({...t, mons: t.mons.map((x, k) => (k === i ? m : x))}));
  const pickSpecies = (name: string) => {
    playCry(name);
    const set = suggestedSet(name);
    if (slot !== null && slot < team.mons.length) setMon(slot, set);
    else {
      setTeam(t => ({...t, mons: [...t.mons, set]}));
      setSlot(team.mons.length);
    }
    setPicking(false);
  };
  const removeMon = (i: number) => {
    setTeam(t => ({...t, mons: t.mons.filter((_, k) => k !== i)}));
    setSlot(null);
  };
  const cur = slot !== null ? team.mons[slot] : undefined;

  return (
    <div className="screen quickplay builder">
      <header className="bar">
        <button className="btn small" onClick={onCancel}>
          <PixelIcon name="back" /> Sair sem salvar
        </button>
        <input className="tb-name" value={team.name} maxLength={20} onChange={e => setTeam({...team, name: e.target.value})} aria-label="Nome do time" />
        <button className="btn primary" disabled={!team.mons.length} onClick={() => onSave({...team, name: team.name.trim() || 'Meu time'})}>
          Salvar
        </button>
      </header>
      <div className="tb-slots">
        {Array.from({length: TEAM_SIZE}, (_, i) => {
          const m = team.mons[i];
          if (!m)
            return i === team.mons.length ? (
              <button key={i} className={`tb-slot empty ${picking && slot === null ? 'on' : ''}`} onClick={() => (setSlot(null), setPicking(true))}>
                <span className="tb-plus">＋</span>
                <small>Adicionar</small>
              </button>
            ) : (
              <span key={i} className="tb-slot blank" />
            );
          return (
            <button key={i} className={`tb-slot ${slot === i ? 'on' : ''}`} onClick={() => (setSlot(i), setPicking(false))}>
              <Sprite name={m.species} size={56} still />
              <small>{species(m.species).name}</small>
              {m.item && getItem(m.item).megaFor && <span className="mega-tag">Mega</span>}
            </button>
          );
        })}
      </div>
      {problems.length > 0 && team.mons.length > 0 && (
        <div className="tb-warn">
          {problems.map(p => (
            <div key={p}>
              <PixelIcon name="warning" size={12} /> {p}
            </div>
          ))}
        </div>
      )}
      {team.mons.length > 0 && (
        <div className="prep-tools">
          <button className={`btn small ${weak ? 'on' : ''}`} onClick={() => setWeak(!weak)}>
            Fraquezas do time {weak ? '▴' : '▾'}
          </button>
        </div>
      )}
      {weak && <TeamWeakness party={party} compact />}
      {picking ? (
        <SpeciesPicker taken={team.mons.map(m => m.species)} onPick={pickSpecies} onCancel={team.mons.length ? () => setPicking(false) : undefined} />
      ) : cur && slot !== null ? (
        <MonEditor key={slot + cur.species} mon={cur} team={team} onChange={m => setMon(slot, m)} onSwap={() => setPicking(true)} onRemove={() => removeMon(slot)} />
      ) : (
        <p className="hint">Toque num Pokémon para editar ou em ＋ para adicionar.</p>
      )}
    </div>
  );
}

const bstOf = (n: string) => Object.values(species(n).baseStats).reduce((a, b) => a + b, 0);

/** Escolher a espécie: busca por nome e filtro por tipo. */
function SpeciesPicker({taken, onPick, onCancel}: {taken: string[]; onPick: (name: string) => void; onCancel?: () => void}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [legends, setLegends] = useState(false);
  const [onlyFinal, setOnlyFinal] = useState(true);
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return PLAYABLE.filter(
      s =>
        (!query || s.name.toLowerCase().includes(query)) &&
        (!type || s.types.includes(type)) &&
        (legends || !isLegendary(s)) &&
        (!onlyFinal || !s.nfe) &&
        !taken.includes(s.name),
    )
      .sort((a, b) => (query ? a.name.localeCompare(b.name) : bstOf(b.name) - bstOf(a.name)))
      .slice(0, 60);
  }, [q, type, legends, onlyFinal, taken]);
  return (
    <div className="panel tb-picker">
      <div className="tb-picker-head">
        <b>Escolha um Pokémon</b>
        {onCancel && (
          <button className="btn small" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      <input className="tb-search" placeholder="Buscar pelo nome (em inglês, ex.: Garchomp)" value={q} onChange={e => setQ(e.target.value)} autoFocus />
      <div className="tb-type-filter">
        <button className={`chip ${!type ? 'active' : ''}`} onClick={() => setType(null)}>
          Todos
        </button>
        {ALL_TYPES.map(t => (
          <button key={t} className={`chip ${type === t ? 'active' : ''}`} onClick={() => setType(type === t ? null : t)}>
            {TYPE_PT[t] ?? t}
          </button>
        ))}
      </div>
      <label className="rush-check">
        <input type="checkbox" checked={onlyFinal} onChange={e => setOnlyFinal(e.target.checked)} /> Só a última evolução
      </label>
      <label className="rush-check">
        <input type="checkbox" checked={legends} onChange={e => setLegends(e.target.checked)} /> Mostrar lendários
      </label>
      <p className="hint small">{q ? 'Resultados da busca' : 'Os mais fortes primeiro (soma dos atributos).'}</p>
      <div className="tb-species-list">
        {list.map(s => (
          <button key={s.name} className="tb-species" onClick={() => onPick(s.name)}>
            <Sprite name={s.name} size={44} still />
            <span className="tb-species-info">
              <b>{s.name}</b>
              <Types name={s.name} />
            </span>
            <small className="muted">{bstOf(s.name)}</small>
          </button>
        ))}
        {!list.length && <p className="hint">Nenhum Pokémon encontrado.</p>}
      </div>
    </div>
  );
}

/** Edita um Pokémon do time. */
function MonEditor({mon, team, onChange, onSwap, onRemove}: {mon: BuiltMon; team: BuiltTeam; onChange: (m: BuiltMon) => void; onSwap: () => void; onRemove: () => void}) {
  const sp = species(mon.species);
  const [tab, setTab] = useState<'moves' | 'ability' | 'item' | 'stats'>('moves');
  const [weak, setWeak] = useState(false);
  const stats = builtStats(mon);
  const abilities = [...new Set(Object.values(sp.abilities).filter(Boolean) as string[])];
  const otherMega = team.mons.some(m => m !== mon && m.item && getItem(m.item).megaFor);
  return (
    <div className="panel tb-editor">
      <div className="tb-editor-head">
        <Sprite name={mon.species} size={96} />
        <div className="tb-editor-title">
          <b>{sp.name}</b> <span className="lv">Nv. {BUILT_LEVEL}</span>
          <Types name={mon.species} info />
          <small className="muted">
            {mon.ability} · {natureLabel(mon.nature)}
            {mon.item ? ` · ${getItem(mon.item).name}` : ''}
          </small>
          <div className="tb-editor-btns">
            <button className="btn small" onClick={() => onChange({...suggestedSet(mon.species), shiny: mon.shiny})} title="Monta tudo sozinho com um set que funciona">
              Montar sozinho
            </button>
            <button className="btn small" onClick={onSwap}>
              Trocar Pokémon
            </button>
            <button className="btn small" onClick={onRemove}>
              Tirar do time
            </button>
            <button className={`btn small ${weak ? 'on' : ''}`} onClick={() => setWeak(!weak)}>
              Fraquezas {weak ? '▴' : '▾'}
            </button>
            <label className="rush-check">
              <input type="checkbox" checked={!!mon.shiny} onChange={e => onChange({...mon, shiny: e.target.checked})} /> Shiny <ShinyStar />
            </label>
          </div>
        </div>
      </div>
      {weak && <MatchupPanel types={[...sp.types]} />}
      <div className="tabs tb-tabs">
        {(
          [
            ['moves', `Golpes (${mon.moves.length}/4)`],
            ['ability', 'Habilidade'],
            ['item', 'Item'],
            ['stats', 'Nature e EVs'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'moves' && <MovesTab mon={mon} onChange={onChange} />}
      {tab === 'ability' && (
        <div className="tb-options">
          {abilities.map(a => (
            <button key={a} className={`rush-mode ${mon.ability === a ? 'on' : ''}`} onClick={() => onChange({...mon, ability: a})}>
              <b>
                {a} {a === sp.abilities.H && <small className="muted">(oculta)</small>}
              </b>
              <span>{dex.abilities.get(a).shortDesc}</span>
            </button>
          ))}
        </div>
      )}
      {tab === 'item' && (
        <div className="tb-options">
          <button className={`rush-mode ${!mon.item ? 'on' : ''}`} onClick={() => onChange({...mon, item: undefined})}>
            <b>Sem item</b>
          </button>
          {itemsFor(mon.species).map(it => {
            const blocked = !!it.megaFor && otherMega;
            return (
              <button key={it.id} className={`rush-mode ${mon.item === it.id ? 'on' : ''}`} disabled={blocked} onClick={() => onChange({...mon, item: it.id})}>
                <b>{it.name}</b>
                <span>{blocked ? 'Outro Pokémon do time já leva Mega Pedra (só 1 por time).' : it.megaFor ? 'Faz ele mega-evoluir na batalha (botão "Mega evoluir").' : it.desc}</span>
              </button>
            );
          })}
        </div>
      )}
      {tab === 'stats' && <StatsTab mon={mon} stats={stats} onChange={onChange} />}
    </div>
  );
}

/** Golpes: 4 vagas; toque numa vaga para escolher na lista. */
function MovesTab({mon, onChange}: {mon: BuiltMon; onChange: (m: BuiltMon) => void}) {
  const [slot, setSlot] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [onlyDamage, setOnlyDamage] = useState(false);
  const sp = species(mon.species);
  const all = useMemo(() => {
    const best = bestMoves(mon.species);
    const rank = new Map(best.map((m, i) => [m, i]));
    return learnable(mon.species).sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999) || a.localeCompare(b));
  }, [mon.species]);
  const query = q.trim().toLowerCase();
  const list = all.filter(id => {
    const mv = dex.moves.get(id);
    return (!query || mv.name.toLowerCase().includes(query) || (TYPE_PT[mv.type] ?? '').toLowerCase().includes(query)) && (!onlyDamage || mv.category !== 'Status');
  });
  const setMove = (id: string) => {
    const moves = [...mon.moves];
    if (slot !== null && slot < moves.length) moves[slot] = id;
    else moves.push(id);
    onChange({...mon, moves: moves.slice(0, 4)});
    setSlot(null);
  };
  return (
    <div className="tb-moves">
      <p className="hint small">
        <PixelIcon name="star" size={12} color="var(--butter-d)" /> = do mesmo tipo dele (bate 1,5x mais forte). A lista começa pelos golpes que mais combinam com ele.</p>
      <div className="tb-move-slots">
        {[0, 1, 2, 3].map(i => {
          const id = mon.moves[i];
          const mv = id ? dex.moves.get(id) : null;
          return (
            <div key={i} className={`tb-move-slot ${slot === i || (slot === null && !id && i === mon.moves.length) ? 'on' : ''}`}>
              {mv ? (
                <>
                  <button className="tb-move-pick" onClick={() => setSlot(slot === i ? null : i)}>
                    <TypeBadge type={mv.type} small /> <b>{mv.name}</b> {sp.types.includes(mv.type) && mv.category !== 'Status' && <PixelIcon name="star" size={12} color="var(--butter-d)" />}
                    <small className="muted">{mv.basePower ? ` Poder ${mv.basePower}` : ' Status'}</small>
                  </button>
                  <button className="btn small" title="Tirar golpe" onClick={() => onChange({...mon, moves: mon.moves.filter((_, k) => k !== i)})}>
                    ✕
                  </button>
                </>
              ) : (
                <button className="tb-move-pick empty" onClick={() => setSlot(null)} disabled={i !== mon.moves.length}>
                  {i === mon.moves.length ? '＋ Escolha um golpe na lista' : 'Vazio'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {(slot !== null || mon.moves.length < 4) && (
        <>
          <p className="hint small">{slot !== null ? `Trocando ${dex.moves.get(mon.moves[slot]).name} por:` : 'Adicionar golpe:'}</p>
          <input className="tb-search" placeholder="Buscar golpe ou tipo" value={q} onChange={e => setQ(e.target.value)} />
          <label className="rush-check">
            <input type="checkbox" checked={onlyDamage} onChange={e => setOnlyDamage(e.target.checked)} /> Só golpes de dano
          </label>
          <div className="tb-move-list">
            {list.slice(0, 80).map(id => {
              const mv = dex.moves.get(id);
              const has = mon.moves.includes(id);
              return (
                <button key={id} className="tb-move" disabled={has} onClick={() => setMove(id)}>
                  <span className="tb-move-top">
                    <TypeBadge type={mv.type} small />
                    <CategoryIcon category={mv.category} />
                    <b>{mv.name}</b>
                    {sp.types.includes(mv.type) && mv.category !== 'Status' && <span title="Mesmo tipo: 1,5x">
                        <PixelIcon name="star" size={12} color="var(--butter-d)" />
                      </span>}
                    <small className="muted">
                      {mv.basePower ? `Poder ${mv.basePower}` : ''}
                      {mv.accuracy !== true ? ` · Precisão ${mv.accuracy}%` : ''}
                    </small>
                  </span>
                  <small className="tb-move-desc">{moveDescPt(mv.name)}</small>
                </button>
              );
            })}
            {list.length > 80 && <p className="hint small">Mais {list.length - 80} golpes: use a busca.</p>}
          </div>
        </>
      )}
    </div>
  );
}

/** Nature e EVs, com presets explicados e os atributos finais. */
function StatsTab({mon, stats, onChange}: {mon: BuiltMon; stats: Record<StatId, number>; onChange: (m: BuiltMon) => void}) {
  const total = evTotal(mon.evs);
  const nat = dex.natures.get(mon.nature);
  const sp = species(mon.species);
  const setEv = (s: StatId, v: number) => {
    const others = total - mon.evs[s];
    const val = Math.max(0, Math.min(EV_MAX, v, EV_TOTAL - others));
    onChange({...mon, evs: {...mon.evs, [s]: val - (val % 4)}});
  };
  return (
    <div className="tb-stats">
      <label className="tb-field">
        <b>Nature</b>
        <select value={mon.nature} onChange={e => onChange({...mon, nature: e.target.value})}>
          {ALL_NATURES.map(n => (
            <option key={n} value={n}>
              {natureLabel(n)}
            </option>
          ))}
        </select>
      </label>
      <p className="hint small">A nature aumenta um atributo em 10% e diminui outro. Dica: diminua o ataque que ele não usa (Ataque se ele bate com golpes especiais, At. Esp. se bate com físicos).</p>
      <b>EVs ({total}/{EV_TOTAL})</b>
      <p className="hint small">EVs são pontos de treino: cada 4 pontos dão +1 no atributo (no nível 50, 252 pontos = +32). No máximo {EV_MAX} por atributo e {EV_TOTAL} no total.</p>
      <div className="tb-presets">
        {EV_PRESETS.map(p => (
          <button key={p.name} className="chip" title={p.about} onClick={() => onChange({...mon, evs: presetEvs(p.evs)})}>
            {p.name}
          </button>
        ))}
        <button className="chip" onClick={() => onChange({...mon, evs: presetEvs({})})}>
          Zerar
        </button>
      </div>
      <div className="tb-ev-rows">
        {STAT_IDS.map(s => (
          <div key={s} className="tb-ev-row">
            <span className={`tb-ev-label ${nat.plus === s ? 'plus' : nat.minus === s ? 'minus' : ''}`}>
              {STAT_SHORT[s]}
              {nat.plus === s ? ' ▲' : nat.minus === s ? ' ▼' : ''}
            </span>
            <small className="muted tb-ev-base">base {sp.baseStats[s]}</small>
            <input type="range" min={0} max={EV_MAX} step={4} value={mon.evs[s]} onChange={e => setEv(s, Number(e.target.value))} />
            <input className="tb-ev-num" type="number" min={0} max={EV_MAX} step={4} value={mon.evs[s]} onChange={e => setEv(s, Number(e.target.value) || 0)} />
            <b className="tb-ev-final">{stats[s]}</b>
          </div>
        ))}
      </div>
      <p className="hint small">O número da direita é o atributo final dele na batalha.</p>
    </div>
  );
}

// ------------------------------------------------------------------ Jogar

const cpuFoe = (): Player => {
  const r = RIVALS[Math.floor(Math.random() * RIVALS.length)];
  return {name: r.name, avatar: r.avatar};
};

/** Ordem do computador: abre com o mais rápido. */
function cpuOrder(team: OwnedMon[]): OwnedMon[] {
  const fastest = [...team].sort((a, b) => species(b.species).baseStats.spe - species(a.species).baseStats.spe)[0];
  return [fastest, ...team.filter(m => m !== fastest)];
}

type Foe = {player: Player; team: BuiltTeam; kind: 'cpu' | 'friend'};

function PlayBuilt({team, onExit}: {team: BuiltTeam; onExit: () => void}) {
  const {trainer} = useGame();
  const me: Player = {name: trainer?.name ?? 'Você', avatar: trainer?.avatar ?? 'red'};
  const [step, setStep] = useState<'pick' | 'online' | 'prep' | 'battle' | 'end'>('pick');
  const [foe, setFoe] = useState<Foe | null>(null);
  const [teams, setTeams] = useState<[OwnedMon[], OwnedMon[]]>([[], []]);
  const [winner, setWinner] = useState(0);
  const [friends, setFriends] = useState<SharedTeam[] | null>(null);
  const [friendErr, setFriendErr] = useState(false);
  const [online, setOnline] = useState<OnlineEntry | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [listed, setListed] = useState(false);
  const match = useMatchmaking('built', undefined, setOnline);

  useEffect(() => {
    if (!trainer) return;
    friendTeams(quickPid(trainer.id))
      .then(setFriends)
      .catch(() => setFriendErr(true));
  }, [trainer]);

  // Sair no meio da partida conta como derrota.
  useMatchGuard(!online && !!foe && (step === 'prep' || step === 'battle'), () => {
    if (!foe) return;
    recordMatch(trainer?.id, {
      mode: 'built',
      online: false,
      won: false,
      vs: foe.kind === 'friend' ? `${foe.player.name} (${foe.team.name})` : foe.player.name,
      vsAvatar: foe.player.avatar,
      vsKind: foe.kind === 'friend' ? 'friend' : 'cpu',
      mine: teams[0].map(m => m.species),
      theirs: teams[1].map(m => m.species),
      note: 'Saiu no meio da partida',
    });
  });

  const startVs = (f: Foe) => {
    setFoe(f);
    setTeams([teamToOwned(team), cpuOrder(teamToOwned(f.team))]);
    setStep('prep');
  };

  if (online)
    return (
      <OnlineBuilt
        key={entryKey(online)}
        role={online.role}
        code={online.code}
        me={me}
        team={team}
        onExit={() => setOnline(null)}
        mm={{auto: online.auto, listed: online.listed, onMiss: online.auto ? match.miss : undefined, onSwitch: match.switchTo}}
      />
    );
  if (match.searching) return <Searching title="Dream Team online" onExit={match.cancel} />;

  if (step === 'pick')
    return (
      <div className="screen quickplay builder">
        <header className="bar">
          <button className="btn small" onClick={onExit}>
            <PixelIcon name="back" /> Voltar
          </button>
          <h2>Jogar com {team.name}</h2>
        </header>
        <span className="team-row tb-mine">
          {team.mons.map((m, i) => (
            <Sprite key={i} name={m.species} size={48} still />
          ))}
        </span>
        <div className="prep-cols tb-play">
          <div className="panel">
            <h3>
              <PixelIcon name="phone" /> Offline
            </h3>
            <button className="rush-mode" onClick={() => startVs({player: cpuFoe(), team: botTeam(), kind: 'cpu'})}>
              <b>
                <PixelIcon name="robot" /> Contra o computador
              </b>
              <span>Ele usa um dos times prontos, montados com estratégia (chuva, sol, areia...).</span>
            </button>
            <h4>Times dos amigos</h4>
            <p className="hint small">Times que os outros jogadores salvaram. O computador joga com eles.</p>
            {friends === null && !friendErr && <p className="hint waiting">Buscando times...</p>}
            {friendErr && <p className="hint">Sem internet agora: não deu para buscar os times dos amigos.</p>}
            {friends?.length === 0 && <p className="hint">Ninguém salvou um time ainda.</p>}
            <div className="tb-friends">
              {friends?.map(f => (
                <button key={`${f.ownerId}-${f.team.id}`} className="rush-mode tb-friend" onClick={() => startVs({player: {name: f.owner, avatar: f.avatar}, team: f.team, kind: 'friend'})}>
                  <span className="tb-friend-head">
                    <TrainerAvatar avatar={f.avatar} name={f.owner} size={32} />
                    <b>
                      {f.owner} · {f.team.name}
                    </b>
                  </span>
                  <span className="team-row">
                    {f.team.mons.map((m, i) => (
                      <Sprite key={i} name={m.species} size={36} still />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="panel">
            <h3>
              <PixelIcon name="globe" /> Online
            </h3>
            <p className="hint small">Cada um no seu aparelho, com o time que montou.</p>
            <button className="btn primary big" onClick={match.start}>
              Procurar partida
            </button>
            <p className="hint small">Entra na sala de quem está esperando. Se não tiver ninguém, você espera o próximo.</p>
            <OpenRooms game="built" onJoin={c => setOnline({role: 'guest', code: c})} />
            <h4>
              <PixelIcon name="people" /> Com um amigo
            </h4>
            <label className="check-row">
              <input type="checkbox" checked={listed} onChange={e => setListed(e.target.checked)} />
              Mostrar também em "Salas abertas"
            </label>
            <button className="btn big" onClick={() => setOnline({role: 'host', listed})}>
              Criar sala e pegar o código
            </button>
            <p className="hint small">Ou entre na sala do amigo:</p>
            <div className="rush-online-row">
              <input placeholder="CÓDIGO" maxLength={5} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
              <button className="btn primary" disabled={joinCode.length < 5} onClick={() => setOnline({role: 'guest', code: joinCode})}>
                Entrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  if (!foe) return null;
  const players: [Player, Player] = [me, foe.player];

  if (step === 'prep')
    return (
      <PrepScreen
        player={me}
        team={teams[0]}
        foe={{player: foe.player, team: teams[1].map(m => m.species)}}
        mega={false}
        keepItems
        curtain={false}
        onDone={t => {
          setTeams([t, teams[1]]);
          setStep('battle');
        }}
      />
    );

  if (step === 'battle')
    return (
      <LocalDuel
        players={players}
        teams={teams}
        curtain={false}
        cpu
        onEnd={(w, ko) => {
          recordMatch(trainer?.id, {
            mode: 'built',
            online: false,
            won: w === 0,
            vs: foe.kind === 'friend' ? `${foe.player.name} (${foe.team.name})` : foe.player.name,
            vsAvatar: foe.player.avatar,
            vsKind: foe.kind === 'friend' ? 'friend' : 'cpu',
            mine: teams[0].map(m => m.species),
            theirs: teams[1].map(m => m.species),
            note: `${team.name} contra ${foe.team.name}`,
            ko,
          });
          setWinner(w);
          setStep('end');
        }}
      />
    );

  return (
    <RushResult
      title={`${players[winner].name} venceu!`}
      winner={players[winner]}
      team={teams[winner]}
      onRematch={() => {
        setTeams([teamToOwned(team), cpuOrder(teamToOwned(foe.team))]);
        setStep('prep');
      }}
      newLabel="Outro adversário"
      onNew={() => setStep('pick')}
      onExit={onExit}
    />
  );
}
