// ============================================================
// 共通型定義 — ゲーム全体で使う型はここに集約する
// 拡張時(新属性・新系統・新ランク追加など)もまずこのファイルから
// ============================================================

/** 属性 */
export type Element = 'none' | 'fire' | 'ice' | 'thunder' | 'wind' | 'dark' | 'holy';

export const ELEMENT_NAMES: Record<Element, string> = {
  none: 'むぞくせい',
  fire: 'ほのお',
  ice: 'こおり',
  thunder: 'いなずま',
  wind: 'かぜ',
  dark: 'やみ',
  holy: 'ひかり',
};

/** モンスターの系統 */
export type Family =
  | 'slime' // スライム系
  | 'dragon' // ドラゴン系
  | 'beast' // まじゅう系
  | 'nature' // しぜん系
  | 'demon' // あくま系
  | 'zombie' // ゾンビ系
  | 'material' // ぶっしつ系
  | 'mystic'; // ？？？系(超レア)

export const FAMILY_NAMES: Record<Family, string> = {
  slime: 'スライムけい',
  dragon: 'ドラゴンけい',
  beast: 'まじゅうけい',
  nature: 'しぜんけい',
  demon: 'あくまけい',
  zombie: 'ゾンビけい',
  material: 'ぶっしつけい',
  mystic: '？？？けい',
};

/** モンスターのランク(F が最弱、S が最強)。ガチャのレア度 ★1〜★7 に対応する */
export type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export const RANK_ORDER: Rank[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

export function rankScore(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

/** レア度(★の数)。F=★1 〜 S=★7 */
export function rankStars(rank: Rank): number {
  return rankScore(rank) + 1;
}

/** 基本ステータス */
export interface Stats {
  hp: number;
  mp: number;
  atk: number; // こうげき力
  def: number; // しゅび力
  agi: number; // すばやさ
  wis: number; // かしこさ(呪文威力・回復量に影響)
}

export type StatKey = keyof Stats;

export const STAT_NAMES: Record<StatKey, string> = {
  hp: 'HP',
  mp: 'MP',
  atk: 'こうげき',
  def: 'しゅび',
  agi: 'すばやさ',
  wis: 'かしこさ',
};

/** とくぎの効果種別 */
export type SkillEffect =
  | {
      kind: 'attack';
      element: Element;
      power: number;
      target: 'single' | 'all';
      /** ダメージ計算の参照ステータス: 呪文=wis / 体技=atk / ブレス=固定 */
      scaling: 'wis' | 'atk' | 'fixed';
    }
  | { kind: 'heal'; power: number; target: 'single' | 'all' }
  | { kind: 'revive'; ratio: number } // HP割合で蘇生
  | { kind: 'buff'; stat: 'atk' | 'def' | 'agi'; stages: number; target: 'single' | 'all' }
  | { kind: 'debuff'; stat: 'atk' | 'def' | 'agi'; stages: number; target: 'single' | 'all' };

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  mpCost: number;
  effect: SkillEffect;
}

/** モンスター種族の定義(図鑑データ) */
export interface SpeciesDef {
  id: string;
  name: string;
  family: Family;
  rank: Rank;
  /** Lv1 時点の基礎ステータス */
  base: Stats;
  /** レベル1上がるごとの成長量(小数可・計算時に floor) */
  growth: Stats;
  /** 習得とくぎ(レベルで覚える) */
  learnset: { level: number; skillId: string }[];
  /** 属性耐性: ダメージ倍率(未指定は 1.0)。0.5=半減 / 0=無効 / 1.5=弱点 */
  resist: Partial<Record<Element, number>>;
  /** 倒したときの獲得経験値・ゴールドの基準値 */
  expYield: number;
  goldYield: number;
  /** スプライト: 系統の形 + 種族ごとの3色パレット */
  palette: [string, string, string];
  desc: string;
}

/** 手持ち・牧場にいるモンスター個体 */
export interface MonsterInstance {
  uid: string;
  speciesId: string;
  nickname: string;
  level: number;
  exp: number;
  /** プラス値(ステータス補正。将来の強化システム用) */
  plus: number;
  /** 永続ステータスボーナス(将来の強化システム用) */
  bonus: Stats;
  /** ラック(運): 同じ種族を集めるほど上がる。高いほどドロップ&石掘りが増える */
  luck: number;
  /** 覚えているとくぎ(最大 MAX_SKILLS 個) */
  skillIds: string[];
  /** 現在HP/MP */
  hp: number;
  mp: number;
}

/** アイテム定義 */
export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  price: number; // ショップ価格(0 = 非売品)
  effect:
    | { kind: 'heal'; power: number }
    | { kind: 'mp'; power: number }
    | { kind: 'revive'; ratio: number };
}

/** セーブされるゲーム全体の状態 */
export interface GameState {
  version: number;
  playerName: string;
  gold: number;
  /** ガチャ用の通貨(クエスト初回クリアなどで獲得) */
  orbs: number;
  party: MonsterInstance[];
  farm: MonsterInstance[];
  items: Record<string, number>;
  /** クリア済みステージのID一覧(ステージ解放の判定に使う) */
  clearedStages: string[];
  flags: Record<string, boolean>;
  /** 図鑑: 見つけた/仲間にした種族 */
  seenSpecies: string[];
  scoutedSpecies: string[];
  battleCount: number;
}

// ---- ゲームルール定数 ----
export const PARTY_MAX = 4;
export const FARM_MAX = 50;
export const MAX_SKILLS = 6;
export const MAX_LEVEL = 50;
/** ラックの上限(モンスト風。1体所持=ラック1、集めるほど+1) */
export const MAX_LUCK = 99;
export const SAVE_VERSION = 5;
