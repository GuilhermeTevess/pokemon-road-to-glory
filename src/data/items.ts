// Itens do jogo. Os "held" são itens reais do Showdown e funcionam dentro da batalha.

export type ItemKind = 'ball' | 'heal' | 'revive' | 'candy' | 'evolution' | 'tm' | 'held' | 'map' | 'incense' | 'money';
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
}

const held = (id: string, name: string, showdown: string, desc: string, tier: ItemTier, sprite: string): ItemDef => ({
  id, name, desc, kind: 'held', tier, sprite, price: 0, showdown,
});

export const ITEMS: ItemDef[] = [
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

  {id: 'rarecandy', name: 'Doce Raro', desc: 'Sobe o Pokémon 1 nível.', kind: 'candy', tier: 'great', sprite: 'rare-candy', price: 0},
  {id: 'evostone', name: 'Pedra da Evolução', desc: 'Evolui Pokémon que evoluem por pedra, troca, amizade ou condição especial.', kind: 'evolution', tier: 'ultra', sprite: 'moon-stone', price: 0},
  {id: 'tm', name: 'Disco Técnico', desc: 'Ensina um golpe aleatório que o Pokémon consegue aprender.', kind: 'tm', tier: 'great', sprite: 'tm-normal', price: 0},
  {id: 'map', name: 'Mapa', desc: 'Permite trocar de bioma depois da próxima vitória.', kind: 'map', tier: 'great', sprite: 'town-map', price: 1000},
  {id: 'incense', name: 'Incenso Raro', desc: 'Pokémon raros aparecem mais pelas próximas 5 rondas.', kind: 'incense', tier: 'ultra', sprite: 'luck-incense', price: 0},
  {id: 'money', name: 'Bolsa de Moedas', desc: 'Ganha dinheiro.', kind: 'money', tier: 'common', sprite: 'amulet-coin', price: 0},

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
];

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
      return 'Use entre batalhas, em "Time e mochila".';
    case 'candy':
    case 'evolution':
    case 'tm':
      return 'Use entre batalhas, escolhendo um Pokémon.';
    case 'held':
      return 'Equipe num Pokémon: funciona sozinho na batalha.';
    case 'map':
    case 'incense':
      return 'Use entre batalhas, em "Time e mochila".';
    case 'money':
      return 'Vira dinheiro na hora.';
  }
}
