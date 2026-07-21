import { describe, expect, it } from 'vitest';
import { FARM_MAX, PARTY_MAX } from '../src/core/types';
import { createMonster } from '../src/game/monster';
import {
  moveFarmMemberToParty,
  movePartyMemberToFarm,
  swapFarmMemberIntoParty,
} from '../src/game/partyManagement';
import { newGame } from '../src/game/state';

describe('パーティ編成', () => {
  it('個体参照と成長状態を保ったままパーティからボックスへ移す', () => {
    const state = newGame();
    const target = state.party[1]!;
    target.exp = 12;
    target.luck = 7;

    expect(movePartyMemberToFarm(state, target.uid)).toBe('ok');
    expect(state.farm[0]).toBe(target);
    expect(state.farm[0]!.exp).toBe(12);
    expect(state.farm[0]!.luck).toBe(7);
  });

  it('最後の1体、満杯のボックス、戦える仲間が消える移動を拒否する', () => {
    const state = newGame();
    state.party = [state.party[0]!];
    expect(movePartyMemberToFarm(state, state.party[0]!.uid)).toBe('lastMember');

    state.party.push(createMonster('rabbit', 3));
    state.farm = Array.from({ length: FARM_MAX }, () => createMonster('wolf', 2));
    expect(movePartyMemberToFarm(state, state.party[1]!.uid)).toBe('boxFull');

    state.farm = [];
    state.party[0]!.hp = 0;
    expect(movePartyMemberToFarm(state, state.party[1]!.uid)).toBe('noFighter');
  });

  it('空き枠へ加入し、満員時は指定枠と交換する', () => {
    const state = newGame();
    const incoming = createMonster('wolf', 9, { luck: 5 });
    state.farm.push(incoming);
    expect(moveFarmMemberToParty(state, incoming.uid)).toBe('ok');
    expect(state.party.at(-1)).toBe(incoming);

    while (state.party.length < PARTY_MAX) state.party.push(createMonster('golem', 4));
    const replacement = createMonster('treant', 8);
    state.farm.push(replacement);
    const outgoing = state.party[0]!;
    expect(moveFarmMemberToParty(state, replacement.uid)).toBe('partyFull');
    expect(swapFarmMemberIntoParty(state, replacement.uid, 0)).toBe('ok');
    expect(state.party[0]).toBe(replacement);
    expect(state.farm).toContain(outgoing);
  });
});
