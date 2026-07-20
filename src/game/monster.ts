// ============================================================
// モンスター個体のロジック(生成・ステータス計算・経験値・レベルアップ)
// ============================================================
import { generateUid } from '../core/rng';
import type { MonsterInstance, Stats, StatKey } from '../core/types';
import { MAX_LEVEL, MAX_SKILLS } from '../core/types';
import { getSpecies } from '../data/monsters';

export const STAT_KEYS: StatKey[] = ['hp', 'mp', 'atk', 'def', 'agi', 'wis'];

export function emptyStats(): Stats {
  return { hp: 0, mp: 0, atk: 0, def: 0, agi: 0, wis: 0 };
}

/** 種族・レベル・プラス値・ボーナスから最大ステータスを計算する(決定的) */
export function maxStats(m: MonsterInstance): Stats {
  const sp = getSpecies(m.speciesId);
  const plusMul = 1 + Math.min(m.plus, 99) * 0.03;
  const out = emptyStats();
  for (const k of STAT_KEYS) {
    const grown = sp.base[k] + sp.growth[k] * (m.level - 1);
    out[k] = Math.max(1, Math.floor(grown * plusMul) + m.bonus[k]);
  }
  return out;
}

/** そのレベルまでに種族が覚えているとくぎ一覧 */
export function naturalSkillsAt(speciesId: string, level: number): string[] {
  const sp = getSpecies(speciesId);
  return sp.learnset.filter((l) => l.level <= level).map((l) => l.skillId);
}

export interface CreateOptions {
  plus?: number;
  bonus?: Stats;
  skillIds?: string[];
  nickname?: string;
  luck?: number;
}

/** モンスター個体を生成する(野生・スカウト・配合すべてここを通る) */
export function createMonster(speciesId: string, level: number, opts: CreateOptions = {}): MonsterInstance {
  const sp = getSpecies(speciesId);
  const lv = Math.max(1, Math.min(MAX_LEVEL, level));
  const m: MonsterInstance = {
    uid: generateUid(),
    speciesId,
    nickname: opts.nickname ?? sp.name,
    level: lv,
    exp: 0,
    plus: opts.plus ?? 0,
    bonus: opts.bonus ?? emptyStats(),
    luck: opts.luck ?? 1,
    skillIds: (opts.skillIds ?? [...new Set(naturalSkillsAt(speciesId, lv))]).slice(0, MAX_SKILLS),
    hp: 0,
    mp: 0,
  };
  const ms = maxStats(m);
  m.hp = ms.hp;
  m.mp = ms.mp;
  return m;
}

/** レベル l から l+1 に上がるのに必要な経験値 */
export function expToNext(level: number): number {
  return Math.floor(2.5 * Math.pow(level, 1.55)) + 3;
}

/** 敵1体を倒したときの獲得経験値 */
export function expFromEnemy(speciesId: string, level: number): number {
  const sp = getSpecies(speciesId);
  return Math.max(1, Math.floor(sp.expYield * (1 + 0.22 * level)));
}

/** 敵1体を倒したときの獲得ゴールド */
export function goldFromEnemy(speciesId: string, level: number): number {
  const sp = getSpecies(speciesId);
  return Math.max(1, Math.floor(sp.goldYield * (1 + 0.15 * level)));
}

export interface LevelUpResult {
  levelsGained: number;
  newLevel: number;
  statGains: Stats;
  learnedSkills: string[];
  /** とくぎがいっぱいで覚えられなかったもの */
  missedSkills: string[];
}

/**
 * 経験値を加算しレベルアップ処理を行う。
 * HP/MPは最大値の増加分だけ回復する(戦闘後の自然な挙動)。
 */
export function gainExp(m: MonsterInstance, amount: number): LevelUpResult {
  const before = maxStats(m);
  const beforeLevel = m.level;
  const learnedSkills: string[] = [];
  const missedSkills: string[] = [];
  m.exp += Math.max(0, Math.floor(amount));

  while (m.level < MAX_LEVEL && m.exp >= expToNext(m.level)) {
    m.exp -= expToNext(m.level);
    m.level += 1;
    const sp = getSpecies(m.speciesId);
    for (const entry of sp.learnset) {
      if (entry.level !== m.level) continue;
      if (m.skillIds.includes(entry.skillId)) continue;
      if (m.skillIds.length >= MAX_SKILLS) {
        missedSkills.push(entry.skillId);
      } else {
        m.skillIds.push(entry.skillId);
        learnedSkills.push(entry.skillId);
      }
    }
  }
  // 最大レベル到達後は経験値を溜めすぎない
  if (m.level >= MAX_LEVEL) m.exp = 0;

  const after = maxStats(m);
  const gains = emptyStats();
  for (const k of STAT_KEYS) gains[k] = after[k] - before[k];
  // 増えた分だけ現在HP/MPも回復
  m.hp = Math.min(after.hp, m.hp + Math.max(0, gains.hp));
  m.mp = Math.min(after.mp, m.mp + Math.max(0, gains.mp));

  return {
    levelsGained: m.level - beforeLevel,
    newLevel: m.level,
    statGains: gains,
    learnedSkills,
    missedSkills,
  };
}

/** 全回復 */
export function fullHeal(m: MonsterInstance): void {
  const ms = maxStats(m);
  m.hp = ms.hp;
  m.mp = ms.mp;
}

export function isFainted(m: MonsterInstance): boolean {
  return m.hp <= 0;
}
