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

/** 旧セーブに含まれた不要フィールド(フィールド探索時代・配合時代の名残) */
interface LegacyFields {
  mapId?: string;
  x?: number;
  y?: number;
  dir?: string;
  synthesisCount?: number;
}

/** v2(フラットなステージID) → v3(エリア内クエストID)の対応表 */
const V2_STAGE_TO_QUESTS: Record<string, string[]> = {
  plains: ['plains-1', 'plains-2', 'plains-3'],
  forest: ['forest-1', 'forest-2', 'forest-3'],
  cave: ['cave-1', 'cave-2', 'cave-3'],
  volcano: ['volcano-1', 'volcano-2', 'volcano-3'],
  lair: ['lair-1', 'lair-2'],
  'trial-dragon': ['trial-1'],
  'trial-light': ['trial-2'],
  'trial-god': ['trial-3'],
};

/** v4(ソシャゲ化)で廃止されたアイテム(スカウト用ごちそう) */
const REMOVED_ITEMS = ['meatchunk', 'royalmeat'];

/** v4移行時に旧セーブへ配るおわびオーブ(ガチャをすぐ試せる量) */
const MIGRATION_ORBS = 60;

function migrate(state: GameState): GameState | null {
  if (typeof state.version !== 'number') return null;
  if (state.version > SAVE_VERSION) return null; // 未来のセーブは読めない
  if (!Array.isArray(state.party) || state.party.length === 0) return null;

  // v1(フィールド探索制): clearedStages が無い → ボス撃破フラグから補完
  let cleared: string[] = Array.isArray(state.clearedStages)
    ? [...state.clearedStages]
    : state.flags?.['clearedBoss']
      ? ['plains', 'forest', 'cave', 'volcano', 'lair']
      : [];

  // v2 → v3: 旧ステージIDを新クエストID群に展開(クリア済みエリアは全クエストクリア扱い)
  cleared = [...new Set(cleared.flatMap((id) => V2_STAGE_TO_QUESTS[id] ?? [id]))];

  // v3 → v4(ソシャゲ化): オーブを付与し、廃止アイテムを取り除く
  const items = { ...(state.items ?? {}) };
  for (const id of REMOVED_ITEMS) delete items[id];
  const orbs = typeof state.orbs === 'number' ? state.orbs : MIGRATION_ORBS;

  const migrated: GameState = { ...state, version: SAVE_VERSION, clearedStages: cleared, items, orbs };
  // 旧時代のフィールドは破棄
  delete (migrated as GameState & LegacyFields).mapId;
  delete (migrated as GameState & LegacyFields).x;
  delete (migrated as GameState & LegacyFields).y;
  delete (migrated as GameState & LegacyFields).dir;
  delete (migrated as GameState & LegacyFields).synthesisCount;
  return migrated;
}
