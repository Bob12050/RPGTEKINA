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

function migrate(state: GameState): GameState | null {
  // 現状 version 1 のみ。将来ここに変換処理を足していく。
  if (typeof state.version !== 'number') return null;
  return state.version <= SAVE_VERSION ? { ...state, version: SAVE_VERSION } : null;
}
