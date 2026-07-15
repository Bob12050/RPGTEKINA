// 表示用の共通フォーマッタ
import type { MonsterInstance, Rank } from '../core/types';
import { FAMILY_NAMES } from '../core/types';
import { getSpecies } from '../data/monsters';
import { maxStats } from '../game/monster';

/** レア度ごとの表示色(★4=青 / ★5=紫 / ★6=金 / ★7=虹っぽく) */
export const RANK_COLORS: Record<Rank, string> = {
  F: '#ffffff',
  E: '#ffffff',
  D: '#b5e8a0',
  C: '#8fd4ff',
  B: '#c98af5',
  A: '#ffd94a',
  S: '#ff8ad8',
};

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
