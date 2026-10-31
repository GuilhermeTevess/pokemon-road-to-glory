// Celular não tem "passar o mouse": as dicas que o PC mostra no hover (atributo title)
// aparecem num balão quando a pessoa toca no elemento. Em botões, que já fazem algo ao
// tocar, a dica aparece segurando o dedo por meio segundo.

let bubble: HTMLDivElement | null = null;
let hideTimer = 0;
let holdTimer = 0;

function hide() {
  window.clearTimeout(hideTimer);
  bubble?.remove();
  bubble = null;
}

function show(text: string, el: Element) {
  hide();
  const r = el.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'touch-tip';
  b.textContent = text;
  document.body.appendChild(b);
  const w = b.offsetWidth;
  const h = b.offsetHeight;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  const top = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8;
  b.style.left = `${left}px`;
  b.style.top = `${top}px`;
  bubble = b;
  hideTimer = window.setTimeout(hide, 3500);
}

const INTERACTIVE = 'button, a[href], input, select, textarea, summary, label, [role="button"], [onclick]';

export function installTouchTips() {
  document.addEventListener(
    'pointerdown',
    e => {
      window.clearTimeout(holdTimer);
      if (e.pointerType === 'mouse') return;
      hide();
      const target = e.target as Element | null;
      const el = target?.closest?.('[title]');
      const text = el?.getAttribute('title');
      if (!el || !text) return;
      const action = target!.closest(INTERACTIVE);
      // Um botão desligado não faz nada ao tocar: mostra logo o motivo.
      if (!action || (action as HTMLButtonElement).disabled) show(text, el);
      else holdTimer = window.setTimeout(() => show(text, el), 550);
    },
    {capture: true},
  );
  const cancel = () => window.clearTimeout(holdTimer);
  document.addEventListener('pointerup', cancel, {capture: true});
  document.addEventListener('pointercancel', cancel, {capture: true});
  document.addEventListener('scroll', hide, {capture: true, passive: true});
}
