// ============================================================
// とくぎデータ
// 追加するときはここに足すだけでOK(テストが参照整合性を検証する)
// ============================================================
import type { SkillDef } from '../core/types';

export const SKILLS: SkillDef[] = [
  // ---- 炎 ----
  {
    id: 'fire',
    name: 'ファイア',
    desc: 'ちいさな火の玉で敵1体を攻撃',
    mpCost: 2,
    effect: { kind: 'attack', element: 'fire', power: 12, target: 'single', scaling: 'wis' },
  },
  {
    id: 'fira',
    name: 'ファイラ',
    desc: '燃えさかる炎で敵1体を攻撃',
    mpCost: 5,
    effect: { kind: 'attack', element: 'fire', power: 32, target: 'single', scaling: 'wis' },
  },
  {
    id: 'inferno',
    name: 'インフェルノ',
    desc: '灼熱の業火で敵全体を攻撃',
    mpCost: 12,
    effect: { kind: 'attack', element: 'fire', power: 42, target: 'all', scaling: 'wis' },
  },
  // ---- 氷 ----
  {
    id: 'icicle',
    name: 'アイシクル',
    desc: '鋭い氷のつぶてで敵1体を攻撃',
    mpCost: 2,
    effect: { kind: 'attack', element: 'ice', power: 13, target: 'single', scaling: 'wis' },
  },
  {
    id: 'blizzara',
    name: 'ブリザラ',
    desc: '吹雪を呼んで敵1体を攻撃',
    mpCost: 5,
    effect: { kind: 'attack', element: 'ice', power: 33, target: 'single', scaling: 'wis' },
  },
  {
    id: 'whiteout',
    name: 'ホワイトアウト',
    desc: '猛吹雪で敵全体を凍てつかせる',
    mpCost: 12,
    effect: { kind: 'attack', element: 'ice', power: 41, target: 'all', scaling: 'wis' },
  },
  // ---- 雷 ----
  {
    id: 'spark',
    name: 'スパーク',
    desc: '小さな電撃で敵1体を攻撃',
    mpCost: 2,
    effect: { kind: 'attack', element: 'thunder', power: 13, target: 'single', scaling: 'wis' },
  },
  {
    id: 'lightning',
    name: 'ライトニング',
    desc: '稲妻を落とし敵1体を強襲',
    mpCost: 8,
    effect: { kind: 'attack', element: 'thunder', power: 48, target: 'single', scaling: 'wis' },
  },
  {
    id: 'gigavolt',
    name: 'ギガボルト',
    desc: '天空の雷で敵全体を撃つ',
    mpCost: 15,
    effect: { kind: 'attack', element: 'thunder', power: 52, target: 'all', scaling: 'wis' },
  },
  // ---- 風 ----
  {
    id: 'windcutter',
    name: 'ウィンドカッター',
    desc: 'かまいたちで敵1体を切り裂く',
    mpCost: 3,
    effect: { kind: 'attack', element: 'wind', power: 18, target: 'single', scaling: 'wis' },
  },
  {
    id: 'tempest',
    name: 'テンペスト',
    desc: '大竜巻で敵全体を巻き上げる',
    mpCost: 10,
    effect: { kind: 'attack', element: 'wind', power: 38, target: 'all', scaling: 'wis' },
  },
  // ---- 闇・光 ----
  {
    id: 'shadow',
    name: 'シャドウ',
    desc: '闇の波動で敵1体を攻撃',
    mpCost: 3,
    effect: { kind: 'attack', element: 'dark', power: 20, target: 'single', scaling: 'wis' },
  },
  {
    id: 'darknebula',
    name: 'ダークネビュラ',
    desc: '闇の星雲で敵全体を包み込む',
    mpCost: 14,
    effect: { kind: 'attack', element: 'dark', power: 46, target: 'all', scaling: 'wis' },
  },
  {
    id: 'holyray',
    name: 'ホーリーレイ',
    desc: '聖なる光で敵1体を貫く',
    mpCost: 6,
    effect: { kind: 'attack', element: 'holy', power: 36, target: 'single', scaling: 'wis' },
  },
  // ---- ブレス(固定ダメージ系) ----
  {
    id: 'firebreath',
    name: 'ひのいき',
    desc: '小さな火の息を吐く(敵全体)',
    mpCost: 0,
    effect: { kind: 'attack', element: 'fire', power: 10, target: 'all', scaling: 'fixed' },
  },
  {
    id: 'flamebreath',
    name: 'かえんのいき',
    desc: '激しい炎の息を吐く(敵全体)',
    mpCost: 4,
    effect: { kind: 'attack', element: 'fire', power: 28, target: 'all', scaling: 'fixed' },
  },
  {
    id: 'icebreath',
    name: 'こおりのいき',
    desc: '凍てつく冷気を吐く(敵全体)',
    mpCost: 4,
    effect: { kind: 'attack', element: 'ice', power: 28, target: 'all', scaling: 'fixed' },
  },
  {
    id: 'scorch',
    name: 'しゃくねつ',
    desc: '全てを焼き尽くす炎の息(敵全体)',
    mpCost: 12,
    effect: { kind: 'attack', element: 'fire', power: 62, target: 'all', scaling: 'fixed' },
  },
  // ---- 体技(こうげき力依存) ----
  {
    id: 'bite',
    name: 'かみつく',
    desc: '鋭い牙でかみつく(敵1体)',
    mpCost: 0,
    effect: { kind: 'attack', element: 'none', power: 8, target: 'single', scaling: 'atk' },
  },
  {
    id: 'powerslash',
    name: 'ちからまかせ',
    desc: '全力の一撃をたたきこむ(敵1体)',
    mpCost: 3,
    effect: { kind: 'attack', element: 'none', power: 24, target: 'single', scaling: 'atk' },
  },
  {
    id: 'rush',
    name: 'あばれまわる',
    desc: '敵全体にめちゃくちゃに攻撃',
    mpCost: 6,
    effect: { kind: 'attack', element: 'none', power: 16, target: 'all', scaling: 'atk' },
  },
  {
    id: 'boulder',
    name: 'がんせきおとし',
    desc: '巨大な岩を敵全体に落とす',
    mpCost: 8,
    effect: { kind: 'attack', element: 'none', power: 26, target: 'all', scaling: 'atk' },
  },
  // ---- 回復・蘇生 ----
  {
    id: 'heal',
    name: 'ヒール',
    desc: '味方1体のHPを約30回復',
    mpCost: 2,
    effect: { kind: 'heal', power: 30, target: 'single' },
  },
  {
    id: 'healmore',
    name: 'ヒーラス',
    desc: '味方1体のHPを約75回復',
    mpCost: 5,
    effect: { kind: 'heal', power: 75, target: 'single' },
  },
  {
    id: 'healall',
    name: 'ヒールオール',
    desc: '味方全体のHPを約50回復',
    mpCost: 9,
    effect: { kind: 'heal', power: 50, target: 'all' },
  },
  {
    id: 'revive',
    name: 'リバイブ',
    desc: '力尽きた味方1体をHP半分で蘇生',
    mpCost: 10,
    effect: { kind: 'revive', ratio: 0.5 },
  },
  // ---- 補助 ----
  {
    id: 'powerup',
    name: 'パワフルダンス',
    desc: '味方1体のこうげき力を上げる',
    mpCost: 3,
    effect: { kind: 'buff', stat: 'atk', stages: 1, target: 'single' },
  },
  {
    id: 'guardsong',
    name: 'まもりのうた',
    desc: '味方全体のしゅび力を上げる',
    mpCost: 4,
    effect: { kind: 'buff', stat: 'def', stages: 1, target: 'all' },
  },
  {
    id: 'speedsong',
    name: 'かぜのうた',
    desc: '味方全体のすばやさを上げる',
    mpCost: 3,
    effect: { kind: 'buff', stat: 'agi', stages: 1, target: 'all' },
  },
  {
    id: 'weaken',
    name: 'ウィークン',
    desc: '敵1体のしゅび力を下げる',
    mpCost: 3,
    effect: { kind: 'debuff', stat: 'def', stages: -1, target: 'single' },
  },
  {
    id: 'slow',
    name: 'スロウダウン',
    desc: '敵1体のすばやさを下げる',
    mpCost: 3,
    effect: { kind: 'debuff', stat: 'agi', stages: -1, target: 'single' },
  },
  {
    id: 'warcry',
    name: 'いかりのさけび',
    desc: '敵全体のこうげき力を下げる',
    mpCost: 5,
    effect: { kind: 'debuff', stat: 'atk', stages: -1, target: 'all' },
  },
];

const skillMap = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): SkillDef {
  const s = skillMap.get(id);
  if (!s) throw new Error(`未定義のとくぎ: ${id}`);
  return s;
}

export function hasSkill(id: string): boolean {
  return skillMap.has(id);
}
