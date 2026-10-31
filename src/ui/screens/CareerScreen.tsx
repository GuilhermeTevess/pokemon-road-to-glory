// Carreira online: criar (host escolhe as regras), entrar com o código e ver a classificação.
import {useEffect, useState} from 'react';
import {DEFAULT_RULES, deviceId, newCareerCode, playerId, roundBlockers, rulesSummary, standings} from '../../game/career';
import type {CareerDoc, CareerRules, PlayerDoc} from '../../game/career';
import {cloud, cloudReady} from '../../game/cloud';
import {useGame} from '../../game/store';
import {AVATARS} from '../../game/trainers';
import type {Trainer} from '../../game/trainers';
import {tourInfo} from '../../game/tournament';
import type {TourKind} from '../../game/tournament';
import {Modal, Sprite} from '../components';
import {AvatarEditor, TrainerAvatar} from './StartScreens';
import {ProfileModal} from './ProfileModal';
import {profileOfBot, profileOfPeer} from '../../game/profile';
import type {Profile} from '../../game/profile';
import type {WorldBot} from '../../game/world';

export function CareerScreen() {
  const trainer = useGame(s => s.trainer);
  if (trainer?.career) return <CareerHub />;
  return <CareerSetup />;
}

/** Botões de escolha (estilo "pílula"). */
function Choice<T extends string | number | boolean>({value, options, onChange}: {value: T; options: [T, string][]; onChange: (v: T) => void}) {
  return (
    <div className="choice-row">
      {options.map(([v, label]) => (
        <button key={String(v)} className={`btn small ${v === value ? 'primary' : ''}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function RulesForm({rules, onChange}: {rules: CareerRules; onChange: (r: CareerRules) => void}) {
  const set = <K extends keyof CareerRules>(k: K, v: CareerRules[K]) => onChange({...rules, [k]: v});
  return (
    <div className="rules-form">
      <div className="rule">
        <b>Coleção</b>
        <Choice value={rules.allowCollection} onChange={v => set('allowCollection', v)} options={[[false, 'Todo mundo do zero'], [true, 'Pode usar treinador já criado']]} />
        <small className="hint">Do zero é o mais justo: quem já jogou muito não chega com Pokémon fortes.</small>
      </div>
      <div className="rule">
        <b>Tamanho da temporada</b>
        <Choice value={rules.rounds} onChange={v => set('rounds', v)} options={[[120, '120 rondas (completa)'], [60, '60 rondas'], [24, '24 rondas (rápida)']]} />
        <small className="hint">Os 4 torneios continuam lá (a cada quarto da temporada). Temporadas curtas dão mais EXP e dinheiro por ronda.</small>
      </div>
      <div className="rule">
        <b>Número de temporadas</b>
        <Choice value={rules.seasons} onChange={v => set('seasons', v)} options={[[1, '1'], [2, '2'], [3, '3'], [5, '5']]} />
      </div>
      <div className="rule">
        <b>Lendários no time</b>
        <Choice value={rules.legendCap} onChange={v => set('legendCap', v)} options={[[0, 'Nenhum'], [1, 'Até 1'], [2, 'Até 2'], [6, 'Sem limite']]} />
      </div>
      <div className="rule">
        <b>Nível máximo</b>
        <Choice value={rules.levelCap} onChange={v => set('levelCap', v)} options={[[50, '50'], [70, '70'], [100, 'Sem limite']]} />
      </div>
      <div className="rule">
        <b>Mega evolução</b>
        <Choice value={rules.megas} onChange={v => set('megas', v)} options={[[true, 'Liberada'], [false, 'Proibida']]} />
      </div>
      <div className="rule">
        <b>EXP e dinheiro</b>
        <Choice value={rules.boost} onChange={v => set('boost', v)} options={[[1, 'Normal'], [1.5, 'x1,5'], [2, 'x2']]} />
      </div>
    </div>
  );
}

/** Quem vai jogar a carreira: um treinador novo ou (se o host deixar) um que já existe. */
function WhoPlays({doc, busy, onEnter}: {doc: CareerDoc; busy: boolean; onEnter: (name: string, avatar: string, colFrom?: string) => void}) {
  const trainers = useGame(s => s.trainers).filter(t => !t.career);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [from, setFrom] = useState<Trainer | null>(null);
  return (
    <div className="who-plays">
      {doc.rules.allowCollection && trainers.length > 0 && (
        <>
          <b>Usar um treinador seu (com a coleção dele)</b>
          <div className="career-list">
            {trainers.map(t => (
              <button key={t.id} className={`career-chip pick ${from?.id === t.id ? 'selected' : ''}`} onClick={() => setFrom(from?.id === t.id ? null : t)}>
                <TrainerAvatar avatar={t.avatar} name={t.name} size={40} />
                <b>{t.name}</b>
              </button>
            ))}
          </div>
          {!from && <b>Ou criar um treinador novo, do zero</b>}
        </>
      )}
      {!from && (
        <>
          <label className="field">
            Seu nome na carreira
            <input value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Seu nome" />
          </label>
          <AvatarEditor avatar={avatar} onChange={setAvatar} />
        </>
      )}
      <div className="row center">
        <button
          className="btn primary"
          disabled={busy || (!from && !name.trim())}
          onClick={() => (from ? onEnter(from.name, from.avatar, from.id) : onEnter(name, avatar))}
        >
          {busy ? 'Conectando...' : 'Entrar na carreira'}
        </button>
      </div>
    </div>
  );
}

function CareerSetup() {
  const {setScreen, enterCareer} = useGame();
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [careerName, setCareerName] = useState('Liga dos Amigos');
  const [rules, setRules] = useState<CareerRules>(DEFAULT_RULES);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<CareerDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!cloudReady())
    return (
      <div className="screen career-screen">
        <h2>🌐 Carreira online</h2>
        <div className="panel career-panel">
          <p>A carreira online ainda não foi ligada neste site (falta configurar a nuvem grátis). Assim que estiver pronta, este botão funciona.</p>
          <button className="btn" onClick={() => setScreen('title')}>
            Voltar
          </button>
        </div>
      </div>
    );

  const create = async (name: string, avatar: string, colFrom?: string) => {
    setBusy(true);
    setError('');
    try {
      let c = newCareerCode();
      for (let i = 0; i < 3 && (await cloud.getCareer(c)); i++) c = newCareerCode();
      const doc: CareerDoc = {code: c, name: careerName.trim() || 'Carreira', host: deviceId(), createdAt: Date.now(), rules};
      await cloud.putCareer(doc);
      enterCareer(doc, name, avatar, colFrom);
    } catch {
      setError('Não consegui falar com a nuvem. Confira a internet e tente de novo.');
    }
    setBusy(false);
  };

  const lookup = async () => {
    setBusy(true);
    setError('');
    try {
      const doc = await cloud.getCareer(code.trim());
      if (!doc) setError('Não achei nenhuma carreira com esse código.');
      setFound(doc);
    } catch {
      setError('Não consegui falar com a nuvem. Confira a internet e tente de novo.');
    }
    setBusy(false);
  };

  return (
    <div className="screen career-screen">
      <h2>🌐 Carreira online</h2>
      {mode === 'menu' && (
        <div className="career-modes">
          <button className="panel qp-card" onClick={() => setMode('create')}>
            <b>Criar carreira</b>
            <span>Você é o host: escolhe as regras e passa o código para os amigos.</span>
          </button>
          <button className="panel qp-card" onClick={() => setMode('join')}>
            <b>Entrar com código</b>
            <span>Um amigo já criou? Digite o código que ele mandou.</span>
          </button>
        </div>
      )}
      {mode === 'create' && (
        <div className="panel career-panel">
          <label className="field">
            Nome da carreira
            <input value={careerName} maxLength={30} onChange={e => setCareerName(e.target.value)} />
          </label>
          <h3>Regras</h3>
          <RulesForm rules={rules} onChange={setRules} />
          <h3>Quem é você nessa carreira?</h3>
          <WhoPlays doc={{code: '', name: careerName, host: '', createdAt: 0, rules}} busy={busy} onEnter={create} />
        </div>
      )}
      {mode === 'join' && (
        <div className="panel career-panel">
          {!found ? (
            <>
              <label className="field">
                Código da carreira
                <input className="code-input" value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC123" />
              </label>
              <div className="row center">
                <button className="btn primary" disabled={busy || code.trim().length < 4} onClick={lookup}>
                  {busy ? 'Procurando...' : 'Procurar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>{found.name}</h3>
              <ul className="rules-list">
                {rulesSummary(found.rules).map(r => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <WhoPlays doc={found} busy={busy} onEnter={(n, a, f) => enterCareer(found, n, a, f)} />
            </>
          )}
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      <div className="row center">
        <button className="btn small" onClick={() => (mode === 'menu' ? setScreen('title') : (setMode('menu'), setFound(null), setError('')))}>
          Voltar
        </button>
      </div>
    </div>
  );
}

const MEDAL: Record<number, string> = {1: '🥇', 2: '🥈', 3: '🥉'};

function PlayerRow({p, pos, me, seasons, rounds, onPoints, onProfile}: {p: PlayerDoc; pos: number; me: boolean; seasons: number; rounds: number; onPoints: () => void; onProfile?: () => void}) {
  const titles = p.results.filter(r => r.placement === 1);
  return (
    <div className={`standing-row ${me ? 'me' : ''}`}>
      <span className="pos">{pos}º</span>
      <TrainerAvatar avatar={p.avatar} name={p.name} size={44} />
      <div className="who">
        <button className="link" onClick={onProfile} disabled={!onProfile} title="Ver perfil">
          <b>
            {p.name}
            {me ? ' (você)' : ''}
          </b>
        </button>
        <small className="hint">
          {p.done ? 'Terminou a carreira' : `Temporada ${p.season}/${seasons} · ronda ${p.round}/${rounds}`}
          {titles.length > 0 && ` · ${titles.map(t => `🏆 ${tourInfo(t.kind as TourKind).name}`).join(', ')}`}
        </small>
        <div className="mini-team">
          {p.team.slice(0, 6).map((m, i) => (
            <span key={i} title={`${m.species} nv. ${m.level}`}>
              <Sprite name={m.species} />
            </span>
          ))}
        </div>
      </div>
      <button className="pts link-pts" onClick={onPoints} title="Ver de onde vêm os pontos">
        {MEDAL[pos] ?? ''} {p.banked + p.points} pts
      </button>
    </div>
  );
}

function CareerHub() {
  const {trainer, career, refreshCareer, setScreen, selectTrainer} = useGame();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void refreshCareer();
    const id = setInterval(() => void refreshCareer(), 20000);
    return () => clearInterval(id);
  }, [refreshCareer]);
  if (!trainer?.career) return null;
  const code = trainer.career.code;
  const share = `${location.origin}${location.pathname}`;
  return (
    <div className="screen career-screen">
      <h2>🌐 {career?.name ?? 'Carreira'}</h2>
      <div className="career-top">
        <div className="panel career-code">
          <small>Código para os amigos</small>
          <b className="code">{code}</b>
          <button
            className="btn small"
            onClick={() => {
              navigator.clipboard?.writeText(`Entra na minha carreira do Pokémon Road to Glory! Abre ${share} → Carreira online → Entrar com código: ${code}`).catch(() => undefined);
              setCopied(true);
            }}
          >
            {copied ? 'Convite copiado!' : 'Copiar convite'}
          </button>
        </div>
        {career && (
          <div className="panel career-rules">
            <b>Regras do host</b>
            <ul className="rules-list">
              {rulesSummary(career.rules).map(r => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="panel standings">
        <div className="row between">
          <h3>Classificação</h3>
          <button className="btn small ghost" onClick={() => void refreshCareer()}>
            ↻ Atualizar
          </button>
        </div>
        <CareerStandings />
        <p className="hint small">
          Cada um joga no seu tempo. Nos torneios, os outros jogadores entram na sua chave com o time que levaram para aquele torneio (ou o time de agora, se ainda não chegaram lá).
        </p>
      </div>
      <div className="row center">
        <button className="btn primary big-play" onClick={() => setScreen('title')}>
          ▶ Jogar
        </button>
        <button className="btn small ghost" onClick={() => selectTrainer(null)}>
          Trocar treinador
        </button>
      </div>
    </div>
  );
}

/** Extrato de pontos de um jogador (o que o ranking mostra ao clicar nos pontos). */
function PointsModal({p, onClose}: {p: PlayerDoc; onClose: () => void}) {
  const log = p.log ?? [];
  return (
    <Modal onClose={onClose}>
      <h2>Pontos de {p.name}</h2>
      <div className="points-list">
        {p.banked > 0 && (
          <div className="points-row">
            <span>Temporadas anteriores</span>
            <b>{p.banked}</b>
          </div>
        )}
        {log.map(e => (
          <div key={e.label} className="points-row">
            <span>{e.label}</span>
            <b>+{e.pts}</b>
          </div>
        ))}
        {!log.length && !p.banked && <p className="hint">Ainda sem pontos nesta temporada.</p>}
        <div className="points-row total">
          <span>Total</span>
          <b>{p.banked + p.points}</b>
        </div>
      </div>
    </Modal>
  );
}

/** Classificação da carreira: os jogadores e os rivais (bots) que jogam a temporada junto. */
export function CareerStandings({compact}: {compact?: boolean}) {
  const {trainer, career, careerPeers, run} = useGame();
  const [open, setOpen] = useState<PlayerDoc | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  if (!trainer?.career) return null;
  const myId = playerId(trainer.id);
  const bots = run?.career?.code === trainer.career.code ? (run.world?.bots ?? []) : [];
  type Row = {key: string; total: number; p?: PlayerDoc; b?: WorldBot};
  const rows: Row[] = [
    ...standings(careerPeers).map((p): Row => ({key: p.id, total: p.banked + p.points, p})),
    ...bots.map((b): Row => ({key: "bot-" + b.name, total: b.banked + b.points, b})),
  ].sort((x, y) => y.total - x.total || (x.p ? -1 : 1));
  const show = (r: Row) => setProfile(r.p ? profileOfPeer(r.p) : profileOfBot(r.b!));
  return (
    <div className={compact ? 'standings-compact' : undefined}>
      {careerPeers.length === 0 && <p className="hint">Ninguém jogou ainda. Manda o código para os amigos!</p>}
      {rows.map((r, i) =>
        compact ? (
          <button key={r.key} className={`mini-standing ${r.p?.id === myId ? 'me' : ''} ${r.b ? 'bot' : ''}`} onClick={() => show(r)}>
            <span>{i + 1}º</span>
            <b>{r.p?.name ?? r.b!.name}</b>
            <small>{r.b ? 'rival' : r.p!.out ? 'fora da temporada' : `ronda ${r.p!.round}`}</small>
            <span className="pts">{r.total}</span>
          </button>
        ) : r.p ? (
          <PlayerRow key={r.key} p={r.p} pos={i + 1} me={r.p.id === myId} seasons={career?.rules.seasons ?? 1} rounds={career?.rules.rounds ?? 120} onPoints={() => setOpen(r.p!)} onProfile={() => show(r)} />
        ) : (
          <div key={r.key} className="standing-row bot">
            <span className="pos">{i + 1}º</span>
            <TrainerAvatar avatar={r.b!.avatar} name={r.b!.name} size={44} />
            <button className="who link" onClick={() => show(r)}>
              <b>{r.b!.name}</b>
              <small className="hint">
                Rival · {r.b!.badges.length} insígnia{r.b!.badges.length === 1 ? '' : 's'} · parceiro {r.b!.partner}
              </small>
            </button>
            <button className="pts link-pts" onClick={() => show(r)} title="Ver o perfil e de onde vêm os pontos">
              {r.total} pts
            </button>
          </div>
        ),
      )}
      {open && <PointsModal p={open} onClose={() => setOpen(null)} />}
      {profile && <ProfileModal profile={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}

/** Ronda terminada: esperando os outros jogadores terminarem a deles. */
export function WaitingScreen() {
  const {run, trainer, careerPeers, careerContinue} = useGame();
  useEffect(() => {
    void careerContinue();
    const id = setInterval(() => void careerContinue(), 5000);
    return () => clearInterval(id);
  }, [careerContinue]);
  if (!run?.career || !trainer) return null;
  const blockers = roundBlockers(careerPeers, playerId(trainer.id), run.career.season, run.wave);
  return (
    <div className="screen career-screen">
      <div className="panel career-panel waiting-panel">
        <h2>⏳ Esperando os amigos</h2>
        <p>Você terminou esta ronda! Na carreira as rondas andam juntas: a próxima começa quando todo mundo terminar a sua.</p>
        <div className="blockers">
          {blockers.map(p => (
            <div key={p.id} className="career-chip">
              <TrainerAvatar avatar={p.avatar} name={p.name} size={40} />
              <div>
                <b>{p.name}</b>
                <div className="hint small">{p.round ? `jogando a ronda ${p.round}` : 'ainda não começou a temporada'}</div>
              </div>
            </div>
          ))}
          {!blockers.length && <p className="hint">Todo mundo pronto! Seguindo...</p>}
        </div>
      </div>
      <div className="panel standings">
        <h3>Classificação</h3>
        <CareerStandings />
      </div>
    </div>
  );
}
