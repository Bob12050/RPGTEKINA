// ============================================================
// ステージ進行シーン
//   連戦(waves) → ボス を順に消化する。HPは道中もちこし。
//   バトルの結果を onComplete で受け取り、次の波・クリア・失敗へ分岐する。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { getItem } from '../data/items';
import { getStage, type StageEnemy } from '../data/stages';
import type { BattleResult, EnemySpec } from '../game/battle';
import { maxStats } from '../game/monster';
import { addItem, healParty, markStageCleared } from '../game/state';
import { drawGauge, drawText, drawWindow, FONT_SMALL, hpColor, isPortrait, MessageBox, view } from '../ui/window';
import { BattleScene } from './battle';

type Phase = 'intro' | 'interstitial' | 'clear' | 'failed';

export class StageScene implements Scene {
  private phase: Phase = 'intro';
  private waves: StageEnemy[][];
  private idx = 0; // 次にたたかう波
  private messages = new MessageBox();
  private time = 0;

  constructor(
    private app: App,
    private stageId: string,
  ) {
    const stage = getStage(stageId);
    this.waves = [...stage.waves, stage.boss];
  }

  onEnter(): void {
    this.app.input.flush();
    this.phase = 'intro';
  }

  private startWave(): void {
    const isBoss = this.idx === this.waves.length - 1;
    const enemies: EnemySpec[] = this.waves[this.idx]!.map((e) => ({ speciesId: e.speciesId, level: e.level }));
    this.app.scenes.push(
      new BattleScene(this.app, enemies, {
        isBoss,
        allowFlee: !isBoss,
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
      this.app.scenes.pop(); // ステージ中断してセレクトへ
      return;
    }
    // win / scouted
    this.idx += 1;
    if (this.idx >= this.waves.length) {
      this.grantClear();
      this.phase = 'clear';
    } else {
      this.phase = 'interstitial';
      this.app.input.flush();
    }
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
        if (key === 'confirm') this.startWave();
        else if (key === 'cancel') this.app.scenes.pop();
        break;
      case 'interstitial':
        if (key === 'confirm') this.startWave();
        else if (key === 'cancel') this.app.scenes.pop(); // 中断
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
    // intro/interstitial/clear/failed のときだけ描く(バトル中はバトルが上に重なる)
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, '#0a1020');
    grad.addColorStop(1, '#182438');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);

    const stage = getStage(this.stageId);
    const total = this.waves.length;
    const p = isPortrait();
    const cx = view.w / 2;

    if (this.phase === 'intro' || this.phase === 'interstitial') {
      const title = this.phase === 'intro' ? stage.name : `${stage.name}  とっぱ ちゅう!`;
      drawText(ctx, title, cx, p ? 70 : 90, { align: 'center', color: '#ffd94a' });
      const cur = Math.min(this.idx + 1, total);
      const isBossNext = this.idx === total - 1;
      drawText(ctx, isBossNext ? `つぎは ボス! (${cur}/${total})` : `WAVE ${cur} / ${total}`, cx, p ? 110 : 140, {
        align: 'center',
        color: isBossNext ? '#f0823d' : '#ffffff',
      });
      if (this.phase === 'intro') {
        drawText(ctx, `すいしょうレベル ${stage.recLevel}`, cx, p ? 150 : 180, { align: 'center', font: FONT_SMALL, color: '#aaaacc' });
      }

      // パーティのHP状況
      this.drawPartyStatus(ctx, cx, p ? 210 : 260);

      drawWindow(ctx, cx - (p ? 180 : 220), view.h - 90, p ? 360 : 440, 60);
      drawText(
        ctx,
        this.phase === 'intro' ? 'Z/A: はじめる    X/B: もどる' : 'Z/A: つぎへ    X/B: ちゅうだん',
        cx,
        view.h - 72,
        { align: 'center', font: FONT_SMALL },
      );
      return;
    }

    // clear / failed はメッセージ中心
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
