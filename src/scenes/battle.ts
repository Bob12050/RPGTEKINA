// ============================================================
// バトルシーン(UI)
// バトルエンジン(game/battle.ts)が生成するイベント列を演出付きで再生する。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { getItem } from '../data/items';
import { getSkill } from '../data/skills';
import { getSpecies } from '../data/monsters';
import {
  Battle,
  type AllyAction,
  type BattleEvent,
  type BattleResult,
  type BattleUnit,
  type EnemySpec,
} from '../game/battle';
import { gainExp } from '../game/monster';
import { consumeItem, markSeen } from '../game/state';
import { drawFancyBg } from '../ui/bg';
import { drawMonster } from '../ui/sprites';
import {
  Button,
  drawGauge,
  drawText,
  drawWindow,
  FONT_SMALL,
  hpColor,
  inRect,
  Menu,
  MessageBox,
  view,
  isPortrait,
  type Rect,
} from '../ui/window';

/** 最終ボス。撃破で世界に平和が訪れる(専用演出) */
const FINAL_BOSS_ID = 'tekina';

export interface BattleOptions {
  /** 最後のWAVEがボス(演出強化・そのWAVE中は逃走不可) */
  bossFinalWave?: boolean;
  /** 戦闘終了時に結果を返す(ステージ進行の制御に使う) */
  onComplete: (result: BattleResult) => void;
}

type Phase =
  | 'playback'
  | 'command'
  | 'allyAction'
  | 'skillPick'
  | 'itemPick'
  | 'targetEnemy'
  | 'targetAlly'
  | 'retireConfirm'
  | 'finished';

type TargetContext =
  | { mode: 'attack' }
  | { mode: 'skill'; skillId: string }
  | { mode: 'item'; itemId: string };

/** 画面下部の操作エリア(メッセージ/コマンドボタン共用)の位置 */
function msgRect(): Rect {
  const m = isPortrait() ? 8 : 16;
  const h = isPortrait() ? 112 : 124;
  return { x: m, y: view.h - h - m, w: view.w - m * 2, h };
}

/** コマンドボタンの配色 */
const CMD_COLORS = ['#a8402e', '#2c6a4f', '#555568'] as const; // たたかう/どうぐ/リタイア
const ACT_COLORS = ['#a8402e', '#7a3ad6', '#2c4a80'] as const; // こうげき/とくぎ/ぼうぎょ

export class BattleScene implements Scene {
  private battle: Battle;
  private onComplete: (result: BattleResult) => void;
  private phase: Phase = 'playback';
  private cmdCursor = 0;
  private actCursor = 0;
  private retireCursor = 0; // 0=やめとく 1=リタイアする
  private cmdButtons = [new Button(), new Button(), new Button()]; // たたかう/どうぐ/リタイア
  private actButtons = [new Button(), new Button(), new Button()]; // こうげき/とくぎ/ぼうぎょ
  private retireButtons = [new Button(), new Button()]; // やめとく/リタイアする
  private backButton = new Button();
  private skillMenu = new Menu([]);
  private itemMenu = new Menu([]);
  private allyMenu = new Menu([]);
  private messages = new MessageBox();
  private eventQueue: BattleEvent[] = [];
  private waitingMessage = false;
  private pendingActions = new Map<string, AllyAction>();
  private currentAllyIdx = 0;
  private targetCtx: TargetContext = { mode: 'attack' };
  private targetIdx = 0;
  private result: BattleResult | null = null;
  private postDone = false;
  private shake: { unitId: string; t: number } | null = null;
  /** ダメージ/回復の数字ポップ */
  private floaters: { text: string; color: string; x: number; y: number; t: number }[] = [];
  private time = 0;

  constructor(
    private app: App,
    waves: EnemySpec[][],
    opts: BattleOptions,
  ) {
    this.onComplete = opts.onComplete;
    const state = requireState(app);
    this.battle = new Battle(state.party, waves, opts.bossFinalWave ?? false);
    state.battleCount += 1;
    // ずかんの「はっけん」登録(全WAVE分をここで確実に記録する)
    for (const wave of waves) for (const spec of wave) markSeen(state, spec.speciesId);
    const names = [...new Set(this.battle.enemies.map((e) => getSpecies(e.speciesId).name))];
    const intro: BattleEvent[] = this.battle.isBossWave()
      ? [{ type: 'message', text: `${names.join(' と ')}が たちはだかった!!` }]
      : [{ type: 'message', text: `${names.join(' と ')}が とびだしてきた!` }];
    this.eventQueue.push(...intro);
  }

  onEnter(): void {
    this.app.input.flush();
  }

  // ==================== 更新 ====================

  update(dt: number): void {
    this.time += dt;
    this.messages.update(dt);
    if (this.shake) {
      this.shake.t -= dt;
      if (this.shake.t <= 0) this.shake = null;
    }
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 0.9);
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();

    switch (this.phase) {
      case 'playback': {
        if (this.waitingMessage) {
          if (tap || key === 'confirm' || key === 'cancel') {
            if (!this.messages.currentPageComplete) {
              this.messages.advance(); // タイプ表示中なら即全文表示
              return;
            }
            this.waitingMessage = false;
          } else {
            return;
          }
        }
        this.pumpEvents();
        break;
      }
      case 'command': {
        if (tap) {
          for (let i = 0; i < this.cmdButtons.length; i++) {
            if (this.cmdButtons[i]!.contains(tap.x, tap.y)) {
              this.cmdCursor = i;
              this.runCommand(i);
              return;
            }
          }
          return;
        }
        if (!key) return;
        if (key === 'left' || key === 'up') this.cmdCursor = (this.cmdCursor + 2) % 3;
        else if (key === 'right' || key === 'down') this.cmdCursor = (this.cmdCursor + 1) % 3;
        else if (key === 'confirm') this.runCommand(this.cmdCursor);
        break;
      }
      case 'allyAction': {
        if (tap) {
          if (this.backButton.contains(tap.x, tap.y)) {
            this.backFromAllyAction();
            return;
          }
          for (let i = 0; i < this.actButtons.length; i++) {
            if (this.actButtons[i]!.contains(tap.x, tap.y)) {
              this.actCursor = i;
              this.runAction(i);
              return;
            }
          }
          return;
        }
        if (!key) return;
        if (key === 'left' || key === 'up') this.actCursor = (this.actCursor + 2) % 3;
        else if (key === 'right' || key === 'down') this.actCursor = (this.actCursor + 1) % 3;
        else if (key === 'confirm') this.runAction(this.actCursor);
        else if (key === 'cancel') this.backFromAllyAction();
        break;
      }
      case 'skillPick': {
        if (tap) {
          if (this.backButton.contains(tap.x, tap.y)) {
            this.phase = 'allyAction';
            return;
          }
          const idx = this.skillMenu.itemAt(tap.x, tap.y);
          if (idx !== null) {
            this.skillMenu.setCursor(idx);
            this.pickSkill(idx);
          }
          return;
        }
        if (!key) return;
        const r = this.skillMenu.handleKey(key);
        if (r === 'cancel') this.phase = 'allyAction';
        else if (r === 'select') this.pickSkill(this.skillMenu.cursor);
        break;
      }
      case 'itemPick': {
        if (tap) {
          if (this.backButton.contains(tap.x, tap.y)) {
            this.phase = 'command';
            return;
          }
          const idx = this.itemMenu.itemAt(tap.x, tap.y);
          if (idx !== null) {
            this.itemMenu.setCursor(idx);
            this.pickBattleItem(idx);
          }
          return;
        }
        if (!key) return;
        const r = this.itemMenu.handleKey(key);
        if (r === 'cancel') this.phase = 'command';
        else if (r === 'select') this.pickBattleItem(this.itemMenu.cursor);
        break;
      }
      case 'targetEnemy': {
        const targets = this.battle.aliveEnemies();
        if (tap) {
          if (this.backButton.contains(tap.x, tap.y)) {
            this.phase = this.targetCtx.mode === 'skill' ? 'skillPick' : 'allyAction';
            return;
          }
          // 敵を直接タップしてターゲット決定
          for (const { unit, rect } of this.enemyHitAreas()) {
            if (inRect(tap.x, tap.y, rect)) {
              this.chooseEnemyTarget(unit.id);
              return;
            }
          }
          return;
        }
        if (!key) return;
        if (key === 'left' || key === 'up') this.targetIdx = (this.targetIdx - 1 + targets.length) % targets.length;
        else if (key === 'right' || key === 'down') this.targetIdx = (this.targetIdx + 1) % targets.length;
        else if (key === 'cancel') {
          this.phase = this.targetCtx.mode === 'skill' ? 'skillPick' : 'allyAction';
        } else if (key === 'confirm') {
          const target = targets[Math.min(this.targetIdx, targets.length - 1)];
          if (target) this.chooseEnemyTarget(target.id);
        }
        break;
      }
      case 'targetAlly': {
        if (tap) {
          if (this.backButton.contains(tap.x, tap.y)) {
            this.phase = this.targetCtx.mode === 'item' ? 'itemPick' : 'skillPick';
            return;
          }
          const idx = this.allyMenu.itemAt(tap.x, tap.y);
          if (idx !== null) {
            this.allyMenu.setCursor(idx);
            this.chooseAllyTarget(idx);
          }
          return;
        }
        if (!key) return;
        const r = this.allyMenu.handleKey(key);
        if (r === 'cancel') this.phase = this.targetCtx.mode === 'item' ? 'itemPick' : 'skillPick';
        else if (r === 'select') this.chooseAllyTarget(this.allyMenu.cursor);
        break;
      }
      case 'retireConfirm': {
        if (tap) {
          if (this.retireButtons[0]!.contains(tap.x, tap.y)) this.phase = 'command';
          else if (this.retireButtons[1]!.contains(tap.x, tap.y)) this.doRetire();
          return;
        }
        if (!key) return;
        if (key === 'left' || key === 'right' || key === 'up' || key === 'down') this.retireCursor = 1 - this.retireCursor;
        else if (key === 'cancel') this.phase = 'command';
        else if (key === 'confirm') {
          if (this.retireCursor === 1) this.doRetire();
          else this.phase = 'command';
        }
        break;
      }
      case 'finished': {
        if (tap || key === 'confirm' || key === 'cancel') this.exitBattle();
        break;
      }
    }
  }

  /** リタイア実行: すぐにバトルを終了してクエストから撤退する */
  private doRetire(): void {
    this.eventQueue.push(...this.battle.retire());
    this.phase = 'playback';
  }

  // ---- コマンド実行(タップ/キー共通) ----

  private runCommand(i: number): void {
    switch (i) {
      case 0: // たたかう
        this.pendingActions.clear();
        this.currentAllyIdx = 0;
        this.advanceToNextAlly(true);
        break;
      case 1: // どうぐ
        this.buildItemMenu();
        this.phase = 'itemPick';
        break;
      case 2: // リタイア(確認をはさむ)
        this.retireCursor = 0;
        this.phase = 'retireConfirm';
        break;
    }
  }

  private runAction(i: number): void {
    switch (i) {
      case 0: // こうげき
        this.targetCtx = { mode: 'attack' };
        this.targetIdx = 0;
        this.phase = 'targetEnemy';
        break;
      case 1:
        this.buildSkillMenu();
        this.phase = 'skillPick';
        break;
      case 2: // ぼうぎょ
        this.setAllyAction({ kind: 'guard' });
        break;
    }
  }

  /** 行動選択から1つ前へもどる(前の味方 or コマンドへ) */
  private backFromAllyAction(): void {
    if (this.currentAllyIdx > 0) {
      this.currentAllyIdx -= 1;
      const prev = this.commandableAllies()[this.currentAllyIdx];
      if (prev) this.pendingActions.delete(prev.id);
      this.actCursor = 0;
    } else {
      this.phase = 'command';
    }
  }

  private pickSkill(index: number): void {
    const ally = this.currentAlly();
    if (!ally) return;
    const skillId = ally.skillIds[index];
    if (!skillId) return;
    const skill = getSkill(skillId);
    const eff = skill.effect;
    if ((eff.kind === 'attack' || eff.kind === 'debuff') && eff.target === 'single') {
      this.targetCtx = { mode: 'skill', skillId };
      this.targetIdx = 0;
      this.phase = 'targetEnemy';
    } else if ((eff.kind === 'heal' || eff.kind === 'buff') && eff.target === 'single') {
      this.targetCtx = { mode: 'skill', skillId };
      this.buildAllyMenu();
      this.phase = 'targetAlly';
    } else {
      this.setAllyAction({ kind: 'skill', skillId });
    }
  }

  private pickBattleItem(index: number): void {
    const state = requireState(this.app);
    const ids = Object.keys(state.items).filter((id) => (state.items[id] ?? 0) > 0);
    const itemId = ids[index];
    if (!itemId) return;
    const item = getItem(itemId);
    this.targetCtx = { mode: 'item', itemId };
    this.buildAllyMenu(item.effect.kind === 'revive');
    this.phase = 'targetAlly';
  }

  private chooseEnemyTarget(unitId: string): void {
    if (this.targetCtx.mode === 'skill') {
      this.setAllyAction({ kind: 'skill', skillId: this.targetCtx.skillId, targetId: unitId });
    } else {
      this.setAllyAction({ kind: 'attack', targetId: unitId });
    }
  }

  private chooseAllyTarget(index: number): void {
    const ally = this.battle.allies[index];
    if (!ally) return;
    if (this.allyMenu.items[index]?.disabled) return;
    if (this.targetCtx.mode === 'item') {
      const state = requireState(this.app);
      consumeItem(state, this.targetCtx.itemId);
      this.runTurn({ kind: 'item', itemId: this.targetCtx.itemId, targetAllyId: ally.id });
    } else if (this.targetCtx.mode === 'skill') {
      this.setAllyAction({ kind: 'skill', skillId: this.targetCtx.skillId, targetId: ally.id });
    }
  }

  /** 敵スプライトのタップ判定領域(名前・ゲージ込みでゆったりめ) */
  private enemyHitAreas(): { unit: BattleUnit; rect: Rect }[] {
    const scale = this.battle.isBossWave() ? 9 : 6;
    const size = 16 * scale;
    return this.enemyPositions().map(({ unit, x, y }) => ({
      unit,
      rect: { x: x - 10, y: y - 54, w: size + 20, h: size + 64 },
    }));
  }

  /** ダメージ/回復の数字ポップを出す */
  private spawnFloater(unitId: string, delta: number): void {
    if (delta === 0) return;
    const unit = this.battle.findUnit(unitId);
    if (!unit) return;
    let x = view.w / 2;
    let y = view.h / 2;
    if (unit.side === 'enemy') {
      const scale = this.battle.isBossWave() ? 9 : 6;
      const pos = this.enemyPositions().find((p) => p.unit.id === unitId);
      if (pos) {
        x = pos.x + (16 * scale) / 2;
        y = pos.y + 24;
      } else {
        y = (isPortrait() ? 390 : 330) - 90; // 倒れた直後などはだいたいの位置
      }
    } else {
      const idx = this.battle.allies.findIndex((a) => a.id === unitId);
      if (idx >= 0) {
        const r = this.allyPanelRect(idx);
        x = r.x + r.w / 2;
        y = r.y - 4;
      }
    }
    const heal = delta > 0;
    this.floaters.push({
      text: heal ? `+${delta}` : `${delta}`,
      color: heal ? '#7dff9c' : unit.side === 'enemy' ? '#ffd94a' : '#ff7a5a',
      x: x + (this.floaters.length % 3) * 10 - 10, // 連続ヒットで少しずらす
      y,
      t: 0,
    });
  }

  /** コマンド入力対象の味方(生存中) */
  private commandableAllies(): BattleUnit[] {
    return this.battle.aliveAllies();
  }

  private currentAlly(): BattleUnit | undefined {
    return this.commandableAllies()[this.currentAllyIdx];
  }

  private setAllyAction(action: AllyAction): void {
    const ally = this.currentAlly();
    if (!ally) return;
    this.pendingActions.set(ally.id, action);
    this.currentAllyIdx += 1;
    this.advanceToNextAlly(false);
  }

  private advanceToNextAlly(reset: boolean): void {
    if (reset) this.currentAllyIdx = 0;
    if (this.currentAllyIdx >= this.commandableAllies().length) {
      this.runTurn({ kind: 'fight', actions: this.pendingActions });
      return;
    }
    this.actCursor = 0;
    this.phase = 'allyAction';
  }

  private buildSkillMenu(): void {
    const ally = this.currentAlly();
    if (!ally) return;
    const items = ally.skillIds.map((id) => {
      const s = getSkill(id);
      return { label: s.name, note: s.mpCost > 0 ? `MP${s.mpCost}` : '', disabled: ally.mp < s.mpCost };
    });
    this.skillMenu.setItems(items.length > 0 ? items : [{ label: '(とくぎを おぼえていない)', disabled: true }]);
    this.skillMenu.reset();
  }

  private buildItemMenu(): void {
    const state = requireState(this.app);
    const ids = Object.keys(state.items).filter((id) => (state.items[id] ?? 0) > 0);
    const items = ids.map((id) => ({ label: getItem(id).name, note: `×${state.items[id]}` }));
    this.itemMenu.setItems(items.length > 0 ? items : [{ label: '(どうぐを もっていない)', disabled: true }]);
    this.itemMenu.reset();
  }

  private buildAllyMenu(deadOnly = false): void {
    const items = this.battle.allies.map((a) => ({
      label: `${a.name}  HP${a.hp}/${a.stats.hp}`,
      disabled: deadOnly ? a.hp > 0 : a.hp <= 0,
    }));
    this.allyMenu.setItems(items);
    this.allyMenu.reset();
  }

  private runTurn(command: Parameters<Battle['executeTurn']>[0]): void {
    const events = this.battle.executeTurn(command);
    this.eventQueue.push(...events);
    this.phase = 'playback';
  }

  /** イベントキューを処理。メッセージで停止し、それ以外は即適用 */
  private pumpEvents(): void {
    while (this.eventQueue.length > 0) {
      const ev = this.eventQueue.shift()!;
      switch (ev.type) {
        case 'message':
          this.messages.setPages([ev.text]);
          this.waitingMessage = true;
          return;
        case 'attackAnim':
          this.shake = { unitId: ev.unitId, t: 0.25 };
          break;
        case 'hpChange':
          this.spawnFloater(ev.unitId, ev.delta);
          break;
        case 'mpChange':
        case 'ko':
        case 'newWave':
          // battle 側の状態を描画が直接参照するので何もしなくてよい
          break;
        case 'end':
          this.result = ev.result;
          this.queuePostBattle(ev.result);
          break;
      }
    }
    // キューが空になった
    if (this.result) {
      if (this.postDone) this.phase = 'finished';
      return;
    }
    if (this.battle.result) return; // end イベント待ち
    this.messages.setPages([]); // コマンド選択中は前のメッセージを消す
    this.phase = 'command';
    this.cmdCursor = 0;
  }

  /** 勝利・敗北・逃走後のメッセージを積む */
  private queuePostBattle(result: BattleResult): void {
    const state = requireState(this.app);
    const push = (text: string) => this.eventQueue.push({ type: 'message', text });
    this.battle.syncBack();

    if (result === 'win') {
      const { exp, gold } = this.battle.rewards;
      if (exp > 0 || gold > 0) {
        push(`けいけんち ${exp} かくとく!`);
        if (gold > 0) {
          state.gold += gold;
          push(`${gold}ゴールドを てにいれた!`);
        }
        for (const unit of this.battle.allies) {
          if (unit.hp <= 0 || !unit.ref) continue;
          const res = gainExp(unit.ref, exp);
          if (res.levelsGained > 0) {
            push(`${unit.ref.nickname}は レベル${res.newLevel}に あがった!`);
            for (const sid of res.learnedSkills) push(`${unit.ref.nickname}は ${getSkill(sid).name}を おぼえた!`);
            for (const sid of res.missedSkills)
              push(`${unit.ref.nickname}は ${getSkill(sid).name}を おぼえたかったが とくぎが いっぱいだった…。`);
          }
        }
      }
      // 最終ボス(まりゅうテキーナ)撃破で世界に平和が訪れる
      if (this.battle.defeatedSpecies.has(FINAL_BOSS_ID) && !state.flags['clearedBoss']) {
        state.flags['clearedBoss'] = true;
        push('まりゅうテキーナを うちたおした!!');
        push('せかいに へいわが おとずれた… あなたは しんの モンスターマスターだ!');
        push('(クリアごも ぼうけんは つづく。しれんの ステージが かいほうされた!)');
      }
    } else if (result === 'lose') {
      push('パーティは ぜんめつしてしまった…');
    }
    this.postDone = true;
  }

  private exitBattle(): void {
    // syncBack は queuePostBattle で実行済み(再実行するとレベルアップ回復を巻き戻すため呼ばない)。
    // 勝敗の処理・シーン遷移はステージ側(onComplete)に委ねる。
    this.app.scenes.pop();
    this.onComplete(this.result!);
  }

  // ==================== 描画 ====================

  draw(ctx: CanvasRenderingContext2D): void {
    // 背景(ボスWAVEでは赤黒く染まる)
    drawFancyBg(ctx, this.battle.isBossWave() ? 'battleBoss' : 'battle', this.time);
    // 地面
    const groundY = isPortrait() ? 390 : 330;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.ellipse(view.w / 2, groundY, Math.min(380, view.w * 0.44), 70, 0, 0, Math.PI * 2);
    ctx.fill();

    // WAVE表示(連戦またはボス戦のとき)
    if (this.battle.waveCount > 1 || this.battle.isBossWave()) {
      const label = this.battle.isBossWave() ? 'BOSS' : `WAVE ${this.battle.waveIndex + 1}/${this.battle.waveCount}`;
      drawText(ctx, label, view.w - 14, 10, {
        align: 'right',
        font: FONT_SMALL,
        color: this.battle.isBossWave() ? '#f0823d' : 'rgba(255,255,255,0.75)',
      });
    }

    this.drawEnemies(ctx);
    this.drawAllyPanels(ctx);
    this.drawFloaters(ctx);

    // ---- 下部の操作エリア(大きなタップボタン) ----
    const p = isPortrait();
    const area = msgRect();
    const gap = 8;

    if (this.phase === 'command') {
      const bw = Math.floor((area.w - gap * 2) / 3);
      const labels = ['たたかう', 'どうぐ', 'リタイア'];
      labels.forEach((label, i) => {
        this.cmdButtons[i]!.draw(ctx, area.x + i * (bw + gap), area.y, bw, area.h, label, {
          color: CMD_COLORS[i],
          selected: i === this.cmdCursor,
        });
      });
    }

    if (this.phase === 'retireConfirm') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, view.w, view.h);
      const mw = Math.min(420, view.w - 24);
      const mx = (view.w - mw) / 2;
      const my = view.h / 2 - 130;
      drawWindow(ctx, mx, my, mw, 210);
      drawText(ctx, 'クエストを リタイアする?', mx + mw / 2, my + 26, { align: 'center', color: '#ffd94a' });
      drawText(ctx, 'ほうしゅうは もらえないよ', mx + mw / 2, my + 62, { align: 'center', font: FONT_SMALL, color: '#ccccee' });
      const bw = Math.floor((mw - 3 * 14) / 2);
      this.retireButtons[0]!.draw(ctx, mx + 14, my + 110, bw, 72, 'やめとく', {
        color: '#2c4a80',
        selected: this.retireCursor === 0,
      });
      this.retireButtons[1]!.draw(ctx, mx + 14 + bw + 14, my + 110, bw, 72, 'リタイアする', {
        color: '#a8402e',
        selected: this.retireCursor === 1,
      });
    }

    if (this.phase === 'allyAction') {
      const ally = this.currentAlly();
      if (ally) {
        drawText(ctx, `${ally.name}は どうする?`, view.w / 2, 12, { align: 'center', font: FONT_SMALL, color: '#ffd94a' });
      }
      const backW = 84;
      const bw = Math.floor((area.w - backW - gap * 3) / 3);
      this.backButton.draw(ctx, area.x, area.y, backW, area.h, '◀', { color: '#3a3a55' });
      const labels = ['こうげき', 'とくぎ', 'ぼうぎょ'];
      labels.forEach((label, i) => {
        this.actButtons[i]!.draw(ctx, area.x + backW + gap + i * (bw + gap), area.y, bw, area.h, label, {
          color: ACT_COLORS[i],
          selected: i === this.actCursor,
          font: FONT_SMALL,
        });
      });
    }

    if (this.phase === 'skillPick' || this.phase === 'itemPick') {
      const menu = this.phase === 'skillPick' ? this.skillMenu : this.itemMenu;
      menu.draw(ctx, p ? 10 : 16, p ? 230 : 130, p ? view.w - 20 : 380, this.phase === 'skillPick' ? 'とくぎを えらぶ' : 'どうぐを えらぶ');
      this.backButton.draw(ctx, area.x, area.y, 130, area.h, '◀ もどる', { color: '#3a3a55', font: FONT_SMALL });
    }

    if (this.phase === 'targetAlly') {
      this.allyMenu.draw(ctx, p ? 10 : 16, p ? 250 : 160, p ? view.w - 20 : 400, 'だれに?');
      this.backButton.draw(ctx, area.x, area.y, 130, area.h, '◀ もどる', { color: '#3a3a55', font: FONT_SMALL });
    }

    if (this.phase === 'targetEnemy') {
      this.backButton.draw(ctx, area.x, area.y, 130, area.h, '◀ もどる', { color: '#3a3a55', font: FONT_SMALL });
      drawText(ctx, 'てきを タップ!', area.x + 150, area.y + area.h / 2 - 12, { color: '#ffd94a' });
    }

    // メッセージ
    if (this.waitingMessage || !this.messages.done) {
      const r = msgRect();
      this.messages.draw(ctx, r.x, r.y, r.w, r.h);
    }
  }

  private enemyPositions(): { unit: BattleUnit; x: number; y: number }[] {
    const alive = this.battle.aliveEnemies();
    const scale = this.battle.isBossWave() ? 9 : 6;
    const size = 16 * scale;
    const gap = size + (isPortrait() ? 14 : 40);
    const groundY = isPortrait() ? 390 : 330;
    return alive.map((unit, i) => ({
      unit,
      x: view.w / 2 + (i - (alive.length - 1) / 2) * gap - size / 2,
      y: groundY - 30 - size,
    }));
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    const scale = this.battle.isBossWave() ? 9 : 6;
    const positions = this.enemyPositions();
    const targets = this.battle.aliveEnemies();
    for (const { unit, x, y } of positions) {
      const sp = getSpecies(unit.speciesId);
      let dx = 0;
      if (this.shake && this.shake.unitId === unit.id) dx = Math.sin(this.time * 60) * 5;
      const bounce = Math.sin(this.time * 2.2 + x) * 3;
      drawMonster(ctx, sp.family, sp.palette, x + dx, y + bounce, scale);
      // 名前とHPゲージ
      const cx = x + (16 * scale) / 2;
      drawText(ctx, `${unit.name} Lv${unit.level}`, cx, y - 44, { align: 'center', font: FONT_SMALL });
      drawGauge(ctx, cx - 50, y - 22, 100, 8, unit.hp / unit.stats.hp, hpColor(unit.hp / unit.stats.hp));
      // ターゲットカーソル
      if (this.phase === 'targetEnemy') {
        const idx = targets.findIndex((t) => t.id === unit.id);
        if (idx === Math.min(this.targetIdx, targets.length - 1)) {
          const arrowBounce = Math.sin(this.time * 6) * 4;
          drawText(ctx, '▼', cx, y - 70 + arrowBounce, { align: 'center', color: '#ffd94a' });
        }
      }
    }
  }

  /** 味方パネルの位置(描画とダメージポップのアンカーで共用) */
  private allyPanelRect(i: number): Rect {
    const n = this.battle.allies.length;
    const msg = msgRect();
    if (isPortrait()) {
      const cols = n <= 2 ? 1 : 2;
      const rows = Math.ceil(n / cols);
      const gapX = 8;
      const w = cols === 1 ? view.w - 16 : Math.floor((view.w - 16 - gapX) / 2);
      const h = 62;
      const top = msg.y - rows * (h + 6);
      return { x: 8 + (i % cols) * (w + gapX), y: top + Math.floor(i / cols) * (h + 6), w, h };
    }
    const gap = 12;
    const w = Math.floor((view.w - 24 - gap * (n - 1)) / Math.max(1, n));
    const h = 92;
    return { x: 12 + i * (w + gap), y: msg.y - h - 6, w, h };
  }

  private drawAllyPanels(ctx: CanvasRenderingContext2D): void {
    const n = this.battle.allies.length;
    const current = this.phase === 'allyAction' || this.phase === 'skillPick' ? this.currentAlly() : undefined;
    const p = isPortrait();

    for (let i = 0; i < n; i++) {
      const unit = this.battle.allies[i]!;
      const { x, y, w, h } = this.allyPanelRect(i);
      drawWindow(ctx, x, y, w, h);
      // 行動中の味方は金色にハイライト
      if (current && current.id === unit.id) {
        ctx.save();
        ctx.strokeStyle = '#ffd94a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 13);
        ctx.stroke();
        ctx.restore();
        drawText(ctx, '▶', x + 2, y + 4, { color: '#ffd94a' });
      }
      const nameColor = unit.hp <= 0 ? '#f05a3d' : '#ffffff';
      if (p) {
        drawText(ctx, unit.name, x + 12, y + 6, { color: nameColor, font: FONT_SMALL });
        drawText(ctx, `Lv${unit.level}`, x + w - 10, y + 6, { align: 'right', font: FONT_SMALL, color: '#aaaacc' });
        drawText(ctx, `HP ${unit.hp}/${unit.stats.hp}`, x + 12, y + 28, { font: FONT_SMALL });
        drawText(ctx, `MP ${unit.mp}/${unit.stats.mp}`, x + w - 10, y + 28, { align: 'right', font: FONT_SMALL, color: '#8fb8f0' });
        drawGauge(ctx, x + 12, y + 48, w - 24, 8, unit.hp / unit.stats.hp, hpColor(unit.hp / unit.stats.hp));
      } else {
        drawText(ctx, `${unit.name}`, x + 14, y + 10, { color: nameColor, font: FONT_SMALL });
        drawText(ctx, `Lv${unit.level}`, x + w - 14, y + 10, { align: 'right', font: FONT_SMALL, color: '#aaaacc' });
        drawText(ctx, `HP ${unit.hp}/${unit.stats.hp}`, x + 14, y + 34, { font: FONT_SMALL });
        drawGauge(ctx, x + 14, y + 56, w - 28, 9, unit.hp / unit.stats.hp, hpColor(unit.hp / unit.stats.hp));
        drawText(ctx, `MP ${unit.mp}/${unit.stats.mp}`, x + w - 14, y + 34, { align: 'right', font: FONT_SMALL, color: '#8fb8f0' });
        drawGauge(ctx, x + 14, y + 70, w - 28, 7, unit.stats.mp === 0 ? 0 : unit.mp / unit.stats.mp, '#4a8ae8');
      }
    }
  }

  /** ダメージ/回復ポップの描画(上にふわっと消える) */
  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    for (const f of this.floaters) {
      const alpha = Math.max(0, 1 - f.t / 0.9);
      const pop = f.t < 0.12 ? 1 + (0.12 - f.t) * 3 : 1; // 出た瞬間だけ少し大きく
      ctx.save();
      ctx.globalAlpha = alpha;
      drawText(ctx, f.text, f.x, f.y - f.t * 46, {
        align: 'center',
        color: f.color,
        font: `bold ${Math.round(26 * pop)}px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
        shadow: true,
      });
      ctx.restore();
    }
  }
}
