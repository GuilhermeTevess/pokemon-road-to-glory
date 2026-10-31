// Rivais conhecidos (anime e jogos) de cada região: aparecem no ranking e nos campeonatos.
// O time é o mais famoso de cada um; nos torneios entram os primeiros do tamanho pedido.

export interface Rival {
  name: string;
  region: string;
  /** Sprite de treinador do Showdown (quem não tem sprite usa uma classe parecida). */
  avatar: string;
  team: string[];
}

export const RIVALS: Rival[] = [
  {name: 'Gary', region: 'kanto', avatar: 'blue', team: ['Blastoise', 'Umbreon', 'Arcanine', 'Scizor', 'Nidoking', 'Electivire']},
  {name: 'Misty', region: 'kanto', avatar: 'misty', team: ['Starmie', 'Gyarados', 'Psyduck', 'Politoed', 'Corsola', 'Azumarill']},
  {name: 'Brock', region: 'kanto', avatar: 'brock', team: ['Steelix', 'Crobat', 'Sudowoodo', 'Ludicolo', 'Croagunk', 'Forretress']},
  {name: 'Ritchie', region: 'kanto', avatar: 'acetrainer', team: ['Pikachu', 'Butterfree', 'Charizard', 'Lapras', 'Tyranitar', 'Jolteon']},
  {name: 'Silver', region: 'johto', avatar: 'silver', team: ['Feraligatr', 'Crobat', 'Alakazam', 'Gengar', 'Magneton', 'Sneasel']},
  {name: 'Harrison', region: 'johto', avatar: 'acetrainer', team: ['Blaziken', 'Kecleon', 'Hypno', 'Houndoom', 'Sneasel', 'Steelix']},
  {name: 'Casey', region: 'johto', avatar: 'lass', team: ['Meganium', 'Beedrill', 'Elekid', 'Ampharos', 'Heracross', 'Pinsir']},
  {name: 'May', region: 'hoenn', avatar: 'may', team: ['Blaziken', 'Glaceon', 'Venusaur', 'Beautifly', 'Wartortle', 'Munchlax']},
  {name: 'Drew', region: 'hoenn', avatar: 'pokemonbreeder', team: ['Roserade', 'Flygon', 'Absol', 'Masquerain', 'Butterfree', 'Milotic']},
  {name: 'Wally', region: 'hoenn', avatar: 'wally', team: ['Gallade', 'Altaria', 'Roserade', 'Magneton', 'Delcatty', 'Gardevoir']},
  {name: 'Tyson', region: 'hoenn', avatar: 'acetrainer', team: ['Meowth', 'Metagross', 'Hariyama', 'Shiftry', 'Sceptile', 'Donphan']},
  {name: 'Dawn', region: 'sinnoh', avatar: 'dawn', team: ['Piplup', 'Togekiss', 'Mamoswine', 'Buneary', 'Pachirisu', 'Quilava']},
  {name: 'Paul', region: 'sinnoh', avatar: 'acetrainer-gen4', team: ['Electivire', 'Torterra', 'Ursaring', 'Gastrodon', 'Froslass', 'Drapion']},
  {name: 'Barry', region: 'sinnoh', avatar: 'barry', team: ['Empoleon', 'Staraptor', 'Heracross', 'Roserade', 'Snorlax', 'Infernape']},
  {name: 'Tobias', region: 'sinnoh', avatar: 'veteran', team: ['Darkrai', 'Latios', 'Heatran', 'Salamence', 'Garchomp', 'Lucario']},
  {name: 'Trip', region: 'unova', avatar: 'schoolkid', team: ['Serperior', 'Conkeldurr', 'Chandelure', 'Vanilluxe', 'Jellicent', 'Lampent']},
  {name: 'Iris', region: 'unova', avatar: 'iris', team: ['Haxorus', 'Dragonite', 'Excadrill', 'Emolga', 'Lapras', 'Hydreigon']},
  {name: 'Cilan', region: 'unova', avatar: 'cilan', team: ['Pansage', 'Crustle', 'Stunfisk', 'Simisage', 'Dwebble', 'Lilligant']},
  {name: 'Bianca', region: 'unova', avatar: 'bianca', team: ['Emboar', 'Musharna', 'Stoutland', 'Chandelure', 'Simipour', 'Escavalier']},
  {name: 'Cheren', region: 'unova', avatar: 'cheren', team: ['Serperior', 'Liepard', 'Unfezant', 'Simisear', 'Gigalith', 'Stoutland']},
  {name: 'Alain', region: 'kalos', avatar: 'alain', team: ['Charizard', 'Metagross', 'Tyranitar', 'Bisharp', 'Unfezant', 'Weavile']},
  {name: 'Serena', region: 'kalos', avatar: 'serena-anime', team: ['Delphox', 'Sylveon', 'Pancham', 'Braixen', 'Vivillon', 'Gardevoir']},
  {name: 'Sawyer', region: 'kalos', avatar: 'acetrainer', team: ['Sceptile', 'Slaking', 'Aegislash', 'Clawitzer', 'Salamence', 'Treecko']},
  {name: 'Shauna', region: 'kalos', avatar: 'shauna', team: ['Delphox', 'Flabébé', 'Bulbasaur', 'Florges', 'Goodra', 'Sylveon']},
  {name: 'Trevor', region: 'kalos', avatar: 'trevor', team: ['Charizard', 'Florges', 'Aerodactyl', 'Raichu', 'Absol', 'Chesnaught']},
  {name: 'Gladion', region: 'alola', avatar: 'gladion', team: ['Silvally', 'Lucario', 'Lycanroc-Midnight', 'Zoroark', 'Crobat', 'Weavile']},
  {name: 'Hau', region: 'alola', avatar: 'hau', team: ['Primarina', 'Raichu-Alola', 'Komala', 'Vaporeon', 'Crabominable', 'Tauros']},
  {name: 'Lillie', region: 'alola', avatar: 'lillie', team: ['Clefable', 'Ninetales-Alola', 'Comfey', 'Ribombee', 'Lilligant', 'Togekiss']},
  {name: 'Kiawe', region: 'alola', avatar: 'kiawe', team: ['Turtonator', 'Charizard', 'Marowak-Alola', 'Salazzle', 'Arcanine', 'Talonflame']},
  {name: 'Hop', region: 'galar', avatar: 'hop', team: ['Zacian', 'Dubwool', 'Pincurchin', 'Corviknight', 'Snorlax', 'Rillaboom']},
  {name: 'Marnie', region: 'galar', avatar: 'marnie', team: ['Grimmsnarl', 'Morpeko', 'Toxicroak', 'Scrafty', 'Liepard', 'Obstagoon']},
  {name: 'Bede', region: 'galar', avatar: 'bede', team: ['Hatterene', 'Gardevoir', 'Rapidash-Galar', 'Mawile', 'Sylveon', 'Gothitelle']},
  {name: 'Goh', region: 'galar', avatar: 'youngster', team: ['Cinderace', 'Lucario', 'Dragonite', 'Inteleon', 'Gengar', 'Eevee']},
  {name: 'Nemona', region: 'paldea', avatar: 'nemona-v', team: ['Meowscarada', 'Lycanroc', 'Goodra', 'Dudunsparce', 'Orthworm', 'Pawmot']},
  {name: 'Arven', region: 'paldea', avatar: 'arven-v', team: ['Mabosstiff', 'Greedent', 'Cloyster', 'Scovillain', 'Toedscruel', 'Garganacl']},
  {name: 'Penny', region: 'paldea', avatar: 'penny', team: ['Sylveon', 'Umbreon', 'Vaporeon', 'Jolteon', 'Flareon', 'Leafeon']},
  {name: 'Kieran', region: 'paldea', avatar: 'kieran', team: ['Hydrapple', 'Dragonite', 'Incineroar', 'Kingambit', 'Porygon-Z', 'Ogerpon']},
  {name: 'Carmine', region: 'paldea', avatar: 'carmine', team: ['Sinistcha', 'Ninetales', 'Mightyena', 'Crobat', 'Ogerpon', 'Ludicolo']},
];

export const rivalsOf = (region?: string) => RIVALS.filter(r => r.region === region);
export const getRival = (name: string) => RIVALS.find(r => r.name === name);
