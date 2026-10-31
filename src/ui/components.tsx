import {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
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

/** Brilhinho de shiny em pixel art (estrela de 4 pontas que pisca). */
export function ShinyStar({size = 12}: {size?: number}) {
  // Grade 7x7: o miolo claro e as pontas douradas.
  const gold = [[3, 0], [3, 1], [0, 3], [1, 3], [5, 3], [6, 3], [3, 5], [3, 6], [2, 2], [4, 2], [2, 4], [4, 4]];
  const core = [[3, 2], [2, 3], [3, 3], [4, 3], [3, 4]];
  return (
    <svg className="shiny-star" width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-label="Shiny">
      <title>Shiny</title>
      {gold.map(([x, y]) => (
        <rect key={`g${x}-${y}`} x={x} y={y} width={1} height={1} fill="#f2b400" />
      ))}
      {core.map(([x, y]) => (
        <rect key={`c${x}-${y}`} x={x} y={y} width={1} height={1} fill="#fff6c2" />
      ))}
    </svg>
  );
}

/** Nome do Pokémon: apelido grande com a espécie pequena embaixo; coração no parceiro, brilho no shiny. */
export function MonName({mon}: {mon: {species: string; nickname?: string; partner?: boolean; shiny?: boolean}}) {
  const sp = species(mon.species).name.replace(/^(.*)-Mega(?:-([XY]))?$/, (_, base: string, xy?: string) => `Mega ${base}${xy ? ` ${xy}` : ''}`);
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
      {mon.shiny && <ShinyStar />}
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
  const [help, setHelp] = useState(false);
  const stats = calcStats(mon);
  const base = species(mon.species).baseStats;
  const nat = dex.natures.get(mon.nature);
  return (
    <div className="stats-wrap">
      <table className="stats">
        <thead>
          <tr>
            <th>
              <button className="move-info-btn" onClick={() => setHelp(h => !h)} title="O que é isso?">
                ?
              </button>
            </th>
            <th>Base</th>
            <th>IV</th>
            <th>EV</th>
            <th>Atual</th>
          </tr>
        </thead>
        <tbody>
          {STAT_IDS.map(s => (
            <tr key={s}>
              <td>
                {STAT_LABEL[s]}
                {nat.plus === s && <span className="nat-up" title="A nature aumenta 10%"> ▲</span>}
                {nat.minus === s && <span className="nat-down" title="A nature diminui 10%"> ▼</span>}
              </td>
              <td>{base[s]}</td>
              <td className={mon.ivs[s] === 31 ? 'perfect' : ''}>{mon.ivs[s]}</td>
              <td>{mon.evs[s]}</td>
              <td>
                <b>{stats[s]}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {help && (
        <div className="stats-help">
          <p>
            <b>Base:</b> a força da espécie (igual pra todo {species(mon.species).name}).
          </p>
          <p>
            <b>IV:</b> o talento deste Pokémon, de 0 a 31 (verde = 31, perfeito).
          </p>
          <p>
            <b>EV:</b> o treino, de 0 a 252 por atributo.
          </p>
          <p>
            <b>Atual:</b> o número que vale na batalha. Não é média: a Base pesa o dobro, depois somam o IV e um quarto do EV, tudo
            multiplicado pelo nível. A nature dá +10% (▲) num atributo e −10% (▼) em outro.
          </p>
        </div>
      )}
    </div>
  );
}

export function Modal({children, onClose, wide}: {children: ReactNode; onClose?: () => void; wide?: boolean}) {
  // Portal no body: a janela fica por cima de tudo, mesmo aberta de dentro do painel lateral.
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={e => e.stopPropagation()}>
        {onClose && (
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
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
export function TeamWeakness({party, compact, children}: {party: OwnedMon[]; compact?: boolean; children?: ReactNode}) {
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
  // Buraco de verdade: alguém é fraco e ninguém do time resiste.
  const holes = rows.filter(r => r.weak > 0 && r.resist === 0);
  const shown = compact ? rows.filter(r => r.weak > 0).sort((a, b) => b.weak - b.resist - (a.weak - a.resist)) : rows;
  return (
    <div className={`team-weak ${compact ? 'compact' : ''}`}>
      {holes.length > 0 ? (
        <p className="tw-alert">
          Sem defesa contra:{' '}
          {holes.map(r => (
            <TypeBadge key={r.type} type={r.type} small info />
          ))}
        </p>
      ) : (
        <p className="tw-ok">Seu time tem alguém que aguenta cada tipo. 👍</p>
      )}
      <div className="tw-grid">
        {shown.map(r => (
          <div key={r.type} className={`tw-cell ${r.weak > 0 && r.resist === 0 ? 'danger' : ''}`}>
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
      {children}
      <button className="btn small calc-open" onClick={() => useGame.getState().openTypeCalc([])}>
        Calculadora de Tipos
      </button>
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
      {sel.length > 0 && <CalcTable sel={sel} />}
    </Modal>
  );
}

/** Um cartãozinho por multiplicador; só aparece se tiver algum tipo. */
function MultCard({label, cls, types}: {label: string; cls: string; types: string[]}) {
  if (!types.length) return null;
  return (
    <div className={`mult-card ${cls}`}>
      <div className="mult-label">{label}</div>
      <div className="mult-types">
        {types.map(t => (
          <TypeBadge key={t} type={t} small />
        ))}
      </div>
    </div>
  );
}

/** Calculadora em cartões: quanto o(s) tipo(s) toma(m) e quanto cada tipo dá. */
function CalcTable({sel}: {sel: string[]}) {
  const d = defensiveMatchups(sel);
  const name = sel.map(t => TYPE_PT[t] ?? t).join('/');
  // Com dois tipos de golpe, vale o melhor deles contra cada tipo.
  const best = (t: string) => Math.max(...sel.map(a => typeMultiplier(a, [t])));
  const hit = (f: (x: number) => boolean) => ALL_TYPES.filter(t => f(best(t)));
  return (
    <div className="calc-cards">
      <section>
        <h3>{name} defendendo</h3>
        <div className="mult-cards">
          <MultCard label="Toma 4x de" cls="mu-x4" types={d.x4} />
          <MultCard label="Toma 2x de" cls="mu-x2" types={d.x2} />
          <MultCard label="Toma ½ de" cls="mu-half" types={d.half} />
          <MultCard label="Toma ¼ de" cls="mu-quarter" types={d.quarter} />
          <MultCard label="Imune a" cls="mu-immune" types={d.immune} />
        </div>
      </section>
      <section>
        <h3>Golpes de {sel.map(t => TYPE_PT[t] ?? t).join(' e ')} causam:</h3>
        {sel.length > 1 && <p className="hint small">Contando o melhor dos dois golpes contra cada tipo.</p>}
        <div className="mult-cards">
          <MultCard label="Dá 2x em" cls="mu-x2" types={hit(x => x > 1)} />
          <MultCard label="Dá ½ em" cls="mu-half" types={hit(x => x > 0 && x < 1)} />
          <MultCard label="Não afeta" cls="mu-immune" types={hit(x => x === 0)} />
        </div>
      </section>
      <p className="hint small">São 18 tipos. Os que não aparecem num cartão dão ou tomam dano normal (1x).</p>
    </div>
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
  const [more, setMore] = useState(false);
  return (
    <Modal onClose={onClose}>
      <div className="move-card" style={{['--mc' as string]: TYPE_COLORS[m.type]}}>
        <div className="move-card-head">
          <h2>{m.name}</h2>
          <TypeBadge type={m.type} />
          <CategoryIcon category={m.category} />
        </div>
        <div className="move-card-stats">
          <span>
            <small>Poder</small>
            <b>{m.basePower || '—'}</b>
          </span>
          <span>
            <small>Precisão</small>
            <b>{m.accuracy === true ? '—' : `${m.accuracy}%`}</b>
          </span>
          <span>
            <small>PP</small>
            <b>{m.pp}</b>
          </span>
        </div>
        <p className="move-info-desc">{moveDescPt(m.name)}</p>
        {m.priority !== 0 && (
          <p className="move-tag">{m.priority > 0 ? '⚡ Age antes dos outros golpes' : '🐢 Age depois dos outros golpes'}</p>
        )}
        <button className="link" onClick={() => setMore(x => !x)}>
          {more ? 'Menos detalhes ▴' : 'Mais detalhes ▾'}
        </button>
        {more && (
          <div className="move-more">
            <p>
              <b>{cat.name}:</b> {cat.hint}
              {m.category !== 'Status' && ' Golpe do mesmo tipo de quem usa bate 1,5x.'}
            </p>
            <p>
              Alvo: {TARGET_PT[m.target] ?? m.target} · Contato: {m.flags.contact ? 'sim' : 'não'}
            </p>
            {effects.length > 0 && <ul className="move-effects">{effects}</ul>}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Símbolo oficial da categoria (Físico, Especial, Status), com texto de reserva. */
export function CategoryIcon({category}: {category: string}) {
  const [failed, setFailed] = useState(false);
  const name = CATEGORY_PT[category]?.name ?? category;
  if (failed) return <span className={`cat-badge cat-${category}`}>{name}</span>;
  return (
    <img
      className="cat-icon"
      src={`https://play.pokemonshowdown.com/sprites/categories/${category}.png`}
      alt={name}
      title={name}
      onError={() => setFailed(true)}
    />
  );
}
