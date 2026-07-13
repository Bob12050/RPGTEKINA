// データ整合性テスト:
// モンスター・とくぎ・マップ・配合レシピを追加したとき、
// 参照ミスや形式ミスをここで自動検出する。
import { describe, expect, it } from 'vitest';
import { FAMILY_NAMES, RANK_ORDER, type Family } from '../src/core/types';
import { ITEMS } from '../src/data/items';
import { CHAR_TO_TILE, MAPS, START_MAP, START_X, START_Y, WALKABLE, getMap, isWalkable, tileAt } from '../src/data/maps';
import { SPECIES, getSpecies, hasSpecies } from '../src/data/monsters';
import { SKILLS, hasSkill } from '../src/data/skills';
import { SPECIAL_RECIPES, childFamily } from '../src/data/synthesis';
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

  it('全系統に通常配合で生まれられる種族がいる', () => {
    for (const f of FAMILIES) {
      const candidates = SPECIES.filter((s) => s.family === f && s.scoutDifficulty > 0);
      expect(candidates.length, f).toBeGreaterThan(0);
    }
  });
});

describe('アイテムデータ', () => {
  it('IDが重複していない', () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('配合データ', () => {
  it('系統表が全組み合わせを網羅している', () => {
    for (const a of FAMILIES) {
      for (const b of FAMILIES) {
        expect(() => childFamily(a, b)).not.toThrow();
        expect(FAMILIES).toContain(childFamily(a, b));
      }
    }
  });

  it('特殊レシピの種族がすべて存在する', () => {
    for (const r of SPECIAL_RECIPES) {
      expect(hasSpecies(r.parents[0]), r.hint).toBe(true);
      expect(hasSpecies(r.parents[1]), r.hint).toBe(true);
      expect(hasSpecies(r.child), r.hint).toBe(true);
    }
  });

  it('レシピが重複していない', () => {
    const keys = SPECIAL_RECIPES.map((r) => [...r.parents].sort().join('+'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('マップデータ', () => {
  it('全行が同じ長さで未知のタイル文字がない', () => {
    for (const m of MAPS) {
      const w = m.tiles[0]!.length;
      for (const row of m.tiles) {
        expect(row.length, `${m.id} の行の長さ`).toBe(w);
        for (const ch of row) {
          expect(CHAR_TO_TILE[ch], `${m.id} の不明なタイル '${ch}'`).toBeDefined();
        }
      }
    }
  });

  it('ポータルが有効(行き先マップが存在し、両端とも歩ける)', () => {
    for (const m of MAPS) {
      for (const p of m.portals) {
        expect(WALKABLE[tileAt(m, p.x, p.y)], `${m.id}(${p.x},${p.y})`).toBe(true);
        const to = getMap(p.toMap);
        expect(isWalkable(to, p.toX, p.toY), `${m.id}→${p.toMap}(${p.toX},${p.toY})`).toBe(true);
      }
    }
  });

  it('エンカウントテーブルの種族が存在し、ボスが野生に出ない', () => {
    for (const m of MAPS) {
      for (const e of m.encounters) {
        expect(hasSpecies(e.speciesId), `${m.id} の ${e.speciesId}`).toBe(true);
        expect(getSpecies(e.speciesId).scoutDifficulty, `${m.id} の ${e.speciesId} はスカウト不可`).toBeGreaterThan(0);
        expect(e.minLevel).toBeLessThanOrEqual(e.maxLevel);
        expect(e.weight).toBeGreaterThan(0);
      }
      if (m.encounterRate > 0) expect(m.encounters.length).toBeGreaterThan(0);
    }
  });

  it('NPCがマップ内の歩けるタイルに立っている', () => {
    for (const m of MAPS) {
      for (const n of m.npcs) {
        expect(WALKABLE[tileAt(m, n.x, n.y)], `${m.id} の ${n.name}`).toBe(true);
      }
    }
  });

  it('開始位置が歩ける', () => {
    expect(isWalkable(getMap(START_MAP), START_X, START_Y)).toBe(true);
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
