// 配合限定モンスターの検証:
// - 特殊レシピの子が野良エンカウントに出ない(=配合でしか手に入らない)
// - scout:0 の種族は通常配合の抽選からも外れる(=特定レシピ専用)
// - 全レシピが「入手可能な親」から到達できる(詰みレシピがない)
import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { getSpecies, SPECIES } from '../src/data/monsters';
import { SPECIAL_RECIPES } from '../src/data/synthesis';
import { createMonster } from '../src/game/monster';
import { previewChildSpecies } from '../src/game/synthesis';

/** 野良エンカウントに出る種族ID */
const wildIds = new Set(MAPS.flatMap((m) => m.encounters.map((e) => e.speciesId)));

/** 配合でのみ手に入る新モンスター(scout:0 のもの) */
const synthesisOnly = SPECIES.filter((s) => s.scoutDifficulty <= 0);

describe('配合限定モンスター', () => {
  it('scout:0 の種族は 1体も 野良エンカウントに出ない', () => {
    for (const sp of synthesisOnly) {
      expect(wildIds.has(sp.id), `${sp.name}(${sp.id}) が野良に出現している`).toBe(false);
    }
  });

  it('scout:0 の種族は 通常配合の抽選からも生まれない', () => {
    // 同系統・高ランクの通常配合を回しても、必ず scout>0 の種族が選ばれる
    const families = [...new Set(synthesisOnly.map((s) => s.family))];
    for (const family of families) {
      const wildSame = SPECIES.filter((s) => s.family === family && s.scoutDifficulty > 0);
      // 各系統に通常配合で生まれる種(scout>0)が最低1体は残っている
      expect(wildSame.length, `${family} に通常配合の受け皿がない`).toBeGreaterThan(0);
    }
  });

  it('全レシピの子が親から実際に生成できる(順不同)', () => {
    for (const r of SPECIAL_RECIPES) {
      const a = createMonster(r.parents[0], 20);
      const b = createMonster(r.parents[1], 20);
      expect(previewChildSpecies(a, b).id, `${r.parents[0]}×${r.parents[1]}`).toBe(r.child);
      // 逆順でも同じ子
      expect(previewChildSpecies(b, a).id).toBe(r.child);
    }
  });

  it('全レシピが 入手可能な素材から到達できる(詰みがない)', () => {
    // 入手可能 = 野良に出る or 別レシピで作れる(推移的に解決)
    const recipeChildren = new Map(SPECIAL_RECIPES.map((r) => [r.child, r.parents]));
    const memo = new Map<string, boolean>();
    const obtainable = (id: string, stack: Set<string>): boolean => {
      if (wildIds.has(id)) return true;
      if (memo.has(id)) return memo.get(id)!;
      if (stack.has(id)) return false; // 循環参照は不可
      const parents = recipeChildren.get(id);
      if (!parents) return false; // 野良でもレシピでも入手不可
      stack.add(id);
      const ok = parents.every((p) => obtainable(p, stack));
      stack.delete(id);
      memo.set(id, ok);
      return ok;
    };
    for (const r of SPECIAL_RECIPES) {
      expect(obtainable(r.child, new Set()), `${r.child} が入手不能(詰みレシピ)`).toBe(true);
    }
  });

  it('追加した14種の配合限定モンスターが すべて存在する', () => {
    const ids = [
      'caitsith', 'basilisk', 'pegasus', 'chimera', 'hydra', 'griffin', 'sphinx',
      'valkyrie', 'metaldra', 'bahamut', 'leviathan', 'behemoth', 'seraphim', 'metalking',
    ];
    for (const id of ids) {
      const sp = getSpecies(id);
      expect(sp.scoutDifficulty, `${id} は scout:0 であるべき`).toBe(0);
      expect(SPECIAL_RECIPES.some((r) => r.child === id), `${id} のレシピがない`).toBe(true);
    }
  });
});
