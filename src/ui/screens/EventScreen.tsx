// Eventos entre as rondas: uma cena curta com escolhas.
import type {ReactNode} from 'react';
import {species} from '../../data/dex';
import {getItem} from '../../data/items';
import {cheapestHeal} from '../../game/events';
import {AVATARS} from '../../game/trainers';
import {useGame} from '../../game/store';
import {ItemIcon, Sprite, TypeBadge} from '../components';
import {TrainerAvatar} from './StartScreens';

function Scene({title, art, text, children}: {title: string; art: ReactNode; text: ReactNode; children: ReactNode}) {
  return (
    <div className="screen event-screen">
      <div className="panel event-card">
        <span className="event-tag">Evento</span>
        <h2>{title}</h2>
        <div className="event-art">{art}</div>
        <div className="event-text">{text}</div>
        <div className="event-choices">{children}</div>
      </div>
    </div>
  );
}

export function EventScreen() {
  const {run, resolveEvent} = useGame();
  const ev = run?.event;
  if (!run || !ev) return null;
  const next = (label = 'Seguir viagem') => (
    <button className="btn" onClick={() => resolveEvent(null)}>
      {label}
    </button>
  );

  switch (ev.kind) {
    case 'house': {
      const name = species(ev.mon.species).name;
      return (
        <Scene
          title="Casa abandonada"
          art={<Sprite name={ev.mon.species} shiny={ev.mon.shiny} />}
          text={
            <p>
              No meio do caminho tem uma casinha vazia. Lá dentro, um <b>{name}</b> (Nv. {ev.mon.level}) está sozinho, esperando
              alguém voltar. Ele olha para você com curiosidade.
            </p>
          }
        >
          <button className="btn primary" onClick={() => resolveEvent('care')}>
            Cuidar dele
          </button>
          <button className="btn" onClick={() => resolveEvent('leave')}>
            Deixar uma fruta e seguir
          </button>
          <p className="hint">Cuidar: ele entra no time já com 2 corações de amizade. Deixar a fruta: ele te dá um presente.</p>
        </Scene>
      );
    }
    case 'hurt': {
      const name = species(ev.mon.species).name;
      const heal = cheapestHeal(run);
      return (
        <Scene
          title="Pokémon machucado"
          art={<Sprite name={ev.mon.species} shiny={ev.mon.shiny} className="hurt" />}
          text={
            <p>
              Um <b>{name}</b> (Nv. {ev.mon.level}) está caído na trilha, bem machucado. Se você cuidar dele, ele vira seu amigo.
            </p>
          }
        >
          <button className="btn primary" disabled={!heal} onClick={() => resolveEvent('heal')}>
            {heal ? (
              <>
                Usar <ItemIcon id={heal} size={20} /> {getItem(heal).name}
              </>
            ) : (
              'Sem poção na mochila'
            )}
          </button>
          {next('Seguir viagem')}
          <p className="hint">Ele entra no time sem precisar de Pokébola, com 1 coração de amizade.</p>
        </Scene>
      );
    }
    case 'berries':
      return (
        <Scene
          title="Árvore de frutas"
          art={
            <div className="row center">
              {ev.options.map(b => (
                <ItemIcon key={b} id={b} size={48} />
              ))}
            </div>
          }
          text={<p>Uma árvore carregada! Dá para levar uma fruta para o time.</p>}
        >
          {ev.options.map(b => (
            <button key={b} className="btn event-item" onClick={() => resolveEvent(b)}>
              <ItemIcon id={b} size={28} />
              <span>
                <b>{getItem(b).name}</b>
                <small>{getItem(b).desc}</small>
              </span>
            </button>
          ))}
        </Scene>
      );
    case 'merchant': {
      const give = getItem(ev.give);
      const get = getItem(ev.get);
      return (
        <Scene
          title="Comerciante misterioso"
          art={
            <div className="row center trade">
              <ItemIcon id={ev.give} size={48} />
              <span className="trade-arrow">→</span>
              <ItemIcon id={ev.get} size={48} />
            </div>
          }
          text={
            <p>
              "Psiu! Me dá 1 <b>{give.name}</b> e eu te dou 1 <b>{get.name}</b>." <br />
              <small className="hint">{get.desc}</small>
            </p>
          }
        >
          <button className="btn primary" disabled={!run.bag[ev.give]} onClick={() => resolveEvent('trade')}>
            Trocar
          </button>
          {next('Não, obrigado')}
        </Scene>
      );
    }
    case 'rival': {
      const avatar = AVATARS[[...ev.name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATARS.length];
      return (
        <Scene
          title={`Rival ${ev.name}`}
          art={<TrainerAvatar avatar={avatar} name={ev.name} size={96} />}
          text={
            <p>
              "{ev.name} aqui! Topa uma batalha? Meu Pokémon é um pouco mais forte que os selvagens daqui."
              <br />
              <small className="hint">Vencer dá o dobro de dinheiro, mais doces e EVs. Não dá para fugir nem capturar, e se o time cair a run acaba.</small>
            </p>
          }
        >
          <button className="btn primary" onClick={() => resolveEvent('fight')}>
            Aceitar o desafio
          </button>
          {next('Agora não')}
        </Scene>
      );
    }
    case 'traveler': {
      const heal = cheapestHeal(run);
      const can = ev.ask === 'money' ? run.money >= (ev.cost ?? 0) : ev.ask === 'heal' ? !!heal : !!ev.item && !!run.bag[ev.item];
      const ask =
        ev.ask === 'money' ? (
          <>"Estou sem dinheiro para seguir viagem... você me empresta <b>₽ {ev.cost}</b>?"</>
        ) : ev.ask === 'heal' ? (
          <>"Meu Pokémon se machucou no caminho. Você teria uma poção?"</>
        ) : (
          <>
            "Perdi minhas Pokébolas... você me dá uma <b>{getItem(ev.item!).name}</b>?"
          </>
        );
      const pay =
        ev.ask === 'money' ? `Dar ₽ ${ev.cost}` : ev.ask === 'heal' ? (heal ? `Dar ${getItem(heal).name}` : 'Sem poção na mochila') : `Dar ${getItem(ev.item!).name}`;
      return (
        <Scene
          title={ev.name}
          art={<TrainerAvatar avatar={ev.avatar} name={ev.name} size={96} />}
          text={
            <p>
              {ask}
              <br />
              <small className="hint">Quem ajuda ganha uma dica sobre um Pokémon lendário (vai para o Diário) e o Rastro da lenda da região sobe.</small>
            </p>
          }
        >
          <button className="btn primary" disabled={!can} onClick={() => resolveEvent('help')}>
            {pay}
          </button>
          {next('Agora não')}
        </Scene>
      );
    }
    case 'seer':
      return (
        <Scene
          title="A Vidente"
          art={<span className="seer-ball">🔮</span>}
          text={<p>"Vejo o seu caminho... Estes são os tipos dos próximos Pokémon que você vai encontrar."</p>}
        >
          <div className="seer-list">
            {ev.upcoming.map((e, i) => (
              <div key={i} className="seer-row">
                <span>Ronda {run.wave + i + 1}</span>
                <span className="row">
                  {species(e.mon.species).types.map(t => (
                    <TypeBadge key={t} type={t} small />
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p className="hint">Se você trocar de bioma, a visão se perde.</p>
          {next('Obrigado!')}
        </Scene>
      );
  }
}
