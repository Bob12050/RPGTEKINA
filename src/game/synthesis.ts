// ============================================================
// 配合のロジック
// 2体の親(Lv10以上)から子モンスターを生み出す。
//  - 特殊レシピが最優先
//  - 通常配合: 系統表で子の系統を決め、親ランクからランクを算出(最高A)
//  - 子は プラス値+1、親の能力の一部をボーナスとして継承
//  - 親のとくぎを最大3つまで引き継げる
// ============================================================
import type { MonsterInstance, SpeciesDef, Stats } from '../core/types';
import { MAX_SKILLS, SYNTHESIS_MIN_LEVEL, rankScore } from '../core/types';
import { getSpecies, SPECIES } from '../data/monsters';
import { childFamily, findSpecialRecipe } from '../data/synthesis';
import { createMonster, emptyStats, maxStats, naturalSkillsAt, STAT_KEYS } from './monster';

/** ボーナスの1ステータスあたり上限(インフレ防止) */
const BONUS_CAP = 500;

export function canSynthesize(a: MonsterInstance, b: MonsterInstance): { ok: boolean; reason?: string } {
  if (a.uid === b.uid) return { ok: false, reason: 'おなじ モンスターどうしは はいごうできない!' };
  if (a.level < SYNTHESIS_MIN_LEVEL || b.level < SYNTHESIS_MIN_LEVEL) {
    return { ok: false, reason: `はいごうには レベル${SYNTHESIS_MIN_LEVEL}いじょうが ひつよう じゃ。` };
  }
  return { ok: true };
}

/** 配合結果の種族を決める(決定的・プレビュー可能) */
export function previewChildSpecies(a: MonsterInstance, b: MonsterInstance): SpeciesDef {
  const special = findSpecialRecipe(a.speciesId, b.speciesId);
  if (special) return getSpecies(special.child);

  const spA = getSpecies(a.speciesId);
  const spB = getSpecies(b.speciesId);
  const family = childFamily(spA.family, spB.family);
  // 通常配合の子ランク: 親ランクの平均+1(最高A。Sは特殊レシピ限定)
  const targetRank = Math.min(5, Math.floor((rankScore(spA.rank) + rankScore(spB.rank)) / 2) + 1);

  const candidates = SPECIES.filter((s) => s.family === family && s.scoutDifficulty > 0);
  if (candidates.length === 0) throw new Error(`配合候補がいない系統: ${family}`);

  candidates.sort((x, y) => {
    const dx = Math.abs(rankScore(x.rank) - targetRank);
    const dy = Math.abs(rankScore(y.rank) - targetRank);
    if (dx !== dy) return dx - dy;
    // 同距離なら低ランク優先(下振れ)、さらに同ランクなら図鑑順
    const rx = rankScore(x.rank);
    const ry = rankScore(y.rank);
    if (rx !== ry) return rx - ry;
    return SPECIES.indexOf(x) - SPECIES.indexOf(y);
  });
  return candidates[0]!;
}

/** 親2体から引き継ぎ候補になるとくぎ一覧(重複除去) */
export function inheritableSkills(a: MonsterInstance, b: MonsterInstance, childSpeciesId: string): string[] {
  const natural = new Set(naturalSkillsAt(childSpeciesId, 1));
  return [...new Set([...a.skillIds, ...b.skillIds])].filter((id) => !natural.has(id));
}

export const MAX_INHERIT = 3;

/** 配合の相性(プレビュー・演出用) */
export type Affinity = 'special' | 'sameSpecies' | 'normal';

export function synthesisAffinity(a: MonsterInstance, b: MonsterInstance): Affinity {
  if (findSpecialRecipe(a.speciesId, b.speciesId)) return 'special';
  if (a.speciesId === b.speciesId) return 'sameSpecies';
  return 'normal';
}

export interface SynthesisResult {
  child: MonsterInstance;
  species: SpeciesDef;
  wasSpecial: boolean;
  /** 同種配合ボーナスが乗ったか */
  sameSpecies: boolean;
  /** 子に乗ったプラス値の増分 */
  plusGain: number;
}

/**
 * 配合を実行する。親の削除は呼び出し側の責務
 * (パーティ/牧場のどちらにいるかを配合UIが知っているため)。
 */
export function performSynthesis(
  a: MonsterInstance,
  b: MonsterInstance,
  inheritSkillIds: string[],
): SynthesisResult {
  const check = canSynthesize(a, b);
  if (!check.ok) throw new Error(check.reason);

  const species = previewChildSpecies(a, b);
  const wasSpecial = findSpecialRecipe(a.speciesId, b.speciesId) !== undefined;

  // 同種配合ボーナス: おなじ種族どうしを かけあわせると
  // プラス値が おおく のり、ステータスボーナスも 手あつくなる(厳選むけ)
  const sameSpecies = a.speciesId === b.speciesId;
  const bonusDivisor = sameSpecies ? 15 : 20;
  const plusIncrement = sameSpecies ? 3 : 1;

  const msA = maxStats(a);
  const msB = maxStats(b);
  const bonus: Stats = emptyStats();
  for (const k of STAT_KEYS) {
    bonus[k] = Math.min(BONUS_CAP, Math.floor((msA[k] + msB[k]) / bonusDivisor));
  }

  const allowed = new Set(inheritableSkills(a, b, species.id));
  const inherited = [...new Set(inheritSkillIds)].filter((id) => allowed.has(id)).slice(0, MAX_INHERIT);
  const skillIds = [...new Set([...naturalSkillsAt(species.id, 1), ...inherited])].slice(0, MAX_SKILLS);

  const newPlus = Math.min(99, a.plus + b.plus + plusIncrement);
  const child = createMonster(species.id, 1, {
    plus: newPlus,
    bonus,
    skillIds,
  });

  return { child, species, wasSpecial, sameSpecies, plusGain: newPlus - Math.max(a.plus, b.plus) };
}
