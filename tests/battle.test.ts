import { afterEach, describe, expect, it } from 'vitest';
import { setRandomSource } from '../src/core/rng';
import type { MonsterInstance } from '../src/core/types';
import { Battle, type AllyAction, type EnemySpec } from '../src/game/battle';
import { createMonster } from '../src/game/monster';

afterEach(() => setRandomSource(Math.random));

/** 単一WAVEのバトルを作る補助 */
function singleWave(party: MonsterInstance[], enemies: EnemySpec[], boss = false): Battle {
  return new Battle(party, [enemies], boss);
}

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
    const battle = singleWave([ally], [{ speciesId: 'puni', level: 1 }]);
    const events = battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    expect(battle.result).toBe('win');
    expect(battle.rewards.exp).toBeGreaterThan(0);
    expect(battle.rewards.gold).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'end' && e.result === 'win')).toBe(true);
  });

  it('弱い味方は強い敵に敗北する', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('puni', 1);
    const battle = singleWave([ally], [{ speciesId: 'tekina', level: 50 }]);
    for (let i = 0; i < 10 && !battle.result; i++) {
      battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    }
    expect(battle.result).toBe('lose');
  });

  it('とくぎ使用でMPが減る', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('mahopuni', 20);
    const battle = singleWave([ally], [{ speciesId: 'golem', level: 20 }]);
    const unit = battle.allies[0]!;
    const before = unit.mp;
    const actions = new Map<string, AllyAction>([
      [unit.id, { kind: 'skill', skillId: 'fire', targetId: battle.enemies[0]!.id }],
    ]);
    battle.executeTurn({ kind: 'fight', actions });
    expect(unit.mp).toBe(before - 2);
  });

  it('スカウト成功で敵が離脱し、最後の敵なら勝利になる(報酬なし)', () => {
    setRandomSource(() => 0); // 必ず成功
    const ally = createMonster('tekina', 50);
    const battle = singleWave([ally], [{ speciesId: 'puni', level: 2 }]);
    const events = battle.executeTurn({ kind: 'scout', targetId: battle.enemies[0]!.id });
    // スカウトした敵しかいない → 全滅扱いで勝利、ただし経験値は入らない
    expect(battle.result).toBe('win');
    expect(battle.scoutedEnemies).toHaveLength(1);
    expect(battle.scoutedEnemies[0]!.speciesId).toBe('puni');
    expect(battle.rewards.exp).toBe(0);
    expect(events.some((e) => e.type === 'scoutAttempt')).toBe(true);
  });

  it('敵が複数ならスカウト成功後もバトルは続く', () => {
    setRandomSource(() => 0);
    const ally = createMonster('tekina', 50);
    const battle = singleWave(
      [ally],
      [
        { speciesId: 'puni', level: 2 },
        { speciesId: 'wolf', level: 3 },
      ],
    );
    battle.executeTurn({ kind: 'scout', targetId: battle.enemies[0]!.id });
    expect(battle.result).toBeNull(); // まだ wolf が残っている
    expect(battle.scoutedEnemies).toHaveLength(1);
    expect(battle.aliveEnemies()).toHaveLength(1);
  });

  it('スカウト失敗ではターンが続き敵が行動する', () => {
    let calls = 0;
    setRandomSource(() => {
      calls++;
      return 0.9999;
    });
    const ally = createMonster('puni', 5);
    const battle = singleWave([ally], [{ speciesId: 'golem', level: 15 }]);
    battle.executeTurn({ kind: 'scout', targetId: battle.enemies[0]!.id });
    expect(battle.result === null || battle.result === 'lose').toBe(true);
    expect(battle.scoutedEnemies).toHaveLength(0);
    expect(calls).toBeGreaterThan(0);
  });

  it('ボスWAVEはスカウトできない(スカウト不可種)', () => {
    setRandomSource(() => 0);
    const ally = createMonster('grandragon', 50);
    const battle = singleWave([ally], [{ speciesId: 'tekina', level: 32 }], true);
    const events = battle.executeTurn({ kind: 'scout', targetId: battle.enemies[0]!.id });
    expect(battle.scoutedEnemies).toHaveLength(0);
    expect(events.some((e) => e.type === 'scoutAttempt')).toBe(false);
  });

  it('ボスWAVEからは逃げられない', () => {
    setRandomSource(() => 0);
    const ally = createMonster('grandragon', 50);
    const battle = singleWave([ally], [{ speciesId: 'tekina', level: 32 }], true);
    battle.executeTurn({ kind: 'flee' });
    expect(battle.result).not.toBe('flee');
  });

  it('通常WAVEでは逃げられる(乱数が有利なら)', () => {
    setRandomSource(() => 0);
    const ally = createMonster('puni', 5);
    const battle = singleWave([ally], [{ speciesId: 'puni', level: 1 }]);
    battle.executeTurn({ kind: 'flee' });
    expect(battle.result).toBe('flee');
  });

  it('syncBack で戦闘結果が元の個体に反映される', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('puni', 5);
    const hpBefore = ally.hp;
    const battle = singleWave([ally], [{ speciesId: 'golem', level: 15 }]);
    battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    battle.syncBack();
    expect(ally.hp).toBeLessThan(hpBefore);
  });

  it('全体攻撃とくぎが複数の敵に当たる', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('flamedrake', 30);
    const battle = singleWave(
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
    const battle = singleWave(
      [ally],
      [
        { speciesId: 'wolf', level: 3 },
        { speciesId: 'wolf', level: 3 },
      ],
    );
    expect(battle.enemies[0]!.name).toMatch(/A$/);
    expect(battle.enemies[1]!.name).toMatch(/B$/);
  });

  it('単体回復は対象が倒れていたら生存者に飛ぶ(MPだけ消費して不発にならない)', () => {
    setRandomSource(() => 0.5);
    const healer = createMonster('mandra', 10, { skillIds: ['heal'] });
    const tank = createMonster('golem', 10);
    const battle = singleWave([healer, tank], [{ speciesId: 'puni', level: 1 }]);
    const healerUnit = battle.allies[0]!;
    const tankUnit = battle.allies[1]!;
    healerUnit.hp = 1;
    tankUnit.hp = 0;
    const actions = new Map<string, AllyAction>([
      [healerUnit.id, { kind: 'skill', skillId: 'heal', targetId: tankUnit.id }],
    ]);
    const events = battle.executeTurn({ kind: 'fight', actions });
    const healEvent = events.find((e) => e.type === 'hpChange' && e.delta > 0);
    expect(healEvent).toBeDefined();
    expect((healEvent as { unitId: string }).unitId).toBe(healerUnit.id);
  });

  it('単体回復はターゲット未指定(AI)なら最も負傷している味方へ', () => {
    setRandomSource(() => 0.5);
    const healer = createMonster('mandra', 10, { skillIds: ['heal'] });
    const tank = createMonster('golem', 10);
    const battle = singleWave([healer, tank], [{ speciesId: 'puni', level: 1 }]);
    const tankUnit = battle.allies[1]!;
    tankUnit.hp = 1;
    const actions = new Map<string, AllyAction>([[battle.allies[0]!.id, { kind: 'skill', skillId: 'heal' }]]);
    const events = battle.executeTurn({ kind: 'fight', actions });
    const healEvent = events.find((e) => e.type === 'hpChange' && e.delta > 0 && e.unitId === tankUnit.id);
    expect(healEvent).toBeDefined();
  });

  it('ダメージを受けてもHPは0未満にならない', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('puni', 1);
    const battle = singleWave([ally], [{ speciesId: 'tekina', level: 50 }]);
    for (let i = 0; i < 5 && !battle.result; i++) {
      battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    }
    for (const u of [...battle.allies, ...battle.enemies]) {
      expect(u.hp).toBeGreaterThanOrEqual(0);
      expect(u.hp).toBeLessThanOrEqual(u.stats.hp);
    }
  });
});

describe('連戦WAVE(シームレス増援)', () => {
  it('WAVEを全滅させると次のWAVEが流れ込み、味方は小休止で回復する', () => {
    setRandomSource(() => 0.5);
    const ally = createMonster('tekina', 50);
    const battle = new Battle(
      [ally],
      [
        [{ speciesId: 'puni', level: 1 }],
        [{ speciesId: 'wolf', level: 2 }],
      ],
    );
    const unit = battle.allies[0]!;
    unit.hp = Math.floor(unit.stats.hp * 0.5); // 半分に減らしておく
    const before = unit.hp;

    const events = battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    // WAVE1全滅 → 勝利ではなく次WAVEへ
    expect(battle.result).toBeNull();
    expect(battle.waveIndex).toBe(1);
    expect(battle.aliveEnemies()[0]!.speciesId).toBe('wolf');
    expect(events.some((e) => e.type === 'newWave')).toBe(true);
    // 小休止で30%回復している
    expect(unit.hp).toBeGreaterThan(before);

    // WAVE2も倒すと勝利。報酬は両WAVEぶん
    battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    expect(battle.result).toBe('win');
    expect(battle.defeatedSpecies.has('puni')).toBe(true);
    expect(battle.defeatedSpecies.has('wolf')).toBe(true);
  });

  it('最後のWAVEだけがボス扱いになる', () => {
    const ally = createMonster('tekina', 50);
    const battle = new Battle(
      [ally],
      [
        [{ speciesId: 'puni', level: 1 }],
        [{ speciesId: 'dekapuni', level: 5 }],
      ],
      true,
    );
    expect(battle.isBossWave()).toBe(false); // WAVE1は通常
    setRandomSource(() => 0.5);
    battle.executeTurn({ kind: 'fight', actions: fightAll(battle) });
    expect(battle.waveIndex).toBe(1);
    expect(battle.isBossWave()).toBe(true); // 最終WAVEはボス
  });

  it('WAVE中にスカウトした仲間は accumulate される', () => {
    setRandomSource(() => 0);
    const ally = createMonster('tekina', 50);
    const battle = new Battle(
      [ally],
      [
        [{ speciesId: 'puni', level: 2 }],
        [{ speciesId: 'wolf', level: 3 }],
      ],
    );
    // WAVE1のぷにをスカウト → 敵ゼロ → WAVE2が流れ込む
    battle.executeTurn({ kind: 'scout', targetId: battle.enemies[0]!.id });
    expect(battle.result).toBeNull();
    expect(battle.waveIndex).toBe(1);
    // WAVE2のウルフもスカウト → 全WAVE終了 → 勝利
    battle.executeTurn({ kind: 'scout', targetId: battle.enemies[0]!.id });
    expect(battle.result).toBe('win');
    expect(battle.scoutedEnemies.map((s) => s.speciesId)).toEqual(['puni', 'wolf']);
    expect(battle.rewards.exp).toBe(0); // 1体も倒していない
  });
});
