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

  it('旧v1セーブ(フィールド探索制)を v2(ステージ制)へ移行する', () => {
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
    // 位置情報は破棄される
    expect((loaded as unknown as Record<string, unknown>).mapId).toBeUndefined();
    // ボス撃破済みなのでメインステージがクリア扱いになる
    expect(loaded!.clearedStages).toContain('lair');
    expect(loaded!.clearedStages).toContain('plains');
    // それ以外のデータは保たれる
    expect(loaded!.gold).toBe(500);
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
