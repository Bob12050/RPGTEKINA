// ガチャの排出率・プール・確定枠の検証
import { afterEach, describe, expect, it } from 'vitest';
import { setRandomSource } from '../src/core/rng';
import { rankScore, rankStars } from '../src/core/types';
import {
  GACHA_EXCLUDED,
  GUARANTEE_MIN_RANK,
  MULTI_COST,
  MULTI_COUNT,
  RANK_RATES,
  SINGLE_COST,
  gachaLevel,
  gachaPool,
  inGachaPool,
  pullOne,
  pullTen,
} from '../src/data/gacha';
import { SPECIES } from '../src/data/monsters';
import { STAGES } from '../src/data/stages';

afterEach(() => setRandomSource(Math.random));

describe('ガチャ', () => {
  it('排出率の合計が100%になっている', () => {
    const total = RANK_RATES.reduce((s, r) => s + r.weight, 0);
    expect(total).toBe(100);
  });

  it('10連は単発10回よりおトク', () => {
    expect(MULTI_COST).toBeLessThan(SINGLE_COST * MULTI_COUNT);
  });

  it('排出対象の全ランクにプールがあり、ボス(テキーナ)は出ない', () => {
    for (const r of RANK_RATES) {
      const pool = gachaPool(r.rank);
      expect(pool.length, r.rank).toBeGreaterThan(0);
      for (const sp of pool) expect(GACHA_EXCLUDED.has(sp.id)).toBe(false);
    }
    expect(inGachaPool('tekina')).toBe(false);
    expect(inGachaPool('puni')).toBe(false); // Fランクはガチャに出ない(ドロップ枠)
    expect(inGachaPool('bahamut')).toBe(true); // 高レアはガチャ限定
  });

  it('pullOne は排出対象ランクの種族を返す', () => {
    for (let i = 0; i < 200; i++) {
      const sp = pullOne();
      expect(RANK_RATES.some((r) => r.rank === sp.rank)).toBe(true);
      expect(GACHA_EXCLUDED.has(sp.id)).toBe(false);
    }
  });

  it('pullTen は10体返し、最終枠は★4(Cランク)以上が確定', () => {
    // 乱数が最低値でも(=最も低レア寄りでも)最終枠はCランク以上
    const results = pullTen(() => 0);
    expect(results).toHaveLength(MULTI_COUNT);
    const last = results[results.length - 1]!;
    expect(rankScore(last.rank)).toBeGreaterThanOrEqual(rankScore(GUARANTEE_MIN_RANK));
    expect(rankStars(last.rank)).toBeGreaterThanOrEqual(4);
  });

  it('乱数が最大寄りだと最高レアのSランクが出る', () => {
    const sp = pullOne(() => 0.999999);
    expect(sp.rank).toBe('S');
  });

  it('加入レベルは1〜50の範囲', () => {
    setRandomSource(() => 0.99);
    for (const r of RANK_RATES) {
      const lv = gachaLevel(r.rank);
      expect(lv).toBeGreaterThanOrEqual(1);
      expect(lv).toBeLessThanOrEqual(50);
    }
  });

  it('図鑑コンプが可能(全種族がガチャ・ドロップ・スターターのどれかで入手できる)', () => {
    const obtainable = new Set<string>(['puni', 'rabbit']); // スターター
    for (const r of RANK_RATES) for (const sp of gachaPool(r.rank)) obtainable.add(sp.id);
    for (const s of STAGES) for (const md of s.monsterDrops ?? []) obtainable.add(md.speciesId);
    obtainable.add('tekina'); // ストーリーボス(図鑑は「はっけん」まで)
    const missing = SPECIES.filter((sp) => !obtainable.has(sp.id)).map((sp) => sp.id);
    expect(missing).toEqual([]);
  });
});
