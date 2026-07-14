// ステージデータの整合性 + 解放ロジックの検証
import { describe, expect, it } from 'vitest';
import { hasSpecies } from '../src/data/monsters';
import { getItem } from '../src/data/items';
import { FIRST_STAGE, isStageUnlocked, STAGES, getStage, hasStage } from '../src/data/stages';

describe('ステージデータ', () => {
  it('IDが重複していない', () => {
    const ids = STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全ステージの敵・ボスの種族が存在する', () => {
    for (const s of STAGES) {
      for (const wave of [...s.waves, s.boss]) {
        expect(wave.length, `${s.id} の空の波`).toBeGreaterThan(0);
        for (const e of wave) {
          expect(hasSpecies(e.speciesId), `${s.id} の ${e.speciesId}`).toBe(true);
          expect(e.level).toBeGreaterThanOrEqual(1);
          expect(e.level).toBeLessThanOrEqual(50);
        }
      }
    }
  });

  it('報酬アイテムが存在し、金額が正', () => {
    for (const s of STAGES) {
      expect(s.rewardGold).toBeGreaterThan(0);
      for (const r of s.rewardItems) {
        expect(() => getItem(r.itemId), `${s.id} の ${r.itemId}`).not.toThrow();
        expect(r.count).toBeGreaterThan(0);
      }
    }
  });

  it('requires が実在ステージを指す', () => {
    for (const s of STAGES) {
      if (s.requires !== null) expect(hasStage(s.requires), `${s.id} の requires`).toBe(true);
    }
  });

  it('最初のステージは前提なしで挑戦可能', () => {
    const first = getStage(FIRST_STAGE);
    expect(first.requires).toBeNull();
    expect(isStageUnlocked(first, [])).toBe(true);
  });

  it('前提ステージ未クリアだとロックされる', () => {
    const locked = STAGES.filter((s) => s.requires !== null);
    for (const s of locked) {
      expect(isStageUnlocked(s, []), `${s.id} が最初から解放されている`).toBe(false);
      expect(isStageUnlocked(s, [s.requires!])).toBe(true);
    }
  });

  it('順番にクリアすれば全ステージ到達できる(詰みがない)', () => {
    const cleared: string[] = [];
    let progressed = true;
    // 解放されているステージを順にクリアしていき、全ステージ到達できるか
    while (progressed) {
      progressed = false;
      for (const s of STAGES) {
        if (!cleared.includes(s.id) && isStageUnlocked(s, cleared)) {
          cleared.push(s.id);
          progressed = true;
        }
      }
    }
    expect(cleared.length).toBe(STAGES.length);
  });

  it('レベル帯が段階的に上がる(推奨レベルが単調増加ぎみ)', () => {
    const main = STAGES.filter((s) => !s.postgame);
    for (let i = 1; i < main.length; i++) {
      expect(main[i]!.recLevel).toBeGreaterThan(main[i - 1]!.recLevel);
    }
  });
});
