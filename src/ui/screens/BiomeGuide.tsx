// Guia dos biomas (menu de cima): quem pode aparecer em cada bioma e com que chance.
// Fica escondido até o jogador abrir. Biomas ocultos só aparecem depois de visitados.
import {useMemo, useState} from 'react';
import {BIOMES, HIDDEN_BIOMES, getBiome} from '../../data/biomes';
import {PLAYABLE, RARITY_LABEL, dex, evolutionLine, rarityOf, species} from '../../data/dex';
import type {Rarity} from '../../data/dex';
import {REGIONS, getRegion} from '../../data/regions';
import {SEASON_LENGTH} from '../../game/encounters';
import {allSpots, baseOf, biomeOdds, rarityOdds, whereFound} from '../../game/guide';
import type {Spot} from '../../game/guide';
import {STAT_IDS, STAT_LABEL} from '../../game/types';
import {useGame} from '../../game/store';
import {Modal, PixelIcon, RarityBadge, ShinyStar, Sprite, TypeBadge} from '../components';

const pct = (x: number) => (x <= 0 ? '0%' : x < 0.001 ? '<0,1%' : `${(x * 100).toFixed(x < 0.1 ? 1 : 0).replace('.', ',')}%`);

export function BiomeGuide({onClose}: {onClose: () => void}) {
  const run = useGame(s => s.run);
  const known = new Set([run?.biome, ...(run?.visited ?? [])].filter(Boolean) as string[]);
  /** null = todos os biomas (busca por Pokémon). */
  const [biomeId, setBiome] = useState<string | null>(run?.biome ?? BIOMES[0].id);
  const [card, setCard] = useState<string | null>(null);
  const [regionId, setRegion] = useState(run?.region ?? REGIONS[0].id);
  const [wave, setWave] = useState(Math.max(1, Math.min(SEASON_LENGTH - 1, run?.wave ?? 1)));
  const [query, setQuery] = useState('');
  const luck = run?.perks?.luck ?? 0;
  const biome = getBiome(biomeId ?? BIOMES[0].id);
  const rows = useMemo(() => (biomeId ? biomeOdds(biomeId, wave, regionId, luck) : []), [biomeId, wave, regionId, luck]);
  const spots = useMemo(() => allSpots(wave, regionId, luck), [wave, regionId, luck]);
  const tiers = biomeId ? rarityOdds(biomeId, wave, luck).filter(([, x]) => x > 0) : [];
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter(r => r.species.name.toLowerCase().includes(q)) : rows;
  // Todos os biomas: procura em todos os Pokémon do jogo (não só os que nascem soltos).
  const found = useMemo(() => (biomeId || q.length < 2 ? [] : PLAYABLE.filter(x => x.name.toLowerCase().includes(q)).slice(0, 60)), [biomeId, q]);
  const hiddenName = (b: Spot['biome']) => (!b.region || known.has(b.id) ? b.name : 'Bioma secreto');
  const groups = new Map<Rarity, typeof rows>();
  for (const r of shown) groups.set(r.rarity, [...(groups.get(r.rarity) ?? []), r]);

  return (
    <Modal onClose={onClose} wide>
      <div className="guide">
        <h2>Guia dos biomas</h2>
        <p className="hint">Quem pode aparecer em cada lugar e a chance de cada um numa ronda comum. É só para consultar: o jogo nunca mostra isso sozinho.</p>

        <div className="chips">
          <button className={`chip ${biomeId === null ? 'active' : ''}`} onClick={() => setBiome(null)}>
            <PixelIcon name="map" size={12} /> Todos os biomas
          </button>
          {BIOMES.map(b => (
            <button key={b.id} className={`chip ${biomeId === b.id ? 'active' : ''}`} style={{borderLeft: `8px solid ${b.color}`}} onClick={() => setBiome(b.id)}>
              {b.name}
            </button>
          ))}
          {HIDDEN_BIOMES.filter(b => known.has(b.id)).map(b => (
            <button key={b.id} className={`chip ${biomeId === b.id ? 'active' : ''}`} style={{borderLeft: `8px solid ${b.color}`}} onClick={() => setBiome(b.id)}>
              <ShinyStar /> {b.name}
            </button>
          ))}
          {HIDDEN_BIOMES.some(b => !known.has(b.id)) && (
            <span className="chip locked" title="Biomas secretos aparecem aqui depois que você visitar. Um viajante pode dar a dica de onde ficam.">
              <PixelIcon name="lock" size={12} /> {HIDDEN_BIOMES.filter(b => !known.has(b.id)).length} biomas secretos
            </span>
          )}
        </div>

        <div className="guide-controls">
          {!(biomeId && biome.region) && (
            <label>
              Região{' '}
              <select value={regionId} onChange={e => setRegion(e.target.value)}>
                {REGIONS.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="guide-wave">
            Ronda <b>{wave}</b>
            <input type="range" min={1} max={SEASON_LENGTH - 1} value={wave} onChange={e => setWave(Number(e.target.value))} />
          </label>
          <input className="guide-search" placeholder={biomeId ? 'Procurar Pokémon neste bioma...' : 'Procurar Pokémon (ex.: Riolu)...'} value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {biomeId && (
          <>
        <div className="guide-head" style={{borderColor: biome.color}}>
          <b>{biome.name}</b>
          {biome.region ? <span className="muted">· bioma secreto de {getRegion(biome.region).name}</span> : <span className="muted">· em {getRegion(regionId).name}</span>}
          <span className="types">
            {biome.types.map(t => (
              <TypeBadge key={t} type={t} small />
            ))}
          </span>
        </div>
        <div className="guide-tiers">
          {tiers.map(([r, x]) => (
            <span key={r} className={`rarity rarity-${r}`}>
              {RARITY_LABEL[r]} {pct(x)}
            </span>
          ))}
        </div>

        {[...groups].map(([r, list]) => (
          <section key={r}>
            <h4>
              <span className={`rarity rarity-${r}`}>{RARITY_LABEL[r]}</span> <small className="muted">{list.length} Pokémon</small>
            </h4>
            <div className="guide-grid">
              {list.map(x => (
                <button key={x.species.name} className="guide-mon" title={`Ver ${x.species.name}`} onClick={() => setCard(x.species.name)}>
                  <Sprite name={x.species.name} size={40} still />
                  <span>{x.species.name}</span>
                  <small>{pct(x.chance)}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!shown.length && <p className="muted">Nenhum Pokémon com esse nome aqui.</p>}

          </>
        )}
        {biomeId === null && (
          <>
            {q.length < 2 && <p className="hint">Digite o nome de um Pokémon para ver onde ele aparece. Clique nele para ver tudo sobre ele.</p>}
            <div className="guide-grid">
              {found.map(x => {
                const best = whereFound(x.name, spots)[0];
                return (
                  <button key={x.name} className="guide-mon wide" title={`Ver ${x.name}`} onClick={() => setCard(x.name)}>
                    <Sprite name={x.name} size={40} still />
                    <span>
                      {x.name}
                      <small className="muted">{best ? `${hiddenName(best.biome)} · ${pct(best.chance)}` : 'Não aparece solto'}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            {q.length >= 2 && !found.length && <p className="muted">Nenhum Pokémon com esse nome.</p>}
          </>
        )}
        <ul className="hint guide-notes">
          <li>Os Pokémon aparecem na forma básica, mas podem vir já evoluídos conforme o nível da ronda.</li>
          <li>Pokémon da geração da região aparecem 3× mais. Formas regionais (de Alola, Galar...) só na própria região.</li>
          <li>Raros a partir da ronda 4, super raros a partir da 12 e lendários a partir da 15. Incenso e a melhoria Faro aumentam essas chances.</li>
          <li>Chefes (rondas 10, 20...) são sempre raros ou melhores, e as rondas 30, 60, 90 e 120 trazem um lendário.</li>
        </ul>
      </div>
      {card && (
        <PokemonCard
          name={card}
          where={{
            spots: whereFound(card, spots),
            wave,
            regionName: getRegion(regionId).name,
            biomeName: hiddenName,
            onBiome: id => {
              setBiome(id);
              setQuery('');
              setCard(null);
            },
          }}
          onPick={setCard}
          onClose={() => setCard(null)}
        />
      )}
    </Modal>
  );
}

/** Ficha de um Pokémon fora do guia (ex.: sorteio do Rush): o mesmo cartão, sem "Onde aparece". */
export function MonInfo({name, onClose}: {name: string; onClose: () => void}) {
  const [shown, setShown] = useState(name);
  return <PokemonCard name={shown} onPick={setShown} onClose={onClose} />;
}

interface Where {
  spots: Spot[];
  wave: number;
  regionName: string;
  biomeName: (b: Spot['biome']) => string;
  onBiome: (id: string) => void;
}

/** Cartão de um Pokémon no meio da tela: tipos, stats base, habilidades, evoluções e (no guia) onde aparece. */
function PokemonCard({name, where, onPick, onClose}: {name: string; where?: Where; onPick: (n: string) => void; onClose: () => void}) {
  const s = species(name);
  const base = baseOf(s);
  const line = evolutionLine(base);
  const abilities = [...new Set(Object.values(s.abilities).filter(Boolean) as string[])];
  return (
    <Modal onClose={onClose}>
      <div className="mon-card">
        <Sprite name={s.name} size={120} />
        <h3>
          #{s.num} {s.name}
        </h3>
        <div className="row center wrap">
          {s.types.map(t => (
            <TypeBadge key={t} type={t} info />
          ))}
          <RarityBadge rarity={rarityOf(base)} />
        </div>
        <small className="muted">
          {s.heightm.toString().replace('.', ',')} m · {s.weightkg.toString().replace('.', ',')} kg
        </small>

        <h4>Stats base</h4>
        <div className="base-stats">
          {STAT_IDS.map(k => (
            <div key={k} className="bs">
              <span>{STAT_LABEL[k].replace('Velocidade', 'Vel.')}</span>
              <div className="bs-track">
                <div className={`bs-fill bs-${k}`} style={{width: `${Math.min(100, (s.baseStats[k] / 160) * 100)}%`}} />
              </div>
              <span>{s.baseStats[k]}</span>
            </div>
          ))}
          <div className="bs total">Total {s.bst}</div>
        </div>

        <h4>Habilidades</h4>
        <div className="mon-card-abilities">
          {abilities.map(a => (
            <p key={a}>
              <b>{a}</b>
              {a === s.abilities.H && <small className="muted"> (oculta)</small>}: <span className="muted">{dex.abilities.get(a).shortDesc}</span>
            </p>
          ))}
        </div>

        {line.length > 1 && (
          <>
            <h4>Evoluções</h4>
            <div className="mon-card-evos">
              {line.map((e, i) => (
                <span key={e.name} className="mon-card-evo">
                  {i > 0 && <span className="muted">{e.evoLevel ? `Nv. ${e.evoLevel}` : e.evoItem ? e.evoItem : e.evoType === 'trade' ? 'Troca' : e.evoType === 'levelFriendship' ? 'Amizade' : '>'}</span>}
                  <button className={`guide-mon ${e.name === s.name ? 'on' : ''}`} onClick={() => onPick(e.name)} title={`Ver ${e.name}`}>
                    <Sprite name={e.name} size={40} still />
                    <span>{e.name}</span>
                  </button>
                </span>
              ))}
            </div>
          </>
        )}

        {where && (
          <>
            <h4>Onde aparece</h4>
            <p className="hint small">
              Ronda {where.wave}, em {where.regionName}
              {base.name !== s.name ? `. Aparece como ${base.name} e evolui conforme o nível.` : '.'}
            </p>
            {!where.spots.length && <p className="muted">Não aparece solto na natureza. Dá para conseguir por evento, ovo ou troca.</p>}
            <div className="mon-card-spots">
              {where.spots.map(x =>
                x.biome.region && where.biomeName(x.biome) !== x.biome.name ? (
                  <span key={x.biome.id} className="guide-spot locked">
                    <PixelIcon name="lock" size={12} /> Bioma secreto
                    <small>{pct(x.chance)}</small>
                  </span>
                ) : (
                  <button key={x.biome.id} className="guide-spot" style={{borderLeftColor: x.biome.color}} onClick={() => where.onBiome(x.biome.id)} title={`Abrir ${x.biome.name} no guia`}>
                    {x.biome.name}
                    <small>{pct(x.chance)}</small>
                  </button>
                ),
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
