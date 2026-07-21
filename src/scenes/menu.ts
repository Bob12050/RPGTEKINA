// ============================================================
// メニューハブ — プレイヤー情報と日常機能をまとめた全画面UI
// ============================================================
import {
  faArrowLeft,
  faBagShopping,
  faBars,
  faBolt,
  faBookOpen,
  faCircleQuestion,
  faCoins,
  faCompass,
  faDragon,
  faFlask,
  faFloppyDisk,
  faGem,
  faHouse,
  faShop,
  faTicket,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { GameState, MonsterInstance } from '../core/types';
import { getItem } from '../data/items';
import { SPECIES } from '../data/monsters';
import { maxStats } from '../game/monster';
import { saveGame } from '../game/save';
import { consumeItem, healParty } from '../game/state';
import { drawFancyBg } from '../ui/bg';
import { monsterLabel, monsterNote } from '../ui/format';
import { drawIcon } from '../ui/icon';
import { createImageAsset, drawCoverImage, imageReady } from '../ui/media';
import { drawText, inRect, isPortrait, Menu, MessageBox, view, wrapText, type Rect } from '../ui/window';
import { DexScene } from './dex';
import { GachaScene } from './gacha';
import { HelpScene } from './help';
import { MonsterBoxScene } from './box';
import { QuestHubScene } from './questHub';
import { ShopScene } from './shop';

type Phase = 'main' | 'itemPick' | 'itemTarget' | 'message';
type FocusArea = 'tiles' | 'nav';

interface MenuTile {
  label: string;
  sub: string;
  icon: IconDefinition;
  image: HTMLImageElement | null;
  crop: { x: number; y: number; w: number; h: number };
  accent: string;
}

const MENU_BACKGROUND = createImageAsset(new URL('../assets/menu/menu-bg.webp', import.meta.url).href);
const HOME_AVATAR = createImageAsset(new URL('../assets/home/home-hero.webp', import.meta.url).href);
const ITEMS_ICON = createImageAsset(new URL('../assets/menu/icons/items-bag.webp', import.meta.url).href);
const SHOP_ICON = createImageAsset(new URL('../assets/menu/icons/shop-stall.webp', import.meta.url).href);
const HEAL_ICON = createImageAsset(new URL('../assets/menu/icons/full-heal-potion.webp', import.meta.url).href);
const DEX_ICON = createImageAsset(new URL('../assets/menu/icons/monster-book.webp', import.meta.url).href);
const HELP_ICON = createImageAsset(new URL('../assets/menu/icons/help-medallion.webp', import.meta.url).href);
const SAVE_ICON = createImageAsset(new URL('../assets/menu/icons/save-scroll.webp', import.meta.url).href);

const UI_FONT = '"Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

const MENU_TILES: MenuTile[] = [
  { label: 'もちもの', sub: '回復アイテムを使う', icon: faBagShopping, image: ITEMS_ICON, crop: { x: 72, y: 97, w: 883, h: 814 }, accent: '#d6a958' },
  { label: 'ショップ', sub: 'アイテムを購入', icon: faShop, image: SHOP_ICON, crop: { x: 75, y: 45, w: 871, h: 891 }, accent: '#d6a958' },
  { label: '全回復', sub: 'パーティとBOXを回復', icon: faFlask, image: HEAL_ICON, crop: { x: 192, y: 93, w: 640, h: 843 }, accent: '#5fe4a1' },
  { label: 'モンスター図鑑', sub: '出会った仲間', icon: faBookOpen, image: DEX_ICON, crop: { x: 66, y: 211, w: 891, h: 619 }, accent: '#d6a958' },
  { label: 'ヘルプ', sub: '遊び方を見る', icon: faCircleQuestion, image: HELP_ICON, crop: { x: 72, y: 64, w: 877, h: 880 }, accent: '#d6a958' },
  { label: 'セーブ', sub: '冒険を記録', icon: faFloppyDisk, image: SAVE_ICON, crop: { x: 42, y: 60, w: 955, h: 942 }, accent: '#56dfff' },
];

const NAV_ITEMS = [
  { label: 'ホーム', icon: faHouse },
  { label: 'クエスト', icon: faCompass },
  { label: 'ガチャ', icon: faTicket },
  { label: 'モンスター', icon: faDragon },
  { label: 'メニュー', icon: faBars },
] as const;

export class MenuScene implements Scene {
  private phase: Phase = 'main';
  private focus: FocusArea = 'tiles';
  private cursor = 0;
  private navCursor = 4;
  private showFocus = false;
  private tileRects: Rect[] = [];
  private navRects: Rect[] = [];
  private backRect: Rect | null = null;
  private overlayRect: Rect | null = null;
  private itemMenu = new Menu([], 8, 56);
  private targetMenu = new Menu([], 8, 56);
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

    if (this.phase === 'main') {
      this.updateMain(tap, key);
      return;
    }

    if (this.phase === 'itemPick') {
      if (tap) {
        const index = this.itemMenu.itemAt(tap.x, tap.y);
        if (index !== null) {
          this.itemMenu.setCursor(index);
          this.pickItem(index);
        } else if (this.tapOutsideOverlay(tap.x, tap.y)) {
          this.phase = 'main';
        }
        return;
      }
      if (!key) return;
      const result = this.itemMenu.handleKey(key);
      if (result === 'cancel') this.phase = 'main';
      else if (result === 'select') this.pickItem(this.itemMenu.cursor);
      return;
    }

    if (this.phase === 'itemTarget') {
      if (tap) {
        const index = this.targetMenu.itemAt(tap.x, tap.y);
        if (index !== null) {
          this.targetMenu.setCursor(index);
          this.applyItem(index);
        } else if (this.tapOutsideOverlay(tap.x, tap.y)) {
          this.phase = 'itemPick';
        }
        return;
      }
      if (!key) return;
      const result = this.targetMenu.handleKey(key);
      if (result === 'cancel') this.phase = 'itemPick';
      else if (result === 'select') this.applyItem(this.targetMenu.cursor);
      return;
    }

    if (tap || key === 'confirm' || key === 'cancel') {
      if (this.messages.advance()) this.phase = 'main';
    }
  }

  private updateMain(
    tap: { x: number; y: number } | null,
    key: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'menu' | null,
  ): void {
    if (tap) {
      this.showFocus = false;
      if (this.backRect && inRect(tap.x, tap.y, this.backRect)) {
        this.app.scenes.pop();
        return;
      }
      for (let i = 0; i < this.tileRects.length; i++) {
        if (!inRect(tap.x, tap.y, this.tileRects[i]!)) continue;
        this.focus = 'tiles';
        this.cursor = i;
        this.activateTile(i);
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
    if (key === 'cancel' || key === 'menu') {
      this.app.scenes.pop();
      return;
    }

    if (this.focus === 'tiles') {
      const columns = isPortrait() ? 2 : 3;
      if (key === 'left' && this.cursor % columns > 0) this.cursor -= 1;
      else if (key === 'right' && this.cursor % columns < columns - 1 && this.cursor + 1 < MENU_TILES.length) this.cursor += 1;
      else if (key === 'up') this.cursor = Math.max(0, this.cursor - columns);
      else if (key === 'down') {
        if (this.cursor + columns < MENU_TILES.length) this.cursor += columns;
        else this.focus = 'nav';
      } else if (key === 'confirm') this.activateTile(this.cursor);
      return;
    }

    if (key === 'left') this.navCursor = (this.navCursor + NAV_ITEMS.length - 1) % NAV_ITEMS.length;
    else if (key === 'right') this.navCursor = (this.navCursor + 1) % NAV_ITEMS.length;
    else if (key === 'up') this.focus = 'tiles';
    else if (key === 'confirm') this.activateNav(this.navCursor);
  }

  private activateTile(index: number): void {
    const state = requireState(this.app);
    switch (index) {
      case 0:
        this.buildItemMenu();
        this.phase = 'itemPick';
        break;
      case 1:
        this.app.scenes.push(new ShopScene(this.app));
        break;
      case 2:
        healParty(state);
        this.messages.setPages(['パーティと BOXの モンスターが\nすっかり げんきに なった!']);
        this.phase = 'message';
        break;
      case 3:
        this.app.scenes.push(new DexScene(this.app));
        break;
      case 4:
        this.app.scenes.push(new HelpScene(this.app));
        break;
      case 5: {
        const ok = saveGame(state);
        this.messages.setPages([ok ? 'ぼうけんの きろくを のこした!' : 'セーブに しっぱいした…。']);
        this.phase = 'message';
        break;
      }
    }
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
        this.switchTab(new GachaScene(this.app));
        break;
      case 3:
        this.switchTab(new MonsterBoxScene(this.app));
        break;
      case 4:
        break;
    }
  }

  private switchTab(scene: Scene): void {
    this.app.scenes.pop();
    this.app.scenes.push(scene);
  }

  private tapOutsideOverlay(px: number, py: number): boolean {
    return this.overlayRect !== null && !inRect(px, py, this.overlayRect);
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

  private pickItem(index: number): void {
    const itemId = this.itemIds()[index];
    if (!itemId) return;
    const item = getItem(itemId);
    this.selectedItemId = itemId;
    this.buildTargetMenu(item.effect.kind === 'revive');
    this.phase = 'itemTarget';
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

  private applyItem(index: number): void {
    const state = requireState(this.app);
    const target = state.party[index];
    if (!target || !this.selectedItemId || this.targetMenu.items[index]?.disabled) return;
    this.useItem(this.selectedItemId, target);
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
    this.tileRects = [];
    this.navRects = [];
    this.backRect = null;
    this.overlayRect = null;

    this.drawBackground(ctx);
    if (isPortrait()) this.drawPortrait(ctx);
    else this.drawLandscape(ctx);
    if (this.phase !== 'main') this.drawOverlay(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    if (imageReady(MENU_BACKGROUND)) {
      drawCoverImage(ctx, MENU_BACKGROUND, { x: 0, y: 0, w: view.w, h: view.h }, 0.5, 0.5);
    } else {
      drawFancyBg(ctx, 'home', this.time);
    }
    ctx.fillStyle = 'rgba(1,5,18,0.18)';
    ctx.fillRect(0, 0, view.w, view.h);
  }

  private drawPortrait(ctx: CanvasRenderingContext2D): void {
    this.drawHeader(ctx, { x: 14, y: 14, w: 60, h: 44 }, view.w / 2, 16);
    this.drawStatusBar(ctx, 14, 72, view.w - 28, 48);
    this.drawProfile(ctx, { x: 18, y: 134, w: view.w - 36, h: 196 }, false);

    const gap = 12;
    const margin = 18;
    const tileW = (view.w - margin * 2 - gap) / 2;
    const tileH = 184;
    const startY = 344;
    MENU_TILES.forEach((tile, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const rect = { x: margin + col * (tileW + gap), y: startY + row * (tileH + gap), w: tileW, h: tileH };
      this.tileRects.push(rect);
      this.drawMenuTile(ctx, rect, tile, index, this.showFocus && this.focus === 'tiles' && this.cursor === index);
    });

    this.drawBottomNav(ctx, { x: 0, y: 934, w: view.w, h: 106 });
  }

  private drawLandscape(ctx: CanvasRenderingContext2D): void {
    this.drawHeader(ctx, { x: 14, y: 14, w: 64, h: 50 }, 260, 20);
    this.drawStatusBar(ctx, 490, 14, 454, 58);
    this.drawProfile(ctx, { x: 18, y: 88, w: 286, h: 372 }, true);

    const startX = 324;
    const startY = 92;
    const gap = 12;
    const tileW = (view.w - startX - 18 - gap * 2) / 3;
    const tileH = 180;
    MENU_TILES.forEach((tile, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const rect = { x: startX + col * (tileW + gap), y: startY + row * (tileH + gap), w: tileW, h: tileH };
      this.tileRects.push(rect);
      this.drawMenuTile(ctx, rect, tile, index, this.showFocus && this.focus === 'tiles' && this.cursor === index);
    });
    this.drawBottomNav(ctx, { x: 150, y: 482, w: 660, h: 142 });
  }

  private drawHeader(ctx: CanvasRenderingContext2D, backRect: Rect, titleX: number, titleY: number): void {
    this.backRect = backRect;
    ctx.save();
    ctx.shadowColor = 'rgba(255,194,55,0.42)';
    ctx.shadowBlur = 8;
    plaquePath(ctx, backRect, 0);
    const fill = ctx.createLinearGradient(0, backRect.y, 0, backRect.y + backRect.h);
    fill.addColorStop(0, '#4d3618');
    fill.addColorStop(1, '#151329');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#f2c95d';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    plaquePath(ctx, backRect, 5);
    ctx.strokeStyle = 'rgba(255,239,157,0.72)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawIcon(ctx, faArrowLeft, backRect.x + 16, backRect.y + 10, 26, '#ffe277');
    ctx.restore();

    drawText(ctx, 'メニュー', titleX, titleY, {
      align: 'center',
      color: '#ffe28a',
      font: `bold 29px ${UI_FONT}`,
      shadow: true,
    });
    ctx.save();
    ctx.strokeStyle = 'rgba(239,194,78,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(titleX - 116, titleY + 18);
    ctx.lineTo(titleX - 62, titleY + 18);
    ctx.moveTo(titleX + 62, titleY + 18);
    ctx.lineTo(titleX + 116, titleY + 18);
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
    rounded(ctx, x, y, w, h, 13);
    const fill = ctx.createLinearGradient(0, y, 0, y + h);
    fill.addColorStop(0, 'rgba(11,20,47,0.97)');
    fill.addColorStop(1, 'rgba(3,8,25,0.97)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(229,193,107,0.82)';
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
    drawText(ctx, `Rank ${rank}`, x + cellW - 8, y + h / 2 - 9, { align: 'right', font, color: '#f4f6ff' });
    drawIcon(ctx, faBolt, x + cellW + 9, y + (h - iconSize) / 2, iconSize, '#61f599');
    const meterX = x + cellW + 39;
    const meterW = cellW - 48;
    const segmentW = (meterW - 6) / 4;
    for (let i = 0; i < 4; i++) {
      rounded(ctx, meterX + i * (segmentW + 2), y + h / 2 - 6, segmentW, 12, 3);
      ctx.fillStyle = '#55d992';
      ctx.fill();
      ctx.strokeStyle = 'rgba(216,255,235,0.72)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    drawIcon(ctx, faGem, x + cellW * 2 + 10, y + (h - iconSize) / 2, iconSize, '#62d9ff');
    drawText(ctx, String(state.orbs), x + cellW * 3 - 12, y + h / 2 - 9, { align: 'right', font, color: '#f4f6ff' });
    drawIcon(ctx, faCoins, x + cellW * 3 + 10, y + (h - iconSize) / 2, iconSize, '#ffcd54');
    drawText(ctx, `${state.gold}G`, x + w - 12, y + h / 2 - 9, { align: 'right', font, color: '#f4f6ff' });
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

  private drawProfile(ctx: CanvasRenderingContext2D, rect: Rect, vertical: boolean): void {
    const state = requireState(this.app);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.62)';
    ctx.shadowBlur = 10;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 16);
    const fill = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    fill.addColorStop(0, 'rgba(14,37,78,0.96)');
    fill.addColorStop(0.5, 'rgba(6,17,42,0.97)');
    fill.addColorStop(1, 'rgba(3,11,29,0.98)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#d2a653';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    rounded(ctx, rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12, 12);
    ctx.strokeStyle = 'rgba(245,215,137,0.42)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (vertical) {
      const portraitSize = 164;
      this.drawProfilePortrait(ctx, rect.x + (rect.w - portraitSize) / 2, rect.y + 24, portraitSize);
      drawText(ctx, '冒険者プロフィール', rect.x + rect.w / 2, rect.y + 202, {
        align: 'center', color: '#ffe58f', font: `bold 17px ${UI_FONT}`, shadow: true,
      });
      drawText(ctx, state.playerName, rect.x + rect.w / 2, rect.y + 232, {
        align: 'center', color: '#ffffff', font: `bold 27px ${UI_FONT}`, shadow: true,
      });
      drawText(ctx, 'プレイヤーID  12050', rect.x + rect.w / 2, rect.y + 274, {
        align: 'center', color: '#d5def3', font: `bold 13px ${UI_FONT}`,
      });
      this.drawProfileMetric(ctx, rect.x + 22, rect.y + 310, rect.w - 44, '総合力', this.partyPower(state).toLocaleString('ja-JP'), '#ffd86d');
      this.drawProfileMetric(ctx, rect.x + 22, rect.y + 340, rect.w - 44, '図鑑', `${state.scoutedSpecies.length}/${SPECIES.length}`, '#79e98c');
      ctx.restore();
      return;
    }

    const portraitSize = 150;
    this.drawProfilePortrait(ctx, rect.x + 20, rect.y + 23, portraitSize);
    const infoX = rect.x + 190;
    const infoW = rect.x + rect.w - infoX - 18;
    drawText(ctx, '✦  冒険者プロフィール  ✦', infoX + infoW / 2, rect.y + 20, {
      align: 'center', color: '#ffe58f', font: `bold 16px ${UI_FONT}`, shadow: true,
    });
    drawText(ctx, state.playerName, infoX, rect.y + 53, {
      color: '#fff8dc', font: `bold 27px ${UI_FONT}`, shadow: true,
    });
    this.drawProfileMetric(ctx, infoX, rect.y + 91, infoW, 'プレイヤーID', '12050', '#f4f6ff');
    this.drawProfileMetric(ctx, infoX, rect.y + 124, infoW, '総合力', this.partyPower(state).toLocaleString('ja-JP'), '#ffd86d');
    this.drawProfileMetric(ctx, infoX, rect.y + 157, infoW, '図鑑', `${state.scoutedSpecies.length}/${SPECIES.length}`, '#79e98c');
    ctx.restore();
  }

  private drawProfilePortrait(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.save();
    ctx.shadowColor = 'rgba(53,184,255,0.34)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#071b46';
    ctx.fillRect(x, y, size, size);
    if (imageReady(HOME_AVATAR)) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(HOME_AVATAR, 360, 480, 540, 540, x, y, size, size);
    }
    else drawIcon(ctx, faDragon, x + size * 0.16, y + size * 0.16, size * 0.68, '#59bfff');
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#e1b85c';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(119,215,255,0.58)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  }

  private drawProfileMetric(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    label: string,
    value: string,
    valueColor: string,
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + 25);
    ctx.lineTo(x + w, y + 25);
    ctx.strokeStyle = 'rgba(218,182,99,0.34)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawText(ctx, label, x + 4, y + 2, { color: '#d7def0', font: `bold 13px ${UI_FONT}` });
    drawText(ctx, value, x + w - 4, y - 1, { align: 'right', color: valueColor, font: `bold 18px ${UI_FONT}`, shadow: true });
    ctx.restore();
  }

  private partyPower(state: GameState): number {
    return state.party.reduce((sum, monster) => {
      const stats = maxStats(monster);
      return sum + stats.hp + stats.mp * 2 + stats.atk * 4 + stats.def * 4 + stats.agi * 3 + stats.wis * 3 + monster.level * 8 + (monster.luck ?? 1) * 2;
    }, 0);
  }

  private drawMenuTile(ctx: CanvasRenderingContext2D, rect: Rect, tile: MenuTile, index: number, selected: boolean): void {
    const state = requireState(this.app);
    const special = index === 2 ? 'green' : index === 5 ? 'cyan' : 'navy';
    ctx.save();
    ctx.shadowColor = selected ? tile.accent : 'rgba(0,0,0,0.62)';
    ctx.shadowBlur = selected ? 18 + Math.sin(this.time * 3) * 3 : 8;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 16);
    const fill = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    if (special === 'green') {
      fill.addColorStop(0, 'rgba(12,91,62,0.97)');
      fill.addColorStop(1, 'rgba(4,42,36,0.98)');
    } else if (special === 'cyan') {
      fill.addColorStop(0, 'rgba(7,48,82,0.97)');
      fill.addColorStop(1, 'rgba(3,18,45,0.98)');
    } else {
      fill.addColorStop(0, 'rgba(17,38,79,0.97)');
      fill.addColorStop(1, 'rgba(4,15,40,0.98)');
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = selected ? '#6ce7ff' : tile.accent;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.stroke();
    rounded(ctx, rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12, 11);
    ctx.strokeStyle = special === 'cyan' ? 'rgba(103,229,255,0.48)' : 'rgba(246,219,153,0.33)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const compact = rect.w < 205;
    const artW = compact ? 76 : 110;
    const artH = compact ? 58 : 86;
    const artY = rect.y + (compact ? 8 : 10);
    if (imageReady(tile.image)) {
      drawCroppedContain(ctx, tile.image, tile.crop, {
        x: rect.x + (rect.w - artW) / 2,
        y: artY,
        w: artW,
        h: artH,
      });
    } else {
      const iconSize = compact ? 43 : 51;
      drawIcon(ctx, tile.icon, rect.x + (rect.w - iconSize) / 2, artY + 20, iconSize, tile.accent);
    }
    const labelY = rect.y + (compact ? 82 : 108);
    const labelSize = tile.label.length >= 7 ? (compact ? 18 : 18) : compact ? 21 : 22;
    drawText(ctx, tile.label, rect.x + rect.w / 2, labelY, {
      align: 'center', color: special === 'cyan' ? '#85eaff' : '#ffe7a0', font: `bold ${labelSize}px ${UI_FONT}`, shadow: true,
    });
    const dividerY = rect.y + (compact ? 113 : 137);
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w * 0.24, dividerY);
    ctx.lineTo(rect.x + rect.w * 0.76, dividerY);
    ctx.strokeStyle = tile.accent;
    ctx.lineWidth = 1;
    ctx.stroke();
    const subFont = `bold ${compact ? 19 : 14}px ${UI_FONT}`;
    const subLines = compact ? wrapText(ctx, tile.sub, rect.w - 14, subFont) : [tile.sub];
    subLines.slice(0, 2).forEach((line, lineIndex) => {
      drawText(ctx, line, rect.x + rect.w / 2, rect.y + (compact ? 122 + lineIndex * 23 : 148), {
        align: 'center', color: '#e7ebf5', font: subFont,
      });
    });

    const badge = this.tileBadge(index, state);
    if (badge) {
      const badgeW = Math.max(46, badge.length * 9 + 18);
      rounded(ctx, rect.x + rect.w - badgeW - 10, rect.y + 10, badgeW, 23, 11);
      ctx.fillStyle = 'rgba(2,8,24,0.82)';
      ctx.fill();
      ctx.strokeStyle = `${tile.accent}aa`;
      ctx.lineWidth = 1;
      ctx.stroke();
      drawText(ctx, badge, rect.x + rect.w - badgeW / 2 - 10, rect.y + 14, {
        align: 'center', color: '#ffffff', font: `bold 10px ${UI_FONT}`,
      });
    }
    ctx.restore();
  }

  private tileBadge(index: number, state: GameState): string | null {
    if (index === 0) return `計${Object.values(state.items).reduce((sum, count) => sum + count, 0)}個`;
    if (index === 1) return `${state.gold}G`;
    if (index === 3) return `${state.scoutedSpecies.length}/${SPECIES.length}`;
    if (index === 4) return '全4頁';
    return null;
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
    ctx.moveTo(rect.x, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y);
    ctx.stroke();

    const gap = rect.w < 500 ? 5 : 9;
    const pad = rect.w < 500 ? 5 : 12;
    const itemW = (rect.w - pad * 2 - gap * 4) / 5;
    NAV_ITEMS.forEach((item, index) => {
      const x = rect.x + pad + index * (itemW + gap);
      const y = rect.y + 8;
      const h = rect.h - 16;
      const active = index === 4;
      const focused = this.showFocus && this.focus === 'nav' && this.navCursor === index;
      this.navRects.push({ x, y, w: itemW, h });
      rounded(ctx, x, y, itemW, h, 13);
      const tileFill = ctx.createLinearGradient(0, y, 0, y + h);
      tileFill.addColorStop(0, active ? '#183b72' : '#152444');
      tileFill.addColorStop(1, active ? '#071b42' : '#081126');
      ctx.fillStyle = tileFill;
      ctx.fill();
      ctx.strokeStyle = focused ? '#ffe273' : active ? '#53dcff' : 'rgba(133,160,213,0.55)';
      ctx.lineWidth = focused || active ? 2.5 : 1.5;
      ctx.stroke();
      if (active) {
        ctx.shadowColor = '#38cfff';
        ctx.shadowBlur = 13;
        rounded(ctx, x + 2, y + 2, itemW - 4, h - 4, 11);
        ctx.strokeStyle = 'rgba(91,225,255,0.78)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowColor = 'transparent';
      }
      const iconSize = itemW < 85 ? 30 : 36;
      drawIcon(ctx, item.icon, x + (itemW - iconSize) / 2, y + 12, iconSize, active ? '#ffd45d' : '#dbe5fa');
      drawText(ctx, item.label, x + itemW / 2, y + h - 27, {
        align: 'center', color: active ? '#fff3bc' : '#d7e0f2', font: `bold ${itemW < 85 ? 11 : 14}px ${UI_FONT}`, shadow: true,
      });
    });
    ctx.restore();
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(1,4,16,0.76)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();

    if (this.phase === 'message') {
      const width = Math.min(430, view.w - 36);
      const height = 112;
      this.messages.draw(ctx, (view.w - width) / 2, (view.h - height) / 2, width, height);
      return;
    }

    const width = Math.min(430, view.w - 32);
    const x = (view.w - width) / 2;
    const y = isPortrait() ? 330 : 90;
    const title = this.phase === 'itemPick' ? 'もちものを選ぶ' : '使うモンスターを選ぶ';
    const height = this.phase === 'itemPick'
      ? this.itemMenu.draw(ctx, x, y, width, title)
      : this.targetMenu.draw(ctx, x, y, width, title);
    this.overlayRect = { x, y, w: width, h: height };
  }
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function plaquePath(ctx: CanvasRenderingContext2D, rect: Rect, inset: number): void {
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = rect.w - inset * 2;
  const h = rect.h - inset * 2;
  const cut = Math.min(12, h * 0.28);
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

function drawCroppedContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  crop: { x: number; y: number; w: number; h: number },
  rect: Rect,
): void {
  const scale = Math.min(rect.w / crop.w, rect.h / crop.h);
  const width = crop.w * scale;
  const height = crop.h * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.w,
    crop.h,
    rect.x + (rect.w - width) / 2,
    rect.y + (rect.h - height) / 2,
    width,
    height,
  );
  ctx.restore();
}
