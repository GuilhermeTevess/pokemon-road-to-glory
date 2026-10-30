# Plano das próximas etapas

Ideias da Juliana (30/10/2026) organizadas em partes que dá pra construir uma de cada
vez. Primeiro a base (etapa 1) fica redonda; depois entram as partes abaixo, na ordem
sugerida. Nada aqui é definitivo: é o rascunho para a gente ajustar.

---

## Regra geral: o que é da coleção e o que é da natureza

**Pergunta:** se eu tenho um Gengar perfeito, o Gengar que eu pego na natureza já vem
perfeito também?

**Proposta: não.** A coleção guarda a "ficha" de cada linha evolutiva (melhores IVs,
natures e habilidades desbloqueadas, EVs treinados, golpes liberados, doces,
corações). Essa ficha vale **quando você começa com aquele Pokémon** (como inicial ou
no time da carreira).

O Pokémon que aparece na natureza durante a run vem **aleatório**, como hoje: nature,
habilidade e IVs sorteados, EVs zerados. Capturar ele **alimenta a ficha**:

- se a nature ou a habilidade dele é nova, ela fica desbloqueada na coleção;
- se algum IV é melhor, a ficha melhora (a teia de IVs que já existe);
- você ganha doces daquela linha.

Assim capturar continua tendo graça, e montar o Pokémon perfeito é um projeto que
cresce run a run, sem precisar caçar o mesmo bicho mil vezes.

---

## Parte A: coleção de verdade, doces e corações

A primeira parte, porque quase todo o resto depende dela.

### Tela da coleção
- Cabeçalho do treinador: avatar, nome e números (runs, capturas, etapas vencidas,
  dinheiro ganho, Pokémon favorito).
- Lista em grade com filtro por tipo (como hoje). Tocando num Pokémon abre a **ficha**:
  - sprite grande ao lado, com **setinhas para passar pela linha evolutiva**
    (Charmander → Charmeleon → Charizard);
  - doces da linha, barra de corações, IVs (teia), natures e habilidades
    desbloqueadas, EVs, golpes liberados;
  - botões para gastar doces (Partes A e B).
- Os iniciais da tela de escolha também ganham as setinhas de evolução.

### Doces
Cada linha evolutiva tem seus próprios doces.

| Como ganha | Quantos |
|---|---|
| Capturar | +3 (repetido +5) |
| Pokémon da linha derrota um selvagem | +1 |
| Derrotar um treinador ou chefe | +3 |
| Evoluir durante a run | +2 |

| Onde gasta | Exemplo |
|---|---|
| Liberar golpe inicial | Charmander começa já com Flamethrower (golpe de nível ou TM que ele aprende) |
| Baixar o custo do inicial | Ver "custo de time" abaixo |
| Planos do Tutor (Parte B) | Nature ou habilidade |
| Chance de shiny | Pequeno aumento por linha |

### Custo de time (começar com mais de um Pokémon)
- Cada espécie tem um **custo** pela força (BST): Pidgey 1, Charmander 3, Dragonite 7...
- O treinador tem um **orçamento** para montar o time inicial (começa em 10 e sobe
  com as melhorias gerais).
- Doces baixam o custo de uma linha (até um mínimo).

### Companheiro (corações)
- Cada linha tem uma barra de 5 corações que enche jogando com ela (batalhas vencidas,
  rondas no time).
- Buffs pequenos, no estilo da amizade dos jogos:
  - 1 coração: +5% de EXP;
  - 2: chance pequena de curar um status sozinho no fim do turno;
  - 3: chance pequena de aguentar com 1 HP um golpe que derrubaria;
  - 4: +1 de chance de crítico;
  - 5: +10% de EXP e um enfeite na ficha.
- O Pokémon com mais corações vira o **favorito** do perfil (ou você escolhe).

---

## Parte B: Tutor (natures e habilidades) e treino de EVs

### Tutor de natures e habilidades
Um treinador NPC que fica na coleção. Você escolhe a **nature que quer** e um plano:

| Plano | Preço | Chance de cair a escolhida |
|---|---|---|
| Básico | 10 doces | 35% |
| Avançado | 25 doces | 65% |
| Garantido | 50 doces | 100% |

- **Nunca cai repetida:** se não sair a escolhida, sai outra nature que você ainda
  **não** tem. Todo plano desbloqueia alguma coisa nova, então não frustra.
- Habilidades funcionam igual. A habilidade oculta só sai no plano Garantido e custa
  mais.
- Antes da run você equipa qualquer nature ou habilidade já desbloqueada.

### Treino de EVs
Seguindo como funciona nos jogos, mas sem planilha:
- Cada Pokémon derrotado dá **EVs de verdade** (os do jogo: Machop dá Ataque, Zubat dá
  Velocidade...). Eles vão para um **banco de EVs** da linha de quem lutou.
- Na ficha da coleção você **distribui** o banco nos atributos (máximo 252 por atributo
  e 510 no total, como nos jogos). Dá para resetar pagando doces.
- Itens que aceleram, todos reais:
  - **Itens Power** (Power Bracer, Power Belt...): de segurar na run, +8 EVs naquele
    atributo a cada vitória;
  - **Vitaminas** (Protein, Carbos...): recompensa ou loja, +10 EVs direto no banco.
- A ficha mostra uma barrinha por atributo e sugere distribuições comuns (ex.: "Rápido
  e forte: 252 Atq / 252 Vel").
- Os EVs ficam salvos na linha: toda vez que você começar com ela, ela vem treinada.

---

## Parte C: breeding, ovos e eventos

### Breeding (Creche)
- Dois Pokémon do mesmo **egg group** e gêneros opostos (ou um Ditto) fazem um ovo da
  espécie básica da mãe.
- Itens de verdade, cada um com explicação curta:
  - **Everstone**: o filhote herda a nature de quem segura;
  - **Destiny Knot**: herda 5 IVs dos pais em vez de 3;
  - **Itens Power**: garante herdar aquele IV específico;
  - golpes de ovo passam do pai.
- (Moon Stone e as outras pedras continuam sendo de evolução, não de breeding.)
- O ovo vai junto na run e choca depois de X rondas vencidas (comum 5, raro 10, muito
  raro 15), no estilo do Pokémon GO.
- **Manual do Criador**: uma página bem mastigada, com desenhos, explicando egg group,
  Ditto e cada item.

### Eventos na run
Entre as rondas, de vez em quando, aparece um evento em vez de batalha:
- **Casa abandonada**: um Pokémon sozinho lá dentro. Você pode cuidar dele (entra no
  time com corações já cheios) ou deixar uma fruta.
- **Árvore de frutas**: escolha uma fruta para o time.
- **Comerciante misterioso**: troca um item por outro mais raro, ou um Pokémon por outro.
- **Pokémon machucado**: gastar uma poção para curar e ele vira amigo (captura grátis).
- **Treinador rival**: batalha opcional com prêmio maior.
- **Vidente**: mostra os tipos dos próximos selvagens.

### Mega evolução
- Mega Pedra é um item de segurar raro (depois da ronda 20, ou bem cara na loja).
- O Pokémon mega-evolui sozinho no início de cada batalha e volta ao normal no fim.
- Só 1 mega por time.

---

## Parte D: melhorias gerais (o lado roguelike)

Uma moeda permanente, **Glória**, ganha no fim de cada run (mais quanto mais longe
chegar). Gasta numa árvore de melhorias:
- mais chance de raros e de shiny;
- mais opções de bioma na hora de viajar (2 → 3 → 4);
- mais uma opção de recompensa por ronda (3 → 4);
- começar com mais dinheiro ou mais Poké Balls;
- orçamento maior para o time inicial;
- descontos na loja e no "sortear de novo".

---

## Parte E: modo carreira online (etapa 3)

### Separar os modos
- **Run (offline)**: o roguelike de hoje. A run reseta; a coleção fica.
- **Carreira (online)**: um save compartilhado entre amigos, que **não reseta**. Seu
  time e sua coleção evoluem ao longo de **temporadas**. Breeding, treino e Tutor são
  feitos entre um evento e outro.

### Como os turnos funcionam
- Um amigo cria a **liga** e os outros entram com seus treinadores.
- O calendário anda em **semanas de jogo**. Em cada semana, cada jogador escolhe o que
  fazer: treinar, capturar (uma mini-run), desafiar um ginásio ou jogar um torneio.
- A semana só avança quando todo mundo confirmou (ou quando acaba o prazo que o dono
  da liga definiu). Precisa de um servidor simples e gratuito (ex.: Supabase).

### Ginásios e campeonatos
**Proposta:** dois caminhos que se cruzam, como nos jogos e no VGC de verdade.

1. **Caminho da Liga**: 8 ginásios em qualquer ordem, depois a Liga Pokémon (Elite 4 e
   Campeão). Dá fama e prêmios.
2. **Caminho do Circuito (VGC)**: regionais e internacionais dão **Championship
   Points**. Os melhores da temporada vão para o **Mundial**.

As insígnias **não são obrigatórias** para o Mundial. Elas destravam coisas úteis: mais
espaço no PC, níveis mais altos, lojas melhores e convites para torneios maiores. Quem
só quer competir pode focar no Circuito, e quem gosta de aventura faz a Liga.

### Clima de campeonato
- Chaveamento sorteado na hora, com animação.
- Narração das batalhas ("Que golpe crítico!"), arena especial e público.
- Quando um amigo não está online, um bot com o time dele joga no lugar.

### Carreira e fama
- Página do treinador com títulos, insígnias, troféus, recordes e Pokémon favorito.
- **Ranking** dos maiores treinadores da liga.
- **Notícias** geradas pelo jogo ("Ju vence o Regional de São Paulo com um Gengar
  shiny!").
- Objetivos que o jogador escolhe no começo da temporada ("ganhar 3 insígnias", "top 8
  no Mundial"), com recompensa ao cumprir.

---

## Ordem sugerida

1. **Parte A**: coleção, doces, corações, golpe inicial e custo de time. É a base de
   tudo.
2. **Parte B**: Tutor e EVs.
3. **Parte C**: breeding, ovos, eventos e megas.
4. **Parte D**: melhorias gerais.
5. **Parte E**: carreira online.

---

## Já feito das ideias anteriores
- **Parte A** inteira: ficha da coleção com setinhas, doces, corações, golpe inicial,
  custo de time, chance de shiny, nature/habilidade já capturadas para começar.
- Teia de IVs ao capturar repetido.
- Treinadores separados (até 3), cada um com a própria coleção.

## Ainda para encaixar
- Editor de treinador em pixel art: tom de pele, cabelo, roupa e cores, por camadas.
  Aparece no perfil e nos duelos.
