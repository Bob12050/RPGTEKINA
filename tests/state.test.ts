import { describe, expect, it } from 'vitest';
import { FARM_MAX, MAX_LUCK, PARTY_MAX } from '../src/core/types';
import { createMonster } from '../src/game/monster';
import {
  addMonster,
  consumeItem,
  luckDropMult,
  luckOrbBonus,
  markScouted,
  markSeen,
  newGame,
  obtainMonster,
  partyLuck,
} from '../src/game/state';

describe('ゲーム状態', () => {
  it('図鑑の発見・仲間フラグが重複なく記録される', () => {
    const state = newGame();
    markSeen(state, 'wolf');
    markSeen(state, 'wolf');
    expect(state.seenSpecies.filter((s) => s === 'wolf')).toHaveLength(1);

    markScouted(state, 'wolf');
    markScouted(state, 'wolf');
    expect(state.scoutedSpecies.filter((s) => s === 'wolf')).toHaveLength(1);
    // なかまにした種族は「はっけん」にも入る
    expect(state.seenSpecies).toContain('wolf');
  });

  it('スターターは2体いて、最初から図鑑に登録されている', () => {
    const state = newGame();
    expect(state.party).toHaveLength(2); // 連戦で 1対2 にならないように
    expect(state.scoutedSpecies).toContain('puni');
    expect(state.scoutedSpecies).toContain('rabbit');
  });

  it('はじめから10連ガチャを1回まわせるオーブを持っている', () => {
    const state = newGame();
    expect(state.orbs).toBeGreaterThanOrEqual(45);
  });

  it('パーティが満員なら牧場へ送られる', () => {
    const state = newGame(); // スターター1体が既にいる
    while (state.party.length < PARTY_MAX) addMonster(state, createMonster('wolf', 5));
    expect(state.party).toHaveLength(PARTY_MAX);
    expect(addMonster(state, createMonster('rabbit', 3))).toBe('farm');
    expect(state.farm).toHaveLength(1);
  });

  it('アイテムは所持数を超えて消費できない', () => {
    const state = newGame();
    expect(consumeItem(state, 'herb', 999)).toBe(false);
    expect(consumeItem(state, 'herb', 1)).toBe(true);
  });
});

describe('ラック(運)', () => {
  it('新種族は新規加入、同じ種族のダブりはラックUP(数は増えない)', () => {
    const state = newGame();
    state.party = []; // まっさらから検証
    state.farm = [];

    const first = obtainMonster(state, 'wolf', 5);
    expect(first.kind).toBe('party');
    expect(first.luck).toBe(1);
    expect(state.party.length + state.farm.length).toBe(1);

    const dup = obtainMonster(state, 'wolf', 5);
    expect(dup.kind).toBe('luck');
    expect(dup.luck).toBe(2); // ラックが上がる
    expect(state.party.length + state.farm.length).toBe(1); // 数は増えない

    // もう1体別種を入れると新規加入
    const other = obtainMonster(state, 'golem', 5);
    expect(other.kind).toBe('party');
    expect(state.party.length + state.farm.length).toBe(2);
  });

  it('ラックが上限に達したら新しい個体として増える', () => {
    const state = newGame();
    state.party = [createMonster('wolf', 5, { luck: MAX_LUCK })];
    state.farm = [];
    const r = obtainMonster(state, 'wolf', 5);
    expect(r.kind).toBe('party');
    expect(state.party.length).toBe(2);
  });

  it('パーティのラック合計とボーナスが計算できる', () => {
    const state = newGame();
    state.party = [
      createMonster('wolf', 5, { luck: 40 }),
      createMonster('golem', 5, { luck: 40 }),
    ];
    expect(partyLuck(state)).toBe(80);
    expect(luckOrbBonus(state)).toBe(2); // floor(80/40)
    expect(luckDropMult(state)).toBeGreaterThan(1);
    expect(luckDropMult(state)).toBeLessThanOrEqual(2);
  });

  it('ドロップ倍率は上限2.0でクランプされる', () => {
    const state = newGame();
    state.party = Array.from({ length: PARTY_MAX }, () => createMonster('wolf', 5, { luck: MAX_LUCK }));
    expect(luckDropMult(state)).toBe(2);
  });

  it('ボックス満杯なら full を返す', () => {
    const state = newGame();
    state.party = Array.from({ length: PARTY_MAX }, () => createMonster('golem', 5));
    state.farm = Array.from({ length: FARM_MAX }, () => createMonster('golem', 5));
    // wolf はまだ居ないので新規加入を試みる → 満杯
    const r = obtainMonster(state, 'wolf', 5);
    expect(r.kind).toBe('full');
  });
});
