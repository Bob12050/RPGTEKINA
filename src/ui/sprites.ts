// ============================================================
// ドット絵スプライト(コード生成・画像ファイル不要)
// 16x16 の文字グリッド:
//   . = 透明   # = 輪郭   1,2,3 = 種族パレット   W = 白   K = 黒
// 系統ごとに1つの形を持ち、種族ごとの3色パレットで塗り分ける。
// ============================================================
import type { Family, TileKind } from '../core/types';

export const SPRITE_SIZE = 16;

const SLIME = [
  '................',
  '................',
  '......####......',
  '....##1111##....',
  '...#11111111#...',
  '..#1111111111#..',
  '..#11W1111W11#..',
  '.#111K1111K111#.',
  '.#111111111111#.',
  '.#111211112111#.',
  '.#111111111111#.',
  '.#211111111112#.',
  '..#2111111112#..',
  '...##211112##...',
  '.....######.....',
  '................',
];

const DRAGON = [
  '................',
  '..###...........',
  '.#111##.........',
  '.#1W111#........',
  '.#11111#...##...',
  '..#111#...#12#..',
  '..#11111##112#..',
  '.#1131111111#...',
  '.#1122111111#...',
  '.#1122211111#...',
  '.#1112211111#...',
  '.#1111111111#...',
  '..#11#....#11#..',
  '..#11#....#11#..',
  '..####....####..',
  '................',
];

const BEAST = [
  '................',
  '.##.....##......',
  '.#1#...#1#......',
  '.#11###11#......',
  '.#11111111#.....',
  '.#1W1111W1#.....',
  '.#11111111####..',
  '.#113311111112#.',
  '..#33111111112#.',
  '..#11111111112#.',
  '...#1111111111#.',
  '...#111#..#111#.',
  '...#11#....#11#.',
  '...####...####..',
  '................',
  '................',
];

const NATURE = [
  '................',
  '.....######.....',
  '...##111111##...',
  '..#1113311111#..',
  '.#111111111133#.',
  '.#131111111111#.',
  '.##############.',
  '...#22222222#...',
  '...#2W2222W2#...',
  '...#22222222#...',
  '...#22K22K22#...',
  '...#22222222#...',
  '....#222222#....',
  '....########....',
  '................',
  '................',
];

const DEMON = [
  '..#........#....',
  '.#2#......#2#...',
  '.#22#....#22#...',
  '..#22####22#....',
  '...#111111#.....',
  '..#11W11W11#....',
  '..#11111111#....',
  '..#11KKKK11#....',
  '.#3#111111#3#...',
  '#33#111111#33#..',
  '#3#11111111#3#..',
  '...#111111#.....',
  '..#11#..#11#....',
  '..####..####....',
  '................',
  '................',
];

const ZOMBIE = [
  '................',
  '.....######.....',
  '...##111111##...',
  '..#1111111111#..',
  '.#111111111111#.',
  '.#11K1111K1111#.',
  '.#111111111111#.',
  '.#112111121111#.',
  '.#111111111111#.',
  '.#111111111111#.',
  '.#111111111111#.',
  '.#1#11#11#11#1#.',
  '.##.##..##..##..',
  '................',
  '................',
  '................',
];

const MATERIAL = [
  '................',
  '....########....',
  '...#11111111#...',
  '...#1W1111W1#...',
  '...#11111111#...',
  '.###11111111###.',
  '#11##111111##11#',
  '#11#11222211#11#',
  '#11#11222211#11#',
  '####11111111####',
  '...#11111111#...',
  '...#111##111#...',
  '..#111#..#111#..',
  '..#111#..#111#..',
  '..#####..#####..',
  '................',
];

const MYSTIC = [
  '................',
  '......#3#.......',
  '.....#131#......',
  '....#11111#.....',
  '....#1W111#.....',
  '..##111111##....',
  '.#2211111122#...',
  '#222111111122#..',
  '#2211111111222#.',
  '.#211111111112#.',
  '..#1111111111#..',
  '...#11111111#...',
  '....#111111#....',
  '.....#3113#.....',
  '......#33#......',
  '................',
];

export const FAMILY_SPRITES: Record<Family, string[]> = {
  slime: SLIME,
  dragon: DRAGON,
  beast: BEAST,
  nature: NATURE,
  demon: DEMON,
  zombie: ZOMBIE,
  material: MATERIAL,
  mystic: MYSTIC,
};

export const HERO_SPRITE = [
  '................',
  '.....######.....',
  '....#HHHHHH#....',
  '....#HHHHHH#....',
  '....#FFFFFF#....',
  '....#FKFFKF#....',
  '....#FFFFFF#....',
  '.....#CCCC#.....',
  '....#CCCCCC#....',
  '...#FCCCCCCF#...',
  '....#CCCCCC#....',
  '....#LL#LL#.....',
  '....#LL#LL#.....',
  '....##..##......',
  '................',
  '................',
];

const HERO_COLORS: Record<string, string> = {
  '#': '#1a1a24',
  H: '#8c5a2b',
  F: '#f5c9a0',
  C: '#3d7bff',
  L: '#3d3348',
  W: '#ffffff',
  K: '#1a1a24',
};

/** 文字グリッドスプライトを描画する */
export function drawGridSprite(
  ctx: CanvasRenderingContext2D,
  grid: string[],
  colors: Record<string, string>,
  x: number,
  y: number,
  scale: number,
): void {
  for (let j = 0; j < grid.length; j++) {
    const row = grid[j]!;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]!;
      if (ch === '.') continue;
      const color = colors[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    }
  }
}

export function monsterColors(palette: [string, string, string]): Record<string, string> {
  return {
    '1': palette[0],
    '2': palette[1],
    '3': palette[2],
    '#': '#141420',
    W: '#ffffff',
    K: '#141420',
  };
}

export function drawMonster(
  ctx: CanvasRenderingContext2D,
  family: Family,
  palette: [string, string, string],
  x: number,
  y: number,
  scale: number,
): void {
  drawGridSprite(ctx, FAMILY_SPRITES[family], monsterColors(palette), x, y, scale);
}

export function drawHero(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  drawGridSprite(ctx, HERO_SPRITE, HERO_COLORS, x, y, scale);
}

// ============================================================
// タイル描画(プロシージャル・画像不要)
// ============================================================

/** タイルごとの装飾に使う決定的ハッシュ */
function tileHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  kind: TileKind,
  px: number,
  py: number,
  size: number,
  tx: number,
  ty: number,
  time: number,
): void {
  const h = tileHash(tx, ty);
  switch (kind) {
    case 'grass': {
      ctx.fillStyle = '#3f9e4d';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#358a42';
      if (h > 0.5) ctx.fillRect(px + size * 0.2, py + size * 0.3, 3, 6);
      if (h > 0.25) ctx.fillRect(px + size * 0.65, py + size * 0.6, 3, 6);
      break;
    }
    case 'flower': {
      ctx.fillStyle = '#3f9e4d';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = h > 0.5 ? '#ffd94a' : '#ff8ad8';
      ctx.fillRect(px + size * 0.35, py + size * 0.3, 6, 6);
      ctx.fillRect(px + size * 0.6, py + size * 0.6, 5, 5);
      break;
    }
    case 'path': {
      ctx.fillStyle = '#d8b980';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#c9a86b';
      if (h > 0.4) ctx.fillRect(px + size * 0.3, py + size * 0.5, 5, 3);
      break;
    }
    case 'sand': {
      ctx.fillStyle = '#e8d5a0';
      ctx.fillRect(px, py, size, size);
      break;
    }
    case 'tree': {
      ctx.fillStyle = '#3f9e4d';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(px + size * 0.4, py + size * 0.55, size * 0.2, size * 0.4);
      ctx.fillStyle = '#1f6b2e';
      ctx.beginPath();
      ctx.arc(px + size / 2, py + size * 0.38, size * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a8a3c';
      ctx.beginPath();
      ctx.arc(px + size * 0.38, py + size * 0.3, size * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'water': {
      ctx.fillStyle = '#2a6fd6';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#4a8ae8';
      const wave = Math.sin(time * 2 + tx + ty) * 2;
      ctx.fillRect(px + size * 0.15, py + size * 0.3 + wave, size * 0.4, 2);
      ctx.fillRect(px + size * 0.5, py + size * 0.65 - wave, size * 0.35, 2);
      break;
    }
    case 'mountain': {
      ctx.fillStyle = '#8c7a5c';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#6b5a40';
      ctx.beginPath();
      ctx.moveTo(px + size * 0.1, py + size * 0.9);
      ctx.lineTo(px + size * 0.5, py + size * 0.15);
      ctx.lineTo(px + size * 0.9, py + size * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath();
      ctx.moveTo(px + size * 0.4, py + size * 0.33);
      ctx.lineTo(px + size * 0.5, py + size * 0.15);
      ctx.lineTo(px + size * 0.6, py + size * 0.33);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'wall': {
      ctx.fillStyle = '#4a4a5c';
      ctx.fillRect(px, py, size, size);
      ctx.strokeStyle = '#333344';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, size - 4, size / 2 - 2);
      ctx.strokeRect(px + 2, py + size / 2 + 2, size / 2 - 4, size / 2 - 4);
      ctx.strokeRect(px + size / 2 + 2, py + size / 2 + 2, size / 2 - 4, size / 2 - 4);
      break;
    }
    case 'cave': {
      ctx.fillStyle = '#5c5248';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#4d443c';
      if (h > 0.6) ctx.fillRect(px + size * 0.3, py + size * 0.4, 5, 4);
      break;
    }
    case 'lava': {
      ctx.fillStyle = '#d63d1a';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#f0823d';
      const bubble = (Math.sin(time * 3 + h * 10) + 1) / 2;
      ctx.beginPath();
      ctx.arc(px + size * (0.3 + h * 0.4), py + size * 0.5, 3 + bubble * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.fillRect(px + size * 0.6, py + size * 0.25, 4, 3);
      break;
    }
    case 'bridge': {
      ctx.fillStyle = '#a87a4a';
      ctx.fillRect(px, py, size, size);
      ctx.strokeStyle = '#8c5c26';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(px, py + (size / 4) * i);
        ctx.lineTo(px + size, py + (size / 4) * i);
        ctx.stroke();
      }
      break;
    }
    case 'building': {
      ctx.fillStyle = '#c2b8a0';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#a5462b';
      ctx.fillRect(px, py, size, size * 0.4);
      ctx.fillStyle = '#5c4a3d';
      ctx.fillRect(px + size * 0.35, py + size * 0.55, size * 0.3, size * 0.45);
      break;
    }
    case 'stairs': {
      ctx.fillStyle = '#2b2b38';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#55556b';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px + i * (size / 5), py + i * (size / 5), size - i * (size / 5) * 2 > 0 ? size - i * (size / 5) * 2 : 4, 4);
      }
      break;
    }
  }
}
