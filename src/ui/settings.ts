// Preferências do jogador guardadas no navegador.

let fastMode = (() => {
  try {
    return localStorage.getItem('rtg-fast') === 'on';
  } catch {
    return false;
  }
})();

/** "Pular animações": batalhas, capturas, evoluções e sorteios bem mais rápidos. */
export function fast(): boolean {
  return fastMode;
}

export function setFast(on: boolean): void {
  fastMode = on;
  try {
    localStorage.setItem('rtg-fast', on ? 'on' : 'off');
  } catch {
    /* ignora */
  }
}
