# Arquitetura

Vite + React + TypeScript, tudo no navegador (sem servidor por enquanto).

```
src/
  data/        dados estáticos
    dex.ts       espécies jogáveis, golpes por nível, tipos/fraquezas, sprites
    biomes.ts    biomas e pools de Pokémon por raridade
    items.ts     itens (pokébolas, cura, itens X, mentas, itens de segurar do Showdown...)
    movesPt.ts   descrições dos golpes em português (modelos + movesPtDict.ts)
  game/        regras (sem React)
    types.ts     modelos salvos no localStorage (OwnedMon, RunState)
    mon.ts       criação de Pokémon, status, XP, evolução, conversão p/ time do Showdown
    encounters.ts geração dos selvagens por ronda/bioma; constantes da etapa
    battle.ts    BattleController: monta a batalha no @pkmn/sim, IA do selvagem,
                 captura, itens em batalha, tradução do log para eventos em PT-BR
    rewards.ts   recompensas, loja, dinheiro
    meta.ts      coleção permanente: ficha por linha, doces, corações, custo de time
    trainers.ts  perfis de treinador; cada um tem coleção e run próprias no localStorage
    store.ts     estado global (zustand): todas as ações da run
  ui/          telas e componentes React, CSS
    audio.ts     gritos + sons de golpe (amostras CC0 em public/sfx, sintetizador de reserva)
    fx.ts        animações de golpe: partículas pixeladas num canvas por cima da arena
tests/         testes (vitest) que rodam batalhas completas sem UI
```

## Como a batalha funciona

`BattleController` cria uma `Battle` do Showdown (formato `gen9customgame`) com o
time vivo do jogador contra 1 selvagem. O HP atual do time é aplicado antes da
batalha começar. A cada ação, o selvagem escolhe o golpe (IA simples que pesa poder,
STAB e efetividade), o log do Showdown é traduzido em `BattleEvent`s e a UI anima
mensagem por mensagem. Pokébola e poções gastam o turno usando um golpe invisível
de prioridade +7 (`Ação do Treinador`), já que o Showdown não tem essas ações.

## Etapa 2 (meta-progressão) — onde encaixar

- **Ficha da linha** (Parte A, feita): `CollectionEntry` em `meta.ts` guarda doces,
  pontos de amizade, natures/habilidades vistas, golpes liberados e melhorias. Use
  `entryOf()` para ler com padrões (saves antigos não têm os campos novos). Os ganhos
  ficam em `finishBattle`/`resolvePending`/`endRun` (`store.ts`); os buffs de
  corações são handlers `onEvent` no `BattleController` (`addFriendship`).
- **IVs com repetidos**: já existe (`registerCatch`). Dá pra trocar a regra lá.
- **EVs antes da run**: `OwnedMon.evs` já existe e já vai para o Showdown. Falta uma
  tela entre o inicial e o bioma para distribuir (usando doces, por exemplo).
- **Breeding / inventário de repetidos**: guardar `OwnedMon`s na `Collection`
  (hoje guarda só o melhor IV por linha) e criar a tela de breeding.
- **Vender para NPCs**: ação nova no `store.ts` que remove da caixa e soma `money`.

## Etapa 3 (PvP e campeonato) — onde encaixar

- `isMilestoneWave()` em `encounters.ts` marca as rondas 30, 60, 90...
  Hoje gera um chefe lendário; no PvP, a fase `battle` dessas rondas vira um duelo.
- O `BattleController` já fala com o Showdown por `choose('p1'| 'p2', ...)`. Para
  PvP, o lado `p2` passa a receber as escolhas do outro jogador em vez da IA. O
  caminho mais simples é um servidor pequeno (WebSocket) rodando o mesmo `@pkmn/sim`
  e repassando as escolhas, ou usar a `BattleStream` do Showdown.
- `STAGE_LENGTH` controla quando a etapa termina; o campeonato (120/150) entra como
  uma fase nova em `Phase`.
