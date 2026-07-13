// ============================================================
// マップデータ
// 小さいマップはASCIIアート、大きいフィールドはビルダーで組み立てる。
// タイル文字:
//   . 草原   , 道   T 木   ~ 水   ^ 山   # 壁   = 橋
//   c 洞窟床 L 溶岩 s 砂   f 花   B 建物 > 階段
// ============================================================
import type { MapDef, TileKind } from '../core/types';

export const CHAR_TO_TILE: Record<string, TileKind> = {
  '.': 'grass',
  ',': 'path',
  T: 'tree',
  '~': 'water',
  '^': 'mountain',
  '#': 'wall',
  '=': 'bridge',
  c: 'cave',
  L: 'lava',
  s: 'sand',
  f: 'flower',
  B: 'building',
  '>': 'stairs',
};

export const WALKABLE: Record<TileKind, boolean> = {
  grass: true,
  path: true,
  bridge: true,
  cave: true,
  sand: true,
  flower: true,
  stairs: true,
  tree: false,
  water: false,
  mountain: false,
  wall: false,
  lava: false,
  building: false,
};

// ---- マップビルダー(大きいフィールド用) ----
type Grid = string[][];

function makeGrid(w: number, h: number, fill: string): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

function set(g: Grid, x: number, y: number, ch: string): void {
  const row = g[y];
  if (row && x >= 0 && x < row.length) row[x] = ch;
}

function fillRect(g: Grid, x: number, y: number, w: number, h: number, ch: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, ch);
}

function border(g: Grid, ch: string): void {
  const h = g.length;
  const w = g[0]!.length;
  fillRect(g, 0, 0, w, 1, ch);
  fillRect(g, 0, h - 1, w, 1, ch);
  fillRect(g, 0, 0, 1, h, ch);
  fillRect(g, w - 1, 0, 1, h, ch);
}

function toRows(g: Grid): string[] {
  return g.map((row) => row.join(''));
}

// ---- はじまりのむら(ASCIIアート・エンカウントなし) ----
const VILLAGE: MapDef = {
  id: 'village',
  name: 'はじまりのむら',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'T......ff......ff......T',
    'T..BB........BB........T',
    'T..BB..,,,,,,..BB......T',
    'T......,....,..........T',
    'T..BB..,....,...BB.....T',
    'T..BB..,....,...BB.....T',
    'T......,....,..........T',
    'T~~~...,....,....f.....T',
    'T~~~...,....,..........T',
    'T......,....,......BB..T',
    'T..ff..,....,......BB..T',
    'T......,,,,,,..........T',
    'T...........,..........T',
    'T...........,...ff.....T',
    'TTTTTTTTTTTT,TTTTTTTTTTT',
  ],
  encounterRate: 0,
  encounters: [],
  portals: [{ x: 12, y: 15, toMap: 'plains', toX: 18, toY: 1 }],
  npcs: [
    {
      x: 9,
      y: 5,
      name: 'むらおさエルダ',
      color: '#e0c080',
      lines: [
        'ようこそ モンスターマスターの たまごよ。',
        'この せかいでは モンスターを スカウトして なかまにし、はいごうで あたらしい いのちを うみだすのじゃ。',
        'かざんの おくに ひそむ まりゅうテキーナを たおすことが おぬしの しめいじゃ!',
        'まずは みなみの そうげんで なかまを ふやすが よい。',
      ],
    },
    {
      x: 10,
      y: 10,
      name: 'シスター・ミア',
      color: '#f0f0ff',
      action: 'heal',
      lines: ['つかれた モンスターたちを いやしてあげましょう。'],
    },
    {
      x: 16,
      y: 7,
      name: 'どうぐやのドン',
      color: '#c08040',
      action: 'shop',
      lines: ['いらっしゃい! ぼうけんの おともに どうぐは どうだい?'],
    },
    {
      x: 14,
      y: 4,
      name: 'はいごうじいさん',
      color: '#b080f0',
      action: 'synthesis',
      lines: ['わしは はいごうの けんきゅうか。レベル10いじょうの モンスター 2たいを あずければ あたらしい モンスターを うみだせるぞい。'],
    },
    {
      x: 19,
      y: 12,
      name: 'ぼくじょうのハンナ',
      color: '#80c060',
      action: 'farm',
      lines: ['ぼくじょうでは なかまに した モンスターを あずかって いるよ。パーティの いれかえも できるからね。'],
    },
    {
      x: 11,
      y: 13,
      name: 'むらびとポポ',
      color: '#a0a0e0',
      lines: [
        'たたかいで「スカウト」を えらぶと モンスターを なかまに さそえるんだ。',
        'あいての HPを へらしてからのほうが せいこうしやすい らしいよ!',
      ],
    },
  ],
  maxGroupSize: 1,
};

// ---- そよかぜそうげん ----
function buildPlains(): MapDef {
  const g = makeGrid(36, 24, '.');
  border(g, 'T');
  // 村への出入口(北)
  set(g, 18, 0, ',');
  for (let y = 1; y <= 4; y++) set(g, 18, y, ',');
  // 湖
  fillRect(g, 8, 9, 6, 5, '~');
  // 木立ち
  fillRect(g, 4, 4, 3, 2, 'T');
  fillRect(g, 24, 5, 4, 2, 'T');
  fillRect(g, 27, 16, 3, 3, 'T');
  fillRect(g, 15, 15, 2, 2, 'T');
  // 花
  set(g, 6, 8, 'f');
  set(g, 21, 3, 'f');
  set(g, 30, 9, 'f');
  set(g, 12, 17, 'f');
  set(g, 23, 20, 'f');
  // 南西の山と どうくつの いりぐち
  fillRect(g, 2, 19, 7, 4, '^');
  set(g, 5, 19, '>');
  // 東の もりへの みち
  set(g, 35, 12, ',');
  set(g, 34, 12, ',');
  return {
    id: 'plains',
    name: 'そよかぜそうげん',
    tiles: toRows(g),
    encounterRate: 1 / 11,
    encounters: [
      { speciesId: 'puni', minLevel: 1, maxLevel: 3, weight: 30 },
      { speciesId: 'rabbit', minLevel: 1, maxLevel: 3, weight: 25 },
      { speciesId: 'mandra', minLevel: 1, maxLevel: 3, weight: 20 },
      { speciesId: 'goblin', minLevel: 2, maxLevel: 4, weight: 15 },
      { speciesId: 'ghost', minLevel: 2, maxLevel: 4, weight: 10 },
      { speciesId: 'muddoll', minLevel: 2, maxLevel: 4, weight: 10 },
      { speciesId: 'tsunopuni', minLevel: 3, maxLevel: 5, weight: 8 },
      { speciesId: 'wolf', minLevel: 3, maxLevel: 5, weight: 8 },
      { speciesId: 'myconid', minLevel: 3, maxLevel: 5, weight: 6 },
    ],
    portals: [
      { x: 18, y: 0, toMap: 'village', toX: 12, toY: 14 },
      { x: 5, y: 19, toMap: 'cave', toX: 2, toY: 19 },
      { x: 35, y: 12, toMap: 'forest', toX: 1, toY: 12 },
    ],
    npcs: [
      {
        x: 20,
        y: 10,
        name: 'たびびとリノ',
        color: '#e09060',
        lines: [
          'ひがしの もりには つよい モンスターが すんでいるよ。',
          '「モンスターのごちそう」を つかうと スカウトが せいこうしやすく なるんだって!',
        ],
      },
    ],
    maxGroupSize: 2,
  };
}

// ---- こもれびのもり ----
function buildForest(): MapDef {
  const g = makeGrid(32, 22, '.');
  border(g, 'T');
  // 深い木々
  fillRect(g, 4, 3, 5, 3, 'T');
  fillRect(g, 14, 2, 6, 2, 'T');
  fillRect(g, 24, 4, 4, 4, 'T');
  fillRect(g, 6, 10, 3, 5, 'T');
  fillRect(g, 18, 9, 4, 3, 'T');
  fillRect(g, 12, 16, 6, 3, 'T');
  fillRect(g, 25, 14, 3, 4, 'T');
  // 池
  fillRect(g, 21, 17, 4, 3, '~');
  // 花
  set(g, 10, 7, 'f');
  set(g, 23, 12, 'f');
  set(g, 4, 18, 'f');
  set(g, 29, 10, 'f');
  // 西の そうげんへの みち
  set(g, 0, 12, ',');
  set(g, 1, 12, ',');
  set(g, 2, 12, ',');
  return {
    id: 'forest',
    name: 'こもれびのもり',
    tiles: toRows(g),
    encounterRate: 1 / 10,
    encounters: [
      { speciesId: 'myconid', minLevel: 6, maxLevel: 9, weight: 25 },
      { speciesId: 'wolf', minLevel: 6, maxLevel: 9, weight: 20 },
      { speciesId: 'killerplant', minLevel: 7, maxLevel: 11, weight: 20 },
      { speciesId: 'mandra', minLevel: 6, maxLevel: 8, weight: 10 },
      { speciesId: 'fangwolf', minLevel: 8, maxLevel: 12, weight: 15 },
      { speciesId: 'treant', minLevel: 10, maxLevel: 14, weight: 10 },
      { speciesId: 'dryad', minLevel: 12, maxLevel: 16, weight: 4 },
      { speciesId: 'eldertreant', minLevel: 14, maxLevel: 16, weight: 1 },
    ],
    portals: [{ x: 0, y: 12, toMap: 'plains', toX: 34, toY: 12 }],
    npcs: [
      {
        x: 10,
        y: 5,
        name: 'きこりのガス',
        color: '#c0a060',
        lines: [
          'はいごうは レベル10いじょうの モンスターしか できないんだ。',
          'とくべつな くみあわせで しか うまれない でんせつの モンスターも いるらしいぜ…。',
        ],
      },
    ],
    maxGroupSize: 2,
  };
}

// ---- ちていどうくつ ----
function buildCave(): MapDef {
  const g = makeGrid(30, 22, 'c');
  border(g, '#');
  // 岩壁で通路を作る
  fillRect(g, 5, 3, 2, 8, '#');
  fillRect(g, 10, 8, 8, 2, '#');
  fillRect(g, 13, 14, 2, 6, '#');
  fillRect(g, 20, 3, 2, 9, '#');
  fillRect(g, 24, 14, 4, 2, '#');
  fillRect(g, 8, 16, 3, 2, '#');
  // 地底湖
  fillRect(g, 3, 13, 4, 3, '~');
  // 入口と 奥への階段
  set(g, 2, 19, '>');
  set(g, 27, 2, '>');
  return {
    id: 'cave',
    name: 'ちていどうくつ',
    tiles: toRows(g),
    encounterRate: 1 / 10,
    encounters: [
      { speciesId: 'skeleton', minLevel: 9, maxLevel: 13, weight: 22 },
      { speciesId: 'imp', minLevel: 9, maxLevel: 13, weight: 20 },
      { speciesId: 'karakuri', minLevel: 10, maxLevel: 14, weight: 18 },
      { speciesId: 'dekapuni', minLevel: 10, maxLevel: 14, weight: 15 },
      { speciesId: 'orc', minLevel: 11, maxLevel: 15, weight: 15 },
      { speciesId: 'ghoul', minLevel: 11, maxLevel: 15, weight: 12 },
      { speciesId: 'stoneman', minLevel: 12, maxLevel: 16, weight: 12 },
      { speciesId: 'lizardron', minLevel: 12, maxLevel: 16, weight: 10 },
      { speciesId: 'mahopuni', minLevel: 13, maxLevel: 17, weight: 8 },
      { speciesId: 'wraith', minLevel: 14, maxLevel: 18, weight: 6 },
      { speciesId: 'frostdragon', minLevel: 15, maxLevel: 18, weight: 2 },
      { speciesId: 'lich', minLevel: 16, maxLevel: 18, weight: 1 },
      { speciesId: 'metapuni', minLevel: 12, maxLevel: 15, weight: 1 },
    ],
    portals: [
      { x: 2, y: 19, toMap: 'plains', toX: 5, toY: 18 },
      { x: 27, y: 2, toMap: 'volcano', toX: 2, toY: 19 },
    ],
    npcs: [
      {
        x: 15,
        y: 12,
        name: 'たんけんかゴロ',
        color: '#d0d0a0',
        lines: [
          'この どうくつには ぜんしんが きんぞくの「メタぷに」が でるらしい…。',
          'たおせば ばくだいな けいけんち! でも すぐ にげちまうんだ。',
        ],
      },
    ],
    maxGroupSize: 3,
  };
}

// ---- ごうかざん ----
function buildVolcano(): MapDef {
  const g = makeGrid(30, 22, 'c');
  border(g, '#');
  // 溶岩池
  fillRect(g, 4, 4, 5, 3, 'L');
  fillRect(g, 20, 6, 6, 3, 'L');
  fillRect(g, 8, 12, 4, 4, 'L');
  fillRect(g, 22, 15, 5, 3, 'L');
  fillRect(g, 14, 8, 3, 2, 'L');
  // 岩壁
  fillRect(g, 10, 3, 2, 4, '#');
  fillRect(g, 17, 12, 2, 6, '#');
  fillRect(g, 5, 17, 4, 2, '#');
  // 入口(どうくつへ戻る)
  set(g, 2, 19, '>');
  return {
    id: 'volcano',
    name: 'ごうかざん',
    tiles: toRows(g),
    encounterRate: 1 / 9,
    encounters: [
      { speciesId: 'gargoyle', minLevel: 18, maxLevel: 22, weight: 20 },
      { speciesId: 'wyvern', minLevel: 18, maxLevel: 22, weight: 20 },
      { speciesId: 'grizzly', minLevel: 18, maxLevel: 22, weight: 15 },
      { speciesId: 'golem', minLevel: 19, maxLevel: 23, weight: 14 },
      { speciesId: 'demon', minLevel: 20, maxLevel: 25, weight: 12 },
      { speciesId: 'sabertiger', minLevel: 20, maxLevel: 25, weight: 10 },
      { speciesId: 'vampire', minLevel: 21, maxLevel: 26, weight: 8 },
      { speciesId: 'flamedrake', minLevel: 22, maxLevel: 27, weight: 7 },
      { speciesId: 'irongolem', minLevel: 22, maxLevel: 27, weight: 6 },
      { speciesId: 'cerberus', minLevel: 24, maxLevel: 28, weight: 2 },
      { speciesId: 'archdemon', minLevel: 25, maxLevel: 29, weight: 2 },
      { speciesId: 'grandragon', minLevel: 26, maxLevel: 30, weight: 1 },
      { speciesId: 'mithrilgolem', minLevel: 25, maxLevel: 29, weight: 1 },
    ],
    portals: [{ x: 2, y: 19, toMap: 'cave', toX: 26, toY: 2 }],
    npcs: [
      {
        x: 5,
        y: 15,
        name: 'せんしのバルド',
        color: '#e06040',
        lines: [
          'この さきに まりゅうテキーナが ひそんでいる…。',
          'いどむなら Lv25いじょうの なかまを そろえたほうが いい。しぬなよ!',
        ],
      },
      {
        x: 15,
        y: 3,
        name: 'まりゅうテキーナ',
        color: '#8a3df0',
        action: 'boss',
        lines: [],
      },
    ],
    maxGroupSize: 3,
  };
}

export const MAPS: MapDef[] = [VILLAGE, buildPlains(), buildForest(), buildCave(), buildVolcano()];

const mapIndex = new Map(MAPS.map((m) => [m.id, m]));

export function getMap(id: string): MapDef {
  const m = mapIndex.get(id);
  if (!m) throw new Error(`未定義のマップ: ${id}`);
  return m;
}

export function tileAt(map: MapDef, x: number, y: number): TileKind {
  const row = map.tiles[y];
  if (!row || x < 0 || x >= row.length) return 'wall';
  const tile = CHAR_TO_TILE[row[x]!];
  return tile ?? 'wall';
}

export function isWalkable(map: MapDef, x: number, y: number): boolean {
  if (!WALKABLE[tileAt(map, x, y)]) return false;
  // NPCのいるマスは通れない
  if (map.npcs.some((n) => n.x === x && n.y === y)) return false;
  return true;
}

// 新規ゲームの開始位置
export const START_MAP = 'village';
export const START_X = 10;
export const START_Y = 6;
