import {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {RARITY_LABEL, TYPE_COLORS, TYPE_PT, defensiveMatchups, itemSpriteUrl, species, spriteUrls} from '../data/dex';
import type {Rarity} from '../data/dex';
import {getItem} from '../data/items';
import {STATUS_PT} from '../game/battle';
import {calcStats} from '../game/mon';
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

export function ItemIcon({id, size = 28}: {id: string; size?: number}) {
  const item = getItem(id);
  return <img className="item-icon" src={itemSpriteUrl(item.sprite)} alt={item.name} width={size} height={size} />;
}

export function TypeBadge({type, small}: {type: string; small?: boolean}) {
  return (
    <span className={`type-badge ${small ? 'small' : ''}`} style={{background: TYPE_COLORS[type] ?? '#777'}}>
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
            <TypeBadge key={t} type={t} small />
          ))}
        </span>
      </div>
    ) : null;
  return (
    <div className="matchups">
      {title && <div className="mu-title">{title}</div>}
      {row('Fraco 4x', m.x4, 'mu-x4')}
      {row('Fraco 2x', m.x2, 'mu-x2')}
      {row('Resiste ½', m.half, 'mu-half')}
      {row('Resiste ¼', m.quarter, 'mu-quarter')}
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
