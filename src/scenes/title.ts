// ============================================================
// タイトル画面(タップで えらぶ)
// ============================================================
import type { App } from '../core/app';
import type { Scene } from '../core/scene';
import { getSpecies } from '../data/monsters';
import { loadGame, hasSave } from '../game/save';
import { newGame } from '../game/state';
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
    // 夜空風の背景
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(1, '#1a2a4a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);

    // 星
    for (let i = 0; i < 40; i++) {
      const x = (i * 137.5) % view.w;
      const y = (i * 89.3) % (view.h * 0.6);
      const tw = (Math.sin(this.time * 2 + i) + 1) / 2;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.5})`;
      ctx.fillRect(x, y, 2, 2);
    }

    drawText(ctx, 'RPGTEKINA', view.w / 2, 110, { font: FONT_BIG, align: 'center', color: '#ffd94a' });
    drawText(ctx, '〜モンスターマスターへの みち〜', view.w / 2, 160, { align: 'center' });

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
