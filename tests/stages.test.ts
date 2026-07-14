// エリア/クエスト(ノマダン式2階層)の整合性 + 解放ロジックの検証
import { describe, expect, it } from 'vitest';
import { hasSpecies } from '../src/data/monsters';
import { getItem } from '../src/data/items';
import {
  AREAS,
  areaProgress,
  FIRST_STAGE,
  getArea,
  getStage,
  hasStage,
  isAreaUnlocked,
  isStageUnlocked,
  questsOf,
  repeatGold,
  STAGES,
} from '../src/data/stages';

describe('エリア/クエストデータ', () => {
  it('IDが重複していない', () => {
    const qids = STAGES.map((s) => s.id);
    expect(new Set(qids).size).toBe(qids.length);
    const aids = AREAS.map((a) => a.id);
    expect(new Set(aids).size).toBe(aids.length);
  });

  it('全クエストが実在するエリアに属し、各エリアに1つ以上クエストがある', () => {
    for (const s of STAGES) expect(() => getArea(s.areaId), s.id).not.toThrow();
    for (const a of AREAS) expect(questsOf(a.id).length, a.id).toBeGreaterThan(0);
  });

  it('全クエストの敵・ボスの種族が存在する', () => {
    for (const s of STAGES) {
      for (const wave of [...s.waves, s.boss]) {
        expect(wave.length, `${s.id} の空のWAVE`).toBeGreaterThan(0);
        for (const e of wave) {
          expect(hasSpecies(e.speciesId), `${s.id} の ${e.speciesId}`).toBe(true);
          expect(e.level).toBeGreaterThanOrEqual(1);
          expect(e.level).toBeLessThanOrEqual(50);
        }
      }
    }
  });

  it('報酬アイテムが存在し、金額・オーブが正', () => {
    for (const s of STAGES) {
      expect(s.rewardGold).toBeGreaterThan(0);
      expect(s.rewardOrbs, `${s.id} のオーブ報酬`).toBeGreaterThan(0);
      for (const r of s.rewardItems) {
        expect(() => getItem(r.itemId), `${s.id} の ${r.itemId}`).not.toThrow();
        expect(r.count).toBeGreaterThan(0);
      }
    }
  });

  it('最初のクエストは最初から挑戦可能', () => {
    expect(isStageUnlocked(getStage(FIRST_STAGE), [])).toBe(true);
    expect(isAreaUnlocked(AREAS[0]!.id, [])).toBe(true);
  });

  it('エリア内のクエストは順番に解放される', () => {
    const quests = questsOf('plains');
    expect(quests.length).toBeGreaterThanOrEqual(2);
    // 2番目は1番目をクリアするまでロック
    expect(isStageUnlocked(quests[1]!, [])).toBe(false);
    expect(isStageUnlocked(quests[1]!, [quests[0]!.id])).toBe(true);
  });

  it('次のエリアは前エリアの最終クエストをクリアすると解放される', () => {
    const plainsQuests = questsOf('plains');
    const lastPlains = plainsQuests[plainsQuests.length - 1]!;
    expect(isAreaUnlocked('forest', [])).toBe(false);
    // 途中まででは解放されない
    expect(isAreaUnlocked('forest', plainsQuests.slice(0, -1).map((s) => s.id))).toBe(false);
    expect(isAreaUnlocked('forest', [lastPlains.id])).toBe(true);
  });

  it('順番にクリアすれば全クエスト到達できる(詰みがない)', () => {
    const cleared: string[] = [];
    let progressed = true;
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

  it('areaProgress がクリア数を返す', () => {
    const quests = questsOf('plains');
    expect(areaProgress('plains', [])).toEqual({ done: 0, total: quests.length });
    expect(areaProgress('plains', [quests[0]!.id]).done).toBe(1);
  });

  it('メインエリアの推奨レベルはエリア内・エリア間で単調増加ぎみ', () => {
    const mainAreas = AREAS.filter((a) => !a.postgame);
    let prevMax = 0;
    for (const a of mainAreas) {
      const quests = questsOf(a.id);
      for (let i = 1; i < quests.length; i++) {
        expect(quests[i]!.recLevel, `${a.id} 内`).toBeGreaterThanOrEqual(quests[i - 1]!.recLevel);
      }
      expect(quests[0]!.recLevel, `${a.id} 先頭`).toBeGreaterThanOrEqual(prevMax - 2);
      prevMax = quests[quests.length - 1]!.recLevel;
    }
  });

  it('hasStage が正しく判定する', () => {
    expect(hasStage('plains-1')).toBe(true);
    expect(hasStage('plains')).toBe(false); // 旧IDはもう存在しない
  });

  it('周回ドロップのデータが正しい', () => {
    for (const s of STAGES) {
      for (const d of s.drops ?? []) {
        expect(() => getItem(d.itemId), `${s.id} の ${d.itemId}`).not.toThrow();
        expect(d.chance).toBeGreaterThan(0);
        expect(d.chance).toBeLessThanOrEqual(1);
        expect(d.count).toBeGreaterThan(0);
      }
    }
  });

  it('モンスタードロップは実在し、確率・レベルが正しい', () => {
    for (const s of STAGES) {
      for (const md of s.monsterDrops ?? []) {
        expect(hasSpecies(md.speciesId), `${s.id} の ${md.speciesId}`).toBe(true);
        expect(md.chance).toBeGreaterThan(0);
        expect(md.chance).toBeLessThanOrEqual(1);
        expect(md.level).toBeGreaterThanOrEqual(1);
        expect(md.level).toBeLessThanOrEqual(50);
      }
    }
  });

  it('周回ボーナスは正で初回報酬より少ない', () => {
    for (const s of STAGES) {
      const g = repeatGold(s);
      expect(g).toBeGreaterThan(0);
      expect(g).toBeLessThan(s.rewardGold + 1);
    }
  });

  it('エリアの代表モンスターが実在する', () => {
    for (const a of AREAS) {
      expect(hasSpecies(a.iconSpecies), a.id).toBe(true);
    }
  });
});
