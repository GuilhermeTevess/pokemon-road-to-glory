import {useState} from 'react';
import {useGame} from '../game/store';
import {setSoundEnabled, soundEnabled} from './audio';
import {HelpModal} from './screens/HelpModal';
import {IvWeb, Modal, PixelIcon, Sprite, TypeCalc} from './components';
import {BattleScreen} from './screens/BattleScreen';
import {EndScreen, PartyPanel, PendingModal, RewardScreen, RunSidebar} from './screens/RunScreens';
import type {PartyTab} from './screens/RunScreens';
import {BiomeSelect, StarterSelect, TitleScreen} from './screens/StartScreens';
import {CollectionScreen} from './screens/CollectionScreen';
import {EventScreen} from './screens/EventScreen';

export function App() {
  const {screen, run, toasts, setScreen, ivGain, clearIvGain, typeCalc, openTypeCalc} = useGame();
  const [helpOpen, setHelpOpen] = useState(false);
  const [sound, setSound] = useState(soundEnabled());
  const [partyOpen, setPartyOpen] = useState<{tab: PartyTab; mon?: string} | null>(null);

  let body;
  if (screen === 'title') body = <TitleScreen />;
  else if (screen === 'collection') body = <CollectionScreen />;
  else if (!run || run.phase === 'starter') body = <StarterSelect />;
  else if (run.phase === 'biome') body = <BiomeSelect mode="start" />;
  else if (run.phase === 'battle') body = <BattleScreen key={run.encounter?.mon.uid} />;
  else if (run.phase === 'biomeChoice') body = <BiomeSelect mode="next" />;
  else if (run.phase === 'event') body = <EventScreen />;
  else if (run.phase === 'reward' || run.phase === 'postBattle') body = <RewardScreen />;
  else body = <EndScreen kind={run.phase === 'stageClear' ? 'stageClear' : 'gameOver'} />;

  const inRun = screen === 'run' && run && run.party.length > 0 && run.phase !== 'gameOver' && run.phase !== 'stageClear';

  return (
    <div className={`app ${inRun ? 'wide' : ''}`}>
      <nav className="topnav">
        <button className="btn small ghost" onClick={() => setScreen('title')}>
          <PixelIcon name="home" /> Início
        </button>
        {inRun && (
          <button className="btn small nav-bag" onClick={() => setPartyOpen({tab: 'bag'})}>
            <img className="nav-icon" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/explorer-kit.png" alt="" /> Time, mochila e PC
          </button>
        )}
        <button className="btn small ghost" onClick={() => openTypeCalc([])} title="Calculadora de tipos">
          <PixelIcon name="dice" /> Tipos
        </button>
        <button className="btn small ghost" onClick={() => setHelpOpen(true)} title="Como jogar">
          <PixelIcon name="help" /> Ajuda
        </button>
        <button
          className="btn small ghost"
          onClick={() => {
            setSoundEnabled(!sound);
            setSound(!sound);
          }}
          title="Som"
        >
          <PixelIcon name={sound ? 'sound' : 'mute'} /> {sound ? 'Som' : 'Mudo'}
        </button>
      </nav>
      {inRun ? (
        <div className="run-layout">
          <main>{body}</main>
          <RunSidebar onOpen={(tab, mon) => setPartyOpen({tab, mon})} />
        </div>
      ) : (
        <main>{body}</main>
      )}
      {partyOpen && <PartyPanel key={`${partyOpen.tab}-${partyOpen.mon}`} initialTab={partyOpen.tab} initialMon={partyOpen.mon} onClose={() => setPartyOpen(null)} />}
      {screen === 'run' && <PendingModal />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {typeCalc && <TypeCalc initial={typeCalc} onClose={() => openTypeCalc(null)} />}
      {ivGain && (
        <Modal onClose={clearIvGain}>
          <h2>{ivGain.species} repetido!</h2>
          <p className="hint">Os IVs da coleção melhoraram. Seu próximo inicial dessa linha começa assim:</p>
          <div className="row center wrap">
            <Sprite name={ivGain.species} />
            <IvWeb before={ivGain.before} after={ivGain.after} />
          </div>
          <button className="btn primary" onClick={clearIvGain}>
            Legal!
          </button>
        </Modal>
      )}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
