// ============================================================
// ホームシーン — モバイル向けソーシャルゲームUI
// ============================================================
import {
  faBars,
  faBolt,
  faCoins,
  faCompass,
  faDragon,
  faGem,
  faGift,
  faHouse,
  faStar,
  faTicket,
} from '@fortawesome/free-solid-svg-icons';
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { MonsterInstance } from '../core/types';
import { getItem } from '../data/items';
import { getSpecies } from '../data/monsters';
import { maxStats } from '../game/monster';
import { saveGame } from '../game/save';
import { consumeItem, healParty } from '../game/state';
import { drawFancyBg } from '../ui/bg';
import { monsterLabel, monsterNote } from '../ui/format';
import { drawIcon } from '../ui/icon';
import { createImageAsset, drawContainImage, drawCoverImage, imageReady } from '../ui/media';
import { drawMonster } from '../ui/sprites';
import {
  drawGauge,
  drawText,
  inRect,
  isPortrait,
  Menu,
  MessageBox,
  view,
  type Rect,
} from '../ui/window';
import { MonsterBoxScene } from './box';
import { DexScene } from './dex';
import { GachaScene } from './gacha';
import { QuestHubScene } from './questHub';
import { ShopScene } from './shop';
import { StatusScene } from './status';

type Phase = 'main' | 'moreMenu' | 'itemPick' | 'itemTarget' | 'message';
type MainFocus = 'cta' | 'event' | 'mission' | 'nav';

const HERO_IMAGE = createImageAsset(new URL('../assets/home/home-hero.webp', import.meta.url).href);
const EVENT_IMAGE = createImageAsset(new URL('../assets/home/event-banner.webp', import.meta.url).href);
const LOGO_IMAGE = createImageAsset(new URL('../assets/home/logo.png', import.meta.url).href);

const NAV_ITEMS = [
  { label: 'ホーム', icon: faHouse },
  { label: 'クエスト', icon: faCompass },
  { label: 'ガチャ', icon: faTicket },
  { label: 'モンスター', icon: faDragon },
  { label: 'メニュー', icon: faBars },
] as const;

const FOCUS_ORDER: MainFocus[] = ['cta', 'event', 'mission', 'nav'];
const UI_FONT = '"Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

export class HomeScene implements Scene {
  private phase: Phase = 'main';
  private focus: MainFocus = 'cta';
  private navCursor = 0;
  private heroRect: Rect | null = null;
  private ctaRect: Rect | null = null;
  private eventRect: Rect | null = null;
  private missionRect: Rect | null = null;
  private navRects: Rect[] = [];
  private overlayRect: Rect | null = null;
  private moreMenu = new Menu([
    { label: 'どうぐ' },
    { label: 'ショップ' },
    { label: 'パーティを ぜんかいふく' },
    { label: 'モンスターずかん' },
    { label: 'セーブ' },
  ]);
  private itemMenu = new Menu([]);
  private targetMenu = new Menu([]);
  private messages = new MessageBox();
  private selectedItemId: string | null = null;
  private time = 0;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
    this.phase = 'main';
  }

  update(dt: number): void {
    this.time += dt;
    this.messages.update(dt);
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;

    switch (this.phase) {
      case 'main':
        this.updateMain(tap, key);
        break;
      case 'moreMenu':
        if (tap) {
          const index = this.moreMenu.itemAt(tap.x, tap.y);
          if (index !== null) {
            this.moreMenu.setCursor(index);
            this.activateMoreMenu(index);
          } else if (this.tapOutsideOverlay(tap.x, tap.y)) {
            this.phase = 'main';
          }
          break;
        }
        if (!key) break;
        {
          const result = this.moreMenu.handleKey(key);
          if (result === 'cancel') this.phase = 'main';
          else if (result === 'select') this.activateMoreMenu(this.moreMenu.cursor);
        }
        break;
      case 'itemPick':
        if (tap) {
          const index = this.itemMenu.itemAt(tap.x, tap.y);
          if (index !== null) {
            this.itemMenu.setCursor(index);
            this.pickItem(index);
          } else if (this.tapOutsideOverlay(tap.x, tap.y)) {
            this.openMoreMenu();
          }
          break;
        }
        if (!key) break;
        {
          const result = this.itemMenu.handleKey(key);
          if (result === 'cancel') this.openMoreMenu();
          else if (result === 'select') this.pickItem(this.itemMenu.cursor);
        }
        break;
      case 'itemTarget':
        if (tap) {
          const index = this.targetMenu.itemAt(tap.x, tap.y);
          if (index !== null) {
            this.targetMenu.setCursor(index);
            this.applyItem(index);
          } else if (this.tapOutsideOverlay(tap.x, tap.y)) {
            this.phase = 'itemPick';
          }
          break;
        }
        if (!key) break;
        {
          const result = this.targetMenu.handleKey(key);
          if (result === 'cancel') this.phase = 'itemPick';
          else if (result === 'select') this.applyItem(this.targetMenu.cursor);
        }
        break;
      case 'message':
        if (tap || key === 'confirm' || key === 'cancel') {
          if (this.messages.advance()) this.phase = 'main';
        }
        break;
    }
  }

  private updateMain(
    tap: { x: number; y: number } | null,
    key: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'menu' | null,
  ): void {
    const state = requireState(this.app);
    if (tap) {
      if (this.ctaRect && inRect(tap.x, tap.y, this.ctaRect)) {
        this.focus = 'cta';
        this.app.scenes.push(new QuestHubScene(this.app));
        return;
      }
      if (this.eventRect && inRect(tap.x, tap.y, this.eventRect)) {
        this.focus = 'event';
        this.app.scenes.push(new QuestHubScene(this.app));
        return;
      }
      if (this.missionRect && inRect(tap.x, tap.y, this.missionRect)) {
        this.focus = 'mission';
        this.showMissionMessage();
        return;
      }
      for (let i = 0; i < this.navRects.length; i++) {
        if (!inRect(tap.x, tap.y, this.navRects[i]!)) continue;
        this.focus = 'nav';
        this.navCursor = i;
        this.activateNav(i);
        return;
      }
      if (this.heroRect && inRect(tap.x, tap.y, this.heroRect)) {
        const lead = state.party[0];
        if (lead) this.app.scenes.push(new StatusScene(this.app, lead));
      }
      return;
    }

    if (!key) return;
    if (key === 'menu') {
      this.openMoreMenu();
      return;
    }
    if (this.focus === 'nav' && (key === 'left' || key === 'right')) {
      const delta = key === 'left' ? -1 : 1;
      this.navCursor = (this.navCursor + NAV_ITEMS.length + delta) % NAV_ITEMS.length;
      return;
    }
    if (key === 'up' || key === 'down') {
      const current = FOCUS_ORDER.indexOf(this.focus);
      const delta = key === 'up' ? -1 : 1;
      this.focus = FOCUS_ORDER[(current + FOCUS_ORDER.length + delta) % FOCUS_ORDER.length]!;
      return;
    }
    if (key === 'confirm') this.activateFocus();
  }

  private activateFocus(): void {
    switch (this.focus) {
      case 'cta':
      case 'event':
        this.app.scenes.push(new QuestHubScene(this.app));
        break;
      case 'mission':
        this.showMissionMessage();
        break;
      case 'nav':
        this.activateNav(this.navCursor);
        break;
    }
  }

  private activateNav(index: number): void {
    switch (index) {
      case 0:
        break;
      case 1:
        this.app.scenes.push(new QuestHubScene(this.app));
        break;
      case 2:
        this.app.scenes.push(new GachaScene(this.app));
        break;
      case 3:
        this.app.scenes.push(new MonsterBoxScene(this.app));
        break;
      case 4:
        this.openMoreMenu();
        break;
    }
  }

  private openMoreMenu(): void {
    this.moreMenu.reset();
    this.phase = 'moreMenu';
  }

  private activateMoreMenu(index: number): void {
    const state = requireState(this.app);
    switch (index) {
      case 0:
        this.buildItemMenu();
        this.phase = 'itemPick';
        break;
      case 1:
        this.phase = 'main';
        this.app.scenes.push(new ShopScene(this.app));
        break;
      case 2:
        healParty(state);
        this.messages.setPages(['モンスターたちは すっかり げんきに なった!']);
        this.phase = 'message';
        break;
      case 3:
        this.phase = 'main';
        this.app.scenes.push(new DexScene(this.app));
        break;
      case 4: {
        const ok = saveGame(state);
        this.messages.setPages([ok ? 'ぼうけんの きろくを のこした!' : 'セーブに しっぱいした…。']);
        this.phase = 'message';
        break;
      }
    }
  }

  private showMissionMessage(): void {
    const state = requireState(this.app);
    const progress = Math.min(5, 2 + state.clearedStages.length);
    this.messages.setPages([
      `初心者ミッション ${progress}/5\nクエストを進めて 宝箱の報酬を受け取ろう!`,
    ]);
    this.phase = 'message';
  }

  private tapOutsideOverlay(px: number, py: number): boolean {
    return this.overlayRect !== null && !inRect(px, py, this.overlayRect);
  }

  private pickItem(index: number): void {
    const ids = this.itemIds();
    const itemId = ids[index];
    if (!itemId) return;
    const item = getItem(itemId);
    this.selectedItemId = itemId;
    this.buildTargetMenu(item.effect.kind === 'revive');
    this.phase = 'itemTarget';
  }

  private applyItem(index: number): void {
    const state = requireState(this.app);
    const target = state.party[index];
    if (!target || !this.selectedItemId || this.targetMenu.items[index]?.disabled) return;
    this.useItem(this.selectedItemId, target);
  }

  private itemIds(): string[] {
    const state = requireState(this.app);
    return Object.keys(state.items).filter((id) => (state.items[id] ?? 0) > 0);
  }

  private buildItemMenu(): void {
    const state = requireState(this.app);
    const items = this.itemIds().map((id) => ({ label: getItem(id).name, note: `×${state.items[id]}` }));
    this.itemMenu.setItems(items.length > 0 ? items : [{ label: '(なにも もっていない)', disabled: true }]);
    this.itemMenu.reset();
  }

  private buildTargetMenu(deadOnly: boolean): void {
    const state = requireState(this.app);
    this.targetMenu.setItems(
      state.party.map((monster) => ({
        label: monsterLabel(monster),
        note: monsterNote(monster),
        disabled: deadOnly ? monster.hp > 0 : monster.hp <= 0,
      })),
    );
    this.targetMenu.reset();
  }

  private useItem(itemId: string, target: MonsterInstance): void {
    const state = requireState(this.app);
    const item = getItem(itemId);
    const stats = maxStats(target);
    let text = 'しかし なにも おこらなかった…。';
    switch (item.effect.kind) {
      case 'heal': {
        const healed = Math.min(stats.hp - target.hp, item.effect.power);
        if (healed > 0) {
          consumeItem(state, itemId);
          target.hp += healed;
          text = `${target.nickname}の HPが ${healed}かいふくした!`;
        } else {
          text = `${target.nickname}の HPは まんたんだ!`;
        }
        break;
      }
      case 'mp': {
        const healed = Math.min(stats.mp - target.mp, item.effect.power);
        if (healed > 0) {
          consumeItem(state, itemId);
          target.mp += healed;
          text = `${target.nickname}の MPが ${healed}かいふくした!`;
        } else {
          text = `${target.nickname}の MPは まんたんだ!`;
        }
        break;
      }
      case 'revive':
        if (target.hp <= 0) {
          consumeItem(state, itemId);
          target.hp = Math.max(1, Math.floor(stats.hp * item.effect.ratio));
          text = `${target.nickname}が いきかえった!`;
        }
        break;
    }
    this.messages.setPages([text]);
    this.phase = 'message';
    this.buildItemMenu();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.heroRect = null;
    this.ctaRect = null;
    this.eventRect = null;
    this.missionRect = null;
    this.navRects = [];
    this.overlayRect = null;

    if (isPortrait()) this.drawPortrait(ctx);
    else this.drawLandscape(ctx);

    if (this.phase !== 'main') this.drawOverlay(ctx);
  }

  private drawPortrait(ctx: CanvasRenderingContext2D): void {
    const state = requireState(this.app);
    ctx.fillStyle = '#020616';
    ctx.fillRect(0, 0, view.w, view.h);
    const hero: Rect = { x: 0, y: 40, w: view.w, h: 640 };
    this.drawHero(ctx, hero);
    this.heroRect = { x: 0, y: 132, w: view.w, h: 414 };

    this.drawLogo(ctx, { x: 104, y: 14, w: 272, h: 54 });
    this.drawStatusBar(ctx, 12, 76, view.w - 24, 56);

    const cta: Rect = { x: 48, y: 557, w: 384, h: 100 };
    this.ctaRect = cta;
    this.drawAdventureButton(ctx, cta, this.focus === 'cta' && this.phase === 'main');

    const event: Rect = { x: 16, y: 674, w: view.w - 32, h: 116 };
    this.eventRect = event;
    this.drawEventBanner(ctx, event, this.focus === 'event' && this.phase === 'main');

    const mission: Rect = { x: 16, y: 802, w: view.w - 32, h: 92 };
    this.missionRect = mission;
    this.drawMissionPanel(ctx, mission, this.focus === 'mission' && this.phase === 'main');

    this.drawBottomNav(ctx, { x: 0, y: 906, w: view.w, h: 134 });

    // 状態依存の値を描画に反映させ、未使用扱いにしない。
    void state;
  }

  private drawLandscape(ctx: CanvasRenderingContext2D): void {
    const hero: Rect = { x: 0, y: 0, w: 560, h: view.h };
    this.drawHero(ctx, hero);
    this.heroRect = { x: 0, y: 96, w: 560, h: 404 };
    this.drawLogo(ctx, { x: 108, y: 18, w: 344, h: 64 });

    ctx.fillStyle = '#070c20';
    ctx.fillRect(560, 0, view.w - 560, view.h);
    this.drawStatusBar(ctx, 574, 24, 372, 58);

    const event: Rect = { x: 580, y: 102, w: 360, h: 116 };
    this.eventRect = event;
    this.drawEventBanner(ctx, event, this.focus === 'event' && this.phase === 'main');

    const mission: Rect = { x: 580, y: 234, w: 360, h: 126 };
    this.missionRect = mission;
    this.drawMissionPanel(ctx, mission, this.focus === 'mission' && this.phase === 'main');

    const cta: Rect = { x: 74, y: 506, w: 412, h: 82 };
    this.ctaRect = cta;
    this.drawAdventureButton(ctx, cta, this.focus === 'cta' && this.phase === 'main');
    this.drawBottomNav(ctx, { x: 560, y: 480, w: 400, h: 144 });
  }

  private drawHero(ctx: CanvasRenderingContext2D, rect: Rect): void {
    if (imageReady(HERO_IMAGE)) {
      drawCoverImage(ctx, HERO_IMAGE, rect, 0.5, 0.5);
    } else {
      drawFancyBg(ctx, 'home', this.time);
      const species = getSpecies('puni');
      const scale = isPortrait() ? 14 : 12;
      drawMonster(
        ctx,
        species.family,
        species.palette,
        rect.x + rect.w / 2 - scale * 8,
        rect.y + rect.h / 2 - scale * 5,
        scale,
      );
    }

    const topShade = ctx.createLinearGradient(0, rect.y, 0, rect.y + 190);
    topShade.addColorStop(0, 'rgba(2,6,22,0.94)');
    topShade.addColorStop(0.55, 'rgba(2,6,22,0.35)');
    topShade.addColorStop(1, 'rgba(2,6,22,0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(rect.x, rect.y, rect.w, 190);

    const bottomShade = ctx.createLinearGradient(0, rect.y + rect.h - 170, 0, rect.y + rect.h);
    bottomShade.addColorStop(0, 'rgba(3,8,26,0)');
    bottomShade.addColorStop(1, 'rgba(3,8,26,0.96)');
    ctx.fillStyle = bottomShade;
    ctx.fillRect(rect.x, rect.y + rect.h - 170, rect.w, 170);
  }

  private drawLogo(ctx: CanvasRenderingContext2D, rect: Rect): void {
    if (imageReady(LOGO_IMAGE)) {
      drawContainImage(ctx, LOGO_IMAGE, rect);
      return;
    }
    drawText(ctx, 'RPGTEKINA', rect.x + rect.w / 2, rect.y + 4, {
      align: 'center',
      color: '#ffe79a',
      font: `bold 34px ${UI_FONT}`,
      shadow: true,
    });
  }

  private drawStatusBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const state = requireState(this.app);
    const rank = state.party[0]?.level ?? 1;
    const cellW = w / 4;
    const iconSize = Math.min(25, h - 22);
    const font = `bold ${w < 400 ? 13 : 15}px ${UI_FONT}`;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    rounded(ctx, x, y, w, h, 13);
    ctx.fillStyle = 'rgba(5,10,30,0.91)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(218,183,112,0.68)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * cellW, y + 9);
      ctx.lineTo(x + i * cellW, y + h - 9);
      ctx.strokeStyle = 'rgba(190,204,235,0.24)';
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

  private drawAdventureButton(ctx: CanvasRenderingContext2D, rect: Rect, selected: boolean): void {
    const pulse = 12 + Math.sin(this.time * 2.8) * 4;
    ctx.save();
    ctx.shadowColor = 'rgba(255,190,45,0.9)';
    ctx.shadowBlur = selected ? pulse + 9 : pulse;
    ctx.shadowOffsetY = 3;
    plaquePath(ctx, rect, 0);
    const gold = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    gold.addColorStop(0, '#fffbe0');
    gold.addColorStop(0.18, '#fff08b');
    gold.addColorStop(0.58, '#ffc43b');
    gold.addColorStop(1, '#dc8510');
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#fff2a4';
    ctx.lineWidth = 5;
    ctx.stroke();

    plaquePath(ctx, rect, 8);
    ctx.strokeStyle = selected ? '#fff9c9' : '#9d5a05';
    ctx.lineWidth = selected ? 4 : 3;
    ctx.stroke();

    // 両端の彫金装飾。主文字を邪魔しない細いシェブロンにする。
    ctx.strokeStyle = 'rgba(147,78,0,0.72)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      const offset = i * 10;
      ctx.beginPath();
      ctx.moveTo(rect.x + 31 + offset, rect.y + 28);
      ctx.lineTo(rect.x + 20 + offset, rect.y + rect.h / 2);
      ctx.lineTo(rect.x + 31 + offset, rect.y + rect.h - 28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rect.x + rect.w - 31 - offset, rect.y + 28);
      ctx.lineTo(rect.x + rect.w - 20 - offset, rect.y + rect.h / 2);
      ctx.lineTo(rect.x + rect.w - 31 - offset, rect.y + rect.h - 28);
      ctx.stroke();
    }

    drawPlaqueDiamond(ctx, rect.x + rect.w / 2, rect.y, 12);
    drawPlaqueDiamond(ctx, rect.x + rect.w / 2, rect.y + rect.h, 12);
    drawText(ctx, '冒険をつづける', rect.x + rect.w / 2, rect.y + rect.h / 2 - 18, {
      align: 'center',
      color: '#382000',
      font: `bold ${rect.w < 400 ? 27 : 30}px ${UI_FONT}`,
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
    if (imageReady(HERO_IMAGE)) {
      ctx.drawImage(HERO_IMAGE, 360, 480, 540, 540, x, y, size, size);
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

  private drawEventBanner(ctx: CanvasRenderingContext2D, rect: Rect, selected: boolean): void {
    ctx.save();
    ctx.shadowColor = selected ? 'rgba(102,210,255,0.9)' : 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = selected ? 15 : 8;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 15);
    ctx.clip();
    ctx.fillStyle = '#211148';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    if (imageReady(EVENT_IMAGE)) drawCoverImage(ctx, EVENT_IMAGE, rect, 0.5, 0.5);

    const shade = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w * 0.58, 0);
    shade.addColorStop(0, 'rgba(7,6,35,0.72)');
    shade.addColorStop(1, 'rgba(7,6,35,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();

    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 15);
    ctx.strokeStyle = selected ? '#74e5ff' : '#e7c366';
    ctx.lineWidth = selected ? 4 : 2;
    ctx.stroke();

    ctx.restore();
  }

  private drawMissionPanel(ctx: CanvasRenderingContext2D, rect: Rect, selected: boolean): void {
    const state = requireState(this.app);
    const progress = Math.min(5, 2 + state.clearedStages.length);
    ctx.save();
    ctx.shadowColor = selected ? 'rgba(99,202,255,0.75)' : 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = selected ? 14 : 7;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 15);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, '#192543');
    fill.addColorStop(1, '#0b1228');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = selected ? '#6bdcff' : '#66779d';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();

    const badgeSize = Math.min(74, rect.h - 34);
    const badgeX = rect.x + 18;
    const badgeY = rect.y + (rect.h - badgeSize) / 2;
    ctx.beginPath();
    ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#13234a';
    ctx.fill();
    ctx.strokeStyle = '#8197c4';
    ctx.lineWidth = 3;
    ctx.stroke();
    drawIcon(ctx, faStar, badgeX + 14, badgeY + 13, badgeSize - 28, '#ffd34b');

    const textX = badgeX + badgeSize + 18;
    drawText(ctx, '初心者ミッション', textX, rect.y + 13, {
      color: '#ffd86a',
      font: `bold ${rect.w < 400 ? 18 : 20}px ${UI_FONT}`,
    });
    const giftSize = rect.w < 400 ? 34 : 42;
    const giftX = rect.x + rect.w - giftSize - 18;
    drawIcon(ctx, faGift, giftX, rect.y + rect.h / 2 - giftSize / 2, giftSize, '#f7cf63');

    const gaugeX = textX;
    const gaugeW = Math.max(92, giftX - textX - 42);
    drawGauge(ctx, gaugeX, rect.y + rect.h - 28, gaugeW, 14, progress / 5, '#55d98f');
    drawText(ctx, `${progress}/5`, giftX - 10, rect.y + rect.h - 34, {
      align: 'right',
      color: '#f4f6ff',
      font: `bold 18px ${UI_FONT}`,
    });
    ctx.restore();
  }

  private drawBottomNav(ctx: CanvasRenderingContext2D, rect: Rect): void {
    ctx.save();
    const bg = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    bg.addColorStop(0, '#111c38');
    bg.addColorStop(1, '#060c1c');
    ctx.fillStyle = bg;
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
      const active = index === 0;
      const focused = this.phase === 'main' && this.focus === 'nav' && this.navCursor === index;
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

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    this.dimBackground(ctx);
    const width = Math.min(430, view.w - 30);
    const x = (view.w - width) / 2;
    const y = isPortrait() ? 350 : 92;

    switch (this.phase) {
      case 'moreMenu': {
        const height = this.moreMenu.draw(ctx, x, y, width, 'メニュー');
        this.overlayRect = { x, y, w: width, h: height };
        break;
      }
      case 'itemPick': {
        const height = this.itemMenu.draw(ctx, x, y, width, 'どうぐ');
        this.overlayRect = { x, y, w: width, h: height };
        break;
      }
      case 'itemTarget': {
        const height = this.targetMenu.draw(ctx, x, y, width, 'だれに つかう?');
        this.overlayRect = { x, y, w: width, h: height };
        break;
      }
      case 'message': {
        const margin = isPortrait() ? 14 : 60;
        this.messages.draw(ctx, margin, view.h - 184, view.w - margin * 2, 164);
        this.overlayRect = { x: margin, y: view.h - 184, w: view.w - margin * 2, h: 164 };
        break;
      }
      case 'main':
        break;
    }
  }

  private dimBackground(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(1,4,16,0.68)';
    ctx.fillRect(0, 0, view.w, view.h);
  }
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function plaquePath(ctx: CanvasRenderingContext2D, rect: Rect, inset: number): void {
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = rect.w - inset * 2;
  const h = rect.h - inset * 2;
  const cut = Math.min(30, h * 0.28);
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

function drawPlaqueDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  const jewel = ctx.createLinearGradient(0, y - radius, 0, y + radius);
  jewel.addColorStop(0, '#fffbd5');
  jewel.addColorStop(0.45, '#ffd84c');
  jewel.addColorStop(1, '#e68d10');
  ctx.fillStyle = jewel;
  ctx.fill();
  ctx.strokeStyle = '#9c5907';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}
