// ============================================================
// ゲーム全体の状態と、それを操作するヘルパー
// ============================================================
import type { GameState, MonsterInstance } from '../core/types';
import { FARM_MAX, PARTY_MAX, SAVE_VERSION } from '../core/types';
import { createMonster, fullHeal } from './monster';

export function newGame(): GameState {
  // スターターは2体(連戦ステージで 1対2 にならないように)
  const starter = createMonster('puni', 3, { nickname: 'ぷにきち' });
  const partner = createMonster('rabbit', 3, { nickname: 'ぴょんた' });
  return {
    version: SAVE_VERSION,
    playerName: 'マスター',
    gold: 60,
    party: [starter, partner],
    farm: [],
    items: { herb: 6, meatchunk: 2 },
    clearedStages: [],
    flags: {},
    seenSpecies: ['puni', 'rabbit'],
    scoutedSpecies: ['puni', 'rabbit'],
    battleCount: 0,
    synthesisCount: 0,
  };
}

/** ステージのクリアを記録する(重複なし)。新規クリアなら true */
export function markStageCleared(state: GameState, stageId: string): boolean {
  if (state.clearedStages.includes(stageId)) return false;
  state.clearedStages.push(stageId);
  return true;
}

/** 仲間を加える。パーティに空きがあればパーティ、なければ牧場へ */
export function addMonster(state: GameState, m: MonsterInstance): 'party' | 'farm' | 'full' {
  if (state.party.length < PARTY_MAX) {
    state.party.push(m);
    return 'party';
  }
  if (state.farm.length < FARM_MAX) {
    state.farm.push(m);
    return 'farm';
  }
  return 'full';
}

export function removeMonster(state: GameState, uid: string): MonsterInstance | null {
  const pi = state.party.findIndex((m) => m.uid === uid);
  if (pi >= 0) return state.party.splice(pi, 1)[0] ?? null;
  const fi = state.farm.findIndex((m) => m.uid === uid);
  if (fi >= 0) return state.farm.splice(fi, 1)[0] ?? null;
  return null;
}

export function healParty(state: GameState): void {
  for (const m of state.party) fullHeal(m);
  for (const m of state.farm) fullHeal(m);
}

export function addItem(state: GameState, itemId: string, count = 1): void {
  state.items[itemId] = (state.items[itemId] ?? 0) + count;
}

/** 所持数を減らす。足りなければ false */
export function consumeItem(state: GameState, itemId: string, count = 1): boolean {
  const have = state.items[itemId] ?? 0;
  if (have < count) return false;
  if (have - count <= 0) delete state.items[itemId];
  else state.items[itemId] = have - count;
  return true;
}

export function markSeen(state: GameState, speciesId: string): void {
  if (!state.seenSpecies.includes(speciesId)) state.seenSpecies.push(speciesId);
}

export function markScouted(state: GameState, speciesId: string): void {
  markSeen(state, speciesId);
  if (!state.scoutedSpecies.includes(speciesId)) state.scoutedSpecies.push(speciesId);
}

/** パーティが全員戦闘不能かどうか */
export function isPartyWiped(state: GameState): boolean {
  return state.party.every((m) => m.hp <= 0);
}
