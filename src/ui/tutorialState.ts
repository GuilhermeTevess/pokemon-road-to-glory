// Estado do tutorial guardado no navegador (localStorage 'rtg-tutorial').
import {create} from 'zustand';

/**
 * - `on`: o tutorial está ligado e mostra cada parte na primeira vez que a pessoa chega nela.
 * - `off`: a pessoa disse "Não" ou pulou. Na próxima vez que abrir o site, pergunta de novo.
 * - `never`: "Não perguntar de novo". Só volta pelo botão da Ajuda.
 */
export type TutorialMode = 'on' | 'off' | 'never';

export interface TutorialSave {
  mode: TutorialMode;
  /** Partes do tutorial que a pessoa já viu (ids das partes em tutorialTours.ts). */
  seen: string[];
}

const KEY = 'rtg-tutorial';

export function parseTutorial(raw: string | null): TutorialSave {
  try {
    const v = raw ? JSON.parse(raw) : null;
    const mode: TutorialMode = v?.mode === 'on' || v?.mode === 'never' ? v.mode : 'off';
    const seen = Array.isArray(v?.seen) ? v.seen.filter((s: unknown) => typeof s === 'string') : [];
    return {mode, seen};
  } catch {
    return {mode: 'off', seen: []};
  }
}

/** Ao abrir o site: perguntar "Deseja ativar o tutorial?" só quando ele não está ligado nem foi recusado de vez. */
export function asksOnEntry(save: TutorialSave): boolean {
  return save.mode === 'off';
}

function load(): TutorialSave {
  try {
    return parseTutorial(localStorage.getItem(KEY));
  } catch {
    return {mode: 'off', seen: []};
  }
}

function persist(save: TutorialSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* ignora */
  }
}

interface TutorialStore extends TutorialSave {
  /** A pergunta da entrada está aberta. */
  asking: boolean;
  answer(choice: 'yes' | 'no' | 'never'): void;
  /** Marca uma parte como vista (não aparece de novo). */
  markSeen(id: string): void;
  /** "Pular tutorial": desliga tudo. Na próxima visita pergunta de novo. */
  skip(): void;
  /** Botão da Ajuda: liga o tutorial de novo, do começo. */
  restart(): void;
}

export const useTutorial = create<TutorialStore>((set, get) => {
  const saved = load();
  const save = (patch: Partial<TutorialSave>) => {
    const next = {mode: get().mode, seen: get().seen, ...patch};
    persist(next);
    set({...patch});
  };
  return {
    ...saved,
    asking: asksOnEntry(saved),
    answer(choice) {
      set({asking: false});
      // "Não" vale só para esta visita: não precisa salvar nada.
      // "Sim" continua de onde parou (as partes já vistas não repetem).
      if (choice === 'yes') save({mode: 'on'});
      else if (choice === 'never') save({mode: 'never'});
    },
    markSeen(id) {
      if (!get().seen.includes(id)) save({seen: [...get().seen, id]});
    },
    skip() {
      save({mode: 'off'});
    },
    restart() {
      save({mode: 'on', seen: []});
      set({asking: false});
    },
  };
});
