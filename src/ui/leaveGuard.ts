// Sair no meio de uma partida conta como derrota.
// A tela da partida liga a guarda com useMatchGuard; o botão "Início" (e os "Sair" da própria
// tela) passam por requestLeave, que pede confirmação antes. Fechar ou recarregar a aba
// também conta: o navegador pergunta antes e, se a pessoa sair mesmo, a derrota é gravada.
import {useEffect, useRef, useSyncExternalStore} from 'react';

interface Guard {
  forfeit: () => void;
}

/** Guardas ligadas agora (ex.: o campeonato rápido inteiro e, dentro dele, a partida ao vivo). */
let guards: Guard[] = [];
/** Pedido de saída esperando a confirmação (a janelinha fica no App). */
let pending: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());

/** Tem partida em andamento? */
export const matchActive = () => guards.length > 0;

/** Sair (ir para o Início, fechar a sala...): se tiver partida em andamento, pergunta antes. */
export function requestLeave(go: () => void): void {
  if (!guards.length) return go();
  pending = go;
  emit();
}

/** "Sair e perder": grava a derrota e sai. */
export function confirmLeave(): void {
  const go = pending;
  pending = null;
  const all = [...guards].reverse();
  guards = [];
  all.forEach(g => g.forfeit());
  emit();
  go?.();
}

export function cancelLeave(): void {
  pending = null;
  emit();
}

/** Para a janelinha de confirmação do App. */
export function useLeaveAsk(): boolean {
  return useSyncExternalStore(
    f => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => pending !== null,
  );
}

/**
 * Liga a guarda enquanto `active`: sair pelo menu pede confirmação e fechar a aba conta como derrota.
 * `forfeit` grava a derrota (e avisa o adversário online); roda no máximo uma vez.
 */
export function useMatchGuard(active: boolean, forfeit: () => void): void {
  const fn = useRef(forfeit);
  fn.current = forfeit;
  useEffect(() => {
    if (!active) return;
    let done = false;
    const me: Guard = {
      forfeit: () => {
        if (done) return;
        done = true;
        fn.current();
      },
    };
    guards = [...guards, me];
    const ask = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Navegadores antigos precisam disto para mostrar o "Sair do site?".
      e.returnValue = '';
    };
    // Só quando a página está indo embora de verdade (se a pessoa cancelar, nada acontece).
    const gone = () => me.forfeit();
    window.addEventListener('beforeunload', ask);
    window.addEventListener('pagehide', gone);
    return () => {
      window.removeEventListener('beforeunload', ask);
      window.removeEventListener('pagehide', gone);
      guards = guards.filter(g => g !== me);
      if (!guards.length) {
        if (pending) {
          pending = null;
          emit();
        }
      }
    };
  }, [active]);
}
