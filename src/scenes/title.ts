// ============================================================
// タイトル画面(タップで えらぶ)
// ============================================================
import type { App } from '../core/app';
import type { Scene } from '../core/scene';
import { getSpecies } from '../data/monsters';
import { loadGame, hasSave } from '../game/save';
import { newGame } from '../game/state';
import { drawFancyBg } from '../ui/bg';
import { drawMonster } from '../ui/sprites';
import { Button, drawText, FONT_BIG, FONT_SMALL, view, isPortrait } from '../ui/window';
import { HomeScene } from './home';
import { HelpScene } from './help';

const LABELS = ['はじめから', 'つづきから', 'あそびかた'] as const;

export class TitleScene implements Scene {
  private cursor = 0;
  private buttons = LABELS.map(() => new Button());
  private time = 0;

  constructor(private app: App) {}

  private isDisabled(i: number): boolean {
    return i === 1 && !hasSave();
  }

  private activate(i: number): void {
    if (this.isDisabled(i)) return;
    switch (i) {
      case 0:
        this.app.state = newGame();
        this.app.scenes.replaceAll(new HomeScene(this.app));
        break;
      case 1: {
        const loaded = loadGame();
        if (loaded) {
          this.app.state = loaded;
          this.app.scenes.replaceAll(new HomeScene(this.app));
        }
        break;
      }
      case 2:
        this.app.scenes.push(new HelpScene(this.app));
        break;
    }
  }

  update(dt: number): void {
    this.time += dt;
    const tap = this.app.input.takeTap();
    if (tap) {
      for (let i = 0; i < this.buttons.length; i++) {
        if (this.buttons[i]!.contains(tap.x, tap.y)) {
          this.cursor = i;
          this.activate(i);
          return;
        }
      }
      return;
    }
    const key = this.app.input.poll();
    if (!key) return;
    if (key === 'up') this.cursor = (this.cursor + LABELS.length - 1) % LABELS.length;
    else if (key === 'down') this.cursor = (this.cursor + 1) % LABELS.length;
    else if (key === 'confirm') this.activate(this.cursor);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawFancyBg(ctx, 'title', this.time);

    // ロゴの後光
    const glow = ctx.createRadialGradient(view.w / 2, 130, 0, view.w / 2, 130, 220);
    glow.addColorStop(0, 'rgba(255,217,74,0.22)');
    glow.addColorStop(1, 'rgba(255,217,74,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(view.w / 2 - 240, 0, 480, 320);

    const logoBounce = Math.sin(this.time * 1.6) * 3;
    drawText(ctx, 'RPGTEKINA', view.w / 2, 104 + logoBounce, { font: FONT_BIG, align: 'center', color: '#ffd94a', shadow: true });
    drawText(ctx, '〜モンスターマスターへの みち〜', view.w / 2, 158, { align: 'center', shadow: true });

    // マスコットたち(ゆらゆら)
    const bounce = Math.sin(this.time * 3) * 6;
    const puni = getSpecies('puni');
    const dragon = getSpecies('chibidra');
    const imp = getSpecies('imp');
    const spread = isPortrait() ? 150 : 180;
    drawMonster(ctx, puni.family, puni.palette, view.w / 2 - spread - 40, 230 + bounce, 5);
    drawMonster(ctx, dragon.family, dragon.palette, view.w / 2 - 40, 236 - bounce, 5);
    drawMonster(ctx, imp.family, imp.palette, view.w / 2 + spread - 40, 230 + bounce, 5);

    // 大きなタップボタン
    const bw = Math.min(340, view.w - 80);
    const bh = 68;
    const gapY = 16;
    const startY = isPortrait() ? 420 : 380;
    const colors = ['#a8402e', '#2c6a4f', '#2c4a80'];
    LABELS.forEach((label, i) => {
      this.buttons[i]!.draw(ctx, view.w / 2 - bw / 2, startY + i * (bh + gapY), bw, bh, label, {
        color: colors[i],
        selected: i === this.cursor,
        disabled: this.isDisabled(i),
      });
    });

    drawText(ctx, 'タップで えらんでね (PC: ↑↓ + Z/Enter)', view.w / 2, view.h - 52, {
      align: 'center',
      font: FONT_SMALL,
      color: '#aaaacc',
    });
  }
}
