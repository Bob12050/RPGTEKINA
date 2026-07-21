// ============================================================
// ガチャシーン — ホーム／クエストと共通のプレミアムソシャゲUI
// ============================================================
import {
  faArrowLeft,
  faBars,
  faBolt,
  faCheck,
  faCircleInfo,
  faClockRotateLeft,
  faCoins,
  faCompass,
  faDragon,
  faGem,
  faHouse,
  faWandSparkles,
  faStar,
  faTicket,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { FARM_MAX, PARTY_MAX, rankStars, type Family, type SpeciesDef } from '../core/types';
import { gachaLevel, MULTI_COST, MULTI_COUNT, pullOne, pullTen, RANK_RATES, SINGLE_COST } from '../data/gacha';
import { obtainMonster, type ObtainResult } from '../game/state';
import { drawFancyBg } from '../ui/bg';
import { RANK_COLORS } from '../ui/format';
import { drawIcon } from '../ui/icon';
import { createImageAsset, drawCoverImage, imageReady } from '../ui/media';
import { drawMonster } from '../ui/sprites';
import { drawText, inRect, isPortrait, view, type Rect } from '../ui/window';
import { MonsterBoxScene } from './box';
import { MenuScene } from './menu';
import { QuestHubScene } from './questHub';

type Phase = 'menu' | 'confirm' | 'rates' | 'history' | 'revealSingle' | 'revealMulti' | 'message';
type FocusArea = 'summon' | 'utility' | 'nav';

interface PullResult {
  species: SpeciesDef;
  level: number;
  kind: ObtainResult['kind'];
  luck: number;
}

interface PremiumButtonStyle {
  primary?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

/** 単発演出: この秒数だけタメてから公開 */
const SINGLE_DELAY = 1.05;
/** 10連演出: 1体ずつ公開する間隔 */
const MULTI_STEP = 0.18;

const GACHA_BACKGROUND = createImageAsset(new URL('../assets/gacha/gacha-bg.webp', import.meta.url).href);
const FEATURED_SANCTUARY = createImageAsset(new URL('../assets/gacha/featured-sanctuary.webp', import.meta.url).href);
const SUMMON_STAGE = createImageAsset(new URL('../assets/gacha/summon-stage.webp', import.meta.url).href);
const FAMILY_ATLAS_A = createImageAsset(new URL('../assets/gacha/family-atlas-a.webp', import.meta.url).href);
const FAMILY_ATLAS_B = createImageAsset(new URL('../assets/gacha/family-atlas-b.webp', import.meta.url).href);
const HOME_AVATAR = createImageAsset(new URL('../assets/home/home-hero.webp', import.meta.url).href);

const UI_FONT = '"Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

const NAV_ITEMS = [
  { label: 'ホーム', icon: faHouse },
  { label: 'クエスト', icon: faCompass },
  { label: 'ガチャ', icon: faTicket },
  { label: 'モンスター', icon: faDragon },
  { label: 'メニュー', icon: faBars },
] as const;

const FAMILY_PORTRAITS: Record<Family, { image: HTMLImageElement | null; column: 0 | 1; row: 0 | 1 }> = {
  slime: { image: FAMILY_ATLAS_A, column: 0, row: 0 },
  dragon: { image: FAMILY_ATLAS_A, column: 1, row: 0 },
  beast: { image: FAMILY_ATLAS_A, column: 0, row: 1 },
  nature: { image: FAMILY_ATLAS_A, column: 1, row: 1 },
  demon: { image: FAMILY_ATLAS_B, column: 0, row: 0 },
  zombie: { image: FAMILY_ATLAS_B, column: 1, row: 0 },
  material: { image: FAMILY_ATLAS_B, column: 0, row: 1 },
  mystic: { image: FAMILY_ATLAS_B, column: 1, row: 1 },
};

export class GachaScene implements Scene {
  private phase: Phase = 'menu';
  private focus: FocusArea = 'summon';
  private summonCursor = 1;
  private utilityCursor = 0;
  private navCursor = 2;
  private showFocus = false;
  private confirmCount = MULTI_COUNT;
  private results: PullResult[] = [];
  private recentResults: PullResult[] = [];
  private revealT = 0;
  private message = '';
  private time = 0;

  private backRect: Rect | null = null;
  private singleRect: Rect | null = null;
  private multiRect: Rect | null = null;
  private ratesRect: Rect | null = null;
  private historyRect: Rect | null = null;
  private navRects: Rect[] = [];
  private modalRect: Rect | null = null;
  private modalCloseRect: Rect | null = null;
  private confirmCancelRect: Rect | null = null;
  private confirmDrawRect: Rect | null = null;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  /** 空きスロット(パーティ+ボックス)の数 */
  private freeSlots(): number {
    const state = requireState(this.app);
    return PARTY_MAX - state.party.length + (FARM_MAX - state.farm.length);
  }

  private requestPull(count: number): void {
    const state = requireState(this.app);
    const cost = count === 1 ? SINGLE_COST : MULTI_COST;
    if (state.orbs < cost) {
      this.message = `オーブが不足しています。あと ${cost - state.orbs} 個必要です。`;
      this.phase = 'message';
      return;
    }
    if (this.freeSlots() < count) {
      this.message = `モンスターボックスの空きが ${count} 体分必要です。`;
      this.phase = 'message';
      return;
    }
    this.confirmCount = count;
    this.phase = 'confirm';
  }

  private doPull(count: number): void {
    const state = requireState(this.app);
    const cost = count === 1 ? SINGLE_COST : MULTI_COST;
    if (state.orbs < cost || this.freeSlots() < count) {
      this.phase = 'menu';
      return;
    }

    state.orbs -= cost;
    const specs = count === 1 ? [pullOne()] : pullTen();
    this.results = specs.map((species) => {
      const level = gachaLevel(species.rank);
      const result = obtainMonster(state, species.id, level);
      return { species, level, kind: result.kind, luck: result.luck };
    });
    this.recentResults = [...this.results];
    this.revealT = 0;
    this.phase = count === 1 ? 'revealSingle' : 'revealMulti';
  }

  update(dt: number): void {
    this.time += dt;
    if (this.phase === 'revealSingle' || this.phase === 'revealMulti') this.revealT += dt;
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;

    if (this.phase === 'menu') {
      this.updateMenu(tap, key);
      return;
    }

    if (this.phase === 'confirm') {
      if (tap) {
        if (this.confirmCancelRect && inRect(tap.x, tap.y, this.confirmCancelRect)) this.phase = 'menu';
        else if (this.confirmDrawRect && inRect(tap.x, tap.y, this.confirmDrawRect)) this.doPull(this.confirmCount);
        else if (this.modalRect && !inRect(tap.x, tap.y, this.modalRect)) this.phase = 'menu';
        return;
      }
      if (key === 'cancel') this.phase = 'menu';
      else if (key === 'confirm') this.doPull(this.confirmCount);
      return;
    }

    if (this.phase === 'rates' || this.phase === 'history') {
      if (tap) {
        if (
          (this.modalCloseRect && inRect(tap.x, tap.y, this.modalCloseRect)) ||
          (this.modalRect && !inRect(tap.x, tap.y, this.modalRect))
        ) {
          this.phase = 'menu';
        }
        return;
      }
      if (key === 'cancel' || key === 'confirm') this.phase = 'menu';
      return;
    }

    if (this.phase === 'message') {
      if (tap || key === 'confirm' || key === 'cancel') this.phase = 'menu';
      return;
    }

    if (this.phase === 'revealSingle') {
      if (!tap && key !== 'confirm' && key !== 'cancel') return;
      if (this.revealT < SINGLE_DELAY) this.revealT = SINGLE_DELAY;
      else this.phase = 'menu';
      return;
    }

    if (!tap && key !== 'confirm' && key !== 'cancel') return;
    const fullReveal = SINGLE_DELAY + MULTI_COUNT * MULTI_STEP;
    if (this.revealT < fullReveal) this.revealT = fullReveal;
    else this.phase = 'menu';
  }

  private updateMenu(tap: { x: number; y: number } | null, key: ReturnType<App['input']['poll']>): void {
    if (tap) {
      this.showFocus = false;
      if (this.backRect && inRect(tap.x, tap.y, this.backRect)) {
        this.app.scenes.pop();
        return;
      }
      if (this.singleRect && inRect(tap.x, tap.y, this.singleRect)) {
        this.focus = 'summon';
        this.summonCursor = 0;
        this.requestPull(1);
        return;
      }
      if (this.multiRect && inRect(tap.x, tap.y, this.multiRect)) {
        this.focus = 'summon';
        this.summonCursor = 1;
        this.requestPull(MULTI_COUNT);
        return;
      }
      if (this.ratesRect && inRect(tap.x, tap.y, this.ratesRect)) {
        this.focus = 'utility';
        this.utilityCursor = 0;
        this.phase = 'rates';
        return;
      }
      if (this.historyRect && inRect(tap.x, tap.y, this.historyRect)) {
        this.focus = 'utility';
        this.utilityCursor = 1;
        this.phase = 'history';
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

    if (this.focus === 'summon') {
      if (key === 'left' || key === 'right') this.summonCursor = 1 - this.summonCursor;
      else if (key === 'up') this.focus = 'utility';
      else if (key === 'down') this.focus = 'utility';
      else if (key === 'confirm') this.requestPull(this.summonCursor === 0 ? 1 : MULTI_COUNT);
      return;
    }

    if (this.focus === 'utility') {
      if (key === 'left' || key === 'right') this.utilityCursor = 1 - this.utilityCursor;
      else if (key === 'up') this.focus = 'summon';
      else if (key === 'down') this.focus = 'nav';
      else if (key === 'confirm') this.phase = this.utilityCursor === 0 ? 'rates' : 'history';
      return;
    }

    if (key === 'left') this.navCursor = (this.navCursor + NAV_ITEMS.length - 1) % NAV_ITEMS.length;
    else if (key === 'right') this.navCursor = (this.navCursor + 1) % NAV_ITEMS.length;
    else if (key === 'up') this.focus = 'utility';
    else if (key === 'confirm') this.activateNav(this.navCursor);
  }

  private activateNav(index: number): void {
    switch (index) {
      case 0:
        this.app.scenes.pop();
        break;
      case 1:
        this.switchTab(new QuestHubScene(this.app));
        break;
      case 2:
        break;
      case 3:
        this.switchTab(new MonsterBoxScene(this.app));
        break;
      case 4:
        this.switchTab(new MenuScene(this.app));
        break;
    }
  }

  private switchTab(scene: Scene): void {
    this.app.scenes.pop();
    this.app.scenes.push(scene);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.resetRects();
    if (this.phase === 'revealSingle' || this.phase === 'revealMulti') {
      this.drawRevealBackground(ctx);
      if (this.phase === 'revealSingle') this.drawSingle(ctx);
      else this.drawMulti(ctx);
      return;
    }

    this.drawBackground(ctx);
    if (isPortrait()) this.drawPortraitMenu(ctx);
    else this.drawLandscapeMenu(ctx);

    if (this.phase !== 'menu') this.drawOverlay(ctx);
  }

  private resetRects(): void {
    this.backRect = null;
    this.singleRect = null;
    this.multiRect = null;
    this.ratesRect = null;
    this.historyRect = null;
    this.navRects = [];
    this.modalRect = null;
    this.modalCloseRect = null;
    this.confirmCancelRect = null;
    this.confirmDrawRect = null;
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    if (imageReady(GACHA_BACKGROUND)) {
      drawCoverImage(ctx, GACHA_BACKGROUND, { x: 0, y: 0, w: view.w, h: view.h }, 0.5, 0.44);
    } else {
      drawFancyBg(ctx, 'gacha', this.time);
    }
    const shade = ctx.createLinearGradient(0, 0, 0, view.h);
    shade.addColorStop(0, 'rgba(2,6,25,0.14)');
    shade.addColorStop(0.66, 'rgba(2,5,24,0.22)');
    shade.addColorStop(1, 'rgba(1,4,16,0.92)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  private drawPortraitMenu(ctx: CanvasRenderingContext2D): void {
    this.drawHeader(ctx, { x: 14, y: 14, w: 60, h: 44 }, view.w / 2, 16);
    this.drawStatusBar(ctx, 14, 72, view.w - 28, 48);

    this.drawFeaturedBanner(ctx, { x: 14, y: 122, w: view.w - 28, h: 510 });
    this.drawCurrencyPanel(ctx, { x: 122, y: 646, w: 236, h: 44 });

    const gap = 12;
    const x = 14;
    const buttonY = 700;
    const buttonH = 122;
    const singleW = 205;
    const multiW = view.w - 28 - singleW - gap;
    this.singleRect = { x, y: buttonY, w: singleW, h: buttonH };
    this.multiRect = { x: x + singleW + gap, y: buttonY, w: multiW, h: buttonH };
    const state = requireState(this.app);
    this.drawSummonButton(ctx, this.singleRect, '1回召喚', SINGLE_COST, {
      selected: this.showFocus && this.focus === 'summon' && this.summonCursor === 0,
      disabled: state.orbs < SINGLE_COST,
    });
    this.drawSummonButton(ctx, this.multiRect, '10回召喚', MULTI_COST, {
      primary: true,
      selected: this.showFocus && this.focus === 'summon' && this.summonCursor === 1,
      disabled: state.orbs < MULTI_COST,
    });

    const utilY = 840;
    const utilW = 166;
    this.ratesRect = { x: 68, y: utilY, w: utilW, h: 56 };
    this.historyRect = { x: 246, y: utilY, w: utilW, h: 56 };
    this.drawUtilityButton(
      ctx,
      this.ratesRect,
      '提供割合',
      faCircleInfo,
      this.showFocus && this.focus === 'utility' && this.utilityCursor === 0,
    );
    this.drawUtilityButton(
      ctx,
      this.historyRect,
      '召喚履歴',
      faClockRotateLeft,
      this.showFocus && this.focus === 'utility' && this.utilityCursor === 1,
    );

    drawText(ctx, '星界の召喚祭は期間限定で開催中', view.w / 2, 908, {
      align: 'center',
      color: '#cbd6ef',
      font: `bold 12px ${UI_FONT}`,
    });
    this.drawBottomNav(ctx, { x: 0, y: 934, w: view.w, h: 106 });
  }

  private drawLandscapeMenu(ctx: CanvasRenderingContext2D): void {
    this.drawHeader(ctx, { x: 14, y: 14, w: 62, h: 46 }, 250, 18);
    this.drawStatusBar(ctx, 500, 14, 446, 54);
    this.drawFeaturedBanner(ctx, { x: 18, y: 84, w: 520, h: 414 });
    this.drawCurrencyPanel(ctx, { x: 636, y: 94, w: 210, h: 48 });

    const state = requireState(this.app);
    this.singleRect = { x: 570, y: 174, w: 170, h: 126 };
    this.multiRect = { x: 752, y: 174, w: 190, h: 126 };
    this.drawSummonButton(ctx, this.singleRect, '1回召喚', SINGLE_COST, {
      selected: this.showFocus && this.focus === 'summon' && this.summonCursor === 0,
      disabled: state.orbs < SINGLE_COST,
    });
    this.drawSummonButton(ctx, this.multiRect, '10回召喚', MULTI_COST, {
      primary: true,
      selected: this.showFocus && this.focus === 'summon' && this.summonCursor === 1,
      disabled: state.orbs < MULTI_COST,
    });

    this.ratesRect = { x: 590, y: 326, w: 160, h: 56 };
    this.historyRect = { x: 766, y: 326, w: 160, h: 56 };
    this.drawUtilityButton(
      ctx,
      this.ratesRect,
      '提供割合',
      faCircleInfo,
      this.showFocus && this.focus === 'utility' && this.utilityCursor === 0,
    );
    this.drawUtilityButton(
      ctx,
      this.historyRect,
      '召喚履歴',
      faClockRotateLeft,
      this.showFocus && this.focus === 'utility' && this.utilityCursor === 1,
    );
    this.drawBottomNav(ctx, { x: 555, y: 468, w: 405, h: 156 });
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

    drawText(ctx, 'モンスターガチャ', titleX, titleY, {
      align: 'center',
      color: '#ffe28a',
      font: `bold ${isPortrait() ? 27 : 28}px ${UI_FONT}`,
      shadow: true,
    });
    ctx.save();
    ctx.strokeStyle = 'rgba(239,194,78,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(titleX - 148, titleY + 18);
    ctx.lineTo(titleX - 104, titleY + 18);
    ctx.moveTo(titleX + 104, titleY + 18);
    ctx.lineTo(titleX + 148, titleY + 18);
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
    if (imageReady(HOME_AVATAR)) ctx.drawImage(HOME_AVATAR, 360, 480, 540, 540, x, y, size, size);
    else drawIcon(ctx, faDragon, x + 3, y + 3, size - 6, '#68bfff');
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#f3cf63';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private drawFeaturedBanner(ctx: CanvasRenderingContext2D, rect: Rect): void {
    ctx.save();
    ctx.shadowColor = 'rgba(4,0,15,0.78)';
    ctx.shadowBlur = 14;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 15);
    ctx.clip();
    if (imageReady(FEATURED_SANCTUARY)) {
      drawCoverImage(ctx, FEATURED_SANCTUARY, rect, 0.5, 0.48);
    } else {
      const fallback = ctx.createLinearGradient(0, rect.y, rect.w, rect.y + rect.h);
      fallback.addColorStop(0, '#111c5e');
      fallback.addColorStop(0.55, '#542278');
      fallback.addColorStop(1, '#172b66');
      ctx.fillStyle = fallback;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      drawIcon(ctx, faGem, rect.x + rect.w / 2 - 68, rect.y + rect.h / 2 - 68, 136, '#65e3ff', 0.82);
    }
    const topShade = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h * 0.25);
    topShade.addColorStop(0, 'rgba(4,4,22,0.78)');
    topShade.addColorStop(1, 'rgba(4,4,22,0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h * 0.3);
    const bottomShade = ctx.createLinearGradient(0, rect.y + rect.h * 0.68, 0, rect.y + rect.h);
    bottomShade.addColorStop(0, 'rgba(8,3,26,0)');
    bottomShade.addColorStop(1, 'rgba(6,2,22,0.86)');
    ctx.fillStyle = bottomShade;
    ctx.fillRect(rect.x, rect.y + rect.h * 0.6, rect.w, rect.h * 0.4);
    ctx.restore();

    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 15);
    ctx.strokeStyle = '#e9bd55';
    ctx.lineWidth = 4;
    ctx.stroke();
    rounded(ctx, rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12, 11);
    ctx.strokeStyle = 'rgba(255,239,157,0.84)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    const plaqueW = Math.min(rect.w - 112, 340);
    const plaque = { x: rect.x + (rect.w - plaqueW) / 2, y: rect.y + 14, w: plaqueW, h: 66 };
    this.drawTitlePlaque(ctx, plaque);
    drawText(ctx, '星界の召喚祭', plaque.x + plaque.w / 2, plaque.y + 15, {
      align: 'center',
      color: '#ffe994',
      font: `bold ${rect.w < 500 ? 28 : 30}px ${UI_FONT}`,
      shadow: true,
    });

    const badge = { x: rect.x + 8, y: rect.y + 54, w: 64, h: 86 };
    this.drawLimitedBadge(ctx, badge);

    const ribbon = { x: rect.x + 38, y: rect.y + rect.h - 62, w: rect.w - 76, h: 46 };
    this.drawGuaranteeRibbon(ctx, ribbon);
    drawText(ctx, '10連で ★4以上 1体確定', ribbon.x + ribbon.w / 2, ribbon.y + 10, {
      align: 'center',
      color: '#fff0a8',
      font: `bold ${rect.w < 500 ? 19 : 21}px ${UI_FONT}`,
      shadow: true,
    });

    const dotY = rect.y + rect.h - 8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(rect.x + rect.w / 2 - 24 + i * 16, dotY, i === 0 ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#5ee5ff' : 'rgba(221,226,236,0.6)';
      ctx.fill();
    }
  }

  private drawTitlePlaque(ctx: CanvasRenderingContext2D, rect: Rect): void {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    beveledPath(ctx, rect, 14);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, '#5c278d');
    fill.addColorStop(0.5, '#32145e');
    fill.addColorStop(1, '#16082f');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e7bd56';
    ctx.lineWidth = 3;
    ctx.stroke();
    beveledPath(ctx, { x: rect.x + 6, y: rect.y + 6, w: rect.w - 12, h: rect.h - 12 }, 10);
    ctx.strokeStyle = 'rgba(255,235,148,0.68)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawIcon(ctx, faGem, rect.x + rect.w / 2 - 11, rect.y - 12, 22, '#6ee6ff');
    ctx.restore();
  }

  private drawLimitedBadge(ctx: CanvasRenderingContext2D, rect: Rect): void {
    ctx.save();
    shieldPath(ctx, rect);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, '#7b32a9');
    fill.addColorStop(1, '#271056');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#f1ca62';
    ctx.lineWidth = 3;
    ctx.stroke();
    shieldPath(ctx, { x: rect.x + 5, y: rect.y + 5, w: rect.w - 10, h: rect.h - 12 });
    ctx.strokeStyle = 'rgba(255,239,157,0.74)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawText(ctx, '期間', rect.x + rect.w / 2, rect.y + 18, {
      align: 'center',
      color: '#ffe87d',
      font: `bold 14px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, '限定', rect.x + rect.w / 2, rect.y + 40, {
      align: 'center',
      color: '#ffe87d',
      font: `bold 14px ${UI_FONT}`,
      shadow: true,
    });
    ctx.restore();
  }

  private drawGuaranteeRibbon(ctx: CanvasRenderingContext2D, rect: Rect): void {
    ctx.save();
    beveledPath(ctx, rect, 12);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, 'rgba(91,32,121,0.98)');
    fill.addColorStop(1, 'rgba(32,10,61,0.98)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#e9bd55';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawCurrencyPanel(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const state = requireState(this.app);
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 10);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, 'rgba(17,30,60,0.98)');
    fill.addColorStop(1, 'rgba(4,10,27,0.98)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(237,193,89,0.78)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    drawIcon(ctx, faGem, rect.x + 22, rect.y + 10, 24, '#61ddff');
    drawText(ctx, '所持', rect.x + 62, rect.y + 11, { color: '#e9effd', font: `bold 15px ${UI_FONT}` });
    drawText(ctx, String(state.orbs), rect.x + rect.w - 23, rect.y + 8, {
      align: 'right',
      color: '#ffffff',
      font: `bold 22px ${UI_FONT}`,
    });
    ctx.restore();
  }

  private drawSummonButton(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    label: string,
    cost: number,
    style: PremiumButtonStyle,
  ): void {
    const pulse = 0.55 + Math.sin(this.time * 3.1) * 0.18;
    ctx.save();
    ctx.shadowColor = style.disabled
      ? 'rgba(0,0,0,0.4)'
      : style.selected
        ? 'rgba(103,225,255,0.95)'
        : style.primary
          ? `rgba(255,199,72,${pulse})`
          : 'rgba(0,0,0,0.64)';
    ctx.shadowBlur = style.selected ? 24 : style.primary ? 18 : 10;
    ctx.shadowOffsetY = style.primary ? 0 : 4;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 13);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    if (style.disabled) {
      fill.addColorStop(0, '#4b4c5e');
      fill.addColorStop(1, '#202230');
    } else if (style.primary) {
      fill.addColorStop(0, '#a538c5');
      fill.addColorStop(0.5, '#69238f');
      fill.addColorStop(1, '#25104e');
    } else {
      fill.addColorStop(0, '#5477ac');
      fill.addColorStop(0.5, '#2d4f7f');
      fill.addColorStop(1, '#14233f');
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = style.selected ? '#67e4ff' : style.primary ? '#f5cf61' : '#ccd9e8';
    ctx.lineWidth = style.selected ? 4 : 3;
    ctx.stroke();
    rounded(ctx, rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12, 9);
    ctx.strokeStyle = style.disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,247,196,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const gloss = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h * 0.46);
    gloss.addColorStop(0, 'rgba(255,255,255,0.25)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    rounded(ctx, rect.x + 7, rect.y + 7, rect.w - 14, rect.h * 0.38, 8);
    ctx.fillStyle = gloss;
    ctx.fill();

    drawText(ctx, label, rect.x + rect.w / 2, rect.y + 22, {
      align: 'center',
      color: style.disabled ? '#9ea3b2' : style.primary ? '#fff09e' : '#ffffff',
      font: `bold ${rect.w < 190 ? 23 : 26}px ${UI_FONT}`,
      shadow: true,
    });
    const costRect = { x: rect.x + 24, y: rect.y + rect.h - 49, w: rect.w - 48, h: 34 };
    rounded(ctx, costRect.x, costRect.y, costRect.w, costRect.h, 8);
    ctx.fillStyle = 'rgba(3,7,22,0.84)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,204,105,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const gemColor = style.disabled ? '#777f91' : '#64ddff';
    drawIcon(ctx, faGem, costRect.x + costRect.w / 2 - 37, costRect.y + 7, 20, gemColor);
    drawText(ctx, String(cost), costRect.x + costRect.w / 2 + 17, costRect.y + 4, {
      align: 'center',
      color: style.disabled ? '#9a9eaa' : style.primary ? '#ffe56d' : '#f7f9ff',
      font: `bold 20px ${UI_FONT}`,
    });
    ctx.restore();
  }

  private drawUtilityButton(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    label: string,
    icon: typeof faCircleInfo,
    selected: boolean,
  ): void {
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 10);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, '#20375f');
    fill.addColorStop(1, '#09162e');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = selected ? '#6de5ff' : '#d5b75f';
    ctx.lineWidth = selected ? 3 : 1.8;
    ctx.stroke();
    drawIcon(ctx, icon, rect.x + 17, rect.y + (rect.h - 21) / 2, 21, selected ? '#67e5ff' : '#eacb70');
    drawText(ctx, label, rect.x + 49, rect.y + rect.h / 2 - 10, {
      color: '#eef3ff',
      font: `bold 15px ${UI_FONT}`,
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

    NAV_ITEMS.forEach((item, index) => {
      const x = rect.x + pad + index * (itemW + gap);
      const itemRect = { x, y: itemY, w: itemW, h: itemH };
      this.navRects.push(itemRect);
      const active = index === 2;
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
      if (active) {
        ctx.shadowColor = 'rgba(80,220,255,0.72)';
        ctx.shadowBlur = 14;
        rounded(ctx, x + 1, itemY + 1, itemW - 2, itemH - 2, 12);
        ctx.strokeStyle = 'rgba(83,216,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowColor = 'transparent';
      }

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

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(1,3,15,0.76)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();

    if (this.phase === 'confirm') this.drawConfirmModal(ctx);
    else if (this.phase === 'rates') this.drawRatesModal(ctx);
    else if (this.phase === 'history') this.drawHistoryModal(ctx);
    else if (this.phase === 'message') this.drawMessageModal(ctx);
  }

  private drawModalShell(ctx: CanvasRenderingContext2D, rect: Rect, title: string, icon = faWandSparkles): void {
    this.modalRect = rect;
    ctx.save();
    ctx.shadowColor = 'rgba(85,208,255,0.35)';
    ctx.shadowBlur = 24;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 17);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, 'rgba(27,32,74,0.99)');
    fill.addColorStop(0.5, 'rgba(13,16,45,0.99)');
    fill.addColorStop(1, 'rgba(6,9,28,0.99)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e7bd56';
    ctx.lineWidth = 3;
    ctx.stroke();
    rounded(ctx, rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14, 12);
    ctx.strokeStyle = 'rgba(111,220,255,0.36)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(53,28,91,0.9)';
    rounded(ctx, rect.x + 14, rect.y + 14, rect.w - 28, 60, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(231,189,86,0.7)';
    ctx.stroke();
    drawIcon(ctx, icon, rect.x + 34, rect.y + 30, 25, '#69e1ff');
    drawText(ctx, title, rect.x + rect.w / 2, rect.y + 28, {
      align: 'center',
      color: '#ffe690',
      font: `bold 23px ${UI_FONT}`,
      shadow: true,
    });
    ctx.restore();
  }

  private drawModalClose(ctx: CanvasRenderingContext2D, rect: Rect): void {
    this.modalCloseRect = rect;
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 9);
    ctx.fillStyle = '#243459';
    ctx.fill();
    ctx.strokeStyle = '#c6d5f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawIcon(ctx, faXmark, rect.x + (rect.w - 20) / 2, rect.y + (rect.h - 20) / 2, 20, '#ffffff');
    ctx.restore();
  }

  private drawConfirmModal(ctx: CanvasRenderingContext2D): void {
    const portrait = isPortrait();
    const rect = portrait
      ? { x: 28, y: 300, w: view.w - 56, h: 360 }
      : { x: 260, y: 112, w: 440, h: 390 };
    this.drawModalShell(ctx, rect, '召喚確認');
    const state = requireState(this.app);
    const cost = this.confirmCount === 1 ? SINGLE_COST : MULTI_COST;
    const label = this.confirmCount === 1 ? '1回召喚' : '10回召喚';

    drawText(ctx, label, rect.x + rect.w / 2, rect.y + 102, {
      align: 'center',
      color: '#ffffff',
      font: `bold 27px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, '以下のオーブを使用します', rect.x + rect.w / 2, rect.y + 148, {
      align: 'center',
      color: '#cbd6ee',
      font: `bold 14px ${UI_FONT}`,
    });
    drawIcon(ctx, faGem, rect.x + rect.w / 2 - 54, rect.y + 187, 34, '#61ddff');
    drawText(ctx, String(cost), rect.x + rect.w / 2 + 24, rect.y + 183, {
      align: 'center',
      color: '#ffe471',
      font: `bold 34px ${UI_FONT}`,
    });
    drawText(ctx, `所持 ${state.orbs}  →  ${state.orbs - cost}`, rect.x + rect.w / 2, rect.y + 232, {
      align: 'center',
      color: '#e7edf9',
      font: `bold 15px ${UI_FONT}`,
    });

    const gap = 12;
    const buttonW = (rect.w - 50 - gap) / 2;
    this.confirmCancelRect = { x: rect.x + 25, y: rect.y + rect.h - 82, w: buttonW, h: 56 };
    this.confirmDrawRect = { x: rect.x + 25 + buttonW + gap, y: rect.y + rect.h - 82, w: buttonW, h: 56 };
    this.drawModalAction(ctx, this.confirmCancelRect, 'やめる', false, faXmark);
    this.drawModalAction(ctx, this.confirmDrawRect, '召喚する', true, faCheck);
  }

  private drawModalAction(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    label: string,
    primary: boolean,
    icon: typeof faCheck,
  ): void {
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 10);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, primary ? '#8f3fc0' : '#3c4c6e');
    fill.addColorStop(1, primary ? '#40196c' : '#18243f');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = primary ? '#f2ca61' : '#9fb3d7';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawIcon(ctx, icon, rect.x + 18, rect.y + (rect.h - 20) / 2, 20, primary ? '#ffe77c' : '#d4def2');
    drawText(ctx, label, rect.x + rect.w / 2 + 10, rect.y + rect.h / 2 - 10, {
      align: 'center',
      color: '#ffffff',
      font: `bold 15px ${UI_FONT}`,
      shadow: true,
    });
    ctx.restore();
  }

  private drawRatesModal(ctx: CanvasRenderingContext2D): void {
    const portrait = isPortrait();
    const rect = portrait
      ? { x: 24, y: 165, w: view.w - 48, h: 676 }
      : { x: 230, y: 58, w: 500, h: 520 };
    this.drawModalShell(ctx, rect, '提供割合', faCircleInfo);
    this.drawModalClose(ctx, { x: rect.x + rect.w - 70, y: rect.y + 16, w: 56, h: 56 });

    drawText(ctx, 'レアリティ別 提供割合', rect.x + 26, rect.y + 92, {
      color: '#f2f5ff',
      font: `bold 16px ${UI_FONT}`,
    });
    const rowY = rect.y + 128;
    const rowH = portrait ? 68 : 52;
    RANK_RATES.forEach((rate, index) => {
      const y = rowY + index * rowH;
      rounded(ctx, rect.x + 22, y, rect.w - 44, rowH - 10, 9);
      ctx.fillStyle = index % 2 === 0 ? 'rgba(85,104,160,0.18)' : 'rgba(140,67,168,0.15)';
      ctx.fill();
      const stars = '★'.repeat(rankStars(rate.rank));
      drawText(ctx, stars, rect.x + 42, y + (portrait ? 14 : 9), {
        color: RANK_COLORS[rate.rank],
        font: `bold ${portrait ? 18 : 16}px ${UI_FONT}`,
        shadow: true,
      });
      drawText(ctx, `${rate.weight.toFixed(1)}%`, rect.x + rect.w - 42, y + (portrait ? 12 : 7), {
        align: 'right',
        color: '#ffffff',
        font: `bold ${portrait ? 20 : 18}px ${UI_FONT}`,
      });
    });

    const noteY = rowY + RANK_RATES.length * rowH + 16;
    drawIcon(ctx, faStar, rect.x + 28, noteY + 2, 19, '#ffd35f');
    drawText(ctx, '10回召喚は★4以上が1体確定', rect.x + 56, noteY, {
      color: '#ffe58b',
      font: `bold 15px ${UI_FONT}`,
    });
    drawText(ctx, '同一レアリティ内では各モンスター均等です。', rect.x + 28, noteY + 34, {
      color: '#bfcbe2',
      font: `15px ${UI_FONT}`,
    });
  }

  private drawHistoryModal(ctx: CanvasRenderingContext2D): void {
    const portrait = isPortrait();
    const rect = portrait
      ? { x: 24, y: 150, w: view.w - 48, h: 704 }
      : { x: 205, y: 48, w: 550, h: 536 };
    this.drawModalShell(ctx, rect, '召喚履歴', faClockRotateLeft);
    this.drawModalClose(ctx, { x: rect.x + rect.w - 70, y: rect.y + 16, w: 56, h: 56 });

    if (this.recentResults.length === 0) {
      drawIcon(ctx, faTicket, rect.x + rect.w / 2 - 34, rect.y + 180, 68, '#7184aa', 0.72);
      drawText(ctx, 'まだ召喚履歴はありません', rect.x + rect.w / 2, rect.y + 278, {
        align: 'center',
        color: '#c5cee1',
        font: `bold 16px ${UI_FONT}`,
      });
      return;
    }

    drawText(ctx, '直近の召喚結果', rect.x + 26, rect.y + 92, {
      color: '#eaf0ff',
      font: `bold 15px ${UI_FONT}`,
    });
    const entries = this.recentResults.slice(0, portrait ? 10 : 8);
    const columns = portrait ? 2 : 4;
    const gap = 10;
    const cardW = (rect.w - 48 - gap * (columns - 1)) / columns;
    const cardH = portrait ? 101 : 170;
    const startY = rect.y + 126;
    entries.forEach((result, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const card = { x: rect.x + 24 + col * (cardW + gap), y: startY + row * (cardH + gap), w: cardW, h: cardH };
      this.drawHistoryCard(ctx, card, result, portrait);
    });
  }

  private drawHistoryCard(ctx: CanvasRenderingContext2D, rect: Rect, result: PullResult, compact: boolean): void {
    const stars = rankStars(result.species.rank);
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 9);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, `${RANK_COLORS[result.species.rank]}44`);
    fill.addColorStop(1, 'rgba(7,12,31,0.96)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = RANK_COLORS[result.species.rank];
    ctx.lineWidth = stars >= 5 ? 2.5 : 1.3;
    ctx.stroke();

    ctx.save();
    rounded(ctx, rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6, 7);
    ctx.clip();
    const portraitSize = rect.h - 6;
    const drewPortrait = this.drawFamilyPortrait(
      ctx,
      result.species.family,
      { x: rect.x + 3, y: rect.y + 3, w: portraitSize, h: portraitSize },
      0.94,
    );
    if (!drewPortrait) {
      drawMonster(ctx, result.species.family, result.species.palette, rect.x + 16, rect.y + 16, compact ? 4 : 5);
    }
    const fade = ctx.createLinearGradient(rect.x + portraitSize * 0.54, 0, rect.x + rect.w * 0.7, 0);
    fade.addColorStop(0, 'rgba(7,12,31,0)');
    fade.addColorStop(1, 'rgba(7,12,31,0.96)');
    ctx.fillStyle = fade;
    ctx.fillRect(rect.x + portraitSize * 0.45, rect.y + 3, rect.w - portraitSize * 0.42, rect.h - 6);
    ctx.restore();

    this.drawSpeciesBadge(ctx, result.species, {
      x: rect.x + 7,
      y: rect.y + 7,
      w: compact ? 30 : 36,
      h: compact ? 30 : 36,
    });
    const textX = rect.x + portraitSize + (rect.w - portraitSize) / 2;
    drawText(ctx, '★'.repeat(stars), textX, rect.y + (compact ? 24 : 48), {
      align: 'center',
      color: RANK_COLORS[result.species.rank],
      font: `bold ${compact ? 12 : 13}px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, result.species.name, textX, rect.y + (compact ? 51 : 84), {
      align: 'center',
      color: '#ffffff',
      font: `bold ${compact ? 14 : 15}px ${UI_FONT}`,
      shadow: true,
    });
    ctx.restore();
  }

  private drawFamilyPortrait(
    ctx: CanvasRenderingContext2D,
    family: Family,
    rect: Rect,
    alpha = 1,
  ): boolean {
    const portrait = FAMILY_PORTRAITS[family];
    if (!imageReady(portrait.image)) return false;

    const gutter = portrait.image.naturalWidth * 0.046;
    const cellW = (portrait.image.naturalWidth - gutter) / 2;
    const cellH = (portrait.image.naturalHeight - gutter) / 2;
    const sourceX = portrait.column * (cellW + gutter);
    const sourceY = portrait.row * (cellH + gutter);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(portrait.image, sourceX, sourceY, cellW, cellH, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    return true;
  }

  private drawSpeciesBadge(ctx: CanvasRenderingContext2D, species: SpeciesDef, rect: Rect): void {
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(9, rect.w * 0.24));
    ctx.fillStyle = 'rgba(4,9,27,0.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(234,205,116,0.78)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const scale = Math.max(1, Math.floor((Math.min(rect.w, rect.h) - 6) / 16));
    const size = 16 * scale;
    drawMonster(
      ctx,
      species.family,
      species.palette,
      rect.x + (rect.w - size) / 2,
      rect.y + (rect.h - size) / 2,
      scale,
    );
    ctx.restore();
  }

  private drawMessageModal(ctx: CanvasRenderingContext2D): void {
    const rect = isPortrait()
      ? { x: 28, y: 362, w: view.w - 56, h: 244 }
      : { x: 260, y: 185, w: 440, h: 250 };
    this.drawModalShell(ctx, rect, 'お知らせ', faCircleInfo);
    drawText(ctx, this.message, rect.x + rect.w / 2, rect.y + 112, {
      align: 'center',
      color: '#f4f7ff',
      font: `bold 15px ${UI_FONT}`,
    });
    drawText(ctx, 'タップして閉じる', rect.x + rect.w / 2, rect.y + rect.h - 48, {
      align: 'center',
      color: '#aebbd5',
      font: `12px ${UI_FONT}`,
    });
  }

  private drawRevealBackground(ctx: CanvasRenderingContext2D): void {
    if (imageReady(SUMMON_STAGE)) {
      drawCoverImage(ctx, SUMMON_STAGE, { x: 0, y: 0, w: view.w, h: view.h }, 0.5, 0.48);
    } else {
      drawFancyBg(ctx, 'gacha', this.time);
    }
    const vignette = ctx.createRadialGradient(view.w / 2, view.h * 0.46, 60, view.w / 2, view.h * 0.46, view.h * 0.7);
    vignette.addColorStop(0, 'rgba(31,84,158,0.02)');
    vignette.addColorStop(0.62, 'rgba(11,5,38,0.24)');
    vignette.addColorStop(1, 'rgba(1,3,15,0.9)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  private drawResultHeader(ctx: CanvasRenderingContext2D, title: string): void {
    const rect = { x: isPortrait() ? 46 : 290, y: 24, w: isPortrait() ? view.w - 92 : 380, h: 58 };
    this.drawTitlePlaque(ctx, rect);
    drawText(ctx, title, rect.x + rect.w / 2, rect.y + 13, {
      align: 'center',
      color: '#ffec9d',
      font: `bold 25px ${UI_FONT}`,
      shadow: true,
    });
  }

  private drawSingle(ctx: CanvasRenderingContext2D): void {
    const result = this.results[0];
    if (!result) return;
    this.drawResultHeader(ctx, '召喚結果');
    const portrait = isPortrait();
    const cx = view.w / 2;
    const cy = portrait ? 435 : 310;

    if (this.revealT < SINGLE_DELAY) {
      this.drawSummonCharge(ctx, cx, cy);
      return;
    }

    const stars = rankStars(result.species.rank);
    const revealAge = this.revealT - SINGLE_DELAY;
    const scaleIn = Math.min(1, revealAge * 4.4);
    const card = portrait
      ? { x: 48, y: 122, w: view.w - 96, h: 704 }
      : { x: 250, y: 94, w: 460, h: 454 };
    this.drawResultCardFrame(ctx, card, result.species.rank, stars >= 5);

    this.drawRarityRays(ctx, card.x + card.w / 2, card.y + card.h * 0.42, stars);
    const bounce = Math.sin(this.time * 3.2) * 5;
    const artSize = portrait ? 300 : 248;
    const artCenterY = portrait ? card.y + 238 : card.y + 174;
    ctx.save();
    ctx.globalAlpha = Math.min(1, revealAge * 5);
    ctx.translate(cx, artCenterY + bounce);
    ctx.scale(scaleIn, scaleIn);
    const artRect = { x: -artSize / 2, y: -artSize / 2, w: artSize, h: artSize };
    ctx.save();
    rounded(ctx, artRect.x, artRect.y, artRect.w, artRect.h, 18);
    ctx.clip();
    const drewPortrait = this.drawFamilyPortrait(
      ctx,
      result.species.family,
      artRect,
    );
    if (!drewPortrait) {
      const spriteScale = portrait ? 13 : 11;
      const spriteSize = spriteScale * 16;
      drawMonster(
        ctx,
        result.species.family,
        result.species.palette,
        -spriteSize / 2,
        -spriteSize / 2,
        spriteScale,
      );
    }
    const edge = 34;
    const edgeColor = 'rgba(6,9,28,0.94)';
    const clearEdge = 'rgba(6,9,28,0)';
    const topFade = ctx.createLinearGradient(0, artRect.y, 0, artRect.y + edge);
    topFade.addColorStop(0, edgeColor);
    topFade.addColorStop(1, clearEdge);
    ctx.fillStyle = topFade;
    ctx.fillRect(artRect.x, artRect.y, artRect.w, edge);
    const bottomFade = ctx.createLinearGradient(0, artRect.y + artRect.h - edge, 0, artRect.y + artRect.h);
    bottomFade.addColorStop(0, clearEdge);
    bottomFade.addColorStop(1, edgeColor);
    ctx.fillStyle = bottomFade;
    ctx.fillRect(artRect.x, artRect.y + artRect.h - edge, artRect.w, edge);
    const leftFade = ctx.createLinearGradient(artRect.x, 0, artRect.x + edge, 0);
    leftFade.addColorStop(0, edgeColor);
    leftFade.addColorStop(1, clearEdge);
    ctx.fillStyle = leftFade;
    ctx.fillRect(artRect.x, artRect.y, edge, artRect.h);
    const rightFade = ctx.createLinearGradient(artRect.x + artRect.w - edge, 0, artRect.x + artRect.w, 0);
    rightFade.addColorStop(0, clearEdge);
    rightFade.addColorStop(1, edgeColor);
    ctx.fillStyle = rightFade;
    ctx.fillRect(artRect.x + artRect.w - edge, artRect.y, edge, artRect.h);
    ctx.restore();

    ctx.shadowColor = stars >= 5 ? RANK_COLORS[result.species.rank] : 'rgba(95,218,255,0.45)';
    ctx.shadowBlur = stars >= 5 ? 18 : 8;
    rounded(ctx, artRect.x, artRect.y, artRect.w, artRect.h, 18);
    ctx.strokeStyle = stars >= 5 ? '#f2ce63' : '#8ecbec';
    ctx.lineWidth = stars >= 5 ? 3.5 : 2;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    rounded(ctx, artRect.x + 7, artRect.y + 7, artRect.w - 14, artRect.h - 14, 13);
    ctx.strokeStyle = `${RANK_COLORS[result.species.rank]}aa`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    this.drawSpeciesBadge(ctx, result.species, {
      x: card.x + card.w - (portrait ? 76 : 66),
      y: card.y + (portrait ? 92 : 72),
      w: portrait ? 56 : 48,
      h: portrait ? 56 : 48,
    });

    drawText(ctx, '★'.repeat(stars), cx, portrait ? card.y + 396 : card.y + 302, {
      align: 'center',
      color: RANK_COLORS[result.species.rank],
      font: `bold ${portrait ? 29 : 25}px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, result.species.name, cx, portrait ? card.y + 448 : card.y + 345, {
      align: 'center',
      color: '#ffffff',
      font: `bold ${portrait ? 30 : 27}px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, `Lv${result.level}`, cx, portrait ? card.y + 497 : card.y + 384, {
      align: 'center',
      color: '#cfe0ff',
      font: `bold 16px ${UI_FONT}`,
    });
    this.drawOutcomePanel(ctx, {
      x: card.x + 34,
      y: portrait ? card.y + 548 : card.y + 414,
      w: card.w - 68,
      h: portrait ? 92 : 0,
    }, result);
    drawText(ctx, 'タップで戻る', cx, portrait ? 866 : 576, {
      align: 'center',
      color: '#d5def1',
      font: `bold 14px ${UI_FONT}`,
      shadow: true,
    });

    if (revealAge < 0.32) {
      ctx.save();
      ctx.globalAlpha = 1 - revealAge / 0.32;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.restore();
    }
  }

  private drawSummonCharge(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const progress = Math.min(1, this.revealT / SINGLE_DELAY);
    const pulse = 1 + Math.sin(this.time * 10) * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.time * 0.5);
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12);
      const ray = ctx.createLinearGradient(0, -28, 0, -340);
      ray.addColorStop(0, `rgba(105,229,255,${0.18 + progress * 0.18})`);
      ray.addColorStop(1, 'rgba(117,76,255,0)');
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(-10, -25);
      ctx.lineTo(-42, -330);
      ctx.lineTo(42, -330);
      ctx.lineTo(10, -25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#75eaff';
    ctx.shadowBlur = 36 + progress * 38;
    drawIcon(ctx, faGem, cx - 68 * pulse, cy - 68 * pulse, 136 * pulse, '#6be7ff');
    ctx.restore();
    drawText(ctx, '召喚の扉が開く…', cx, cy + 112, {
      align: 'center',
      color: '#fff0a0',
      font: `bold 19px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, 'タップで演出をスキップ', cx, view.h - 74, {
      align: 'center',
      color: '#c0cbe2',
      font: `12px ${UI_FONT}`,
    });
  }

  private drawRarityRays(ctx: CanvasRenderingContext2D, cx: number, cy: number, stars: number): void {
    if (stars < 4) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.time * 0.35);
    const count = stars >= 6 ? 14 : 10;
    for (let i = 0; i < count; i++) {
      ctx.rotate((Math.PI * 2) / count);
      ctx.fillStyle = stars >= 6 ? 'rgba(255,220,105,0.13)' : 'rgba(100,219,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.lineTo(-32, -205);
      ctx.lineTo(32, -205);
      ctx.lineTo(11, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawResultCardFrame(ctx: CanvasRenderingContext2D, rect: Rect, rank: SpeciesDef['rank'], rare: boolean): void {
    ctx.save();
    ctx.shadowColor = rare ? RANK_COLORS[rank] : 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = rare ? 26 + Math.sin(this.time * 4) * 5 : 15;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 18);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, `${RANK_COLORS[rank]}4d`);
    fill.addColorStop(0.48, 'rgba(15,18,53,0.72)');
    fill.addColorStop(1, 'rgba(4,8,26,0.96)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = rare ? '#f3cf61' : '#9fc9ee';
    ctx.lineWidth = rare ? 4 : 2.5;
    ctx.stroke();
    rounded(ctx, rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16, 13);
    ctx.strokeStyle = `${RANK_COLORS[rank]}aa`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawOutcomePanel(ctx: CanvasRenderingContext2D, rect: Rect, result: PullResult): void {
    if (rect.h <= 0) return;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fillStyle = 'rgba(4,10,30,0.76)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(159,200,238,0.46)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    const isLuck = result.kind === 'luck';
    const title = isLuck ? 'ラックアップ' : result.kind === 'party' ? 'パーティ加入' : 'ボックスへ送信';
    const note = isLuck ? `ラックが ${result.luck} になりました` : `Lv${result.level} で仲間になりました`;
    drawIcon(ctx, isLuck ? faWandSparkles : faCheck, rect.x + 25, rect.y + 19, 24, isLuck ? '#6cf2a5' : '#69ddff');
    drawText(ctx, title, rect.x + 62, rect.y + 15, {
      color: isLuck ? '#83f0ad' : '#f7e18a',
      font: `bold 17px ${UI_FONT}`,
    });
    drawText(ctx, note, rect.x + 62, rect.y + 49, {
      color: '#d3dced',
      font: `13px ${UI_FONT}`,
    });
  }

  private drawMulti(ctx: CanvasRenderingContext2D): void {
    this.drawResultHeader(ctx, '10回召喚結果');
    const portrait = isPortrait();
    const columns = portrait ? 2 : 5;
    const gap = portrait ? 12 : 10;
    const margin = portrait ? 20 : 34;
    const availableW = view.w - margin * 2;
    const cardW = (availableW - gap * (columns - 1)) / columns;
    const cardH = portrait ? 154 : 188;
    const startY = portrait ? 106 : 104;

    let bestIdx = 0;
    this.results.forEach((result, index) => {
      if (rankStars(result.species.rank) > rankStars(this.results[bestIdx]!.species.rank)) bestIdx = index;
    });

    this.results.forEach((result, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const rect = {
        x: margin + col * (cardW + gap),
        y: startY + row * (cardH + gap),
        w: cardW,
        h: cardH,
      };
      const revealed = this.revealT >= SINGLE_DELAY + index * MULTI_STEP;
      this.drawMultiCard(ctx, rect, result, revealed, index === bestIdx);
    });

    const fullReveal = SINGLE_DELAY + MULTI_COUNT * MULTI_STEP;
    const allRevealed = this.revealT >= fullReveal;
    const footerY = portrait ? 950 : 552;
    drawText(ctx, allRevealed ? 'タップで戻る' : 'タップで一気に開封', view.w / 2, footerY, {
      align: 'center',
      color: '#eef2ff',
      font: `bold 15px ${UI_FONT}`,
      shadow: true,
    });
  }

  private drawMultiCard(ctx: CanvasRenderingContext2D, rect: Rect, result: PullResult, revealed: boolean, best: boolean): void {
    const stars = rankStars(result.species.rank);
    ctx.save();
    ctx.shadowColor = revealed && best && stars >= 4 ? RANK_COLORS[result.species.rank] : 'rgba(0,0,0,0.64)';
    ctx.shadowBlur = revealed && best && stars >= 4 ? 22 + Math.sin(this.time * 5) * 4 : 8;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 11);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    if (revealed) {
      fill.addColorStop(0, `${RANK_COLORS[result.species.rank]}55`);
      fill.addColorStop(0.5, 'rgba(18,22,59,0.96)');
      fill.addColorStop(1, 'rgba(5,10,28,0.98)');
    } else {
      fill.addColorStop(0, '#35225e');
      fill.addColorStop(1, '#0a1233');
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = revealed ? (best && stars >= 4 ? '#f2cd61' : RANK_COLORS[result.species.rank]) : '#6a77a0';
    ctx.lineWidth = revealed && best && stars >= 4 ? 3 : 1.5;
    ctx.stroke();
    rounded(ctx, rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (!revealed) {
      const pulse = 0.62 + Math.sin(this.time * 5 + rect.x * 0.01) * 0.16;
      drawIcon(ctx, faGem, rect.x + rect.w / 2 - 27, rect.y + rect.h / 2 - 34, 54, '#71dcff', pulse);
      drawText(ctx, '未開封', rect.x + rect.w / 2, rect.y + rect.h - 37, {
        align: 'center',
        color: '#aebbd4',
        font: `bold 14px ${UI_FONT}`,
      });
      ctx.restore();
      return;
    }

    ctx.save();
    rounded(ctx, rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6, 8);
    ctx.clip();
    const artSize = isPortrait() ? rect.h + 22 : Math.min(rect.w + 12, rect.h - 12);
    const drewPortrait = this.drawFamilyPortrait(
      ctx,
      result.species.family,
      {
        x: rect.x + (rect.w - artSize) / 2,
        y: rect.y - (isPortrait() ? 12 : 1),
        w: artSize,
        h: artSize,
      },
      0.98,
    );
    if (!drewPortrait) {
      const spriteScale = isPortrait() ? 6 : 5;
      const spriteSize = spriteScale * 16;
      drawMonster(
        ctx,
        result.species.family,
        result.species.palette,
        rect.x + rect.w / 2 - spriteSize / 2,
        rect.y + 10,
        spriteScale,
      );
    }
    const contentShade = ctx.createLinearGradient(0, rect.y + rect.h * 0.48, 0, rect.y + rect.h);
    contentShade.addColorStop(0, 'rgba(5,9,28,0)');
    contentShade.addColorStop(0.5, 'rgba(5,9,28,0.68)');
    contentShade.addColorStop(1, 'rgba(3,7,22,0.98)');
    ctx.fillStyle = contentShade;
    ctx.fillRect(rect.x + 3, rect.y + rect.h * 0.42, rect.w - 6, rect.h * 0.58);
    ctx.restore();
    this.drawSpeciesBadge(ctx, result.species, {
      x: rect.x + 8,
      y: rect.y + 8,
      w: isPortrait() ? 42 : 38,
      h: isPortrait() ? 42 : 38,
    });
    drawText(ctx, '★'.repeat(stars), rect.x + rect.w / 2, rect.y + (isPortrait() ? 98 : 94), {
      align: 'center',
      color: RANK_COLORS[result.species.rank],
      font: `bold ${isPortrait() ? 15 : 13}px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, result.species.name, rect.x + rect.w / 2, rect.y + (isPortrait() ? 122 : 119), {
      align: 'center',
      color: '#ffffff',
      font: `bold ${isPortrait() ? 15 : 13}px ${UI_FONT}`,
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

function beveledPath(ctx: CanvasRenderingContext2D, rect: Rect, cut: number): void {
  ctx.beginPath();
  ctx.moveTo(rect.x + cut, rect.y);
  ctx.lineTo(rect.x + rect.w - cut, rect.y);
  ctx.lineTo(rect.x + rect.w, rect.y + cut);
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h - cut);
  ctx.lineTo(rect.x + rect.w - cut, rect.y + rect.h);
  ctx.lineTo(rect.x + cut, rect.y + rect.h);
  ctx.lineTo(rect.x, rect.y + rect.h - cut);
  ctx.lineTo(rect.x, rect.y + cut);
  ctx.closePath();
}

function shieldPath(ctx: CanvasRenderingContext2D, rect: Rect): void {
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.w * 0.22, rect.y);
  ctx.lineTo(rect.x + rect.w * 0.78, rect.y);
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h * 0.18);
  ctx.lineTo(rect.x + rect.w * 0.9, rect.y + rect.h * 0.76);
  ctx.lineTo(rect.x + rect.w * 0.5, rect.y + rect.h);
  ctx.lineTo(rect.x + rect.w * 0.1, rect.y + rect.h * 0.76);
  ctx.lineTo(rect.x, rect.y + rect.h * 0.18);
  ctx.closePath();
}
