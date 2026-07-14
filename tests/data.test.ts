// データ整合性テスト:
// モンスター・とくぎ・アイテムを追加したとき、
// 参照ミスや形式ミスをここで自動検出する。
import { describe, expect, it } from 'vitest';
import { FAMILY_NAMES, RANK_ORDER, type Family } from '../src/core/types';
import { ITEMS } from '../src/data/items';
import { SPECIES } from '../src/data/monsters';
import { SKILLS, hasSkill } from '../src/data/skills';
import { FAMILY_SPRITES, HERO_SPRITE, SPRITE_SIZE } from '../src/ui/sprites';

const FAMILIES = Object.keys(FAMILY_NAMES) as Family[];

describe('とくぎデータ', () => {
  it('IDが重複していない', () => {
    const ids = SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('MPコストが負でない', () => {
    for (const s of SKILLS) expect(s.mpCost).toBeGreaterThanOrEqual(0);
  });
});

describe('モンスターデータ', () => {
  it('IDが重複していない', () => {
    const ids = SPECIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('習得とくぎがすべて存在する', () => {
    for (const sp of SPECIES) {
      for (const l of sp.learnset) {
        expect(hasSkill(l.skillId), `${sp.id} の ${l.skillId}`).toBe(true);
        expect(l.level).toBeGreaterThanOrEqual(1);
        expect(l.level).toBeLessThanOrEqual(50);
      }
    }
  });

  it('ランク・系統が正しい', () => {
    for (const sp of SPECIES) {
      expect(RANK_ORDER).toContain(sp.rank);
      expect(FAMILIES).toContain(sp.family);
    }
  });

  it('ステータスが正である', () => {
    for (const sp of SPECIES) {
      expect(sp.base.hp, sp.id).toBeGreaterThan(0);
      expect(sp.growth.hp, sp.id).toBeGreaterThan(0);
      expect(sp.expYield).toBeGreaterThan(0);
      expect(sp.palette).toHaveLength(3);
    }
  });

  it('耐性倍率が0〜2の範囲', () => {
    for (const sp of SPECIES) {
      for (const v of Object.values(sp.resist)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('アイテムデータ', () => {
  it('IDが重複していない', () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('スプライト', () => {
  const ALLOWED = new Set(['.', '#', '1', '2', '3', 'W', 'K']);
  it(`全系統のスプライトが ${SPRITE_SIZE}x${SPRITE_SIZE}`, () => {
    for (const [family, grid] of Object.entries(FAMILY_SPRITES)) {
      expect(grid.length, family).toBe(SPRITE_SIZE);
      grid.forEach((row, i) => {
        expect(row.length, `${family} 行${i}`).toBe(SPRITE_SIZE);
        for (const ch of row) expect(ALLOWED.has(ch), `${family} 行${i} の '${ch}'`).toBe(true);
      });
    }
  });
  it('主人公スプライトのサイズが正しい', () => {
    expect(HERO_SPRITE.length).toBe(SPRITE_SIZE);
    for (const row of HERO_SPRITE) expect(row.length).toBe(SPRITE_SIZE);
  });
});
