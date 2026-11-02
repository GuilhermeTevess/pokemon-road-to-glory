// Conteúdo do tutorial: uma "parte" para cada tela/modo do jogo.
// Cada parte começa sozinha na primeira vez que a pessoa chega na tela (quando o seletor `when`
// aparece) e destaca, passo a passo, os botões que importam. Passos cujo botão não está na tela
// naquele momento são pulados (por exemplo, o painel lateral escondido no celular).

export interface TutorialStep {
  /** Elemento destacado. Uma lista tenta cada seletor em ordem (o primeiro visível ganha). Sem seletor: cartão no meio da tela. */
  sel?: string | string[];
  title: string;
  text: string;
}

export interface TutorialTour {
  id: string;
  /** A parte começa quando este elemento está visível na tela. */
  when: string;
  /** Pode aparecer com uma janela (modal) aberta. As outras esperam a janela fechar. */
  modal?: boolean;
  steps: TutorialStep[];
}

export const TOURS: TutorialTour[] = [
  // ---------- Início
  {
    id: 'trainers',
    when: '.trainer-screen',
    steps: [
      {
        title: 'Bem-vindo, treinador!',
        text: 'Este tutorial mostra o que cada botão faz. Ele aparece aos pouquinhos, sempre que você entrar numa tela nova. Se quiser parar, toque em "Pular tutorial".',
      },
      {
        sel: ['.trainer-screen .trainer-new', '.trainer-slots'],
        title: 'Quem vai jogar?',
        text: 'Primeiro crie o seu treinador: escolha um nome e um visual. Cada treinador tem a sua própria coleção de Pokémon e a sua própria run.',
      },
      {
        sel: '.trainer-screen .career-strip',
        title: 'Jogar com os amigos',
        text: 'Para jogar online com os amigos, use a Carreira: uma pessoa cria e passa o código para os outros.',
      },
    ],
  },
  {
    id: 'title',
    when: '.title-screen .menu',
    steps: [
      {
        title: 'Bem-vindo ao Road to Glory!',
        text: 'Vou mostrar os modos de jogo. Dá para pular a qualquer momento no botão "Pular tutorial".',
      },
      {
        sel: '.title-screen .menu .big-play',
        title: 'Run (modo principal)',
        text: 'Você monta um time pequeno, viaja por regiões e enfrenta um Pokémon selvagem por ronda. Vença para ganhar XP e dinheiro, ou capture para aumentar o time. Se o time todo cair, a run acaba, mas o que você capturou fica guardado na coleção.',
      },
      {
        sel: ['.title-screen .online-btn', '.title-screen .career-btn'],
        title: 'Jogar online (carreira)',
        text: 'A mesma aventura, mas com os amigos: alguém cria a carreira e passa o código. Todo mundo joga a sua run e se encontra nos torneios. Perder não acaba a temporada, só dá uma penalidade.',
      },
      {
        sel: '.title-screen .quickplay-btn:not(.builder-btn)',
        title: 'Quickplay: partidas rápidas',
        text: 'Rush: aparecem 2 Pokémon, você fica com um e o outro vai para o adversário, e depois batalha. Campeonato rápido: um torneio inteiro de uma vez. Não mexe na sua run.',
      },
      {
        sel: '.title-screen .builder-btn',
        title: 'Dream Team',
        text: 'Monte o time dos sonhos com qualquer Pokémon: golpes, item, nature e EVs. Não sabe montar? Tem o botão "Montar sozinho" e times prontos.',
      },
      {
        sel: '.title-screen .menu-tiles',
        title: 'Seu progresso',
        text: 'Coleção (todos os Pokémon que você já pegou), Torneios, Glória (melhorias para as próximas runs), Creche (ovos), Ranking e Conquistas.',
      },
      {
        sel: '[data-tut="nav-types"]',
        title: 'Calculadora de tipos',
        text: 'O segredo das batalhas: cada tipo é forte contra uns e fraco contra outros. Água bate forte em Fogo, Fogo bate forte em Planta... Na dúvida, abra a calculadora aqui.',
      },
      {
        sel: '[data-tut="nav-help"]',
        title: 'Ajuda',
        text: 'Todas as regras explicadas com calma. Lá também tem o botão para ver este tutorial de novo.',
      },
      {
        sel: '[data-tut="nav-fast"]',
        title: 'Animações',
        text: 'Achou as batalhas lentas? Toque aqui para deixar tudo mais rápido.',
      },
    ],
  },

  // ---------- Run
  {
    id: 'starter',
    when: '.starter-screen',
    steps: [
      {
        sel: ['.starter-screen .gen-grid', '.starter-screen .starter-lists'],
        title: 'Escolha seus iniciais',
        text: 'Toque num Pokémon para ver os detalhes dele. Depois toque em "Pôr no time".',
      },
      {
        sel: '.starter-screen .detail',
        title: 'Detalhes',
        text: 'Aqui aparecem os tipos, os atributos (ataque, defesa, velocidade...) e as evoluções do Pokémon escolhido.',
      },
      {
        sel: '.starter-screen .budget',
        title: 'Pontos do time',
        text: 'Você tem pontos limitados. Cada Pokémon custa pontos (o número no canto dele): os mais fortes custam mais. Dica: misture tipos diferentes, assim sempre tem alguém bom contra o adversário.',
      },
      {
        sel: '.starter-screen .team-slots',
        title: 'Seu time',
        text: 'O primeiro da fila abre as lutas. O coração escolhe o parceiro: ele fica amigo mais rápido e ganha poderes especiais nas batalhas.',
      },
      {
        sel: '.starter-screen .budget .btn.primary',
        title: 'Tudo pronto?',
        text: 'Quando o time estiver montado, toque aqui para começar a aventura!',
      },
    ],
  },
  {
    id: 'biome',
    when: '.biome-screen .biomes',
    steps: [
      {
        sel: '.biome-screen .biomes',
        title: 'Para onde vamos?',
        text: 'Cada região e cada bioma tem Pokémon diferentes (no vulcão aparece mais Fogo, no mar mais Água...). Você fica algumas rondas em cada lugar e depois escolhe o próximo.',
      },
      {
        sel: '[data-tut="nav-guide"]',
        title: 'Guia dos biomas',
        text: 'Quer saber quem aparece em cada lugar? O Guia mostra a chance de cada Pokémon.',
      },
    ],
  },
  {
    id: 'lead',
    when: '.lead-prompt',
    steps: [
      {
        sel: '.lead-prompt .lead-foe',
        title: 'Quem apareceu?',
        text: 'Antes de cada luta você vê o adversário e os tipos dele. Toque num tipo para abrir a calculadora.',
      },
      {
        sel: ['.lead-prompt .lead-current', '.lead-prompt .lead-ask'],
        title: 'Quem vai lutar',
        text: 'Este é o Pokémon que vai começar. Os selos coloridos dizem se ele bate forte ou se toma muito dano desse adversário.',
      },
      {
        sel: ['.lead-prompt .lead-buttons', '.lead-prompt .lead-ask'],
        title: 'Trocar ou seguir?',
        text: 'Se outro Pokémon do time for melhor contra esse adversário, troque. O jogo marca a "Boa escolha" para você.',
      },
    ],
  },
  {
    id: 'battle',
    when: '.battle-screen .main-actions',
    steps: [
      {
        sel: '.battle-screen .wild-box',
        title: 'O adversário',
        text: 'Nome, nível, tipos e a barra de HP (a vida). Quando a barra zera, ele desmaia e você vence.',
      },
      {
        sel: '.battle-screen .wild-box .weak-btn',
        title: 'Fraquezas (muito importante!)',
        text: 'Toque aqui para ver contra quais tipos ele é fraco. Golpe de um tipo que ele é fraco tira o dobro (ou até 4x) de dano!',
      },
      {
        sel: '.battle-screen .player-box',
        title: 'Seu Pokémon',
        text: 'O seu lado: nível, HP e o botão de fraquezas dele também, para saber do que tomar cuidado.',
      },
      {
        sel: '.battle-screen .btn.act.fight',
        title: 'Lutar',
        text: 'Abre os golpes do seu Pokémon. Cada um mostra se é bom contra o adversário.',
      },
      {
        sel: '[data-tut="act-ball"]',
        title: 'Pokébola',
        text: 'Captura o selvagem para o seu time. Funciona melhor com o HP dele baixo (no vermelho) ou dormindo/paralisado.',
      },
      {
        sel: '[data-tut="act-bag"]',
        title: 'Mochila',
        text: 'Poções e outros itens de batalha. Usar um item gasta a sua vez.',
      },
      {
        sel: '[data-tut="act-switch"]',
        title: 'Trocar',
        text: 'Troca o Pokémon em campo por outro do time. Bom quando o adversário é forte contra o seu.',
      },
      {
        sel: ['.run-sidebar .sb-team', '.topnav .nav-bag'],
        title: 'Painel',
        text: 'Aqui fica o seu time, a Mochila, o PC (Pokémon guardados), os Ginásios e a Loja. Toque num Pokémon para ver tudo sobre ele.',
      },
      {
        sel: '.run-sidebar .sb-weak',
        title: 'Fraquezas do time',
        text: 'Mostra os tipos que dão problema para o seu time inteiro. Se tiver muito vermelho, vale capturar alguém de outro tipo.',
      },
    ],
  },
  {
    id: 'moves',
    when: '.battle-screen .move-grid',
    steps: [
      {
        sel: '.battle-screen .move-btn',
        title: 'Golpes',
        text: 'Cada botão é um golpe: a cor é o tipo, e embaixo tem o poder, a precisão e quantas vezes ainda dá para usar (PP).',
      },
      {
        sel: '.battle-screen .move-btn .eff',
        title: 'Super efetivo?',
        text: 'Este selo é a dica de ouro: "Super efetivo" tira o dobro de dano, "Pouco efetivo" tira a metade e "Não afeta" não faz nada. Prefira os super efetivos!',
      },
      {
        sel: '.battle-screen .move-info-btn',
        title: 'O que o golpe faz?',
        text: 'Toque aqui para ler a explicação completa do golpe.',
      },
      {
        sel: '.battle-screen .mega-toggle',
        title: 'Mega evolução',
        text: 'Marque para mega evoluir junto com o golpe. O Pokémon fica bem mais forte até o fim da luta.',
      },
    ],
  },
  {
    id: 'reward',
    when: '.reward-screen',
    steps: [
      {
        sel: ['.reward-screen .rewards', '.reward-screen .reward-taken'],
        title: 'Recompensa da ronda',
        text: 'Depois de cada ronda você escolhe 1 de 3 prêmios: itens, dinheiro, doces... Toque no que quiser.',
      },
      {
        sel: '.reward-screen .tabs',
        title: 'Loja',
        text: 'Na aba Loja dá para comprar Pokébolas, Poções e outros itens com o dinheiro das lutas. Nunca saia sem Pokébolas!',
      },
    ],
  },

  // ---------- Quickplay
  {
    id: 'quickplay',
    when: '[data-tut="qp-menu"]',
    steps: [
      {
        sel: '[data-tut="qp-menu"] > .qp-card:nth-child(1)',
        title: 'Rush',
        text: 'O modo mais rápido: aparecem 2 Pokémon por vez, você fica com um e o outro vai para o adversário. Com 3 cada, é batalha! Bom para aprender os tipos.',
      },
      {
        sel: '[data-tut="qp-menu"] > .qp-card:nth-child(2)',
        title: 'Campeonato rápido',
        text: 'Você monta um time na hora e joga um campeonato inteiro, em mata-mata. Dá para jogar com os amigos ou contra bots.',
      },
    ],
  },
  {
    id: 'online-offline',
    when: '[data-tut="online-offline"]',
    steps: [
      {
        sel: '[data-tut="online-offline"] > .qp-card:nth-child(1)',
        title: 'Offline',
        text: 'Sem internet: contra o computador ou com um amigo no mesmo aparelho, passando de mão em mão.',
      },
      {
        sel: '[data-tut="online-offline"] > .qp-card:nth-child(2)',
        title: 'Online',
        text: 'Cada um no seu aparelho. Uma pessoa cria a sala e manda o código de 5 letras para os outros digitarem.',
      },
    ],
  },
  {
    id: 'rush-setup',
    when: '[data-tut="rush-modes"]',
    steps: [
      {
        sel: '[data-tut="rush-modes"]',
        title: 'Modos do Rush',
        text: 'Cada modo sorteia Pokémon de um jeito: nível 50, iniciais, lendários, megas... Na dúvida, comece pelo primeiro.',
      },
      {
        sel: '.rush-setup .btn.primary.big',
        title: 'Começar',
        text: 'Toque aqui quando estiver pronto.',
      },
    ],
  },
  {
    id: 'rush-draft',
    when: '.rush-draft .rush-pair:not(.three)',
    steps: [
      {
        sel: '.rush-draft .rush-pair',
        title: 'Escolha um!',
        text: 'O que você tocar fica com você. O outro vai para o adversário! Então pense: qual dos dois eu quero, e qual eu não quero enfrentar?',
      },
      {
        sel: '.screen.quickplay .calc-btn',
        title: 'Calculadora',
        text: 'Ajuda a comparar os tipos antes de escolher.',
      },
      {
        sel: '.rush-draft .rush-teams',
        title: 'Os times',
        text: 'Aqui você acompanha os dois times sendo montados.',
      },
    ],
  },
  {
    id: 'tour-draft',
    when: '.rush-draft .rush-pair.three',
    steps: [
      {
        sel: '.rush-draft .rush-pair',
        title: 'Monte o time',
        text: 'Saem 3 Pokémon por vez e você fica com um. Tente pegar tipos diferentes, para ter resposta contra qualquer adversário.',
      },
    ],
  },
  {
    id: 'rush-prep',
    when: '.rush-prep',
    steps: [
      {
        sel: '.prep-foe',
        title: 'Estude o adversário',
        text: 'Este é o time dele. Toque em "Fraquezas" para ver o que bate forte em cada um.',
      },
      {
        sel: '.rush-prep .rush-prep-grid',
        title: 'Quem abre?',
        text: 'Toque no Pokémon que vai começar a luta. Ele não sabe quem você vai mandar, nem você sabe o dele.',
      },
      {
        sel: '.rush-prep .prep-tools',
        title: 'Fraquezas do seu time',
        text: 'Mostra os tipos perigosos para o seu time.',
      },
      {
        sel: '.rush-prep .btn.primary.big',
        title: 'Pronto!',
        text: 'Toque aqui para ir para a batalha.',
      },
    ],
  },
  {
    id: 'versus',
    when: '.screen.versus .move-grid',
    steps: [
      {
        sel: '.screen.versus .wild-box .weak-btn',
        title: 'Fraquezas',
        text: 'Toque para ver contra quais tipos o adversário é fraco.',
      },
      {
        sel: '.screen.versus .move-btn',
        title: 'Seus golpes',
        text: 'Toque num golpe para atacar. O selo "Super efetivo" mostra os que tiram o dobro de dano.',
      },
      {
        sel: '[data-tut="versus-teams"]',
        title: 'Os dois times',
        text: 'Abre os dois times, com os tipos de cada Pokémon.',
      },
      {
        sel: '.screen.versus .calc-btn',
        title: 'Calculadora',
        text: 'A calculadora de tipos, já aberta com o adversário.',
      },
      {
        sel: '.screen.versus .move-grid .back',
        title: 'Trocar',
        text: 'Troca o Pokémon em campo por outro do seu time.',
      },
    ],
  },

  // ---------- Dream Team
  {
    id: 'builder',
    when: '.builder .tb-teams',
    steps: [
      {
        sel: '.builder .tb-new',
        title: 'Criar um time',
        text: 'Comece do zero, ou toque em "Times prontos" para pegar um time montado com estratégia e mudar do seu jeito.',
      },
      {
        sel: '.builder .tb-team:not(.tb-new) .btn.primary',
        title: 'Jogar',
        text: 'Com o time salvo, toque em Jogar: online com um amigo ou offline contra o computador.',
      },
    ],
  },
  {
    id: 'builder-edit',
    when: '.builder .tb-slots',
    steps: [
      {
        sel: '.builder .tb-slots',
        title: 'Seu time',
        text: 'Até 6 Pokémon. Toque no + para adicionar e num Pokémon para editar.',
      },
      {
        sel: '.builder .bar .btn.primary',
        title: 'Salvar',
        text: 'Não esqueça de salvar o time quando terminar!',
      },
    ],
  },
  {
    id: 'builder-pick',
    when: '.builder .tb-picker',
    steps: [
      {
        sel: ['.builder .tb-type-filter', '.builder .tb-picker'],
        title: 'Escolha um Pokémon',
        text: 'Busque pelo nome ou toque num tipo para filtrar. Os mais fortes aparecem primeiro. Dica: misture tipos, para o time não ter a mesma fraqueza.',
      },
    ],
  },
  {
    id: 'builder-mon',
    when: '.builder .tb-editor',
    steps: [
      {
        sel: '.builder .tb-editor-btns',
        title: 'Montar sozinho',
        text: 'Não sabe que golpes escolher? "Montar sozinho" monta golpes, item, nature e EVs que funcionam.',
      },
      {
        sel: '.builder .tb-tabs',
        title: 'Detalhes',
        text: 'Golpes (até 4), Habilidade, Item e Nature/EVs. Dá para mudar tudo com calma.',
      },
      {
        sel: '.builder .prep-tools',
        title: 'Fraquezas do time',
        text: 'Confira se o time não é fraco demais contra algum tipo.',
      },
    ],
  },

  // ---------- Carreira online
  {
    id: 'career',
    when: '.career-screen .career-modes',
    steps: [
      {
        sel: '.career-screen .career-modes > :nth-child(1)',
        title: 'Criar carreira',
        text: 'Uma pessoa cria a carreira, escolhe as regras e recebe um código.',
      },
      {
        sel: '.career-screen .career-modes > :nth-child(2)',
        title: 'Entrar com código',
        text: 'Os outros entram digitando o código que receberam. Cada um joga no seu aparelho, quando quiser.',
      },
    ],
  },
  {
    id: 'career-home',
    when: '.career-screen .standings',
    steps: [
      {
        sel: '.career-screen .career-code',
        title: 'Código da carreira',
        text: 'Mande este código para os amigos entrarem.',
      },
      {
        sel: '.career-screen .standings',
        title: 'Classificação',
        text: 'Os pontos de todo mundo. Vencer torneios e ginásios dá pontos.',
      },
      {
        sel: '.career-screen .big-play',
        title: 'Jogar',
        text: 'Continua a sua temporada. Cada um joga no seu ritmo e todos se encontram nos torneios.',
      },
    ],
  },

  // ---------- Outras telas
  {
    id: 'tournament',
    when: '.tour-screen .tour-intro',
    steps: [
      {
        sel: '.tour-screen .tour-intro',
        title: 'Torneio!',
        text: '8 treinadores em mata-mata: venceu, passa de fase. O time é curado antes de cada luta. Perder tira você do torneio, mas a run continua.',
      },
    ],
  },
  {
    id: 'collection',
    when: '.collection-screen',
    steps: [
      {
        sel: '.collection-screen .big-tabs',
        title: 'Coleção',
        text: 'Todos os Pokémon que você já pegou ficam aqui para sempre. Toque num Pokémon para abrir a ficha.',
      },
      {
        title: 'Doces e corações',
        text: 'Cada Pokémon ganha doces (capturando, vencendo) e corações (lutando no time). Na ficha você gasta doces em melhorias: golpe inicial, custo menor, chance de shiny...',
      },
    ],
  },
  {
    id: 'daycare',
    when: '.daycare-screen',
    steps: [
      {
        sel: '.daycare-screen .daycare-pair',
        title: 'Creche',
        text: 'Deixe uma fêmea e um macho da coleção juntos para fazer ovos. Leve o ovo na run: ele choca depois de algumas rondas.',
      },
    ],
  },
  {
    id: 'glory',
    when: '.glory-screen',
    steps: [
      {
        title: 'Glória',
        text: 'Toda run dá Glória quando acaba. Aqui você compra melhorias que valem para todas as próximas runs.',
      },
    ],
  },
  {
    id: 'calc',
    when: '[data-tut="type-calc"]',
    modal: true,
    steps: [
      {
        sel: '[data-tut="type-calc"]',
        title: 'Calculadora de tipos',
        text: 'Escolha 1 ou 2 tipos, por exemplo os tipos do adversário.',
      },
      {
        sel: ['.modal .calc-cards', '[data-tut="type-calc"]'],
        title: 'Como ler',
        text: 'Depois de escolher, aparecem cartões que mostram de quais tipos ele toma dano dobrado (fraquezas) e quais ele aguenta bem. Use golpes dos tipos das fraquezas!',
      },
    ],
  },
];
