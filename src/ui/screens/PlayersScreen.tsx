// Lista de jogadores: todo mundo que já jogou online. Tocar num jogador abre o perfil
// com as partidas online dele contra todo mundo (não só contra você).
import {useCallback, useEffect, useState} from 'react';
import {cloudReady} from '../../game/cloud';
import {sumRows, tableOf, winRate} from '../../game/history';
import type {MatchLog} from '../../game/history';
import {historyOfCard, listPlayers, type PlayerCard} from '../../game/players';
import {useGame} from '../../game/store';
import {Modal, PixelIcon} from '../components';
import {FighterProfile, HistoryDots, when, type FoeView} from './HistoryScreens';
import {TrainerAvatar} from './StartScreens';

const NOTE = 'Partidas online contra todo mundo. Atualiza no fim de cada partida online deste jogador.';

export function PlayersModal({onClose}: {onClose: () => void}) {
  const trainers = useGame(s => s.trainers);
  const [list, setList] = useState<PlayerCard[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<PlayerCard | null>(null);
  const ready = cloudReady();

  const load = useCallback(
    (force: boolean) => {
      if (!ready) return;
      setError(false);
      if (force) setList(null);
      listPlayers(force)
        .then(setList)
        .catch(() => setError(true));
    },
    [ready],
  );
  useEffect(() => load(false), [load]);

  const mine = (p: PlayerCard) => trainers.some(t => t.id === p.tid);
  // Quem aparece nas partidas de um jogador: abre o perfil se ele também está na lista.
  const foeLookup = (m: MatchLog): FoeView | null => {
    if (m.vsKind !== 'player') return null;
    const p = list?.find(x => x.name === m.vs);
    return p ? {trainer: {name: p.name, avatar: p.avatar}, history: historyOfCard(p), note: NOTE} : null;
  };

  return (
    <Modal onClose={onClose} wide>
      <div className="players">
        <header className="players-head">
          <h2>
            <PixelIcon name="people" /> Jogadores
          </h2>
          {ready && (
            <button className="btn small" onClick={() => load(true)} disabled={!list && !error}>
              Atualizar
            </button>
          )}
        </header>
        <p className="hint small">Todo mundo que já jogou online. Toque num jogador para ver as partidas dele contra todo mundo, não só contra você.</p>
        {!ready ? (
          <p className="muted">O jogo online não está disponível nesta versão.</p>
        ) : error ? (
          <p className="hist-note">Não deu para carregar a lista agora. Confira a internet e toque em Atualizar.</p>
        ) : !list ? (
          <p className="muted">Carregando jogadores...</p>
        ) : !list.length ? (
          <p className="muted">Ninguém jogou online ainda. Jogue uma partida online (Rush, Dream Team, campeonato ou carreira) e você aparece aqui.</p>
        ) : (
          <div className="players-list">
            {list.map(p => {
              const all = sumRows(tableOf(historyOfCard(p), true));
              const rate = winRate(all.w, all.l);
              return (
                <button key={p.key} className="players-row panel" onClick={() => setOpen(p)} title={`Ver o perfil de ${p.name}`}>
                  <TrainerAvatar avatar={p.avatar} name={p.name} size={48} />
                  <span className="players-info">
                    <b>
                      {p.name}
                      {mine(p) && <span className="players-you">você</span>}
                    </b>
                    <small className="muted">
                      {all.w + all.l} partidas · <span className="v">{all.w}V</span> · <span className="d">{all.l}D</span>
                      {rate !== null && <> · {rate}%</>}
                      {all.titles > 0 && (
                        <>
                          {' · '}
                          <PixelIcon name="trophy" size={12} /> {all.titles}
                        </>
                      )}
                    </small>
                    <small className="muted">Jogou em {when(p.at)}</small>
                  </span>
                  <HistoryDots list={p.list} />
                </button>
              );
            })}
          </div>
        )}
      </div>
      {open && (
        <FighterProfile
          trainer={{name: open.name, avatar: open.avatar}}
          history={historyOfCard(open)}
          note={NOTE}
          tag="Perfil do jogador"
          onlineOnly
          foeLookup={foeLookup}
          onClose={() => setOpen(null)}
        />
      )}
    </Modal>
  );
}
