import {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {ALL_TYPES, RARITY_LABEL, TYPE_COLORS, TYPE_PT, defensiveMatchups, dex, itemSpriteUrl, species, spriteUrls, typeMultiplier} from '../data/dex';
import type {Rarity} from '../data/dex';
import {getItem} from '../data/items';
import {moveDescPt} from '../data/movesPt';
import {STATUS_PT} from '../game/battle';
import {calcStats} from '../game/mon';
import {useGame} from '../game/store';
import {STAT_IDS, STAT_LABEL} from '../game/types';
import type {OwnedMon} from '../game/types';

export function Sprite(props: {name: string; back?: boolean; shiny?: boolean; still?: boolean; className?: string; size?: number}) {
  const urls = spriteUrls(props.name, {back: props.back, shiny: props.shiny, still: props.still});
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [props.name, props.back, props.shiny]);
  return (
    <img
      className={`sprite ${props.className ?? ''}`}
      src={urls[Math.min(i, urls.length - 1)]}
      alt={props.name}
      style={props.size ? {maxWidth: props.size, maxHeight: props.size} : undefined}
      onError={() => setI(x => (x < urls.length - 1 ? x + 1 : x))}
      draggable={false}
      loading="lazy"
    />
  );
}

/** Nome do Pokémon: apelido grande com a espécie pequena embaixo; coração no parceiro. */
export function MonName({mon}: {mon: {species: string; nickname?: string; partner?: boolean}}) {
  const sp = species(mon.species).name;
  return (
    <span className="mon-name">
      {mon.partner && (
        <span className="partner-mark" title="Parceiro">
          <PixelIcon name="heart" size={12} color="var(--pink-d)" />
        </span>
      )}
      {mon.nickname ? (
        <span className="nick">
          {mon.nickname}
          <small className="species-sub">{sp}</small>
        </span>
      ) : (
        sp
      )}
    </span>
  );
}

export function ItemIcon({id, size = 28}: {id: string; size?: number}) {
  const item = getItem(id);
  return <img className="item-icon" src={itemSpriteUrl(item.sprite)} alt={item.name} width={size} height={size} />;
}

/** Selo de tipo. Com `info`, tocar abre a calculadora de tipos naquele tipo. */
export function TypeBadge({type, small, info}: {type: string; small?: boolean; info?: boolean}) {
  const style = {background: TYPE_COLORS[type] ?? '#777'};
  if (info) {
    return (
      <button
        className={`type-badge info ${small ? 'small' : ''}`}
        style={style}
        title={`Ver fraquezas de ${TYPE_PT[type] ?? type}`}
        onClick={e => {
          e.stopPropagation();
          useGame.getState().openTypeCalc([type]);
        }}
      >
        {TYPE_PT[type] ?? type}
      </button>
    );
  }
  return (
    <span className={`type-badge ${small ? 'small' : ''}`} style={style}>
      {TYPE_PT[type] ?? type}
    </span>
  );
}

export function Types({name}: {name: string}) {
  return (
    <span className="types">
      {species(name).types.map(t => (
        <TypeBadge key={t} type={t} small />
      ))}
    </span>
  );
}

export function RarityBadge({rarity}: {rarity: string}) {
  return <span className={`rarity rarity-${rarity}`}>{RARITY_LABEL[rarity as Rarity] ?? rarity}</span>;
}

export function StatusBadge({status}: {status?: string}) {
  if (!status || !STATUS_PT[status]) return null;
  return <span className={`status status-${status}`}>{STATUS_PT[status]}</span>;
}

export function HpBar({hp, maxhp, showNumbers}: {hp: number; maxhp: number; showNumbers?: boolean}) {
  const pct = maxhp ? Math.max(0, Math.min(100, (hp / maxhp) * 100)) : 0;
  const color = pct > 50 ? '#3ddc84' : pct > 20 ? '#f2c94c' : '#eb5757';
  return (
    <div className="hp">
      <div className="hp-label">HP</div>
      <div className="hp-track">
        <div className="hp-fill" style={{width: `${pct}%`, background: color}} />
      </div>
      {showNumbers && (
        <div className="hp-num">
          {Math.max(0, hp)}/{maxhp}
        </div>
      )}
    </div>
  );
}

/** Painel de fraquezas e resistências — o "type calculator" embutido. */
export function MatchupPanel({types, title}: {types: readonly string[]; title?: string}) {
  const m = defensiveMatchups(types);
  const row = (label: string, list: string[], cls: string) =>
    list.length ? (
      <div className={`mu-row ${cls}`}>
        <span className="mu-label">{label}</span>
        <span className="mu-types">
          {list.map(t => (
            <TypeBadge key={t} type={t} small info />
          ))}
        </span>
      </div>
    ) : null;
  return (
    <div className="matchups">
      {title && <div className="mu-title">{title}</div>}
      {row('Toma 4x', m.x4, 'mu-x4')}
      {row('Toma 2x', m.x2, 'mu-x2')}
      {row('Toma ½', m.half, 'mu-half')}
      {row('Toma ¼', m.quarter, 'mu-quarter')}
      {row('Imune', m.immune, 'mu-immune')}
    </div>
  );
}

export function StatsTable({mon}: {mon: OwnedMon}) {
  const stats = calcStats(mon);
  const base = species(mon.species).baseStats;
  return (
    <table className="stats">
      <thead>
        <tr>
          <th />
          <th>Base</th>
          <th>IV</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        {STAT_IDS.map(s => (
          <tr key={s}>
            <td>{STAT_LABEL[s]}</td>
            <td>{base[s]}</td>
            <td className={mon.ivs[s] === 31 ? 'perfect' : ''}>{mon.ivs[s]}</td>
            <td>{stats[s]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Modal({children, onClose, wide}: {children: ReactNode; onClose?: () => void; wide?: boolean}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={e => e.stopPropagation()}>
        {onClose && (
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function effectivenessLabel(mult: number | null): {text: string; cls: string} | null {
  if (mult === null) return null;
  if (mult === 0) return {text: 'Sem efeito', cls: 'eff-0'};
  if (mult >= 4) return {text: 'Super efetivo 4x', cls: 'eff-4'};
  if (mult >= 2) return {text: 'Super efetivo 2x', cls: 'eff-2'};
  if (mult <= 0.25) return {text: 'Pouco efetivo ¼', cls: 'eff-q'};
  if (mult < 1) return {text: 'Pouco efetivo ½', cls: 'eff-h'};
  return {text: 'Efeito normal 1x', cls: 'eff-1'};
}

// ---------------------------------------------------------------- Ícones pixel

const ICONS: Record<string, string[]> = {
  sound: ['...#....', '..##.#..', '####..#.', '####.#.#', '####.#.#', '####..#.', '..##.#..', '...#....'],
  mute: ['...#....', '..##....', '####.#.#', '####..#.', '####..#.', '####.#.#', '..##....', '...#....'],
  home: ['...##...', '..####..', '.######.', '########', '.##..##.', '.##..##.', '.######.', '........'],
  back: ['...#....', '..##....', '.#######', '########', '.#######', '..##....', '...#....', '........'],
  star: ['...#....', '...#....', '#######.', '.#####..', '..###...', '.##.##..', '##...##.', '........'],
  help: ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '........', '...##...', '...##...'],
  dice: ['########', '#......#', '#.##...#', '#.##.#.#', '#...##.#', '#...##.#', '#......#', '########'],
  candy: ['........', '#......#', '##.##.##', '########', '########', '##.##.##', '#......#', '........'],
  egg: ['...##...', '..####..', '.##.###.', '.######.', '###.####', '########', '.######.', '..####..'],
  heart: ['........', '.##.##..', '#######.', '#######.', '.#####..', '..###...', '...#....', '........'],
  map: ['##.##.##', '#.#..#.#', '#.#..#.#', '#.#..#.#', '#.#..#.#', '#.#..#.#', '#.#..#.#', '##.##.##'],
  trophy: ['########', '#.####.#', '#.####.#', '.######.', '..####..', '...##...', '..####..', '.######.'],
};

export function PixelIcon({name, size = 16, color = 'currentColor'}: {name: keyof typeof ICONS | string; size?: number; color?: string}) {
  const rows = ICONS[name] ?? ICONS.star;
  return (
    <svg className="pixel-icon" width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((r, y) => [...r].map((ch, x) => (ch === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null)))}
    </svg>
  );
}

/** Filtro por tipo (chips clicáveis). */
export function TypeFilter({value, onChange, types}: {value: string | null; onChange: (t: string | null) => void; types: string[]}) {
  return (
    <div className="type-filter">
      <button className={`chip ${value === null ? 'active' : ''}`} onClick={() => onChange(null)}>
        Todos
      </button>
      {types.map(t => (
        <button
          key={t}
          className={`chip type-chip ${value === t ? 'active' : ''}`}
          style={{['--tc' as string]: TYPE_COLORS[t]}}
          onClick={() => onChange(value === t ? null : t)}
        >
          {TYPE_PT[t] ?? t}
        </button>
      ))}
    </div>
  );
}

/** Teia (hexágono) de IVs: antes em cinza, depois em cor, com o ganho de cada atributo. */
export function IvWeb({before, after, size = 260}: {before: Record<string, number>; after: Record<string, number>; size?: number}) {
  const r = size / 2 - 56;
  const c = size / 2;
  const pt = (i: number, v: number) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 3;
    const d = (v / 31) * r;
    return [c + Math.cos(ang) * d, c + Math.sin(ang) * d];
  };
  const poly = (vals: Record<string, number>) => STAT_IDS.map((s, i) => pt(i, vals[s]).join(',')).join(' ');
  return (
    <svg className="iv-web" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={STAT_IDS.map((_, i) => pt(i, 31 * f).join(',')).join(' ')} className="iv-grid" />
      ))}
      <polygon points={poly(before)} className="iv-before" />
      <polygon points={poly(after)} className="iv-after" />
      {STAT_IDS.map((s, i) => {
        const [x, y] = pt(i, 31 * 1.38);
        const gain = after[s] - before[s];
        return (
          <text key={s} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="iv-label">
            <tspan>{STAT_LABEL[s].replace('Velocidade', 'Vel.')}</tspan>
            <tspan x={x} dy="1.1em" className={gain > 0 ? 'iv-gain' : ''}>
              {after[s]}
              {gain > 0 ? ` +${gain}` : ''}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

/**
 * Fraquezas do time: para cada tipo de ataque, quantos Pokémon do time levam
 * dano dobrado e quantos resistem. Tipos que pegam metade do time sem ninguém
 * resistindo ficam marcados como perigo.
 */
export function TeamWeakness({party, compact}: {party: OwnedMon[]; compact?: boolean}) {
  if (!party.length) return null;
  const rows = ALL_TYPES.map(t => {
    let weak = 0;
    let resist = 0;
    for (const m of party) {
      const mult = typeMultiplier(t, species(m.species).types);
      if (mult > 1) weak++;
      else if (mult < 1) resist++;
    }
    return {type: t, weak, resist, danger: weak >= Math.ceil(party.length / 2) && resist === 0};
  });
  const danger = rows.filter(r => r.danger);
  const shown = compact ? rows.filter(r => r.weak > 0).sort((a, b) => b.weak - b.resist - (a.weak - a.resist)) : rows;
  return (
    <div className={`team-weak ${compact ? 'compact' : ''}`}>
      {danger.length > 0 && (
        <p className="tw-alert">
          Cuidado com:{' '}
          {danger.map(r => (
            <TypeBadge key={r.type} type={r.type} small info />
          ))}
        </p>
      )}
      <div className="tw-grid">
        {shown.map(r => (
          <div key={r.type} className={`tw-cell ${r.danger ? 'danger' : ''}`}>
            <TypeBadge type={r.type} small info />
            <span className={r.weak ? 'tw-weak' : 'tw-zero'} title="Fracos a esse tipo">
              {r.weak} fraco{r.weak === 1 ? '' : 's'}
            </span>
            {!compact && (
              <span className={r.resist ? 'tw-res' : 'tw-zero'} title="Resistem ou são imunes">
                {r.resist} resiste{r.resist === 1 ? '' : 'm'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Calculadora de tipos: escolha 1 ou 2 tipos e veja quanto cada tipo de golpe tira
 * deles (4x, 2x, ½, ¼, imune) e quanto os golpes deles tiram dos outros. Abre ao
 * tocar em qualquer tipo das fraquezas ou pelo botão "Tipos".
 */
export function TypeCalc({initial, onClose}: {initial: string[]; onClose: () => void}) {
  const [sel, setSel] = useState<string[]>(initial.slice(0, 2));
  const toggle = (t: string) =>
    setSel(cur => (cur.includes(t) ? cur.filter(x => x !== t) : cur.length >= 2 ? [cur[1], t] : [...cur, t]));
  const name = sel.map(t => TYPE_PT[t] ?? t).join('/');
  return (
    <Modal onClose={onClose} wide>
      <h2>Calculadora de tipos</h2>
      <p className="hint">Escolha 1 ou 2 tipos (o tipo do Pokémon inimigo, por exemplo).</p>
      <div className="type-filter">
        {ALL_TYPES.map(t => (
          <button
            key={t}
            className={`chip type-chip ${sel.includes(t) ? 'active' : ''}`}
            style={{['--tc' as string]: TYPE_COLORS[t]}}
            onClick={() => toggle(t)}
          >
            {TYPE_PT[t] ?? t}
          </button>
        ))}
      </div>
      {sel.length > 0 && (
        <div className="calc-grid">
          <section className="calc-box">
            <MatchupPanel types={sel} title={`${name} defendendo`} />
          </section>
          {sel.map(a => {
            const by = (f: (x: number) => boolean) => ALL_TYPES.filter(d => f(typeMultiplier(a, [d])));
            const rows: [string, string[], string][] = [
              ['Dá 2x em', by(x => x > 1), 'mu-x2'],
              ['Dá ½ em', by(x => x > 0 && x < 1), 'mu-half'],
              ['Não afeta', by(x => x === 0), 'mu-immune'],
            ];
            return (
              <section key={a} className="calc-box">
                <div className="matchups">
                  <div className="mu-title">{TYPE_PT[a] ?? a} atacando</div>
                  {rows.map(([label, list, cls]) =>
                    list.length ? (
                      <div key={label} className={`mu-row ${cls}`}>
                        <span className="mu-label">{label}</span>
                        <span className="mu-types">
                          {list.map(t => (
                            <TypeBadge key={t} type={t} small />
                          ))}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

const CATEGORY_PT: Record<string, {name: string; hint: string}> = {
  Physical: {name: 'Físico', hint: 'Dano calculado com o Ataque de quem usa contra a Defesa do alvo.'},
  Special: {name: 'Especial', hint: 'Dano calculado com o Ataque Especial de quem usa contra a Defesa Especial do alvo.'},
  Status: {name: 'Status', hint: 'Não causa dano: aumenta ou baixa atributos, causa status, cura, prepara o campo...'},
};

const TARGET_PT: Record<string, string> = {
  normal: 'Um alvo',
  self: 'Quem usa',
  adjacentFoe: 'Um inimigo',
  allAdjacentFoes: 'Todos os inimigos',
  allAdjacent: 'Todos ao redor (inclusive aliados)',
  any: 'Qualquer um',
  randomNormal: 'Um inimigo aleatório',
  allySide: 'O próprio lado do campo',
  foeSide: 'O lado inimigo do campo',
  all: 'O campo inteiro',
  allies: 'Todo o time',
  adjacentAlly: 'Um aliado',
  adjacentAllyOrSelf: 'Quem usa ou um aliado',
  allyTeam: 'Todo o time',
  scripted: 'Quem atacou por último',
};

const BOOST_PT: Record<string, string> = {atk: 'Ataque', def: 'Defesa', spa: 'Atq. Esp.', spd: 'Def. Esp.', spe: 'Velocidade', accuracy: 'Precisão', evasion: 'Evasão'};

/** Ficha completa de um golpe: o que é, quanto bate, se erra, o que faz. */
export function MoveInfo({move, onClose}: {move: string; onClose: () => void}) {
  const m = dex.moves.get(move);
  const cat = CATEGORY_PT[m.category];
  const boosts = (b: Partial<Record<string, number>> | null | undefined, who: string) =>
    b
      ? Object.entries(b).map(([k, v]) => (
          <li key={who + k}>
            {who}: {BOOST_PT[k] ?? k} {v! > 0 ? `+${v}` : v}
          </li>
        ))
      : null;
  const effects: ReactNode[] = [];
  if (m.boosts) effects.push(boosts(m.boosts, m.target === 'self' ? 'Quem usa' : 'Alvo'));
  if (m.self?.boosts) effects.push(boosts(m.self.boosts, 'Quem usa'));
  if (m.secondary?.boosts) effects.push(boosts(m.secondary.boosts, `${m.secondary.chance ?? 100}% de chance, alvo`));
  if (m.secondary?.self?.boosts) effects.push(boosts(m.secondary.self.boosts, `${m.secondary.chance ?? 100}% de chance, quem usa`));
  if (m.drain) effects.push(<li key="drain">Recupera {Math.round((m.drain[0] / m.drain[1]) * 100)}% do dano causado</li>);
  if (m.recoil) effects.push(<li key="recoil">Quem usa sofre {Math.round((m.recoil[0] / m.recoil[1]) * 100)}% do dano causado</li>);
  if (m.heal) effects.push(<li key="heal">Cura {Math.round((m.heal[0] / m.heal[1]) * 100)}% do HP máximo</li>);
  if (m.multihit) effects.push(<li key="multi">Acerta {Array.isArray(m.multihit) ? `${m.multihit[0]} a ${m.multihit[1]}` : m.multihit} vezes</li>);
  if (m.critRatio && m.critRatio > 1) effects.push(<li key="crit">Chance alta de acerto crítico</li>);
  return (
    <Modal onClose={onClose}>
      <h2>{m.name}</h2>
      <div className="row center wrap">
        <TypeBadge type={m.type} />
        <span className={`cat-badge cat-${m.category}`}>{cat.name}</span>
      </div>
      <p className="move-info-desc">{moveDescPt(m.name)}</p>
      <table className="move-info">
        <tbody>
          <tr>
            <th>Poder</th>
            <td>{m.basePower ? m.basePower : m.category === 'Status' ? '— (não causa dano)' : 'Varia'}</td>
          </tr>
          <tr>
            <th>Precisão</th>
            <td>{m.accuracy === true ? 'Nunca erra' : `${m.accuracy}%`}</td>
          </tr>
          <tr>
            <th>PP</th>
            <td>{m.pp} usos</td>
          </tr>
          <tr>
            <th>Prioridade</th>
            <td>
              {m.priority > 0 ? `+${m.priority} (age antes dos outros)` : m.priority < 0 ? `${m.priority} (age depois dos outros)` : 'Normal (o mais rápido age primeiro)'}
            </td>
          </tr>
          <tr>
            <th>Alvo</th>
            <td>{TARGET_PT[m.target] ?? m.target}</td>
          </tr>
          <tr>
            <th>Contato</th>
            <td>{m.flags.contact ? 'Sim (encosta no alvo)' : 'Não'}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        <b>{cat.name}:</b> {cat.hint}
        {m.category !== 'Status' && ' Se o golpe tem o mesmo tipo de quem usa, bate 1,5x mais forte.'}
      </p>
      {effects.length > 0 && (
        <>
          <h3>Efeitos</h3>
          <ul className="move-effects">{effects}</ul>
        </>
      )}
    </Modal>
  );
}
