// ============================================================
// バトルエンジン(純ロジック・UI非依存)
// コマンドを受け取り、1ターン分の BattleEvent 列を生成する。
// UI側(scenes/battle.ts)はイベントを順に再生するだけ。
// ============================================================
import { chance, randInt, random, variance } from '../core/rng';
import type { MonsterInstance, SkillDef, Stats } from '../core/types';
import { getItem } from '../data/items';
import { getSpecies } from '../data/monsters';
import { getSkill } from '../data/skills';
import { expFromEnemy, goldFromEnemy, maxStats, naturalSkillsAt } from './monster';

// ---- バトル内ユニット ----
export interface BattleUnit {
  id: string;
  side: 'ally' | 'enemy';
  name: string;
  speciesId: string;
  level: number;
  stats: Stats; // 最大値スナップショット
  hp: number;
  mp: number;
  skillIds: string[];
  buffs: { atk: number; def: number; agi: number }; // -3〜+3 段階
  guarding: boolean;
  /** 味方のみ: 元の個体(戦闘後にHP/MPを書き戻す) */
  ref?: MonsterInstance;
}

export type AllyAction =
  | { kind: 'attack'; targetId: string }
  | { kind: 'skill'; skillId: string; targetId?: string }
  | { kind: 'guard' };

export type PartyCommand =
  | { kind: 'fight'; actions: Map<string, AllyAction> }
  | { kind: 'item'; itemId: string; targetAllyId?: string }
  | { kind: 'flee' };

export type BattleEvent =
  | { type: 'message'; text: string }
  | { type: 'attackAnim'; unitId: string }
  | { type: 'hpChange'; unitId: string; delta: number; hpAfter: number }
  | { type: 'mpChange'; unitId: string; delta: number; mpAfter: number }
  | { type: 'ko'; unitId: string }
  | { type: 'newWave'; waveIndex: number }
  | { type: 'end'; result: BattleResult };

export type BattleResult = 'win' | 'lose' | 'flee';

export interface BattleRewards {
  exp: number;
  gold: number;
}

function stageMul(stage: number): number {
  return 1 + 0.25 * Math.max(-3, Math.min(3, stage));
}

function effAtk(u: BattleUnit): number {
  return u.stats.atk * stageMul(u.buffs.atk);
}

function effDef(u: BattleUnit): number {
  const guard = u.guarding ? 2 : 1;
  return u.stats.def * stageMul(u.buffs.def) * guard;
}

function effAgi(u: BattleUnit): number {
  return u.stats.agi * stageMul(u.buffs.agi);
}

let enemySeq = 0;

function makeEnemyUnit(speciesId: string, level: number, suffix: string): BattleUnit {
  const sp = getSpecies(speciesId);
  const inst: MonsterInstance = {
    uid: `enemy-${enemySeq++}`,
    speciesId,
    nickname: sp.name,
    level,
    exp: 0,
    plus: 0,
    bonus: { hp: 0, mp: 0, atk: 0, def: 0, agi: 0, wis: 0 },
    skillIds: naturalSkillsAt(speciesId, level),
    hp: 0,
    mp: 0,
  };
  const stats = maxStats(inst);
  return {
    id: inst.uid,
    side: 'enemy',
    name: sp.name + suffix,
    speciesId,
    level,
    stats,
    hp: stats.hp,
    mp: stats.mp,
    skillIds: inst.skillIds,
    buffs: { atk: 0, def: 0, agi: 0 },
    guarding: false,
  };
}

function makeAllyUnit(m: MonsterInstance): BattleUnit {
  const stats = maxStats(m);
  return {
    id: m.uid,
    side: 'ally',
    name: m.nickname,
    speciesId: m.speciesId,
    level: m.level,
    stats,
    hp: Math.min(m.hp, stats.hp),
    mp: Math.min(m.mp, stats.mp),
    skillIds: [...m.skillIds],
    buffs: { atk: 0, def: 0, agi: 0 },
    guarding: false,
    ref: m,
  };
}

export interface EnemySpec {
  speciesId: string;
  level: number;
}

/** WAVE間の小休止で回復する割合 */
const WAVE_REST_RATIO = 0.3;

export class Battle {
  allies: BattleUnit[];
  enemies: BattleUnit[];
  /** 全WAVE(最後のWAVEがボスかどうかは bossFinalWave) */
  waves: EnemySpec[][];
  waveIndex = 0;
  bossFinalWave: boolean;
  result: BattleResult | null = null;
  rewards: BattleRewards = { exp: 0, gold: 0 };
  /** 倒した種族(最終ボス撃破判定などに使う) */
  defeatedSpecies = new Set<string>();
  private fleeAttempts = 0;

  constructor(party: MonsterInstance[], waves: EnemySpec[][], bossFinalWave = false) {
    if (waves.length === 0 || waves.every((w) => w.length === 0)) throw new Error('敵のいないバトル');
    this.allies = party.map(makeAllyUnit);
    this.waves = waves;
    this.bossFinalWave = bossFinalWave;
    this.enemies = this.buildWaveUnits(0);
  }

  /** いま戦っているのがボスWAVEか */
  isBossWave(): boolean {
    return this.bossFinalWave && this.waveIndex === this.waves.length - 1;
  }

  get waveCount(): number {
    return this.waves.length;
  }

  private buildWaveUnits(index: number): BattleUnit[] {
    const specs = this.waves[index]!;
    // 同種が複数いるときだけ A/B/C を付ける
    const counts = new Map<string, number>();
    for (const e of specs) counts.set(e.speciesId, (counts.get(e.speciesId) ?? 0) + 1);
    const seen = new Map<string, number>();
    return specs.map((e) => {
      const n = seen.get(e.speciesId) ?? 0;
      seen.set(e.speciesId, n + 1);
      const suffix = (counts.get(e.speciesId) ?? 1) > 1 ? String.fromCharCode(65 + n) : '';
      return makeEnemyUnit(e.speciesId, e.level, suffix);
    });
  }

  aliveAllies(): BattleUnit[] {
    return this.allies.filter((u) => u.hp > 0);
  }

  aliveEnemies(): BattleUnit[] {
    return this.enemies.filter((u) => u.hp > 0);
  }

  findUnit(id: string): BattleUnit | undefined {
    return [...this.allies, ...this.enemies].find((u) => u.id === id);
  }

  /** 戦闘終了後、味方のHP/MPを元の個体へ書き戻す */
  syncBack(): void {
    for (const u of this.allies) {
      if (u.ref) {
        u.ref.hp = Math.max(0, u.hp);
        u.ref.mp = Math.max(0, u.mp);
      }
    }
  }

  /** 1ターン実行してイベント列を返す */
  executeTurn(command: PartyCommand): BattleEvent[] {
    const ev: BattleEvent[] = [];
    if (this.result) return ev;

    switch (command.kind) {
      case 'item':
        this.doItem(ev, command.itemId, command.targetAllyId);
        if (!this.result) this.enemiesAct(ev);
        break;
      case 'flee':
        this.doFlee(ev);
        if (!this.result) this.enemiesAct(ev);
        break;
      case 'fight':
        this.doFight(ev, command.actions);
        break;
    }

    this.checkEnd(ev);
    // ターン終了時: ぼうぎょ解除
    for (const u of [...this.allies, ...this.enemies]) u.guarding = false;
    return ev;
  }

  // ---- どうぐ ----
  private doItem(ev: BattleEvent[], itemId: string, targetAllyId?: string): void {
    const item = getItem(itemId);
    const target = targetAllyId ? this.findUnit(targetAllyId) : undefined;
    switch (item.effect.kind) {
      case 'heal': {
        if (!target) return;
        const amount = Math.floor(item.effect.power * variance(0.1));
        const healed = Math.min(target.stats.hp - target.hp, amount);
        target.hp += healed;
        ev.push({ type: 'message', text: `${item.name}を つかった!` });
        ev.push({ type: 'hpChange', unitId: target.id, delta: healed, hpAfter: target.hp });
        ev.push({ type: 'message', text: `${target.name}の HPが ${healed}かいふくした!` });
        break;
      }
      case 'mp': {
        if (!target) return;
        const amount = Math.floor(item.effect.power * variance(0.1));
        const healed = Math.min(target.stats.mp - target.mp, amount);
        target.mp += healed;
        ev.push({ type: 'message', text: `${item.name}を つかった!` });
        ev.push({ type: 'mpChange', unitId: target.id, delta: healed, mpAfter: target.mp });
        ev.push({ type: 'message', text: `${target.name}の MPが ${healed}かいふくした!` });
        break;
      }
      case 'revive': {
        if (!target || target.hp > 0) {
          ev.push({ type: 'message', text: 'しかし なにも おこらなかった…。' });
          return;
        }
        target.hp = Math.max(1, Math.floor(target.stats.hp * item.effect.ratio));
        ev.push({ type: 'message', text: `${item.name}を つかった!` });
        ev.push({ type: 'hpChange', unitId: target.id, delta: target.hp, hpAfter: target.hp });
        ev.push({ type: 'message', text: `${target.name}が いきかえった!` });
        break;
      }
    }
  }

  // ---- にげる ----
  private doFlee(ev: BattleEvent[]): void {
    ev.push({ type: 'message', text: 'みんなは にげだした!' });
    if (this.isBossWave()) {
      ev.push({ type: 'message', text: 'しかし まわりこまれてしまった!' });
      return;
    }
    const allyAgi = this.aliveAllies().reduce((s, u) => s + effAgi(u), 0) / Math.max(1, this.aliveAllies().length);
    const enemyAgi = this.aliveEnemies().reduce((s, u) => s + effAgi(u), 0) / Math.max(1, this.aliveEnemies().length);
    const p = Math.max(0.3, Math.min(0.95, 0.55 + (allyAgi - enemyAgi) / 150 + this.fleeAttempts * 0.15));
    this.fleeAttempts += 1;
    if (chance(p)) {
      this.result = 'flee';
      ev.push({ type: 'end', result: 'flee' });
    } else {
      ev.push({ type: 'message', text: 'しかし まわりこまれてしまった!' });
    }
  }

  // ---- たたかう(全員の行動を速さ順に解決) ----
  private doFight(ev: BattleEvent[], actions: Map<string, AllyAction>): void {
    interface Turn {
      unit: BattleUnit;
      action: AllyAction | 'enemyAI';
      initiative: number;
    }
    const turns: Turn[] = [];
    for (const u of this.aliveAllies()) {
      const a = actions.get(u.id) ?? { kind: 'attack', targetId: this.aliveEnemies()[0]?.id ?? '' };
      turns.push({ unit: u, action: a, initiative: effAgi(u) * variance(0.2) });
    }
    for (const u of this.aliveEnemies()) {
      turns.push({ unit: u, action: 'enemyAI', initiative: effAgi(u) * variance(0.2) });
    }
    turns.sort((a, b) => b.initiative - a.initiative);

    for (const t of turns) {
      if (this.result) break;
      if (t.unit.hp <= 0) continue; // 行動前に倒された
      if (t.action === 'enemyAI') {
        this.enemyAct(ev, t.unit);
      } else {
        this.allyAct(ev, t.unit, t.action);
      }
      // ターン途中は勝敗判定のみ(次WAVEの投入はターン終了時にまとめて行う)
      this.checkEnd(ev, false);
    }
  }

  /** 味方以外の行動なしでの敵行動(スカウト失敗時など) */
  private enemiesAct(ev: BattleEvent[]): void {
    for (const e of this.aliveEnemies()) {
      if (this.result) break;
      this.enemyAct(ev, e);
      this.checkEnd(ev, false);
    }
  }

  private allyAct(ev: BattleEvent[], unit: BattleUnit, action: AllyAction): void {
    switch (action.kind) {
      case 'guard':
        unit.guarding = true;
        ev.push({ type: 'message', text: `${unit.name}は みをまもっている。` });
        break;
      case 'attack': {
        let target = this.findUnit(action.targetId);
        if (!target || target.hp <= 0) target = this.aliveEnemies()[0];
        if (!target) return;
        this.normalAttack(ev, unit, target);
        break;
      }
      case 'skill': {
        this.useSkill(ev, unit, getSkill(action.skillId), action.targetId);
        break;
      }
    }
  }

  // ---- 敵AI ----
  private enemyAct(ev: BattleEvent[], unit: BattleUnit): void {
    const usable = unit.skillIds
      .map((id) => getSkill(id))
      .filter((s) => s.mpCost <= unit.mp)
      .filter((s) => {
        // 意味のない行動を除外
        if (s.effect.kind === 'heal') {
          return this.aliveEnemies().some((e) => e.hp < e.stats.hp * 0.6);
        }
        if (s.effect.kind === 'revive') {
          return this.enemies.some((e) => e.hp <= 0);
        }
        if (s.effect.kind === 'buff') {
          return this.aliveEnemies().some((e) => e.buffs[(s.effect as { stat: 'atk' | 'def' | 'agi' }).stat] < 2);
        }
        if (s.effect.kind === 'debuff') {
          return this.aliveAllies().some((a) => a.buffs[(s.effect as { stat: 'atk' | 'def' | 'agi' }).stat] > -2);
        }
        return true;
      });

    // 40%で通常攻撃、それ以外でとくぎからランダム
    const useSkillChance = usable.length > 0 ? 0.6 : 0;
    if (random() < useSkillChance) {
      const skill = usable[randInt(0, usable.length - 1)]!;
      this.useSkill(ev, unit, skill, undefined);
    } else {
      const targets = this.aliveAllies();
      const target = targets[randInt(0, targets.length - 1)];
      if (target) this.normalAttack(ev, unit, target);
    }
  }

  // ---- 通常こうげき ----
  private normalAttack(ev: BattleEvent[], attacker: BattleUnit, target: BattleUnit): void {
    ev.push({ type: 'message', text: `${attacker.name}の こうげき!` });
    ev.push({ type: 'attackAnim', unitId: attacker.id });
    const crit = chance(1 / 16);
    let dmg: number;
    if (crit) {
      ev.push({ type: 'message', text: 'かいしんの いちげき!!' });
      dmg = Math.max(1, Math.floor((effAtk(attacker) / 2) * 1.3 * variance(0.1)));
    } else {
      dmg = Math.max(1, Math.floor((effAtk(attacker) / 2 - effDef(target) / 4) * variance(0.125)));
    }
    this.dealDamage(ev, target, dmg);
  }

  // ---- とくぎ ----
  private useSkill(ev: BattleEvent[], user: BattleUnit, skill: SkillDef, targetId?: string): void {
    if (user.mp < skill.mpCost) {
      ev.push({ type: 'message', text: `${user.name}は ${skill.name}を つかおうとしたが MPが たりない!` });
      return;
    }
    user.mp -= skill.mpCost;
    ev.push({ type: 'message', text: `${user.name}は ${skill.name}を つかった!` });
    if (skill.mpCost > 0) ev.push({ type: 'mpChange', unitId: user.id, delta: -skill.mpCost, mpAfter: user.mp });

    const foes = user.side === 'ally' ? this.aliveEnemies() : this.aliveAllies();
    const friends = user.side === 'ally' ? this.aliveAllies() : this.aliveEnemies();
    const eff = skill.effect;

    switch (eff.kind) {
      case 'attack': {
        let targets: BattleUnit[];
        if (eff.target === 'all') {
          targets = [...foes];
        } else {
          const chosen = targetId ? this.findUnit(targetId) : undefined;
          const t = chosen && chosen.hp > 0 ? chosen : foes[randInt(0, foes.length - 1)];
          targets = t ? [t] : [];
        }
        ev.push({ type: 'attackAnim', unitId: user.id });
        for (const t of targets) {
          if (t.hp <= 0) continue;
          const resist = getSpecies(t.speciesId).resist[eff.element] ?? 1;
          if (resist === 0) {
            ev.push({ type: 'message', text: `しかし ${t.name}には きかなかった!` });
            continue;
          }
          let base: number;
          if (eff.scaling === 'wis') base = eff.power + user.stats.wis * 0.45;
          else if (eff.scaling === 'atk') base = eff.power + effAtk(user) * 0.5 - effDef(t) * 0.2;
          else base = eff.power * (1 + user.level / 60);
          const guardMul = t.guarding ? 0.5 : 1;
          const dmg = Math.max(1, Math.floor(base * variance(0.15) * resist * guardMul));
          if (resist > 1) ev.push({ type: 'message', text: `${t.name}の よわてんを ついた!` });
          this.dealDamage(ev, t, dmg);
        }
        break;
      }
      case 'heal': {
        let targets: BattleUnit[];
        if (eff.target === 'all') {
          targets = [...friends];
        } else {
          // 指定対象が倒れていたら(またはAIで未指定なら)最もHP割合の低い生存者へ
          const chosen = targetId ? this.findUnit(targetId) : undefined;
          const t =
            chosen && chosen.hp > 0
              ? chosen
              : [...friends].sort((a, b) => a.hp / a.stats.hp - b.hp / b.stats.hp)[0];
          targets = t ? [t] : [];
        }
        if (targets.every((t) => t.hp <= 0)) {
          ev.push({ type: 'message', text: 'しかし なにも おこらなかった…。' });
          break;
        }
        for (const t of targets) {
          if (t.hp <= 0) continue;
          const amount = Math.floor((eff.power + user.stats.wis * 0.3) * variance(0.1));
          const healed = Math.min(t.stats.hp - t.hp, amount);
          t.hp += healed;
          ev.push({ type: 'hpChange', unitId: t.id, delta: healed, hpAfter: t.hp });
          ev.push({ type: 'message', text: `${t.name}の HPが ${healed}かいふくした!` });
        }
        break;
      }
      case 'revive': {
        const pool = user.side === 'ally' ? this.allies : this.enemies;
        const target = (targetId && pool.find((u) => u.id === targetId)) || pool.find((u) => u.hp <= 0);
        if (!target || target.hp > 0) {
          ev.push({ type: 'message', text: 'しかし なにも おこらなかった…。' });
          break;
        }
        target.hp = Math.max(1, Math.floor(target.stats.hp * eff.ratio));
        ev.push({ type: 'hpChange', unitId: target.id, delta: target.hp, hpAfter: target.hp });
        ev.push({ type: 'message', text: `${target.name}が いきかえった!` });
        break;
      }
      case 'buff': {
        let targets: BattleUnit[];
        if (eff.target === 'all') {
          targets = [...friends];
        } else {
          // 指定対象が倒れていたら(またはAIで未指定なら)強化段階が最も低い生存者へ
          const chosen = targetId ? this.findUnit(targetId) : undefined;
          const t =
            chosen && chosen.hp > 0
              ? chosen
              : [...friends].sort((a, b) => a.buffs[eff.stat] - b.buffs[eff.stat])[0];
          targets = t ? [t] : [];
        }
        if (targets.every((t) => t.hp <= 0)) {
          ev.push({ type: 'message', text: 'しかし なにも おこらなかった…。' });
          break;
        }
        for (const t of targets) {
          if (t.hp <= 0) continue;
          t.buffs[eff.stat] = Math.min(3, t.buffs[eff.stat] + eff.stages);
          ev.push({ type: 'message', text: `${t.name}の ${statLabel(eff.stat)}が あがった!` });
        }
        break;
      }
      case 'debuff': {
        const targets =
          eff.target === 'all'
            ? [...foes]
            : (() => {
                const chosen = targetId ? this.findUnit(targetId) : undefined;
                const t = chosen && chosen.hp > 0 ? chosen : foes[randInt(0, foes.length - 1)];
                return t ? [t] : [];
              })();
        for (const t of targets) {
          if (t.hp <= 0) continue;
          t.buffs[eff.stat] = Math.max(-3, t.buffs[eff.stat] + eff.stages);
          ev.push({ type: 'message', text: `${t.name}の ${statLabel(eff.stat)}が さがった!` });
        }
        break;
      }
    }
  }

  private dealDamage(ev: BattleEvent[], target: BattleUnit, dmg: number): void {
    target.hp = Math.max(0, target.hp - dmg);
    ev.push({ type: 'hpChange', unitId: target.id, delta: -dmg, hpAfter: target.hp });
    ev.push({ type: 'message', text: `${target.name}に ${dmg}の ダメージ!` });
    if (target.hp <= 0) {
      ev.push({ type: 'ko', unitId: target.id });
      ev.push({
        type: 'message',
        text: target.side === 'enemy' ? `${target.name}を たおした!` : `${target.name}は ちからつきた…。`,
      });
      // 倒した敵の報酬はその場で加算する
      if (target.side === 'enemy') {
        this.rewards.exp += expFromEnemy(target.speciesId, target.level);
        this.rewards.gold += goldFromEnemy(target.speciesId, target.level);
        this.defeatedSpecies.add(target.speciesId);
      }
    }
  }

  /**
   * 勝敗を判定する。advanceWave=true(ターン終了時)のときだけ
   * 次のWAVEを投入する — ターン途中では敗北判定のみ行う。
   */
  private checkEnd(ev: BattleEvent[], advanceWave = true): void {
    if (this.result) return;
    if (this.aliveAllies().length === 0) {
      this.result = 'lose';
      ev.push({ type: 'message', text: 'みんなは ぜんめつしてしまった…。' });
      ev.push({ type: 'end', result: 'lose' });
      return;
    }
    if (this.aliveEnemies().length === 0) {
      if (this.waveIndex >= this.waves.length - 1) {
        this.result = 'win';
        ev.push({ type: 'message', text: 'まものたちを やっつけた!' });
        ev.push({ type: 'end', result: 'win' });
      } else if (advanceWave) {
        this.advanceWave(ev);
      }
    }
  }

  /** 次のWAVEを投入する(小休止つき・戦闘はシームレスに続く) */
  private advanceWave(ev: BattleEvent[]): void {
    this.waveIndex += 1;
    this.fleeAttempts = 0;
    // 小休止: 生存メンバーのHP/MPを回復
    let rested = false;
    for (const u of this.aliveAllies()) {
      const healHp = Math.min(u.stats.hp - u.hp, Math.floor(u.stats.hp * WAVE_REST_RATIO));
      const healMp = Math.min(u.stats.mp - u.mp, Math.floor(u.stats.mp * WAVE_REST_RATIO));
      if (healHp > 0) {
        u.hp += healHp;
        ev.push({ type: 'hpChange', unitId: u.id, delta: healHp, hpAfter: u.hp });
        rested = true;
      }
      if (healMp > 0) {
        u.mp += healMp;
        ev.push({ type: 'mpChange', unitId: u.id, delta: healMp, mpAfter: u.mp });
        rested = true;
      }
    }
    if (rested) ev.push({ type: 'message', text: 'なかまたちは ひといき ついた! (HP/MPが すこし かいふく)' });

    this.enemies = this.buildWaveUnits(this.waveIndex);
    ev.push({ type: 'newWave', waveIndex: this.waveIndex });
    const names = [...new Set(this.enemies.map((e) => getSpecies(e.speciesId).name))].join(' と ');
    ev.push({
      type: 'message',
      text: this.isBossWave() ? `${names}が たちはだかった!!` : `${names}が あらわれた!`,
    });
  }
}

function statLabel(stat: 'atk' | 'def' | 'agi'): string {
  return stat === 'atk' ? 'こうげき力' : stat === 'def' ? 'しゅび力' : 'すばやさ';
}
