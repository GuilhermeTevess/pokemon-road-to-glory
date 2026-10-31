import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './ui/App';
import './ui/styles.css';
import {useGame} from './game/store';

// Modo de teste (?net=local): deixa o estado do jogo acessível para os testes automáticos.
if (location.search.includes('net=local')) (window as unknown as {__game: typeof useGame}).__game = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
