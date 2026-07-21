// ============================================================
// クエストハブ — ホームと共通のプレミアムソシャゲUI
// ============================================================
import {
  faArrowLeft,
  faBars,
  faBolt,
  faChevronRight,
  faCoins,
  faCompass,
  faDragon,
  faDumbbell,
  faGem,
  faHouse,
  faKhanda,
  faStar,
  faTicket,
} from '@fortawesome/free-solid-svg-icons';
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { ADVENT_GROUPS, EVENT_STAGES, TRAINING_STAGES } from '../data/stages';
import { drawFancyBg } from '../ui/bg';
import { drawIcon } from '../ui/icon';
import { createImageAsset, drawCoverImage, imageReady } from '../ui/media';
import { drawGauge, drawText, inRect, isPortrait, view, type Rect } from '../ui/window';
import { MonsterBoxScene } from './box';
import { ExtraQuestScene, stageEntries, type QuestEntry } from './extraQuest';
import { GachaScene } from './gacha';
import { StageSelectScene } from './stageSelect';

type FocusArea = 'cards' | 'nav';

const QUEST_BACKGROUND = createImageAsset(new URL('../assets/quest/quest-bg.webp', import.meta.url).href);
const HOME_AVATAR = createImageAsset(new URL('../assets/home/home-hero.webp', import.meta.url).href);
const NORMAL_CARD = createImageAsset(new URL('../assets/quest/normal-card-v2.webp', import.meta.url).href);
const EVENT_CARD = createImageAsset(new URL('../assets/quest/event-card.webp', import.meta.url).href);
const TRAINING_CARD = createImageAsset(new URL('../assets/quest/training-card.webp', import.meta.url).href);

const UI_FONT = '"Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

const CATEGORIES = [
  { label: 'ノーマルクエスト', color: '#d44932', image: NORMAL_CARD, icon: faKhanda },
  { label: 'イベントクエスト', color: '#8d3edd', image: EVENT_CARD, icon: faGem },
  { label: '育成クエスト', color: '#16865c', image: TRAINING_CARD, icon: faDumbbell },
] as const;

const NAV_ITEMS = [
  { label: 'ホーム', icon: faHouse },
  { label: 'クエスト', icon: faCompass },
  { label: 'ガチャ', icon: faTicket },
  { label: 'モンスター', icon: faDragon },
  { label: 'メニュー', icon: faBars },
] as const;

export class QuestHubScene implements Scene {
  private cursor = 0;
  private focus: FocusArea = 'cards';
  private showFocus = false;
  private navCursor = 1;
  private cardRects: Rect[] = [];
  private navRects: Rect[] = [];
  private backRect: Rect | null = null;
  private time = 0;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  update(dt: number): void {
    this.time += dt;
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;

    if (tap) {
      this.showFocus = false;
      if (this.backRect && inRect(tap.x, tap.y, this.backRect)) {
        this.app.scenes.pop();
        return;
      }
      for (let i = 0; i < this.cardRects.length; i++) {
        if (!inRect(tap.x, tap.y, this.cardRects[i]!)) continue;
        this.focus = 'cards';
        this.cursor = i;
        this.open(i);
        return;
      }
      for (let i = 0; i < this.navRects.length; i++) {
        if (!inRect(tap.x, tap.y, this.navRects[i]!)) continue;
        this.focus = 'nav';
        this.navCursor = i;
        this.activateNav(i);
        return;
      }
      return;
    }

    if (!key) return;
    this.showFocus = true;
    if (key === 'cancel') {
      this.app.scenes.pop();
      return;
    }
    if (key === 'menu') {
      this.activateNav(4);
      return;
    }

    if (this.focus === 'cards') {
      if (key === 'up') this.cursor = Math.max(0, this.cursor - 1);
      else if (key === 'down') {
        if (this.cursor < CATEGORIES.length - 1) this.cursor += 1;
        else this.focus = 'nav';
      } else if (key === 'left') {
        this.focus = 'nav';
        this.navCursor = 0;
      } else if (key === 'right') {
        this.focus = 'nav';
        this.navCursor = 2;
      } else if (key === 'confirm') {
        this.open(this.cursor);
      }
      return;
    }

    if (key === 'left') this.navCursor = (this.navCursor + NAV_ITEMS.length - 1) % NAV_ITEMS.length;
    else if (key === 'right') this.navCursor = (this.navCursor + 1) % NAV_ITEMS.length;
    else if (key === 'up') this.focus = 'cards';
    else if (key === 'confirm') this.activateNav(this.navCursor);
  }

  private open(index: number): void {
    switch (index) {
      case 0:
        this.app.scenes.push(new StageSelectScene(this.app));
        break;
      case 1: {
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

  private activateNav(index: number): void {
    switch (index) {
      case 0:
        this.app.scenes.pop();
        break;
      case 1:
        break;
      case 2:
        this.switchTab(new GachaScene(this.app));
        break;
      case 3:
        this.switchTab(new MonsterBoxScene(this.app));
        break;
      case 4:
        this.app.scenes.pop();
        this.app.input.virtualPress('menu');
        this.app.input.virtualRelease('menu');
        break;
    }
  }

  private switchTab(scene: Scene): void {
    this.app.scenes.pop();
    this.app.scenes.push(scene);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.cardRects = [];
    this.navRects = [];
    this.backRect = null;
    this.drawBackground(ctx);
    if (isPortrait()) this.drawPortrait(ctx);
    else this.drawLandscape(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    if (imageReady(QUEST_BACKGROUND)) {
      drawCoverImage(ctx, QUEST_BACKGROUND, { x: 0, y: 0, w: view.w, h: view.h }, 0.5, 0.42);
    } else {
      drawFancyBg(ctx, 'map', this.time);
    }
    ctx.fillStyle = 'rgba(2,7,24,0.22)';
    ctx.fillRect(0, 0, view.w, view.h);
    const lowerShade = ctx.createLinearGradient(0, view.h * 0.62, 0, view.h);
    lowerShade.addColorStop(0, 'rgba(2,7,22,0)');
    lowerShade.addColorStop(1, 'rgba(2,7,22,0.88)');
    ctx.fillStyle = lowerShade;
    ctx.fillRect(0, view.h * 0.62, view.w, view.h * 0.38);
  }

  private drawPortrait(ctx: CanvasRenderingContext2D): void {
    this.drawHeader(ctx, { x: 14, y: 14, w: 60, h: 44 }, view.w / 2, 16);
    this.drawStatusBar(ctx, 14, 72, view.w - 28, 48);

    const cardX = 24;
    const cardW = view.w - 48;
    const cardH = 198;
    const startY = 232;
    const gap = 18;
    CATEGORIES.forEach((category, index) => {
      const rect = { x: cardX, y: startY + index * (cardH + gap), w: cardW, h: cardH };
      this.cardRects.push(rect);
      this.drawCategoryCard(
        ctx,
        rect,
        category,
        this.showFocus && this.focus === 'cards' && this.cursor === index,
        index,
      );
    });

    this.drawProgressPanel(ctx, { x: 24, y: 872, w: view.w - 48, h: 52 });
    this.drawBottomNav(ctx, { x: 0, y: 934, w: view.w, h: 106 });
  }

  private drawLandscape(ctx: CanvasRenderingContext2D): void {
    this.drawHeader(ctx, { x: 14, y: 14, w: 64, h: 50 }, 286, 20);
    this.drawStatusBar(ctx, 490, 14, 454, 58);

    const margin = 18;
    const gap = 12;
    const cardW = (view.w - margin * 2 - gap * 2) / 3;
    const cardH = cardW / 2.25;
    CATEGORIES.forEach((category, index) => {
      const rect = { x: margin + index * (cardW + gap), y: 116, w: cardW, h: cardH };
      this.cardRects.push(rect);
      this.drawCategoryCard(
        ctx,
        rect,
        category,
        this.showFocus && this.focus === 'cards' && this.cursor === index,
        index,
      );
    });

    this.drawProgressPanel(ctx, { x: 210, y: 286, w: 540, h: 84 });
    this.drawBottomNav(ctx, { x: 150, y: 482, w: 660, h: 142 });
  }

  private drawHeader(ctx: CanvasRenderingContext2D, backRect: Rect, titleX: number, titleY: number): void {
    this.backRect = backRect;
    ctx.save();
    ctx.shadowColor = 'rgba(255,194,55,0.45)';
    ctx.shadowBlur = 8;
    backPlaquePath(ctx, backRect, 0);
    const backFill = ctx.createLinearGradient(0, backRect.y, 0, backRect.y + backRect.h);
    backFill.addColorStop(0, '#4c3618');
    backFill.addColorStop(1, '#17142a');
    ctx.fillStyle = backFill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#f2c95d';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    backPlaquePath(ctx, backRect, 5);
    ctx.strokeStyle = 'rgba(255,239,157,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawIcon(ctx, faArrowLeft, backRect.x + 16, backRect.y + 10, 26, '#ffe277');
    ctx.restore();

    drawText(ctx, 'クエスト', titleX, titleY, {
      align: 'center',
      color: '#ffe28a',
      font: `bold 29px ${UI_FONT}`,
      shadow: true,
    });
    ctx.save();
    ctx.strokeStyle = 'rgba(239,194,78,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(titleX - 112, titleY + 18);
    ctx.lineTo(titleX - 58, titleY + 18);
    ctx.moveTo(titleX + 58, titleY + 18);
    ctx.lineTo(titleX + 112, titleY + 18);
    ctx.stroke();
    ctx.restore();
  }

  private drawStatusBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const state = requireState(this.app);
    const rank = state.party[0]?.level ?? 1;
    const cellW = w / 4;
    const iconSize = Math.min(25, h - 22);
    const font = `bold ${w < 420 ? 13 : 15}px ${UI_FONT}`;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.62)';
    ctx.shadowBlur = 10;
    rounded(ctx, x, y, w, h, 13);
    ctx.fillStyle = 'rgba(5,10,30,0.92)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(229,193,107,0.74)';
    ctx.lineWidth = 1.7;
    ctx.stroke();

    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * cellW, y + 9);
      ctx.lineTo(x + i * cellW, y + h - 9);
      ctx.strokeStyle = 'rgba(190,204,235,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    this.drawRankAvatar(ctx, x + 9, y + (h - 30) / 2, 30);
    drawText(ctx, `Rank ${rank}`, x + cellW - 8, y + h / 2 - 9, {
      align: 'right',
      font,
      color: '#f4f6ff',
    });

    drawIcon(ctx, faBolt, x + cellW + 9, y + (h - iconSize) / 2, iconSize, '#61f599');
    const meterX = x + cellW + 39;
    const meterW = cellW - 48;
    const segmentGap = 2;
    const segmentW = (meterW - segmentGap * 3) / 4;
    for (let i = 0; i < 4; i++) {
      rounded(ctx, meterX + i * (segmentW + segmentGap), y + h / 2 - 6, segmentW, 12, 3);
      ctx.fillStyle = '#55d992';
      ctx.fill();
      ctx.strokeStyle = 'rgba(216,255,235,0.72)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    drawIcon(ctx, faGem, x + cellW * 2 + 10, y + (h - iconSize) / 2, iconSize, '#62d9ff');
    drawText(ctx, String(state.orbs), x + cellW * 3 - 12, y + h / 2 - 9, {
      align: 'right',
      font,
      color: '#f4f6ff',
    });
    drawIcon(ctx, faCoins, x + cellW * 3 + 10, y + (h - iconSize) / 2, iconSize, '#ffcd54');
    drawText(ctx, `${state.gold}G`, x + w - 12, y + h / 2 - 9, {
      align: 'right',
      font,
      color: '#f4f6ff',
    });
    ctx.restore();
  }

  private drawRankAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#16478a';
    ctx.fillRect(x, y, size, size);
    if (imageReady(HOME_AVATAR)) {
      ctx.drawImage(HOME_AVATAR, 360, 480, 540, 540, x, y, size, size);
    } else {
      drawIcon(ctx, faDragon, x + 3, y + 3, size - 6, '#68bfff');
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#f3cf63';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private drawCategoryCard(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    category: (typeof CATEGORIES)[number],
    selected: boolean,
    index: number,
  ): void {
    ctx.save();
    ctx.shadowColor = selected ? category.color : 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = selected ? 19 + Math.sin(this.time * 3) * 3 : 8;
    if (imageReady(category.image)) {
      drawCoverImage(ctx, category.image, rect, 0.5, 0.5);
    } else {
      rounded(ctx, rect.x, rect.y, rect.w, rect.h, 13);
      ctx.fillStyle = 'rgba(8,14,38,0.96)';
      ctx.fill();
    }
    ctx.shadowColor = 'transparent';

    this.drawCategoryBadge(ctx, rect, category, index);

    const labelY = rect.y + rect.h * 0.775;
    drawText(ctx, category.label, rect.x + rect.w / 2, labelY, {
      align: 'center',
      color: '#fff0a0',
      font: `bold ${rect.h < 160 ? 18 : 25}px ${UI_FONT}`,
      shadow: true,
    });
    const arrowSize = rect.h < 160 ? 18 : 24;
    drawIcon(
      ctx,
      faChevronRight,
      rect.x + rect.w - arrowSize - rect.w * 0.06,
      labelY + 2,
      arrowSize,
      '#ffe274',
    );

    if (selected) {
      rounded(ctx, rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 12);
      ctx.strokeStyle = '#73e2ff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCategoryBadge(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    category: (typeof CATEGORIES)[number],
    index: number,
  ): void {
    const landscapeSmall = rect.h < 160;
    const badgeW = landscapeSmall ? 43 : 58;
    const badgeH = landscapeSmall ? 52 : 70;
    const x = rect.x + (landscapeSmall ? 8 : 10);
    const y = rect.y + (landscapeSmall ? 7 : 8);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.62)';
    ctx.shadowBlur = 7;
    shieldBadgePath(ctx, x, y, badgeW, badgeH);
    const fill = ctx.createLinearGradient(0, y, 0, y + badgeH);
    if (index === 0) {
      fill.addColorStop(0, '#c5342e');
      fill.addColorStop(1, '#681517');
    } else if (index === 1) {
      fill.addColorStop(0, '#7e2fb4');
      fill.addColorStop(1, '#361063');
    } else {
      fill.addColorStop(0, '#16815d');
      fill.addColorStop(1, '#06412f');
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#f6d16a';
    ctx.lineWidth = landscapeSmall ? 2 : 3;
    ctx.stroke();
    shieldBadgePath(ctx, x + 5, y + 5, badgeW - 10, badgeH - 12);
    ctx.strokeStyle = 'rgba(255,239,157,0.78)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (index === 1) {
      drawText(ctx, '期間', x + badgeW / 2, y + (landscapeSmall ? 11 : 15), {
        align: 'center',
        color: '#ffe77e',
        font: `bold ${landscapeSmall ? 9 : 12}px ${UI_FONT}`,
        shadow: true,
      });
      drawText(ctx, '限定', x + badgeW / 2, y + (landscapeSmall ? 25 : 33), {
        align: 'center',
        color: '#ffe77e',
        font: `bold ${landscapeSmall ? 9 : 12}px ${UI_FONT}`,
        shadow: true,
      });
    } else {
      const iconSize = landscapeSmall ? 24 : 34;
      drawIcon(
        ctx,
        category.icon,
        x + (badgeW - iconSize) / 2,
        y + (badgeH - iconSize) / 2 - 3,
        iconSize,
        '#ffe078',
      );
    }
    ctx.restore();
  }

  private drawProgressPanel(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const state = requireState(this.app);
    const progress = Math.min(5, 2 + state.clearedStages.length);
    const recommendedPower = 2500 + state.clearedStages.length * 350;
    const splitX = rect.x + rect.w * 0.65;
    const compact = rect.h <= 60;

    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    const panel = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    panel.addColorStop(0, 'rgba(23,35,68,0.96)');
    panel.addColorStop(1, 'rgba(7,14,34,0.96)');
    ctx.fillStyle = panel;
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,193,118,0.64)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const leftTextX = rect.x + (compact ? 51 : 62);
    drawIcon(ctx, faStar, rect.x + 15, rect.y + (compact ? 13 : 18), compact ? 26 : 34, '#ffd64d');
    drawText(ctx, '現在の進行度', leftTextX, rect.y + (compact ? 7 : 13), {
      color: '#eef3ff',
      font: `bold ${compact ? 12 : 15}px ${UI_FONT}`,
    });
    const gaugeX = leftTextX;
    const gaugeW = splitX - gaugeX - 42;
    drawGauge(ctx, gaugeX, rect.y + (compact ? 31 : 48), gaugeW, compact ? 10 : 14, progress / 5, '#55d98f');
    drawText(ctx, `${progress}/5`, splitX - 13, rect.y + (compact ? 26 : 43), {
      align: 'right',
      color: '#ffffff',
      font: `bold ${compact ? 13 : 16}px ${UI_FONT}`,
    });

    ctx.beginPath();
    ctx.moveTo(splitX, rect.y + (compact ? 7 : 12));
    ctx.lineTo(splitX, rect.y + rect.h - (compact ? 7 : 12));
    ctx.strokeStyle = 'rgba(200,214,245,0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawIcon(ctx, faKhanda, splitX + 13, rect.y + (compact ? 14 : 21), compact ? 24 : 30, '#ffd264');
    drawText(ctx, '推奨戦闘力', splitX + (compact ? 43 : 53), rect.y + (compact ? 5 : 10), {
      color: '#dce5f7',
      font: `bold ${compact ? 10 : 13}px ${UI_FONT}`,
    });
    drawText(ctx, recommendedPower.toLocaleString('ja-JP'), splitX + (compact ? 43 : 53), rect.y + (compact ? 25 : 38), {
      color: '#ffd564',
      font: `bold ${compact ? 18 : 22}px ${UI_FONT}`,
    });
    ctx.restore();
  }

  private drawBottomNav(ctx: CanvasRenderingContext2D, rect: Rect): void {
    ctx.save();
    const background = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    background.addColorStop(0, '#111c38');
    background.addColorStop(1, '#060c1c');
    ctx.fillStyle = background;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(125,154,214,0.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + 1);
    ctx.lineTo(rect.x + rect.w, rect.y + 1);
    ctx.stroke();

    const gap = rect.w <= 480 ? 3 : 4;
    const pad = rect.w <= 480 ? 6 : 8;
    const itemW = (rect.w - pad * 2 - gap * (NAV_ITEMS.length - 1)) / NAV_ITEMS.length;
    const itemY = rect.y + 10;
    const itemH = rect.h - 18;
    this.navRects = [];

    NAV_ITEMS.forEach((item, index) => {
      const x = rect.x + pad + index * (itemW + gap);
      const itemRect = { x, y: itemY, w: itemW, h: itemH };
      this.navRects.push(itemRect);
      const active = index === 1;
      const focused = this.showFocus && this.focus === 'nav' && this.navCursor === index;
      rounded(ctx, x, itemY, itemW, itemH, 13);
      const itemFill = ctx.createLinearGradient(0, itemY, 0, itemY + itemH);
      itemFill.addColorStop(0, active ? '#17529c' : '#142445');
      itemFill.addColorStop(1, active ? '#0c2f6b' : '#0a132a');
      ctx.fillStyle = itemFill;
      ctx.fill();
      ctx.strokeStyle = focused ? '#ffe274' : active ? '#53d8ff' : '#40577e';
      ctx.lineWidth = focused ? 3 : active ? 2.5 : 1.5;
      ctx.stroke();

      const iconSize = Math.min(34, itemW * 0.42);
      drawIcon(
        ctx,
        item.icon,
        x + (itemW - iconSize) / 2,
        itemY + 18,
        iconSize,
        active ? '#f7d56a' : '#c8d9f8',
      );
      drawText(ctx, item.label, x + itemW / 2, itemY + itemH - 31, {
        align: 'center',
        color: active ? '#ffffff' : '#d7e0f2',
        font: `bold ${itemW < 85 ? 12 : 14}px ${UI_FONT}`,
        shadow: true,
      });
    });
    ctx.restore();
  }
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function backPlaquePath(ctx: CanvasRenderingContext2D, rect: Rect, inset: number): void {
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = rect.w - inset * 2;
  const h = rect.h - inset * 2;
  const cut = Math.min(13, h * 0.34);
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

function shieldBadgePath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x + w * 0.22, y);
  ctx.lineTo(x + w * 0.78, y);
  ctx.lineTo(x + w, y + h * 0.2);
  ctx.lineTo(x + w * 0.9, y + h * 0.76);
  ctx.lineTo(x + w * 0.5, y + h);
  ctx.lineTo(x + w * 0.1, y + h * 0.76);
  ctx.lineTo(x, y + h * 0.2);
  ctx.closePath();
}
