import { afterEach, describe, expect, it } from 'vitest';
import { setRandomSource } from '../src/core/rng';
import { Battle, type AllyAction } from '../src/game/battle';
import { createMonster } from '../src/game/monster';

afterEach(() => setRandomSource(Math.random));

function fightAll(battle: Battle): Map<string, AllyAction> {
  const actions = new Map<string, AllyAction>();
  const target = battle.aliveEnemies()[0]!;
  for (const a of battle.aliveAllies()) actions.set(a.id, { kind: 'attack', targetId: target.id });
  return actions;
}

describe('Battle', () => {
  it('強い味方が弱い敵を倒すと勝利し報酬が入る', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('tekina', 50);
    const battle = new Battle([ally], [{ speciesId: 'puni', level: 1 }]);
    const events = battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    expect(battle.result).toBe('win');
    expect(battle.rewards.exp).toBeGreaterThan(0);
    expect(battle.rewards.gold).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'end' && e.result === 'win')).toBe(true);
  });

  it('弱い味方は強い敵に敗北する', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('puni', 1);
    const battle = new Battle([ally], [{ speciesId: 'tekina', level: 50 }]);
    // 数ターン回せば必ず全滅する
    for (let i = 0; i < 10 && !battle.result; i++) {
      battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    }
    expect(battle.result).toBe('lose');
  });

  it('とくぎ使用でMPが減る', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('mahopuni', 20);
    const battle = new Battle([ally], [{ speciesId: 'golem', level: 20 }]);
    const unit = battle.allies[0]!;
    const before = unit.mp;
    const actions = new Map<string, AllyAction>([
      [unit.id, { kind: 'skill', skillId: 'fire', targetId: battle.enemies[0]!.id }],
    ]);
    battle.executeTurn({ kind: 'fight', actions });
    expect(unit.mp).toBe(before - 2);
  });

  it('スカウト成功で敵が仲間になり報酬は入らない', () => {
    setRandomSource(() => 0); // 必ず成功
    const ally = createMonster('tekina', 50);
    const battle = new Battle([ally], [{ speciesId: 'puni', level: 2 }]);
    const events = battle.executeTurn({ kind: 'scout', targetId: battle.enemies[0]!.id });
    expect(battle.result).toBe('scouted');
    expect(battle.scoutedEnemy?.speciesId).toBe('puni');
    expect(battle.rewards.exp).toBe(0);
    expect(events.some((e) => e.type === 'scoutAttempt')).toBe(true);
  });

  it('スカウト失敗ではターンが続き敵が行動する', () => {
    let calls = 0;
    // scoutRateの乱数は使われないが、rollScoutで1を返して必ず失敗させる
    setRandomSource(() => {
      calls++;
      return 0.9999;
    });
    const ally = createMonster('puni', 5);
    const battle = new Battle([ally], [{ speciesId: 'golem', level: 15 }]);
    battle.executeTurn({ kind: 'scout', targetId: battle.enemies[0]!.id });
    expect(battle.result === null || battle.result === 'lose').toBe(true);
    expect(battle.scoutedEnemy).toBeNull();
    expect(calls).toBeGreaterThan(0);
  });

  it('ボスはスカウトできない', () => {
    setRandomSource(() => 0);
    const ally = createMonster('grandragon', 50);
    const battle = new Battle([ally], [{ speciesId: 'tekina', level: 32 }], true);
    const events = battle.executeTurn({ kind: 'scout', targetId: battle.enemies[0]!.id });
    expect(battle.result).not.toBe('scouted');
    expect(events.some((e) => e.type === 'scoutAttempt')).toBe(false);
  });

  it('ボス戦からは逃げられない', () => {
    setRandomSource(() => 0);
    const ally = createMonster('grandragon', 50);
    const battle = new Battle([ally], [{ speciesId: 'tekina', level: 32 }], true);
    battle.executeTurn({ kind: 'flee' });
    expect(battle.result).not.toBe('flee');
  });

  it('通常戦闘では逃げられる(乱数が有利なら)', () => {
    setRandomSource(() => 0);
    const ally = createMonster('puni', 5);
    const battle = new Battle([ally], [{ speciesId: 'puni', level: 1 }]);
    battle.executeTurn({ kind: 'flee' });
    expect(battle.result).toBe('flee');
  });

  it('syncBack で戦闘結果が元の個体に反映される', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('puni', 5);
    const hpBefore = ally.hp;
    const battle = new Battle([ally], [{ speciesId: 'golem', level: 15 }]);
    battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    battle.syncBack();
    expect(ally.hp).toBeLessThan(hpBefore);
  });

  it('全体攻撃とくぎが複数の敵に当たる', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('flamedrake', 30);
    const battle = new Battle(
      [ally],
      [
        { speciesId: 'puni', level: 1 },
        { speciesId: 'puni', level: 1 },
      ],
    );
    const actions = new Map<string, AllyAction>([[battle.allies[0]!.id, { kind: 'skill', skillId: 'flamebreath' }]]);
    battle.executeTurn({ kind: 'fight', actions });
    expect(battle.result).toBe('win');
  });

  it('同種の敵にはA/Bの接尾辞がつく', () => {
    const ally = createMonster('puni', 5);
    const battle = new Battle(
      [ally],
      [
        { speciesId: 'wolf', level: 3 },
        { speciesId: 'wolf', level: 3 },
      ],
    );
    expect(battle.enemies[0]!.name).toMatch(/A$/);
    expect(battle.enemies[1]!.name).toMatch(/B$/);
  });

  it('ダメージを受けてもHPは0未満にならない', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('puni', 1);
    const battle = new Battle([ally], [{ speciesId: 'tekina', level: 50 }]);
    for (let i = 0; i < 5 && !battle.result; i++) {
      battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    }
    for (const u of [...battle.allies, ...battle.enemies]) {
      expect(u.hp).toBeGreaterThanOrEqual(0);
      expect(u.hp).toBeLessThanOrEqual(u.stats.hp);
    }
  });
});
