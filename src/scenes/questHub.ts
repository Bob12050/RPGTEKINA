// ============================================================
// クエストハブ — 「ノーマル / イベント / 育成」を選ぶ入口
// ============================================================
import type { App } from '../core/app';
import type { Scene } from '../core/scene';
import { ADVENT_GROUPS, EVENT_STAGES, TRAINING_STAGES } from '../data/stages';
import { drawFancyBg } from '../ui/bg';
import { BackButton, Button, drawText, FONT_SMALL, isPortrait, view } from '../ui/window';
import { ExtraQuestScene, stageEntries, type QuestEntry } from './extraQuest';
import { StageSelectScene } from './stageSelect';

interface Category {
  icon: string;
  label: string;
  sub: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { icon: '⚔️', label: 'ノーマルクエスト', sub: '周回で 💎オーブを ほりあてる (石ほり)', color: '#c2452e' },
  { icon: '🎁', label: 'イベントクエスト', sub: 'とくべつな ボス & レア報酬・降臨', color: '#7a3ad6' },
  { icon: '⭐', label: '育成クエスト', sub: 'メタルで レベルを かせぐ', color: '#2c6a4f' },
];

export class QuestHubScene implements Scene {
  private cursor = 0;
  private buttons = CATEGORIES.map(() => new Button());
  private backButton = new BackButton();
  private time = 0;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  private open(i: number): void {
    switch (i) {
      case 0:
        this.app.scenes.push(new StageSelectScene(this.app));
        break;
      case 1: {
        // 通常イベント + 降臨グループ
        const entries: QuestEntry[] = [
          ...stageEntries(EVENT_STAGES),
          ...ADVENT_GROUPS.map((group) => ({ type: 'advent' as const, group })),
        ];
        this.app.scenes.push(new ExtraQuestScene(this.app, 'イベントクエスト', entries, 'gacha'));
        break;
      }
      case 2:
        this.app.scenes.push(new ExtraQuestScene(this.app, '育成クエスト', stageEntries(TRAINING_STAGES), 'map'));
        break;
    }
  }

  update(dt: number): void {
    this.time += dt;
    const tap = this.app.input.takeTap();
    if (tap) {
      if (this.backButton.contains(tap.x, tap.y)) {
        this.app.scenes.pop();
        return;
      }
      for (let i = 0; i < this.buttons.length; i++) {
        if (this.buttons[i]!.contains(tap.x, tap.y)) {
          this.cursor = i;
          this.open(i);
          return;
        }
      }
      return;
    }
    const key = this.app.input.poll();
    if (!key) return;
    if (key === 'cancel') this.app.scenes.pop();
    else if (key === 'up') this.cursor = (this.cursor + CATEGORIES.length - 1) % CATEGORIES.length;
    else if (key === 'down') this.cursor = (this.cursor + 1) % CATEGORIES.length;
    else if (key === 'confirm') this.open(this.cursor);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawFancyBg(ctx, 'map', this.time);
    const p = isPortrait();

    drawText(ctx, 'クエストを えらぶ', view.w / 2, 26, { align: 'center', color: '#ffd94a', shadow: true });
    this.backButton.draw(ctx);

    const bw = Math.min(440, view.w - 40);
    const bx = (view.w - bw) / 2;
    const bh = p ? 110 : 96;
    const gap = 20;
    const startY = p ? 150 : 120;
    CATEGORIES.forEach((c, i) => {
      const pulse = i === 1 ? 0.3 + 0.25 * Math.sin(this.time * 3) : undefined; // イベントは光らせる
      this.buttons[i]!.draw(ctx, bx, startY + i * (bh + gap), bw, bh, `${c.icon} ${c.label}`, {
        color: c.color,
        sub: c.sub,
        selected: i === this.cursor,
        glow: pulse !== undefined ? `rgba(200,120,255,${pulse.toFixed(2)})` : undefined,
      });
    });

    drawText(ctx, 'タップして えらぼう', view.w / 2, view.h - 48, {
      align: 'center',
      font: FONT_SMALL,
      color: '#aaaacc',
    });
  }
}
