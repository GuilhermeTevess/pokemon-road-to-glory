// Treinadores lendários de cada região (anime e jogos). Aparecem com o medidor "Rastro da lenda".

export interface LegendMon {
  species: string;
  moves: string[];
  item?: string;
}

export interface Legend {
  id: string;
  name: string;
  region: string;
  /** Sprite de treinador do Showdown. */
  avatar: string;
  /** Frase de quem é, para o cartão. */
  title: string;
  /** Falas antes da luta. */
  intro: string[];
  /** Time na ordem: os primeiros são os mais famosos (time menor usa só eles). */
  team: LegendMon[];
}

export const LEGENDS: Legend[] = [
  {
    id: 'ash', name: 'Ash', region: 'kanto', avatar: 'ash', title: 'O eterno sonhador de Pallet',
    intro: ['Um garoto de boné aparece correndo com um Pikachu no ombro...', '"Eu vou ser um Mestre Pokémon! Vamos batalhar!"'],
    team: [
      {species: 'Pikachu', moves: ['Thunderbolt', 'Quick Attack', 'Iron Tail', 'Electro Ball'], item: 'Light Ball'},
      {species: 'Charizard', moves: ['Flamethrower', 'Air Slash', 'Dragon Claw', 'Seismic Toss']},
      {species: 'Pidgeot', moves: ['Brave Bird', 'Quick Attack', 'Roost', 'U-turn']},
      {species: 'Snorlax', moves: ['Body Slam', 'Rest', 'Hyper Beam', 'Ice Punch']},
      {species: 'Lapras', moves: ['Ice Beam', 'Surf', 'Sing', 'Psychic']},
      {species: 'Butterfree', moves: ['Bug Buzz', 'Sleep Powder', 'Air Slash', 'Quiver Dance']},
    ],
  },
  {
    id: 'red', name: 'Red', region: 'kanto', avatar: 'red', title: 'O campeão silencioso do Monte Prateado',
    intro: ['No alto da montanha, um treinador de vermelho espera em silêncio.', '...'],
    team: [
      {species: 'Pikachu', moves: ['Volt Tackle', 'Iron Tail', 'Quick Attack', 'Thunderbolt'], item: 'Light Ball'},
      {species: 'Charizard', moves: ['Flare Blitz', 'Air Slash', 'Dragon Pulse', 'Blast Burn']},
      {species: 'Venusaur', moves: ['Giga Drain', 'Sludge Bomb', 'Sleep Powder', 'Synthesis']},
      {species: 'Blastoise', moves: ['Hydro Pump', 'Ice Beam', 'Flash Cannon', 'Rapid Spin']},
      {species: 'Snorlax', moves: ['Body Slam', 'Rest', 'Crunch', 'Earthquake']},
      {species: 'Espeon', moves: ['Psychic', 'Shadow Ball', 'Dazzling Gleam', 'Morning Sun']},
    ],
  },
  {
    id: 'lance', name: 'Lance', region: 'johto', avatar: 'lance', title: 'Mestre dos dragões',
    intro: ['Uma capa vermelha esvoaça. Um Dragonite pousa ao lado dele.', '"Mostre se você tem a força de um verdadeiro treinador!"'],
    team: [
      {species: 'Dragonite', moves: ['Outrage', 'Extreme Speed', 'Fire Punch', 'Dragon Dance']},
      {species: 'Gyarados', moves: ['Waterfall', 'Dragon Dance', 'Crunch', 'Ice Fang']},
      {species: 'Aerodactyl', moves: ['Rock Slide', 'Wing Attack', 'Crunch', 'Earthquake']},
      {species: 'Charizard', moves: ['Flamethrower', 'Dragon Pulse', 'Air Slash', 'Roost']},
      {species: 'Kingdra', moves: ['Hydro Pump', 'Dragon Pulse', 'Ice Beam', 'Rain Dance']},
      {species: 'Salamence', moves: ['Dragon Claw', 'Fly', 'Earthquake', 'Fire Fang']},
    ],
  },
  {
    id: 'steven', name: 'Steven', region: 'hoenn', avatar: 'steven', title: 'Campeão de Hoenn, caçador de pedras raras',
    intro: ['Um homem de terno examina uma pedra brilhante na caverna.', '"Pedras e Pokémon fortes... gosto dos dois. Vamos ver os seus?"'],
    team: [
      {species: 'Metagross', moves: ['Meteor Mash', 'Zen Headbutt', 'Bullet Punch', 'Earthquake']},
      {species: 'Skarmory', moves: ['Steel Wing', 'Brave Bird', 'Spikes', 'Roost']},
      {species: 'Aggron', moves: ['Iron Head', 'Stone Edge', 'Earthquake', 'Dragon Tail']},
      {species: 'Claydol', moves: ['Earth Power', 'Psychic', 'Ancient Power', 'Reflect']},
      {species: 'Cradily', moves: ['Giga Drain', 'Ancient Power', 'Sludge Bomb', 'Recover']},
      {species: 'Armaldo', moves: ['X-Scissor', 'Stone Edge', 'Crush Claw', 'Aqua Tail']},
    ],
  },
  {
    id: 'cynthia', name: 'Cynthia', region: 'sinnoh', avatar: 'cynthia', title: 'Campeã de Sinnoh, estudiosa dos mitos',
    intro: ['Uma treinadora de casaco preto fecha um livro antigo.', '"Os mitos falam de força e coragem. Mostre as suas."'],
    team: [
      {species: 'Garchomp', moves: ['Dragon Rush', 'Earthquake', 'Giga Impact', 'Swords Dance']},
      {species: 'Spiritomb', moves: ['Dark Pulse', 'Shadow Ball', 'Psychic', 'Will-O-Wisp']},
      {species: 'Lucario', moves: ['Aura Sphere', 'Flash Cannon', 'Dragon Pulse', 'Extreme Speed']},
      {species: 'Milotic', moves: ['Surf', 'Ice Beam', 'Mirror Coat', 'Recover']},
      {species: 'Togekiss', moves: ['Air Slash', 'Aura Sphere', 'Shadow Ball', 'Water Pulse']},
      {species: 'Roserade', moves: ['Energy Ball', 'Sludge Bomb', 'Shadow Ball', 'Extrasensory']},
    ],
  },
  {
    id: 'alder', name: 'Alder', region: 'unova', avatar: 'alder', title: 'Campeão andarilho de Unova',
    intro: ['Um homem de cabelo ruivo e colar de contas acena de longe.', '"Batalhar é conhecer o coração dos Pokémon. Vamos nessa!"'],
    team: [
      {species: 'Volcarona', moves: ['Fiery Dance', 'Bug Buzz', 'Quiver Dance', 'Giga Drain']},
      {species: 'Bouffalant', moves: ['Head Charge', 'Megahorn', 'Earthquake', 'Wild Charge']},
      {species: 'Druddigon', moves: ['Outrage', 'Superpower', 'Fire Punch', 'Sucker Punch']},
      {species: 'Escavalier', moves: ['Iron Head', 'Megahorn', 'Drill Run', 'Swords Dance']},
      {species: 'Accelgor', moves: ['Bug Buzz', 'Focus Blast', 'Energy Ball', 'Spikes']},
      {species: 'Vanilluxe', moves: ['Blizzard', 'Flash Cannon', 'Freeze-Dry', 'Explosion']},
    ],
  },
  {
    id: 'diantha', name: 'Diantha', region: 'kalos', avatar: 'diantha', title: 'Campeã de Kalos e estrela de cinema',
    intro: ['Uma atriz famosa tira os óculos escuros e sorri.', '"Toda grande cena precisa de um grande rival. Ação!"'],
    team: [
      {species: 'Gardevoir', moves: ['Moonblast', 'Psychic', 'Thunderbolt', 'Calm Mind'], item: 'Gardevoirite'},
      {species: 'Hawlucha', moves: ['Flying Press', 'Close Combat', 'Poison Jab', 'Swords Dance']},
      {species: 'Tyrantrum', moves: ['Head Smash', 'Dragon Claw', 'Earthquake', 'Crunch']},
      {species: 'Aurorus', moves: ['Freeze-Dry', 'Ancient Power', 'Thunderbolt', 'Earth Power']},
      {species: 'Goodra', moves: ['Dragon Pulse', 'Sludge Bomb', 'Fire Blast', 'Thunderbolt']},
      {species: 'Gourgeist', moves: ['Seed Bomb', 'Shadow Sneak', 'Flamethrower', 'Trick-or-Treat']},
    ],
  },
  {
    id: 'kukui', name: 'Kukui', region: 'alola', avatar: 'kukui', title: 'O professor que batalha sem camisa',
    intro: ['Um professor de jaleco aberto ajeita os óculos.', '"Woo! Golpes Pokémon são a coisa mais incrível do mundo! Vamos testar!"'],
    team: [
      {species: 'Incineroar', moves: ['Darkest Lariat', 'Flare Blitz', 'Fake Out', 'U-turn']},
      {species: 'Lycanroc', moves: ['Accelerock', 'Stone Edge', 'Close Combat', 'Psychic Fangs']},
      {species: 'Ninetales-Alola', moves: ['Blizzard', 'Moonblast', 'Aurora Veil', 'Freeze-Dry']},
      {species: 'Braviary', moves: ['Brave Bird', 'Close Combat', 'Crush Claw', 'Roost']},
      {species: 'Magnezone', moves: ['Thunderbolt', 'Flash Cannon', 'Volt Switch', 'Body Press']},
      {species: 'Snorlax', moves: ['Body Slam', 'Crunch', 'Heavy Slam', 'Rest']},
    ],
  },
  {
    id: 'leon', name: 'Leon', region: 'galar', avatar: 'leon', title: 'O campeão invicto de Galar',
    intro: ['O estádio inteiro grita quando ele entra fazendo a pose de Charizard.', '"Vamos ter um tempo campeão juntos!"'],
    team: [
      {species: 'Charizard', moves: ['Fire Blast', 'Air Slash', 'Solar Beam', 'Ancient Power']},
      {species: 'Aegislash', moves: ['Shadow Ball', 'Sacred Sword', 'Flash Cannon', "King's Shield"]},
      {species: 'Dragapult', moves: ['Dragon Darts', 'Phantom Force', 'U-turn', 'Will-O-Wisp']},
      {species: 'Haxorus', moves: ['Outrage', 'Close Combat', 'Iron Head', 'Dragon Dance']},
      {species: 'Rhyperior', moves: ['Rock Wrecker', 'Earthquake', 'Megahorn', 'Ice Punch']},
      {species: 'Seismitoad', moves: ['Muddy Water', 'Earth Power', 'Sludge Bomb', 'Stealth Rock']},
    ],
  },
  {
    id: 'geeta', name: 'Geeta', region: 'paldea', avatar: 'geeta', title: 'Presidente da Liga de Paldea',
    intro: ['A presidente da Liga observa você com um olhar calmo.', '"Deixe-me ver o quanto você cresceu nesta jornada."'],
    team: [
      {species: 'Kingambit', moves: ['Kowtow Cleave', 'Iron Head', 'Sucker Punch', 'Swords Dance']},
      {species: 'Glimmora', moves: ['Power Gem', 'Sludge Wave', 'Earth Power', 'Mortal Spin']},
      {species: 'Espathra', moves: ['Lumina Crash', 'Dazzling Gleam', 'Quick Attack', 'Calm Mind']},
      {species: 'Gogoat', moves: ['Horn Leech', 'Earthquake', 'Bulk Up', 'Milk Drink']},
      {species: 'Veluza', moves: ['Aqua Cutter', 'Psycho Cut', 'Night Slash', 'Aqua Jet']},
      {species: 'Avalugg', moves: ['Avalanche', 'Body Press', 'Crunch', 'Recover']},
    ],
  },
];

export function legendsOf(region: string | undefined): Legend[] {
  return LEGENDS.filter(l => l.region === region);
}

export function getLegend(id: string): Legend | undefined {
  return LEGENDS.find(l => l.id === id);
}
