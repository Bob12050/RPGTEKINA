// ============================================================
// タイトル画面
// ============================================================
import type { App } from '../core/app';
import type { Scene } from '../core/scene';
import { getSpecies } from '../data/monsters';
import { loadGame, hasSave } from '../game/save';
import { newGame } from '../game/state';
import { drawMonster } from '../ui/sprites';
import { drawText, drawWindow, FONT_BIG, FONT_SMALL, Menu, SCREEN_H, SCREEN_W } from '../ui/window';
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
    const grad = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(1, '#1a2a4a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // 星
    for (let i = 0; i < 40; i++) {
      const x = (i * 137.5) % SCREEN_W;
      const y = (i * 89.3) % (SCREEN_H * 0.6);
      const tw = (Math.sin(this.time * 2 + i) + 1) / 2;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.5})`;
      ctx.fillRect(x, y, 2, 2);
    }

    drawText(ctx, 'RPGTEKINA', SCREEN_W / 2, 110, { font: FONT_BIG, align: 'center', color: '#ffd94a' });
    drawText(ctx, '〜モンスターマスターへの みち〜', SCREEN_W / 2, 160, { align: 'center' });

    // マスコットたち(ゆらゆら)
    const bounce = Math.sin(this.time * 3) * 6;
    const puni = getSpecies('puni');
    const dragon = getSpecies('chibidra');
    const imp = getSpecies('imp');
    drawMonster(ctx, puni.family, puni.palette, SCREEN_W / 2 - 220, 230 + bounce, 5);
    drawMonster(ctx, dragon.family, dragon.palette, SCREEN_W / 2 - 40, 236 - bounce, 5);
    drawMonster(ctx, imp.family, imp.palette, SCREEN_W / 2 + 140, 230 + bounce, 5);

    this.menu.draw(ctx, SCREEN_W / 2 - 150, 400, 300);
    drawWindow(ctx, SCREEN_W / 2 - 300, 545, 600, 56);
    drawText(ctx, '↑↓: えらぶ   Z / A: けってい   X / B: もどる', SCREEN_W / 2, 562, {
      align: 'center',
      font: FONT_SMALL,
    });
  }
}
