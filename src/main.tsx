import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './ui/App';
import './ui/styles.css';
import './ui/theme-dark.css';
import {useGame} from './game/store';
import {installTouchTips} from './ui/touchTips';
import {installTheme} from './ui/settings';
import {startPlayerSync} from './game/players';

installTouchTips();
installTheme();
// Lista de jogadores: no fim de cada partida online, o seu resumo vai para a nuvem.
startPlayerSync();

// Modo de teste (?net=local): deixa o estado do jogo acessível para os testes automáticos.
if (location.search.includes('net=local')) (window as unknown as {__game: typeof useGame}).__game = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
