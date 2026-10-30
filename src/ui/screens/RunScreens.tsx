import {useEffect, useState} from 'react';
import {dex, species} from '../../data/dex';
import {TIER_COLORS, getItem, itemUsage} from '../../data/items';
import {BIOME_CHANGE_EVERY, HEAL_EVERY, STAGE_LENGTH} from '../../game/encounters';
import {calcStats, expForLevel, itemEvolutions} from '../../game/mon';
import {rerollCost, shopItems} from '../../game/rewards';
import {useGame} from '../../game/store';
import type {OwnedMon} from '../../game/types';
import {HpBar, ItemIcon, MatchupPanel, Modal, PixelIcon, Sprite, StatsTable, TypeBadge, Types} from '../components';

export function RewardScreen() {
  const {run, pickReward, reroll, buy, skipReward} = useGame();
  const [tab, setTab] = useState<'reward' | 'shop'>('reward');
  if (!run) return null;
  const cost = rerollCost(run.rerolls, run.wave);
  const nextWave = run.wave + 1;
  const notes = [
    run.wave >= STAGE_LENGTH ? (['trophy', 'Última ronda da etapa vencida!'] as const) : null,
    run.wave % HEAL_EVERY === 0 ? (['heart', 'Seu time será curado no Centro Pokémon.'] as const) : null,
    run.wave % BIOME_CHANGE_EVERY === 0 || run.mapReady ? (['map', 'Você vai poder trocar de bioma.'] as const) : null,
  ].filter(n => n !== null);
  return (
    <div className="screen reward-screen">
      <h2>Ronda {run.wave} concluída!</h2>
      {notes.map(([icon, text]) => (
        <p key={text} className="note">
          <PixelIcon name={icon} /> {text}
        </p>
      ))}
      <div className="tabs">
        <button className={`tab ${tab === 'reward' ? 'active' : ''}`} onClick={() => setTab('reward')}>
          Recompensa
        </button>
        <button className={`tab ${tab === 'shop' ? 'active' : ''}`} onClick={() => setTab('shop')}>
          Loja (₽ {run.money})
        </button>
      </div>
      {tab === 'reward' ? (
        <>
          <p className="hint">Escolha 1 item:</p>
          <div className="rewards">
            {run.rewardOptions.map(id => {
              const it = getItem(id);
              return (
                <button key={id} className="reward-card" style={{borderColor: TIER_COLORS[it.tier]}} onClick={() => pickReward(id)}>
                  <ItemIcon id={id} size={48} />
                  <span className="reward-name">{it.name}</span>
                  <span className="reward-desc">{it.desc}</span>
                  <span className="reward-usage">{itemUsage(it)}</span>
                </button>
              );
            })}
          </div>
          <div className="row center">
            <button className="btn" disabled={run.money < cost} onClick={reroll}>
              <PixelIcon name="dice" /> Sortear de novo · ₽ {cost}
            </button>
            <button className="btn" onClick={skipReward}>
              Pular
            </button>
          </div>
        </>
      ) : (
        <div className="shop">
          {shopItems().map(it => (
            <button key={it.id} className="btn item-btn" disabled={run.money < it.price} onClick={() => buy(it.id)}>
              <ItemIcon id={it.id} /> {it.name} · ₽ {it.price} <span className="muted">(tem {run.bag[it.id] ?? 0})</span>
            </button>
          ))}
        </div>
      )}
      <p className="hint">Próxima: ronda {Math.min(nextWave, STAGE_LENGTH)}. Abra "Time" para usar itens, equipar e organizar.</p>
    </div>
  );
}

export function PartyPanel({onClose}: {onClose: () => void}) {
  const {run, useItem, takeItem, setLead, swapWithBox} = useGame();
  const [selected, setSelected] = useState<string | null>(run?.party[0]?.uid ?? null);
  const [tab, setTab] = useState<'party' | 'bag' | 'box'>('party');
  if (!run) return null;
  const mon = run.party.find(m => m.uid === selected) ?? run.box.find(m => m.uid === selected);
  const inBattle = run.phase === 'battle';
  const bagEntries = Object.entries(run.bag).filter(([, n]) => n > 0);
  return (
    <Modal onClose={onClose} wide>
      <div className="tabs">
        <button className={`tab ${tab === 'party' ? 'active' : ''}`} onClick={() => setTab('party')}>
          Time ({run.party.length}/6)
        </button>
        <button className={`tab ${tab === 'bag' ? 'active' : ''}`} onClick={() => setTab('bag')}>
          Mochila
        </button>
        <button className={`tab ${tab === 'box' ? 'active' : ''}`} onClick={() => setTab('box')}>
          Caixa ({run.box.length})
        </button>
      </div>
      <div className="party-layout">
        <div className="party-list">
          {(tab === 'box' ? run.box : run.party).map((m, i) => (
            <MonRow key={m.uid} mon={m} lead={tab !== 'box' && i === 0} selected={m.uid === selected} onClick={() => setSelected(m.uid)} />
          ))}
          {tab === 'box' && !run.box.length && <p className="hint">Pokémon capturados com o time cheio vêm para cá.</p>}
        </div>
        <div className="party-detail">
          {tab === 'bag' ? (
            <div className="bag">
              {!bagEntries.length && <p className="hint">Mochila vazia.</p>}
              {bagEntries.map(([id, n]) => {
                const it = getItem(id);
                const needsMon = !['map', 'incense'].includes(it.kind);
                const usable = !inBattle && it.kind !== 'ball';
                return (
                  <div key={id} className="bag-row">
                    <ItemIcon id={id} />
                    <div className="bag-text">
                      <strong>
                        {it.name} x{n}
                      </strong>
                      <span className="muted">{it.desc}</span>
                      <span className="usage">{itemUsage(it)}</span>
                    </div>
                    {usable && (
                      <button className="btn small" disabled={needsMon && !mon} onClick={() => useItem(id, mon?.uid ?? '')}>
                        {it.kind === 'held' ? 'Equipar' : 'Usar'}
                        {needsMon && mon ? ` em ${mon.species}` : ''}
                      </button>
                    )}
                  </div>
                );
              })}
              {inBattle && <p className="hint">Durante a batalha, use itens pelo menu da batalha.</p>}
              {mon && <p className="hint">Selecionado: {mon.species} (troque na aba Time).</p>}
            </div>
          ) : mon ? (
            <MonDetail
              mon={mon}
              actions={
                <div className="row wrap">
                  {tab === 'party' && run.party[0]?.uid !== mon.uid && !inBattle && (
                    <button className="btn small" onClick={() => setLead(mon.uid)}>
                      Colocar na frente
                    </button>
                  )}
                  {mon.item && !inBattle && (
                    <button className="btn small" onClick={() => takeItem(mon.uid)}>
                      Tirar {getItem(mon.item).name}
                    </button>
                  )}
                  {tab === 'box' && !inBattle &&
                    (run.party.length < 6 ? (
                      <button className="btn small" onClick={() => swapWithBox(mon.uid, null)}>
                        Levar para o time
                      </button>
                    ) : (
                      run.party.map(p => (
                        <button key={p.uid} className="btn small" onClick={() => swapWithBox(mon.uid, p.uid)}>
                          Trocar por {p.species}
                        </button>
                      ))
                    ))}
                  {itemEvolutions(mon).length > 0 && <span className="hint">Evolui com Pedra da Evolução.</span>}
                </div>
              }
            />
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function MonRow({mon, lead, selected, onClick}: {mon: OwnedMon; lead: boolean; selected: boolean; onClick: () => void}) {
  const max = calcStats(mon).hp;
  return (
    <button className={`mon-row ${selected ? 'selected' : ''} ${mon.hp <= 0 ? 'fainted' : ''}`} onClick={onClick}>
      <Sprite name={mon.species} shiny={mon.shiny} size={56} />
      <span className="mon-row-info">
        <span>
          {lead && <PixelIcon name="star" color="#e0a100" />} 
          {mon.species} Nv.{mon.level} {mon.item && <ItemIcon id={mon.item} size={18} />}
        </span>
        <HpBar hp={mon.hp} maxhp={max} showNumbers />
      </span>
    </button>
  );
}

export function MonDetail({mon, actions}: {mon: OwnedMon; actions?: React.ReactNode}) {
  const s = species(mon.species);
  const next = expForLevel(mon.level + 1);
  const cur = expForLevel(mon.level);
  return (
    <div className="mon-detail">
      <div className="row">
        <Sprite name={mon.species} shiny={mon.shiny} />
        <div>
          <h3>
            {mon.shiny && <span className="shiny"><PixelIcon name="star" color="#e0a100" /> </span>}
            {s.name} <span className="lv">Nv. {mon.level}</span>
          </h3>
          <Types name={mon.species} />
          <div className="muted">
            {mon.ability} · {mon.nature} · {mon.gender === 'N' ? '—' : mon.gender === 'M' ? '♂' : '♀'}
          </div>
          <div className="exp">
            EXP <div className="exp-track"><div className="exp-fill" style={{width: `${Math.min(100, ((mon.exp - cur) / (next - cur)) * 100)}%`}} /></div>
          </div>
        </div>
      </div>
      {actions}
      <div className="moves-list">
        {mon.moves.map(m => {
          const mv = dex.moves.get(m);
          return (
            <div key={m} className="move-chip">
              <TypeBadge type={mv.type} small /> {mv.name}
              {mv.basePower > 0 && <span className="muted"> · {mv.basePower}</span>}
            </div>
          );
        })}
      </div>
      <div className="row wrap top">
        <StatsTable mon={mon} />
        <MatchupPanel types={s.types} title="Fraquezas e resistências" />
      </div>
    </div>
  );
}

export function PendingModal() {
  const {run, resolvePending} = useGame();
  const ev = run?.pending[0];
  const mon = ev && (run.party.find(m => m.uid === ev.uid) ?? run.box.find(m => m.uid === ev.uid));
  useEffect(() => {
    if (ev && !mon) resolvePending(null);
  }, [ev, mon, resolvePending]);
  if (!run || !ev || !mon) return null;
  if (ev.kind === 'evolve') {
    return (
      <Modal>
        <h2>O quê? {mon.species} está evoluindo!</h2>
        <div className="evo">
          <Sprite name={mon.species} shiny={mon.shiny} className="evo-from" />
          <span className="arrow"><PixelIcon name="back" size={28} /></span>
          <div className="evo-options">
            {ev.into.map(n => (
              <button key={n} className="evo-option" onClick={() => resolvePending(n)}>
                <Sprite name={n} shiny={mon.shiny} />
                <span>{n}</span>
                <Types name={n} />
              </button>
            ))}
          </div>
        </div>
        <button className="btn small" onClick={() => resolvePending(null)}>
          Cancelar evolução
        </button>
      </Modal>
    );
  }
  const newMove = dex.moves.get(ev.move);
  return (
    <Modal>
      <h2>
        {mon.species} quer aprender {newMove.name}!
      </h2>
      <div className="move-chip big">
        <TypeBadge type={newMove.type} /> {newMove.name} · {newMove.basePower || '—'} poder · {newMove.category}
      </div>
      <p className="muted">{newMove.shortDesc}</p>
      <p>Qual golpe esquecer?</p>
      <div className="list-actions">
        {mon.moves.map((m, i) => {
          const mv = dex.moves.get(m);
          return (
            <button key={m} className="btn item-btn" onClick={() => resolvePending(i)}>
              <TypeBadge type={mv.type} small /> {mv.name} ({mv.basePower || '—'})
            </button>
          );
        })}
        <button className="btn small" onClick={() => resolvePending(null)}>
          Não aprender
        </button>
      </div>
    </Modal>
  );
}

export function EndScreen({kind}: {kind: 'gameOver' | 'stageClear'}) {
  const {run, abandonRun} = useGame();
  if (!run) return null;
  return (
    <div className="screen end-screen">
      <h1>{kind === 'stageClear' ? 'Etapa 1 concluída!' : 'Fim da run'}</h1>
      <p>
        {kind === 'stageClear'
          ? 'Você chegou à ronda 30! Na etapa 3, é aqui que você enfrentaria seus amigos.'
          : `Seu time caiu na ronda ${run.wave}.`}
      </p>
      <div className="row center wrap">
        {run.party.map(m => (
          <div key={m.uid} className="cell">
            <Sprite name={m.species} shiny={m.shiny} />
            <span>
              {m.species} Nv.{m.level}
            </span>
          </div>
        ))}
      </div>
      <p className="muted">
        Derrotados: {run.stats.defeated} · Capturados: {run.stats.caught} · Fugas: {run.stats.fled}
      </p>
      <button className="btn primary" onClick={abandonRun}>
        Voltar ao início
      </button>
    </div>
  );
}
