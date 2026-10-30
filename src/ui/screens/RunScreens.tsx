import {useEffect, useState} from 'react';
import {dex, species} from '../../data/dex';
import {moveDescPt} from '../../data/movesPt';
import {getBiome} from '../../data/biomes';
import {TIER_COLORS, getItem, itemUsage, needsTarget} from '../../data/items';
import {BIOME_CHANGE_EVERY, HEAL_EVERY, STAGE_LENGTH} from '../../game/encounters';
import {NICK_MAX, calcStats, displayName, expForLevel, itemEvolutions} from '../../game/mon';
import {SHOP, moneyValue, rerollCost} from '../../game/rewards';
import {discounted, gloryFor, rerollPrice} from '../../game/glory';
import {EV_MAX_STAT} from '../../game/meta';
import {useGame} from '../../game/store';
import type {OwnedMon} from '../../game/types';
import {playCoins, playItem} from '../audio';
import {HpBar, ItemIcon, MatchupPanel, MonName, Modal, MoveInfo, PixelIcon, Sprite, StatsTable, TeamWeakness, TypeBadge, Types} from '../components';
import {TrainerAvatar} from './StartScreens';
import {EggInfo} from './DaycareScreen';

/** Lista de Pokémon para escolher em quem usar um item. */
function TargetPicker({itemId, mons, onPick, children}: {itemId: string; mons: OwnedMon[]; onPick: (uid: string) => void; children?: React.ReactNode}) {
  const item = getItem(itemId);
  const note = (m: OwnedMon): string => {
    const max = calcStats(m).hp;
    switch (item.kind) {
      case 'heal':
        return m.hp <= 0 ? 'Desmaiado' : m.hp >= max ? 'HP cheio' : `HP ${m.hp}/${max}`;
      case 'revive':
        return m.hp <= 0 ? 'Pode reviver' : 'Não está desmaiado';
      case 'evolution':
        return itemEvolutions(m).length ? 'Pode evoluir!' : 'Não evolui com pedra';
      case 'held':
        return m.item ? `Segura ${getItem(m.item).name} (volta p/ mochila)` : 'Mãos livres';
      case 'mint':
        return `Natureza atual: ${m.nature}`;
      case 'ability':
        return `Habilidade: ${m.ability}`;
      case 'vitamin':
        return `EVs: ${m.evs[item.evStat!]}/${EV_MAX_STAT}`;
      default:
        return `Nv. ${m.level}`;
    }
  };
  const ok = (m: OwnedMon): boolean => {
    const max = calcStats(m).hp;
    if (item.kind === 'heal') return m.hp > 0 && m.hp < max;
    if (item.kind === 'revive') return m.hp <= 0;
    if (item.kind === 'evolution') return itemEvolutions(m).length > 0;
    if (item.kind === 'mint') return m.nature !== item.nature;
    if (item.kind === 'vitamin') return m.evs[item.evStat!] < EV_MAX_STAT;
    return true;
  };
  return (
    <div className="target-picker">
      <div className="row center">
        <ItemIcon id={itemId} size={40} />
        <div className="left">
          <strong>{item.name}</strong>
          <div className="muted">{item.desc}</div>
        </div>
      </div>
      <p className="hint">Em qual Pokémon?</p>
      <div className="target-list">
        {mons.map(m => (
          <button key={m.uid} className="target-btn" disabled={!ok(m)} onClick={() => onPick(m.uid)}>
            <Sprite name={m.species} shiny={m.shiny} size={48} />
            <span className="left">
              <span>
                <MonName mon={m} /> Nv.{m.level}
              </span>
              <span className="muted">{note(m)}</span>
            </span>
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

function RewardCard({id, wave, onClick}: {id: string; wave: number; onClick: () => void}) {
  const it = getItem(id);
  return (
    <button className={`reward-card tier-${it.tier}`} style={{['--tier' as string]: TIER_COLORS[it.tier]}} onClick={onClick}>
      <span className="tier-tag">{TIER_LABEL[it.tier]}</span>
      <ItemIcon id={id} size={56} />
      <span className="reward-name">{it.name}</span>
      {it.kind === 'money' && <span className="reward-money">+₽ {moneyValue(it, wave)}</span>}
      <span className="reward-desc">{it.desc}</span>
      <span className="reward-usage">{itemUsage(it)}</span>
    </button>
  );
}

const TIER_LABEL: Record<string, string> = {common: 'Comum', great: 'Bom', ultra: 'Raro', master: 'Lendário'};

export function RewardScreen() {
  const {run, pickReward, reroll, buy, skipReward} = useGame();
  const [tab, setTab] = useState<'reward' | 'shop'>('reward');
  const [choosing, setChoosing] = useState<string | null>(null);
  if (!run) return null;
  const cost = rerollPrice(run, rerollCost(run.rerolls, run.wave));
  const nextWave = run.wave + 1;
  const notes = [
    run.wave >= STAGE_LENGTH ? (['trophy', 'Última ronda da etapa vencida!'] as const) : null,
    run.wave % HEAL_EVERY === 0 ? (['heart', 'Seu time será curado no Centro Pokémon.'] as const) : null,
    run.wave % BIOME_CHANGE_EVERY === 0 || run.mapReady ? (['map', 'Você vai poder trocar de bioma.'] as const) : null,
  ].filter(n => n !== null);
  const choose = (id: string) => {
    const it = getItem(id);
    if (it.kind === 'money') {
      playCoins();
      return pickReward(id);
    }
    playItem();
    if (needsTarget(it) || it.kind === 'map' || it.kind === 'incense') return setChoosing(id);
    pickReward(id);
  };
  const choosingItem = choosing ? getItem(choosing) : null;
  return (
    <div className="screen reward-screen">
      <h2>Ronda {run.wave} concluída!</h2>
      {notes.map(([icon, text]) => (
        <p key={text} className="note">
          <PixelIcon name={icon} /> {text}
        </p>
      ))}
      <div className="tabs big">
        <button className={`tab ${tab === 'reward' ? 'active' : ''}`} onClick={() => setTab('reward')}>
          Recompensa grátis
        </button>
        <button className={`tab ${tab === 'shop' ? 'active' : ''}`} onClick={() => setTab('shop')}>
          Loja · ₽ {run.money}
        </button>
      </div>
      {tab === 'reward' ? (
        <>
          <p className="hint">Escolha 1 item de graça. Itens que vão num Pokémon podem ser usados na hora ou guardados na mochila.</p>
          <div className="rewards">
            {run.rewardOptions.map(id => (
              <RewardCard key={id} id={id} wave={run.wave} onClick={() => choose(id)} />
            ))}
          </div>
          <div className="row center">
            <button className="btn" disabled={run.money < cost} onClick={reroll}>
              <PixelIcon name="dice" /> Sortear de novo · {cost ? `₽ ${cost}` : 'grátis'}
            </button>
            <button className="btn" onClick={skipReward}>
              Pular
            </button>
          </div>
        </>
      ) : (
        <div className="shop">
          <div className="wallet panel">
            <ItemIcon id="money" size={32} /> Você tem <strong>₽ {run.money}</strong>
            <span className="muted"> · ganha dinheiro a cada vitória e com Bolsas e Pepitas</span>
          </div>
          {SHOP.map(shelf => (
            <section key={shelf.title} className="shelf">
              <h3>{shelf.title}</h3>
              <div className="shelf-items">
                {shelf.items.map(id => {
                  const it = getItem(id);
                  return (
                    <div key={id} className="shop-card panel">
                      <ItemIcon id={id} size={40} />
                      <div className="shop-text">
                        <strong>{it.name}</strong>
                        <span className="muted">{it.desc}</span>
                        <span className="muted">Na mochila: {run.bag[id] ?? 0}</span>
                      </div>
                      <button className="btn small primary" disabled={run.money < discounted(run, it.price)} onClick={() => { playCoins(); buy(id); }}>
                        ₽ {discounted(run, it.price)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <button className="btn" onClick={() => setTab('reward')}>
            Voltar para a recompensa
          </button>
        </div>
      )}
      <p className="hint">Próxima: ronda {Math.min(nextWave, STAGE_LENGTH)}.</p>
      {choosing && choosingItem && (
        <Modal onClose={() => setChoosing(null)}>
          <h2>Usar agora?</h2>
          {needsTarget(choosingItem) ? (
            <TargetPicker itemId={choosing} mons={[...run.party, ...run.box]} onPick={uid => pickReward(choosing, uid)}>
              <button className="btn" onClick={() => pickReward(choosing)}>
                Guardar na mochila
              </button>
            </TargetPicker>
          ) : (
            <div className="list-actions">
              <p>{choosingItem.desc}</p>
              <button className="btn primary" onClick={() => pickReward(choosing, '')}>
                Usar agora
              </button>
              <button className="btn" onClick={() => pickReward(choosing)}>
                Guardar na mochila
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export type PartyTab = 'party' | 'bag' | 'box' | 'weak';

const BAG_GROUPS: {title: string; kinds: string[]}[] = [
  {title: 'Pokébolas', kinds: ['ball']},
  {title: 'Cura', kinds: ['heal', 'revive']},
  {title: 'Para a batalha', kinds: ['battle']},
  {title: 'Para melhorar Pokémon', kinds: ['candy', 'evolution', 'tm', 'mint', 'ability', 'vitamin']},
  {title: 'Itens para segurar', kinds: ['held']},
  {title: 'Viagem', kinds: ['map', 'incense']},
];

export function PartyPanel({onClose, initialTab = 'party', initialMon}: {onClose: () => void; initialTab?: PartyTab; initialMon?: string}) {
  const {run, useItem, takeItem, setLead, swapWithBox} = useGame();
  const [selected, setSelected] = useState<string | null>(initialMon ?? run?.party[0]?.uid ?? null);
  const [tab, setTab] = useState<PartyTab>(initialTab);
  const [using, setUsing] = useState<string | null>(null);
  if (!run) return null;
  const mon = run.party.find(m => m.uid === selected) ?? run.box.find(m => m.uid === selected);
  const inBattle = run.phase === 'battle';
  const bagEntries = Object.entries(run.bag).filter(([, n]) => n > 0);
  const bagCount = bagEntries.reduce((a, [, n]) => a + n, 0);
  return (
    <Modal onClose={onClose} wide>
      <div className="tabs big">
        <button className={`tab ${tab === 'party' ? 'active' : ''}`} onClick={() => setTab('party')}>
          Time ({run.party.length}/6)
        </button>
        <button className={`tab ${tab === 'bag' ? 'active' : ''}`} onClick={() => setTab('bag')}>
          Mochila ({bagCount})
        </button>
        <button className={`tab ${tab === 'box' ? 'active' : ''}`} onClick={() => setTab('box')}>
          PC ({run.box.length})
        </button>
        <button className={`tab ${tab === 'weak' ? 'active' : ''}`} onClick={() => setTab('weak')}>
          Fraquezas do time
        </button>
      </div>
      {tab === 'weak' ? (
        <div>
          <p className="hint">Quantos Pokémon do seu time levam dano dobrado (fraco) ou reduzido (resiste) de cada tipo de golpe.</p>
          <TeamWeakness party={run.party} />
        </div>
      ) : tab === 'bag' ? (
        <div className="bag">
          {inBattle && <p className="banner">Durante a batalha, use itens pelo botão Mochila da batalha. Aqui você só consulta.</p>}
          {!bagEntries.length && <p className="hint">Mochila vazia. Pegue itens nas recompensas ou compre na loja.</p>}
          {using ? (
            <TargetPicker
              itemId={using}
              mons={[...run.party, ...run.box]}
              onPick={uid => {
                useItem(using, uid);
                setUsing(null);
              }}
            >
              <button className="btn" onClick={() => setUsing(null)}>
                Cancelar
              </button>
            </TargetPicker>
          ) : (
            BAG_GROUPS.map(g => {
              const list = bagEntries.filter(([id]) => g.kinds.includes(getItem(id).kind));
              if (!list.length) return null;
              return (
                <section key={g.title} className="shelf">
                  <h3>{g.title}</h3>
                  {list.map(([id, n]) => {
                    const it = getItem(id);
                    const usable = !inBattle && !['ball', 'battle'].includes(it.kind);
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
                          <button className="btn small primary" onClick={() => (needsTarget(it) ? setUsing(id) : useItem(id, ''))}>
                            {it.kind === 'held' ? 'Equipar' : 'Usar'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })
          )}
        </div>
      ) : (
        <div className="party-layout">
          <div className="party-list">
            {tab === 'box' && <p className="hint">PC: Pokémon capturados com o time cheio. Troque com o time quando quiser (fora da batalha).</p>}
            {(tab === 'box' ? run.box : run.party).map((m, i) => (
              <MonRow key={m.uid} mon={m} lead={tab !== 'box' && i === 0} selected={m.uid === selected} onClick={() => setSelected(m.uid)} />
            ))}
            {tab === 'box' && !run.box.length && <p className="hint">O PC está vazio.</p>}
          </div>
          <div className="party-detail">
            {mon ? (
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
      )}
    </Modal>
  );
}

/** Painel fixo ao lado da run: treinador, dinheiro, time, mochila, PC e fraquezas. */
export function RunSidebar({onOpen}: {onOpen: (tab: PartyTab, mon?: string) => void}) {
  const {run, trainer} = useGame();
  if (!run) return null;
  const bagCount = Object.values(run.bag).reduce((a, n) => a + n, 0);
  return (
    <aside className="run-sidebar">
      <div className="panel sb-head">
        {trainer && <TrainerAvatar avatar={trainer.avatar} name={trainer.name} size={48} />}
        <div>
          <div className="trainer-name">{trainer?.name}</div>
          <div className="sb-money">₽ {run.money}</div>
          <div className="muted">
            Ronda {run.wave}/{STAGE_LENGTH} · {getBiome(run.biome).name}
          </div>
        </div>
      </div>
      <div className="panel sb-team">
        <h3>Time</h3>
        {run.party.map((m, i) => (
          <button key={m.uid} className={`sb-mon ${m.hp <= 0 ? 'fainted' : ''}`} onClick={() => onOpen('party', m.uid)}>
            <Sprite name={m.species} shiny={m.shiny} size={40} still />
            <span className="sb-mon-info">
              <span className="sb-mon-name">
                {i === 0 && <PixelIcon name="star" color="#e0a100" size={10} />} <MonName mon={m} /> <span className="muted">Nv.{m.level}</span>
                {m.item && <ItemIcon id={m.item} size={18} />}
              </span>
              <HpBar hp={m.hp} maxhp={calcStats(m).hp} />
            </span>
          </button>
        ))}
      </div>
      {run.egg && (
        <div className="panel sb-egg" title="Choca depois de rondas vencidas">
          <EggInfo egg={run.egg} left={run.egg.left} />
        </div>
      )}
      <div className="sb-buttons">
        <button className="btn" onClick={() => onOpen('bag')}>
          <ItemIcon id="pokeball" size={24} /> Mochila · {bagCount}
        </button>
        <button className="btn" onClick={() => onOpen('box')}>
          <PixelIcon name="home" /> PC · {run.box.length}
        </button>
      </div>
      <div className="panel sb-weak">
        <h3>Fraquezas do time</h3>
        <TeamWeakness party={run.party} compact />
        <button className="btn small ghost" onClick={() => onOpen('weak')}>
          Ver tabela completa
        </button>
      </div>
    </aside>
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
          <MonName mon={mon} /> Nv.{mon.level} {mon.item && <ItemIcon id={mon.item} size={18} />}
        </span>
        <HpBar hp={mon.hp} maxhp={max} showNumbers />
      </span>
    </button>
  );
}

export function MonDetail({mon, actions}: {mon: OwnedMon; actions?: React.ReactNode}) {
  const [info, setInfo] = useState<string | null>(null);
  const [rename, setRename] = useState<string | null>(null);
  const renameMon = useGame(g => g.renameMon);
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
            <MonName mon={mon} /> <span className="lv">Nv. {mon.level}</span>
          </h3>
          {rename !== null ? (
            <form
              className="rename"
              onSubmit={e => {
                e.preventDefault();
                renameMon(mon.uid, rename);
                setRename(null);
              }}
            >
              <input value={rename} maxLength={NICK_MAX} onChange={e => setRename(e.target.value)} placeholder={s.name} autoFocus />
              <button className="btn small" type="submit">
                Salvar
              </button>
            </form>
          ) : (
            <button className="btn small ghost" onClick={() => setRename(mon.nickname ?? '')}>
              ✎ {mon.nickname ? 'Trocar apelido' : 'Dar apelido'}
            </button>
          )}
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
            <button key={m} className="move-chip" onClick={() => setInfo(m)} title="Ver detalhes do golpe">
              <span className="row">
                <TypeBadge type={mv.type} small /> {mv.name}
                <span className="muted"> · {mv.category === 'Physical' ? 'Físico' : mv.category === 'Special' ? 'Especial' : 'Status'}</span>
                {mv.basePower > 0 && <span className="muted"> · Poder {mv.basePower}</span>}
                <span className="move-info-btn">?</span>
              </span>
              <span className="move-desc">{moveDescPt(m)}</span>
            </button>
          );
        })}
      </div>
      {info && <MoveInfo move={info} onClose={() => setInfo(null)} />}
      <div className="row wrap top">
        <StatsTable mon={mon} />
        <MatchupPanel types={s.types} title="Fraquezas e resistências" />
      </div>
    </div>
  );
}

export function PendingModal() {
  const {run, resolvePending} = useGame();
  const [info, setInfo] = useState<string | null>(null);
  const ev = run?.pending[0];
  const mon = ev && (run.party.find(m => m.uid === ev.uid) ?? run.box.find(m => m.uid === ev.uid));
  useEffect(() => {
    if (ev && !mon) resolvePending(null);
  }, [ev, mon, resolvePending]);
  if (!run || !ev || !mon) return null;
  if (ev.kind === 'evolve') {
    return (
      <Modal>
        <h2>O quê? {displayName(mon)} está evoluindo!</h2>
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
        {displayName(mon)} quer aprender {newMove.name}!
      </h2>
      <button className="move-chip big" onClick={() => setInfo(newMove.name)}>
        <span className="row">
          <TypeBadge type={newMove.type} /> {newMove.name} · Poder {newMove.basePower || '—'} ·{' '}
          {newMove.category === 'Physical' ? 'Físico' : newMove.category === 'Special' ? 'Especial' : 'Status'}
          <span className="move-info-btn">?</span>
        </span>
      </button>
      <p className="muted">{moveDescPt(newMove.name)}</p>
      <p>Qual golpe esquecer?</p>
      <div className="list-actions">
        {mon.moves.map((m, i) => {
          const mv = dex.moves.get(m);
          return (
            <button key={m} className="btn item-btn" onClick={() => resolvePending(i)} title={moveDescPt(m)}>
              <TypeBadge type={mv.type} small /> {mv.name} ({mv.basePower || '—'}) <span className="muted small-desc">{moveDescPt(m)}</span>
            </button>
          );
        })}
        <button className="btn small" onClick={() => resolvePending(null)}>
          Não aprender
        </button>
      </div>
      {info && <MoveInfo move={info} onClose={() => setInfo(null)} />}
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
              <MonName mon={m} /> Nv.{m.level}
            </span>
          </div>
        ))}
      </div>
      <p className="muted">
        Derrotados: {run.stats.defeated} · Capturados: {run.stats.caught} · Fugas: {run.stats.fled}
      </p>
      <p className="glory-earned">
        <PixelIcon name="trophy" color="#e0a100" /> +{run.gloryEarned ?? gloryFor(run.wave, kind === 'stageClear' ? 'stageClear' : 'lost')} de Glória para
        gastar em melhorias gerais
      </p>
      <button className="btn primary" onClick={abandonRun}>
        Voltar ao início
      </button>
    </div>
  );
}
