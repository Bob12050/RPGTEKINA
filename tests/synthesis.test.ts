import { describe, expect, it } from 'vitest';
import { SYNTHESIS_MIN_LEVEL, rankScore } from '../src/core/types';
import { getSpecies } from '../src/data/monsters';
import { createMonster, maxStats } from '../src/game/monster';
import {
  canSynthesize,
  inheritableSkills,
  MAX_INHERIT,
  performSynthesis,
  previewChildSpecies,
} from '../src/game/synthesis';

describe('canSynthesize', () => {
  it('レベル不足は拒否する', () => {
    const a = createMonster('puni', SYNTHESIS_MIN_LEVEL - 1);
    const b = createMonster('puni', SYNTHESIS_MIN_LEVEL);
    expect(canSynthesize(a, b).ok).toBe(false);
    expect(canSynthesize(b, a).ok).toBe(false);
  });

  it('同一個体は拒否する', () => {
    const a = createMonster('puni', 20);
    expect(canSynthesize(a, a).ok).toBe(false);
  });

  it('条件を満たせば許可する', () => {
    const a = createMonster('puni', 10);
    const b = createMonster('wolf', 10);
    expect(canSynthesize(a, b).ok).toBe(true);
  });
});

describe('previewChildSpecies', () => {
  it('特殊レシピが最優先(でかぷに×でかぷに→キングぷに)', () => {
    const a = createMonster('dekapuni', 10);
    const b = createMonster('dekapuni', 10);
    expect(previewChildSpecies(a, b).id).toBe('kingpuni');
    expect(previewChildSpecies(b, a).id).toBe('kingpuni');
  });

  it('通常配合は系統表に従う(スライム×あくま→あくま系)', () => {
    const a = createMonster('puni', 10);
    const b = createMonster('goblin', 10);
    const child = previewChildSpecies(a, b);
    expect(child.family).toBe('demon');
    // F×F → ランクE
    expect(child.rank).toBe('E');
  });

  it('親のランクが高いほど子のランクも上がる', () => {
    const low = previewChildSpecies(createMonster('puni', 10), createMonster('puni', 10));
    const high = previewChildSpecies(createMonster('kingpuni', 10), createMonster('metapuni', 20));
    expect(rankScore(high.rank)).toBeGreaterThan(rankScore(low.rank));
  });

  it('通常配合ではSランクは生まれない(ボス種も除外)', () => {
    // ドラゴン系最高ランク同士でも A どまり
    const a = createMonster('grandragon', 30);
    const b = createMonster('grandragon', 30);
    const child = previewChildSpecies(a, b);
    expect(child.family).toBe('dragon');
    expect(rankScore(child.rank)).toBeLessThanOrEqual(rankScore('A'));
    expect(child.id).not.toBe('tekina');
  });
});

describe('performSynthesis', () => {
  it('子はLv1で、プラス値が引き継がれ+1される', () => {
    const a = createMonster('puni', 15, { plus: 2 });
    const b = createMonster('wolf', 12, { plus: 3 });
    const { child } = performSynthesis(a, b, []);
    expect(child.level).toBe(1);
    expect(child.plus).toBe(6);
  });

  it('親のステータスがボーナスとして継承される', () => {
    const a = createMonster('grizzly', 30);
    const b = createMonster('grizzly', 30);
    const { child } = performSynthesis(a, b, []);
    const plain = createMonster(child.speciesId, 1);
    expect(maxStats(child).atk).toBeGreaterThan(maxStats(plain).atk);
    expect(child.bonus.hp).toBeGreaterThan(0);
  });

  it('選んだとくぎを引き継ぐ(最大3つ)', () => {
    const a = createMonster('mahopuni', 32); // fire, icicle, spark, fira, blizzara, lightning
    const b = createMonster('treant', 18); // powerslash, guardsong, healmore
    const pool = inheritableSkills(a, b, previewChildSpecies(a, b).id);
    expect(pool.length).toBeGreaterThan(MAX_INHERIT);
    const chosen = pool.slice(0, MAX_INHERIT + 2); // 多めに渡しても3つに切られる
    const { child } = performSynthesis(a, b, chosen);
    const inherited = child.skillIds.filter((s) => chosen.includes(s));
    expect(inherited).toHaveLength(MAX_INHERIT);
  });

  it('特殊配合フラグが立つ', () => {
    const a = createMonster('flamedrake', 20);
    const b = createMonster('frostdragon', 20);
    const result = performSynthesis(a, b, []);
    expect(result.wasSpecial).toBe(true);
    expect(result.child.speciesId).toBe('grandragon');
  });

  it('子は生まれたとき全回復している', () => {
    const a = createMonster('puni', 10);
    const b = createMonster('puni', 10);
    a.hp = 1;
    const { child } = performSynthesis(a, b, []);
    expect(child.hp).toBe(maxStats(child).hp);
  });

  it('レベル不足で実行すると例外', () => {
    const a = createMonster('puni', 1);
    const b = createMonster('puni', 20);
    expect(() => performSynthesis(a, b, [])).toThrow();
  });
});

describe('レシピ連鎖', () => {
  it('最終レシピまで到達できる(グランドラゴン×デモンロード→テキーナ)', () => {
    const a = createMonster('grandragon', 30);
    const b = createMonster('demonlord', 30);
    const { child } = performSynthesis(a, b, []);
    expect(child.speciesId).toBe('tekina');
    expect(getSpecies(child.speciesId).rank).toBe('S');
  });
});
