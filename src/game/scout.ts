// ============================================================
// スカウトのロジック(DQMジョーカー風「スカウトアタック」)
// 仲間全員の こうげき力で気合を見せつけ、確率で仲間になる。
// ============================================================
import { chance } from '../core/rng';
import { getSpecies } from '../data/monsters';

export interface ScoutTargetInfo {
  speciesId: string;
  maxHp: number;
  currentHp: number;
  def: number;
}

/**
 * スカウト成功率(%)を計算する。
 * - 仲間の攻撃力合計が高いほど上がる
 * - 相手のHPが減っているほど上がる(最大約1.9倍)
 * - 相手のタフさ(最大HP+守備)とスカウト難度で下がる
 * - boost: ごちそうアイテムなどの倍率
 * 戻り値は 1〜90 にクランプ。スカウト不可(ボス等)は null。
 */
export function scoutRate(partyAtkSum: number, target: ScoutTargetInfo, boost = 1): number | null {
  const sp = getSpecies(target.speciesId);
  if (sp.scoutDifficulty <= 0) return null;
  const toughness = (target.maxHp + target.def * 2) * sp.scoutDifficulty;
  const hpRatio = Math.max(0, Math.min(1, target.currentHp / target.maxHp));
  const hpFactor = 1 + (1 - hpRatio) * 0.9;
  const base = (partyAtkSum / Math.max(1, toughness)) * 26;
  const rate = base * hpFactor * boost;
  return Math.max(1, Math.min(90, rate));
}

/** スカウトを実行して成否を返す */
export function rollScout(rate: number): boolean {
  return chance(rate / 100);
}
