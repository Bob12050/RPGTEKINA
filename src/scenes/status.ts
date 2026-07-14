// ============================================================
// ステータス詳細画面(1体のモンスターの能力・とくぎ・説明)
// ============================================================
import type { App } from '../core/app';
import type { Scene } from '../core/scene';
import type { MonsterInstance } from '../core/types';
import { STAT_NAMES } from '../core/types';
import { getSkill } from '../data/skills';
import { getSpecies } from '../data/monsters';
import { expToNext, maxStats } from '../game/monster';
import { monsterLabel, speciesInfo } from '../ui/format';
import { drawMonster } from '../ui/sprites';
import { drawGauge, drawText, drawWindow, FONT_SMALL, hpColor, isPortrait, view, wrapText } from '../ui/window';

export class StatusScene implements Scene {
  private time = 0;

  constructor(
    private app: App,
    private monster: MonsterInstance,
  ) {}

  onEnter(): void {
    this.app.input.flush();
  }

  update(dt: number): void {
    this.time += dt;
    const key = this.app.input.poll();
    if (key === 'cancel' || key === 'confirm') this.app.scenes.pop();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, view.w, view.h);
    const m = this.monster;
    const sp = getSpecies(m.speciesId);
    const ms = maxStats(m);
    const bounce = Math.sin(this.time * 3) * 4;

    if (isPortrait()) {
      // 縦持ち: 1カラムで上から順に
      const x = 12;
      const y = 16;
      const w = view.w - 24;
      const h = view.h - 32;
      drawWindow(ctx, x, y, w, h);

      drawText(ctx, monsterLabel(m), x + w / 2, y + 18, { align: 'center' });
      drawMonster(ctx, sp.family, sp.palette, x + w / 2 - 56, y + 52 + bounce, 7);
      drawText(ctx, speciesInfo(m.speciesId), x + w / 2, y + 172, { align: 'center', font: FONT_SMALL, color: '#aaaacc' });

      drawText(ctx, `HP ${m.hp}/${ms.hp}`, x + 28, y + 206, { font: FONT_SMALL });
      drawGauge(ctx, x + 170, y + 210, w - 200, 9, ms.hp === 0 ? 0 : m.hp / ms.hp, hpColor(m.hp / ms.hp));
      drawText(ctx, `MP ${m.mp}/${ms.mp}`, x + 28, y + 232, { font: FONT_SMALL });
      drawGauge(ctx, x + 170, y + 236, w - 200, 9, ms.mp === 0 ? 0 : m.mp / ms.mp, '#4a8ae8');
      drawText(ctx, `つぎのレベルまで あと ${expToNext(m.level) - m.exp}`, x + 28, y + 258, {
        font: FONT_SMALL,
        color: '#aaaacc',
      });

      drawText(ctx, 'ステータス', x + 28, y + 296, { color: '#ffd94a', font: FONT_SMALL });
      const rows: [string, number][] = [
        [STAT_NAMES.atk, ms.atk],
        [STAT_NAMES.def, ms.def],
        [STAT_NAMES.agi, ms.agi],
        [STAT_NAMES.wis, ms.wis],
      ];
      rows.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        drawText(ctx, label, x + 28 + col * 220, y + 326 + row * 30, { font: FONT_SMALL });
        drawText(ctx, String(value), x + 28 + col * 220 + 180, y + 326 + row * 30, { align: 'right', font: FONT_SMALL });
      });
      drawText(ctx, `プラスち +${m.plus}`, x + w - 28, y + 296, { align: 'right', font: FONT_SMALL, color: '#aaaacc' });

      drawText(ctx, 'とくぎ', x + 28, y + 400, { color: '#ffd94a', font: FONT_SMALL });
      if (m.skillIds.length === 0) {
        drawText(ctx, '(なし)', x + 28, y + 428, { font: FONT_SMALL, color: '#aaaacc' });
      }
      m.skillIds.forEach((id, i) => {
        const s = getSkill(id);
        const col = i % 2;
        const row = Math.floor(i / 2);
        drawText(ctx, s.name, x + 28 + col * 220, y + 428 + row * 28, { font: FONT_SMALL });
        drawText(ctx, s.mpCost > 0 ? `MP${s.mpCost}` : '', x + 28 + col * 220 + 180, y + 428 + row * 28, {
          align: 'right',
          font: FONT_SMALL,
          color: '#aaaacc',
        });
      });

      const descLines = wrapText(ctx, sp.desc, w - 56, FONT_SMALL);
      descLines.forEach((line, i) => {
        drawText(ctx, line, x + w / 2, y + h - 30 - (descLines.length - i) * 24, {
          align: 'center',
          font: FONT_SMALL,
          color: '#ccccee',
        });
      });
      return;
    }

    // 横持ち: 3カラム
    const x = 80;
    const y = 40;
    const w = view.w - 160;
    const h = view.h - 80;
    drawWindow(ctx, x, y, w, h);

    // 左: スプライトと基本情報
    drawMonster(ctx, sp.family, sp.palette, x + 60, y + 70 + bounce, 8);
    drawText(ctx, monsterLabel(m), x + 124, y + 24, { align: 'center' });
    drawText(ctx, speciesInfo(m.speciesId), x + 124, y + 220, { align: 'center', font: FONT_SMALL, color: '#aaaacc' });

    // HP/MP ゲージ
    drawText(ctx, `HP ${m.hp}/${ms.hp}`, x + 40, y + 260, { font: FONT_SMALL });
    drawGauge(ctx, x + 40, y + 284, 220, 10, ms.hp === 0 ? 0 : m.hp / ms.hp, hpColor(m.hp / ms.hp));
    drawText(ctx, `MP ${m.mp}/${ms.mp}`, x + 40, y + 304, { font: FONT_SMALL });
    drawGauge(ctx, x + 40, y + 328, 220, 10, ms.mp === 0 ? 0 : m.mp / ms.mp, '#4a8ae8');
    drawText(ctx, `つぎのレベルまで あと ${expToNext(m.level) - m.exp}`, x + 40, y + 352, {
      font: FONT_SMALL,
      color: '#aaaacc',
    });

    // 中央: ステータス
    const sx = x + 320;
    drawText(ctx, 'ステータス', sx, y + 30, { color: '#ffd94a' });
    const rows: [string, number][] = [
      [STAT_NAMES.atk, ms.atk],
      [STAT_NAMES.def, ms.def],
      [STAT_NAMES.agi, ms.agi],
      [STAT_NAMES.wis, ms.wis],
    ];
    rows.forEach(([label, value], i) => {
      drawText(ctx, label, sx, y + 70 + i * 36);
      drawText(ctx, String(value), sx + 200, y + 70 + i * 36, { align: 'right' });
    });
    drawText(ctx, `プラスち +${m.plus}`, sx, y + 70 + 4 * 36, { color: '#aaaacc', font: FONT_SMALL });

    // 右: とくぎ
    const kx = x + 320;
    drawText(ctx, 'とくぎ', kx, y + 260, { color: '#ffd94a' });
    if (m.skillIds.length === 0) {
      drawText(ctx, '(なし)', kx, y + 296, { font: FONT_SMALL, color: '#aaaacc' });
    }
    m.skillIds.forEach((id, i) => {
      const s = getSkill(id);
      drawText(ctx, s.name, kx, y + 296 + i * 28, { font: FONT_SMALL });
      drawText(ctx, s.mpCost > 0 ? `MP${s.mpCost}` : '-', kx + 200, y + 296 + i * 28, { align: 'right', font: FONT_SMALL });
    });

    // 説明
    drawText(ctx, sp.desc, x + w / 2, y + h - 44, { align: 'center', font: FONT_SMALL, color: '#ccccee' });
  }
}
