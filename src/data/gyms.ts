// Ginásios de cada região (em Alola, as 7 provas). Cada um tem líder, tipo, insígnia e time.

export interface Gym {
  id: string;
  region: string;
  leader: string;
  type: string;
  badge: string;
  /** Time do líder: o último é o "ás". */
  team: string[];
}

type Row = [leader: string, type: string, badge: string, team: string[]];

const ROWS: Record<string, Row[]> = {
  kanto: [
    ['Brock', 'Rock', 'Insígnia da Rocha', ['Geodude', 'Kabuto', 'Rhyhorn', 'Onix']],
    ['Misty', 'Water', 'Insígnia da Cascata', ['Psyduck', 'Staryu', 'Seaking', 'Starmie']],
    ['Lt. Surge', 'Electric', 'Insígnia do Trovão', ['Voltorb', 'Magnemite', 'Electabuzz', 'Raichu']],
    ['Erika', 'Grass', 'Insígnia do Arco-Íris', ['Tangela', 'Weepinbell', 'Victreebel', 'Vileplume']],
    ['Koga', 'Poison', 'Insígnia da Alma', ['Koffing', 'Muk', 'Venomoth', 'Weezing']],
    ['Sabrina', 'Psychic', 'Insígnia do Pântano', ['Mr. Mime', 'Venomoth', 'Jynx', 'Alakazam']],
    ['Blaine', 'Fire', 'Insígnia do Vulcão', ['Growlithe', 'Ponyta', 'Magmar', 'Arcanine']],
    ['Giovanni', 'Ground', 'Insígnia da Terra', ['Dugtrio', 'Nidoqueen', 'Nidoking', 'Rhydon']],
  ],
  johto: [
    ['Falkner', 'Flying', 'Insígnia do Zéfiro', ['Pidgey', 'Hoothoot', 'Noctowl', 'Pidgeotto']],
    ['Bugsy', 'Bug', 'Insígnia da Colmeia', ['Metapod', 'Kakuna', 'Ledian', 'Scyther']],
    ['Whitney', 'Normal', 'Insígnia da Planície', ['Clefairy', 'Aipom', 'Teddiursa', 'Miltank']],
    ['Morty', 'Ghost', 'Insígnia da Névoa', ['Gastly', 'Haunter', 'Misdreavus', 'Gengar']],
    ['Chuck', 'Fighting', 'Insígnia da Tempestade', ['Tyrogue', 'Primeape', 'Hitmontop', 'Poliwrath']],
    ['Jasmine', 'Steel', 'Insígnia Mineral', ['Magnemite', 'Skarmory', 'Forretress', 'Steelix']],
    ['Pryce', 'Ice', 'Insígnia da Geleira', ['Seel', 'Swinub', 'Dewgong', 'Piloswine']],
    ['Clair', 'Dragon', 'Insígnia Ascendente', ['Dragonair', 'Gyarados', 'Dragonair', 'Kingdra']],
  ],
  hoenn: [
    ['Roxanne', 'Rock', 'Insígnia da Pedra', ['Geodude', 'Lileep', 'Anorith', 'Nosepass']],
    ['Brawly', 'Fighting', 'Insígnia do Punho', ['Machop', 'Meditite', 'Machoke', 'Makuhita']],
    ['Wattson', 'Electric', 'Insígnia do Dínamo', ['Voltorb', 'Electrike', 'Magneton', 'Manectric']],
    ['Flannery', 'Fire', 'Insígnia do Calor', ['Numel', 'Slugma', 'Camerupt', 'Torkoal']],
    ['Norman', 'Normal', 'Insígnia do Equilíbrio', ['Spinda', 'Vigoroth', 'Linoone', 'Slaking']],
    ['Winona', 'Flying', 'Insígnia da Pena', ['Swablu', 'Tropius', 'Skarmory', 'Altaria']],
    ['Tate e Liza', 'Psychic', 'Insígnia da Mente', ['Lunatone', 'Solrock', 'Xatu', 'Claydol']],
    ['Wallace', 'Water', 'Insígnia da Chuva', ['Luvdisc', 'Whiscash', 'Sealeo', 'Milotic']],
  ],
  sinnoh: [
    ['Roark', 'Rock', 'Insígnia do Carvão', ['Geodude', 'Onix', 'Bonsly', 'Cranidos']],
    ['Gardenia', 'Grass', 'Insígnia da Floresta', ['Cherubi', 'Turtwig', 'Budew', 'Roserade']],
    ['Maylene', 'Fighting', 'Insígnia do Paralelepípedo', ['Meditite', 'Machoke', 'Riolu', 'Lucario']],
    ['Crasher Wake', 'Water', 'Insígnia do Charco', ['Gyarados', 'Quagsire', 'Buizel', 'Floatzel']],
    ['Fantina', 'Ghost', 'Insígnia da Relíquia', ['Duskull', 'Haunter', 'Drifblim', 'Mismagius']],
    ['Byron', 'Steel', 'Insígnia da Mina', ['Bronzor', 'Magneton', 'Steelix', 'Bastiodon']],
    ['Candice', 'Ice', 'Insígnia do Pingente', ['Snover', 'Sneasel', 'Medicham', 'Froslass']],
    ['Volkner', 'Electric', 'Insígnia do Farol', ['Jolteon', 'Raichu', 'Luxray', 'Electivire']],
  ],
  unova: [
    ['Cilan', 'Grass', 'Insígnia do Trio', ['Lillipup', 'Pansage', 'Petilil', 'Simisage']],
    ['Lenora', 'Normal', 'Insígnia Básica', ['Herdier', 'Minccino', 'Patrat', 'Watchog']],
    ['Burgh', 'Bug', 'Insígnia do Inseto', ['Whirlipede', 'Dwebble', 'Sewaddle', 'Leavanny']],
    ['Elesa', 'Electric', 'Insígnia do Raio', ['Emolga', 'Blitzle', 'Emolga', 'Zebstrika']],
    ['Clay', 'Ground', 'Insígnia do Tremor', ['Krokorok', 'Palpitoad', 'Drilbur', 'Excadrill']],
    ['Skyla', 'Flying', 'Insígnia do Jato', ['Ducklett', 'Woobat', 'Unfezant', 'Swanna']],
    ['Brycen', 'Ice', 'Insígnia do Congelamento', ['Vanillish', 'Cubchoo', 'Cryogonal', 'Beartic']],
    ['Drayden', 'Dragon', 'Insígnia da Lenda', ['Fraxure', 'Druddigon', 'Flygon', 'Haxorus']],
  ],
  kalos: [
    ['Viola', 'Bug', 'Insígnia do Inseto', ['Surskit', 'Scatterbug', 'Venipede', 'Vivillon']],
    ['Grant', 'Rock', 'Insígnia do Penhasco', ['Onix', 'Amaura', 'Tyrunt', 'Tyrunt']],
    ['Korrina', 'Fighting', 'Insígnia do Estrondo', ['Mienfoo', 'Machoke', 'Pancham', 'Hawlucha']],
    ['Ramos', 'Grass', 'Insígnia da Planta', ['Jumpluff', 'Weepinbell', 'Skiddo', 'Gogoat']],
    ['Clemont', 'Electric', 'Insígnia da Voltagem', ['Emolga', 'Magneton', 'Dedenne', 'Heliolisk']],
    ['Valerie', 'Fairy', 'Insígnia da Fada', ['Mawile', 'Mr. Mime', 'Spritzee', 'Sylveon']],
    ['Olympia', 'Psychic', 'Insígnia Psíquica', ['Sigilyph', 'Slowking', 'Espurr', 'Meowstic']],
    ['Wulfric', 'Ice', 'Insígnia do Iceberg', ['Abomasnow', 'Cryogonal', 'Bergmite', 'Avalugg']],
  ],
  alola: [
    ['Ilima', 'Normal', 'Normalium Z', ['Yungoos', 'Smeargle', 'Rattata-Alola', 'Gumshoos']],
    ['Lana', 'Water', 'Waterium Z', ['Wishiwashi', 'Dewpider', 'Wingull', 'Araquanid']],
    ['Kiawe', 'Fire', 'Firium Z', ['Growlithe', 'Fletchinder', 'Marowak-Alola', 'Salazzle']],
    ['Mallow', 'Grass', 'Grassium Z', ['Fomantis', 'Bounsweet', 'Trumbeak', 'Lurantis']],
    ['Sophocles', 'Electric', 'Electrium Z', ['Charjabug', 'Togedemaru', 'Magnemite', 'Vikavolt']],
    ['Acerola', 'Ghost', 'Ghostium Z', ['Sableye', 'Drifblim', 'Froslass', 'Mimikyu']],
    ['Mina', 'Fairy', 'Fairium Z', ['Klefki', 'Granbull', 'Wigglytuff', 'Ribombee']],
  ],
  galar: [
    ['Milo', 'Grass', 'Insígnia da Grama', ['Gossifleur', 'Applin', 'Seedot', 'Eldegoss']],
    ['Nessa', 'Water', 'Insígnia da Água', ['Arrokuda', 'Chewtle', 'Goldeen', 'Drednaw']],
    ['Kabu', 'Fire', 'Insígnia do Fogo', ['Ninetales', 'Arcanine', 'Sizzlipede', 'Centiskorch']],
    ['Bea', 'Fighting', 'Insígnia da Luta', ['Hitmontop', 'Pangoro', 'Sirfetch’d', 'Machamp']],
    ['Opal', 'Fairy', 'Insígnia da Fada', ['Weezing-Galar', 'Mawile', 'Togekiss', 'Alcremie']],
    ['Gordie', 'Rock', 'Insígnia da Pedra', ['Barbaracle', 'Shuckle', 'Stonjourner', 'Coalossal']],
    ['Piers', 'Dark', 'Insígnia Sombria', ['Scrafty', 'Malamar', 'Skuntank', 'Obstagoon']],
    ['Raihan', 'Dragon', 'Insígnia do Dragão', ['Gigalith', 'Flygon', 'Sandaconda', 'Duraludon']],
  ],
  paldea: [
    ['Katy', 'Bug', 'Insígnia do Inseto', ['Nymble', 'Tarountula', 'Teddiursa', 'Lokix']],
    ['Brassius', 'Grass', 'Insígnia da Grama', ['Petilil', 'Smoliv', 'Sunflora', 'Sudowoodo']],
    ['Iono', 'Electric', 'Insígnia Elétrica', ['Wattrel', 'Bellibolt', 'Luxio', 'Mismagius']],
    ['Kofu', 'Water', 'Insígnia da Água', ['Veluza', 'Wugtrio', 'Crabominable', 'Crawdaunt']],
    ['Larry', 'Normal', 'Insígnia Normal', ['Komala', 'Dudunsparce', 'Oinkologne', 'Staraptor']],
    ['Ryme', 'Ghost', 'Insígnia Fantasma', ['Banette', 'Mimikyu', 'Houndstone', 'Toxtricity']],
    ['Tulip', 'Psychic', 'Insígnia Psíquica', ['Farigiraf', 'Gardevoir', 'Espathra', 'Florges']],
    ['Grusha', 'Ice', 'Insígnia do Gelo', ['Frosmoth', 'Beartic', 'Cetitan', 'Altaria']],
  ],
};

export const GYMS: Gym[] = Object.entries(ROWS).flatMap(([region, rows]) =>
  rows.map(([leader, type, badge, team], i) => ({id: `${region}-${i + 1}`, region, leader, type, badge, team})),
);

export function gymsOf(region: string | undefined): Gym[] {
  return GYMS.filter(g => g.region === region);
}

export function getGym(id: string): Gym | undefined {
  return GYMS.find(g => g.id === id);
}

/** Nome da caderneta: em Alola são provas. */
export function bookName(region: string): string {
  return region === 'alola' ? 'Provas de Alola' : 'Caderneta de insígnias';
}

/** Bioma da arena de cada tipo de ginásio. */
export const GYM_BIOME: Record<string, string> = {
  Rock: 'cave', Water: 'lake', Electric: 'powerplant', Grass: 'forest', Poison: 'swamp', Psychic: 'ruins',
  Fire: 'volcano', Ground: 'desert', Flying: 'sky', Bug: 'forest', Normal: 'city', Ghost: 'graveyard',
  Fighting: 'dojo', Steel: 'mountain', Ice: 'snow', Dragon: 'dragon', Fairy: 'fairy', Dark: 'abyss',
};
