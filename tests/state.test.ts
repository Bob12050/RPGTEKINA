import { describe, expect, it } from 'vitest';
import { PARTY_MAX } from '../src/core/types';
import { createMonster } from '../src/game/monster';
import { addMonster, consumeItem, markScouted, markSeen, newGame } from '../src/game/state';

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

  it('スターターは最初から図鑑に登録されている', () => {
    const state = newGame();
    expect(state.seenSpecies).toContain('puni');
    expect(state.scoutedSpecies).toContain('puni');
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
