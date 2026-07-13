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
    state.mapId = 'cave';
    state.x = 5;
    state.y = 6;
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
});
