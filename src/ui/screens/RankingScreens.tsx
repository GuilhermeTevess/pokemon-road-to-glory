// Elos e ranking online: brasão pixelado de cada elo, a faixa de elos do perfil e a tabela
// de classificação (geral ou por modo) dentro da lista de jogadores.
import {useState, type ReactElement} from 'react';
import {ELOS, GENERAL_MULT, MAX_GAIN, RANK_MODES, SAFE_ZONE, eloOf, totalPoints, type Elo, type Points, type RankKey} from '../../game/ranking';
import type {PlayerCard} from '../../game/players';
import {PixelIcon} from '../components';
import {TrainerAvatar} from './StartScreens';

// Escudo 16x16: O = contorno, F = cor do elo, H = brilho, S = sombra. O emblema entra por cima.
const SHIELD = [
  '..OOOOOOOOOOOO..',
  '.OHHHHHHHHHHHFO.',
  'OHHFFFFFFFFFFFSO',
  'OHFFFFFFFFFFFFSO',
  'OHFFFFFFFFFFFFSO',
  'OHFFFFFFFFFFFFSO',
  'OHFFFFFFFFFFFFSO',
  'OHFFFFFFFFFFFFSO',
  'OHFFFFFFFFFFFFSO',
  '.OHFFFFFFFFFFSO.',
  '.OHFFFFFFFFFFSO.',
  '..OHFFFFFFFFSO..',
  '...OHFFFFFFSO...',
  '....OOFFFFOO....',
  '......OSSO......',
  '.......OO.......',
];

// Emblema 8x8 de cada elo (# = cor clara, d = cor escura), no meio do escudo.
const EMBLEMS: Record<Elo['id'], string[]> = {
  bronze: ['........', '........', '...##...', '..####..', '..####..', '...##...', '........', '........'],
  prata: ['........', '.#....#.', '.##..##.', '..####..', '.#....#.', '.##..##.', '..####..', '........'],
  ouro: ['...##...', '...##...', '########', '.######.', '..####..', '.##..##.', '.#....#.', '........'],
  platina: ['...##...', '..####..', '.##dd##.', '##d##d##', '.##dd##.', '..####..', '...##...', '........'],
  diamante: ['........', '..####..', '.#d##d#.', '########', '.######.', '..####..', '...##...', '........'],
  mestre: ['#..##..#', '##.##.##', '########', '#d####d#', '########', '.######.', '........', '........'],
};

/** Brasão pixelado do elo. */
export function EloBadge({elo, size = 32}: {elo: Elo; size?: number}) {
  const emblem = EMBLEMS[elo.id];
  const fill: Record<string, string> = {O: '#1d1b26', F: elo.color, H: elo.light, S: elo.dark};
  const px: ReactElement[] = [];
  SHIELD.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (fill[ch]) px.push(<rect key={`s${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill[ch]} />);
    }),
  );
  emblem.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '#' || ch === 'd') px.push(<rect key={`e${x}-${y}`} x={x + 4} y={y + 3} width={1} height={1} fill={ch === '#' ? '#fffdf2' : elo.dark} />);
    }),
  );
  return (
    <svg className="elo-badge" width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" role="img" aria-label={`Elo ${elo.name}`}>
      <title>{`Elo ${elo.name}`}</title>
      {px}
    </svg>
  );
}

/** Brasão + nome + pontos e quanto falta para o próximo. */
export function EloCard({label, icon, pts, general}: {label: string; icon: string; pts: number; general?: boolean}) {
  const {elo, next, toNext, progress} = eloOf(pts, general);
  return (
    <div className={`elo-card panel ${general ? 'general' : ''}`}>
      <EloBadge elo={elo} size={general ? 48 : 36} />
      <span className="elo-card-info">
        <small className="muted">
          <PixelIcon name={icon} size={10} /> {label}
        </small>
        <b style={{['--elo' as string]: elo.dark, ['--elo-l' as string]: elo.light}} className="elo-name">
          {elo.name}
        </b>
        <small>{pts} pts</small>
        {next && (
          <span className="elo-bar" title={`Faltam ${toNext} pontos para ${next.name}`}>
            <span style={{width: `${Math.round(progress * 100)}%`, background: next.color}} />
          </span>
        )}
      </span>
    </div>
  );
}

/** Elos do perfil: o geral e os modos em que a pessoa já tem pontos. */
export function EloStrip({points}: {points?: Points}) {
  const played = RANK_MODES.filter(m => (points?.[m.key] ?? 0) > 0);
  return (
    <section className="elo-strip">
      <EloCard label="Ranking geral" icon="globe" pts={totalPoints(points)} general />
      {played.map(m => (
        <EloCard key={m.key} label={m.label} icon={m.icon} pts={points?.[m.key] ?? 0} />
      ))}
    </section>
  );
}

/** Como funcionam os pontos (texto curto para quem está começando). */
export function RankingHelp() {
  return (
    <details className="ranking-help panel">
      <summary>Como funcionam os pontos e os elos?</summary>
      <ul>
        <li>Só contam partidas online contra outras pessoas: Rush online, campeonato online, Dream Team online e carreira contra amigos.</li>
        <li>
          <b className="v">Vitória:</b> 20 pontos + até 20 pelos Pokémon que terminaram de pé + até 10 pela vida que sobrou. Ganhar com o time inteiro e vida cheia dá {MAX_GAIN}; ganhar por um fio dá uns 24. Se o adversário sair no meio, 15.
        </li>
        <li>
          <b className="d">Derrota:</b> tira 10, mas cada Pokémon que você derrubou devolve um pouco (perder por pouco tira só uns 3). Sair no meio tira 10.
        </li>
        <li>No Bronze (menos de {SAFE_ZONE} pontos num modo) derrota não tira nada, e ninguém fica negativo.</li>
        <li>Cada modo tem seu ranking e seu elo. O ranking geral soma todos os modos e pede o dobro de pontos para cada elo.</li>
      </ul>
      <div className="elo-ladder">
        {ELOS.map(e => (
          <span key={e.id}>
            <EloBadge elo={e} size={28} />
            <b>{e.name}</b>
            <small className="muted">
              {e.min} · geral {e.min * GENERAL_MULT}
            </small>
          </span>
        ))}
      </div>
    </details>
  );
}

type Board = 'all' | RankKey;

const pointsOf = (p: PlayerCard, board: Board) => (board === 'all' ? totalPoints(p.score?.pts) : (p.score?.pts[board] ?? 0));

/** Classificação: geral ou por modo. Só aparece quem já tem pontos. */
export function RankingBoard({list, isMine, onOpen}: {list: PlayerCard[]; isMine: (p: PlayerCard) => boolean; onOpen: (p: PlayerCard) => void}) {
  const [board, setBoard] = useState<Board>('all');
  const rows = list
    .map(p => ({p, pts: pointsOf(p, board)}))
    .filter(r => r.pts > 0)
    .sort((a, b) => b.pts - a.pts || b.p.at - a.p.at);
  return (
    <div className="ranking">
      <div className="ranking-tabs">
        <button className={`chip ${board === 'all' ? 'active' : ''}`} onClick={() => setBoard('all')}>
          <PixelIcon name="globe" size={10} /> Geral
        </button>
        {RANK_MODES.map(m => (
          <button key={m.key} className={`chip ${board === m.key ? 'active' : ''}`} onClick={() => setBoard(m.key)} title={m.label}>
            <PixelIcon name={m.icon} size={10} /> {m.short}
          </button>
        ))}
      </div>
      <RankingHelp />
      {!rows.length ? (
        <p className="muted">Ninguém tem pontos aqui ainda. Ganhe uma partida online contra um amigo e você entra no ranking.</p>
      ) : (
        <ol className="ranking-list">
          {rows.map(({p, pts}, i) => {
            const {elo} = eloOf(pts, board === 'all');
            return (
              <li key={p.key}>
                <button className={`ranking-row panel ${i < 3 ? `top top${i + 1}` : ''}`} onClick={() => onOpen(p)} title={`Ver o perfil de ${p.name}`}>
                  <span className="ranking-pos">{i + 1}º</span>
                  <EloBadge elo={elo} size={36} />
                  <TrainerAvatar avatar={p.avatar} name={p.name} size={40} />
                  <span className="players-info">
                    <b>
                      {p.name}
                      {isMine(p) && <span className="players-you">você</span>}
                    </b>
                    <small className="muted">{elo.name}</small>
                  </span>
                  <span className="ranking-pts">
                    {pts}
                    <small> pts</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
