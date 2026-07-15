// ============================================================
// あそびかた説明
// ============================================================
import type { App } from '../core/app';
import type { Scene } from '../core/scene';
import { Button, drawText, drawWindow, FONT, FONT_SMALL, view, isPortrait, wrapText } from '../ui/window';

const PAGES: string[][] = [
  [
    '【そうさ】',
    'ぜんぶ タップで OK!',
    '・ボタンや メニューを タップ → けってい',
    '・「◀」ボタンを タップ → もどる',
    '・PCは クリック か 矢印キー + Z / Xでも あそべる',
    '',
    'きょてん(ホーム)の ボタンから すべての',
    'きのうへ とべる。「モンスター」で パーティの いれかえ!',
  ],
  [
    '【クエスト】',
    '「クエスト」を ひらくと 3しゅるいから えらべる!',
    '・⚔️ノーマル: ストーリーを すすめる ぼうけん',
    '・🎁イベント: とくべつな ボス & レアな なかま',
    '・⭐育成: メタルを たおして レベルを かせぐ',
    '・エリアの さいごは 👑ボス! かつと つぎのエリアへ',
    '・はじめての クリアで ガチャの「オーブ」が もらえる!',
  ],
  [
    '【ガチャ】',
    'きょてんの「ガチャ」で オーブを つかって',
    'モンスターを おむかえ しよう!',
    '・たんぱつ 5オーブ / 10れん 45オーブ(おトク)',
    '・10れんは ★4いじょう 1たい かくてい!',
    '・★6や ★7の でんせつ・神モンスターも ねらえる',
    'なかまは 4たいまで パーティに。あふれたら ボックスへ。',
  ],
  [
    '【もくひょう】',
    'クエストを すすめて さいおくに ひそむ',
    '「まりゅうテキーナ」を たおすのが めざす みち!',
    '',
    'クリアごも しれんの クエストで かみクラスの',
    'モンスターが まちうける。ずかん コンプリートも めざそう!',
  ],
];

export class HelpScene implements Scene {
  private page = 0;
  private closeButton = new Button();

  constructor(private app: App) {}

  private next(): void {
    this.page += 1;
    if (this.page >= PAGES.length) this.app.scenes.pop();
  }

  update(): void {
    const tap = this.app.input.takeTap();
    if (tap) {
      if (this.closeButton.contains(tap.x, tap.y)) this.app.scenes.pop();
      else this.next(); // どこをタップしても つぎのページへ
      return;
    }
    const key = this.app.input.poll();
    if (!key) return;
    if (key === 'cancel') {
      this.app.scenes.pop();
      return;
    }
    if (key === 'confirm' || key === 'right' || key === 'down') {
      this.next();
    } else if (key === 'left' || key === 'up') {
      this.page = Math.max(0, this.page - 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, view.w, view.h);
    const p = isPortrait();
    const w = Math.min(720, view.w - 16);
    const h = p ? Math.min(560, view.h - 120) : 420;
    const x = (view.w - w) / 2;
    const y = (view.h - h) / 2;
    drawWindow(ctx, x, y, w, h);
    const page = PAGES[Math.min(this.page, PAGES.length - 1)]!;
    // 縦持ちは小さめフォント+折り返しで収める
    const font = p ? FONT_SMALL : undefined;
    const lineH = p ? 27 : 38;
    let ly = y + 36;
    page.forEach((line, i) => {
      const wrapped = line === '' ? [''] : wrapText(ctx, line, w - 70, font ?? FONT);
      for (const seg of wrapped) {
        drawText(ctx, seg, x + 32, ly, { color: i === 0 ? '#ffd94a' : '#ffffff', font });
        ly += lineH;
      }
    });
    this.closeButton.draw(ctx, x + w - 62, y + 12, 50, 42, '✕', { color: '#3a3a55', font: FONT_SMALL });
    drawText(ctx, `${this.page + 1} / ${PAGES.length}  (タップで つぎへ)`, x + w / 2, y + h - 36, {
      align: 'center',
      font: FONT_SMALL,
      color: '#aaaacc',
    });
  }
}
