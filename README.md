# Pokémon Road to Glory

Roguelike de Pokémon no navegador, no estilo Pokerogue, com batalhas rodando no
simulador do Pokémon Showdown. Projeto de fã, sem fins comerciais, feito para
jogar com os amigos.

## Como jogar

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

Para publicar no GitHub Pages: em **Settings → Pages**, escolha **Source: GitHub
Actions**. Cada push na `main` gera o jogo e publica (workflow `deploy.yml`).

## O que já tem (etapa 1)

- **Treinadores**: até 3 perfis, cada um com nome, avatar, coleção e run próprios.
  Na primeira run só os iniciais clássicos; depois, a coleção daquele treinador.
- **Time inicial com pontos**: os 3 iniciais de cada geração (1 a 9) numa página
  só, com filtro por tipo e setinhas para ver as evoluções. Cada linha tem um custo
  pela força (Pidgey 1, Charmander 3, Dratini 7) e o treinador tem 6 pontos, então
  dá para começar com mais de um. Capturados ficam numa aba separada.
- **20 biomas**, cada um com seus tipos de Pokémon. Troca de bioma a cada 5 rondas
  (ou depois de usar um **Mapa**).
- **30 rondas** de batalhas selvagens. Chefes nas rondas 10 e 20, e um lendário na
  ronda 30 (o lugar onde, na etapa 3, entra o duelo contra outro jogador).
- **Raridades**: comum, incomum, raro, super raro (pseudo-lendários, Ultra Beasts,
  paradoxos) e lendário/mítico. Shiny 1/256.
- **Batalhas reais do Showdown**: golpes, habilidades, itens de segurar, clima,
  status, tudo funcionando como no Showdown.
- **Captura** com Poké/Great/Ultra/Master Ball (chance depende de HP, status e raridade).
- **Itens a cada ronda** (escolha 1 de 3, sortear de novo, loja por prateleiras):
  poções, reviver, Doces Raros e de EXP, Pedra da Evolução, Disco Técnico, Mentas
  (natureza), Cápsula de Habilidade, itens X para a batalha, Bolsa/Pepitas (o cartão
  mostra quanto dinheiro dá), Incenso Raro e itens de segurar (Restos, Choice Band,
  Life Orb, Carvão e os outros 17 que fortalecem um tipo...). Dá para usar ou
  equipar o item na hora em que pega.
- **Painel lateral** durante a run: time, Mochila, PC e fraquezas do time (com aviso
  dos tipos que pegam metade do time sem ninguém resistir).
- **XP, níveis, golpes novos e evolução** (por nível, e por pedra/troca/amizade via
  Pedra da Evolução).
- **Tudo mastigado**: tipos sempre visíveis, fraquezas do selvagem na tela, painel
  completo de fraquezas/resistências e cada golpe mostrando se é super efetivo,
  pouco efetivo ou sem efeito. Na troca, mostra quem resiste ao selvagem.
- **Visual pixel art** em cores claras, com fundos de batalha por bioma e animações
  de golpe em partículas pixeladas por tipo e formato (fogo que sobe e vira fumaça,
  jato d'água, raios, gelo, folhas, terremoto...).
- **Sons**: gritos modernos de cada Pokémon e efeitos de golpe gravados de verdade
  (fogo, água, trovão, "zoom" de velocidade, buffs...), por tipo e formato.
- **Golpes com nome em inglês e descrição em português.**
- **Ajuda** dentro do jogo explicando rondas e itens.
- **Coleção** permanente com o perfil do treinador (números e Pokémon favorito) e uma
  **ficha por linha evolutiva**: setinhas pela evolução, teia de IVs (repetidos
  melhoram), natures e habilidades já capturadas (escolha qual usar no início),
  **doces** da linha (capturar, vencer, chefe, evoluir) e **corações de amizade**.
- **Doces** compram golpe inicial (ex.: Charmander começando com Flamethrower),
  custo menor no time e mais chance de shiny.
- **Tutor** na ficha: escolha a nature ou habilidade e um plano (quanto mais doces,
  mais chance); se não sair, ganha outra que ainda não tem.
- **EVs** por linha: vitórias enchem um banco que você distribui na ficha, com
  sugestões prontas. Vitaminas e itens Power ajudam.
- **Parceiro** (um por time) e **apelidos**.
- **Corações** (até 5) dão buffs pequenos: +5% de EXP, curar status sozinho, aguentar
  com 1 HP, mais crítico e +10% de EXP.
- Run salva automaticamente no navegador (dá pra fechar e continuar).

Ideias para as próximas etapas: [docs/IDEIAS.md](docs/IDEIAS.md).

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) para a organização do código e o
plano das etapas 2 e 3.

## Créditos

Fundos de batalha e sprites de efeito em `public/fx`: Pokémon Showdown client.
Efeitos sonoros em `public/sfx`: domínio público (CC0), da coleção
[CC0-Public-Domain-Sounds](https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds)
(detalhes em `public/sfx/CREDITS.txt`).
Dados e simulador: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown)
via [`@pkmn/sim`](https://github.com/pkmn/ps). Sprites e gritos: Pokémon Showdown e
[PokéAPI](https://github.com/PokeAPI/sprites). Pokémon é marca da Nintendo / Game
Freak / The Pokémon Company; este é um projeto de fã sem fins lucrativos.
