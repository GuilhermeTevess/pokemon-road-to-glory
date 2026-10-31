// Visual de treinador personalizado (pixel art 16×24). Guardado no próprio campo
// `avatar` do treinador como "custom:<índices>", então saves antigos continuam valendo.

export interface Look {
  skin: number;
  hair: number;
  hairColor: number;
  hat: number;
  hatColor: number;
  shirt: number;
  pants: number;
  shoes: number;
  eyes: number;
}

export const SKINS = ['#ffe0c4', '#f4c8a0', '#d9a074', '#a86c44', '#6e4428'];
export const HAIR_STYLES = ['Curto', 'Longo', 'Espetado', 'Rabo de cavalo', 'Coque', 'Careca'];
export const HAIR_COLORS = ['#784628', '#2c2430', '#e8c45c', '#c8582c', '#f08cb4', '#4c78d8', '#4cae5c', '#e8e8f0'];
export const HATS = ['Nenhum', 'Boné', 'Gorro'];
/** Cores de roupa (chapéu, camisa, calça e sapato usam a mesma paleta). */
export const CLOTHES = ['#dc4646', '#f08c2c', '#f0d040', '#4cae5c', '#2c9c9c', '#3c64c8', '#8c54c8', '#f08cb4', '#f4f4f4', '#3c3c48', '#8c6440'];
export const EYES = ['#1e1e3c', '#3c64c8', '#3c8c3c', '#8c5028', '#c83c3c'];

/** Ordem dos campos na string salva. */
const KEYS: (keyof Look)[] = ['skin', 'hair', 'hairColor', 'hat', 'hatColor', 'shirt', 'pants', 'shoes', 'eyes'];
const SIZES: Record<keyof Look, number> = {
  skin: SKINS.length, hair: HAIR_STYLES.length, hairColor: HAIR_COLORS.length, hat: HATS.length, hatColor: CLOTHES.length,
  shirt: CLOTHES.length, pants: CLOTHES.length, shoes: CLOTHES.length, eyes: EYES.length,
};

export const DEFAULT_LOOK: Look = {skin: 1, hair: 0, hairColor: 0, hat: 1, hatColor: 0, shirt: 5, pants: 9, shoes: 0, eyes: 0};

export const isCustom = (avatar: string) => avatar.startsWith('custom:');

export function encodeLook(l: Look): string {
  return 'custom:' + KEYS.map(k => l[k]).join('-');
}

export function decodeLook(avatar: string): Look {
  const parts = avatar.slice('custom:'.length).split('-').map(Number);
  const look = {...DEFAULT_LOOK};
  KEYS.forEach((k, i) => {
    const v = parts[i];
    if (Number.isInteger(v) && v >= 0 && v < SIZES[k]) look[k] = v;
  });
  return look;
}

export function randomLook(rand: () => number = Math.random): Look {
  const look = {} as Look;
  for (const k of KEYS) look[k] = Math.floor(rand() * SIZES[k]);
  // Chapéu é opcional: metade das vezes sem.
  if (rand() < 0.5) look.hat = 0;
  return look;
}

/** Quantas opções cada campo tem (para os botões ‹ ›). */
export const lookSize = (k: keyof Look) => SIZES[k];

// --- Pixel art --------------------------------------------------------------
// O contorno, S/s pele, E olhos, H/h cabelo, T/t camisa, P calça, B sapato, C/c chapéu, W branco.
const BASE = [
  '................',
  '................',
  '.....OOOOOO.....',
  '....OSSSSSSO....',
  '...OSSSSSSSSO...',
  '...OSSSSSSSSO...',
  '...OSSESSESSO...',
  '...OSSESSESSO...',
  '...OSSSSSSSSO...',
  '....OSSssSSO....',
  '.....OOSSOO.....',
  '....OTTTTTTO....',
  '...OTTTttTTTO...',
  '..OSOTTttTTOSO..',
  '..OSOTTttTTOSO..',
  '..OSOTTTTTTOSO..',
  '...OOPPPPPPOO...',
  '....OPPPPPPO....',
  '....OPPOOPPO....',
  '....OPPOOPPO....',
  '....OPPOOPPO....',
  '....OBBOOBBO....',
  '...OBBBOOBBBO...',
  '...OOOOOOOOOO...',
];

const HAIR: string[][] = [
  // Curto
  ['................', '.....OOOOOO.....', '....OHHHHHHO....', '...OHHHHHHHHO...', '...OHHhHHhHHO...', '...OH......HO...'],
  // Longo
  [
    '................', '.....OOOOOO.....', '....OHHHHHHO....', '...OHHHHHHHHO...', '..OHHHhHHhHHHO..', '..OHH......HHO..',
    '..OHO......OHO..', '..OHO......OHO..', '..OHO......OHO..', '..OHHO....OHHO..', '..OHHO....OHHO..', '...OO......OO...',
  ],
  // Espetado
  ['...O..O..O..O...', '..OHOOHOOHOOHO..', '...OHHHHHHHHO...', '..OHHHHHHHHHHO..', '...OHHhHHhHHO...', '...OH......HO...'],
  // Rabo de cavalo
  [
    '................', '.....OOOOOO.....', '....OHHHHHHOO...', '...OHHHHHHHHHO..', '...OHHhHHhHHOHO.', '...OH......HOHO.',
    '............OHO.', '............OHO.', '............OHO.', '.............O..',
  ],
  // Coque
  ['......OOOO......', '.....OHHHHO.....', '.....OOOOOO.....', '....OHHHHHHO....', '...OHHHHHHHHO...', '...OHHhHHhHHO...', '...OH......HO...'],
  // Careca
  [],
];

const HAT: string[][] = [
  [],
  // Boné
  ['................', '.....OOOOOO.....', '....OCCCCCCO....', '...OCCCWWCCCO...', '...OCCCCCCCCO...', '...OccccccccccO.', '....OOOOOOOOOO..'],
  // Gorro
  ['.......OO.......', '......OCCO......', '.....OOOOOO.....', '....OCCCCCCO....', '...OCCCCCCCCO...', '...OccccccccO...', '...OOOOOOOOOO...'],
];

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * f));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Grade de cores (null = transparente) do visual. */
export function lookPixels(l: Look): (string | null)[][] {
  const g = BASE.map(r => r.split(''));
  const over = (layer: string[], fromRow = 0) =>
    layer.forEach((row, y) => {
      if (y < fromRow) return;
      row.split('').forEach((c, x) => {
        if (c !== '.') g[y][x] = c;
      });
    });
  // Com chapéu, o topo do cabelo (pontas, coque) fica escondido.
  over(HAIR[l.hair], l.hat ? 3 : 0);
  over(HAT[l.hat]);
  const shirt = CLOTHES[l.shirt];
  const pal: Record<string, string> = {
    O: '#282038', S: SKINS[l.skin], s: shade(SKINS[l.skin], 0.85), E: EYES[l.eyes],
    H: HAIR_COLORS[l.hairColor], h: shade(HAIR_COLORS[l.hairColor], 0.75),
    T: shirt, t: shade(shirt, 0.8), P: CLOTHES[l.pants], B: CLOTHES[l.shoes],
    C: CLOTHES[l.hatColor], c: shade(CLOTHES[l.hatColor], 0.78), W: '#ffffff',
  };
  return g.map(r => r.map(c => pal[c] ?? null));
}

/** Visual fixo a partir de um nome (para quem não tem sprite). */
export function lookFromName(name: string): Look {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let s = h || 1;
  return randomLook(() => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648));
}
