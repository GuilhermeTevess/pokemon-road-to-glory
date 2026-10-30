import {useState} from 'react';
import {useGame} from '../game/store';
import {setSoundEnabled, soundEnabled} from './audio';
import {BattleScreen} from './screens/BattleScreen';
import {EndScreen, PartyPanel, PendingModal, RewardScreen} from './screens/RunScreens';
import {BiomeSelect, CollectionScreen, StarterSelect, TitleScreen} from './screens/StartScreens';

export function App() {
  const {screen, run, toasts, setScreen} = useGame();
  const [sound, setSound] = useState(soundEnabled());
  const [partyOpen, setPartyOpen] = useState(false);

  let body;
  if (screen === 'title') body = <TitleScreen />;
  else if (screen === 'collection') body = <CollectionScreen />;
  else if (!run || run.phase === 'starter') body = <StarterSelect />;
  else if (run.phase === 'biome') body = <BiomeSelect mode="start" />;
  else if (run.phase === 'battle') body = <BattleScreen key={run.encounter?.mon.uid} />;
  else if (run.phase === 'biomeChoice') body = <BiomeSelect mode="next" />;
  else if (run.phase === 'reward' || run.phase === 'postBattle') body = <RewardScreen />;
  else body = <EndScreen kind={run.phase === 'stageClear' ? 'stageClear' : 'gameOver'} />;

  const inRun = screen === 'run' && run && run.party.length > 0 && run.phase !== 'gameOver' && run.phase !== 'stageClear';

  return (
    <div className="app">
      <nav className="topnav">
        <button className="btn small ghost" onClick={() => setScreen('title')}>
          🏠
        </button>
        {inRun && (
          <button className="btn small ghost" onClick={() => setPartyOpen(true)}>
            🎒 Time e mochila
          </button>
        )}
        <button
          className="btn small ghost"
          onClick={() => {
            setSoundEnabled(!sound);
            setSound(!sound);
          }}
          title="Som"
        >
          {sound ? '🔊' : '🔇'}
        </button>
      </nav>
      <main>{body}</main>
      {partyOpen && <PartyPanel onClose={() => setPartyOpen(false)} />}
      {screen === 'run' && <PendingModal />}
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
