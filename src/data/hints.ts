// Dicas dos viajantes: lendas meio enigmáticas sobre Pokémon lendários. Com a dica no
// diário, estar na região e no bioma certos dá uma boa chance de o lendário aparecer.

export interface Hint {
  id: string;
  species: string;
  region: string;
  biome: string;
  text: string;
}

export const HINTS: Hint[] = [
  {id: 'mewtwo', species: 'Mewtwo', region: 'kanto', biome: 'ceruleancave', text: 'Dizem que, numa caverna escondida perto de Cerulean, um Pokémon criado pelos homens espera alguém forte o bastante.'},
  {id: 'mew', species: 'Mew', region: 'kanto', biome: 'forest', text: 'Nas florestas de Kanto, às vezes uma bolinha rosa ri entre as folhas... e some quando você olha.'},
  {id: 'articuno', species: 'Articuno', region: 'kanto', biome: 'snow', text: 'Um pássaro de gelo dorme nas cavernas mais frias de Kanto. Onde ele voa, cai neve.'},
  {id: 'zapdos', species: 'Zapdos', region: 'kanto', biome: 'powerplant', text: 'Quando os raios caem nas planícies elétricas de Kanto, um pássaro amarelo dança no meio da tempestade.'},
  {id: 'moltres', species: 'Moltres', region: 'kanto', biome: 'volcano', text: 'Um pássaro de fogo faz ninho na boca dos vulcões de Kanto.'},
  {id: 'hooh', species: 'Ho-Oh', region: 'johto', biome: 'tintower', text: 'No alto de uma torre antiga de Johto, um arco-íris aparece antes do pássaro sagrado.'},
  {id: 'lugia', species: 'Lugia', region: 'johto', biome: 'sea', text: 'No fundo do mar de Johto, entre redemoinhos, o guardião dos mares canta baixinho.'},
  {id: 'celebi', species: 'Celebi', region: 'johto', biome: 'forest', text: 'Num bosque de Johto, o tempo às vezes para. Quem viu fala de uma fadinha verde.'},
  {id: 'rayquaza', species: 'Rayquaza', region: 'hoenn', biome: 'skypillar', text: 'Dizem que numa torre de Hoenn que toca o céu, quando as nuvens fecham, um dragão verde desce lá do alto...'},
  {id: 'kyogre', species: 'Kyogre', region: 'hoenn', biome: 'sea', text: 'Nas águas profundas de Hoenn, algo gigante faz a chuva não parar nunca.'},
  {id: 'groudon', species: 'Groudon', region: 'hoenn', biome: 'volcano', text: 'Sob os vulcões de Hoenn, a terra treme e o sol arde mais forte. Algo enorme dorme lá.'},
  {id: 'giratina', species: 'Giratina', region: 'sinnoh', biome: 'distortion', text: 'Em Sinnoh, há um lugar onde o chão vira teto e as cachoeiras sobem. Uma sombra o governa.'},
  {id: 'dialga', species: 'Dialga', region: 'sinnoh', biome: 'ruins', text: 'Nas ruínas de Sinnoh, os relógios param. O senhor do tempo passou por ali.'},
  {id: 'palkia', species: 'Palkia', region: 'sinnoh', biome: 'lake', text: 'Nos lagos de Sinnoh, o horizonte às vezes se dobra. O senhor do espaço gosta da água.'},
  {id: 'reshiram', species: 'Reshiram', region: 'unova', biome: 'dragonspiral', text: 'Na torre mais antiga de Unova, uma chama branca procura quem busca a verdade.'},
  {id: 'zekrom', species: 'Zekrom', region: 'unova', biome: 'powerplant', text: 'Nas planícies de Unova, um trovão negro corta o céu atrás de quem tem ideais.'},
  {id: 'kyurem', species: 'Kyurem', region: 'unova', biome: 'snow', text: 'Numa caverna gelada de Unova, um dragão vazio espera a parte que lhe falta.'},
  {id: 'zygarde', species: 'Zygarde', region: 'kalos', biome: 'terminus', text: 'No fim de uma caverna de Kalos, células verdes se juntam para proteger o equilíbrio.'},
  {id: 'xerneas', species: 'Xerneas', region: 'kalos', biome: 'fairy', text: 'Num bosque encantado de Kalos, uma árvore de chifres coloridos dá vida a tudo em volta.'},
  {id: 'yveltal', species: 'Yveltal', region: 'kalos', biome: 'abyss', text: 'No abismo de Kalos, as plantas murcham sob a sombra de asas vermelhas.'},
  {id: 'necrozma', species: 'Necrozma', region: 'alola', biome: 'ultraspace', text: 'Em Alola, um buraco no céu leva a um mundo de luz. Lá vive quem rouba a luz.'},
  {id: 'tapukoko', species: 'Tapu Koko', region: 'alola', biome: 'powerplant', text: 'O guardião de Melemele adora uma boa briga quando os raios caem em Alola.'},
  {id: 'zacian', species: 'Zacian', region: 'galar', biome: 'slumbering', text: 'Numa floresta de névoa em Galar, uma espada enferrujada espera o herói certo.'},
  {id: 'eternatus', species: 'Eternatus', region: 'galar', biome: 'dragon', text: 'Sob Galar, uma energia roxa pulsa num covil de dragões. Não era para ninguém acordá-la.'},
  {id: 'koraidon', species: 'Koraidon', region: 'paldea', biome: 'area0', text: 'No fundo da cratera de Paldea, um lagarto de outra era corre mais rápido que o vento.'},
  {id: 'tinglu', species: 'Ting-Lu', region: 'paldea', biome: 'cave', text: 'Nas cavernas de Paldea, estacas antigas prendem um tesouro maldito.'},
];

export function getHint(id: string): Hint | undefined {
  return HINTS.find(h => h.id === id);
}
