// Itens do jogo. Os "held" são itens reais do Showdown e funcionam dentro da batalha.
import {Dex, toID} from '@pkmn/sim';

export type ItemKind = 'ball' | 'heal' | 'revive' | 'candy' | 'evolution' | 'tm' | 'held' | 'map' | 'incense' | 'money' | 'battle' | 'mint' | 'ability' | 'vitamin' | 'mega' | 'breed' | 'key';
export type ItemTier = 'common' | 'great' | 'ultra' | 'master';

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  kind: ItemKind;
  tier: ItemTier;
  /** Nome do arquivo de sprite no PokéAPI (sprites/items/<slug>.png). */
  sprite: string;
  /** Preço na loja (0 = não vende). */
  price: number;
  /** Multiplicador de captura (pokébolas) ou cura em HP (poções; 1 = cura total). */
  power?: number;
  /** Nome do item no Showdown (itens de segurar). */
  showdown?: string;
  /** Atributo que um item X aumenta na batalha. */
  stat?: 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy';
  /** Atributo que ganha EVs (vitaminas e itens Power). */
  evStat?: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
  /** Mega Pedra específica: espécie que ela mega-evolui. */
  megaFor?: string;
  /** Só aparece como recompensa a partir desta ronda. */
  minWave?: number;
  /** Itens de viagem: o que o mapa ou o passe faz. */
  travel?: 'biome' | 'region' | 'biomeStay' | 'regionStay';
  /** Preço sobe com a ronda e com o dinheiro do jogador. */
  scales?: boolean;
  /** Natureza que a menta aplica. */
  nature?: string;
  /** Peso no sorteio de recompensas (padrão 1). */
  weight?: number;
}

const held = (id: string, name: string, showdown: string, desc: string, tier: ItemTier, sprite: string, weight?: number): ItemDef => ({
  id, name, desc, kind: 'held', tier, sprite, price: 0, showdown, weight,
});

const xItem = (id: string, name: string, stat: ItemDef['stat'], label: string, sprite: string): ItemDef => ({
  id, name, desc: `Na batalha: ${label} +2 estágios até o fim da luta.`, kind: 'battle', tier: 'common', sprite, price: 500, stat, weight: 0.4,
});

const mint = (id: string, name: string, nature: string, label: string, sprite: string): ItemDef => ({
  id, name, desc: `Muda a natureza para ${nature} (${label}).`, kind: 'mint', tier: 'great', sprite, price: 0, nature, weight: 0.35,
});

/** Itens Power: de segurar, dão EVs a cada vitória (não vão para o Showdown, então não deixam lento). */
const powerItem = (id: string, name: string, evStat: ItemDef['evStat'], label: string, sprite: string): ItemDef => ({
  id, name, desc: `Segure: +${POWER_EVS} EVs de ${label} a cada vitória, guardados na ficha da coleção.`, kind: 'held', tier: 'great', sprite, price: 0, evStat, weight: 0.25,
});

const vitamin = (id: string, name: string, evStat: ItemDef['evStat'], label: string, sprite: string): ItemDef => ({
  id, name, desc: `+${VITAMIN_EVS} EVs de ${label} no Pokémon e na ficha da linha dele.`, kind: 'vitamin', tier: 'great', sprite, price: 1500, evStat, weight: 0.3,
});

/** Mega Pedras específicas (Charizardite X...). Não saem como recompensa: vêm da Mega Pedra genérica. */
function megaStones(): ItemDef[] {
  return Dex.forGen(9)
    .items.all()
    .filter(i => i.megaStone)
    .flatMap(i =>
      Object.keys(i.megaStone!).map(base => ({
        id: toID(i.name),
        name: i.name,
        desc: `Segure: ${base} mega-evolui sozinho no início de cada batalha (só 1 mega por time).`,
        kind: 'held' as const,
        tier: 'master' as const,
        sprite: toID(i.name).replace(/(ite)(x|y)$/, '$1-$2'),
        price: 0,
        showdown: i.name,
        megaFor: base,
        weight: 0,
      })),
    )
    .filter((it, idx, all) => all.findIndex(o => o.id === it.id) === idx);
}

export const POWER_EVS = 8;
export const VITAMIN_EVS = 10;

/** Itens que fortalecem golpes de um tipo em 20%. */
const typeBoost = (id: string, name: string, showdown: string, type: string, sprite: string): ItemDef =>
  held(id, name, showdown, `Golpes do tipo ${type} 20% mais fortes.`, 'great', sprite, 0.12);

export const ITEMS: ItemDef[] = [
  // Itens-chave: funcionam só de estar na mochila, até o fim da run (só 1 de cada).
  {id: 'expall', name: 'Exp. All', desc: 'Quem não lutou ganha 80% da EXP (sem ele, 50%).', kind: 'key', tier: 'master', sprite: 'exp-share', price: 0, minWave: 10, weight: 2},
  {id: 'luckyegg', name: 'Ovo da Sorte', desc: 'Todo o time ganha 50% a mais de EXP.', kind: 'key', tier: 'ultra', sprite: 'lucky-egg', price: 0, minWave: 8, weight: 0.4},
  {id: 'amuletcoin', name: 'Moeda Amuleto', desc: 'Dinheiro das batalhas x1,5.', kind: 'key', tier: 'ultra', sprite: 'amulet-coin', price: 0, minWave: 5, weight: 0.4},
  {id: 'shinycharm', name: 'Amuleto Brilhante', desc: 'Pokémon shiny aparecem 3x mais.', kind: 'key', tier: 'master', sprite: 'shiny-charm', price: 0, minWave: 20, weight: 1},

  {id: 'pokeball', name: 'Poké Ball', desc: 'Captura Pokémon selvagens.', kind: 'ball', tier: 'common', sprite: 'poke-ball', price: 200, power: 1},
  {id: 'greatball', name: 'Great Ball', desc: 'Captura com chance 1,5x maior.', kind: 'ball', tier: 'great', sprite: 'great-ball', price: 600, power: 1.5},
  {id: 'ultraball', name: 'Ultra Ball', desc: 'Captura com chance 2x maior.', kind: 'ball', tier: 'ultra', sprite: 'ultra-ball', price: 1200, power: 2},
  {id: 'masterball', name: 'Master Ball', desc: 'Captura garantida.', kind: 'ball', tier: 'master', sprite: 'master-ball', price: 0, power: 255},

  {id: 'potion', name: 'Poção', desc: 'Recupera 20 HP.', kind: 'heal', tier: 'common', sprite: 'potion', price: 300, power: 20},
  {id: 'superpotion', name: 'Super Poção', desc: 'Recupera 60 HP.', kind: 'heal', tier: 'great', sprite: 'super-potion', price: 700, power: 60},
  {id: 'hyperpotion', name: 'Hiper Poção', desc: 'Recupera 120 HP.', kind: 'heal', tier: 'ultra', sprite: 'hyper-potion', price: 1500, power: 120},
  {id: 'maxpotion', name: 'Poção Máxima', desc: 'Recupera todo o HP.', kind: 'heal', tier: 'ultra', sprite: 'max-potion', price: 2500, power: 1},
  {id: 'revive', name: 'Reviver', desc: 'Revive um Pokémon com metade do HP.', kind: 'revive', tier: 'great', sprite: 'revive', price: 1500, power: 0.5},
  {id: 'maxrevive', name: 'Reviver Máximo', desc: 'Revive um Pokémon com HP cheio.', kind: 'revive', tier: 'ultra', sprite: 'max-revive', price: 0, power: 1},

  {id: 'rarecandy', name: 'Doce Raro', desc: 'Sobe o Pokémon 1 nível.', kind: 'candy', tier: 'great', sprite: 'rare-candy', price: 0, power: 1},
  {id: 'expcandym', name: 'Doce de EXP M', desc: 'Sobe o Pokémon 2 níveis.', kind: 'candy', tier: 'great', sprite: 'exp-candy-m', price: 0, power: 2, weight: 0.6},
  {id: 'expcandyl', name: 'Doce de EXP G', desc: 'Sobe o Pokémon 4 níveis.', kind: 'candy', tier: 'ultra', sprite: 'exp-candy-l', price: 0, power: 4, weight: 0.6},
  {id: 'abilitycapsule', name: 'Cápsula de Habilidade', desc: 'Troca a habilidade do Pokémon pela outra habilidade comum dele.', kind: 'ability', tier: 'ultra', sprite: 'ability-capsule', price: 0, weight: 0.5},
  {id: 'evostone', name: 'Pedra da Evolução', desc: 'Evolui Pokémon que evoluem por pedra, troca, amizade ou condição especial.', kind: 'evolution', tier: 'ultra', sprite: 'moon-stone', price: 0},
  {id: 'tm', name: 'Disco Técnico', desc: 'Mostra 3 golpes sorteados que o Pokémon consegue aprender: você escolhe 1.', kind: 'tm', tier: 'great', sprite: 'tm-normal', price: 0},
  {id: 'map', name: 'Mapa de Bioma', desc: 'Depois da próxima vitória, você escolhe o bioma entre 3 opções.', kind: 'map', tier: 'great', sprite: 'town-map', price: 400, travel: 'biome', scales: true},
  {id: 'regionmap', name: 'Mapa de Região', desc: 'Depois da próxima vitória, você escolhe a região entre 3 opções.', kind: 'map', tier: 'ultra', sprite: 'explorer-kit', price: 900, travel: 'region', scales: true, weight: 0.4},
  {id: 'staypass', name: 'Passe de Estadia', desc: 'Na hora: dobra o tempo no bioma onde você está (uma vez por bioma).', kind: 'map', tier: 'ultra', sprite: 'tri-pass', price: 700, travel: 'biomeStay', scales: true, weight: 0},
  {id: 'regionpass', name: 'Passe Regional', desc: 'Na hora: dobra o tempo na região onde você está (uma vez por região).', kind: 'map', tier: 'ultra', sprite: 'rainbow-pass', price: 1600, travel: 'regionStay', scales: true, weight: 0},
  {id: 'incense', name: 'Incenso Raro', desc: 'Pokémon raros aparecem mais pelas próximas 5 rondas.', kind: 'incense', tier: 'ultra', sprite: 'luck-incense', price: 0},
  {id: 'money', name: 'Bolsa de Moedas', desc: 'Vale dinheiro na hora.', kind: 'money', tier: 'common', sprite: 'amulet-coin', price: 0, power: 1},
  {id: 'nugget', name: 'Pepita', desc: 'Vale bastante dinheiro na hora.', kind: 'money', tier: 'great', sprite: 'nugget', price: 0, power: 2.5, weight: 0.6},
  {id: 'bignugget', name: 'Pepita Grande', desc: 'Vale muito dinheiro na hora.', kind: 'money', tier: 'ultra', sprite: 'big-nugget', price: 0, power: 5, weight: 0.5},

  xItem('xattack', 'Ataque X', 'atk', 'Ataque', 'x-attack'),
  xItem('xdefense', 'Defesa X', 'def', 'Defesa', 'x-defense'),
  xItem('xspatk', 'Ataque Esp. X', 'spa', 'Ataque Especial', 'x-sp-atk'),
  xItem('xspdef', 'Defesa Esp. X', 'spd', 'Defesa Especial', 'x-sp-def'),
  xItem('xspeed', 'Velocidade X', 'spe', 'Velocidade', 'x-speed'),
  xItem('xaccuracy', 'Precisão X', 'accuracy', 'Precisão', 'x-accuracy'),

  mint('adamantmint', 'Menta Firme', 'Adamant', '+Ataque, -Atq. Esp.', 'adamant-mint'),
  mint('modestmint', 'Menta Modesta', 'Modest', '+Atq. Esp., -Ataque', 'modest-mint'),
  mint('jollymint', 'Menta Alegre', 'Jolly', '+Velocidade, -Atq. Esp.', 'jolly-mint'),
  mint('timidmint', 'Menta Tímida', 'Timid', '+Velocidade, -Ataque', 'timid-mint'),
  mint('boldmint', 'Menta Ousada', 'Bold', '+Defesa, -Ataque', 'bold-mint'),
  mint('calmmint', 'Menta Calma', 'Calm', '+Def. Esp., -Ataque', 'calm-mint'),

  held('leftovers', 'Restos', 'Leftovers', 'Recupera 1/16 do HP por turno.', 'ultra', 'leftovers'),
  held('sitrusberry', 'Fruta Sitrus', 'Sitrus Berry', 'Cura 1/4 do HP quando fica abaixo da metade.', 'common', 'sitrus-berry'),
  held('lumberry', 'Fruta Lum', 'Lum Berry', 'Cura qualquer status uma vez por batalha.', 'common', 'lum-berry'),
  held('oranberry', 'Fruta Oran', 'Oran Berry', 'Cura 10 HP quando fica abaixo da metade.', 'common', 'oran-berry'),
  held('choiceband', 'Faixa Escolhida', 'Choice Band', 'Ataque x1,5, mas preso a um golpe.', 'ultra', 'choice-band'),
  held('choicespecs', 'Óculos Escolhidos', 'Choice Specs', 'Ataque Especial x1,5, mas preso a um golpe.', 'ultra', 'choice-specs'),
  held('choicescarf', 'Cachecol Escolhido', 'Choice Scarf', 'Velocidade x1,5, mas preso a um golpe.', 'ultra', 'choice-scarf'),
  held('lifeorb', 'Orbe da Vida', 'Life Orb', 'Golpes 30% mais fortes, perde HP a cada ataque.', 'ultra', 'life-orb'),
  held('focussash', 'Faixa do Foco', 'Focus Sash', 'Sobrevive com 1 HP a um golpe com HP cheio.', 'great', 'focus-sash'),
  held('expertbelt', 'Cinto Especialista', 'Expert Belt', 'Golpes super efetivos 20% mais fortes.', 'great', 'expert-belt'),
  held('muscleband', 'Faixa Muscular', 'Muscle Band', 'Golpes físicos 10% mais fortes.', 'common', 'muscle-band'),
  held('wiseglasses', 'Óculos Sábios', 'Wise Glasses', 'Golpes especiais 10% mais fortes.', 'common', 'wise-glasses'),
  held('quickclaw', 'Garra Rápida', 'Quick Claw', 'Às vezes ataca primeiro.', 'common', 'quick-claw'),
  held('kingsrock', 'Rocha do Rei', "King's Rock", 'Às vezes faz o alvo recuar.', 'common', 'kings-rock'),
  held('shellbell', 'Sino de Concha', 'Shell Bell', 'Recupera HP ao causar dano.', 'great', 'shell-bell'),
  held('rockyhelmet', 'Capacete Rochoso', 'Rocky Helmet', 'Fere quem ataca com contato.', 'great', 'rocky-helmet'),
  held('assaultvest', 'Colete de Assalto', 'Assault Vest', 'Def. Especial x1,5, só golpes de ataque.', 'ultra', 'assault-vest'),
  held('eviolite', 'Eviolita', 'Eviolite', 'Defesas x1,5 se o Pokémon ainda pode evoluir.', 'ultra', 'eviolite'),
  held('scopelens', 'Lente de Mira', 'Scope Lens', 'Aumenta a chance de acerto crítico.', 'common', 'scope-lens'),
  held('widelens', 'Lente Ampla', 'Wide Lens', 'Golpes acertam 10% mais.', 'common', 'wide-lens'),
  held('brightpowder', 'Pó Brilhante', 'Bright Powder', 'O inimigo erra mais.', 'common', 'bright-powder'),
  held('airballoon', 'Balão', 'Air Balloon', 'Imune a golpes de Terra até levar um golpe.', 'great', 'air-balloon'),
  held('weaknesspolicy', 'Seguro Fraqueza', 'Weakness Policy', 'Ao levar golpe super efetivo: Ataque e Atq. Esp. +2.', 'ultra', 'weakness-policy'),
  held('blacksludge', 'Lodo Negro', 'Black Sludge', 'Tipo Veneno: recupera 1/16 do HP por turno (outros perdem).', 'great', 'black-sludge', 0.4),

  powerItem('powerweight', 'Peso Power', 'hp', 'HP', 'power-weight'),
  powerItem('powerbracer', 'Bracelete Power', 'atk', 'Ataque', 'power-bracer'),
  powerItem('powerbelt', 'Cinto Power', 'def', 'Defesa', 'power-belt'),
  powerItem('powerlens', 'Lente Power', 'spa', 'Atq. Esp.', 'power-lens'),
  powerItem('powerband', 'Faixa Power', 'spd', 'Def. Esp.', 'power-band'),
  powerItem('poweranklet', 'Tornozeleira Power', 'spe', 'Velocidade', 'power-anklet'),

  vitamin('hpup', 'HP Up', 'hp', 'HP', 'hp-up'),
  vitamin('protein', 'Proteína', 'atk', 'Ataque', 'protein'),
  vitamin('iron', 'Ferro', 'def', 'Defesa', 'iron'),
  vitamin('calcium', 'Cálcio', 'spa', 'Atq. Esp.', 'calcium'),
  vitamin('zinc', 'Zinco', 'spd', 'Def. Esp.', 'zinc'),
  vitamin('carbos', 'Carbos', 'spe', 'Velocidade', 'carbos'),

  {id: 'everstone', name: 'Pedra Eterna', kind: 'breed', tier: 'great', sprite: 'everstone', price: 3000, weight: 0.4,
    desc: 'Vai para a Creche. Na creche, o filhote herda a nature de quem segura.'},
  {id: 'destinyknot', name: 'Laço do Destino', kind: 'breed', tier: 'ultra', sprite: 'destiny-knot', price: 8000, weight: 0.4,
    desc: 'Vai para a Creche. Na creche, o filhote herda 5 IVs dos pais em vez de 3.'},
  {
    id: 'megastone', name: 'Mega Pedra', kind: 'mega', tier: 'master', sprite: 'key-stone', price: 20000, minWave: 20, weight: 2,
    desc: 'Vira a Mega Pedra do Pokémon escolhido (se ele tiver mega). Ele mega-evolui sozinho no início de cada batalha. Só 1 mega por time.',
  },

  typeBoost('charcoal', 'Carvão', 'Charcoal', 'Fogo', 'charcoal'),
  typeBoost('mysticwater', 'Água Mística', 'Mystic Water', 'Água', 'mystic-water'),
  typeBoost('miracleseed', 'Semente Milagrosa', 'Miracle Seed', 'Planta', 'miracle-seed'),
  typeBoost('magnet', 'Ímã', 'Magnet', 'Elétrico', 'magnet'),
  typeBoost('nevermeltice', 'Gelo Eterno', 'Never-Melt Ice', 'Gelo', 'never-melt-ice'),
  typeBoost('blackbelt', 'Faixa Preta', 'Black Belt', 'Lutador', 'black-belt'),
  typeBoost('poisonbarb', 'Ferrão Venenoso', 'Poison Barb', 'Venenoso', 'poison-barb'),
  typeBoost('softsand', 'Areia Macia', 'Soft Sand', 'Terra', 'soft-sand'),
  typeBoost('sharpbeak', 'Bico Afiado', 'Sharp Beak', 'Voador', 'sharp-beak'),
  typeBoost('twistedspoon', 'Colher Torta', 'Twisted Spoon', 'Psíquico', 'twisted-spoon'),
  typeBoost('silverpowder', 'Pó Prateado', 'Silver Powder', 'Inseto', 'silver-powder'),
  typeBoost('hardstone', 'Pedra Dura', 'Hard Stone', 'Pedra', 'hard-stone'),
  typeBoost('spelltag', 'Selo Fantasma', 'Spell Tag', 'Fantasma', 'spell-tag'),
  typeBoost('dragonfang', 'Presa de Dragão', 'Dragon Fang', 'Dragão', 'dragon-fang'),
  typeBoost('blackglasses', 'Óculos Escuros', 'Black Glasses', 'Sombrio', 'black-glasses'),
  typeBoost('metalcoat', 'Revestimento Metálico', 'Metal Coat', 'Aço', 'metal-coat'),
  typeBoost('silkscarf', 'Lenço de Seda', 'Silk Scarf', 'Normal', 'silk-scarf'),
  typeBoost('fairyfeather', 'Pena de Fada', 'Fairy Feather', 'Fada', 'fairy-feather'),
];

ITEMS.push(...megaStones());

/** Mega Pedras que servem nesta espécie (Charizard tem duas). */
export function megaStonesFor(speciesName: string): ItemDef[] {
  return ITEMS.filter(i => i.megaFor === speciesName);
}

export function getItem(id: string): ItemDef {
  const it = ITEMS.find(i => i.id === id);
  if (!it) throw new Error(`Item desconhecido: ${id}`);
  return it;
}

export function itemByShowdownName(name: string): ItemDef | undefined {
  return ITEMS.find(i => i.showdown === name);
}

export const TIER_COLORS: Record<ItemTier, string> = {
  common: '#d8d8d8',
  great: '#5aa8ff',
  ultra: '#f2c94c',
  master: '#c77dff',
};

/** Onde e como o item é usado — mostrado em todo lugar que o item aparece. */
export function itemUsage(item: ItemDef): string {
  switch (item.kind) {
    case 'ball':
      return 'Use na batalha, pelo botão Pokébola.';
    case 'heal':
      return 'Use na batalha (Mochila) ou entre batalhas.';
    case 'revive':
      return 'Use na batalha (Mochila) ou entre batalhas.';
    case 'candy':
    case 'evolution':
    case 'tm':
    case 'mint':
    case 'ability':
    case 'vitamin':
    case 'mega':
      return 'Use ao pegar ou depois, pela Mochila, escolhendo um Pokémon.';
    case 'battle':
      return 'Só na batalha: Mochila > item. Vale até o fim da luta.';
    case 'held':
      return 'Equipe num Pokémon (ao pegar ou pela Mochila): funciona sozinho na batalha.';
    case 'map':
    case 'incense':
      return 'Use ao pegar ou depois, pela Mochila.';
    case 'money':
      return 'Vira dinheiro na hora.';
    case 'breed':
      return 'Vai direto para a Creche (no menu inicial). Serve para fazer ovos.';
    case 'key':
      return 'Item-chave: funciona sozinho, só de estar na mochila, até o fim da run.';
  }
}

/** Itens que pedem um Pokémon como alvo fora da batalha. */
export function needsTarget(item: ItemDef): boolean {
  return ['heal', 'revive', 'candy', 'evolution', 'tm', 'held', 'mint', 'ability', 'vitamin', 'mega'].includes(item.kind);
}
