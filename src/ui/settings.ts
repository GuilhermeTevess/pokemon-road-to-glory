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

let leadAsk = (() => {
  try {
    return localStorage.getItem('rtg-ask-lead') !== 'off';
  } catch {
    return true;
  }
})();

/** Antes de cada luta da run, mostrar quem veio e perguntar "Quer trocar o Pokémon?". */
export function askLead(): boolean {
  return leadAsk;
}

export function setAskLead(on: boolean): void {
  leadAsk = on;
  try {
    localStorage.setItem('rtg-ask-lead', on ? 'on' : 'off');
  } catch {
    /* ignora */
  }
}
