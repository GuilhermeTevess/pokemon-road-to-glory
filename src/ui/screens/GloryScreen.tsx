// Parte D: melhorias gerais compradas com Glória.
import {UPGRADES} from '../../game/glory';
import {useGame} from '../../game/store';
import {PixelIcon} from '../components';

export function GloryScreen() {
  const {collection, setScreen, buyUpgrade} = useGame();
  const glory = collection.glory ?? 0;
  return (
    <div className="screen glory-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('title')}>
          <PixelIcon name="back" /> Voltar
        </button>
        <h2>Glória</h2>
        <span className="glory-total">
          <PixelIcon name="trophy" color="#e0a100" size={20} /> {glory}
        </span>
      </header>
      <p className="hint">
        Toda run dá Glória quando acaba: 1 por ronda, +5 a cada 10 rondas e +20 se completar a temporada de 120 rondas. Os torneios dão
        Glória extra pela colocação (uma League Cup vencida dá 30). Ela fica com o treinador para sempre e compra melhorias para todas as próximas runs.
      </p>
      <div className="upgrade-list">
        {UPGRADES.map(u => {
          const lv = collection.upgrades?.[u.id] ?? 0;
          const max = lv >= u.costs.length;
          const cost = u.costs[lv];
          return (
            <div key={u.id} className="panel upgrade">
              <div className="upgrade-head">
                <b>{u.name}</b>
                <span className="upgrade-pips">
                  {u.costs.map((_, i) => (
                    <span key={i} className={`pip ${i < lv ? 'on' : ''}`} />
                  ))}
                </span>
              </div>
              <div className="hint">{lv > 0 ? `Agora: ${u.levels[lv - 1]}` : 'Ainda não comprado'}</div>
              {max ? (
                <div className="upgrade-max">No máximo!</div>
              ) : (
                <button className="btn small" disabled={glory < cost} onClick={() => buyUpgrade(u.id)}>
                  {u.levels[lv]} · <PixelIcon name="trophy" color="#e0a100" size={12} /> {cost}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
