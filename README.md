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

- **Inicial de qualquer geração** (1 a 9, incluindo formas regionais), com busca,
  status base e fraquezas.
- **20 biomas**, cada um com seus tipos de Pokémon. Troca de bioma a cada 5 rondas
  (ou depois de usar um **Mapa**).
- **30 rondas** de batalhas selvagens. Chefes nas rondas 10 e 20, e um lendário na
  ronda 30 (o lugar onde, na etapa 3, entra o duelo contra outro jogador).
- **Raridades**: comum, incomum, raro, super raro (pseudo-lendários, Ultra Beasts,
  paradoxos) e lendário/mítico. Shiny 1/256.
- **Batalhas reais do Showdown**: golpes, habilidades, itens de segurar, clima,
  status, tudo funcionando como no Showdown.
- **Captura** com Poké/Great/Ultra/Master Ball (chance depende de HP, status e raridade).
- **Itens a cada ronda** (escolha 1 de 3, sortear de novo, loja com dinheiro):
  poções, reviver, Doce Raro, Pedra da Evolução, Disco Técnico, Incenso Raro e
  itens de segurar (Restos, Choice Band, Life Orb...).
- **XP, níveis, golpes novos e evolução** (por nível, e por pedra/troca/amizade via
  Pedra da Evolução).
- **Tudo mastigado**: tipos sempre visíveis, fraquezas do selvagem na tela, painel
  completo de fraquezas/resistências e cada golpe mostrando se é super efetivo,
  pouco efetivo ou sem efeito. Na troca, mostra quem resiste ao selvagem.
- **Sons**: grito original de cada Pokémon e efeitos de golpe por tipo (botão 🔊).
- **Coleção** permanente: repetidos melhoram os IVs, e o inicial começa com os
  melhores IVs da linha evolutiva.
- Run salva automaticamente no navegador (dá pra fechar e continuar).

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) para a organização do código e o
plano das etapas 2 e 3.

## Créditos

Dados e simulador: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown)
via [`@pkmn/sim`](https://github.com/pkmn/ps). Sprites e gritos: Pokémon Showdown e
[PokéAPI](https://github.com/PokeAPI/sprites). Pokémon é marca da Nintendo / Game
Freak / The Pokémon Company; este é um projeto de fã sem fins lucrativos.
