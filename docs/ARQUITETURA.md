# Arquitetura

Vite + React + TypeScript + zustand. O jogo inteiro roda no navegador: as batalhas usam o
simulador do Pokémon Showdown (`@pkmn/sim`) direto no aparelho. Não existe servidor próprio;
a parte online usa o Firestore do Firebase pela API REST (sem SDK), com login anônimo.

```
src/
  main.tsx       ponto de entrada (tema, dicas de toque, envio da lista de jogadores e o App)
  data/          dados estáticos (sem regra de jogo)
  game/          regras (TypeScript puro, sem React)
  ui/            telas, componentes, animações, sons e CSS
tests/           testes (vitest) que rodam as regras e batalhas completas sem UI
public/          fundos e efeitos (fx), sons (sfx) e insígnias (badges)
docs/            este arquivo, ideias, plano das regiões e passo a passo do Firebase
firestore.rules  regras do banco (colar no console do Firebase, ver SEGURANCA-ONLINE.md)
```

## `src/data` — dados

| Arquivo | O que tem |
| --- | --- |
| `dex.ts` | Acesso aos dados do Showdown (todas as gerações): espécies jogáveis, golpes por nível, tipos e fraquezas, raridade, sprites |
| `items.ts` | Itens do jogo (pokébolas, cura, itens X, mentas, itens de segurar reais do Showdown) |
| `movesPt.ts`, `movesPtDict.ts` | Descrições dos golpes em português (nomes ficam em inglês) |
| `biomes.ts`, `regions.ts` | Biomas (pools por raridade, fundo) e as 9 regiões (geração, formas regionais) |
| `gyms.ts`, `gymTalk.ts` | Ginásios de cada região (líder, tipo, insígnia, time) e as falas dos líderes |
| `legends.ts`, `rivals.ts` | Treinadores lendários e rivais conhecidos de cada região |
| `hints.ts` | Dicas enigmáticas dos viajantes sobre lendários |
| `trainerSprites.ts` | Lista dos sprites oficiais de treinador do Showdown (avatares) |
| `firebase.ts` | Configuração pública do Firebase (vazia = online desligado) |

## `src/game` — regras

**Base**

| Arquivo | O que faz |
| --- | --- |
| `types.ts` | Modelos salvos (`OwnedMon`, `RunState`, `Phase`...). Tudo serializável em JSON |
| `store.ts` | Estado global (zustand). Toda regra da run passa por aqui; a UI só chama ações |
| `mon.ts` | Criação de Pokémon, status, XP, evolução, `stageAt` e conversão para o time do Showdown |
| `battle.ts` | `BattleController`: monta a batalha no `@pkmn/sim`, escolhas do computador, captura, itens, mega e tradução do log para `BattleEvent`s em PT-BR |
| `rng.ts` | Sorteios (`randInt`, `chance`, `weightedPick`) |
| `trainers.ts` | Perfis de treinador (até 3 solo + os de carreira online), cada um com coleção e run próprias |
| `look.ts` | Visual de treinador personalizado em pixel art (`avatar: "custom:..."`) |

**Run solo (temporada)**

| Arquivo | O que faz |
| --- | --- |
| `encounters.ts` | Selvagens por ronda/bioma/região; `SEASON_LENGTH` (120) e rondas de torneio |
| `rewards.ts` | Recompensas da ronda, loja e dinheiro |
| `events.ts`, `travelers.ts` | Eventos entre rondas e viajantes (dicas de lendários) |
| `gym.ts`, `legend.ts` | Ginásios (ingresso, ronda marcada, insígnias) e o Rastro da lenda |
| `tournament.ts`, `narration.ts` | Torneios da temporada (chave de 8, bot x bot simulado de verdade) e o narrador |
| `league.ts`, `achievements.ts` | Pontos de fama, ranking e conquistas |
| `lead.ts` | "Quer trocar o Pokémon?" antes da luta, comparando tipos |
| `guide.ts` | Guia dos biomas: mesmas contas do sorteio de selvagens, então o guia nunca mente |

**Progresso entre runs**

| Arquivo | O que faz |
| --- | --- |
| `meta.ts` | Coleção: ficha por linha evolutiva (IVs, natures, habilidades, doces, corações, EVs, golpe inicial), custo de time |
| `daycare.ts` | Creche: ovos de dois pais da coleção |
| `glory.ts` | Glória e as melhorias permanentes |
| `history.ts` | Histórico de partidas por treinador (`rtg-history-<id>`): últimas 60 partidas e totais por modo que nunca se perdem |
| `profile.ts` | Perfil público de qualquer treinador (sem golpes, IVs ou natures) |

**Quickplay e Dream Team**

| Arquivo | O que faz |
| --- | --- |
| `rush.ts` | Rush: 8 modos (`RUSH_MODES`), sorteio dos pares, Tiro de sorte, Mega Pedra coringa e as funções de duelo entre dois jogadores |
| `sets.ts` | Sets "de Showdown" (golpes, nature, habilidade e EVs bons) para Quickplay e bots |
| `builder.ts` | Dream Team: montar e validar times (nível 50, IVs perfeitos), até 5 por treinador (`rtg-teams-<id>`) |

**Online**

| Arquivo | O que faz |
| --- | --- |
| `cloud.ts` | Firestore pela REST, login anônimo (`cloudId`), cache. Cada documento guarda um campo `json`. Com `?net=local` vira um banco falso no localStorage, para testes |
| `net.ts` | Ligação entre dois aparelhos (Rush, Dream Team, campeonato rápido e duelos da carreira): uma "caixa de correio" no Firestore que cada lado vai lendo |
| `career.ts` | Carreira online: regras do host, código, entrada dos amigos, rondas sincronizadas |
| `world.ts` | Mundo da temporada: os bots jogam junto, ronda a ronda, e tudo vira estatística e jornal. Na carreira fica na nuvem |
| `scout.ts` | Estudo do adversário com névoa (só o que é público ou o que você viu) |
| `wipe.ts` | Perder o time inteiro na carreira online não acaba a temporada, mas custa níveis, itens, dinheiro e pontos |
| `players.ts` | Lista de jogadores: resumo do histórico online de cada um, gravado no fim de cada partida online |

## `src/ui` — interface

- `App.tsx`: escolhe a tela pelo `screen` do store (menus) ou pela `run.phase` (dentro da run), e
  monta a barra de cima (Guia, Ajuda, som, animações rápidas, tema).
- `components.tsx`: peças reutilizadas (sprite, tipos, HP, fraquezas, calculadora de tipos,
  `MoveInfo`, modal, ícones em pixel).
- `scene.tsx`: plateia, falas em linha, arenas das lendas e interior dos ginásios.
- `fx.ts` + `moveStyle.ts` + `audio.ts`: animações de golpe em partículas pixeladas num canvas,
  classificação de cada golpe num "formato" e sons (gritos + efeitos CC0, sintetizador de reserva).
- `settings.ts`: preferências no navegador (som, pular animações, perguntar antes da luta, tema
  claro/escuro). O tema escuro fica em `theme-dark.css`.
- `leaveGuard.ts`: sair no meio de uma partida conta como derrota (Rush, Dream Team e campeonato
  rápido; carreira e run ficam de fora).
- `Tutorial.tsx`, `tutorialTours.ts`, `tutorialState.ts`: tutorial guiado com destaque passo a
  passo. Botões sem classe única ganham `data-tut="..."`.
- `touchTips.ts`: no celular, as dicas de hover (`title`) aparecem ao tocar.
- `screens/`: uma tela (ou grupo de telas) por arquivo. As maiores:
  - run: `StartScreens`, `BattleScreen`, `RunScreens` (recompensa, painel, viagem, fim), `EventScreen`,
    `GymScreens`, `LegendScreens`, `TournamentScreen`, `ChampionScreen`, `BiomeGuide`;
  - fora da run: `CollectionScreen`, `DaycareScreen`, `GloryScreen`, `LeagueScreens`,
    `HistoryScreens`, `PlayersScreen`, `ProfileModal`, `HelpModal`;
  - multiplayer: `QuickplayScreen` (Rush e campeonato rápido offline, e a batalha de dois
    jogadores), `OnlineRush`, `QuickTourOnline`, `BuilderScreen`, `OnlineBuilt`, `CareerScreen`,
    `CareerDuel`.

## Como a batalha funciona

`BattleController` cria uma `Battle` do Showdown (formato `gen9customgame`). Na run, o time vivo
do jogador enfrenta um selvagem (às vezes dois, em dupla), um treinador, um líder ou uma lenda; o
HP atual do time é aplicado antes de começar. O adversário do computador escolhe o golpe com uma regra
simples que pesa poder, STAB e efetividade. O log do Showdown vira `BattleEvent`s e a UI anima
mensagem por mensagem. Pokébola e poções gastam o turno com um golpe invisível de prioridade +7
(`Ação do Treinador`), já que o Showdown não tem essas ações.

Entre dois jogadores (`rush.ts`: `duelRequest`, `duelChoose`), quem cria a sala é o "dono": roda o
sorteio e a batalha no próprio aparelho e manda os eventos para o amigo por `net.ts`; o amigo só
mostra e manda as escolhas dele.

## Onde os dados ficam

**No navegador (localStorage)**, por isso cada aparelho tem o próprio save:

| Chave | Conteúdo |
| --- | --- |
| `rtg-trainers` | Perfis de treinador |
| `rtg-collection-<id>`, `rtg-run-<id>` | Coleção e run de cada treinador |
| `rtg-history-<id>`, `rtg-teams-<id>` | Histórico de partidas e times do Dream Team |
| `rtg-sound`, `rtg-fast`, `rtg-theme`, `rtg-ask-lead`, `rtg-tutorial` | Preferências e tutorial |
| `rtg-device`, `rtg-auth` | Identidade do aparelho e login anônimo do Firebase |

**No Firestore** (só quem joga online), tudo dentro de `careers/`: o documento da carreira e as
pastas `players`, `matches`, `world`, `tours`, `teams` e `msgs` (caixa de correio das partidas ao
vivo, em `careers/LINK-<código>/msgs`). A lista de jogadores fica em `careers/PLAYERS/players`.
As regras (`firestore.rules`) só deixam o dono de cada documento mudar o que é dele; detalhes em
[SEGURANCA-ONLINE.md](SEGURANCA-ONLINE.md).

## Testes e publicação

- `npm test` roda o vitest (`tests/`): batalhas completas, Rush, Dream Team, carreira, mundo,
  torneios, histórico, segurança e outros, todos sem UI.
- `npm run build` checa os tipos (`tsc --noEmit`) e gera o site.
- `.github/workflows/ci.yml` roda os dois em todo PR; `deploy.yml` publica no GitHub Pages a cada
  push na `main`.

## Onde mexer para coisas comuns

- **Nova regra da run**: ação nova em `store.ts`, com a conta num arquivo próprio em `src/game`
  (e um teste em `tests/`).
- **Novo campo salvo**: `types.ts`, sempre com padrão para saves antigos (como `entryOf()` em `meta.ts`).
- **Novo modo multiplayer**: reaproveite `net.ts` e as funções de duelo de `rush.ts`; grave o
  resultado com `recordMatch` (`history.ts`) e, se for online, ele entra sozinho na lista de jogadores.
- **Novo documento no Firestore**: ajuste `firestore.rules` (pastas permitidas) e avise para colar
  as regras de novo no console.
