// 表示用の共通フォーマッタ
import type { MonsterInstance } from '../core/types';
import { FAMILY_NAMES } from '../core/types';
import { getSpecies } from '../data/monsters';
import { maxStats } from '../game/monster';

/** 「ぷにきち+2 Lv12」のような一覧用ラベル */
export function monsterLabel(m: MonsterInstance): string {
  const plus = m.plus > 0 ? `+${m.plus}` : '';
  return `${m.nickname}${plus} Lv${m.level}`;
}

/** 「HP 32/40」のような補足 */
export function monsterNote(m: MonsterInstance): string {
  const ms = maxStats(m);
  return `HP ${m.hp}/${ms.hp}`;
}

export function speciesInfo(speciesId: string): string {
  const sp = getSpecies(speciesId);
  return `${FAMILY_NAMES[sp.family]}・ランク${sp.rank}`;
}
