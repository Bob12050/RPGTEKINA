// ============================================================
// あそびかた説明
// ============================================================
import type { App } from '../core/app';
import type { Scene } from '../core/scene';
import { drawText, drawWindow, FONT_SMALL, SCREEN_H, SCREEN_W } from '../ui/window';

const PAGES: string[][] = [
  [
    '【そうさ】',
    '・やじるしキー / WASD … いどう・カーソル',
    '・Z / Enter / スペース … けってい・はなす・しらべる',
    '・X / Esc … キャンセル・メニューをひらく',
    '',
    'フィールドで あるくと モンスターが とびだしてくる。',
    'むらには かいふく・ショップ・はいごう・ぼくじょうが ある。',
  ],
  [
    '【スカウト】',
    'たたかいで「スカウト」を えらぶと なかまに さそえる。',
    '・なかまの こうげき力が たかいほど せいこうしやすい',
    '・あいての HPを へらすと ぐっと せいこうしやすくなる',
    '・「モンスターのごちそう」で さらに アップ!',
    '',
    'なかまは 3たいまで パーティに。あふれたら ぼくじょうへ。',
  ],
  [
    '【はいごう】',
    'むらの はいごうじいさんに レベル10いじょうの 2たいを',
    'あずけると あたらしい モンスターが うまれる!',
    '・うまれる モンスターは 親の けいとうで きまる',
    '・親の とくぎを 3つまで ひきつげる',
    '・プラス値が あがり ステータスも きょうかされる',
    '・とくべつな くみあわせで でんせつの モンスターも…!?',
  ],
  [
    '【もくひょう】',
    'ごうかざんの おくに ひそむ「まりゅうテキーナ」を たおせ!',
    '',
    'そうげん → もり → どうくつ → かざん のじゅんに',
    'つよい モンスターが まっている。',
    'スカウトと はいごうで さいきょうの パーティを つくろう!',
  ],
];

export class HelpScene implements Scene {
  private page = 0;

  constructor(private app: App) {}

  update(): void {
    const key = this.app.input.poll();
    if (!key) return;
    if (key === 'cancel') {
      this.app.scenes.pop();
      return;
    }
    if (key === 'confirm' || key === 'right' || key === 'down') {
      this.page += 1;
      if (this.page >= PAGES.length) this.app.scenes.pop();
    } else if (key === 'left' || key === 'up') {
      this.page = Math.max(0, this.page - 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const w = 720;
    const h = 420;
    const x = (SCREEN_W - w) / 2;
    const y = (SCREEN_H - h) / 2;
    drawWindow(ctx, x, y, w, h);
    const page = PAGES[Math.min(this.page, PAGES.length - 1)]!;
    page.forEach((line, i) => {
      drawText(ctx, line, x + 40, y + 40 + i * 38, { color: i === 0 ? '#ffd94a' : '#ffffff' });
    });
    drawText(ctx, `${this.page + 1} / ${PAGES.length}  (Z: つぎへ / X: とじる)`, x + w / 2, y + h - 40, {
      align: 'center',
      font: FONT_SMALL,
      color: '#aaaacc',
    });
  }
}
