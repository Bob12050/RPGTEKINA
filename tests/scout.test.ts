import { describe, expect, it } from 'vitest';
import { getSpecies } from '../src/data/monsters';
import { createMonster, maxStats } from '../src/game/monster';
import { scoutRate } from '../src/game/scout';

function targetOf(speciesId: string, level: number, hpRatio = 1) {
  const m = createMonster(speciesId, level);
  const ms = maxStats(m);
  return { speciesId, maxHp: ms.hp, currentHp: Math.max(1, Math.floor(ms.hp * hpRatio)), def: ms.def };
}

describe('scoutRate', () => {
  it('1〜90%の範囲に収まる', () => {
    // 極端に弱い相手 → 上限90
    expect(scoutRate(99999, targetOf('puni', 1))).toBe(90);
    // 極端に強い相手 → 下限1
    expect(scoutRate(1, targetOf('demonlord', 50))).toBe(1);
  });

  it('相手のHPが減っていると成功率が上がる', () => {
    const full = scoutRate(30, targetOf('wolf', 5, 1))!;
    const hurt = scoutRate(30, targetOf('wolf', 5, 0.2))!;
    expect(hurt).toBeGreaterThan(full);
  });

  it('ごちそうブーストで成功率が上がる', () => {
    const normal = scoutRate(30, targetOf('wolf', 5))!;
    const boosted = scoutRate(30, targetOf('wolf', 5), 2)!;
    expect(boosted).toBeGreaterThan(normal);
  });

  it('攻撃力が高いほど成功率が上がる', () => {
    const weak = scoutRate(20, targetOf('golem', 20))!;
    const strong = scoutRate(200, targetOf('golem', 20))!;
    expect(strong).toBeGreaterThan(weak);
  });

  it('スカウト不可(ボス)は null', () => {
    expect(getSpecies('tekina').scoutDifficulty).toBe(0);
    expect(scoutRate(99999, targetOf('tekina', 32))).toBeNull();
  });

  it('メタぷには守備が高くスカウトしにくい', () => {
    const meta = scoutRate(100, targetOf('metapuni', 13))!;
    const normal = scoutRate(100, targetOf('dekapuni', 13))!;
    expect(meta).toBeLessThan(normal);
  });

  it('序盤(スターター2体)でも F ランクに 20%以上 出る', () => {
    // ぷにきちLv3 + ぴょんたLv3 の攻撃力合計はおよそ 30
    const starterAtkSum = 30;
    const fullHp = scoutRate(starterAtkSum, targetOf('puni', 2))!;
    expect(fullHp).toBeGreaterThanOrEqual(20);
    // HPを削れば 40%以上
    const hurt = scoutRate(starterAtkSum, targetOf('puni', 2, 0.25))!;
    expect(hurt).toBeGreaterThanOrEqual(40);
  });
});
