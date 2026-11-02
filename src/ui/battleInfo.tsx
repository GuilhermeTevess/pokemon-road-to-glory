// Informações extras da batalha, iguais em todos os modos (run, carreira, Rush, Dream Team, online):
// ficha do Pokémon ao tocar no nome, estágios de atributo (+2 de Ataque...) e o histórico da luta.
// Só mostra o que os dois lados veem na tela: nada de item, habilidade, nature, EVs ou golpes não usados.
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ReactNode, RefObject} from 'react';
import {createPortal} from 'react-dom';
import {TYPE_COLORS, dex, species} from '../data/dex';
import type {BattleEvent, Side} from '../game/battle';
import {BOOST_LABEL, BOOST_STATS, BattleTracker, boostMultiplier, multiplierText} from '../game/battleLog';
import type {Boosts, LogEntry} from '../game/battleLog';
import {MoveInfo, PixelIcon, Sprite} from './components';
import {MonInfo} from './screens/BiomeGuide';

/** O histórico e os estágios da batalha. `push` no mesmo ritmo em que a tela mostra cada evento. */
export function useBattleTracker(): {tracker: BattleTracker; push: (ev: BattleEvent) => void} {
  const ref = useRef<BattleTracker | null>(null);
  ref.current ??= new BattleTracker();
  const [, bump] = useState(0);
  const push = useCallback((ev: BattleEvent) => {
    ref.current!.push(ev);
    bump(v => v + 1);
  }, []);
  return {tracker: ref.current, push};
}

const pretty = (name: string) => species(name).name.replace(/^(.*)-Mega(?:-([XY]))?$/, (_, base: string, xy?: string) => `Mega ${base}${xy ? ` ${xy}` : ''}`);

/** Nome do Pokémon que abre a ficha da espécie (tipos, stats base, habilidades possíveis, evoluções). */
export function SpeciesButton({name, children, className = ''}: {name: string; children?: ReactNode; className?: string}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`name-btn ${className}`} title={`Ver a ficha de ${pretty(name)}`} onClick={() => setOpen(true)}>
        {children ?? pretty(name)}
      </button>
      {open && <MonInfo name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Selinhos dos estágios diferentes de zero: "Atq +2", "Vel -1". */
function BoostChips({boosts}: {boosts: Boosts}) {
  return (
    <>
      {BOOST_STATS.filter(k => boosts[k]).map(k => (
        <span key={k} className={`boost-chip ${boosts[k]! > 0 ? 'up' : 'down'}`}>
          {BOOST_LABEL[k].short} {boosts[k]! > 0 ? `+${boosts[k]}` : boosts[k]}
        </span>
      ))}
    </>
  );
}

/**
 * Botão "Atributos" da caixinha do Pokémon. Mostra os estágios que mudaram e, ao tocar,
 * a lista completa com quanto cada um multiplica.
 */
export function BoostButton({boosts, open, onToggle, above}: {boosts: Boosts; open: boolean; onToggle: () => void; above?: boolean}) {
  const changed = BOOST_STATS.some(k => boosts[k]);
  return (
    <>
      <button className={`weak-btn boost-btn ${open ? 'open' : ''} ${changed ? 'changed' : ''}`} onClick={onToggle} title="Bônus e penalidades de atributo desta luta">
        {changed ? <BoostChips boosts={boosts} /> : 'Atributos'} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className={`weak-pop boost-pop ${above ? 'above' : 'below'}`}>
          <table className="boost-table">
            <tbody>
              {BOOST_STATS.map(k => {
                const n = boosts[k] ?? 0;
                return (
                  <tr key={k} className={n > 0 ? 'up' : n < 0 ? 'down' : ''}>
                    <td>{BOOST_LABEL[k].full}</td>
                    <td className="boost-pips" aria-label={`${n}`}>
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <i key={i} className={Math.abs(n) >= i ? 'on' : ''} />
                      ))}
                    </td>
                    <td className="boost-n">{n > 0 ? `+${n}` : n}</td>
                    <td className="boost-x">{multiplierText(boostMultiplier(k, n))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="weak-pop-hint">
            Golpes como Swords Dance sobem atributos e outros, como Draco Meteor, baixam. Vai de -6 a +6 e volta ao normal quando o Pokémon sai de campo.
          </p>
        </div>
      )}
    </>
  );
}

const RESULT_PT: Record<string, {text: string; cls: string}> = {
  super: {text: 'Super efetivo', cls: 'eff-2'},
  resisted: {text: 'Pouco efetivo', cls: 'eff-h'},
  crit: {text: 'Crítico', cls: 'eff-4'},
  miss: {text: 'Errou', cls: 'eff-1'},
  immune: {text: 'Sem efeito', cls: 'eff-0'},
  fail: {text: 'Falhou', cls: 'eff-1'},
};

/** Cabe o painel ao lado da batalha (à esquerda), sem cobrir nada? */
function useDockRoom(anchor: RefObject<HTMLElement | null>): {room: number; top: number} {
  const [room, setRoom] = useState({room: 0, top: 8});
  useLayoutEffect(() => {
    const measure = () => {
      const el = anchor.current?.closest('.battle-screen, .screen.battle') as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      setRoom(r ? {room: Math.floor(r.left), top: Math.max(8, Math.floor(r.top + scrollY))} : {room: 0, top: 8});
    };
    measure();
    addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && document.body) ro.observe(document.body);
    return () => {
      removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [anchor]);
  return room;
}

const DOCK_MIN = 230;

function savedDock(): boolean {
  try {
    return localStorage.getItem('rtg-battle-log') !== 'off';
  } catch {
    return true;
  }
}

function saveDock(on: boolean) {
  try {
    localStorage.setItem('rtg-battle-log', on ? 'on' : 'off');
  } catch {
    /* ignora */
  }
}

/**
 * Botão "Histórico" + painel com tudo o que aconteceu, rodada a rodada.
 * Em tela larga o painel fica fixo à esquerda da batalha; em tela menor (celular) abre por cima.
 * `owner(side)` diz de quem é cada lado ("Você", "Ana"...); `mine` é o lado de quem está jogando.
 */
export function BattleLog({tracker, owner, mine}: {tracker: BattleTracker; owner: (side: Side) => string; mine: Side}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const {room, top} = useDockRoom(anchor);
  const docked = room >= DOCK_MIN;
  const [dockOn, setDockOn] = useState(savedDock);
  const [drawer, setDrawer] = useState(false);
  const open = docked ? dockOn : drawer;
  const [move, setMove] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const count = tracker.entries.length;

  // Sempre mostra a última coisa que aconteceu.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, open]);

  const toggle = () => {
    if (docked) {
      setDockOn(!dockOn);
      saveDock(!dockOn);
    } else setDrawer(!drawer);
  };

  const groups = tracker.byTurn();
  const sideCls = (side?: Side) => (side ? (side === mine ? 'mine' : 'foe') : '');
  const who = (side: Side, name: string) => (
    <>
      <SpeciesButton name={name} />
      <small className="log-owner"> ({owner(side)})</small>
    </>
  );

  const row = (e: LogEntry, i: number) => {
    switch (e.kind) {
      case 'move': {
        const m = dex.moves.get(e.move);
        return (
          <li key={i} className={`log-row ${sideCls(e.side)}`}>
            <Sprite name={e.species} size={24} still />
            <span>
              {who(e.side, e.species)} usou{' '}
              <button
                type="button"
                className="log-move"
                style={{['--mc' as string]: TYPE_COLORS[m.type] ?? '#777'}}
                title={`Ver o golpe ${m.name}`}
                onClick={() => setMove(m.exists ? m.name : e.move)}
              >
                {m.exists ? m.name : e.move}
              </button>
              {e.results.map(r => (
                <span key={r} className={`eff log-res ${RESULT_PT[r].cls}`}>
                  {RESULT_PT[r].text}
                </span>
              ))}
            </span>
          </li>
        );
      }
      case 'switch':
        return (
          <li key={i} className={`log-row log-switch ${sideCls(e.side)}`}>
            <Sprite name={e.species} size={24} still />
            <span>
              {who(e.side, e.species)} entrou
            </span>
          </li>
        );
      case 'faint':
        return (
          <li key={i} className={`log-row log-faint ${sideCls(e.side)}`}>
            <Sprite name={e.species} size={24} still className="gray" />
            <span>
              {who(e.side, e.species)} desmaiou
            </span>
          </li>
        );
      case 'mega':
        return (
          <li key={i} className={`log-row log-mega ${sideCls(e.side)}`}>
            <Sprite name={e.species} size={24} still />
            <span>
              {who(e.side, e.species)} mega-evoluiu!
            </span>
          </li>
        );
      case 'boost':
        return (
          <li key={i} className={`log-row log-sub ${sideCls(e.side)}`}>
            <span>
              <span className={`boost-chip ${e.amount > 0 ? 'up' : 'down'}`}>
                {BOOST_LABEL[e.stat].short} {e.amount > 0 ? `+${e.amount}` : e.amount}
              </span>{' '}
              {BOOST_LABEL[e.stat].full} de {pretty(e.species)}
            </span>
          </li>
        );
      case 'clear':
        return (
          <li key={i} className={`log-row log-sub ${sideCls(e.side)}`}>
            <span>{e.species ? `Atributos de ${pretty(e.species)} voltaram ao normal` : 'Os atributos de todos voltaram ao normal'}</span>
          </li>
        );
    }
  };

  const panel = open
    ? createPortal(
        <aside className={`battle-log ${docked ? 'docked' : 'drawer'}`} style={docked ? {width: Math.min(300, room - 20), top} : undefined} aria-label="Histórico da batalha">
          <div className="battle-log-head">
            <b>
              <PixelIcon name="book" /> Histórico
            </b>
            <button className="modal-close" onClick={toggle} aria-label="Fechar histórico">
              ✕
            </button>
          </div>
          <div className="battle-log-list" ref={listRef}>
            {!groups.length && <p className="hint">Os golpes de cada rodada aparecem aqui.</p>}
            {groups.map(g => (
              <section key={g.turn}>
                <h5>{g.turn === 0 ? 'Começo' : `Rodada ${g.turn}`}</h5>
                <ul>{g.entries.map(row)}</ul>
              </section>
            ))}
          </div>
          <p className="battle-log-hint">Toque num golpe ou num Pokémon para ver os detalhes.</p>
        </aside>,
        document.body,
      )
    : null;

  return (
    <>
      <button ref={anchor} className={`btn small log-toggle ${open ? 'on' : ''}`} onClick={toggle} title="O que aconteceu em cada rodada">
        <PixelIcon name="book" /> Histórico
      </button>
      {panel}
      {move && <MoveInfo move={move} onClose={() => setMove(null)} />}
    </>
  );
}
