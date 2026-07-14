import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_VERSION } from '../src/core/types';
import { deleteSave, hasSave, loadGame, saveGame, setStorage, type StorageLike } from '../src/game/save';
import { addMonster, consumeItem, newGame } from '../src/game/state';
import { createMonster } from '../src/game/monster';

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

let storage: FakeStorage;
beforeEach(() => {
  storage = new FakeStorage();
  setStorage(storage);
});

describe('セーブ / ロード', () => {
  it('往復でゲーム状態が保たれる', () => {
    const state = newGame();
    state.gold = 1234;
    state.clearedStages.push('plains', 'forest');
    addMonster(state, createMonster('wolf', 7));
    consumeItem(state, 'herb');
    expect(saveGame(state)).toBe(true);

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(state);
  });

  it('セーブがなければ null', () => {
    expect(loadGame()).toBeNull();
    expect(hasSave()).toBe(false);
  });

  it('壊れたデータは null', () => {
    storage.setItem('rpgtekina_save_1', '{invalid json!!');
    expect(loadGame()).toBeNull();
  });

  it('未来バージョンのセーブは読み込まない', () => {
    const state = newGame();
    state.version = SAVE_VERSION + 1;
    saveGame(state);
    expect(loadGame()).toBeNull();
  });

  it('削除できる', () => {
    saveGame(newGame());
    expect(hasSave()).toBe(true);
    deleteSave();
    expect(hasSave()).toBe(false);
  });

  it('スロットが分かれている', () => {
    const s1 = newGame();
    s1.gold = 111;
    const s2 = newGame();
    s2.gold = 222;
    saveGame(s1, 1);
    saveGame(s2, 2);
    expect(loadGame(1)!.gold).toBe(111);
    expect(loadGame(2)!.gold).toBe(222);
  });

  it('旧v1セーブ(フィールド探索制)を最新(エリア/クエスト制)へ移行する', () => {
    // v1 の形: mapId/x/y/dir があり clearedStages がない。ボス撃破フラグ付き
    const legacy = {
      version: 1,
      playerName: 'マスター',
      gold: 500,
      party: [createMonster('puni', 5)],
      farm: [],
      items: { herb: 2 },
      mapId: 'village',
      x: 10,
      y: 6,
      dir: 'down',
      flags: { clearedBoss: true },
      seenSpecies: ['puni'],
      scoutedSpecies: ['puni'],
      battleCount: 3,
      synthesisCount: 0,
    };
    storage.setItem('rpgtekina_save_1', JSON.stringify(legacy));
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    // 位置情報・配合カウントは破棄される
    expect((loaded as unknown as Record<string, unknown>).mapId).toBeUndefined();
    expect((loaded as unknown as Record<string, unknown>).synthesisCount).toBeUndefined();
    // ボス撃破済み → メインエリアの全クエストがクリア扱いになる
    expect(loaded!.clearedStages).toContain('plains-1');
    expect(loaded!.clearedStages).toContain('lair-2');
    // それ以外のデータは保たれる
    expect(loaded!.gold).toBe(500);
    // おわびオーブが付与される
    expect(loaded!.orbs).toBeGreaterThan(0);
  });

  it('v3セーブ(ソシャゲ化まえ)にオーブを付与し、廃止アイテムを取り除く', () => {
    const v3 = {
      ...newGame(),
      version: 3,
      items: { herb: 4, meatchunk: 2, royalmeat: 1 },
      clearedStages: ['plains-1'],
    } as Record<string, unknown>;
    delete v3.orbs;
    (v3 as { synthesisCount?: number }).synthesisCount = 5;
    storage.setItem('rpgtekina_save_1', JSON.stringify(v3));
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.orbs).toBeGreaterThan(0);
    expect(loaded!.items).toEqual({ herb: 4 }); // ごちそう系は消える
    expect((loaded as unknown as Record<string, unknown>).synthesisCount).toBeUndefined();
    expect(loaded!.clearedStages).toEqual(['plains-1']);
  });

  it('v2セーブ(フラットなステージID)をクエストIDへ展開して移行する', () => {
    const v2 = {
      ...newGame(),
      version: 2,
      clearedStages: ['plains', 'forest', 'trial-dragon'],
    };
    storage.setItem('rpgtekina_save_1', JSON.stringify(v2));
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.clearedStages).toEqual(
      expect.arrayContaining(['plains-1', 'plains-2', 'plains-3', 'forest-1', 'forest-2', 'forest-3', 'trial-1']),
    );
    // cave 系は含まれない
    expect(loaded!.clearedStages).not.toContain('cave-1');
  });

  it('ボス未撃破の旧セーブは clearedStages が空で移行される', () => {
    const legacy = {
      version: 1,
      playerName: 'マスター',
      gold: 60,
      party: [createMonster('puni', 3)],
      farm: [],
      items: {},
      mapId: 'village',
      x: 10,
      y: 6,
      dir: 'down',
      flags: {},
      seenSpecies: ['puni'],
      scoutedSpecies: ['puni'],
      battleCount: 0,
      synthesisCount: 0,
    };
    storage.setItem('rpgtekina_save_1', JSON.stringify(legacy));
    const loaded = loadGame();
    expect(loaded!.clearedStages).toEqual([]);
  });
});
