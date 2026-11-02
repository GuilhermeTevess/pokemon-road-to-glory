// Perfil do treinador com histórico: tabela offline e online (vitórias, derrotas e % de
// vitória por modo) e a lista das últimas partidas (você na esquerda, o adversário na direita).
import {useMemo, useState} from 'react';
import {species} from '../../data/dex';
import {historyOfSnap, isSnap, loadHistory, mirrorHistory, mvpOf, nemesisOf, sumRows, streakOf, tableOf, winRate, modeLabel} from '../../game/history';
import type {HistCard, History, MatchLog, TableRow} from '../../game/history';
import {Modal, MoveInfo, PixelIcon, Sprite} from '../components';
import {TYPE_COLORS, dex} from '../../data/dex';
import {faintedMask} from '../../game/recap';
import type {Ko} from '../../game/recap';
import {MonInfo} from './BiomeGuide';
import {useGame} from '../../game/store';
import {TrainerAvatar} from './StartScreens';
import {EloStrip} from './RankingScreens';

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

/** "Histórico" de quem venceu, com as 5 últimas partidas (tela de vitória). */
export function HistorySummary({card}: {card: HistCard}) {
  const rate = winRate(card.w, card.l);
  return (
    <div className="hist-summary panel">
      <b>Histórico</b>
      <small className="muted">
        {card.who}
        {card.note ? ` · ${card.note}` : ''}
      </small>
      {card.dots.length ? (
        <span className="hist-dots big">
          {card.dots.map((won, i) => (
            <span key={i} className={`hist-dot ${won ? 'w' : 'l'}`}>
              {won ? 'W' : 'L'}
            </span>
          ))}
        </span>
      ) : (
        <span className="muted small">Ainda sem partidas</span>
      )}
      {rate !== null && (
        <small className="muted">
          {card.w}V · {card.l}D · {rate}% de vitórias
        </small>
      )}
      {!!card.last?.length && (
        <ul className="hist-last">
          {card.last.map((m, i) => (
            <li key={i}>
              <span className="hist-last-who">{card.who}</span>
              <span className={m.won ? 'v' : 'd'}>{m.won ? 'vitória' : 'derrota'}</span>
              <span className="muted">x</span>
              <span className={m.won ? 'd' : 'v'}>{m.won ? 'derrota' : 'vitória'}</span>
              <span className="hist-last-who">{m.vs}</span>
            </li>
          ))}
        </ul>
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

function ModeTable({title, icon, rows, empty}: {title: string; icon: string; rows: TableRow[]; empty: string}) {
  const sum = sumRows(rows);
  return (
    <section className="hist-table panel">
      <h3>
        <PixelIcon name={icon} /> {title}
      </h3>
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
                      <PixelIcon name={r.icon} size={14} /> {r.label}
                    </span>
                    {(r.titles > 0 || r.best) && (
                      <small className="muted">
                        {r.titles > 0 && (
                          <>
                            <PixelIcon name="trophy" size={12} /> {r.titles} título{r.titles > 1 ? 's' : ''}
                          </>
                        )}
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
                <td>
                  Total
                  {sum.titles ? (
                    <>
                      {' · '}
                      <PixelIcon name="trophy" size={12} /> {sum.titles}
                    </>
                  ) : null}
                </td>
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

export const when = (at: number) => {
  const d = new Date(at);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Não deixa um toque dentro das janelinhas (ficha, resumo) abrir/fechar a partida de trás. */
const keep = (e: {stopPropagation: () => void}) => e.stopPropagation();

/** Time de uma partida. Quem desmaiou fica em preto e branco com um X vermelho; tocar abre a ficha. */
function Team({list, down, onMon}: {list: string[]; down?: boolean[]; onMon?: (s: string) => void}) {
  if (!list.length) return null;
  return (
    <span className="hist-team">
      {list.slice(0, 6).map((s, i) => (
        <button
          key={i}
          className={`hist-mon ${down?.[i] ? 'down' : ''}`}
          title={`${name(s)}${down?.[i] ? ' (desmaiou)' : ''} · ver ficha`}
          onClick={e => {
            keep(e);
            onMon?.(s);
          }}
        >
          <Sprite name={s} size={36} still />
        </button>
      ))}
    </span>
  );
}

/** "2 caíram" (só quando a partida tem o resumo). */
const downLabel = (mask: boolean[] | undefined) => {
  if (!mask) return '';
  const n = mask.filter(Boolean).length;
  return n === 0 ? ' · ninguém caiu' : ` · ${n} caí${n > 1 ? 'ram' : 'u'}`;
};

function MoveChip({move, onMove}: {move: string; onMove: (m: string) => void}) {
  const m = dex.moves.get(move);
  return (
    <button className="recap-move" style={{['--mc' as string]: TYPE_COLORS[m.type] ?? '#777'}} title="Ver o que o golpe faz" onClick={() => onMove(m.exists ? m.name : move)}>
      {m.exists ? m.name : move}
    </button>
  );
}

/** Resumo da partida: rodada por rodada, quem nocauteou quem e com o quê. */
function Recap({m, me, onClose}: {m: MatchLog; me: string; onClose: () => void}) {
  const [mon, setMon] = useState<string | null>(null);
  const [move, setMove] = useState<string | null>(null);
  const ko = m.ko ?? [];
  const owner = (side: 0 | 1) => (side === 0 ? me : m.vs);
  const Mon = ({s, side}: {s: string; side: 0 | 1}) => (
    <button className={`recap-mon ${side === 0 ? 'me' : 'foe'}`} onClick={() => setMon(s)} title="Ver ficha">
      <Sprite name={s} size={28} still />
      <b>{name(s)}</b>
    </button>
  );
  const line = (k: Ko) => {
    const victim = (
      <>
        <Mon s={k.mon} side={k.side} /> <small className="muted">de {owner(k.side)}</small>
      </>
    );
    if (k.by && k.move)
      return (
        <>
          <Mon s={k.by} side={(1 - k.side) as 0 | 1} /> nocauteou {victim} com <MoveChip move={k.move} onMove={setMove} />
        </>
      );
    if (k.move)
      return (
        <>
          {victim} caiu usando <MoveChip move={k.move} onMove={setMove} />
        </>
      );
    return (
      <>
        {victim} desmaiou{k.why ? ` por ${k.why}` : ''}
      </>
    );
  };
  const rounds = [...new Set(ko.map(k => k.r))];
  const mine = ko.filter(k => k.side === 1).length;
  const theirs = ko.filter(k => k.side === 0).length;
  return (
    <span className="portal-anchor" onClick={keep}>
      <Modal onClose={onClose}>
        <div className="recap">
          <h3>Resumo da partida</h3>
          <p className="muted small">
            {modeLabel(m.mode)} · {when(m.at)}
          </p>
          <div className="recap-score">
            <span className={m.won ? 'v' : 'd'}>
              {me} derrubou <b>{mine}</b>
            </span>
            <span className={m.won ? 'd' : 'v'}>
              {m.vs} derrubou <b>{theirs}</b>
            </span>
          </div>
          {!ko.length && <p className="muted">Ninguém desmaiou nessa partida.</p>}
          <ol className="recap-list">
            {rounds.map(r => (
              <li key={r}>
                <span className="recap-round">Rodada {r}</span>
                {ko
                  .filter(k => k.r === r)
                  .map((k, i) => (
                    <p key={i} className={`recap-line ${k.side === 0 ? 'lost' : 'won'}`}>
                      {line(k)}
                    </p>
                  ))}
              </li>
            ))}
          </ol>
          <p className={`recap-end ${m.won ? 'v' : 'd'}`}>
            <PixelIcon name="trophy" /> Vitória de {m.won ? me : m.vs}
            {m.note ? ` · ${m.note}` : ''}
          </p>
          <p className="hint small">Toque num Pokémon para ver a ficha, ou num golpe para ver o tipo e o que ele faz.</p>
        </div>
      </Modal>
      {mon && <MonInfo name={mon} onClose={() => setMon(null)} />}
      {move && <MoveInfo move={move} onClose={() => setMove(null)} />}
    </span>
  );
}

function MatchCard({m, me, onFoe}: {m: MatchLog; me: {name: string; avatar: string}; onFoe?: (m: MatchLog) => void}) {
  const [open, setOpen] = useState(false);
  const [mon, setMon] = useState<string | null>(null);
  const [recap, setRecap] = useState(false);
  const run = m.vsKind === 'run';
  const downMine = m.ko ? faintedMask(m.mine, m.ko, 0) : undefined;
  const downTheirs = m.ko ? faintedMask(m.theirs, m.ko, 1) : undefined;
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
        <span className={`hist-badge ${m.online ? 'on' : ''}`}><PixelIcon name={m.online ? 'globe' : 'phone'} size={12} /> {m.online ? 'Online' : 'Offline'}</span>
        <b>{modeLabel(m.mode)}</b>
        {m.note && <small>{m.note}</small>}
        {typeof m.pts === 'number' && (
          <small className={`hist-pts ${m.pts > 0 ? 'v' : m.pts < 0 ? 'd' : 'muted'}`}>
            {m.pts > 0 ? '+' : ''}
            {m.pts} pts no ranking
          </small>
        )}
        <small className="muted">{when(m.at)}</small>
      </div>
      <div className="hist-side foe">
        {run ? (
          <>
            <div>
              <span className={`hist-tag ${m.won ? 'w' : 'l'}`}>{m.won ? 'COMPLETA' : 'FIM'}</span>
              <b>{m.vs}</b>
            </div>
            <span className="hist-run">
              <PixelIcon name="map" size={30} />
            </span>
          </>
        ) : (
          <>
            <div>
              <span className={`hist-tag ${m.won ? 'l' : 'w'}`}>{m.won ? 'LOSE' : 'WIN'}</span>
              {onFoe ? (
                <button
                  className="hist-foe-link"
                  title={`Ver o perfil de ${m.vs}`}
                  onClick={e => {
                    e.stopPropagation();
                    onFoe(m);
                  }}
                >
                  {m.vs}
                </button>
              ) : (
                <b>{m.vs}</b>
              )}
            </div>
            <TrainerAvatar avatar={m.vsAvatar ?? ''} name={m.vs} size={40} />
          </>
        )}
      </div>
      {open && (
        <div className="hist-teams">
          <div>
            <small className="muted">
              {run ? 'Time no fim da run' : 'Seu time'}
              {downLabel(downMine)}
            </small>
            <Team list={m.mine} down={downMine} onMon={setMon} />
            <small className="muted">{m.mine.map(name).join(', ')}</small>
          </div>
          {!run && (
            <div>
              <small className="muted">
                Time de {m.vs} (o que você viu){downLabel(downTheirs)}
              </small>
              <Team list={m.theirs} down={downTheirs} onMon={setMon} />
              <small className="muted">{m.theirs.map(name).join(', ') || '?'}</small>
            </div>
          )}
        </div>
      )}
      {!open && (
        <div className="hist-teams mini">
          <Team list={m.mine} down={downMine} onMon={setMon} />
          {!run && <span className="muted">vs</span>}
          {!run && <Team list={m.theirs} down={downTheirs} onMon={setMon} />}
        </div>
      )}
      {m.ko && !run && (
        <div className="hist-recap-row">
          <button
            className="btn small hist-recap-btn"
            onClick={e => {
              keep(e);
              setRecap(true);
            }}
          >
            <PixelIcon name="book" size={12} /> Resumo
          </button>
        </div>
      )}
      {mon && (
        <span className="portal-anchor" onClick={keep}>
          <MonInfo name={mon} onClose={() => setMon(null)} />
        </span>
      )}
      {recap && <Recap m={m} me={me.name} onClose={() => setRecap(false)} />}
    </div>
  );
}

type Filter = 'all' | 'off' | 'on' | 'w' | 'l';
const FILTERS: {id: Filter; label: string}[] = [
  {id: 'all', label: 'Todas'},
  {id: 'off', label: 'Offline'},
  {id: 'on', label: 'Online'},
  {id: 'w', label: 'Vitórias'},
  {id: 'l', label: 'Derrotas'},
];

function RecentList({h, me, onFoe, canOpen, onlineOnly}: {
  h: History;
  me: {name: string; avatar: string};
  onFoe?: (m: MatchLog) => void;
  /** Só mostra o link nos adversários que têm perfil. */
  canOpen?: (m: MatchLog) => boolean;
  onlineOnly?: boolean;
}) {
  const [f, setF] = useState<Filter>('all');
  const list = h.list.filter(m => (f === 'off' ? !m.online : f === 'on' ? m.online : f === 'w' ? m.won : f === 'l' ? !m.won : true));
  return (
    <section className="hist-recent">
      <div className="row wrap">
        {FILTERS.filter(x => !onlineOnly || (x.id !== 'off' && x.id !== 'on')).map(x => (
          <button key={x.id} className={`tab ${f === x.id ? 'active' : ''}`} onClick={() => setF(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="hint small">Toque numa partida para ver os dois times inteiros, num Pokémon para ver a ficha, e em Resumo para ver quem nocauteou quem.</p>
      {!list.length && <p className="muted">Nenhuma partida aqui ainda.</p>}
      <div className="hist-list">
        {list.map((m, i) => (
          <MatchCard key={`${m.at}-${i}`} m={m} me={me} onFoe={onFoe && (!canOpen || canOpen(m)) ? onFoe : undefined} />
        ))}
      </div>
    </section>
  );
}

/** Perfil do treinador (o seu ou de outro treinador deste aparelho). */
/** Perfil de quem você enfrentou: outro treinador deste aparelho, o resumo que o aparelho dele mandou, ou (computador e amigo no mesmo PC) as partidas contra você. */
export interface FoeView {
  trainer: {id?: string; name: string; avatar: string};
  history: History;
  note?: string;
}

function useFoeView(me: {id?: string; name: string; avatar: string}, h: History): (m: MatchLog) => FoeView {
  const trainers = useGame(s => s.trainers);
  const peers = useGame(s => s.careerPeers);
  return (m: MatchLog) => {
    const avatar = m.vsAvatar ?? '';
    const local = trainers.find(t => t.name === m.vs && t.id !== me.id);
    if (local) return {trainer: local, history: loadHistory(local.id)};
    const peer = peers.find(p => p.name === m.vs);
    if (peer && isSnap(peer.hist)) return {trainer: {name: peer.name, avatar: peer.avatar}, history: historyOfSnap(peer.hist), note: 'Perfil da carreira online (atualiza quando ele joga).'};
    const snap = h.foes?.[m.vs];
    if (snap) return {trainer: {name: snap.name, avatar: snap.avatar || avatar}, history: historyOfSnap(snap), note: `Como estava em ${when(snap.at)}, na última partida de vocês.`};
    const kind = m.vsKind === 'cpu' ? 'O computador' : m.vsKind === 'friend' ? 'Este amigo' : m.online ? 'Este jogador' : 'Este treinador';
    return {
      trainer: {name: m.vs, avatar},
      history: mirrorHistory(h, m.vs, me),
      note: `${kind} não tem perfil neste aparelho: aqui estão só as partidas dele contra você.${m.online ? ' Na próxima partida online, o perfil completo dele chega junto.' : ''}`,
    };
  };
}

/** Perfil do treinador (o seu, de outro treinador deste aparelho ou de um adversário). */
export function FighterProfile({trainer, history, note, onClose, tag, onlineOnly, foeLookup}: {
  trainer: {id?: string; name: string; avatar: string};
  /** Histórico pronto (adversário); sem ele, lê o do treinador pelo id. */
  history?: History;
  note?: string;
  onClose: () => void;
  /** Etiqueta em cima do nome (padrão: perfil do treinador / do adversário). */
  tag?: string;
  /** Só partidas online (perfil vindo da lista de jogadores): esconde a tabela offline. */
  onlineOnly?: boolean;
  /** Como abrir o perfil de quem aparece nas partidas (lista de jogadores). `null` = sem perfil. */
  foeLookup?: (m: MatchLog) => FoeView | null;
}) {
  const h = useMemo(() => history ?? loadHistory(trainer.id), [history, trainer.id]);
  const foeView = useFoeView(trainer, h);
  const [foe, setFoe] = useState<FoeView | null>(null);
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
            <span className="event-tag">{tag ?? (history ? 'Perfil do adversário' : 'Perfil do treinador')}</span>
            <h2>{trainer.name}</h2>
            <span>
              {all.w + all.l} partidas · <b className="v">{all.w} vitórias</b> · <b className="d">{all.l} derrotas</b>
              {rate !== null && <> · {rate}%</>}
            </span>
            <HistoryDots list={h.list} n={10} />
          </div>
        </header>
        {note && <p className="hist-note">{note}</p>}
        {!!h.list.length && (
          <div className="hist-facts">
            {streak && streak.n >= 2 && (
              <span className="panel">
                <PixelIcon name={streak.won ? 'flame' : 'ice'} color={streak.won ? 'var(--peach-d)' : 'var(--sky-d)'} /> {streak.n} {streak.won ? 'vitórias' : 'derrotas'} seguidas
              </span>
            )}
            {all.titles > 0 && (
              <span className="panel">
                <PixelIcon name="trophy" color="var(--butter-d)" /> {all.titles} campeonato{all.titles > 1 ? 's' : ''} vencido{all.titles > 1 ? 's' : ''}
              </span>
            )}
            {mvp && (
              <span className="panel">
                <Sprite name={mvp.name} size={32} still /> Mais usado: {name(mvp.name)} (venceu {mvp.wins} de {mvp.games})
              </span>
            )}
            {nemesis && (
              <span className="panel">
                <PixelIcon name="sword" /> Mais enfrentado: {nemesis.vs} ({nemesis.w}V · {nemesis.l}D)
              </span>
            )}
          </div>
        )}
        {(onlineOnly || on.length > 0) && <EloStrip points={h.points} />}
        <div className="row wrap">
          <button className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
            Estatísticas
          </button>
          <button className={`tab ${tab === 'recent' ? 'active' : ''}`} onClick={() => setTab('recent')}>
            Últimas partidas ({h.list.length})
          </button>
        </div>
        {tab === 'stats' ? (
          <div className="hist-tables">
            {!onlineOnly && (
              <ModeTable title="Offline" icon="phone" rows={off} empty="Nenhuma partida offline ainda. Runs, Rush contra o computador e campeonatos rápidos aparecem aqui." />
            )}
            <ModeTable title="Online (contra pessoas)" icon="globe" rows={on} empty="Nenhuma partida online ainda. Rush online, campeonato online e carreira com amigos aparecem aqui." />
            <p className="hint small">
              V = vitórias, D = derrotas. A % de vitória é V dividido pelo total de jogos. Os totais nunca se perdem; a lista de partidas guarda as últimas {onlineOnly ? 40 : 60}.
            </p>
          </div>
        ) : (
          <RecentList
            h={h}
            me={trainer}
            onlineOnly={onlineOnly}
            onFoe={foeLookup ? m => setFoe(foeLookup(m)) : history ? undefined : m => setFoe(foeView(m))}
            canOpen={foeLookup ? m => !!foeLookup(m) : undefined}
          />
        )}
      </div>
      {foe && (
        <FighterProfile
          trainer={foe.trainer}
          history={foe.history}
          note={foe.note}
          tag={foeLookup ? tag : undefined}
          onlineOnly={foeLookup ? onlineOnly : undefined}
          foeLookup={foeLookup}
          onClose={() => setFoe(null)}
        />
      )}
    </Modal>
  );
}
