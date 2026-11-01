import {roundOf} from '../../game/career';
// Eventos entre as rondas: uma cena curta com escolhas.
import {useState} from 'react';
import type {ReactNode} from 'react';
import {dex} from '../../data/dex';
import {moveDescPt} from '../../data/movesPt';
import {tutorMoves, tutorPrice} from '../../game/events';
import {displayName} from '../../game/mon';
import {species} from '../../data/dex';
import {getItem} from '../../data/items';
import {cheapestHeal, getPlace} from '../../game/events';
import {AVATARS} from '../../game/trainers';
import {useGame} from '../../game/store';
import {ItemIcon, MonName, Sprite, TypeBadge} from '../components';
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
    case 'wipe': {
      const partner = run.party.find(m => m.partner) ?? run.party[0];
      return (
        <Scene
          title="Fuga pela trilha"
          art={partner ? <Sprite name={partner.species} shiny={partner.shiny} className="hurt" /> : null}
          text={
            <>
              <p>
                <b>{ev.foe}</b> derrubou o seu time inteiro! Você pegou todo mundo e correu até o Centro Pokémon mais perto.
                A temporada continua, mas a fuga custou caro:
              </p>
              <ul className="wipe-losses">
                {ev.levels > 0 && <li>O time ficou abalado e perdeu até {ev.levels} {ev.levels === 1 ? 'nível' : 'níveis'}.</li>}
                {ev.items.map(it => (
                  <li key={it.id}>
                    <ItemIcon id={it.id} /> Enquanto você fugia, deixou cair {it.n > 1 ? `${it.n}x ` : ''}
                    {getItem(it.id).name}.
                  </li>
                ))}
                {ev.money > 0 && <li>Na correria, ₽ {ev.money} caíram do bolso.</li>}
                {ev.points > 0 && <li>O jornal noticiou a derrota: −{ev.points} pontos no ranking.</li>}
              </ul>
              <p className="hint">O time foi curado no Centro Pokémon. Bola pra frente!</p>
            </>
          }
        >
          <button className="btn primary" onClick={() => resolveEvent(null)}>
            Levantar e seguir
          </button>
        </Scene>
      );
    }
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
    case 'tutor':
      return <TutorEvent />;
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
    case 'news':
      return (
        <Scene
          title="Jornal da região"
          art={<TrainerAvatar avatar="reporter" name="Jornal" size={96} />}
          text={<p>Um jornaleiro grita as manchetes do dia. Todo mundo para pra ler.</p>}
        >
          <div className="news-list">
            {ev.items.map((n, i) => (
              <div key={i} className="news-item">
                <b>📰</b> {n.text}
              </div>
            ))}
          </div>
          <button className="btn primary" onClick={() => resolveEvent('read')}>
            Ler o jornal inteiro
          </button>
          {next('Só as manchetes, valeu')}
        </Scene>
      );
    case 'fan':
      return (
        <Scene
          title="Um fã!"
          art={<TrainerAvatar avatar={ev.avatar} name="Fã" size={96} />}
          text={
            <p>
              "É você! Eu vi sua batalha no jornal!" Um fã quer um autógrafo e uma foto com o seu parceiro.
              {ev.heard && (
                <>
                  <br />
                  <small className="muted">Ele conta, empolgado: "{ev.heard}"</small>
                </>
              )}
            </p>
          }
        >
          <button className="btn primary" onClick={() => resolveEvent('sign')}>
            Dar autógrafo e tirar foto
          </button>
          {next('Agora não, desculpa')}
        </Scene>
      );
    case 'place': {
      const t = getPlace(ev.theme);
      const mon = ev.mon ? species(ev.mon.species).name : '';
      const text: Record<string, ReactNode> = {
        haunted: <>Uma casa velha, janelas quebradas, risadinhas lá dentro... Uma sombra passa correndo: parece um <b>{mon}</b> querendo brincar.</>,
        cavein: <>Pedras rolaram e bloquearam o caminho. Dá pra ouvir um <b>{mon}</b> preso do outro lado.</>,
        wreck: <>Um navio antigo afundado perto da margem. Dizem que ainda tem coisa boa no porão.</>,
        hotspring: <>Uma fonte de água quente no meio das rochas. O vapor deixa todo mundo com sono.</>,
        nest: <>Um filhote de <b>{mon}</b> caiu do ninho e está chorando no chão.</>,
        blackout: <>A energia da região caiu. Um <b>{mon}</b> assustado está perto do gerador, soltando faíscas.</>,
        blizzard: <>Uma nevasca forte. Numa caverninha, um <b>{mon}</b> também se protege do frio.</>,
        dojo: <>Um velho mestre está treinando sozinho na beira da estrada e te chama para um treino.</>,
        cliff: <>No alto do penhasco, um <b>{mon}</b> está com a asa presa num galho.</>,
      };
      return (
        <Scene title={t.title} art={ev.mon ? <Sprite name={ev.mon.species} shiny={ev.mon.shiny} /> : <span className="seer-ball">{t.id === 'wreck' ? '⚓' : t.id === 'hotspring' ? '♨️' : '🥋'}</span>} text={<p>{text[t.id]}</p>}>
          <button className="btn primary" onClick={() => resolveEvent('yes')}>
            {t.yes}
          </button>
          {next(t.no)}
        </Scene>
      );
    }
    case 'life': {
      const mon = run.party.find(m => m.uid === ev.uid);
      if (ev.theme === 'mom')
        return (
          <Scene title="Mensagem da mãe" art={<TrainerAvatar avatar="mom-johto" name="Mãe" size={96} />} text={<p>"Filho(a), te vi no jornal! Tô tão orgulhosa. Come direito e não esquece de curar seus Pokémon. Mandei uma coisinha."</p>}>
            <button className="btn primary" onClick={() => resolveEvent('ok')}>
              Responder "Te amo, mãe!"
            </button>
          </Scene>
        );
      if (ev.theme === 'birthday' && mon)
        return (
          <Scene title="Aniversário do parceiro" art={<Sprite name={mon.species} shiny={mon.shiny} />} text={<p>Hoje faz um ano que você e <b>{displayName(mon)}</b> estão juntos! Que tal uma festinha?</p>}>
            <button className="btn primary" onClick={() => resolveEvent('ok')}>
              Fazer a festa 🎂
            </button>
          </Scene>
        );
      return (
        <Scene
          title="Noite no Centro Pokémon"
          art={<TrainerAvatar avatar="pokemoncenterlady" name="Enfermeira" size={96} />}
          text={
            <p>
              Você passa a noite no Centro Pokémon. Na sala de espera, os treinadores só falam de uma coisa:
              {ev.chat ? <> <i>"{ev.chat}"</i></> : ' o próximo torneio.'}
            </p>
          }
        >
          <button className="btn primary" onClick={() => resolveEvent('ok')}>
            Dormir e seguir viagem
          </button>
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
                <span>Ronda {roundOf(run) + i + 1}</span>
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

/** Professor de golpes: escolhe um Pokémon do time e qualquer golpe que ele aprende, pagando em dinheiro. */
function TutorEvent() {
  const {run, resolveEvent} = useGame();
  const [monUid, setMonUid] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  if (!run) return null;
  const mon = run.party.find(m => m.uid === monUid);
  const q = query.trim().toLowerCase();
  const moves = mon ? tutorMoves(mon).filter(id => !q || dex.moves.get(id).name.toLowerCase().includes(q)) : [];
  return (
    <Scene
      title="Professor de golpes"
      art={<TrainerAvatar avatar="scientist" name="Professor" size={96} />}
      text={
        <p>
          "Ensino qualquer golpe que seu Pokémon consiga aprender: de nível, de Disco Técnico ou até de ovo. Mas meu preço não é
          barato!" <br />
          <small className="hint">Golpes fortes e de preparar (como Swords Dance) custam mais. Você tem ₽ {run.money}.</small>
        </p>
      }
    >
      {!mon ? (
        <div className="tutor-mons">
          {run.party.map(m => (
            <button key={m.uid} className="btn tutor-mon" onClick={() => setMonUid(m.uid)}>
              <Sprite name={m.species} shiny={m.shiny} />
              <MonName mon={m} />
            </button>
          ))}
        </div>
      ) : (
        <div className="tutor-pick">
          <div className="row center">
            <b>{displayName(mon)}</b>
            <span className="muted">sabe: {mon.moves.map(id => dex.moves.get(id).name).join(', ')}</span>
            <button className="btn small ghost" onClick={() => setMonUid(null)}>
              Trocar Pokémon
            </button>
          </div>
          <input className="tutor-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar golpe (ex.: Close Combat)" />
          <div className="tutor-list">
            {moves.map(id => {
              const m = dex.moves.get(id);
              const price = tutorPrice(run, id);
              return (
                <button key={id} className="move-chip tutor-move" disabled={run.money < price} onClick={() => resolveEvent(`${mon.uid}|${id}`)}>
                  <span className="row">
                    <TypeBadge type={m.type} /> <b>{m.name}</b> · Poder {m.basePower || '—'} ·{' '}
                    {m.category === 'Physical' ? 'Físico' : m.category === 'Special' ? 'Especial' : 'Status'}
                    <span className="tutor-price">₽ {price}</span>
                  </span>
                  <small className="muted">{moveDescPt(m.name)}</small>
                </button>
              );
            })}
            {!moves.length && <p className="hint">Nenhum golpe com esse nome.</p>}
          </div>
        </div>
      )}
      <button className="btn" onClick={() => resolveEvent(null)}>
        Seguir viagem
      </button>
    </Scene>
  );
}
