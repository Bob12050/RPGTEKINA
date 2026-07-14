// ============================================================
// セーブ / ロード (localStorage)
// テスト用にストレージを差し替えられるようにしてある。
// ============================================================
import type { GameState } from '../core/types';
import { SAVE_VERSION } from '../core/types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

let storage: StorageLike =
  typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage();

export function setStorage(s: StorageLike): void {
  storage = s;
}

function key(slot: number): string {
  return `rpgtekina_save_${slot}`;
}

export function saveGame(state: GameState, slot = 1): boolean {
  try {
    storage.setItem(key(slot), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot = 1): GameState | null {
  try {
    const raw = storage.getItem(key(slot));
    if (!raw) return null;
    const state = JSON.parse(raw) as GameState;
    if (typeof state !== 'object' || state === null) return null;
    if (state.version !== SAVE_VERSION) {
      // 将来バージョンが上がったらここでマイグレーションを行う
      return migrate(state);
    }
    if (!Array.isArray(state.party) || state.party.length === 0) return null;
    return state;
  } catch {
    return null;
  }
}

export function hasSave(slot = 1): boolean {
  return storage.getItem(key(slot)) !== null;
}

export function deleteSave(slot = 1): void {
  storage.removeItem(key(slot));
}

/** 旧セーブに含まれた不要フィールド(フィールド探索時代の位置情報) */
interface LegacyFields {
  mapId?: string;
  x?: number;
  y?: number;
  dir?: string;
}

function migrate(state: GameState): GameState | null {
  if (typeof state.version !== 'number') return null;
  if (state.version > SAVE_VERSION) return null; // 未来のセーブは読めない
  if (!Array.isArray(state.party) || state.party.length === 0) return null;

  // v1(フィールド探索制) → v2(ステージ制)
  //  - clearedStages を補完(ボス撃破済みなら全メインステージをクリア扱い)
  //  - 位置情報(mapId/x/y/dir)は破棄
  const legacy = state as GameState & LegacyFields;
  const migrated: GameState = {
    ...state,
    version: SAVE_VERSION,
    clearedStages: Array.isArray(state.clearedStages)
      ? state.clearedStages
      : legacy.flags?.['clearedBoss']
        ? ['plains', 'forest', 'cave', 'volcano', 'lair']
        : [],
  };
  delete (migrated as GameState & LegacyFields).mapId;
  delete (migrated as GameState & LegacyFields).x;
  delete (migrated as GameState & LegacyFields).y;
  delete (migrated as GameState & LegacyFields).dir;
  return migrated;
}
