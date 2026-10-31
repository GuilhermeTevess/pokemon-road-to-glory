// Guia dos biomas (menu de cima): quem pode aparecer em cada bioma e com que chance.
// Fica escondido até o jogador abrir. Biomas ocultos só aparecem depois de visitados.
import {useMemo, useState} from 'react';
import {BIOMES, HIDDEN_BIOMES, getBiome} from '../../data/biomes';
import {RARITY_LABEL} from '../../data/dex';
import type {Rarity} from '../../data/dex';
import {REGIONS, getRegion} from '../../data/regions';
import {SEASON_LENGTH} from '../../game/encounters';
import {biomeOdds, rarityOdds} from '../../game/guide';
import {useGame} from '../../game/store';
import {Modal, Sprite, TypeBadge} from '../components';

const pct = (x: number) => (x <= 0 ? '0%' : x < 0.001 ? '<0,1%' : `${(x * 100).toFixed(x < 0.1 ? 1 : 0).replace('.', ',')}%`);

export function BiomeGuide({onClose}: {onClose: () => void}) {
  const run = useGame(s => s.run);
  const known = new Set([run?.biome, ...(run?.visited ?? [])].filter(Boolean) as string[]);
  const [biomeId, setBiome] = useState(run?.biome ?? BIOMES[0].id);
  const [regionId, setRegion] = useState(run?.region ?? REGIONS[0].id);
  const [wave, setWave] = useState(Math.max(1, Math.min(SEASON_LENGTH - 1, run?.wave ?? 1)));
  const [query, setQuery] = useState('');
  const luck = run?.perks?.luck ?? 0;
  const biome = getBiome(biomeId);
  const rows = useMemo(() => biomeOdds(biomeId, wave, regionId, luck), [biomeId, wave, regionId, luck]);
  const tiers = rarityOdds(biomeId, wave, luck).filter(([, x]) => x > 0);
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter(r => r.species.name.toLowerCase().includes(q)) : rows;
  const groups = new Map<Rarity, typeof rows>();
  for (const r of shown) groups.set(r.rarity, [...(groups.get(r.rarity) ?? []), r]);

  return (
    <Modal onClose={onClose} wide>
      <div className="guide">
        <h2>📖 Guia dos biomas</h2>
        <p className="hint">Quem pode aparecer em cada lugar e a chance de cada um numa ronda comum. É só para consultar: o jogo nunca mostra isso sozinho.</p>

        <div className="chips">
          {BIOMES.map(b => (
            <button key={b.id} className={`chip ${biomeId === b.id ? 'active' : ''}`} style={{borderLeft: `8px solid ${b.color}`}} onClick={() => setBiome(b.id)}>
              {b.name}
            </button>
          ))}
          {HIDDEN_BIOMES.filter(b => known.has(b.id)).map(b => (
            <button key={b.id} className={`chip ${biomeId === b.id ? 'active' : ''}`} style={{borderLeft: `8px solid ${b.color}`}} onClick={() => setBiome(b.id)}>
              ✨ {b.name}
            </button>
          ))}
          {HIDDEN_BIOMES.some(b => !known.has(b.id)) && (
            <span className="chip locked" title="Biomas secretos aparecem aqui depois que você visitar. Um viajante pode dar a dica de onde ficam.">
              🔒 {HIDDEN_BIOMES.filter(b => !known.has(b.id)).length} biomas secretos
            </span>
          )}
        </div>

        <div className="guide-controls">
          {!biome.region && (
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
          <input className="guide-search" placeholder="Procurar Pokémon..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>

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
                <div key={x.species.name} className="guide-mon" title={x.species.name}>
                  <Sprite name={x.species.name} size={40} still />
                  <span>{x.species.name}</span>
                  <small>{pct(x.chance)}</small>
                </div>
              ))}
            </div>
          </section>
        ))}
        {!shown.length && <p className="muted">Nenhum Pokémon com esse nome aqui.</p>}

        <ul className="hint guide-notes">
          <li>Os Pokémon aparecem na forma básica, mas podem vir já evoluídos conforme o nível da ronda.</li>
          <li>Pokémon da geração da região aparecem 3× mais. Formas regionais (de Alola, Galar...) só na própria região.</li>
          <li>Raros a partir da ronda 4, super raros a partir da 12 e lendários a partir da 15. Incenso e a melhoria Faro aumentam essas chances.</li>
          <li>Chefes (rondas 10, 20...) são sempre raros ou melhores, e as rondas 30, 60, 90 e 120 trazem um lendário.</li>
        </ul>
      </div>
    </Modal>
  );
}
