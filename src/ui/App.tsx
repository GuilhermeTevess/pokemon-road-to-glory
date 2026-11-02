import {BadgeCeremony, GymIntroScreen} from './screens/GymScreens';
import {LegendAfterModal, LegendMeetScreen} from './screens/LegendScreens';
import {useEffect, useState} from 'react';
import {useGame} from '../game/store';
import {playAchievement, setSoundEnabled, soundEnabled} from './audio';
import {HelpModal} from './screens/HelpModal';
import {BiomeGuide} from './screens/BiomeGuide';
import {IvWeb, Modal, PixelIcon, Sprite, TypeCalc} from './components';
import {BattleScreen} from './screens/BattleScreen';
import {EndScreen, PartyPanel, PendingModal, RewardScreen, RunSidebar, TravelScreen} from './screens/RunScreens';
import type {PartyTab} from './screens/RunScreens';
import {AchievementsScreen, RankingScreen} from './screens/LeagueScreens';
import {BiomeSelect, RegionSelect, StarterSelect, TitleScreen} from './screens/StartScreens';
import {CollectionScreen} from './screens/CollectionScreen';
import {QuickplayScreen} from './screens/QuickplayScreen';
import {BuilderScreen} from './screens/BuilderScreen';
import {CareerScreen, WaitingScreen} from './screens/CareerScreen';
import {EventScreen} from './screens/EventScreen';
import {DaycareScreen} from './screens/DaycareScreen';
import {GloryScreen} from './screens/GloryScreen';
import {TourHistoryScreen, TournamentScreen} from './screens/TournamentScreen';
import {fast, setFast, setTheme, theme} from './settings';
import {Tutorial} from './Tutorial';
import {cancelLeave, confirmLeave, requestLeave, useLeaveAsk, useMatchGuard} from './leaveGuard';
import {playerIndex, playerMatch} from '../game/tournament';
import {recordMatch} from '../game/history';

export function App() {
  const {screen, run, toasts, achievePops, setScreen, ivGain, clearIvGain, typeCalc, openTypeCalc} = useGame();
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const careerCode = useGame(s => s.trainer?.career?.code);
  // Carreira online: mantém a classificação e o progresso dos amigos atualizados.
  useEffect(() => {
    if (!careerCode) return;
    void useGame.getState().refreshCareer();
    const id = setInterval(() => void useGame.getState().refreshCareer(), 20000);
    return () => clearInterval(id);
  }, [careerCode]);
  // Carreira: o mundo (rivais) de cada ronda é o mesmo para todos (vem da nuvem).
  const worldWave = useGame(s => (s.run?.career ? s.run.world?.wave : undefined));
  useEffect(() => {
    if (worldWave !== undefined) void useGame.getState().worldSync();
  }, [worldWave]);
  const [sound, setSound] = useState(soundEnabled());
  const [fastOn, setFastOn] = useState(fast);
  const [themeNow, setThemeNow] = useState(theme);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setThemeNow(theme());
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const [panelOpen, setPanelOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState<{tab: PartyTab; mon?: string} | null>(null);
  const leaveAsk = useLeaveAsk();

  let body;
  if (screen === 'title') body = <TitleScreen />;
  else if (screen === 'collection') body = <CollectionScreen />;
  else if (screen === 'daycare') body = <DaycareScreen />;
  else if (screen === 'glory') body = <GloryScreen />;
  else if (screen === 'tournaments') body = <TourHistoryScreen />;
  else if (screen === 'ranking') body = <RankingScreen />;
  else if (screen === 'achievements') body = <AchievementsScreen />;
  else if (screen === 'quickplay') body = <QuickplayScreen />;
  else if (screen === 'builder') body = <BuilderScreen />;
  else if (screen === 'career') body = <CareerScreen />;
  else if (!run || run.phase === 'starter') body = <StarterSelect />;
  else if (run.phase === 'biome') body = <BiomeSelect mode="start" />;
  else if (run.phase === 'battle') body = <BattleScreen key={run.encounter?.mon.uid} />;
  else if (run.phase === 'biomeChoice') body = <BiomeSelect mode="next" />;
  else if (run.phase === 'regionChoice') body = <RegionSelect />;
  else if (run.phase === 'travel') body = <TravelScreen />;
  else if (run.phase === 'legend') body = <LegendMeetScreen />;
  else if (run.phase === 'gymIntro') body = <GymIntroScreen />;
  else if (run.phase === 'event') body = <EventScreen />;
  else if (run.phase === 'tournament') body = <TournamentScreen />;
  else if (run.phase === 'waiting') body = <WaitingScreen />;
  else if (run.phase === 'reward' || run.phase === 'postBattle') body = <RewardScreen />;
  else body = <EndScreen kind={run.phase === 'stageClear' ? 'stageClear' : 'gameOver'} />;

  const inRun = screen === 'run' && run && run.party.length > 0 && run.phase !== 'gameOver' && run.phase !== 'stageClear';

  return (
    <div className={`app ${inRun ? 'wide' : ''}`}>
      <nav className="topnav">
        <button className="btn small ghost" onClick={() => requestLeave(() => setScreen('title'))} aria-label="Início">
          <PixelIcon name="home" /> <span className="nav-label">Início</span>
        </button>
        {inRun && (
          <button className="btn small nav-bag" onClick={() => setPanelOpen(true)}>
            <img className="nav-icon" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/explorer-kit.png" alt="" /> <span className="bag-long">Time, mochila e PC</span>
            <span className="bag-short">Painel</span>
          </button>
        )}
        <button className="btn small ghost" data-tut="nav-types" onClick={() => openTypeCalc([])} title="Calculadora de tipos">
          <PixelIcon name="dice" /> <span className="nav-label">Tipos</span>
        </button>
        <button
          className={`btn small ghost ${fastOn ? 'on' : ''}`}
          data-tut="nav-fast"
          onClick={() => {
            setFast(!fastOn);
            setFastOn(!fastOn);
          }}
          title="Pular animações: batalhas, capturas, evoluções e sorteios mais rápidos"
        >
          <PixelIcon name={fastOn ? 'fast' : 'play'} /> <span className="nav-label">{fastOn ? 'Rápido' : 'Animações'}</span>
        </button>
        <button className="btn small ghost" data-tut="nav-guide" onClick={() => setGuideOpen(true)} title="Guia dos biomas: quem aparece em cada lugar e com que chance">
          <PixelIcon name="book" /> <span className="nav-label">Guia</span>
        </button>
        <button className="btn small ghost" data-tut="nav-help" onClick={() => setHelpOpen(true)} title="Como jogar">
          <PixelIcon name="help" /> <span className="nav-label">Ajuda</span>
        </button>
        <button
          className="btn small ghost"
          onClick={() => {
            setSoundEnabled(!sound);
            setSound(!sound);
          }}
          title="Som"
        >
          <PixelIcon name={sound ? 'sound' : 'mute'} /> <span className="nav-label">{sound ? 'Som' : 'Mudo'}</span>
        </button>
        <button
          className="btn small ghost"
          onClick={() => {
            const next = themeNow === 'dark' ? 'light' : 'dark';
            setTheme(next);
            setThemeNow(next);
          }}
          title={themeNow === 'dark' ? 'Voltar para o modo claro' : 'Modo escuro: mais confortável à noite'}
          aria-label={themeNow === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          <PixelIcon name={themeNow === 'dark' ? 'sun' : 'moon'} /> <span className="nav-label">{themeNow === 'dark' ? 'Claro' : 'Escuro'}</span>
        </button>
      </nav>
      {inRun ? (
        <div className="run-layout">
          <main>{body}</main>
          <RunSidebar
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            onOpen={(tab, mon) => {
              setPanelOpen(false);
              setPartyOpen({tab, mon});
            }}
          />
        </div>
      ) : (
        <main>{body}</main>
      )}
      {partyOpen && <PartyPanel key={`${partyOpen.tab}-${partyOpen.mon}`} initialTab={partyOpen.tab} initialMon={partyOpen.mon} onClose={() => setPartyOpen(null)} />}
      {/* Cerimônias aparecem logo depois da luta; evoluções e golpes novos esperam por elas. */}
      {screen === 'run' && run?.badgeWon && run.phase !== 'battle' && <BadgeCeremony />}
      {screen === 'run' && !run?.badgeWon && run?.legendAfter && run.phase !== 'battle' && <LegendAfterModal />}
      {screen === 'run' && !run?.badgeWon && !run?.legendAfter && <PendingModal />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {guideOpen && <BiomeGuide onClose={() => setGuideOpen(false)} />}
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
      {leaveAsk && (
        <Modal onClose={cancelLeave}>
          <div className="leave-ask">
            <PixelIcon name="warning" size={32} />
            <h2>Sair da partida?</h2>
            <p className="hint">Se sair agora, a partida conta como derrota no seu histórico.</p>
            <div className="row center wrap">
              <button className="btn primary" onClick={cancelLeave}>
                Continuar jogando
              </button>
              <button className="btn danger" onClick={confirmLeave}>
                Sair e perder
              </button>
            </div>
          </div>
        </Modal>
      )}
      <QuickTourGuard />
      <Tutorial />
      <div className="achieve-pops">
        {achievePops.map(a => (
          <AchievePop key={a.id} name={a.name} icon={a.icon} desc={a.desc} />
        ))}
      </div>
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

/** Aviso de conquista: entra pela lateral com um sonzinho. */
function AchievePop({name, icon, desc}: {name: string; icon: string; desc: string}) {
  useEffect(() => playAchievement(), []);
  return (
    <div className="achieve-pop">
      <span className="achieve-pop-icon">
        <PixelIcon name={icon} color="#e0a100" size={28} />
      </span>
      <span>
        <small>Conquista desbloqueada!</small>
        <b>{name}</b>
        {desc && <em>{desc}</em>}
      </span>
    </div>
  );
}

/**
 * Campeonato rápido (offline e online): sair no meio conta como derrota contra o próximo adversário.
 * A carreira e a run normal não entram nisso: dá para sair e voltar depois.
 */
function QuickTourGuard() {
  const run = useGame(s => s.run);
  const screen = useGame(s => s.screen);
  const t = run?.quick ? run.tournament : undefined;
  const next = t && t.stage !== 'done' ? playerMatch(t) : null;
  const foe = t && next ? t.entrants[next.a === playerIndex(t) ? next.b : next.a] : null;
  useMatchGuard(screen === 'run' && !!foe, () => {
    if (!run || !foe) return;
    recordMatch(useGame.getState().trainer?.id, {
      mode: run.quickRoom ? 'qtour-online' : 'qtour',
      online: !!run.quickRoom,
      won: false,
      vs: foe.name,
      vsAvatar: foe.avatar,
      vsKind: foe.friend ? 'player' : 'bot',
      mine: run.party.map(m => m.species),
      theirs: (foe.team ?? []).map(m => m.species),
      note: 'Saiu no meio do campeonato',
      quit: 'me',
    });
  });
  return null;
}
