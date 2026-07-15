// ============================================================
// 育成/イベントクエストの一覧(解放条件つき単体クエスト)
//   タップで挑戦。ノーマルの島マップとは別の、シンプルなリスト表示。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { getSpecies } from '../data/monsters';
import { getStage, isExtraStageUnlocked, type StageDef } from '../data/stages';
import { drawFancyBg, type BgTheme } from '../ui/bg';
import { BackButton, drawText, drawWindow, FONT_SMALL, isPortrait, Menu, view, wrapText } from '../ui/window';
import { StageScene } from './stage';

export class ExtraQuestScene implements Scene {
  private menu = new Menu([], 8);
  private backButton = new BackButton();
  private time = 0;

  constructor(
    private app: App,
    private title: string,
    private stages: StageDef[],
    private theme: BgTheme,
  ) {}

  onEnter(): void {
    this.app.input.flush();
    this.rebuild();
  }

  private rebuild(): void {
    const state = requireState(this.app);
    const cursor = this.menu.cursor;
    this.menu.setItems(
      this.stages.map((s) => {
        const unlocked = isExtraStageUnlocked(s, state.clearedStages);
        const cleared = state.clearedStages.includes(s.id);
        return {
          label: unlocked ? `${s.boss ? '👑 ' : ''}${s.name}` : '？？？',
          note: !unlocked ? '🔒' : cleared ? 'クリア' : `Lv${s.recLevel}`,
          disabled: !unlocked,
        };
      }),
    );
    this.menu.setCursor(cursor);
  }

  private challenge(index: number): void {
    const state = requireState(this.app);
    const stage = this.stages[index];
    if (!stage || !isExtraStageUnlocked(stage, state.clearedStages)) return;
    this.app.scenes.push(new StageScene(this.app, stage.id));
  }

  update(dt: number): void {
    this.time += dt;
    this.rebuild();
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;

    if (tap) {
      if (this.backButton.contains(tap.x, tap.y)) {
        this.app.scenes.pop();
        return;
      }
      const idx = this.menu.itemAt(tap.x, tap.y);
      if (idx !== null) {
        this.menu.setCursor(idx);
        this.challenge(idx);
      }
      return;
    }
    const r = this.menu.handleKey(key!);
    if (r === 'cancel') this.app.scenes.pop();
    else if (r === 'select') this.challenge(this.menu.cursor);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawFancyBg(ctx, this.theme, this.time);
    const state = requireState(this.app);
    const p = isPortrait();

    drawWindow(ctx, 12, 12, view.w - 24, 52);
    drawText(ctx, this.title, view.w / 2, 26, { align: 'center', color: '#ffd94a', shadow: true });
    this.backButton.draw(ctx);

    this.menu.draw(ctx, 12, 76, view.w - 24);

    // 選択中クエストの詳細
    const stage = this.stages[this.menu.cursor];
    if (!stage) return;
    const unlocked = isExtraStageUnlocked(stage, state.clearedStages);
    const dy = view.h - (p ? 168 : 150);
    const dh = p ? 156 : 138;
    drawWindow(ctx, 12, dy, view.w - 24, dh);

    if (!unlocked) {
      const reqName = stage.requires ? getStageName(stage.requires) : '';
      drawText(ctx, `🔒 みかいほう`, 32, dy + 18, { color: '#f0a05a' });
      const msg = `「${reqName}」を クリアすると ちょうせん できる。`;
      wrapText(ctx, msg, view.w - 72, FONT_SMALL).forEach((line, i) =>
        drawText(ctx, line, 32, dy + 50 + i * 26, { font: FONT_SMALL, color: '#ccccee' }),
      );
      return;
    }

    drawText(
      ctx,
      `${stage.boss ? '👑 ボスバトル' : `てき ${stage.enemies.length}たい`}  /  すいしょうLv${stage.recLevel}`,
      32,
      dy + 16,
      { font: FONT_SMALL, color: stage.boss ? '#f0a05a' : '#ccccee' },
    );
    let ly = dy + 44;
    if (stage.desc) {
      wrapText(ctx, stage.desc, view.w - 72, FONT_SMALL).forEach((line) => {
        drawText(ctx, line, 32, ly, { font: FONT_SMALL, color: '#cfe0ff' });
        ly += 24;
      });
    }
    // ドロップ・報酬
    if (stage.monsterDrops && stage.monsterDrops.length > 0) {
      const names = stage.monsterDrops
        .map((md) => (state.seenSpecies.includes(md.speciesId) ? getSpecies(md.speciesId).name : '？？？'))
        .join(' / ');
      drawText(ctx, `ドロップ: ${names}`, 32, ly, { font: FONT_SMALL, color: '#8fd4ff' });
    }
    if (!state.clearedStages.includes(stage.id) && stage.rewardOrbs > 0) {
      drawText(ctx, `しょかい: 💎×${stage.rewardOrbs}`, view.w - 32, dy + 16, {
        align: 'right',
        font: FONT_SMALL,
        color: '#ffd94a',
      });
    }
  }
}

function getStageName(id: string): string {
  try {
    return getStage(id).name;
  } catch {
    return id;
  }
}
