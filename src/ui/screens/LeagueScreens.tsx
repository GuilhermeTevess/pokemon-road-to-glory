import {roundOf, roundsOf} from '../../game/career';
// Ranking (temporada e geral) e Conquistas.
import {useState} from 'react';
import {getRegion} from '../../data/regions';
import {ACHIEVEMENTS} from '../../game/achievements';
import {SOURCE_LABEL, overallRanking, seasonPoints, seasonRanking} from '../../game/league';
import type {PointEntry, PointSource, RankRow, SeasonRec} from '../../game/league';
import {careerOf} from '../../game/meta';
import {fameLabel} from '../../game/tournament';
import {useGame} from '../../game/store';
import type {RunState} from '../../game/types';
import {Modal, PixelIcon, Sprite} from '../components';
import {TrainerAvatar} from './StartScreens';
import {ProfileModal} from './ProfileModal';
import {profileOfBot, profileOfRun} from '../../game/profile';
import type {Profile} from '../../game/profile';

const MEDAL = ['🥇', '🥈', '🥉'];

export function RankTable({rows, limit, log, profileOf}: {rows: RankRow[]; limit?: number; log?: PointEntry[]; profileOf?: (r: RankRow) => Profile | null}) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const meIdx = rows.findIndex(r => r.player);
  const shown = limit && meIdx >= limit ? [...rows.slice(0, limit), rows[meIdx]] : rows.slice(0, limit ?? rows.length);
  return (
    <div className="rank-table">
      {shown.map(r => {
        const pos = rows.indexOf(r) + 1;
        return (
          <div key={r.name + pos} className={`rank-row ${r.player ? 'me' : ''} ${pos <= 3 ? 'top' : ''}`}>
            <span className="rank-pos">{MEDAL[pos - 1] ?? `${pos}º`}</span>
            <TrainerAvatar avatar={r.avatar ?? 'red'} name={r.name} size={36} />
            <span className="rank-name">
              {profileOf && profileOf(r) ? (
                <button className="link" title="Ver perfil" onClick={() => setProfile(profileOf(r))}>
                  <b>{r.name} ▸</b>
                </button>
              ) : (
                <b>{r.name}</b>
              )}
              {r.region && <small className="muted">{getRegion(r.region).name}</small>}
            </span>
            {r.fav && <Sprite name={r.fav} size={36} still />}
            {r.player && log ? (
              <button className="rank-pts link" title="Ver de onde vieram os pontos" onClick={() => setOpen(true)}>
                {r.points} ▸
              </button>
            ) : (
              <span className="rank-pts">{r.points}</span>
            )}
          </div>
        );
      })}
      {profile && <ProfileModal profile={profile} onClose={() => setProfile(null)} />}
      {open && log && (
        <Modal onClose={() => setOpen(false)}>
          <h2>De onde vieram seus pontos</h2>
          <PointLog log={log} />
        </Modal>
      )}
    </div>
  );
}

/** Extrato: cada ponto com o motivo, o mais novo primeiro. */
export function PointLog({log}: {log: PointEntry[]}) {
  if (!log.length) return <p className="muted">Nenhum ponto ainda. Torneios, lendas, ginásios e viajantes dão pontos.</p>;
  return (
    <div className="point-log">
      {[...log].reverse().map((e, i) => (
        <div key={i} className="point-row">
          <b>+{e.pts}</b>
          <span>{e.label}</span>
          <small className="muted">ronda {e.wave}</small>
        </div>
      ))}
    </div>
  );
}

export function Breakdown({points, log}: {points: Partial<Record<PointSource, number>>; log?: PointEntry[]}) {
  const [open, setOpen] = useState<PointSource | null>(null);
  const rows = (Object.keys(SOURCE_LABEL) as PointSource[]).filter(k => points[k]);
  if (!rows.length) return <p className="muted">Nenhum ponto ainda. Torneios, lendas, ginásios e viajantes dão pontos.</p>;
  return (
    <div className="breakdown">
      {rows.map(k => {
        const items = log?.filter(e => e.source === k) ?? [];
        return (
          <div key={k}>
            <button className="breakdown-row" disabled={!items.length} onClick={() => setOpen(open === k ? null : k)}>
              <span>
                {items.length ? (open === k ? '▾ ' : '▸ ') : ''}
                {SOURCE_LABEL[k]}
              </span>
              <b>{points[k]}</b>
            </button>
            {open === k && <PointLog log={items} />}
          </div>
        );
      })}
      {log && <p className="hint small">Toque numa linha para ver cada ponto.</p>}
    </div>
  );
}

/** Bloco da tela final: ranking da temporada, top 3 e de onde vieram os pontos. */
export function SeasonSummary({run}: {run: RunState}) {
  const {collection, trainer} = useGame();
  const me = {name: trainer?.name ?? 'Você', avatar: trainer?.avatar};
  const rows = seasonRanking(structuredClone(collection), run, me, true);
  const rec: Pick<SeasonRec, 'rank' | 'points' | 'breakdown'> = run.season ?? {rank: rows.findIndex(r => r.player) + 1, points: seasonPoints(run), breakdown: run.points ?? {}};
  return (
    <div className="panel season-summary">
      <h3>
        Ranking da temporada: você ficou em <b>{rec.rank}º</b> com {rec.points} pontos
      </h3>
      <div className="podium">
        {rows.slice(0, 3).map((r, i) => (
          <div key={r.name} className={`podium-step p${i + 1} ${r.player ? 'me' : ''}`}>
            <TrainerAvatar avatar={r.avatar ?? 'red'} name={r.name} size={48} />
            <b>{r.name}</b>
            <span>{r.points}</span>
            <span className="podium-medal">{MEDAL[i]}</span>
          </div>
        ))}
      </div>
      <Breakdown points={rec.breakdown} log={run.season?.log ?? run.pointLog} />
    </div>
  );
}

export function RankingScreen() {
  const {collection, trainer, run, setScreen} = useGame();
  const col = structuredClone(collection);
  const active = run && run.party.length > 0 && run.phase !== 'gameOver' && run.phase !== 'stageClear';
  const [tab, setTab] = useState<'season' | 'all' | 'history'>(active ? 'season' : 'all');
  const me = {name: trainer?.name ?? 'Você', avatar: trainer?.avatar};
  const c = careerOf(col);
  const seasons = col.league?.seasons ?? [];
  return (
    <div className="screen ranking-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>Ranking</h2>
        <span />
      </header>
      <p className="hint">
        Sua fama: <b>{c.fame}</b> ({fameLabel(c.fame)}). Torneios, lendas, ginásios e viajantes dão pontos. O Mundial vale mais que tudo.
      </p>
      <div className="tabs big">
        {active && (
          <button className={`tab ${tab === 'season' ? 'active' : ''}`} onClick={() => setTab('season')}>
            Temporada atual
          </button>
        )}
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          Geral
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          Temporadas · {seasons.length}
        </button>
      </div>
      {tab === 'season' && active && run && (
        <>
          <p className="muted">
            Ronda {roundOf(run)}/{roundsOf(run)}. Os rivais jogam a temporada junto com você: toque no nome de alguém para ver o perfil (insígnias, parceiro, Pokémon
            que mais joga).
          </p>
          <RankTable
            rows={seasonRanking(col, run, me)}
            log={run.pointLog ?? []}
            profileOf={r => {
              if (r.player) return profileOfRun(run, me);
              const b = run.world?.bots.find(x => x.name === r.name);
              return b ? profileOfBot(b) : null;
            }}
          />
          <h3>Seus pontos nesta temporada</h3>
          <Breakdown points={run.points ?? {}} log={run.pointLog ?? []} />
        </>
      )}
      {tab === 'all' && <RankTable rows={overallRanking(col, me)} />}
      {tab === 'history' &&
        (seasons.length ? (
          <div className="season-list">
            {seasons.map(s => (
              <div key={s.at} className="panel season-item">
                <b>{s.rank}º lugar</b>
                <span>{s.points} pontos</span>
                <span className="muted">
                  Ronda {s.wave}
                  {s.region ? ` · ${getRegion(s.region).name}` : ''} · {new Date(s.at).toLocaleDateString('pt-BR')}
                </span>
                <span className="muted">Campeão: {s.top[0]?.name}</span>
                {s.log && s.log.length > 0 && <SeasonLog log={s.log} />}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Nenhuma temporada terminada ainda.</p>
        ))}
    </div>
  );
}

export function AchievementsScreen() {
  const {collection, setScreen} = useGame();
  const done = collection.achievements ?? {};
  const count = ACHIEVEMENTS.filter(a => done[a.id]).length;
  return (
    <div className="screen ach-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>
          Conquistas · {count}/{ACHIEVEMENTS.length}
        </h2>
        <span />
      </header>
      <p className="hint">Objetivos que ficam para sempre no seu perfil. Não dão bônus, só a medalha.</p>
      <div className="ach-grid">
        {ACHIEVEMENTS.map(a => (
          <div key={a.id} className={`panel ach ${done[a.id] ? 'done' : ''}`}>
            <PixelIcon name={a.icon} size={22} color={done[a.id] ? '#e0a100' : '#aaa'} />
            <span>
              <b>{a.name}</b>
              <small>{a.desc}</small>
              {done[a.id] && <small className="muted">{new Date(done[a.id]).toLocaleDateString('pt-BR')}</small>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeasonLog({log}: {log: PointEntry[]}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="link" onClick={() => setOpen(true)}>
        Ver de onde vieram os pontos
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <h2>Pontos da temporada</h2>
          <PointLog log={log} />
        </Modal>
      )}
    </>
  );
}
