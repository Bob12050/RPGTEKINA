// ============================================================
// バトルシーン(UI)
// バトルエンジン(game/battle.ts)が生成するイベント列を演出付きで再生する。
// ============================================================
import {
  faArrowLeft,
  faBagShopping,
  faCaretDown,
  faFlag,
  faHandFist,
  faShieldHalved,
  faWandSparkles,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
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
import { drawIcon } from '../ui/icon';
import { createImageAsset, drawCoverImage, imageReady } from '../ui/media';
import { drawBattleSpeciesArt, supportsBattleSpeciesArt } from '../ui/monsterArt';
import { drawMonster } from '../ui/sprites';
import {
  Button,
  drawBattlePanel,
  drawText,
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
const ROYAL_PLAZA = createImageAsset(new URL('../assets/battle/royal-plaza.webp', import.meta.url).href);

const BATTLE_COLORS = {
  parchment: '#f2e1c7',
  parchmentDeep: '#e8d5b8',
  ink: '#4c3926',
  brass: '#ae8f67',
  accent: '#daa75d',
  deck: '#332a22',
  deckSoft: '#3b3229',
  selected: '#673a32',
  selectedBorder: '#c37b5c',
  cream: '#f0e3cf',
  hp: '#77b95d',
  mp: '#4d8fcf',
} as const;

export interface BattleOptions {
  /** 最後のWAVEがボス(演出強化・そのWAVE中は逃走不可) */
  bossFinalWave?: boolean;
  /** ヘッダーに表示するクエスト名 */
  stageName?: string;
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
  const m = isPortrait() ? 14 : 16;
  const h = isPortrait() ? 220 : 136;
  return { x: m, y: view.h - h - m, w: view.w - m * 2, h };
}

function fillRounded(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radius: number,
  fill: string,
  stroke?: string,
  lineWidth = 1,
): void {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawMatteGauge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: string,
  lightTrack = false,
): void {
  const value = Math.max(0, Math.min(1, ratio));
  fillRounded(ctx, { x, y, w, h }, h / 2, lightTrack ? 'rgba(76,57,38,0.22)' : 'rgba(24,20,17,0.68)');
  const fillW = Math.max(0, (w - 2) * value);
  if (fillW > 1) fillRounded(ctx, { x: x + 1, y: y + 1, w: fillW, h: h - 2 }, (h - 2) / 2, color);
}

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
  private skillMenu = new Menu([], 6, 52, 'battleWarm');
  private itemMenu = new Menu([], 6, 52, 'battleWarm');
  private allyMenu = new Menu([], 4, 52, 'battleWarm');
  private messages = new MessageBox('battleWarm');
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
  private stageName: string;

  constructor(
    private app: App,
    waves: EnemySpec[][],
    opts: BattleOptions,
  ) {
    this.onComplete = opts.onComplete;
    this.stageName = opts.stageName ?? 'モンスターとの たたかい';
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
    return this.enemyPositions().map(({ unit, x, y }) => {
      const visual = this.enemySpriteRect(unit, x, y);
      return {
        unit,
        rect: { x: visual.x - 10, y: visual.y - 54, w: visual.w + 20, h: visual.h + 64 },
      };
    });
  }

  /** ダメージ/回復の数字ポップを出す */
  private spawnFloater(unitId: string, delta: number): void {
    if (delta === 0) return;
    const unit = this.battle.findUnit(unitId);
    if (!unit) return;
    let x = view.w / 2;
    let y = view.h / 2;
    if (unit.side === 'enemy') {
      const pos = this.enemyPositions().find((p) => p.unit.id === unitId);
      if (pos) {
        const visual = this.enemySpriteRect(pos.unit, pos.x, pos.y);
        x = visual.x + visual.w / 2;
        y = visual.y + visual.h * 0.45;
      } else {
        y = (isPortrait() ? 515 : 335) - 100; // 倒れた直後などはだいたいの位置
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
      color: heal ? '#73b56d' : unit.side === 'enemy' ? '#9e4438' : '#c75f4f',
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
    this.drawBackdrop(ctx);
    this.drawBattleHeader(ctx);
    this.drawEnemies(ctx);
    this.drawAllyPanels(ctx);
    this.drawFloaters(ctx);

    const p = isPortrait();
    const area = msgRect();

    if (this.phase === 'command') {
      this.drawCommandDeck(ctx, area);
    }

    if (this.phase === 'retireConfirm') {
      this.drawRetireDialog(ctx);
    }

    if (this.phase === 'allyAction') {
      this.drawAllyActionDeck(ctx, area);
    }

    if (this.phase === 'skillPick' || this.phase === 'itemPick') {
      const menu = this.phase === 'skillPick' ? this.skillMenu : this.itemMenu;
      menu.draw(
        ctx,
        p ? 14 : 16,
        p ? 250 : 84,
        p ? view.w - 28 : 420,
        this.phase === 'skillPick' ? 'とくぎを えらぶ' : 'どうぐを えらぶ',
      );
      this.drawBackDeck(ctx, area, this.phase === 'skillPick' ? 'とくぎを選択中' : 'どうぐを選択中');
    }

    if (this.phase === 'targetAlly') {
      this.allyMenu.draw(ctx, p ? 14 : 16, p ? 310 : 116, p ? view.w - 28 : 420, 'だれに つかう?');
      this.drawBackDeck(ctx, area, 'なかまを選択中');
    }

    if (this.phase === 'targetEnemy') {
      this.drawBackDeck(ctx, area, '攻撃する敵を タップ');
    }

    // メッセージ
    if (this.waitingMessage || !this.messages.done) {
      const r = msgRect();
      this.messages.draw(ctx, r.x, r.y, r.w, r.h);
    }
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    const p = isPortrait();
    const bgHeight = p ? msgRect().y : view.h;
    if (imageReady(ROYAL_PLAZA)) {
      drawCoverImage(ctx, ROYAL_PLAZA, { x: 0, y: 0, w: view.w, h: bgHeight }, 0.5, p ? 0.5 : 0.58);
      if (this.battle.isBossWave()) {
        ctx.fillStyle = 'rgba(91,35,31,0.32)';
        ctx.fillRect(0, 0, view.w, bgHeight);
      }
    } else {
      drawFancyBg(ctx, this.battle.isBossWave() ? 'battleBoss' : 'battle', this.time);
    }
    if (p && bgHeight < view.h) {
      ctx.fillStyle = BATTLE_COLORS.deck;
      ctx.fillRect(0, bgHeight, view.w, view.h - bgHeight);
    }
  }

  private drawBattleHeader(ctx: CanvasRenderingContext2D): void {
    const p = isPortrait();
    const h = p ? 68 : 54;
    ctx.fillStyle = 'rgba(246,235,214,0.96)';
    ctx.fillRect(0, 0, view.w, h);
    ctx.fillStyle = BATTLE_COLORS.brass;
    ctx.fillRect(0, h - 2, view.w, 2);
    const iconSize = p ? 24 : 20;
    drawIcon(ctx, faShieldHalved, p ? 18 : 24, (h - iconSize) / 2, iconSize, BATTLE_COLORS.ink);
    drawText(ctx, this.stageName, p ? 54 : 56, p ? 21 : 16, {
      color: BATTLE_COLORS.ink,
      font: `bold ${p ? 20 : 18}px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
    });
    const wave = this.battle.isBossWave()
      ? 'BOSS WAVE'
      : `WAVE ${this.battle.waveIndex + 1}/${this.battle.waveCount}`;
    drawText(ctx, wave, view.w - (p ? 20 : 28), p ? 23 : 17, {
      align: 'right',
      color: this.battle.isBossWave() ? '#8d3f34' : BATTLE_COLORS.ink,
      font: `bold ${p ? 16 : 15}px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
    });
  }

  private drawBattleButton(
    ctx: CanvasRenderingContext2D,
    button: Button,
    rect: Rect,
    label: string,
    icon: IconDefinition,
    selected: boolean,
    primary = false,
  ): void {
    button.rect = rect;
    ctx.save();
    ctx.shadowColor = 'rgba(20,14,10,0.32)';
    ctx.shadowBlur = selected ? 10 : 5;
    ctx.shadowOffsetY = 3;
    fillRounded(
      ctx,
      rect,
      11,
      selected || primary ? BATTLE_COLORS.selected : BATTLE_COLORS.deckSoft,
      selected ? BATTLE_COLORS.selectedBorder : 'rgba(235,220,192,0.18)',
      selected ? 2 : 1,
    );
    ctx.shadowColor = 'transparent';
    const iconSize = rect.h >= 120 ? Math.min(42, rect.w * 0.28) : Math.min(28, rect.w * 0.22);
    const iconY = rect.h >= 120 ? rect.y + rect.h * 0.22 : rect.y + 18;
    drawIcon(ctx, icon, rect.x + (rect.w - iconSize) / 2, iconY, iconSize, selected ? '#f7e7ca' : '#d8c7aa');
    drawText(ctx, label, rect.x + rect.w / 2, rect.y + (rect.h >= 120 ? rect.h * 0.61 : rect.h - 38), {
      align: 'center',
      color: BATTLE_COLORS.cream,
      font: `bold ${rect.w < 90 ? 14 : primary ? 21 : 18}px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
    });
    if (selected) {
      const lineW = Math.min(rect.w - 32, Math.max(40, rect.w * 0.55));
      ctx.fillStyle = BATTLE_COLORS.accent;
      ctx.fillRect(rect.x + (rect.w - lineW) / 2, rect.y + rect.h - 12, lineW, 2);
    }
    ctx.restore();
  }

  private drawCommandDeck(ctx: CanvasRenderingContext2D, area: Rect): void {
    drawBattlePanel(ctx, area.x, area.y, area.w, area.h);
    const pad = 12;
    const gap = 9;
    const innerH = area.h - pad * 2;
    if (isPortrait()) {
      const primaryW = Math.round((area.w - pad * 2) * 0.42);
      const otherW = Math.floor((area.w - pad * 2 - primaryW - gap * 2) / 2);
      const rects: Rect[] = [
        { x: area.x + pad, y: area.y + pad, w: primaryW, h: innerH },
        { x: area.x + pad + primaryW + gap, y: area.y + pad, w: otherW, h: innerH },
        { x: area.x + pad + primaryW + gap * 2 + otherW, y: area.y + pad, w: otherW, h: innerH },
      ];
      const items: [string, IconDefinition][] = [
        ['たたかう', faHandFist],
        ['どうぐ', faBagShopping],
        ['リタイア', faFlag],
      ];
      items.forEach(([label, icon], i) =>
        this.drawBattleButton(ctx, this.cmdButtons[i]!, rects[i]!, label, icon, i === this.cmdCursor, i === 0),
      );
      return;
    }
    const bw = Math.floor((area.w - pad * 2 - gap * 2) / 3);
    const items: [string, IconDefinition][] = [
      ['たたかう', faHandFist],
      ['どうぐ', faBagShopping],
      ['リタイア', faFlag],
    ];
    items.forEach(([label, icon], i) => {
      const rect = { x: area.x + pad + i * (bw + gap), y: area.y + pad, w: bw, h: innerH };
      this.drawBattleButton(ctx, this.cmdButtons[i]!, rect, label, icon, i === this.cmdCursor, i === 0);
    });
  }

  private drawAllyActionDeck(ctx: CanvasRenderingContext2D, area: Rect): void {
    drawBattlePanel(ctx, area.x, area.y, area.w, area.h);
    const ally = this.currentAlly();
    if (ally) {
      drawText(ctx, `${ally.name}は どうする?`, area.x + 18, area.y + 14, {
        color: BATTLE_COLORS.cream,
        font: `bold 17px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
      });
    }
    const gap = 8;
    const y = area.y + 46;
    const h = area.h - 58;
    const backW = isPortrait() ? 76 : 92;
    const bw = Math.floor((area.w - 24 - backW - gap * 3) / 3);
    this.drawBattleButton(
      ctx,
      this.backButton,
      { x: area.x + 12, y, w: backW, h },
      '戻る',
      faArrowLeft,
      false,
    );
    const items: [string, IconDefinition][] = [
      ['こうげき', faHandFist],
      ['とくぎ', faWandSparkles],
      ['ぼうぎょ', faShieldHalved],
    ];
    items.forEach(([label, icon], i) => {
      const rect = { x: area.x + 12 + backW + gap + i * (bw + gap), y, w: bw, h };
      this.drawBattleButton(ctx, this.actButtons[i]!, rect, label, icon, i === this.actCursor, i === 0);
    });
  }

  private drawBackDeck(ctx: CanvasRenderingContext2D, area: Rect, note: string): void {
    drawBattlePanel(ctx, area.x, area.y, area.w, area.h);
    const pad = 12;
    const backW = isPortrait() ? 132 : 160;
    this.drawBattleButton(
      ctx,
      this.backButton,
      { x: area.x + pad, y: area.y + pad, w: backW, h: area.h - pad * 2 },
      '戻る',
      faArrowLeft,
      false,
    );
    drawText(ctx, note, area.x + backW + 34, area.y + area.h / 2 - 12, {
      color: BATTLE_COLORS.cream,
      font: `bold ${isPortrait() ? 17 : 18}px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
    });
  }

  private drawRetireDialog(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(38,27,20,0.58)';
    ctx.fillRect(0, 0, view.w, view.h);
    const mw = Math.min(430, view.w - 28);
    const mx = (view.w - mw) / 2;
    const my = view.h / 2 - 128;
    const mh = 236;
    drawBattlePanel(ctx, mx, my, mw, mh);
    drawText(ctx, 'クエストを リタイアする?', mx + mw / 2, my + 30, {
      align: 'center',
      color: BATTLE_COLORS.cream,
      font: `bold 20px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
    });
    drawText(ctx, '報酬は受け取れません', mx + mw / 2, my + 68, {
      align: 'center',
      font: FONT_SMALL,
      color: '#cbbda8',
    });
    const gap = 12;
    const bw = Math.floor((mw - 40 - gap) / 2);
    const by = my + 112;
    this.drawBattleButton(
      ctx,
      this.retireButtons[0]!,
      { x: mx + 20, y: by, w: bw, h: 98 },
      'やめとく',
      faArrowLeft,
      this.retireCursor === 0,
    );
    this.drawBattleButton(
      ctx,
      this.retireButtons[1]!,
      { x: mx + 20 + bw + gap, y: by, w: bw, h: 98 },
      'リタイア',
      faFlag,
      this.retireCursor === 1,
      true,
    );
  }

  private enemyVisualSize(): number {
    const count = Math.max(1, this.battle.aliveEnemies().length);
    if (isPortrait()) {
      if (this.battle.isBossWave()) return count === 1 ? 190 : 150;
      if (count <= 2) return 150;
      if (count === 3) return 128;
      return 104;
    }
    if (this.battle.isBossWave()) return 168;
    if (count <= 2) return 132;
    if (count === 3) return 118;
    return 100;
  }

  private enemyPositions(): { unit: BattleUnit; x: number; y: number }[] {
    const alive = this.battle.aliveEnemies();
    const size = this.enemyVisualSize();
    const portraitGap = alive.length <= 1
      ? 0
      : Math.min(size + 34, (view.w - 48 - size) / (alive.length - 1));
    const gap = isPortrait() ? portraitGap : size + 40;
    const groundY = isPortrait() ? 515 : 335;
    return alive.map((unit, i) => ({
      unit,
      x: view.w / 2 + (i - (alive.length - 1) / 2) * gap - size / 2,
      y: groundY - size,
    }));
  }

  /** 高精細絵がない種族は、従来ピクセル絵の大きさとラベル間隔を保つ。 */
  private enemySpriteRect(unit: BattleUnit, slotX: number, slotY: number): Rect {
    const slotSize = this.enemyVisualSize();
    const species = getSpecies(unit.speciesId);
    const pixelScale = this.battle.isBossWave() ? 9 : 6;
    const hasHighResArt = supportsBattleSpeciesArt(species.id);
    const size = hasHighResArt ? slotSize : 16 * pixelScale;
    const legacyGroundOffset = isPortrait() ? 45 : 35;
    const groundY = slotY + slotSize - (hasHighResArt ? 0 : legacyGroundOffset);
    return {
      x: slotX + (slotSize - size) / 2,
      y: groundY - size,
      w: size,
      h: size,
    };
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    const positions = this.enemyPositions();
    const targets = this.battle.aliveEnemies();
    for (const { unit, x, y } of positions) {
      const sp = getSpecies(unit.speciesId);
      const visual = this.enemySpriteRect(unit, x, y);
      let dx = 0;
      if (this.shake && this.shake.unitId === unit.id) dx = Math.sin(this.time * 60) * 5;
      const bounce = Math.sin(this.time * 2.2 + x) * 3;
      ctx.save();
      ctx.fillStyle = 'rgba(65,47,31,0.2)';
      ctx.beginPath();
      ctx.ellipse(
        visual.x + visual.w / 2,
        visual.y + visual.h - 3,
        visual.w * 0.31,
        visual.h * 0.075,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
      const artRect = { x: visual.x + dx, y: visual.y + bounce, w: visual.w, h: visual.h };
      if (!drawBattleSpeciesArt(ctx, sp, artRect, 1, false, 'bottom')) {
        const pixelScale = Math.max(1, Math.floor(visual.w / 16));
        drawMonster(ctx, sp.family, sp.palette, visual.x + dx, visual.y + bounce, pixelScale);
      }
      // 名前とHPゲージ
      const cx = visual.x + visual.w / 2;
      const label = `${unit.name} Lv${unit.level}`;
      ctx.save();
      const labelSize = isPortrait() ? 15 : 16;
      ctx.font = `bold ${labelSize}px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`;
      const labelW = Math.max(106, ctx.measureText(label).width + 24);
      fillRounded(
        ctx,
        { x: cx - labelW / 2, y: visual.y - 50, w: labelW, h: 28 },
        10,
        'rgba(55,42,29,0.78)',
        'rgba(241,224,193,0.42)',
      );
      ctx.restore();
      drawText(ctx, label, cx, visual.y - 45, {
        align: 'center',
        color: '#f8f1e4',
        font: `bold ${labelSize}px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
      });
      drawMatteGauge(ctx, cx - 52, visual.y - 15, 104, 9, unit.hp / unit.stats.hp, BATTLE_COLORS.hp);
      // ターゲットカーソル
      if (this.phase === 'targetEnemy') {
        const idx = targets.findIndex((t) => t.id === unit.id);
        if (idx === Math.min(this.targetIdx, targets.length - 1)) {
          const arrowBounce = Math.sin(this.time * 6) * 4;
          drawIcon(ctx, faCaretDown, cx - 10, visual.y - 78 + arrowBounce, 20, BATTLE_COLORS.accent);
        }
      }
    }
  }

  /** 味方パネルの位置(描画とダメージポップのアンカーで共用) */
  private allyPanelRect(i: number): Rect {
    const n = this.battle.allies.length;
    const msg = msgRect();
    if (isPortrait()) {
      const cols = n <= 1 ? 1 : 2;
      const rows = Math.ceil(n / cols);
      const gapX = 8;
      const side = 14;
      const w = cols === 1 ? view.w - side * 2 : Math.floor((view.w - side * 2 - gapX) / 2);
      const h = n <= 2 ? 116 : 78;
      const gapY = 8;
      const top = msg.y - rows * h - (rows - 1) * gapY - 10;
      return { x: side + (i % cols) * (w + gapX), y: top + Math.floor(i / cols) * (h + gapY), w, h };
    }
    const gap = 12;
    const w = Math.floor((view.w - 24 - gap * (n - 1)) / Math.max(1, n));
    const h = 96;
    return { x: 12 + i * (w + gap), y: msg.y - h - 10, w, h };
  }

  private drawAllyPanels(ctx: CanvasRenderingContext2D): void {
    const n = this.battle.allies.length;
    const current = this.phase === 'allyAction' || this.phase === 'skillPick' ? this.currentAlly() : undefined;
    const p = isPortrait();

    for (let i = 0; i < n; i++) {
      const unit = this.battle.allies[i]!;
      const { x, y, w, h } = this.allyPanelRect(i);
      drawBattlePanel(ctx, x, y, w, h, true);
      if (current && current.id === unit.id) {
        ctx.save();
        ctx.strokeStyle = BATTLE_COLORS.selectedBorder;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 10);
        ctx.stroke();
        ctx.fillStyle = BATTLE_COLORS.accent;
        ctx.fillRect(x + 18, y + 6, Math.min(78, w * 0.34), 3);
        ctx.restore();
      }
      const species = getSpecies(unit.speciesId);
      const nameColor = unit.hp <= 0 ? '#9e4438' : BATTLE_COLORS.ink;
      if (p && h >= 100) {
        const artRect = { x: x + 7, y: y + 9, w: 68, h: h - 18 };
        if (!drawBattleSpeciesArt(ctx, species, artRect, unit.hp <= 0 ? 0.38 : 1)) {
          drawMonster(ctx, species.family, species.palette, x + 14, y + 35, 3);
        }
        const infoX = x + 78;
        const gaugeW = Math.max(60, w - (infoX - x) - 14);
        drawText(ctx, unit.name, infoX, y + 14, {
          color: nameColor,
          font: `bold 16px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
        });
        drawText(ctx, `Lv${unit.level}`, x + w - 12, y + 15, {
          align: 'right',
          font: '14px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif',
          color: '#78654e',
        });
        drawText(ctx, `HP ${unit.hp}/${unit.stats.hp}`, infoX, y + 43, { font: FONT_SMALL, color: BATTLE_COLORS.ink });
        drawMatteGauge(ctx, infoX, y + 64, gaugeW, 8, unit.hp / unit.stats.hp, hpColor(unit.hp / unit.stats.hp), true);
        drawText(ctx, `MP ${unit.mp}/${unit.stats.mp}`, infoX, y + 75, { font: FONT_SMALL, color: '#456f96' });
        drawMatteGauge(
          ctx,
          infoX,
          y + 96,
          gaugeW,
          7,
          unit.stats.mp === 0 ? 0 : unit.mp / unit.stats.mp,
          BATTLE_COLORS.mp,
          true,
        );
      } else if (p) {
        const artRect = { x: x + 5, y: y + 7, w: 43, h: h - 14 };
        if (!drawBattleSpeciesArt(ctx, species, artRect, unit.hp <= 0 ? 0.38 : 1)) {
          drawMonster(ctx, species.family, species.palette, x + 10, y + 27, 2);
        }
        const infoX = x + 50;
        drawText(ctx, unit.name, infoX, y + 8, {
          color: nameColor,
          font: `bold 14px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif`,
        });
        drawText(ctx, `Lv${unit.level}`, x + w - 10, y + 8, { align: 'right', font: '12px sans-serif', color: '#78654e' });
        const half = Math.max(44, (w - infoX + x - 16) / 2);
        drawText(ctx, `HP ${unit.hp}/${unit.stats.hp}`, infoX, y + 32, { font: '12px sans-serif', color: BATTLE_COLORS.ink });
        drawText(ctx, `MP ${unit.mp}/${unit.stats.mp}`, infoX + half, y + 32, { font: '12px sans-serif', color: '#456f96' });
        drawMatteGauge(ctx, infoX, y + 53, half - 8, 7, unit.hp / unit.stats.hp, hpColor(unit.hp / unit.stats.hp), true);
        drawMatteGauge(
          ctx,
          infoX + half,
          y + 53,
          half - 8,
          7,
          unit.stats.mp === 0 ? 0 : unit.mp / unit.stats.mp,
          BATTLE_COLORS.mp,
          true,
        );
      } else {
        const artRect = { x: x + 7, y: y + 8, w: 62, h: h - 16 };
        if (!drawBattleSpeciesArt(ctx, species, artRect, unit.hp <= 0 ? 0.38 : 1)) {
          drawMonster(ctx, species.family, species.palette, x + 12, y + 26, 3);
        }
        const infoX = x + 72;
        drawText(ctx, unit.name, infoX, y + 12, { color: nameColor, font: `bold 16px sans-serif` });
        drawText(ctx, `Lv${unit.level}`, x + w - 14, y + 12, { align: 'right', font: '13px sans-serif', color: '#78654e' });
        drawText(ctx, `HP ${unit.hp}/${unit.stats.hp}`, infoX, y + 39, { font: '14px sans-serif', color: BATTLE_COLORS.ink });
        drawMatteGauge(ctx, infoX, y + 61, Math.max(72, w - (infoX - x) - 14), 8, unit.hp / unit.stats.hp, hpColor(unit.hp / unit.stats.hp), true);
        drawText(ctx, `MP ${unit.mp}/${unit.stats.mp}`, x + w - 14, y + 39, { align: 'right', font: '14px sans-serif', color: '#456f96' });
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
