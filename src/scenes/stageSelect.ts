// ============================================================
// ステージセレクト
//   クリア状況に応じて 解放/ロック を表示し、選ぶとステージに挑戦する。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { isStageUnlocked, STAGES } from '../data/stages';
import { drawText, drawWindow, FONT_SMALL, isPortrait, Menu, view } from '../ui/window';
import { StageScene } from './stage';

export class StageSelectScene implements Scene {
  private menu = new Menu([], 8);

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  /** 現在のクリア状況に合わせて一覧を作り直す(解放/クリア表示のため毎フレーム) */
  private rebuild(): void {
    const state = requireState(this.app);
    const cursor = this.menu.cursor;
    this.menu.setItems(
      STAGES.map((s) => {
        const unlocked = isStageUnlocked(s, state.clearedStages);
        const cleared = state.clearedStages.includes(s.id);
        const mark = !unlocked ? '🔒' : cleared ? 'クリア' : `すいしょうLv${s.recLevel}`;
        const prefix = s.postgame ? '★' : '';
        return {
          label: `${prefix}${unlocked ? s.name : '？？？'}`,
          note: mark,
          disabled: !unlocked,
        };
      }),
    );
    this.menu.setCursor(cursor);
  }

  update(): void {
    this.rebuild();
    const key = this.app.input.poll();
    if (!key) return;
    const r = this.menu.handleKey(key);
    if (r === 'cancel') {
      this.app.scenes.pop();
      return;
    }
    if (r !== 'select') return;
    const stage = STAGES[this.menu.cursor];
    if (!stage) return;
    const state = requireState(this.app);
    if (!isStageUnlocked(stage, state.clearedStages)) return;
    this.app.scenes.push(new StageScene(this.app, stage.id));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, '#0a1428');
    grad.addColorStop(1, '#1a2a44');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    const p = isPortrait();

    drawWindow(ctx, 12, 12, view.w - 24, 52);
    drawText(ctx, 'ステージセレクト', view.w / 2, 26, { align: 'center', color: '#ffd94a' });

    this.menu.draw(ctx, 12, 76, view.w - 24);

    // 選択中ステージの説明
    const stage = STAGES[this.menu.cursor];
    const state = requireState(this.app);
    if (stage && isStageUnlocked(stage, state.clearedStages)) {
      const dy = view.h - (p ? 110 : 130);
      drawWindow(ctx, 12, dy, view.w - 24, p ? 96 : 110);
      drawText(ctx, stage.desc, 32, dy + 18, { font: FONT_SMALL, color: '#ccccee' });
      drawText(ctx, `てき ${stage.waves.length}せん + ボス`, 32, dy + 48, { font: FONT_SMALL, color: '#aaaacc' });
      drawText(ctx, 'Z/A: いどむ   X/B: もどる', view.w - 32, dy + 48, { align: 'right', font: FONT_SMALL, color: '#aaaacc' });
    }
  }
}
