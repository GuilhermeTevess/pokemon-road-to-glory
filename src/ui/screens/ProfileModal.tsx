// Perfil de um treinador (você, um amigo ou um rival do mundo): insígnias e como ganhou,
// lendas, parceiro, favorito e estatísticas. Nada técnico (sem golpes, IVs ou natures).
import {useState} from 'react';
import {species} from '../../data/dex';
import {getGym} from '../../data/gyms';
import {getRegion} from '../../data/regions';
import {waveStep} from '../../game/career';
import {glimpse, playerScoutFromFights} from '../../game/scout';
import type {Profile} from '../../game/profile';
import {useGame} from '../../game/store';
import {Modal, Sprite} from '../components';
import {badgeImg} from './GymScreens';
import {TrainerAvatar} from './StartScreens';

const KIND = {me: 'Você', player: 'Jogador', bot: 'Rival'} as const;
const FIGHT = {gym: 'Ginásio', tour: 'Torneio', legend: 'Lenda', boss: 'Chefe', rival: 'Rival'} as const;

const name = (s: string) => species(s).name;

export function ProfileModal({profile: p, onClose}: {profile: Profile; onClose: () => void}) {
  const [badge, setBadge] = useState<string | null>(null);
  const [points, setPoints] = useState(false);
  // Numa carreira curta, mostra a ronda da carreira (não a ronda de jogo).
  const step = useGame(s => waveStep(s.run));
  const round = (w: number) => Math.ceil(w / step);
  const usage = Object.entries(p.usage).sort((a, b) => b[1] - a[1]);
  const most = usage[0]?.[1] ?? 1;
  // Perfil dos outros tem névoa: só o que saiu no noticiário e o que você já enfrentou.
  const mine = p.kind === 'me';
  const faced = useGame(s => s.run?.faced?.[p.name]);
  const known = mine ? null : playerScoutFromFights(p.fights, faced);
  const byRegion = new Map<string, Profile['badges']>();
  for (const b of p.badges) {
    const g = getGym(b.gym);
    if (!g) continue;
    byRegion.set(g.region, [...(byRegion.get(g.region) ?? []), b]);
  }
  const open = p.badges.find(b => b.gym === badge);
  const openGym = open ? getGym(open.gym) : undefined;
  return (
    <Modal onClose={onClose} wide>
      <div className="profile">
        <header className="profile-head">
          <TrainerAvatar avatar={p.avatar} name={p.name} size={88} />
          <div>
            <span className="event-tag">{KIND[p.kind]}</span>
            <h2>{p.name}</h2>
            {p.region && <p className="muted">Agora em {getRegion(p.region).name}</p>}
            <button className="btn small" onClick={() => setPoints(!points)}>
              {p.points + p.banked} pontos {points ? '▾' : '▸'}
            </button>
          </div>
          <div className="profile-mons">
            {p.partner && (
              <span>
                <Sprite name={p.partner} size={64} />
                <small>Parceiro: {name(p.partner)}</small>
              </span>
            )}
            {mine && p.favorite && p.favorite !== p.partner && (
              <span>
                <Sprite name={p.favorite} size={64} />
                <small>Mais jogado: {name(p.favorite)}</small>
              </span>
            )}
          </div>
        </header>

        {points && (
          <div className="points-list">
            {p.banked > 0 && (
              <div className="points-row">
                <span>Temporadas anteriores</span>
                <b>{p.banked}</b>
              </div>
            )}
            {p.log.map((e, i) => (
              <div key={i} className="points-row">
                <span>
                  {e.label}
                  {e.wave ? <small className="muted"> · ronda {round(e.wave)}</small> : null}
                </span>
                <b>+{e.pts}</b>
              </div>
            ))}
            {!p.log.length && <p className="hint">Ainda sem pontos nesta temporada.</p>}
          </div>
        )}

        <h3>Insígnias · {p.badges.length}</h3>
        {!p.badges.length && <p className="hint">Nenhuma insígnia nesta temporada ainda.</p>}
        {[...byRegion].map(([region, list]) => (
          <div key={region} className="profile-book">
            <small className="muted">{getRegion(region).name}</small>
            <div className="profile-badges">
              {list.map(b => (
                <button key={b.gym} className={`profile-badge ${badge === b.gym ? 'on' : ''}`} onClick={() => setBadge(badge === b.gym ? null : b.gym)} title={getGym(b.gym)?.badge}>
                  <img src={badgeImg(getGym(b.gym)!)} alt={getGym(b.gym)?.badge} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {open && openGym && (
          <div className="panel profile-badge-detail">
            <b>{openGym.badge}</b> · líder {openGym.leader}
            <p className="muted">
              {open.wave ? `Ganhou na ronda ${round(open.wave)}` : 'Ganhou nesta temporada'}
              {open.tries > 1 ? `, na ${open.tries}ª tentativa` : ', de primeira'}.
            </p>
            {open.team.length > 0 && (
              <div className="row">
                <small>{mine ? 'Levou:' : 'Destaques:'}</small>
                {(mine ? open.team : glimpse(open.team, `gym|${openGym.leader}|${open.wave}`)).map((s, i) => (
                  <Sprite key={i} name={s} size={40} still />
                ))}
              </div>
            )}
          </div>
        )}

        {p.legends.length > 0 && (
          <>
            <h3>Lendas vencidas</h3>
            <p>{p.legends.join(', ')}</p>
          </>
        )}

        {mine ? (
          <>
            <h3>Pokémon que mais jogou</h3>
            {!usage.length && <p className="hint">Ainda sem estatísticas.</p>}
            <div className="scout-usage">
              {usage.slice(0, 6).map(([s, n]) => (
                <div key={s} className="scout-use">
                  <Sprite name={s} size={32} still />
                  <span>{name(s)}</span>
                  <span className="scout-bar">
                    <i style={{width: `${Math.round((n / most) * 100)}%`}} />
                  </span>
                  <small>{n} rondas</small>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3>Pokémon conhecidos</h3>
            {!known!.seen.length && <p className="hint">Nenhuma luta de {p.name} saiu no noticiário ainda.</p>}
            <div className="scout-usage">
              {known!.seen.map(u => (
                <div key={u.species} className="scout-use">
                  <Sprite name={u.species} size={32} still />
                  <span>{name(u.species)}</span>
                  <small className={u.faced ? 'win-tag' : 'muted'}>{u.faced ? 'Você já enfrentou' : u.news > 1 ? `Nas notícias ${u.news}×` : 'Saiu numa notícia'}</small>
                </div>
              ))}
            </div>
            <p className="hint small">Só aparece o que saiu no noticiário (2 destaques por luta) e o que você já enfrentou.</p>
          </>
        )}

        {mine && p.fights.length > 0 && (
          <>
            <h3>Lutas importantes</h3>
            {p.fights.slice(0, 8).map((f, i) => (
              <div key={i} className="scout-row">
                <span className={f.won ? 'win-tag' : 'lose-tag'}>{f.won ? 'Venceu' : 'Perdeu'}</span>
                <span>
                  {FIGHT[f.kind]}: {f.vs} <small className="muted">· ronda {round(f.wave)}</small>
                </span>
                <span className="row">
                  {f.seen.map((s, j) => (
                    <Sprite key={j} name={s} size={28} still />
                  ))}
                </span>
              </div>
            ))}
          </>
        )}
        {!mine && known!.matches.length > 0 && (
          <>
            <h3>Últimas lutas no noticiário</h3>
            {known!.matches.map((f, i) => (
              <div key={i} className="scout-row">
                <span className={f.won ? 'win-tag' : 'lose-tag'}>{f.won ? 'Venceu' : 'Perdeu'}</span>
                <span>
                  {f.label}: {f.vs}
                </span>
                <span className="row">
                  {f.seen.map((s, j) => (
                    <Sprite key={j} name={s} size={28} still />
                  ))}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
