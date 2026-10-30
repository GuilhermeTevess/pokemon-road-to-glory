// Creche: escolher dois pais da coleção, itens, fazer ovos e o Manual do Criador.
import {useMemo, useState} from 'react';
import {dex, species} from '../../data/dex';
import {getItem} from '../../data/items';
import {DAYCARE_ITEMS, EGG_PRICE, MAX_EGGS, compatibility} from '../../game/daycare';
import type {Egg} from '../../game/daycare';
import {peekEntry} from '../../game/meta';
import {useGame} from '../../game/store';
import {STAT_IDS, STAT_LABEL} from '../../game/types';
import {ItemIcon, Modal, PixelIcon, Sprite, Types} from '../components';
import {Candies} from './CollectionScreen';

export function EggIcon({size = 40}: {size?: number}) {
  return <PixelIcon name="egg" size={size} color="#f3e3b5" />;
}

export function EggInfo({egg, left}: {egg: Egg; left?: number}) {
  return (
    <div className="egg-info">
      <span className="egg-icon">
        <EggIcon />
      </span>
      <span>
        <b>Ovo de {egg.species}</b>
        <small>
          {left !== undefined ? `Choca em ${left} ${left === 1 ? 'ronda' : 'rondas'}` : `Choca depois de ${egg.waves} rondas vencidas`} · Nature{' '}
          {egg.nature} · {egg.ability}
          {egg.eggMove && ` · golpe de ovo: ${dex.moves.get(egg.eggMove).name}`}
        </small>
        <small>
          IVs: {STAT_IDS.map(s => `${STAT_LABEL[s].replace('Velocidade', 'Vel.')} ${egg.ivs[s]}`).join(' · ')}
        </small>
      </span>
    </div>
  );
}

export function BreederManual({onClose}: {onClose: () => void}) {
  return (
    <Modal onClose={onClose} wide>
      <h2>Manual do Criador</h2>
      <div className="manual">
        <section>
          <h3>1. Quem pode fazer ovo?</h3>
          <p>
            Todo Pokémon tem um ou dois <b>egg groups</b> (grupos de ovo), tipo "Monstro", "Dragão" ou "Água 1". Dois Pokémon só fazem
            ovo se tiverem <b>pelo menos um grupo em comum</b>. Ex.: Charmander (Monstro/Dragão) + Bulbasaur (Monstro/Planta) dá certo.
          </p>
          <p>
            O ovo é sempre da forma básica de quem está no <b>primeiro lugar</b> (a "mãe"). Aqui na creche o gênero não importa.
          </p>
        </section>
        <section>
          <h3>2. E o Ditto?</h3>
          <p>
            O <b>Ditto</b> faz ovo com quase todo mundo, inclusive com os Pokémon sem gênero (como Magnemite). O ovo é sempre do
            outro Pokémon. Lendários e bebês não fazem ovos.
          </p>
        </section>
        <section>
          <h3>3. O que o filhote herda?</h3>
          <ul>
            <li>
              <b>IVs:</b> 3 atributos vêm dos IVs da coleção dos pais. O resto é sorteado.
            </li>
            <li>
              <b>Nature:</b> sorteada, a não ser que um dos pais segure a <b>Pedra Eterna</b>.
            </li>
            <li>
              <b>Habilidade:</b> uma comum da espécie. Se a mãe já tem a oculta liberada, 60% de chance de passar.
            </li>
            <li>
              <b>Golpe de ovo:</b> um golpe especial que a espécie só aprende por ovo, se o pai também souber.
            </li>
          </ul>
        </section>
        <section>
          <h3>4. Itens da creche</h3>
          <div className="manual-items">
            <div>
              <ItemIcon id="everstone" /> <b>Pedra Eterna:</b> o filhote herda a nature de quem segura.
            </div>
            <div>
              <ItemIcon id="destinyknot" /> <b>Laço do Destino:</b> herda 5 IVs em vez de 3.
            </div>
            <div>
              <ItemIcon id="powerbracer" /> <b>Itens Power:</b> garantem que aquele IV venha de quem segura (Bracelete = Ataque, Cinto =
              Defesa, Lente = Atq. Esp., Faixa = Def. Esp., Tornozeleira = Velocidade, Peso = HP).
            </div>
          </div>
          <p className="hint">
            Os itens são gastos ao fazer o ovo. Eles chegam pela recompensa e pela loja; os itens Power que sobrarem no fim da run vêm
            para a creche.
          </p>
        </section>
        <section>
          <h3>5. Chocando</h3>
          <p>
            Leve 1 ovo por run (na hora de montar o time). Ele choca depois de algumas <b>rondas vencidas</b>: comuns 5, raros 10, muito
            raros 15. O filhote nasce no nível dos selvagens daquela ronda, entra no time e melhora a ficha da coleção, como uma captura.
          </p>
        </section>
      </div>
    </Modal>
  );
}

export function DaycareScreen() {
  const {collection, setScreen, breed, discardEgg, toast} = useGame();
  const [parents, setParents] = useState<[string | null, string | null]>([null, null]);
  const [items, setItems] = useState<[string | null, string | null]>([null, null]);
  const [manual, setManual] = useState(false);
  const lines = useMemo(
    () =>
      Object.entries(collection.entries)
        .filter(([, e]) => e.caught > 0)
        .map(([id]) => species(id))
        .sort((a, b) => a.num - b.num),
    [collection],
  );
  const store = collection.items ?? {};
  const eggs = collection.eggs ?? [];
  const [a, b] = parents;
  const comp = a && b ? compatibility(a, b) : null;
  const motherEntry = a ? peekEntry(collection, a) : undefined;
  const available = (slot: 0 | 1) =>
    DAYCARE_ITEMS.filter(id => (store[id] ?? 0) - (items[slot === 0 ? 1 : 0] === id ? 1 : 0) > 0);
  const pickLine = (name: string) => {
    if (!a || (a && b)) setParents([name, null]);
    else setParents([a, name]);
  };
  const canBreed = comp?.ok && eggs.length < MAX_EGGS && (motherEntry?.candies ?? 0) >= EGG_PRICE;

  return (
    <div className="screen daycare-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>Creche</h2>
        <button className="btn small" onClick={() => setManual(true)}>
          <PixelIcon name="help" /> Manual do Criador
        </button>
      </header>
      <p className="hint">Escolha dois Pokémon da sua coleção do mesmo egg group (ou um Ditto). O ovo é da espécie do primeiro.</p>
      <div className="panel daycare-pair">
        {[0, 1].map(slot => {
          const name = parents[slot];
          return (
            <div key={slot} className="parent-slot">
              <span className="hint">{slot === 0 ? 'Mãe (dá a espécie)' : 'Pai'}</span>
              {name ? (
                <>
                  <Sprite name={name} size={80} />
                  <b>{species(name).name}</b>
                  <small className="hint">{species(name).eggGroups.join(' / ')}</small>
                  <div className="chips">
                    <button className={`chip ${!items[slot] ? 'active' : ''}`} onClick={() => setItems(it => (slot === 0 ? [null, it[1]] : [it[0], null]))}>
                      Sem item
                    </button>
                    {available(slot as 0 | 1).map(id => (
                      <button
                        key={id}
                        className={`chip ${items[slot] === id ? 'active' : ''}`}
                        title={getItem(id).desc}
                        onClick={() => setItems(it => (slot === 0 ? [id, it[1]] : [it[0], id]))}
                      >
                        <ItemIcon id={id} size={18} /> {getItem(id).name} ×{store[id]}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <span className="parent-empty">?</span>
              )}
            </div>
          );
        })}
        <div className="daycare-result">
          {comp && !comp.ok && <p className="bad">{comp.why}</p>}
          {comp?.ok && (
            <>
              <EggIcon size={48} />
              <p>
                Ovo de <b>{species(comp.child).name}</b>
              </p>
            </>
          )}
          <button
            className="btn primary"
            disabled={!canBreed}
            onClick={() => {
              const msg = breed(a!, b!, items);
              if (msg) toast(msg);
              setItems([null, null]);
            }}
          >
            Fazer ovo · {a ? <Candies line={a} n={EGG_PRICE} /> : `${EGG_PRICE} doces`}
          </button>
          {eggs.length >= MAX_EGGS && <p className="hint">Já tem {MAX_EGGS} ovos guardados. Leve um numa run primeiro.</p>}
        </div>
      </div>
      <h3 className="section-title">Ovos guardados · {eggs.length}/{MAX_EGGS}</h3>
      {!eggs.length && <p className="hint">Nenhum ovo ainda. Na hora de montar o time você escolhe um ovo para levar.</p>}
      <div className="egg-list">
        {eggs.map(e => (
          <div key={e.id} className="panel egg-row">
            <EggInfo egg={e} />
            <button className="btn small ghost" onClick={() => discardEgg(e.id)}>
              Soltar
            </button>
          </div>
        ))}
      </div>
      <h3 className="section-title">Sua coleção</h3>
      {!lines.length && <p className="hint">Capture Pokémon nas runs para trazê-los para a creche.</p>}
      <div className="grid">
        {lines.map(s => (
          <button key={s.id} className={`cell ${parents.includes(s.name) ? 'selected' : ''}`} onClick={() => pickLine(s.name)}>
            <Sprite name={s.name} size={72} />
            <span className="cell-name">{s.name}</span>
            <Types name={s.name} />
            <span className="cell-sub">{s.eggGroups.join(' / ')}</span>
          </button>
        ))}
      </div>
      {manual && <BreederManual onClose={() => setManual(false)} />}
    </div>
  );
}
