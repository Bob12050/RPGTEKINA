// ============================================================
// ステージ進行シーン
//   ステージ全体を「1つのシームレスなバトル」として実行する。
//   敵を全滅させると次のWAVEがそのまま流れ込み(小休止つき)、
//   最後のWAVEがボス。幕間画面はもうない。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { getItem } from '../data/items';
import { getStage } from '../data/stages';
import type { BattleResult, EnemySpec } from '../game/battle';
import { maxStats } from '../game/monster';
import { addItem, healParty, markStageCleared } from '../game/state';
import { drawGauge, drawText, drawWindow, FONT_SMALL, hpColor, isPortrait, MessageBox, view } from '../ui/window';
import { BattleScene } from './battle';

type Phase = 'intro' | 'clear' | 'failed';

export class StageScene implements Scene {
  private phase: Phase = 'intro';
  private messages = new MessageBox();
  private time = 0;

  constructor(
    private app: App,
    private stageId: string,
  ) {}

  onEnter(): void {
    this.app.input.flush();
  }

  /** ステージ開始: 全WAVE+ボスをひとつのバトルとして起動する */
  private startStage(): void {
    const stage = getStage(this.stageId);
    const waves: EnemySpec[][] = [...stage.waves, stage.boss].map((wave) =>
      wave.map((e) => ({ speciesId: e.speciesId, level: e.level })),
    );
    this.app.scenes.push(
      new BattleScene(this.app, waves, {
        bossFinalWave: true,
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
    if (result === 'flee') {
      this.app.scenes.pop(); // ステージから撤退してセレクトへ
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
      for (const r of stage.rewardItems) {
        addItem(state, r.itemId, r.count);
        pages.push(`${getItem(r.itemId).name}を ${r.count}こ てにいれた!`);
      }
    } else {
      pages.push('(クリアずみ ステージ)');
    }
    this.messages.setPages(pages);
  }

  update(dt: number): void {
    this.time += dt;
    this.messages.update(dt);
    const key = this.app.input.poll();

    switch (this.phase) {
      case 'intro':
        if (key === 'confirm') this.startStage();
        else if (key === 'cancel') this.app.scenes.pop();
        break;
      case 'clear':
        if (key === 'confirm' || key === 'cancel') {
          if (this.messages.advance()) this.app.scenes.pop();
        }
        break;
      case 'failed':
        if (key === 'confirm' || key === 'cancel') {
          if (this.messages.advance()) {
            healParty(requireState(this.app)); // 敗北後は無料で全回復してセレクトへ
            this.app.scenes.pop();
          }
        }
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, '#0a1020');
    grad.addColorStop(1, '#182438');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);

    const stage = getStage(this.stageId);
    const p = isPortrait();
    const cx = view.w / 2;

    if (this.phase === 'intro') {
      drawText(ctx, stage.name, cx, p ? 70 : 90, { align: 'center', color: '#ffd94a' });
      drawText(ctx, `WAVE ${stage.waves.length} + ボス (れんせん)`, cx, p ? 110 : 140, { align: 'center' });
      drawText(ctx, `すいしょうレベル ${stage.recLevel}`, cx, p ? 150 : 180, {
        align: 'center',
        font: FONT_SMALL,
        color: '#aaaacc',
      });
      drawText(ctx, 'WAVEの あいまに HP/MPが すこし かいふくする', cx, p ? 178 : 208, {
        align: 'center',
        font: FONT_SMALL,
        color: '#8fd44a',
      });

      this.drawPartyStatus(ctx, cx, p ? 230 : 280);

      drawWindow(ctx, cx - (p ? 180 : 220), view.h - 90, p ? 360 : 440, 60);
      drawText(ctx, 'Z/A: はじめる    X/B: もどる', cx, view.h - 72, { align: 'center', font: FONT_SMALL });
      return;
    }

    if (this.phase === 'clear') {
      drawText(ctx, '★ STAGE CLEAR ★', cx, p ? 120 : 160, { align: 'center', color: '#ffd94a' });
    } else {
      drawText(ctx, 'ぜんめつ…', cx, p ? 120 : 160, { align: 'center', color: '#f05a3d' });
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
