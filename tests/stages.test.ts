// エリア/クエスト(ノマダン式2階層)の整合性 + 解放ロジックの検証
import { describe, expect, it } from 'vitest';
import { hasSpecies } from '../src/data/monsters';
import { getItem } from '../src/data/items';
import {
  adventProgress,
  ADVENT_GROUPS,
  ADVENT_STAGES,
  AREAS,
  areaProgress,
  EVENT_STAGES,
  FIRST_STAGE,
  getArea,
  getStage,
  hasStage,
  isAdventUnlocked,
  isAreaUnlocked,
  isExtraStageUnlocked,
  isNormalQuest,
  isStageUnlocked,
  questsOf,
  repeatGold,
  repeatOrbs,
  STAGES,
  TRAINING_STAGES,
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

  it('全クエストに敵がいて、種族・レベルが正しい', () => {
    for (const s of STAGES) {
      expect(s.enemies.length, `${s.id} に敵がいない`).toBeGreaterThan(0);
      expect(s.enemies.length, `${s.id} の敵が多すぎ(画面に収まらない)`).toBeLessThanOrEqual(4);
      for (const e of s.enemies) {
        expect(hasSpecies(e.speciesId), `${s.id} の ${e.speciesId}`).toBe(true);
        expect(e.level).toBeGreaterThanOrEqual(1);
        expect(e.level).toBeLessThanOrEqual(50);
      }
    }
  });

  it('各エリアの最後のクエストがボス戦になっている', () => {
    for (const a of AREAS) {
      const quests = questsOf(a.id);
      const last = quests[quests.length - 1]!;
      expect(last.boss, `${a.id} の最終クエスト ${last.id}`).toBe(true);
      // 通常エリアの途中のクエストはボスではない(しれんは全部ボスでOK)
      if (!a.postgame) {
        for (const s of quests.slice(0, -1)) {
          expect(s.boss ?? false, `${s.id} は途中なのにボス`).toBe(false);
        }
      }
    }
  });

  it('ボスクエストの敵は少数精鋭(大きく描くため2体まで)', () => {
    for (const s of STAGES) {
      if (s.boss) expect(s.enemies.length, s.id).toBeLessThanOrEqual(2);
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

  it('ノーマルクエストは周回でオーブが掘れる(石掘り)。奥ほど効率がよい', () => {
    // 全ノーマルクエストは repeatOrbs > 0
    for (const s of STAGES) {
      expect(isNormalQuest(s), s.id).toBe(true);
      expect(repeatOrbs(s), s.id).toBeGreaterThan(0);
    }
    // エリアが進むほど周回オーブは減らない(単調増加ぎみ)
    const first = repeatOrbs(questsOf('plains')[0]!);
    const last = repeatOrbs(questsOf('trial')[questsOf('trial').length - 1]!);
    expect(last).toBeGreaterThan(first);
  });

  it('エリアの代表モンスターが実在する', () => {
    for (const a of AREAS) {
      expect(hasSpecies(a.iconSpecies), a.id).toBe(true);
    }
  });
});

describe('育成/イベントクエスト', () => {
  const EXTRAS = [...TRAINING_STAGES, ...EVENT_STAGES, ...ADVENT_STAGES];

  it('IDが重複せず、getStage/hasStage で引ける', () => {
    const ids = EXTRAS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of EXTRAS) {
      expect(hasStage(s.id), s.id).toBe(true);
      expect(getStage(s.id).id).toBe(s.id);
    }
  });

  it('敵・報酬・ドロップ・モンスタードロップが正しい', () => {
    for (const s of EXTRAS) {
      expect(s.enemies.length, s.id).toBeGreaterThan(0);
      for (const e of s.enemies) {
        expect(hasSpecies(e.speciesId), `${s.id} の ${e.speciesId}`).toBe(true);
        expect(e.level).toBeGreaterThanOrEqual(1);
        expect(e.level).toBeLessThanOrEqual(50);
      }
      expect(s.rewardGold).toBeGreaterThan(0);
      for (const r of s.rewardItems) expect(() => getItem(r.itemId), `${s.id} の ${r.itemId}`).not.toThrow();
      for (const d of s.drops ?? []) expect(() => getItem(d.itemId), `${s.id} の ${d.itemId}`).not.toThrow();
      for (const md of s.monsterDrops ?? []) expect(hasSpecies(md.speciesId), `${s.id} の ${md.speciesId}`).toBe(true);
    }
  });

  it('解放条件は実在するステージIDで、未クリアなら封鎖される', () => {
    for (const s of EXTRAS) {
      if (s.requires === undefined) {
        expect(isExtraStageUnlocked(s, []), `${s.id} は無条件`).toBe(true);
        continue;
      }
      expect(hasStage(s.requires), `${s.id} の requires ${s.requires}`).toBe(true);
      expect(isExtraStageUnlocked(s, []), `${s.id} は未クリアで封鎖`).toBe(false);
      expect(isExtraStageUnlocked(s, [s.requires]), `${s.id} は条件クリアで解放`).toBe(true);
    }
  });

  it('育成/イベント/降臨は石掘り対象ではない(repeatOrbs=0)', () => {
    for (const s of EXTRAS) {
      expect(isNormalQuest(s), s.id).toBe(false);
      expect(repeatOrbs(s), s.id).toBe(0);
    }
  });

  it('降臨クエストが存在し、確定加入モンスターが実在する', () => {
    expect(ADVENT_STAGES.length).toBeGreaterThan(0);
    for (const s of ADVENT_STAGES) {
      expect(s.advent, `${s.id} は降臨`).toBe(true);
      expect(s.boss, `${s.id} はボス扱い`).toBe(true);
      expect(s.firstClearMonster, `${s.id} の確定加入`).toBeDefined();
      const fc = s.firstClearMonster!;
      expect(hasSpecies(fc.speciesId), `${s.id} の ${fc.speciesId}`).toBe(true);
      expect(fc.level).toBeGreaterThanOrEqual(1);
      expect(fc.level).toBeLessThanOrEqual(50);
    }
  });

  it('降臨グループは難易度が段階解放され、上ほど強く報酬も多い', () => {
    for (const g of ADVENT_GROUPS) {
      expect(g.tiers.length, `${g.id} の難易度数`).toBeGreaterThanOrEqual(2);
      // グループ解放は requires(ストーリー)で判定
      expect(isAdventUnlocked(g, []), `${g.id} は未クリアで封鎖`).toBe(false);
      expect(isAdventUnlocked(g, [g.requires]), `${g.id} は条件クリアで解放`).toBe(true);

      // 初級は requires=ストーリー、それ以降は前の難易度クリアが条件
      expect(g.tiers[0]!.requires).toBe(g.requires);
      for (let i = 1; i < g.tiers.length; i++) {
        expect(g.tiers[i]!.requires, `${g.tiers[i]!.id} の解放条件`).toBe(g.tiers[i - 1]!.id);
        // 難易度が上がるほど すいしょうLv・オーブ・加入Lvが単調増加(または同等)
        expect(g.tiers[i]!.recLevel).toBeGreaterThanOrEqual(g.tiers[i - 1]!.recLevel);
        expect(g.tiers[i]!.rewardOrbs).toBeGreaterThanOrEqual(g.tiers[i - 1]!.rewardOrbs);
        expect(g.tiers[i]!.firstClearMonster!.level).toBeGreaterThanOrEqual(g.tiers[i - 1]!.firstClearMonster!.level);
      }
      // 進捗計算
      expect(adventProgress(g, [])).toEqual({ done: 0, total: g.tiers.length });
      expect(adventProgress(g, [g.tiers[0]!.id]).done).toBe(1);
    }
  });
});
