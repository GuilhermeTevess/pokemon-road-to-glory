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

export type Theme = 'light' | 'dark';

function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem('rtg-theme');
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Tema atual: o que o jogador escolheu ou, se nunca escolheu, o do aparelho. */
export function theme(): Theme {
  return savedTheme() ?? systemTheme();
}

function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem('rtg-theme', t);
  } catch {
    /* ignora */
  }
  applyTheme(t);
}

/** Aplica o tema na abertura e segue o aparelho enquanto o jogador não escolher um. */
export function installTheme(): void {
  applyTheme(theme());
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (savedTheme()) return;
      applyTheme(theme());
    });
  } catch {
    /* ignora */
  }
}
