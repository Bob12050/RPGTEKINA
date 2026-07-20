// ============================================================
// ゲーム全体の状態と、それを操作するヘルパー
// ============================================================
import type { GameState, MonsterInstance } from '../core/types';
import { FARM_MAX, MAX_LUCK, PARTY_MAX, SAVE_VERSION } from '../core/types';
import { createMonster, fullHeal } from './monster';

/** はじめから遊ぶとき最初に持っているオーブ(チュートリアル10連ぶん+α) */
export const STARTING_ORBS = 50;

export function newGame(): GameState {
  // スターターは2体(連戦ステージで 1対2 にならないように)
  const starter = createMonster('puni', 3, { nickname: 'ぷにきち' });
  const partner = createMonster('rabbit', 3, { nickname: 'ぴょんた' });
  return {
    version: SAVE_VERSION,
    playerName: 'マスター',
    gold: 60,
    orbs: STARTING_ORBS,
    party: [starter, partner],
    farm: [],
    items: { herb: 6 },
    clearedStages: [],
    flags: {},
    seenSpecies: ['puni', 'rabbit'],
    scoutedSpecies: ['puni', 'rabbit'],
    battleCount: 0,
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

/** モンスター入手の結果 */
export interface ObtainResult {
  /** party/farm=新規加入 / luck=ダブりでラックUP / full=ボックス満杯で入手できず */
  kind: 'party' | 'farm' | 'luck' | 'full';
  species: string;
  /** ラックUP後(または新規)のラック値 */
  luck: number;
}

/** 手持ち+ボックスから、その種族で いちばんラックの高い個体を返す */
function bestOf(state: GameState, speciesId: string): MonsterInstance | undefined {
  return [...state.party, ...state.farm]
    .filter((m) => m.speciesId === speciesId)
    .sort((a, b) => b.luck - a.luck)[0];
}

/**
 * モンスターを入手する(ガチャ・ドロップ・降臨の共通口)。
 * すでに持っている種族なら、新しく増やさず「ラック(運)」を+1する = モンスト式。
 * ラックが上限のときだけ 新しい個体として加える。
 */
export function obtainMonster(state: GameState, speciesId: string, level: number): ObtainResult {
  markScouted(state, speciesId);
  const owned = bestOf(state, speciesId);
  if (owned && owned.luck < MAX_LUCK) {
    owned.luck += 1;
    return { kind: 'luck', species: speciesId, luck: owned.luck };
  }
  const m = createMonster(speciesId, level);
  const where = addMonster(state, m);
  return { kind: where, species: speciesId, luck: m.luck };
}

/** パーティのラック合計(石掘り・ドロップのボーナス計算に使う) */
export function partyLuck(state: GameState): number {
  return state.party.reduce((s, m) => s + (m.luck ?? 1), 0);
}

/** ラックによるドロップ率の倍率(1.0〜2.0)。パーティのラックが高いほどよく落ちる */
export function luckDropMult(state: GameState): number {
  return Math.min(2, 1 + partyLuck(state) * 0.004);
}

/** ラックによる石掘りオーブのボーナス(パーティのラック合計に応じて +n 個) */
export function luckOrbBonus(state: GameState): number {
  return Math.floor(partyLuck(state) / 40);
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

/** 「なかまにした」を図鑑に記録する(フィールド名はセーブ互換のため scoutedSpecies のまま) */
export function markScouted(state: GameState, speciesId: string): void {
  markSeen(state, speciesId);
  if (!state.scoutedSpecies.includes(speciesId)) state.scoutedSpecies.push(speciesId);
}

/** パーティが全員戦闘不能かどうか */
export function isPartyWiped(state: GameState): boolean {
  return state.party.every((m) => m.hp <= 0);
}
