# Pokémon Road to Glory

Roguelike de Pokémon no navegador, no estilo Pokerogue, com batalhas rodando no
simulador do Pokémon Showdown e modos online contra os amigos. Projeto de fã, sem
fins comerciais.

## Como jogar

É só abrir no navegador, no celular ou no computador, sem instalar nada:

**https://guilhermetevess.github.io/pokemon-road-to-glory/**

Na primeira vez o jogo oferece um tutorial com destaque em cada tela, e o botão
**Ajuda** explica rondas e itens. A run é salva automaticamente no navegador, então
dá para fechar e continuar depois.

## Rodar no seu computador (para desenvolver)

Só precisa disto se for mexer no código. Para jogar, use o link acima.

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

Para publicar no GitHub Pages: em **Settings → Pages**, escolha **Source: GitHub
Actions**. Cada push na `main` gera o jogo e publica (workflow `deploy.yml`).

## Modos de jogo

- **Run solo**: uma temporada de 120 rondas com selvagens, chefes, ginásios, lendas, eventos e
  quatro torneios. Perder o time inteiro acaba a run.
- **Carreira online**: o host cria com regras (rondas por temporada, número de temporadas, limite de
  lendários e de nível, megas, bônus de EXP) e até 8 amigos entram com um código. Cada um joga a
  própria run no seu tempo; as rondas andam juntas e os torneios usam os times reais de todo mundo,
  com partidas ao vivo entre jogadores. Os rivais (bots) jogam a mesma temporada, e tudo vira
  ranking, perfil e jornal. Perder para selvagens não acaba a temporada: custa níveis, itens,
  dinheiro e pontos.
- **Quickplay**: partidas rápidas, online (cada um no seu aparelho) ou offline (contra o computador
  ou um amigo no mesmo aparelho).
  - **Rush**: aparecem 2 Pokémon sorteados, quem está na vez fica com um e o outro vai para o
    adversário, até cada um ter 6. Nove modos: Clássico Nv. 50, Evo 1, Evo 2, Evo 3, Mega,
    Lendários, Misturado, Tiro de sorte e Espelho (o escolhido entra nos dois times, que terminam iguais).
  - **Escadinha**: lutas de 1 Pokémon contra 1, contra o computador ou um amigo no mesmo aparelho.
    Cada um tem uma escada de 8 Pokémon que vai piorando (lendário no topo, filhote no fim): quem
    vence desce um degrau e ganha quem vencer com o último.
  - **Campeonato rápido**: chave com os amigos (até 8) e bots completando as vagas.
- **Dream Team**: monte até 5 times com Pokémon, habilidade, nature, EVs, golpes e item (todos no
  nível 50 com IVs perfeitos) e jogue contra o computador, contra os times dos amigos ou online.

Sair no meio de uma partida de Rush, Escadinha, Dream Team ou campeonato rápido conta como derrota.

## O que tem na run

- **Treinadores**: até 3 perfis, cada um com nome, avatar (oficial ou montado em pixel art),
  coleção e run próprios. Na primeira run só os iniciais clássicos; depois, a coleção daquele treinador.
- **Time inicial com pontos**: cada linha tem um custo pela força (Pidgey 1, Charmander 3,
  Dratini 7) e o treinador tem 6 pontos (até 10 com Glória), então dá para começar com mais de um.
- **9 regiões** (Kanto a Paldea). Você escolhe a primeira e fica 20 rondas; depois a próxima é
  sorteada. Pokémon da geração da região aparecem 3x mais, formas regionais só na região delas.
- **20 biomas**, novo a cada 10 rondas, e um **bioma oculto** por região (Caverna Celeste, Torre
  do Céu, Área Zero...). Na loja: Mapa de Bioma, Mapa de Região e Passes que dobram a estadia.
  O **Guia** (barra de cima) mostra quem aparece em cada bioma e com que chance.
- **Raridades**: comum, incomum, raro, super raro (pseudo-lendários, Ultra Beasts, paradoxos) e
  lendário/mítico. Shiny 1/256.
- **Batalhas reais do Showdown**: golpes, habilidades, itens de segurar, clima e status. Às vezes
  (5%) dois selvagens aparecem juntos e a luta é em dupla.
- **Captura** com Poké/Great/Ultra/Master Ball (chance depende de HP, status e raridade).
- **Itens a cada ronda** (escolha 1 de 3, sortear de novo, loja): poções, reviver, Doces Raros,
  Pedra da Evolução, Disco Técnico, Mentas, Cápsula de Habilidade, itens X, dinheiro e itens de
  segurar (Restos, Choice Band, Life Orb...).
- **XP, níveis, golpes novos e evolução** (por nível, pedra, troca ou amizade), com animação.
- **Mega evolução**: a Mega Pedra vira a pedra do Pokémon escolhido (1 por time) e você liga a
  mega no menu de golpes quando quiser.
- **Ginásios**: 8 por região com os líderes oficiais (em Alola, as 7 provas). Compre o ingresso e
  marque a ronda; o time do líder cresce com as suas insígnias. Perder não acaba a run.
- **Lendas**: treinadores lendários de cada região (Red, Lance, Steven, Cynthia, Leon...). O
  **Rastro da lenda** sobe vencendo chefes e ajudando nos eventos, e é a chance de ela te desafiar.
- **Viajantes e Diário**: ajude alguém e ganhe uma dica enigmática sobre um lendário, com onde procurar.
- **Eventos entre rondas**: casa abandonada, árvore de frutas, comerciante, rival, vidente,
  eventos do bioma e da vida de treinador. Não gastam ronda.
- **Torneios da temporada** nas rondas 30/60/90/120: League Cup, Regional, International e
  World Championship, com sorteio animado, chaveamento, narrador e festa de campeão.
- **Fama, Ranking e Conquistas**: pontos de torneios, lendas, insígnias e viajantes; ranking da
  temporada contra os rivais do circuito e ranking geral.

## Entre as runs

- **Coleção** com uma **ficha por linha evolutiva**: IVs (repetidos melhoram), natures e
  habilidades capturadas, **doces** (golpe inicial, custo menor, mais chance de shiny),
  **corações** de amizade (buffs pequenos), **Tutor**, **EVs** e **apelidos**. Um **parceiro** por time.
- **Creche**: dois Pokémon do mesmo egg group fazem um ovo que choca durante a run.
- **Glória**: moeda permanente ganha no fim de cada run, gasta em melhorias (orçamento do time,
  faro para raros e shiny, mais recompensas, descontos...).
- **Perfil e histórico**: vitórias, derrotas e % de vitória por modo (offline e online) e as
  últimas partidas com os times. A **lista de jogadores** mostra todo mundo que já jogou online,
  com o histórico de cada um.

## Para quem está começando

- **Tutorial** guiado na primeira vez em cada tela, e o botão **Ajuda** explicando rondas e itens.
- **Tudo mastigado**: tipos sempre visíveis, fraquezas do adversário na tela, calculadora de tipos,
  painel de fraquezas do time e cada golpe mostrando se é super efetivo, pouco efetivo ou sem efeito.
  Antes da luta, o jogo sugere quem começa.
- **Golpes com nome em inglês e descrição em português.**
- **Visual pixel art**, modo claro e escuro, fundos por bioma e animações de golpe em partículas
  por tipo. **Sons** de gritos e efeitos de golpe. Dá para pular animações e desligar o som.
- Tudo salvo automaticamente no navegador (dá para fechar e continuar). Cada aparelho tem o próprio save.

## Para desenvolver

- Organização do código: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
- Ligar o online no Firebase: [docs/SEGURANCA-ONLINE.md](docs/SEGURANCA-ONLINE.md).
- Ideias para as próximas etapas: [docs/IDEIAS.md](docs/IDEIAS.md).
- `npm test` roda os testes e `npm run build` checa os tipos e gera o site (os dois rodam em todo PR).

## Créditos

Fundos de batalha e sprites de efeito em `public/fx`: Pokémon Showdown client.
Efeitos sonoros em `public/sfx`: domínio público (CC0), da coleção
[CC0-Public-Domain-Sounds](https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds)
(detalhes em `public/sfx/CREDITS.txt`).
Dados e simulador: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown)
via [`@pkmn/sim`](https://github.com/pkmn/ps). Sprites e gritos: Pokémon Showdown e
[PokéAPI](https://github.com/PokeAPI/sprites). Pokémon é marca da Nintendo / Game
Freak / The Pokémon Company; este é um projeto de fã sem fins lucrativos.
