import type { GameState, MonsterInstance } from '../core/types';
import { FARM_MAX, PARTY_MAX } from '../core/types';

export type PartyMoveResult =
  | 'ok'
  | 'notFound'
  | 'lastMember'
  | 'boxFull'
  | 'partyFull'
  | 'noFighter'
  | 'invalidSlot';

function findByUid(monsters: MonsterInstance[], uid: string): number {
  return monsters.findIndex((monster) => monster.uid === uid);
}

/** パーティの個体を、同じ参照のままボックスへ移す。 */
export function movePartyMemberToFarm(state: GameState, uid: string): PartyMoveResult {
  const index = findByUid(state.party, uid);
  if (index < 0) return 'notFound';
  if (state.party.length <= 1) return 'lastMember';
  if (state.farm.length >= FARM_MAX) return 'boxFull';
  if (state.party.filter((_, partyIndex) => partyIndex !== index).every((monster) => monster.hp <= 0)) {
    return 'noFighter';
  }

  const [monster] = state.party.splice(index, 1);
  if (!monster) return 'notFound';
  state.farm.push(monster);
  return 'ok';
}

/** 空きがあるパーティへ、ボックスの個体を同じ参照のまま移す。 */
export function moveFarmMemberToParty(state: GameState, uid: string): PartyMoveResult {
  const index = findByUid(state.farm, uid);
  if (index < 0) return 'notFound';
  if (state.party.length >= PARTY_MAX) return 'partyFull';

  const [monster] = state.farm.splice(index, 1);
  if (!monster) return 'notFound';
  state.party.push(monster);
  return 'ok';
}

/** 満員パーティの指定枠と、ボックスの個体を安全に交換する。 */
export function swapFarmMemberIntoParty(state: GameState, uid: string, partyIndex: number): PartyMoveResult {
  const farmIndex = findByUid(state.farm, uid);
  if (farmIndex < 0) return 'notFound';
  if (partyIndex < 0 || partyIndex >= state.party.length) return 'invalidSlot';

  const incoming = state.farm[farmIndex];
  const outgoing = state.party[partyIndex];
  if (!incoming || !outgoing) return 'invalidSlot';
  const nextParty = state.party.map((monster, index) => (index === partyIndex ? incoming : monster));
  if (nextParty.every((monster) => monster.hp <= 0)) return 'noFighter';

  state.party[partyIndex] = incoming;
  state.farm[farmIndex] = outgoing;
  return 'ok';
}
