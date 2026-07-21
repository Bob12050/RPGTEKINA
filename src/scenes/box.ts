// ============================================================
// モンスター管理 — パーティ編成とボックス整理を統合したソシャゲUI
// ============================================================
import {
  faArrowDownWideShort,
  faArrowLeft,
  faBars,
  faBolt,
  faBoxArchive,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faClover,
  faCoins,
  faCompass,
  faDragon,
  faFilter,
  faGem,
  faHouse,
  faMagnifyingGlass,
  faPlus,
  faStar,
  faTicket,
  faUserGroup,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import {
  FARM_MAX,
  PARTY_MAX,
  rankScore,
  rankStars,
  type GameState,
  type MonsterInstance,
} from '../core/types';
import { getSpecies } from '../data/monsters';
import { maxStats } from '../game/monster';
import {
  moveFarmMemberToParty,
  movePartyMemberToFarm,
  swapFarmMemberIntoParty,
  type PartyMoveResult,
} from '../game/partyManagement';
import { luckDropMult, luckOrbBonus, partyLuck } from '../game/state';
import { drawFancyBg } from '../ui/bg';
import { RANK_COLORS } from '../ui/format';
import { drawIcon } from '../ui/icon';
import { createImageAsset, drawCoverImage, imageReady } from '../ui/media';
import { drawSpeciesBadge, drawSpeciesPortrait } from '../ui/monsterArt';
import { drawMonster } from '../ui/sprites';
import { drawGauge, drawText, hpColor, inRect, isPortrait, view, type Rect } from '../ui/window';
import { GachaScene } from './gacha';
import { MenuScene } from './menu';
import { QuestHubScene } from './questHub';
import { StatusScene } from './status';

type ViewMode = 'party' | 'box';
type SortMode = 'recommended' | 'rank' | 'level' | 'luck';
type FilterMode = 'all' | 'party' | 'box';
type OverlayMode = 'none' | 'sort' | 'filter' | 'message';

interface RosterEntry {
  monster: MonsterInstance;
  inParty: boolean;
}

interface RosterHit {
  rect: Rect;
  uid: string | null;
}

const MONSTER_BACKGROUND = createImageAsset(new URL('../assets/monster/monster-bg.webp', import.meta.url).href);
const UI_FONT = '"Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

const NAV_ITEMS = [
  { label: 'ホーム', icon: faHouse },
  { label: 'クエスト', icon: faCompass },
  { label: 'ガチャ', icon: faTicket },
  { label: 'モンスター', icon: faDragon },
  { label: 'メニュー', icon: faBars },
] as const;

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'recommended', label: 'おすすめ順' },
  { value: 'rank', label: 'レア度順' },
  { value: 'level', label: 'レベル順' },
  { value: 'luck', label: 'ラック順' },
];

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'party', label: 'パーティ中' },
  { value: 'box', label: 'ボックスのみ' },
];

export class MonsterBoxScene implements Scene {
  private mode: ViewMode = 'party';
  private sortMode: SortMode = 'recommended';
  private filterMode: FilterMode = 'all';
  private overlay: OverlayMode = 'none';
  private overlayCursor = 0;
  private message = '';
  private selectedUid: string | null = null;
  private replacementUid: string | null = null;
  private replacementSlot = 0;
  private page = 0;
  private time = 0;
  private toast = '';
  private toastT = 0;
  private navCursor = 3;
  private showFocus = false;

  private backRect: Rect | null = null;
  private tabRects: Rect[] = [];
  private partyRects: Rect[] = [];
  private rosterHits: RosterHit[] = [];
  private sortRect: Rect | null = null;
  private filterRect: Rect | null = null;
  private prevRect: Rect | null = null;
  private nextRect: Rect | null = null;
  private primaryRect: Rect | null = null;
  private detailRect: Rect | null = null;
  private cancelReplaceRect: Rect | null = null;
  private navRects: Rect[] = [];
  private modalRect: Rect | null = null;
  private modalOptionRects: Rect[] = [];

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  update(dt: number): void {
    this.time += dt;
    this.toastT = Math.max(0, this.toastT - dt);
    this.clampPage();

    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;

    if (this.overlay !== 'none') {
      this.updateOverlay(tap, key);
      return;
    }

    if (this.replacementUid) {
      this.updateReplacement(tap, key);
      return;
    }

    if (tap) {
      this.showFocus = false;
      if (this.backRect && inRect(tap.x, tap.y, this.backRect)) {
        this.app.scenes.pop();
        return;
      }
      for (let i = 0; i < this.tabRects.length; i++) {
        if (!inRect(tap.x, tap.y, this.tabRects[i]!)) continue;
        this.mode = i === 0 ? 'party' : 'box';
        this.page = 0;
        return;
      }
      if (this.sortRect && inRect(tap.x, tap.y, this.sortRect)) {
        this.openOverlay('sort');
        return;
      }
      if (this.filterRect && inRect(tap.x, tap.y, this.filterRect)) {
        this.openOverlay('filter');
        return;
      }
      if (this.prevRect && inRect(tap.x, tap.y, this.prevRect)) {
        this.page = (this.page + this.pageCount() - 1) % this.pageCount();
        return;
      }
      if (this.nextRect && inRect(tap.x, tap.y, this.nextRect)) {
        this.page = (this.page + 1) % this.pageCount();
        return;
      }
      for (let i = 0; i < this.partyRects.length; i++) {
        if (!inRect(tap.x, tap.y, this.partyRects[i]!)) continue;
        const monster = requireState(this.app).party[i];
        if (monster) this.selectedUid = monster.uid;
        else this.say('ボックスのモンスターを選んで「編成する」を押してください。');
        return;
      }
      for (const hit of this.rosterHits) {
        if (!hit.uid || !inRect(tap.x, tap.y, hit.rect)) continue;
        this.selectedUid = hit.uid;
        return;
      }
      if (this.primaryRect && inRect(tap.x, tap.y, this.primaryRect)) {
        this.activatePrimary();
        return;
      }
      if (this.detailRect && inRect(tap.x, tap.y, this.detailRect)) {
        this.openSelectedDetails();
        return;
      }
      for (let i = 0; i < this.navRects.length; i++) {
        if (!inRect(tap.x, tap.y, this.navRects[i]!)) continue;
        this.navCursor = i;
        this.activateNav(i);
        return;
      }
      return;
    }

    if (!key) return;
    this.showFocus = true;
    if (key === 'cancel') {
      if (this.selectedUid) this.selectedUid = null;
      else this.app.scenes.pop();
      return;
    }
    if (key === 'menu') {
      this.activateNav(4);
      return;
    }
    if (key === 'confirm') {
      if (this.selectedUid) this.activatePrimary();
      else this.selectedUid = this.pageEntries()[0]?.monster.uid ?? null;
      return;
    }
    this.moveKeyboardSelection(key);
  }

  private updateOverlay(
    tap: { x: number; y: number } | null,
    key: ReturnType<App['input']['poll']>,
  ): void {
    if (this.overlay === 'message') {
      if (tap || key === 'confirm' || key === 'cancel') this.overlay = 'none';
      return;
    }

    const options = this.overlay === 'sort' ? SORT_OPTIONS : FILTER_OPTIONS;
    if (tap) {
      for (let i = 0; i < this.modalOptionRects.length; i++) {
        if (!inRect(tap.x, tap.y, this.modalOptionRects[i]!)) continue;
        this.applyOverlayChoice(i);
        return;
      }
      if (this.modalRect && !inRect(tap.x, tap.y, this.modalRect)) this.overlay = 'none';
      return;
    }
    if (!key) return;
    if (key === 'cancel') {
      this.overlay = 'none';
    } else if (key === 'up' || key === 'left') {
      this.overlayCursor = (this.overlayCursor + options.length - 1) % options.length;
    } else if (key === 'down' || key === 'right') {
      this.overlayCursor = (this.overlayCursor + 1) % options.length;
    } else if (key === 'confirm') {
      this.applyOverlayChoice(this.overlayCursor);
    }
  }

  private updateReplacement(
    tap: { x: number; y: number } | null,
    key: ReturnType<App['input']['poll']>,
  ): void {
    if (tap) {
      if (this.cancelReplaceRect && inRect(tap.x, tap.y, this.cancelReplaceRect)) {
        this.replacementUid = null;
        return;
      }
      for (let i = 0; i < this.partyRects.length; i++) {
        if (!inRect(tap.x, tap.y, this.partyRects[i]!)) continue;
        this.finishReplacement(i);
        return;
      }
      return;
    }
    if (!key) return;
    if (key === 'cancel') {
      this.replacementUid = null;
    } else if (key === 'left') {
      this.replacementSlot = (this.replacementSlot + PARTY_MAX - 1) % PARTY_MAX;
    } else if (key === 'right') {
      this.replacementSlot = (this.replacementSlot + 1) % PARTY_MAX;
    } else if (key === 'confirm') {
      this.finishReplacement(this.replacementSlot);
    }
  }

  private moveKeyboardSelection(key: ReturnType<App['input']['poll']>): void {
    if (key !== 'left' && key !== 'right' && key !== 'up' && key !== 'down') return;
    const entries = this.pageEntries();
    if (entries.length === 0) return;
    let index = entries.findIndex((entry) => entry.monster.uid === this.selectedUid);
    if (index < 0) index = 0;
    const columns = isPortrait() ? 4 : this.mode === 'party' ? 3 : 6;
    const delta = key === 'left' ? -1 : key === 'right' ? 1 : key === 'up' ? -columns : columns;
    index = Math.max(0, Math.min(entries.length - 1, index + delta));
    this.selectedUid = entries[index]!.monster.uid;
  }

  private openOverlay(overlay: 'sort' | 'filter'): void {
    this.overlay = overlay;
    const current = overlay === 'sort' ? this.sortMode : this.filterMode;
    const options = overlay === 'sort' ? SORT_OPTIONS : FILTER_OPTIONS;
    this.overlayCursor = Math.max(0, options.findIndex((option) => option.value === current));
  }

  private applyOverlayChoice(index: number): void {
    if (this.overlay === 'sort') this.sortMode = SORT_OPTIONS[index]?.value ?? this.sortMode;
    else if (this.overlay === 'filter') this.filterMode = FILTER_OPTIONS[index]?.value ?? this.filterMode;
    this.page = 0;
    this.overlay = 'none';
  }

  private activatePrimary(): void {
    if (!this.selectedUid) return;
    const state = requireState(this.app);
    const inParty = state.party.some((monster) => monster.uid === this.selectedUid);
    if (inParty) {
      const result = movePartyMemberToFarm(state, this.selectedUid);
      if (result === 'ok') {
        this.showToast('ボックスへ移動しました');
        this.clampPage();
      } else {
        this.say(this.moveErrorMessage(result));
      }
      return;
    }

    const result = moveFarmMemberToParty(state, this.selectedUid);
    if (result === 'partyFull') {
      this.replacementUid = this.selectedUid;
      this.replacementSlot = 0;
      return;
    }
    if (result === 'ok') {
      this.showToast('パーティに編成しました');
      this.clampPage();
    } else {
      this.say(this.moveErrorMessage(result));
    }
  }

  private finishReplacement(index: number): void {
    const state = requireState(this.app);
    const uid = this.replacementUid;
    if (!uid) return;
    const result = swapFarmMemberIntoParty(state, uid, index);
    if (result === 'ok') {
      this.replacementUid = null;
      this.selectedUid = uid;
      this.showToast(`${index + 1}枠目と入れ替えました`);
    } else {
      this.say(this.moveErrorMessage(result));
      this.replacementUid = null;
    }
  }

  private moveErrorMessage(result: PartyMoveResult): string {
    switch (result) {
      case 'lastMember':
        return '最後の1体はボックスへ戻せません。';
      case 'boxFull':
        return 'ボックスがいっぱいです。';
      case 'partyFull':
        return 'パーティがいっぱいです。交換する枠を選んでください。';
      case 'noFighter':
        return '戦える仲間がいなくなる編成にはできません。';
      case 'invalidSlot':
      case 'notFound':
        return 'モンスター情報を更新できませんでした。';
      default:
        return '';
    }
  }

  private openSelectedDetails(): void {
    const monster = this.selectedMonster();
    if (monster) this.app.scenes.push(new StatusScene(this.app, monster));
  }

  private say(message: string): void {
    this.message = message;
    this.overlay = 'message';
  }

  private showToast(message: string): void {
    this.toast = message;
    this.toastT = 2.2;
  }

  private selectedMonster(): MonsterInstance | null {
    if (!this.selectedUid) return null;
    const state = requireState(this.app);
    return [...state.party, ...state.farm].find((monster) => monster.uid === this.selectedUid) ?? null;
  }

  private ownedEntries(): RosterEntry[] {
    const state = requireState(this.app);
    const entries: RosterEntry[] = [
      ...state.party.map((monster) => ({ monster, inParty: true })),
      ...state.farm.map((monster) => ({ monster, inParty: false })),
    ];
    const filtered = entries.filter((entry) => {
      if (this.filterMode === 'party') return entry.inParty;
      if (this.filterMode === 'box') return !entry.inParty;
      return true;
    });
    return filtered.sort((a, b) => this.compareEntries(a, b));
  }

  private compareEntries(a: RosterEntry, b: RosterEntry): number {
    const aSpecies = getSpecies(a.monster.speciesId);
    const bSpecies = getSpecies(b.monster.speciesId);
    let difference = 0;
    if (this.sortMode === 'rank') difference = rankScore(bSpecies.rank) - rankScore(aSpecies.rank);
    else if (this.sortMode === 'level') difference = b.monster.level - a.monster.level;
    else if (this.sortMode === 'luck') difference = (b.monster.luck ?? 1) - (a.monster.luck ?? 1);
    else difference = this.monsterPower(b.monster) - this.monsterPower(a.monster);
    if (difference !== 0) return difference;
    if (a.inParty !== b.inParty) return a.inParty ? -1 : 1;
    return aSpecies.name.localeCompare(bSpecies.name, 'ja');
  }

  private monsterPower(monster: MonsterInstance): number {
    const stats = maxStats(monster);
    return (
      stats.hp +
      stats.mp * 2 +
      stats.atk * 4 +
      stats.def * 4 +
      stats.agi * 3 +
      stats.wis * 3 +
      monster.level * 8 +
      (monster.luck ?? 1) * 2
    );
  }

  private partyPower(state: GameState): number {
    return state.party.reduce((sum, monster) => sum + this.monsterPower(monster), 0);
  }

  private pageSize(): number {
    if (isPortrait()) return this.mode === 'party' ? 8 : 16;
    return this.mode === 'party' ? 6 : 12;
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.ownedEntries().length / this.pageSize()));
  }

  private pageEntries(): RosterEntry[] {
    const size = this.pageSize();
    return this.ownedEntries().slice(this.page * size, this.page * size + size);
  }

  private clampPage(): void {
    this.page = Math.max(0, Math.min(this.page, this.pageCount() - 1));
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
    this.drawBackground(ctx);
    if (isPortrait()) this.drawPortrait(ctx);
    else this.drawLandscape(ctx);
    if (this.toastT > 0) this.drawToast(ctx);
    if (this.overlay !== 'none') this.drawOverlay(ctx);
  }

  private resetRects(): void {
    this.backRect = null;
    this.tabRects = [];
    this.partyRects = [];
    this.rosterHits = [];
    this.sortRect = null;
    this.filterRect = null;
    this.prevRect = null;
    this.nextRect = null;
    this.primaryRect = null;
    this.detailRect = null;
    this.cancelReplaceRect = null;
    this.navRects = [];
    this.modalRect = null;
    this.modalOptionRects = [];
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    if (imageReady(MONSTER_BACKGROUND)) {
      drawCoverImage(ctx, MONSTER_BACKGROUND, { x: 0, y: 0, w: view.w, h: view.h }, 0.5, 0.48);
    } else {
      drawFancyBg(ctx, 'home', this.time);
    }
    const shade = ctx.createLinearGradient(0, 0, 0, view.h);
    shade.addColorStop(0, 'rgba(2,7,25,0.12)');
    shade.addColorStop(0.55, 'rgba(2,7,24,0.3)');
    shade.addColorStop(1, 'rgba(1,4,16,0.95)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  private drawPortrait(ctx: CanvasRenderingContext2D): void {
    this.drawHeader(ctx, { x: 14, y: 14, w: 60, h: 44 }, view.w / 2, 16);
    this.drawStatusBar(ctx, 14, 72, view.w - 28, 48);
    this.drawTabs(ctx, { x: 14, y: 128, w: view.w - 28, h: 56 });

    if (this.mode === 'party') {
      this.drawPartyPanel(ctx, { x: 14, y: 192, w: view.w - 28, h: 314 }, true);
      this.drawRosterHeader(ctx, { x: 14, y: 516, w: view.w - 28, h: 56 });
      this.drawRosterGrid(ctx, { x: 14, y: 580, w: view.w - 28, h: 248 }, 4, 2, 120);
      this.drawPager(ctx, { x: 166, y: 828, w: 148, h: 22 });
    } else {
      this.drawBoxSummary(ctx, { x: 14, y: 196, w: view.w - 28, h: 80 });
      this.drawRosterGrid(ctx, { x: 14, y: 284, w: view.w - 28, h: 536 }, 4, 4, 128);
      this.drawPager(ctx, { x: 166, y: 824, w: 148, h: 26 });
    }

    this.drawActionStrip(ctx, { x: 14, y: 852, w: view.w - 28, h: 70 });
    this.drawBottomNav(ctx, { x: 0, y: 934, w: view.w, h: 106 });
  }

  private drawLandscape(ctx: CanvasRenderingContext2D): void {
    this.drawHeader(ctx, { x: 14, y: 14, w: 60, h: 44 }, 276, 17);
    this.drawStatusBar(ctx, 500, 14, 446, 48);
    this.drawTabs(ctx, { x: 18, y: 76, w: 500, h: 46 });

    if (this.mode === 'party') {
      this.drawPartyPanel(ctx, { x: 18, y: 132, w: 500, h: 374 }, false);
      this.drawRosterHeader(ctx, { x: 534, y: 76, w: 408, h: 46 });
      this.drawRosterGrid(ctx, { x: 534, y: 132, w: 408, h: 306 }, 3, 2, 149);
      this.drawPager(ctx, { x: 664, y: 442, w: 148, h: 22 });
      this.drawActionStrip(ctx, { x: 534, y: 468, w: 408, h: 38 });
    } else {
      this.drawBoxSummary(ctx, { x: 18, y: 132, w: 260, h: 84 });
      this.drawRosterGrid(ctx, { x: 294, y: 76, w: 648, h: 388 }, 6, 2, 190);
      this.drawPager(ctx, { x: 350, y: 470, w: 148, h: 26 });
      this.drawActionStrip(ctx, { x: 516, y: 470, w: 426, h: 36 });
    }
    this.drawBottomNav(ctx, { x: 0, y: 514, w: view.w, h: 110 });
  }

  private drawHeader(ctx: CanvasRenderingContext2D, backRect: Rect, titleX: number, titleY: number): void {
    this.backRect = backRect;
    ctx.save();
    ctx.shadowColor = 'rgba(255,194,55,0.45)';
    ctx.shadowBlur = 8;
    backPlaquePath(ctx, backRect, 0);
    const fill = ctx.createLinearGradient(0, backRect.y, 0, backRect.y + backRect.h);
    fill.addColorStop(0, '#4c3618');
    fill.addColorStop(1, '#17142a');
    ctx.fillStyle = fill;
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

    drawText(ctx, 'モンスター', titleX, titleY, {
      align: 'center',
      color: '#ffe183',
      font: `bold ${isPortrait() ? 25 : 27}px ${UI_FONT}`,
      shadow: true,
    });
    ctx.save();
    ctx.strokeStyle = 'rgba(231,195,98,0.78)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(titleX - 145, titleY + 17);
    ctx.lineTo(titleX - 82, titleY + 17);
    ctx.moveTo(titleX + 82, titleY + 17);
    ctx.lineTo(titleX + 145, titleY + 17);
    ctx.stroke();
    ctx.restore();
  }

  private drawStatusBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const state = requireState(this.app);
    const rank = state.party[0]?.level ?? 1;
    const cellW = w / 4;
    const iconSize = Math.min(23, h - 22);
    const font = `bold ${w < 460 ? 12 : 14}px ${UI_FONT}`;

    ctx.save();
    rounded(ctx, x, y, w, h, 12);
    ctx.fillStyle = 'rgba(5,10,30,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(218,183,112,0.7)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * cellW, y + 8);
      ctx.lineTo(x + i * cellW, y + h - 8);
      ctx.strokeStyle = 'rgba(190,204,235,0.24)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    this.drawRankAvatar(ctx, x + 8, y + 8, 32);
    drawText(ctx, `Rank ${rank}`, x + cellW - 7, y + h / 2 - 8, { align: 'right', font, color: '#f4f6ff' });
    drawIcon(ctx, faBolt, x + cellW + 8, y + (h - iconSize) / 2, iconSize, '#61f599');
    const meterX = x + cellW + 36;
    const meterW = cellW - 44;
    const segmentGap = 2;
    const segmentW = (meterW - segmentGap * 3) / 4;
    for (let i = 0; i < 4; i++) {
      rounded(ctx, meterX + i * (segmentW + segmentGap), y + h / 2 - 5, segmentW, 10, 3);
      ctx.fillStyle = '#55d992';
      ctx.fill();
      ctx.strokeStyle = 'rgba(216,255,235,0.7)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    drawIcon(ctx, faGem, x + cellW * 2 + 9, y + (h - iconSize) / 2, iconSize, '#62d9ff');
    drawText(ctx, String(state.orbs), x + cellW * 3 - 10, y + h / 2 - 8, { align: 'right', font, color: '#f4f6ff' });
    drawIcon(ctx, faCoins, x + cellW * 3 + 9, y + (h - iconSize) / 2, iconSize, '#ffcd54');
    drawText(ctx, `${state.gold}G`, x + w - 9, y + h / 2 - 8, { align: 'right', font, color: '#f4f6ff' });
    ctx.restore();
  }

  private drawRankAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const lead = requireState(this.app).party[0];
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#16478a';
    ctx.fillRect(x, y, size, size);
    if (lead) {
      const species = getSpecies(lead.speciesId);
      if (!drawSpeciesPortrait(ctx, species, { x: x - 3, y: y - 3, w: size + 6, h: size + 6 })) {
        drawMonster(ctx, species.family, species.palette, x, y, 2);
      }
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

  private drawTabs(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const gap = 7;
    const tabW = (rect.w - gap) / 2;
    this.tabRects = [];
    ['パーティ', 'ボックス'].forEach((label, index) => {
      const tabRect = { x: rect.x + index * (tabW + gap), y: rect.y, w: tabW, h: rect.h };
      this.tabRects.push(tabRect);
      const active = (index === 0 && this.mode === 'party') || (index === 1 && this.mode === 'box');
      ctx.save();
      rounded(ctx, tabRect.x, tabRect.y, tabRect.w, tabRect.h, 11);
      const fill = ctx.createLinearGradient(0, tabRect.y, 0, tabRect.y + tabRect.h);
      fill.addColorStop(0, active ? '#24599f' : '#182846');
      fill.addColorStop(1, active ? '#0b326f' : '#091429');
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = active ? '#59dfff' : '#8a7446';
      ctx.lineWidth = active ? 2.5 : 1.4;
      ctx.stroke();
      if (active) {
        ctx.shadowColor = 'rgba(65,218,255,0.72)';
        ctx.shadowBlur = 10;
        ctx.stroke();
      }
      drawIcon(ctx, index === 0 ? faUserGroup : faBoxArchive, tabRect.x + 19, tabRect.y + 13, 22, active ? '#ffe079' : '#bdc8dc');
      drawText(ctx, label, tabRect.x + tabRect.w / 2 + 8, tabRect.y + 12, {
        align: 'center',
        color: active ? '#ffffff' : '#d2d9e7',
        font: `bold ${isPortrait() ? 17 : 16}px ${UI_FONT}`,
      });
      ctx.restore();
    });
  }

  private drawPartyPanel(ctx: CanvasRenderingContext2D, rect: Rect, portrait: boolean): void {
    const state = requireState(this.app);
    this.drawPanelShell(ctx, rect, true);
    const titleRect = {
      x: rect.x + rect.w * 0.18,
      y: rect.y + 12,
      w: rect.w * 0.64,
      h: portrait ? 46 : 48,
    };
    this.drawTitlePlaque(ctx, titleRect, 'パーティ編成');

    const summaryY = titleRect.y + titleRect.h + 10;
    drawText(ctx, '総合力', rect.x + 24, summaryY, { color: '#f0d17a', font: `bold 13px ${UI_FONT}` });
    drawText(ctx, this.partyPower(state).toLocaleString('ja-JP'), rect.x + 88, summaryY - 5, {
      color: '#ffe083',
      font: `bold 22px ${UI_FONT}`,
    });
    drawIcon(ctx, faClover, rect.x + rect.w * 0.55, summaryY - 1, 19, '#79e38d');
    drawText(ctx, `ラック ${partyLuck(state)}`, rect.x + rect.w * 0.55 + 26, summaryY, {
      color: '#b8ef9c',
      font: `bold 14px ${UI_FONT}`,
    });
    drawText(
      ctx,
      `ドロップ +${Math.round((luckDropMult(state) - 1) * 100)}%  ・  探索オーブ +${luckOrbBonus(state)}`,
      rect.x + rect.w - 22,
      summaryY + 24,
      { align: 'right', color: '#afbfda', font: `14px ${UI_FONT}` },
    );

    const cardsY = summaryY + 48;
    const cardsH = rect.y + rect.h - cardsY - 14;
    const gap = portrait ? 8 : 10;
    const innerX = rect.x + 12;
    const innerW = rect.w - 24;
    const cardW = (innerW - gap * (PARTY_MAX - 1)) / PARTY_MAX;
    this.partyRects = [];
    for (let i = 0; i < PARTY_MAX; i++) {
      const cardRect = { x: innerX + i * (cardW + gap), y: cardsY, w: cardW, h: cardsH };
      this.partyRects.push(cardRect);
      this.drawPartyCard(ctx, cardRect, state.party[i] ?? null, i);
    }
  }

  private drawPartyCard(ctx: CanvasRenderingContext2D, rect: Rect, monster: MonsterInstance | null, index: number): void {
    const replacing = this.replacementUid !== null;
    const selected = monster?.uid === this.selectedUid || (replacing && index === this.replacementSlot);
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 10);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, monster ? '#132b54' : '#101c33');
    fill.addColorStop(1, '#050b19');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = selected ? '#62e3ff' : monster ? '#d4b45c' : 'rgba(151,170,207,0.34)';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();
    if (selected) {
      ctx.shadowColor = 'rgba(71,223,255,0.78)';
      ctx.shadowBlur = 14;
      ctx.stroke();
    }
    ctx.restore();

    if (!monster) {
      const iconSize = Math.min(38, rect.w * 0.38);
      drawIcon(ctx, faPlus, rect.x + (rect.w - iconSize) / 2, rect.y + rect.h * 0.33, iconSize, '#a98e59', 0.8);
      drawText(ctx, '編成', rect.x + rect.w / 2, rect.y + rect.h * 0.68, {
        align: 'center',
        color: '#9e987f',
        font: `bold 14px ${UI_FONT}`,
      });
      return;
    }

    const species = getSpecies(monster.speciesId);
    const artH = Math.min(rect.h * 0.57, rect.w * 1.18);
    ctx.save();
    rounded(ctx, rect.x + 3, rect.y + 3, rect.w - 6, artH, 8);
    ctx.clip();
    if (!drawSpeciesPortrait(ctx, species, { x: rect.x - 8, y: rect.y - 8, w: rect.w + 16, h: artH + 25 })) {
      const scale = Math.max(4, Math.floor(rect.w / 18));
      drawMonster(ctx, species.family, species.palette, rect.x + rect.w / 2 - scale * 8, rect.y + 8, scale);
    }
    const fade = ctx.createLinearGradient(0, rect.y + artH * 0.45, 0, rect.y + artH);
    fade.addColorStop(0, 'rgba(4,9,25,0)');
    fade.addColorStop(1, 'rgba(4,9,25,0.84)');
    ctx.fillStyle = fade;
    ctx.fillRect(rect.x + 3, rect.y + artH * 0.4, rect.w - 6, artH * 0.65);
    ctx.restore();
    drawSpeciesBadge(ctx, species, { x: rect.x + 7, y: rect.y + 7, w: 28, h: 28 });
    drawIcon(ctx, faStar, rect.x + rect.w - 28, rect.y + 9, 14, RANK_COLORS[species.rank]);
    drawText(ctx, String(rankStars(species.rank)), rect.x + rect.w - 8, rect.y + 8, {
      align: 'right',
      color: RANK_COLORS[species.rank],
      font: `bold 13px ${UI_FONT}`,
    });

    const nameY = rect.y + artH - 1;
    drawText(ctx, this.shortName(monster.nickname, rect.w < 110 ? 6 : 8), rect.x + rect.w / 2, nameY, {
      align: 'center',
      color: '#ffffff',
      font: `bold ${rect.w < 110 ? 15 : 16}px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, `Lv ${monster.level}`, rect.x + 8, nameY + 27, { color: '#e3ebfa', font: `bold 14px ${UI_FONT}` });
    drawIcon(ctx, faClover, rect.x + rect.w - 39, nameY + 28, 13, '#78e28b');
    drawText(ctx, String(monster.luck ?? 1), rect.x + rect.w - 8, nameY + 24, {
      align: 'right',
      color: '#9cef9d',
      font: `bold 14px ${UI_FONT}`,
    });
    const stats = maxStats(monster);
    drawGauge(
      ctx,
      rect.x + 8,
      rect.y + rect.h - 16,
      rect.w - 16,
      7,
      stats.hp === 0 ? 0 : monster.hp / stats.hp,
      hpColor(monster.hp / stats.hp),
    );
  }

  private drawRosterHeader(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const state = requireState(this.app);
    const total = state.party.length + state.farm.length;
    const capacity = PARTY_MAX + FARM_MAX;
    const titleW = rect.w < 420 ? rect.w * 0.47 : rect.w * 0.5;
    const titleRect = { x: rect.x, y: rect.y, w: titleW, h: rect.h };
    ctx.save();
    beveledPath(ctx, titleRect, 8);
    const fill = ctx.createLinearGradient(0, titleRect.y, 0, titleRect.y + titleRect.h);
    fill.addColorStop(0, '#16315b');
    fill.addColorStop(1, '#07152d');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#d7b85e';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    drawText(ctx, '所持モンスター', titleRect.x + 13, titleRect.y + 13, {
      color: '#ffe083',
      font: `bold ${rect.w < 420 ? 14 : 16}px ${UI_FONT}`,
    });
    drawText(ctx, `${total} / ${capacity}`, titleRect.x + titleRect.w - 12, titleRect.y + 13, {
      align: 'right',
      color: '#f1f4ff',
      font: `bold 14px ${UI_FONT}`,
    });
    ctx.restore();

    const gap = 7;
    const buttonW = (rect.w - titleW - gap * 2) / 2;
    this.sortRect = { x: rect.x + titleW + gap, y: rect.y, w: buttonW, h: rect.h };
    this.filterRect = { x: this.sortRect.x + buttonW + gap, y: rect.y, w: buttonW, h: rect.h };
    this.drawCompactButton(ctx, this.sortRect, this.sortLabel(), faArrowDownWideShort);
    this.drawCompactButton(ctx, this.filterRect, this.filterLabel(), faFilter);
  }

  private drawBoxSummary(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const state = requireState(this.app);
    this.drawPanelShell(ctx, rect, false);
    drawIcon(ctx, faBoxArchive, rect.x + 18, rect.y + 19, 33, '#6ce2ff');
    drawText(ctx, 'モンスター一覧', rect.x + 64, rect.y + 12, {
      color: '#ffe083',
      font: `bold 18px ${UI_FONT}`,
    });
    drawText(ctx, `所持 ${state.party.length + state.farm.length} / ${PARTY_MAX + FARM_MAX}`, rect.x + 64, rect.y + 39, {
      color: '#c7d4ea',
      font: `14px ${UI_FONT}`,
    });

    const buttonW = isPortrait() ? 112 : 110;
    this.sortRect = { x: rect.x + rect.w - buttonW * 2 - 16, y: rect.y + 10, w: buttonW - 5, h: rect.h - 20 };
    this.filterRect = { x: rect.x + rect.w - buttonW - 8, y: rect.y + 10, w: buttonW, h: rect.h - 20 };
    this.drawCompactButton(ctx, this.sortRect, this.sortLabel(), faArrowDownWideShort);
    this.drawCompactButton(ctx, this.filterRect, this.filterLabel(), faFilter);
  }

  private drawCompactButton(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    label: string,
    icon: typeof faFilter,
  ): void {
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 9);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, '#243f67');
    fill.addColorStop(1, '#09172f');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#b99d58';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const iconSize = Math.min(20, rect.h - 18);
    drawIcon(ctx, icon, rect.x + 10, rect.y + (rect.h - iconSize) / 2, iconSize, '#eacb70');
    drawText(ctx, label, rect.x + rect.w - 8, rect.y + rect.h / 2 - 8, {
      align: 'right',
      color: '#eef3ff',
      font: `bold 13px ${UI_FONT}`,
    });
    ctx.restore();
  }

  private sortLabel(): string {
    return SORT_OPTIONS.find((option) => option.value === this.sortMode)?.label ?? 'おすすめ順';
  }

  private filterLabel(): string {
    return FILTER_OPTIONS.find((option) => option.value === this.filterMode)?.label ?? 'すべて';
  }

  private drawRosterGrid(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    columns: number,
    rows: number,
    cellH: number,
  ): void {
    const entries = this.pageEntries();
    const gap = 8;
    const cellW = (rect.w - gap * (columns - 1)) / columns;
    this.rosterHits = [];
    for (let i = 0; i < columns * rows; i++) {
      const column = i % columns;
      const row = Math.floor(i / columns);
      const cardRect = {
        x: rect.x + column * (cellW + gap),
        y: rect.y + row * (cellH + gap),
        w: cellW,
        h: cellH,
      };
      const entry = entries[i] ?? null;
      this.rosterHits.push({ rect: cardRect, uid: entry?.monster.uid ?? null });
      this.drawRosterCard(ctx, cardRect, entry);
    }
  }

  private drawRosterCard(ctx: CanvasRenderingContext2D, rect: Rect, entry: RosterEntry | null): void {
    const selected = entry?.monster.uid === this.selectedUid;
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 9);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, entry ? '#142846' : 'rgba(11,24,45,0.6)');
    fill.addColorStop(1, entry ? '#050b1a' : 'rgba(5,12,25,0.5)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = selected ? '#62e4ff' : entry ? '#9f8448' : 'rgba(116,139,177,0.28)';
    ctx.lineWidth = selected ? 3 : 1.3;
    ctx.stroke();
    if (selected) {
      ctx.shadowColor = 'rgba(69,222,255,0.82)';
      ctx.shadowBlur = 13;
      ctx.stroke();
    }
    ctx.restore();

    if (!entry) {
      const size = Math.min(31, rect.w * 0.28);
      drawIcon(ctx, faDragon, rect.x + (rect.w - size) / 2, rect.y + rect.h / 2 - size / 2, size, '#496080', 0.24);
      return;
    }

    const monster = entry.monster;
    const species = getSpecies(monster.speciesId);
    const artH = Math.max(52, rect.h - 47);
    ctx.save();
    rounded(ctx, rect.x + 3, rect.y + 3, rect.w - 6, artH, 7);
    ctx.clip();
    if (!drawSpeciesPortrait(ctx, species, { x: rect.x - 6, y: rect.y - 7, w: rect.w + 12, h: artH + 22 })) {
      const scale = Math.max(3, Math.floor(rect.w / 22));
      drawMonster(ctx, species.family, species.palette, rect.x + rect.w / 2 - scale * 8, rect.y + 7, scale);
    }
    const fade = ctx.createLinearGradient(0, rect.y + artH * 0.45, 0, rect.y + artH);
    fade.addColorStop(0, 'rgba(3,8,24,0)');
    fade.addColorStop(1, 'rgba(3,8,24,0.86)');
    ctx.fillStyle = fade;
    ctx.fillRect(rect.x + 3, rect.y + artH * 0.4, rect.w - 6, artH * 0.65);
    ctx.restore();

    const badgeSize = Math.min(27, rect.w * 0.26);
    drawSpeciesBadge(ctx, species, { x: rect.x + 6, y: rect.y + 6, w: badgeSize, h: badgeSize });
    drawIcon(ctx, faStar, rect.x + rect.w - 31, rect.y + 7, 13, RANK_COLORS[species.rank]);
    drawText(ctx, String(rankStars(species.rank)), rect.x + rect.w - 7, rect.y + 6, {
      align: 'right',
      color: RANK_COLORS[species.rank],
      font: `bold 12px ${UI_FONT}`,
    });
    if (entry.inParty) {
      rounded(ctx, rect.x + 6, rect.y + artH - 18, 48, 17, 5);
      ctx.fillStyle = 'rgba(15,108,159,0.9)';
      ctx.fill();
      drawText(ctx, '編成中', rect.x + 30, rect.y + artH - 16, {
        align: 'center',
        color: '#d9f8ff',
        font: `bold 9px ${UI_FONT}`,
      });
    }

    drawText(ctx, this.shortName(monster.nickname, rect.w < 110 ? 6 : 8), rect.x + rect.w / 2, rect.y + artH - 2, {
      align: 'center',
      color: '#ffffff',
      font: `bold ${rect.w < 110 ? 15 : 16}px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, `Lv ${monster.level}`, rect.x + 7, rect.y + rect.h - 19, {
      color: '#dce5f5',
      font: `bold 14px ${UI_FONT}`,
    });
    drawIcon(ctx, faClover, rect.x + rect.w - 34, rect.y + rect.h - 19, 10, '#78e28b');
    drawText(ctx, String(monster.luck ?? 1), rect.x + rect.w - 7, rect.y + rect.h - 20, {
      align: 'right',
      color: '#9cef9d',
      font: `bold 14px ${UI_FONT}`,
    });
  }

  private drawPager(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const pages = this.pageCount();
    this.prevRect = { x: rect.x, y: rect.y, w: 34, h: rect.h };
    this.nextRect = { x: rect.x + rect.w - 34, y: rect.y, w: 34, h: rect.h };
    drawIcon(ctx, faChevronLeft, this.prevRect.x + 7, this.prevRect.y + Math.max(1, (rect.h - 18) / 2), 18, pages > 1 ? '#d9c071' : '#4f5c73');
    drawIcon(ctx, faChevronRight, this.nextRect.x + 9, this.nextRect.y + Math.max(1, (rect.h - 18) / 2), 18, pages > 1 ? '#d9c071' : '#4f5c73');
    drawText(ctx, `${this.page + 1} / ${pages}`, rect.x + rect.w / 2, rect.y + Math.max(0, rect.h / 2 - 7), {
      align: 'center',
      color: '#b9c6dc',
      font: `bold 10px ${UI_FONT}`,
    });
  }

  private drawActionStrip(ctx: CanvasRenderingContext2D, rect: Rect): void {
    ctx.save();
    beveledPath(ctx, rect, Math.min(10, rect.h * 0.2));
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, '#142a4c');
    fill.addColorStop(1, '#071126');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#c2a65e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    if (this.replacementUid) {
      drawIcon(ctx, faUserGroup, rect.x + 15, rect.y + (rect.h - 23) / 2, 23, '#67e3ff');
      drawText(ctx, '交換するパーティ枠を選択', rect.x + 48, rect.y + rect.h / 2 - 9, {
        color: '#fff0a6',
        font: `bold ${rect.h < 45 ? 12 : 14}px ${UI_FONT}`,
      });
      this.cancelReplaceRect = { x: rect.x + rect.w - 105, y: rect.y + 7, w: 91, h: rect.h - 14 };
      this.drawActionButton(ctx, this.cancelReplaceRect, 'やめる', faXmark, false);
      return;
    }

    const monster = this.selectedMonster();
    if (!monster) {
      drawIcon(ctx, faCircleInfo, rect.x + 18, rect.y + (rect.h - 24) / 2, 24, '#6be2ff');
      drawText(ctx, 'モンスターを選んで編成・詳細確認', rect.x + 56, rect.y + rect.h / 2 - 9, {
        color: '#dce6f8',
        font: `bold ${rect.h < 45 ? 12 : 14}px ${UI_FONT}`,
      });
      return;
    }

    const state = requireState(this.app);
    const inParty = state.party.some((entry) => entry.uid === monster.uid);
    const buttonH = rect.h - (rect.h < 45 ? 8 : 14);
    const buttonY = rect.y + (rect.h - buttonH) / 2;
    const actionW = rect.w < 420 ? 102 : 112;
    this.detailRect = { x: rect.x + rect.w - actionW - 12, y: buttonY, w: actionW, h: buttonH };
    this.primaryRect = { x: this.detailRect.x - actionW - 8, y: buttonY, w: actionW, h: buttonH };
    const nameAreaW = this.primaryRect.x - rect.x - 12;
    drawText(ctx, this.shortName(monster.nickname, nameAreaW < 145 ? 7 : 10), rect.x + 18, rect.y + rect.h / 2 - 16, {
      color: '#fff0a2',
      font: `bold ${rect.h < 45 ? 12 : 14}px ${UI_FONT}`,
    });
    drawText(ctx, `Lv${monster.level}  ラック${monster.luck ?? 1}`, rect.x + 18, rect.y + rect.h / 2 + 5, {
      color: '#a9bbd6',
      font: `${rect.h < 45 ? 11 : 13}px ${UI_FONT}`,
    });
    this.drawActionButton(ctx, this.primaryRect, inParty ? 'ボックスへ' : '編成する', inParty ? faBoxArchive : faUserGroup, true);
    this.drawActionButton(ctx, this.detailRect, '詳細', faMagnifyingGlass, false);
  }

  private drawActionButton(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    label: string,
    icon: typeof faXmark,
    primary: boolean,
  ): void {
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 8);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, primary ? '#1b7bb0' : '#294268');
    fill.addColorStop(1, primary ? '#0a3e78' : '#0b182f');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = primary ? '#6fe8ff' : '#bda35d';
    ctx.lineWidth = primary ? 2 : 1.3;
    ctx.stroke();
    const iconSize = Math.min(18, rect.h - 13);
    drawIcon(ctx, icon, rect.x + 9, rect.y + (rect.h - iconSize) / 2, iconSize, primary ? '#ffffff' : '#e8ca72');
    drawText(ctx, label, rect.x + rect.w - 9, rect.y + rect.h / 2 - 7, {
      align: 'right',
      color: '#ffffff',
      font: `bold ${rect.w < 105 ? 13 : 14}px ${UI_FONT}`,
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
      const active = index === 3;
      const focused = this.showFocus && this.navCursor === index;
      rounded(ctx, x, itemY, itemW, itemH, 13);
      const fill = ctx.createLinearGradient(0, itemY, 0, itemY + itemH);
      fill.addColorStop(0, active ? '#17529c' : '#142445');
      fill.addColorStop(1, active ? '#0c2f6b' : '#0a132a');
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = focused ? '#ffe274' : active ? '#53d8ff' : '#40577e';
      ctx.lineWidth = focused ? 3 : active ? 2.5 : 1.5;
      ctx.stroke();
      if (active) {
        ctx.shadowColor = 'rgba(80,220,255,0.72)';
        ctx.shadowBlur = 14;
        rounded(ctx, x + 1, itemY + 1, itemW - 2, itemH - 2, 12);
        ctx.strokeStyle = 'rgba(83,216,255,0.72)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowColor = 'transparent';
      }
      const iconSize = Math.min(34, itemW * 0.42);
      drawIcon(ctx, item.icon, x + (itemW - iconSize) / 2, itemY + 18, iconSize, active ? '#f7d56a' : '#c8d9f8');
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
    ctx.fillStyle = 'rgba(1,3,15,0.78)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();

    if (this.overlay === 'message') {
      const rect = isPortrait()
        ? { x: 42, y: 390, w: view.w - 84, h: 176 }
        : { x: 300, y: 190, w: 360, h: 190 };
      this.modalRect = rect;
      this.drawPanelShell(ctx, rect, true);
      drawIcon(ctx, faCircleInfo, rect.x + rect.w / 2 - 19, rect.y + 26, 38, '#6ce4ff');
      drawText(ctx, this.message, rect.x + rect.w / 2, rect.y + 82, {
        align: 'center',
        color: '#f4f7ff',
        font: `bold 14px ${UI_FONT}`,
      });
      drawText(ctx, 'タップして閉じる', rect.x + rect.w / 2, rect.y + rect.h - 37, {
        align: 'center',
        color: '#aebbd5',
        font: `11px ${UI_FONT}`,
      });
      return;
    }

    const options = this.overlay === 'sort' ? SORT_OPTIONS : FILTER_OPTIONS;
    const height = 76 + options.length * 62;
    const rect = isPortrait()
      ? { x: 62, y: (view.h - height) / 2, w: view.w - 124, h: height }
      : { x: 310, y: (view.h - height) / 2, w: 340, h: height };
    this.modalRect = rect;
    this.drawPanelShell(ctx, rect, true);
    drawText(ctx, this.overlay === 'sort' ? '並び替え' : '絞り込み', rect.x + rect.w / 2, rect.y + 19, {
      align: 'center',
      color: '#ffe083',
      font: `bold 20px ${UI_FONT}`,
    });
    this.modalOptionRects = [];
    options.forEach((option, index) => {
      const optionRect = { x: rect.x + 18, y: rect.y + 58 + index * 62, w: rect.w - 36, h: 56 };
      this.modalOptionRects.push(optionRect);
      const current = this.overlay === 'sort' ? option.value === this.sortMode : option.value === this.filterMode;
      const focused = index === this.overlayCursor;
      rounded(ctx, optionRect.x, optionRect.y, optionRect.w, optionRect.h, 8);
      ctx.fillStyle = current ? '#164f8e' : '#101d36';
      ctx.fill();
      ctx.strokeStyle = focused ? '#ffe173' : current ? '#5ee2ff' : '#52688d';
      ctx.lineWidth = focused ? 2.5 : 1.2;
      ctx.stroke();
      if (current) drawIcon(ctx, faStar, optionRect.x + 16, optionRect.y + 12, 18, '#ffe06f');
      drawText(ctx, option.label, optionRect.x + optionRect.w / 2, optionRect.y + 17, {
        align: 'center',
        color: '#f3f6ff',
        font: `bold 15px ${UI_FONT}`,
      });
    });
  }

  private drawToast(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.min(1, this.toastT * 2);
    const width = isPortrait() ? 252 : 290;
    const rect = { x: (view.w - width) / 2, y: isPortrait() ? 137 : 80, w: width, h: 38 };
    ctx.save();
    ctx.globalAlpha = alpha;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 19);
    ctx.fillStyle = 'rgba(5,21,42,0.94)';
    ctx.fill();
    ctx.strokeStyle = '#68e4ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawText(ctx, this.toast, rect.x + rect.w / 2, rect.y + 10, {
      align: 'center',
      color: '#e8fbff',
      font: `bold 12px ${UI_FONT}`,
    });
    ctx.restore();
  }

  private drawPanelShell(ctx: CanvasRenderingContext2D, rect: Rect, gold: boolean): void {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 10;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 13);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, 'rgba(18,39,75,0.96)');
    fill.addColorStop(1, 'rgba(4,11,26,0.97)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = gold ? '#d3ae55' : '#607da8';
    ctx.lineWidth = gold ? 2.2 : 1.5;
    ctx.stroke();
    rounded(ctx, rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, 10);
    ctx.strokeStyle = gold ? 'rgba(255,232,143,0.38)' : 'rgba(169,201,238,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private drawTitlePlaque(ctx: CanvasRenderingContext2D, rect: Rect, label: string): void {
    ctx.save();
    beveledPath(ctx, rect, 10);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, '#35255d');
    fill.addColorStop(1, '#151331');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#d8b859';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawIcon(ctx, faGem, rect.x + 18, rect.y + (rect.h - 24) / 2, 24, '#57dfff');
    drawText(ctx, label, rect.x + rect.w / 2 + 7, rect.y + rect.h / 2 - 12, {
      align: 'center',
      color: '#ffe485',
      font: `bold ${rect.h < 48 ? 19 : 21}px ${UI_FONT}`,
      shadow: true,
    });
    ctx.restore();
  }

  private shortName(name: string, length: number): string {
    return name.length > length ? `${name.slice(0, Math.max(1, length - 1))}…` : name;
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
