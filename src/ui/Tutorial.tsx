// Tutorial guiado: pergunta na entrada + destaque brilhante passo a passo em cada tela.
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {PixelIcon, Sprite} from './components';
import {TOURS} from './tutorialTours';
import type {TutorialStep, TutorialTour} from './tutorialTours';
import {useTutorial} from './tutorialState';
import {useGame} from '../game/store';

/** Retângulo do elemento, se ele está de verdade na tela (não escondido nem fora dela, como a gaveta do painel no celular). */
function visibleRect(el: Element): DOMRect | null {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  if (r.right <= 0 || r.left >= window.innerWidth) return null;
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return null;
  return r;
}

function findTarget(sel: TutorialStep['sel']): Element | null {
  if (!sel) return null;
  for (const s of Array.isArray(sel) ? sel : [sel]) {
    for (const el of document.querySelectorAll(s)) if (visibleRect(el)) return el;
  }
  return null;
}

function tourReady(t: TutorialTour): boolean {
  if (!findTarget(t.when)) return false;
  if (!t.modal && document.querySelector('.modal-backdrop')) return false;
  return true;
}

interface Active {
  tour: TutorialTour;
  steps: TutorialStep[];
  i: number;
}

export function Tutorial() {
  const {mode, seen, asking, markSeen, skip} = useTutorial();
  const [active, setActive] = useState<Active | null>(null);

  // Procura a próxima parte a mostrar: a primeira ainda não vista cuja tela está aberta.
  // Espera a tela ficar parada por um instante (2 checagens seguidas) antes de começar.
  useEffect(() => {
    if (mode !== 'on' || asking || active) return;
    let candidate: string | null = null;
    const id = setInterval(() => {
      const t = TOURS.find(x => !seen.includes(x.id) && tourReady(x));
      if (!t) return void (candidate = null);
      if (candidate !== t.id) return void (candidate = t.id);
      const steps = t.steps.filter(s => !s.sel || findTarget(s.sel));
      if (!steps.length) return markSeen(t.id);
      setActive({tour: t, steps, i: 0});
    }, 450);
    return () => clearInterval(id);
  }, [mode, asking, active, seen, markSeen]);

  // Se o tutorial for desligado no meio de uma parte, fecha na hora.
  useEffect(() => {
    if (mode !== 'on') setActive(null);
  }, [mode]);

  const finish = () => {
    if (active) markSeen(active.tour.id);
    setActive(null);
  };

  return (
    <>
      {asking && <TutorialAsk />}
      {active && (
        <TourOverlay
          key={`${active.tour.id}-${active.i}`}
          active={active}
          onNext={() => (active.i + 1 >= active.steps.length ? finish() : setActive({...active, i: active.i + 1}))}
          onBack={() => setActive({...active, i: Math.max(0, active.i - 1)})}
          onGone={finish}
          onSkip={() => {
            finish();
            skip();
            useGame.getState().toast('Tutorial desligado. Dá para ligar de novo na Ajuda.');
          }}
        />
      )}
    </>
  );
}

/** "Deseja ativar o tutorial?" ao entrar no site. */
function TutorialAsk() {
  const answer = useTutorial(s => s.answer);
  return createPortal(
    <div className="tut-ask-backdrop">
      <div className="tut-ask" role="dialog" aria-labelledby="tut-ask-title">
        <div className="tut-ask-mascot">
          <Sprite name="Pikachu" />
        </div>
        <h2 id="tut-ask-title">Deseja ativar o tutorial?</h2>
        <p className="hint">Ele mostra, tela por tela, o que cada botão faz: como lutar, ver fraquezas, capturar e jogar cada modo. Dá para pular quando quiser.</p>
        <div className="tut-ask-buttons">
          <button className="btn tut-yes" onClick={() => answer('yes')}>
            Sim
          </button>
          <button className="btn tut-no" onClick={() => answer('no')}>
            Não
          </button>
          <button className="btn tut-never" onClick={() => answer('never')}>
            Não perguntar de novo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const PAD = 6;

function TourOverlay({active, onNext, onBack, onGone, onSkip}: {active: Active; onNext: () => void; onBack: () => void; onGone: () => void; onSkip: () => void}) {
  const step = active.steps[active.i];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{top: number; left: number} | null>(null);

  // Rola até o destaque e acompanha a posição dele (animações, rolagem, celular girando...).
  useEffect(() => {
    const el = findTarget(step.sel);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 20) el.scrollIntoView({block: 'center', behavior: 'smooth'});
    }
    let raf = 0;
    let last = '';
    let missing = 0;
    const tick = () => {
      // A tela mudou (a luta acabou, voltou para o menu...): encerra esta parte.
      if (!findTarget(active.tour.when)) {
        if (++missing > 20) return onGone();
      } else missing = 0;
      const cur = findTarget(step.sel);
      const r = cur ? visibleRect(cur) : null;
      const key = r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : '';
      if (key !== last) {
        last = key;
        setRect(r);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Cartão: embaixo do destaque se couber, senão em cima; sem destaque, no meio da tela.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) return setCardPos({top: Math.max(8, (vh - h) / 2), left: Math.max(8, (vw - w) / 2)});
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), vw - w - 8);
    let top: number;
    if (rect.bottom + PAD + 14 + h <= vh - 8) top = rect.bottom + PAD + 14;
    else if (rect.top - PAD - 14 - h >= 8) top = rect.top - PAD - 14 - h;
    else top = rect.top + rect.height / 2 < vh / 2 ? vh - h - 8 : 8;
    setCardPos({top, left});
  }, [rect]);

  // Teclado: Enter/→ avança, ← volta, Esc pula.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') (e.preventDefault(), onNext());
      else if (e.key === 'ArrowLeft') onBack();
      else if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onBack, onSkip]);

  const last = active.i + 1 >= active.steps.length;
  return createPortal(
    <div className="tut-layer">
      {/* Bloqueia cliques no jogo enquanto a explicação está aberta. */}
      <div className={`tut-blocker ${rect ? '' : 'dim'}`} />
      {rect && (
        <div
          className="tut-ring"
          style={{left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2}}
        >
          <i className="tut-spark a" />
          <i className="tut-spark b" />
          <i className="tut-spark c" />
          <i className="tut-spark d" />
        </div>
      )}
      <div
        ref={cardRef}
        className="tut-card"
        role="dialog"
        aria-live="polite"
        style={cardPos ? {top: cardPos.top, left: cardPos.left} : {visibility: 'hidden', top: 0, left: 0}}
      >
        <button className="btn small tut-skip" onClick={onSkip}>
          Pular tutorial ✕
        </button>
        <div className="tut-card-head">
          <span className="tut-card-icon">
            <PixelIcon name="help" size={20} color="var(--ink)" />
          </span>
          <h3>{step.title}</h3>
        </div>
        <p>{step.text}</p>
        <div className="tut-card-foot">
          <span className="tut-dots" aria-label={`Passo ${active.i + 1} de ${active.steps.length}`}>
            {active.steps.map((_, k) => (
              <i key={k} className={k === active.i ? 'on' : k < active.i ? 'done' : ''} />
            ))}
          </span>
          {active.i > 0 && (
            <button className="btn small" onClick={onBack}>
              ← Voltar
            </button>
          )}
          <button className="btn small tut-next" onClick={onNext} autoFocus>
            {last ? 'Entendi! ✓' : 'Próximo ▶'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
