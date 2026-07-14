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
import { createMonster, gainExp } from '../game/monster';
import { addMonster, consumeItem, markScouted, markSeen } from '../game/state';
import { drawMonster } from '../ui/sprites';
import {
  drawGauge,
  drawText,
  drawWindow,
  FONT_SMALL,
  hpColor,
  Menu,
  MessageBox, view, isPortrait } from '../ui/window';

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
  | 'finished';

type TargetContext =
  | { mode: 'attack' }
  | { mode: 'skill'; skillId: string }
  | { mode: 'scout' }
  | { mode: 'item'; itemId: string };

/** メッセージウィンドウの位置(画面の向きで変わるため毎回計算) */
function msgRect(): { x: number; y: number; w: number; h: number } {
  const m = isPortrait() ? 8 : 16;
  const h = isPortrait() ? 112 : 124;
  return { x: m, y: view.h - h - m, w: view.w - m * 2, h };
}

export class BattleScene implements Scene {
  private battle: Battle;
  private onComplete: (result: BattleResult) => void;
  private phase: Phase = 'playback';
  private mainMenu = new Menu([{ label: 'たたかう' }, { label: 'スカウト' }, { label: 'どうぐ' }, { label: 'にげる' }]);
  private actionMenu = new Menu([{ label: 'こうげき' }, { label: 'とくぎ' }, { label: 'ぼうぎょ' }]);
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
    const key = this.app.input.poll();

    switch (this.phase) {
      case 'playback': {
        if (this.waitingMessage) {
          if (key === 'confirm' || key === 'cancel') {
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
        if (!key) return;
        const r = this.mainMenu.handleKey(key);
        if (r !== 'select') return;
        switch (this.mainMenu.cursor) {
          case 0: // たたかう
            this.pendingActions.clear();
            this.currentAllyIdx = 0;
            this.advanceToNextAlly(true);
            break;
          case 1: // スカウト
            this.targetCtx = { mode: 'scout' };
            this.targetIdx = 0;
            this.phase = 'targetEnemy';
            break;
          case 2: // どうぐ
            this.buildItemMenu();
            this.phase = 'itemPick';
            break;
          case 3: // にげる
            this.runTurn({ kind: 'flee' });
            break;
        }
        break;
      }
      case 'allyAction': {
        if (!key) return;
        const r = this.actionMenu.handleKey(key);
        if (r === 'cancel') {
          // ひとつ前の味方へ(いなければメインメニュー)
          if (this.currentAllyIdx > 0) {
            this.currentAllyIdx -= 1;
            const prev = this.commandableAllies()[this.currentAllyIdx];
            if (prev) this.pendingActions.delete(prev.id);
            this.actionMenu.cursor = 0;
          } else {
            this.phase = 'command';
          }
          return;
        }
        if (r !== 'select') return;
        switch (this.actionMenu.cursor) {
          case 0: // こうげき
            this.targetCtx = { mode: 'attack' };
            this.targetIdx = 0;
            this.phase = 'targetEnemy';
            break;
          case 1: {
            this.buildSkillMenu();
            this.phase = 'skillPick';
            break;
          }
          case 2: // ぼうぎょ
            this.setAllyAction({ kind: 'guard' });
            break;
        }
        break;
      }
      case 'skillPick': {
        if (!key) return;
        const r = this.skillMenu.handleKey(key);
        if (r === 'cancel') {
          this.phase = 'allyAction';
          return;
        }
        if (r !== 'select') return;
        const ally = this.currentAlly();
        if (!ally) return;
        const skillId = ally.skillIds[this.skillMenu.cursor];
        if (!skillId) return;
        const skill = getSkill(skillId);
        const eff = skill.effect;
        if (eff.kind === 'attack' && eff.target === 'single') {
          this.targetCtx = { mode: 'skill', skillId };
          this.targetIdx = 0;
          this.phase = 'targetEnemy';
        } else if (eff.kind === 'debuff' && eff.target === 'single') {
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
        break;
      }
      case 'itemPick': {
        if (!key) return;
        const r = this.itemMenu.handleKey(key);
        if (r === 'cancel') {
          this.phase = 'command';
          return;
        }
        if (r !== 'select') return;
        const state = requireState(this.app);
        const ids = Object.keys(state.items).filter((id) => (state.items[id] ?? 0) > 0);
        const itemId = ids[this.itemMenu.cursor];
        if (!itemId) return;
        const item = getItem(itemId);
        if (item.effect.kind === 'scoutBoost') {
          consumeItem(state, itemId);
          this.runTurn({ kind: 'item', itemId });
        } else {
          this.targetCtx = { mode: 'item', itemId };
          this.buildAllyMenu(item.effect.kind === 'revive');
          this.phase = 'targetAlly';
        }
        break;
      }
      case 'targetEnemy': {
        if (!key) return;
        const targets = this.battle.aliveEnemies();
        if (key === 'left' || key === 'up') this.targetIdx = (this.targetIdx - 1 + targets.length) % targets.length;
        else if (key === 'right' || key === 'down') this.targetIdx = (this.targetIdx + 1) % targets.length;
        else if (key === 'cancel') {
          this.phase = this.targetCtx.mode === 'scout' ? 'command' : this.targetCtx.mode === 'skill' ? 'skillPick' : 'allyAction';
        } else if (key === 'confirm') {
          const target = targets[Math.min(this.targetIdx, targets.length - 1)];
          if (!target) return;
          if (this.targetCtx.mode === 'scout') {
            this.runTurn({ kind: 'scout', targetId: target.id });
          } else if (this.targetCtx.mode === 'skill') {
            this.setAllyAction({ kind: 'skill', skillId: this.targetCtx.skillId, targetId: target.id });
          } else {
            this.setAllyAction({ kind: 'attack', targetId: target.id });
          }
        }
        break;
      }
      case 'targetAlly': {
        if (!key) return;
        const r = this.allyMenu.handleKey(key);
        if (r === 'cancel') {
          this.phase = this.targetCtx.mode === 'item' ? 'itemPick' : 'skillPick';
          return;
        }
        if (r !== 'select') return;
        const ally = this.battle.allies[this.allyMenu.cursor];
        if (!ally) return;
        if (this.targetCtx.mode === 'item') {
          const state = requireState(this.app);
          consumeItem(state, this.targetCtx.itemId);
          this.runTurn({ kind: 'item', itemId: this.targetCtx.itemId, targetAllyId: ally.id });
        } else if (this.targetCtx.mode === 'skill') {
          this.setAllyAction({ kind: 'skill', skillId: this.targetCtx.skillId, targetId: ally.id });
        }
        break;
      }
      case 'finished': {
        if (key === 'confirm' || key === 'cancel') this.exitBattle();
        break;
      }
    }
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
    this.actionMenu.cursor = 0;
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
        case 'scoutAttempt':
          this.messages.setPages([`(せいこうりつ ${ev.rate.toFixed(0)}% …!)`]);
          this.waitingMessage = true;
          return;
        case 'hpChange':
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
    this.mainMenu.cursor = 0;
  }

  /** 勝利・敗北・逃走後のメッセージを積む */
  private queuePostBattle(result: BattleResult): void {
    const state = requireState(this.app);
    const push = (text: string) => this.eventQueue.push({ type: 'message', text });
    this.battle.syncBack();

    // スカウトした仲間は 勝利/逃走なら合流する(全滅時は置きざりに…)
    if (result !== 'lose') {
      for (const e of this.battle.scoutedEnemies) {
        const sp = getSpecies(e.speciesId);
        const joined = createMonster(e.speciesId, e.level);
        markScouted(state, e.speciesId);
        const where = addMonster(state, joined);
        if (where === 'party') push(`${sp.name}が パーティに くわわった!`);
        else if (where === 'farm') push(`${sp.name}は ぼくじょうに おくられた!`);
        else push(`しかし ぼくじょうが いっぱいで ${sp.name}は かえっていった…。`);
      }
    }

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
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    if (this.battle.isBossWave()) {
      grad.addColorStop(0, '#1a0a14');
      grad.addColorStop(1, '#3d1424');
    } else {
      grad.addColorStop(0, '#101828');
      grad.addColorStop(1, '#24344d');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    // 地面
    const groundY = isPortrait() ? 390 : 330;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.ellipse(view.w / 2, groundY, Math.min(380, view.w * 0.44), 70, 0, 0, Math.PI * 2);
    ctx.fill();

    // WAVE表示(連戦のときだけ)
    if (this.battle.waveCount > 1) {
      const label = this.battle.isBossWave() ? 'BOSS' : `WAVE ${this.battle.waveIndex + 1}/${this.battle.waveCount}`;
      drawText(ctx, label, view.w - 14, 10, {
        align: 'right',
        font: FONT_SMALL,
        color: this.battle.isBossWave() ? '#f0823d' : 'rgba(255,255,255,0.75)',
      });
    }

    this.drawEnemies(ctx);
    this.drawAllyPanels(ctx);

    // コマンド類(縦持ちでは下側にまとめる)
    const p = isPortrait();
    if (this.phase === 'command') {
      this.mainMenu.draw(ctx, p ? 10 : 16, p ? 348 : 210, 210, 'コマンド');
      if (this.battle.scoutBoost > 1) {
        drawText(ctx, `ごちそう こうかちゅう! (×${this.battle.scoutBoost})`, p ? 10 : 16, p ? 320 : 180, {
          color: '#ffd94a',
          font: FONT_SMALL,
        });
      }
    }
    if (this.phase === 'allyAction') {
      const ally = this.currentAlly();
      this.actionMenu.draw(ctx, p ? 10 : 16, p ? 358 : 230, 240, ally ? `${ally.name} は?` : '');
    }
    if (this.phase === 'skillPick') this.skillMenu.draw(ctx, p ? 10 : 16, p ? 250 : 160, p ? view.w - 20 : 340, 'とくぎ');
    if (this.phase === 'itemPick') this.itemMenu.draw(ctx, p ? 10 : 16, p ? 250 : 160, p ? view.w - 20 : 340, 'どうぐ');
    if (this.phase === 'targetAlly') this.allyMenu.draw(ctx, p ? 10 : 16, p ? 300 : 200, p ? view.w - 20 : 380, 'だれに?');
    if (this.phase === 'targetEnemy') {
      drawWindow(ctx, p ? 10 : 16, p ? 378 : 230, 220, 56);
      drawText(ctx, 'どのてきに?', p ? 30 : 36, p ? 395 : 247);
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

  private drawAllyPanels(ctx: CanvasRenderingContext2D): void {
    const n = this.battle.allies.length;
    const msg = msgRect();
    const current = this.phase === 'allyAction' || this.phase === 'skillPick' ? this.currentAlly() : undefined;

    if (isPortrait()) {
      // 縦持ち: 2列グリッドで積む(4体でも収まる)
      const cols = n <= 2 ? 1 : 2;
      const rows = Math.ceil(n / cols);
      const gapX = 8;
      const w = cols === 1 ? view.w - 16 : Math.floor((view.w - 16 - gapX) / 2);
      const h = 62;
      const top = msg.y - rows * (h + 6);
      for (let i = 0; i < n; i++) {
        const unit = this.battle.allies[i]!;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 8 + col * (w + gapX);
        const y = top + row * (h + 6);
        drawWindow(ctx, x, y, w, h);
        const nameColor = unit.hp <= 0 ? '#f05a3d' : '#ffffff';
        drawText(ctx, unit.name, x + 12, y + 6, { color: nameColor, font: FONT_SMALL });
        drawText(ctx, `Lv${unit.level}`, x + w - 10, y + 6, { align: 'right', font: FONT_SMALL, color: '#aaaacc' });
        drawText(ctx, `HP ${unit.hp}/${unit.stats.hp}`, x + 12, y + 28, { font: FONT_SMALL });
        drawText(ctx, `MP ${unit.mp}/${unit.stats.mp}`, x + w - 10, y + 28, { align: 'right', font: FONT_SMALL, color: '#8fb8f0' });
        drawGauge(ctx, x + 12, y + 48, w - 24, 7, unit.hp / unit.stats.hp, hpColor(unit.hp / unit.stats.hp));
        if (current && current.id === unit.id) drawText(ctx, '▶', x, y + 4, { color: '#ffd94a' });
      }
      return;
    }

    // 横持ち: 人数ぶん横に並べる(4体まで)
    const gap = 12;
    const w = Math.floor((view.w - 24 - gap * (n - 1)) / Math.max(1, n));
    const h = 92;
    const y = msg.y - h - 6;
    for (let i = 0; i < n; i++) {
      const unit = this.battle.allies[i]!;
      const x = 12 + i * (w + gap);
      drawWindow(ctx, x, y, w, h);
      const nameColor = unit.hp <= 0 ? '#f05a3d' : '#ffffff';
      drawText(ctx, `${unit.name}`, x + 14, y + 10, { color: nameColor, font: FONT_SMALL });
      drawText(ctx, `Lv${unit.level}`, x + w - 14, y + 10, { align: 'right', font: FONT_SMALL, color: '#aaaacc' });
      drawText(ctx, `HP ${unit.hp}/${unit.stats.hp}`, x + 14, y + 34, { font: FONT_SMALL });
      drawGauge(ctx, x + 14, y + 56, w - 28, 8, unit.hp / unit.stats.hp, hpColor(unit.hp / unit.stats.hp));
      drawText(ctx, `MP ${unit.mp}/${unit.stats.mp}`, x + w - 14, y + 34, { align: 'right', font: FONT_SMALL, color: '#8fb8f0' });
      drawGauge(ctx, x + 14, y + 70, w - 28, 6, unit.stats.mp === 0 ? 0 : unit.mp / unit.stats.mp, '#4a8ae8');
      if (current && current.id === unit.id) drawText(ctx, '▶', x + 1, y + 8, { color: '#ffd94a' });
    }
  }
}
