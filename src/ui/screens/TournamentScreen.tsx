import {getItem} from '../../data/items';
import {roundOf} from '../../game/career';
import {maxHp} from '../../game/mon';
import {CareerDuel} from './CareerDuel';
// Torneios: explicação, sorteio animado, chaveamento e histórico.
import {useEffect, useState} from 'react';
import {useGame} from '../../game/store';
import {careerOf} from '../../game/meta';
import {
  FAME_TIERS, ROUND_NAMES, TOURS, fameLabel, placementLabel, playerIndex, playerMatch, prizeIndex, tourInfo,
  tourName,
} from '../../game/tournament';
import type {MatchRec, TourKind} from '../../game/tournament';
import {Modal, PixelIcon, Sprite} from '../components';
import {TrainerAvatar} from './StartScreens';
import {fast} from '../settings';
import {ChampionCelebration} from './ChampionScreen';
import {botScout, playerScout, scoutReport} from '../../game/scout';
import {profileOfBot, profileOfPeer} from '../../game/profile';
import {ProfileModal} from './ProfileModal';
import {species} from '../../data/dex';

/** Formato comum para a chave ao vivo e para o histórico. */
interface BracketData {
  entrants: {name: string; avatar?: string; player?: boolean; friend?: boolean; pid?: string; team: string[]}[];
  rounds: MatchRec[][];
}

const KIND_COLOR: Record<TourKind, string> = {cup: '#7ab8e0', regional: '#8fd18f', international: '#e0a14a', worlds: '#e0c34a'};

export function TourBadge({kind}: {kind: TourKind}) {
  return (
    <span className="tour-badge" style={{background: KIND_COLOR[kind]}}>
      <PixelIcon name="trophy" size={12} /> {tourInfo(kind).name}
    </span>
  );
}

function TeamRow({team, size = 40}: {team: string[]; size?: number}) {
  if (!team.length) return <span className="muted">time escondido</span>;
  return (
    <span className="team-row">
      {team.map((s, i) => (
        <Sprite key={i} name={s} size={size} still />
      ))}
    </span>
  );
}

/** O que o PokéPC sabe de um rival: só lutas públicas (com 2 destaques) e quem você já enfrentou. */
export function ScoutPanel({name, wave, team, pid}: {name: string; wave: number; team: string[]; pid?: string}) {
  const peer = useGame(s => (pid ? s.careerPeers.find(p => p.id === pid) : undefined));
  const bot = useGame(s => (pid ? undefined : s.run?.world?.bots.find(b => b.name === name)));
  const faced = useGame(s => s.run?.faced?.[name]);
  const [profile, setProfile] = useState(false);
  const r = peer ? playerScout(peer, faced) : bot ? botScout(bot, faced) : scoutReport(name, wave, team, faced);
  return (
    <div className="scout">
      {(peer || bot) && (
        <button className="btn small ghost" onClick={() => setProfile(true)}>
          Ver perfil de {name} ▸
        </button>
      )}
      {profile && (peer || bot) && <ProfileModal profile={peer ? profileOfPeer(peer) : profileOfBot(bot!)} onClose={() => setProfile(false)} />}
      {!r || !r.seen.length ? (
        <p className="muted">Ninguém sabe muito sobre {name} ainda. Nenhuma luta dele saiu no noticiário.</p>
      ) : (
        <>
          <h4>Pokémon conhecidos</h4>
          <div className="scout-usage">
            {r.seen.map(u => (
              <div key={u.species} className="scout-use">
                <Sprite name={u.species} size={32} still />
                <span>{species(u.species).name}</span>
                <small className={u.faced ? 'win-tag' : 'muted'}>{u.faced ? 'Você já enfrentou' : u.news > 1 ? `Nas notícias ${u.news}×` : 'Saiu numa notícia'}</small>
              </div>
            ))}
            <div className="scout-use fog">
              <span className="fog-mon">?</span>
              <span className="muted">Pode ter outros que ninguém viu</span>
            </div>
          </div>
        </>
      )}
      {r && r.matches.length > 0 && (
        <>
          <h4>Últimas lutas no noticiário</h4>
          {r.matches.map((m, i) => (
            <div key={i} className="scout-row">
              <span className={m.won ? 'win-tag' : 'lose-tag'}>{m.won ? 'Venceu' : 'Perdeu'}</span>
              <span>
                {m.label ? `${m.label}: ` : ''}vs {m.vs}
              </span>
              <TeamRow team={m.seen} size={32} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** Detalhe de uma partida. Antes de jogar, cada lado mostra as últimas batalhas (não o time exato). */
function MatchDetail({data, match, onClose, wave}: {data: BracketData; match: MatchRec; onClose: () => void; wave: number}) {
  const A = data.entrants[match.a];
  const B = data.entrants[match.b];
  const teams = match.teams;
  return (
    <Modal onClose={onClose} wide>
      <h2>
        {A.name} vs {B.name}
      </h2>
      <div className="match-sides">
        {[A, B].map((e, i) => (
          <div key={i} className={`match-side ${match.winner === (i === 0 ? match.a : match.b) ? 'won' : ''}`}>
            <TrainerAvatar avatar={e.avatar ?? ''} name={e.name} size={56} />
            <b>{e.name}</b>
            {match.winner === (i === 0 ? match.a : match.b) && <span className="win-tag">Venceu</span>}
            {teams ? <TeamRow team={teams[i]} size={48} /> : e.player ? <TeamRow team={e.team} size={48} /> : <ScoutPanel name={e.name} wave={wave} team={e.team} pid={e.pid} />}
          </div>
        ))}
      </div>
      {match.highlights?.length ? (
        <>
          <h3>Como foi</h3>
          <ol className="highlights">
            {match.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </>
      ) : (
        <p className="hint">Ainda não jogaram. Veja as últimas batalhas para ter uma ideia do que cada um costuma usar.</p>
      )}
    </Modal>
  );
}

/** Chaveamento: quartas → semi → final → campeão. Toque numa partida para ver os detalhes. */
export function Bracket({data, wave = 0}: {data: BracketData; wave?: number}) {
  const [open, setOpen] = useState<MatchRec | null>(null);
  const final = data.rounds[2]?.[0];
  const champ = final?.winner !== undefined ? data.entrants[final.winner] : null;
  // Rodadas que ainda não existem aparecem vazias.
  const cols = [0, 1, 2].map(r => data.rounds[r] ?? Array.from({length: 4 >> r}, () => null));
  return (
    <div className="bracket">
      {cols.map((round, r) => (
        <div key={r} className="bracket-col">
          <h4>{ROUND_NAMES[r]}</h4>
          <div className="bracket-matches">
            {round.map((m, i) =>
              m ? (
                <button key={i} className={`bracket-match ${m.winner !== undefined ? 'played' : ''}`} onClick={() => setOpen(m)}>
                  {[m.a, m.b].map(id => {
                    const e = data.entrants[id];
                    const cls = [e.player ? 'me' : '', m.winner === id ? 'win' : m.winner !== undefined ? 'lose' : ''].join(' ');
                    return (
                      <span key={id} className={`bracket-slot ${cls}`}>
                        <TrainerAvatar avatar={e.avatar ?? ''} name={e.name} size={20} />
                        {e.name}
                        {m.teams && (
                          <span className="bracket-team">
                            {m.teams[id === m.a ? 0 : 1].map((sp, k) => (
                              <Sprite key={k} name={sp} size={22} still />
                            ))}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </button>
              ) : (
                <div key={i} className="bracket-match empty">
                  <span className="bracket-slot">?</span>
                  <span className="bracket-slot">?</span>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
      <div className="bracket-col champ-col">
        <h4>Campeão</h4>
        <div className="bracket-champ">
          {champ ? (
            <>
              <PixelIcon name="trophy" color="#e0a100" size={28} />
              <TrainerAvatar avatar={champ.avatar ?? ''} name={champ.name} size={48} />
              <b>{champ.name}</b>
            </>
          ) : (
            <span className="muted">?</span>
          )}
        </div>
      </div>
      {open && <MatchDetail data={data} match={open} wave={wave} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Sorteio: os nomes giram em cada vaga e vão travando um por um. */
function DrawAnimation({names, onDone}: {names: string[]; onDone: () => void}) {
  const [tick, setTick] = useState(() => (fast() ? names.length * 5 : 0));
  const locked = Math.floor(tick / 5);
  useEffect(() => {
    if (locked > names.length) return;
    const t = setTimeout(() => setTick(x => x + 1), 70);
    return () => clearTimeout(t);
  }, [tick, locked, names.length]);
  const done = locked >= names.length;
  return (
    <div className="draw">
      <div className="draw-grid">
        {[0, 2, 4, 6].map(i => (
          <div key={i} className="draw-match">
            {[i, i + 1].map(j => (
              <span key={j} className={`draw-slot ${j < locked ? 'locked' : 'spin'}`}>
                {j < locked ? names[j] : names[(j * 3 + tick) % names.length]}
              </span>
            ))}
          </div>
        ))}
      </div>
      <button className="btn primary" onClick={done ? onDone : () => setTick(names.length * 5)}>
        {done ? 'Ver chaveamento' : 'Pular sorteio'}
      </button>
    </div>
  );
}

/** Tela do torneio dentro da run. */
export function TournamentScreen() {
  const {run, trainer, tourStage, tourFight, tourFinish, tourSync, tourLoad, tourDuelResult} = useGame();
  const t = run?.tournament;
  // Depois da festa de campeão, volta para a chave.
  const [party, setParty] = useState(false);
  const [duel, setDuel] = useState(false);
  const shared = !!t?.shared;
  const loading = shared && !t?.shared?.ready;
  const live = shared && !loading && t?.stage === 'bracket';
  // Carreira online: a chave vem da nuvem (a mesma para todo mundo).
  useEffect(() => {
    if (!loading) return;
    void tourLoad();
    const id = setInterval(() => void tourLoad(), 4000);
    return () => clearInterval(id);
  }, [loading, tourLoad]);
  // Carreira online: as partidas dos outros jogadores chegam pela nuvem.
  useEffect(() => {
    if (!live) return;
    void tourSync();
    const id = setInterval(() => void tourSync(), 4000);
    return () => clearInterval(id);
  }, [live, tourSync]);
  if (!run || !t) return null;
  if (loading)
    return (
      <div className="screen tour-screen">
        <div className="panel tour-intro">
          <PixelIcon name="trophy" color="#e0a100" size={40} />
          <p className="hint waiting">Montando a chave do torneio com os outros jogadores...</p>
        </div>
      </div>
    );
  const info = tourInfo(t.kind);
  const me = playerIndex(t);
  const data: BracketData = {
    entrants: t.entrants.map(e => ({...e, team: e.player ? run.party.map(m => m.species) : e.team.map(m => m.species)})),
    rounds: t.rounds,
  };
  const next = playerMatch(t);
  const foe = next ? t.entrants[next.a === me ? next.b : next.a] : null;
  if (duel && foe?.friend && foe.pid && t.shared && next) {
    const r = t.rounds.length - 1;
    const i = t.rounds[r].indexOf(next);
    const team = run.party.slice(0, info.teamSize).map(m => ({
      ...structuredClone(m),
      hp: maxHp(m),
      // Sem mega na carreira, a pedra fica de fora.
      item: run.career?.rules.megas === false && m.item && getItem(m.item).megaFor ? undefined : m.item,
    }));
    return (
      <CareerDuel
        room={`${t.shared.tid}-${r}-${i}`}
        host={t.shared.me < foe.pid}
        me={{name: trainer?.name ?? 'Você', avatar: trainer?.avatar ?? ''}}
        foe={{name: foe.name, avatar: foe.avatar ?? ''}}
        team={team}
        onLeave={() => setDuel(false)}
        onDone={res => {
          setDuel(false);
          tourDuelResult({...res, host: t.shared!.me < foe.pid!});
        }}
      />
    );
  }
  const final = t.rounds[t.rounds.length - 1]?.find(m => m.a === me || m.b === me);
  const finalFoe = final ? t.entrants[final.a === me ? final.b : final.a] : null;
  const pi = prizeIndex(t.placement ?? 5);
  const prize = `+${info.glory[pi]} Glória · +₽ ${info.money[pi]}${info.cp[0] > 0 ? ` · +${info.cp[pi]} CP` : ''}`;
  if (t.stage === 'done' && t.placement === 1 && !party && finalFoe)
    return (
      <ChampionCelebration
        kind={t.kind}
        tour={tourName(t)}
        me={{name: trainer?.name ?? 'Você', avatar: trainer?.avatar ?? ''}}
        foe={{name: finalFoe.name, avatar: finalFoe.avatar ?? ''}}
        partner={run.party.find(m => m.partner) ?? run.party[0]}
        prize={prize}
        onClose={() => setParty(true)}
        onFinish={tourFinish}
      />
    );
  return (
    <div className="screen tour-screen">
      <header className="bar">
        <TourBadge kind={t.kind} />
        <h2>{tourName(t)}</h2>
        <span className="muted">Ronda {run ? roundOf({...run, wave: t.wave}) : t.wave}</span>
      </header>
      {t.stage === 'intro' && (
        <div className="panel tour-intro">
          <PixelIcon name="trophy" color="#e0a100" size={40} />
          <p>{info.about}</p>
          <ul className="tour-rules">
            <li>8 treinadores, mata-mata: perdeu, saiu do torneio.</li>
            <li>Uma partida por rodada: quartas, semifinal e final.</li>
            <li>Seu time é curado antes de cada luta.</li>
            <li>Os adversários usam {info.teamSize} Pokémon.</li>
            {run.quick ? (
              <li>Campeonato rápido: acabou o campeonato, acabou o save. Não mexe na sua run.</li>
            ) : (
              <li>Perder aqui não acaba a run: a temporada segue depois do torneio.</li>
            )}
          </ul>
          <table className="prize-table">
            <thead>
              <tr>
                <th />
                <th>Campeão</th>
                <th>Vice</th>
                <th>Top 4</th>
                <th>Top 8</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Glória</td>
                {info.glory.map((g, i) => <td key={i}>{g}</td>)}
              </tr>
              <tr>
                <td>₽</td>
                {info.money.map((g, i) => <td key={i}>{g}</td>)}
              </tr>
              {info.cp[0] > 0 && (
                <tr>
                  <td>CP</td>
                  {info.cp.map((g, i) => <td key={i}>{g}</td>)}
                </tr>
              )}
            </tbody>
          </table>
          <button className="btn primary" onClick={() => tourStage('draw')}>
            Ir para o sorteio
          </button>
        </div>
      )}
      {t.stage === 'draw' && <DrawAnimation names={t.entrants.map(e => e.name)} onDone={() => tourStage('bracket')} />}
      {(t.stage === 'bracket' || t.stage === 'done') && (
        <>
          <Bracket data={data} wave={t.wave} />
          {t.stage === 'bracket' && next && foe && (
            <div className="panel tour-next">
              <TrainerAvatar avatar={foe.avatar ?? ''} name={foe.name} size={56} />
              <div>
                <b>
                  {ROUND_NAMES[t.rounds.length - 1]}: {trainer?.name ?? 'Você'} vs {foe.name}
                </b>
                <ScoutToggle name={foe.name} wave={t.wave} team={foe.team.map(m => m.species)} pid={foe.pid} />
                {foe.friend && <p className="hint small">Jogador de verdade: a partida é ao vivo, cada um no seu aparelho. Vocês dois precisam entrar.</p>}
              </div>
              {foe.friend ? (
                <button className="btn primary" onClick={() => setDuel(true)}>
                  ⚡ Partida ao vivo
                </button>
              ) : (
                <button className="btn primary" onClick={tourFight}>
                  Lutar!
                </button>
              )}
            </div>
          )}
          {t.stage === 'bracket' && !next && shared && (
            <div className="panel tour-next">
              <p className="hint waiting">Esperando as outras partidas desta rodada terminarem... (os amigos estão jogando as deles)</p>
            </div>
          )}
          {t.stage === 'done' && (
            <div className="panel tour-result">
              <h3>
                <PixelIcon name="trophy" color={t.placement === 1 ? '#e0a100' : '#999'} size={24} /> {placementLabel(t.placement ?? 5)}
              </h3>
              <p>{prize}</p>
              <button className="btn primary" onClick={tourFinish}>
                {run.quick ? 'Voltar para o Quickplay' : 'Seguir a temporada'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Perfil de torneios: CP, fama, títulos e o histórico com as chaves. */
export function TourHistoryScreen() {
  const {collection, setScreen} = useGame();
  const c = careerOf(structuredClone(collection));
  const [open, setOpen] = useState<number | null>(null);
  const rec = open !== null ? c.history[open] : null;
  const next = FAME_TIERS.find(([min]) => min > c.fame);
  return (
    <div className="screen tour-history">
      <header className="bar">
        <button className="btn small" onClick={() => (rec ? setOpen(null) : setScreen('title'))}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>{rec ? `${tourInfo(rec.kind).name} · ${placementLabel(rec.placement)}` : 'Torneios'}</h2>
        <span />
      </header>
      {rec ? (
        <Bracket data={rec} />
      ) : (
        <>
          <CareerCard />
          <p className="hint">
            Fama: {fameLabel(c.fame)} ({c.fame}){next ? `, próxima: ${next[1]} com ${next[0]}` : ''}. Toque num torneio para ver a chave, os
            times e como cada partida aconteceu.
          </p>
          {c.history.length ? (
            <div className="tour-list">
              {c.history.map((h, i) => (
                <button key={i} className="panel tour-item" onClick={() => setOpen(i)}>
                  <TourBadge kind={h.kind} />
                  <b>{placementLabel(h.placement)}</b>
                  <span className="muted">{new Date(h.at).toLocaleDateString('pt-BR')}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Nenhum torneio ainda. O primeiro é a League Cup, na ronda 30.</p>
          )}
          <h3>O circuito</h3>
          <ul className="tour-about">
            {TOURS.map(x => (
              <li key={x.kind}>
                <TourBadge kind={x.kind} /> ronda {x.wave}: {x.about}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Resumo da carreira (perfil). */
export function CareerCard() {
  const c = careerOf(structuredClone(useGame(s => s.collection)));
  const titles = TOURS.filter(x => c.titles[x.kind]);
  return (
    <div className="panel career-card">
      <span>
        <b>{c.cp}</b> CP
      </span>
      <span>
        Fama: <b>{fameLabel(c.fame)}</b>
      </span>
      <span>
        Títulos:{' '}
        {titles.length ? titles.map(x => (
          <span key={x.kind} className="title-chip">
            <TourBadge kind={x.kind} /> ×{c.titles[x.kind]}
          </span>
        )) : <span className="muted">nenhum ainda</span>}
      </span>
      {c.runnerUps > 0 && <span className="muted">Vice {c.runnerUps}×</span>}
    </div>
  );
}

/** Botão "Estudar adversário": abre as últimas batalhas dele. */
function ScoutToggle({name, wave, team, pid}: {name: string; wave: number; team: string[]; pid?: string}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="link" onClick={() => setOpen(true)}>
        💻 Estudar {name} no PC
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} wide>
          <div className="pc-device">
            <div className="pc-lid">
              <div className="pc-cam" />
              <div className="pc-screen">
                <div className="pc-titlebar">
                  <span>📁 Banco de dados · {name}</span>
                  <span className="pc-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className="pc-body">
                  <ScoutPanel name={name} wave={wave} team={team} pid={pid} />
                  <p className="hint">O PC só sabe o que saiu no noticiário (Ginásios, Torneios e Lendas, com 2 destaques por luta) e o que você mesmo já enfrentou. O resto é surpresa.</p>
                </div>
              </div>
            </div>
            <div className="pc-base">
              <span className="pc-brand">PokéPC</span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
