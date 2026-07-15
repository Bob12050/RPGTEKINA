// ============================================================
// ステージ進行シーン
//   1クエスト = 1回の戦闘(敵は固定編成)。
//   エリア最後のクエストはボス戦(強演出・逃走不可)。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { chance } from '../core/rng';
import { getItem } from '../data/items';
import { getSpecies } from '../data/monsters';
import { getStage, repeatGold } from '../data/stages';
import type { BattleResult, EnemySpec } from '../game/battle';
import { createMonster, maxStats } from '../game/monster';
import { addItem, addMonster, healParty, markScouted, markStageCleared } from '../game/state';
import { drawFancyBg } from '../ui/bg';
import { Button, drawGauge, drawText, drawWindow, FONT_BIG, FONT_SMALL, hpColor, isPortrait, MessageBox, view } from '../ui/window';
import { BattleScene } from './battle';

type Phase = 'intro' | 'clear' | 'failed';

export class StageScene implements Scene {
  private phase: Phase = 'intro';
  private messages = new MessageBox();
  private startButton = new Button();
  private backButton = new Button();
  private time = 0;

  constructor(
    private app: App,
    private stageId: string,
  ) {}

  onEnter(): void {
    this.app.input.flush();
  }

  /** ステージ開始: 固定編成との1回きりのバトルを起動する */
  private startStage(): void {
    const stage = getStage(this.stageId);
    const enemies: EnemySpec[] = stage.enemies.map((e) => ({ speciesId: e.speciesId, level: e.level }));
    this.app.scenes.push(
      new BattleScene(this.app, [enemies], {
        bossFinalWave: stage.boss ?? false,
        onComplete: (r) => this.onBattleDone(r),
      }),
    );
  }

  private onBattleDone(result: BattleResult): void {
    if (result === 'lose') {
      this.messages.setPages(['めのまえが まっくらに なった…。', 'パーティを たてなおそう。']);
      this.phase = 'failed';
      return;
    }
    if (result === 'retire') {
      this.app.scenes.pop(); // リタイア: そのままクエストセレクトへ
      return;
    }
    this.grantClear();
    this.phase = 'clear';
  }

  private grantClear(): void {
    const state = requireState(this.app);
    const stage = getStage(this.stageId);
    const firstClear = markStageCleared(state, this.stageId);
    const pages = [`${stage.name}を クリア!`];

    if (firstClear) {
      state.gold += stage.rewardGold;
      pages.push(`ほうしゅう ${stage.rewardGold}ゴールドを てにいれた!`);
      if (stage.rewardOrbs > 0) {
        state.orbs += stage.rewardOrbs;
        pages.push(`オーブを ${stage.rewardOrbs}こ てにいれた! (ガチャで つかえる)`);
      }
      for (const r of stage.rewardItems) {
        addItem(state, r.itemId, r.count);
        pages.push(`${getItem(r.itemId).name}を ${r.count}こ てにいれた!`);
      }
    } else {
      // 周回ボーナス(毎回もらえる)
      const bonus = repeatGold(stage);
      state.gold += bonus;
      pages.push(`しゅうかいボーナス ${bonus}ゴールド!`);
    }

    // 周回ドロップ(毎回抽選)
    for (const drop of stage.drops ?? []) {
      if (chance(drop.chance)) {
        addItem(state, drop.itemId, drop.count);
        pages.push(`ドロップ! ${getItem(drop.itemId).name} ×${drop.count}`);
      }
    }

    // モンスタードロップ(毎回それぞれ抽選・モンスト式)
    for (const md of stage.monsterDrops ?? []) {
      if (!chance(md.chance)) continue;
      const sp = getSpecies(md.speciesId);
      const joined = createMonster(md.speciesId, md.level);
      markScouted(state, md.speciesId);
      const where = addMonster(state, joined);
      if (where === 'full') {
        pages.push(`おや?! ${sp.name}が ついてきたが ボックスが いっぱいだった…。`);
      } else {
        pages.push(`おや?! ${sp.name}が なかまに なりたそうに ついてきた!`);
        pages.push(where === 'party' ? `${sp.name}が パーティに くわわった!` : `${sp.name}は ボックスへ!`);
      }
    }

    this.messages.setPages(pages);
  }

  update(dt: number): void {
    this.time += dt;
    this.messages.update(dt);
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();

    switch (this.phase) {
      case 'intro':
        if (tap) {
          if (this.startButton.contains(tap.x, tap.y)) this.startStage();
          else if (this.backButton.contains(tap.x, tap.y)) this.app.scenes.pop();
          return;
        }
        if (key === 'confirm') this.startStage();
        else if (key === 'cancel') this.app.scenes.pop();
        break;
      case 'clear':
        if (tap || key === 'confirm' || key === 'cancel') {
          if (this.messages.advance()) this.app.scenes.pop();
        }
        break;
      case 'failed':
        if (tap || key === 'confirm' || key === 'cancel') {
          if (this.messages.advance()) {
            healParty(requireState(this.app)); // 敗北後は無料で全回復してセレクトへ
            this.app.scenes.pop();
          }
        }
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawFancyBg(ctx, 'stage', this.time);

    const stage = getStage(this.stageId);
    const p = isPortrait();
    const cx = view.w / 2;

    if (this.phase === 'intro') {
      drawText(ctx, stage.name, cx, p ? 70 : 90, { align: 'center', color: '#ffd94a' });
      drawText(ctx, stage.boss ? 'ボスバトル!!' : 'モンスターとの たたかい', cx, p ? 110 : 140, {
        align: 'center',
        color: stage.boss ? '#f0823d' : '#ffffff',
      });
      drawText(ctx, `すいしょうレベル ${stage.recLevel}`, cx, p ? 150 : 180, {
        align: 'center',
        font: FONT_SMALL,
        color: '#aaaacc',
      });
      // 敵の顔ぶれ(未遭遇は？？？)
      const state = requireState(this.app);
      const names = stage.enemies
        .map((e) => (state.seenSpecies.includes(e.speciesId) ? getSpecies(e.speciesId).name : '？？？'))
        .join(' / ');
      drawText(ctx, `てき: ${names}`, cx, p ? 178 : 208, {
        align: 'center',
        font: FONT_SMALL,
        color: '#8fd44a',
      });

      this.drawPartyStatus(ctx, cx, p ? 230 : 280);

      // 大きな出撃ボタン + もどる
      const bw = Math.min(430, view.w - 24);
      const bx = cx - bw / 2;
      const by = view.h - 96;
      const backW = 120;
      this.backButton.draw(ctx, bx, by, backW, 72, 'もどる', { color: '#3a3a55', font: FONT_SMALL });
      this.startButton.draw(ctx, bx + backW + 10, by, bw - backW - 10, 72, stage.boss ? '👑 ボスに いどむ!' : 'しゅつげき!', {
        color: stage.boss ? '#a8402e' : '#2c6a4f',
        selected: true,
      });
      return;
    }

    if (this.phase === 'clear') {
      const beat = 1 + 0.03 * Math.sin(this.time * 5);
      ctx.save();
      ctx.translate(cx, p ? 130 : 170);
      ctx.scale(beat, beat);
      drawText(ctx, '★ CLEAR! ★', 0, -22, { align: 'center', color: '#ffd94a', font: FONT_BIG, shadow: true });
      ctx.restore();
    } else {
      drawText(ctx, 'ぜんめつ…', cx, p ? 120 : 160, { align: 'center', color: '#f05a3d', shadow: true });
    }
    const m = p ? 12 : 80;
    this.messages.draw(ctx, m, view.h - 200, view.w - m * 2, 150);
  }

  private drawPartyStatus(ctx: CanvasRenderingContext2D, cx: number, top: number): void {
    const state = requireState(this.app);
    const w = isPortrait() ? view.w - 40 : 440;
    const x = cx - w / 2;
    state.party.forEach((mon, i) => {
      const ms = maxStats(mon);
      const y = top + i * 44;
      drawWindow(ctx, x, y, w, 38);
      const dead = mon.hp <= 0;
      drawText(ctx, mon.nickname, x + 14, y + 8, { font: FONT_SMALL, color: dead ? '#f05a3d' : '#ffffff' });
      drawText(ctx, `Lv${mon.level}`, x + 150, y + 8, { font: FONT_SMALL, color: '#aaaacc' });
      drawText(ctx, `${mon.hp}/${ms.hp}`, x + w - 150, y + 8, { align: 'right', font: FONT_SMALL });
      drawGauge(ctx, x + w - 134, y + 12, 120, 8, ms.hp === 0 ? 0 : mon.hp / ms.hp, hpColor(mon.hp / ms.hp));
    });
  }
}
