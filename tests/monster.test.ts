import { beforeEach, describe, expect, it } from 'vitest';
import { setRandomSource } from '../src/core/rng';
import { MAX_LEVEL, MAX_SKILLS } from '../src/core/types';
import { createMonster, expToNext, gainExp, maxStats } from '../src/game/monster';

beforeEach(() => setRandomSource(Math.random));

describe('createMonster', () => {
  it('レベル1のステータスが基礎値と一致する', () => {
    const m = createMonster('puni', 1);
    const ms = maxStats(m);
    expect(ms.hp).toBe(22);
    expect(ms.atk).toBe(10);
    expect(m.hp).toBe(ms.hp);
    expect(m.mp).toBe(ms.mp);
  });

  it('レベルに応じてとくぎを覚えている', () => {
    const lv1 = createMonster('puni', 1);
    expect(lv1.skillIds).not.toContain('heal');
    const lv5 = createMonster('puni', 5);
    expect(lv5.skillIds).toContain('heal');
  });

  it('プラス値でステータスが上がる', () => {
    const normal = createMonster('puni', 10);
    const plus = createMonster('puni', 10, { plus: 10 });
    expect(maxStats(plus).atk).toBeGreaterThan(maxStats(normal).atk);
  });
});

describe('gainExp', () => {
  it('経験値でレベルアップし、とくぎを覚える', () => {
    const m = createMonster('puni', 1);
    // レベル3(heal習得)まで確実に足りる量
    const total = expToNext(1) + expToNext(2) + expToNext(3);
    const result = gainExp(m, total);
    expect(m.level).toBeGreaterThanOrEqual(3);
    expect(result.levelsGained).toBe(m.level - 1);
    expect(m.skillIds).toContain('heal');
    expect(result.learnedSkills).toContain('heal');
  });

  it('最大レベルを超えない', () => {
    const m = createMonster('puni', MAX_LEVEL);
    gainExp(m, 999999);
    expect(m.level).toBe(MAX_LEVEL);
  });

  it('とくぎがいっぱいなら覚えず missedSkills に入る', () => {
    const m = createMonster('mahopuni', 1, {
      skillIds: ['heal', 'healmore', 'healall', 'revive', 'powerup', 'guardsong'],
    });
    expect(m.skillIds).toHaveLength(MAX_SKILLS);
    // mahopuni は Lv6 で icicle を覚えるはずだが、いっぱいなので覚えない
    let total = 0;
    for (let l = 1; l < 6; l++) total += expToNext(l);
    const result = gainExp(m, total);
    expect(m.level).toBeGreaterThanOrEqual(6);
    expect(m.skillIds).toHaveLength(MAX_SKILLS);
    expect(result.missedSkills).toContain('icicle');
  });

  it('レベルアップでHPが増加分だけ回復する', () => {
    const m = createMonster('puni', 1);
    m.hp = 1;
    gainExp(m, expToNext(1));
    expect(m.level).toBe(2);
    const gained = maxStats(m).hp - 22;
    expect(m.hp).toBe(1 + gained);
  });
});

describe('expToNext', () => {
  it('レベルが上がるほど必要量が増える', () => {
    for (let l = 1; l < MAX_LEVEL - 1; l++) {
      expect(expToNext(l + 1)).toBeGreaterThan(expToNext(l));
    }
  });
});
