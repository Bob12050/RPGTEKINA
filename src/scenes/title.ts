// ============================================================
// タイトル画面
// ============================================================
import type { App } from '../core/app';
import type { Scene } from '../core/scene';
import { getSpecies } from '../data/monsters';
import { loadGame, hasSave } from '../game/save';
import { newGame } from '../game/state';
import { drawMonster } from '../ui/sprites';
import { drawText, drawWindow, FONT_BIG, FONT_SMALL, Menu, view, isPortrait } from '../ui/window';
import { FieldScene } from './field';
import { HelpScene } from './help';

export class TitleScene implements Scene {
  private menu: Menu;
  private time = 0;

  constructor(private app: App) {
    this.menu = new Menu([
      { label: 'はじめから' },
      { label: 'つづきから', disabled: !hasSave() },
      { label: 'あそびかた' },
    ]);
  }

  update(dt: number): void {
    this.time += dt;
    const key = this.app.input.poll();
    if (!key) return;
    const result = this.menu.handleKey(key);
    if (result !== 'select') return;
    switch (this.menu.cursor) {
      case 0: {
        this.app.state = newGame();
        this.app.scenes.replaceAll(
          new FieldScene(this.app, [
            'ぷに の「ぷにきち」が なかまに くわわった!',
            'むらおさエルダに はなしを きいてみよう。(Zキー/Enterで はなす)',
          ]),
        );
        break;
      }
      case 1: {
        const loaded = loadGame();
        if (loaded) {
          this.app.state = loaded;
          this.app.scenes.replaceAll(new FieldScene(this.app));
        }
        break;
      }
      case 2:
        this.app.scenes.push(new HelpScene(this.app));
        break;
    }
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

    this.menu.draw(ctx, view.w / 2 - 150, isPortrait() ? 430 : 400, 300);
    const fw = Math.min(600, view.w - 16);
    drawWindow(ctx, view.w / 2 - fw / 2, view.h - 80, fw, 56);
    drawText(ctx, '↑↓: えらぶ   Z / A: けってい   X / B: もどる', view.w / 2, view.h - 63, {
      align: 'center',
      font: FONT_SMALL,
    });
  }
}
