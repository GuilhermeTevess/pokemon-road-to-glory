// Perfil do treinador com histórico: tabela offline e online (vitórias, derrotas e % de
// vitória por modo) e a lista das últimas partidas (você na esquerda, o adversário na direita).
import {useMemo, useState} from 'react';
import {species} from '../../data/dex';
import {loadHistory, mvpOf, nemesisOf, sumRows, streakOf, tableOf, winRate, modeLabel} from '../../game/history';
import type {History, MatchLog, TableRow} from '../../game/history';
import {Modal, Sprite} from '../components';
import {TrainerAvatar} from './StartScreens';

const name = (s: string) => {
  try {
    return species(s).name;
  } catch {
    return s;
  }
};

/** Bolinhas das últimas partidas: verde com W (vitória), vermelha com L (derrota). */
export function HistoryDots({list, n = 5, size}: {list: MatchLog[]; n?: number; size?: 'big'}) {
  const last = list.slice(0, n);
  if (!last.length) return <span className="muted small">Ainda sem partidas</span>;
  return (
    <span className={`hist-dots ${size ?? ''}`} title="Mais recente na esquerda">
      {last.map((m, i) => (
        <span key={i} className={`hist-dot ${m.won ? 'w' : 'l'}`} title={`${m.won ? 'Vitória' : 'Derrota'} · ${modeLabel(m.mode)} · ${m.vs}`}>
          {m.won ? 'W' : 'L'}
        </span>
      ))}
    </span>
  );
}

/** "Histórico" com as 5 últimas partidas (tela de vitória). */
export function HistorySummary({trainerId, who}: {trainerId?: string | null; who: string}) {
  // Lê na hora de mostrar: a partida que acabou de terminar já está gravada.
  const h = useMemo(() => loadHistory(trainerId), [trainerId]);
  if (!trainerId) return null;
  const all = sumRows([...tableOf(h, false), ...tableOf(h, true)]);
  const rate = winRate(all.w, all.l);
  return (
    <div className="hist-summary panel">
      <b>Histórico</b>
      <small className="muted">{who}</small>
      <HistoryDots list={h.list} size="big" />
      {rate !== null && (
        <small className="muted">
          {all.w}V · {all.l}D · {rate}% de vitórias
        </small>
      )}
    </div>
  );
}

function RateBar({w, l}: {w: number; l: number}) {
  const r = winRate(w, l);
  if (r === null) return <span className="muted">-</span>;
  return (
    <span className="rate">
      <span className="rate-bar">
        <span style={{width: `${r}%`}} className={r >= 50 ? 'good' : 'bad'} />
      </span>
      <b>{r}%</b>
    </span>
  );
}

function ModeTable({title, rows, empty}: {title: string; rows: TableRow[]; empty: string}) {
  const sum = sumRows(rows);
  return (
    <section className="hist-table panel">
      <h3>{title}</h3>
      {!rows.length ? (
        <p className="muted">{empty}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Modo</th>
              <th title="Partidas jogadas">Jogos</th>
              <th title="Vitórias">V</th>
              <th title="Derrotas">D</th>
              <th>% de vitória</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} title={r.about}>
                <td>
                  <div className="hist-mode-cell">
                    <span className="hist-mode">
                      {r.icon} {r.label}
                    </span>
                    {(r.titles > 0 || r.best) && (
                      <small className="muted">
                        {r.titles > 0 && `🏆 ${r.titles} título${r.titles > 1 ? 's' : ''}`}
                        {r.titles > 0 && r.best ? ' · ' : ''}
                        {r.best ? `melhor ronda ${r.best}` : ''}
                      </small>
                    )}
                  </div>
                </td>
                <td>{r.w + r.l}</td>
                <td className="v">{r.w}</td>
                <td className="d">{r.l}</td>
                <td>
                  <RateBar w={r.w} l={r.l} />
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr>
                <td>Total{sum.titles ? ` · 🏆 ${sum.titles}` : ''}</td>
                <td>{sum.w + sum.l}</td>
                <td className="v">{sum.w}</td>
                <td className="d">{sum.l}</td>
                <td>
                  <RateBar w={sum.w} l={sum.l} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </section>
  );
}

const when = (at: number) => {
  const d = new Date(at);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function Team({list}: {list: string[]}) {
  if (!list.length) return null;
  return (
    <span className="hist-team">
      {list.slice(0, 6).map((s, i) => (
        <Sprite key={i} name={s} size={36} still />
      ))}
    </span>
  );
}

function MatchCard({m, me}: {m: MatchLog; me: {name: string; avatar: string}}) {
  const [open, setOpen] = useState(false);
  const run = m.vsKind === 'run';
  return (
    <div className={`hist-match ${m.won ? 'won' : 'lost'}`} onClick={() => setOpen(!open)}>
      <div className="hist-side">
        <TrainerAvatar avatar={me.avatar} name={me.name} size={40} />
        <div>
          <span className={`hist-tag ${m.won ? 'w' : 'l'}`}>{m.won ? 'WIN' : 'LOSE'}</span>
          <b>{me.name}</b>
        </div>
      </div>
      <div className="hist-mid">
        <span className={`hist-badge ${m.online ? 'on' : ''}`}>{m.online ? '🌐 Online' : '📴 Offline'}</span>
        <b>{modeLabel(m.mode)}</b>
        {m.note && <small>{m.note}</small>}
        <small className="muted">{when(m.at)}</small>
      </div>
      <div className="hist-side foe">
        {run ? (
          <>
            <div>
              <span className={`hist-tag ${m.won ? 'w' : 'l'}`}>{m.won ? 'COMPLETA' : 'FIM'}</span>
              <b>{m.vs}</b>
            </div>
            <span className="hist-run">🗺️</span>
          </>
        ) : (
          <>
            <div>
              <span className={`hist-tag ${m.won ? 'l' : 'w'}`}>{m.won ? 'LOSE' : 'WIN'}</span>
              <b>{m.vs}</b>
            </div>
            <TrainerAvatar avatar={m.vsAvatar ?? ''} name={m.vs} size={40} />
          </>
        )}
      </div>
      {open && (
        <div className="hist-teams">
          <div>
            <small className="muted">{run ? 'Time no fim da run' : 'Seu time'}</small>
            <Team list={m.mine} />
            <small className="muted">{m.mine.map(name).join(', ')}</small>
          </div>
          {!run && (
            <div>
              <small className="muted">Time de {m.vs} (o que você viu)</small>
              <Team list={m.theirs} />
              <small className="muted">{m.theirs.map(name).join(', ') || '?'}</small>
            </div>
          )}
        </div>
      )}
      {!open && (
        <div className="hist-teams mini">
          <Team list={m.mine} />
          {!run && <span className="muted">vs</span>}
          {!run && <Team list={m.theirs} />}
        </div>
      )}
    </div>
  );
}

type Filter = 'all' | 'off' | 'on' | 'w' | 'l';
const FILTERS: {id: Filter; label: string}[] = [
  {id: 'all', label: 'Todas'},
  {id: 'off', label: '📴 Offline'},
  {id: 'on', label: '🌐 Online'},
  {id: 'w', label: 'Vitórias'},
  {id: 'l', label: 'Derrotas'},
];

function RecentList({h, me}: {h: History; me: {name: string; avatar: string}}) {
  const [f, setF] = useState<Filter>('all');
  const list = h.list.filter(m => (f === 'off' ? !m.online : f === 'on' ? m.online : f === 'w' ? m.won : f === 'l' ? !m.won : true));
  return (
    <section className="hist-recent">
      <div className="row wrap">
        {FILTERS.map(x => (
          <button key={x.id} className={`tab ${f === x.id ? 'active' : ''}`} onClick={() => setF(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="hint small">Toque numa partida para ver os dois times inteiros.</p>
      {!list.length && <p className="muted">Nenhuma partida aqui ainda.</p>}
      <div className="hist-list">
        {list.map((m, i) => (
          <MatchCard key={`${m.at}-${i}`} m={m} me={me} />
        ))}
      </div>
    </section>
  );
}

/** Perfil do treinador (o seu ou de outro treinador deste aparelho). */
export function FighterProfile({trainer, onClose}: {trainer: {id: string; name: string; avatar: string}; onClose: () => void}) {
  const h = useMemo(() => loadHistory(trainer.id), [trainer.id]);
  const [tab, setTab] = useState<'stats' | 'recent'>('stats');
  const off = tableOf(h, false);
  const on = tableOf(h, true);
  const all = sumRows([...off, ...on]);
  const streak = streakOf(h.list.filter(m => m.vsKind !== 'run'));
  const nemesis = nemesisOf(h.list);
  const mvp = mvpOf(h.list.filter(m => m.vsKind !== 'run'));
  const rate = winRate(all.w, all.l);
  return (
    <Modal onClose={onClose} wide>
      <div className="profile hist-profile">
        <header className="profile-head">
          <TrainerAvatar avatar={trainer.avatar} name={trainer.name} size={88} />
          <div>
            <span className="event-tag">Perfil do treinador</span>
            <h2>{trainer.name}</h2>
            <span>
              {all.w + all.l} partidas · <b className="v">{all.w} vitórias</b> · <b className="d">{all.l} derrotas</b>
              {rate !== null && <> · {rate}%</>}
            </span>
            <HistoryDots list={h.list} n={10} />
          </div>
        </header>
        {!!h.list.length && (
          <div className="hist-facts">
            {streak && streak.n >= 2 && (
              <span className="panel">
                {streak.won ? '🔥' : '🧊'} {streak.n} {streak.won ? 'vitórias' : 'derrotas'} seguidas
              </span>
            )}
            {all.titles > 0 && <span className="panel">🏆 {all.titles} campeonato{all.titles > 1 ? 's' : ''} vencido{all.titles > 1 ? 's' : ''}</span>}
            {mvp && (
              <span className="panel">
                <Sprite name={mvp.name} size={32} still /> Mais usado: {name(mvp.name)} (venceu {mvp.wins} de {mvp.games})
              </span>
            )}
            {nemesis && (
              <span className="panel">
                ⚔️ Mais enfrentado: {nemesis.vs} ({nemesis.w}V · {nemesis.l}D)
              </span>
            )}
          </div>
        )}
        <div className="row wrap">
          <button className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
            📊 Estatísticas
          </button>
          <button className={`tab ${tab === 'recent' ? 'active' : ''}`} onClick={() => setTab('recent')}>
            📜 Últimas partidas ({h.list.length})
          </button>
        </div>
        {tab === 'stats' ? (
          <div className="hist-tables">
            <ModeTable title="📴 Offline" rows={off} empty="Nenhuma partida offline ainda. Runs, Rush contra o computador e campeonatos rápidos aparecem aqui." />
            <ModeTable title="🌐 Online (contra pessoas)" rows={on} empty="Nenhuma partida online ainda. Rush online, campeonato online e carreira com amigos aparecem aqui." />
            <p className="hint small">
              V = vitórias, D = derrotas. A % de vitória é V dividido pelo total de jogos. Os totais nunca se perdem; a lista de partidas guarda as últimas 60.
            </p>
          </div>
        ) : (
          <RecentList h={h} me={trainer} />
        )}
      </div>
    </Modal>
  );
}
