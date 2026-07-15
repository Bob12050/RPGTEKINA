// ============================================================
// スマホゲー風のリッチ背景(グラデ+トップグロー+浮遊パーティクル+ビネット)
// 画像アセットなしで「それっぽさ」を出すための共通描画。
// ============================================================
import { view } from './window';

export type BgTheme = 'title' | 'home' | 'gacha' | 'map' | 'battle' | 'battleBoss' | 'stage';

interface ThemeDef {
  top: string;
  bottom: string;
  /** 画面上部の放射光の色(rgba) */
  glow: string;
  /** 浮遊パーティクルの色(rgb部分のみ) */
  particle: string;
}

const THEMES: Record<BgTheme, ThemeDef> = {
  title: { top: '#0a0a2e', bottom: '#1a2a4a', glow: 'rgba(90,120,255,0.20)', particle: '255,255,255' },
  home: { top: '#141c3a', bottom: '#2a2450', glow: 'rgba(120,140,255,0.22)', particle: '160,190,255' },
  gacha: { top: '#1c0a38', bottom: '#3a1a5e', glow: 'rgba(220,120,255,0.25)', particle: '255,220,150' },
  map: { top: '#0a1c30', bottom: '#164a5a', glow: 'rgba(90,220,220,0.16)', particle: '150,240,230' },
  battle: { top: '#101828', bottom: '#24344d', glow: 'rgba(110,140,220,0.14)', particle: '170,190,230' },
  battleBoss: { top: '#1a0a14', bottom: '#3d1424', glow: 'rgba(255,80,60,0.20)', particle: '255,140,90' },
  stage: { top: '#0a1020', bottom: '#182438', glow: 'rgba(110,140,220,0.16)', particle: '170,190,230' },
};

/** テーマ背景を描く。time を渡すとパーティクルがゆっくり漂う */
export function drawFancyBg(ctx: CanvasRenderingContext2D, theme: BgTheme, time: number): void {
  const t = THEMES[theme];
  // ベースの縦グラデ
  const g = ctx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, t.top);
  g.addColorStop(1, t.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);

  // 上部の放射光(スポットライト感)
  const glow = ctx.createRadialGradient(view.w / 2, -view.h * 0.2, 0, view.w / 2, -view.h * 0.2, view.h * 0.9);
  glow.addColorStop(0, t.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, view.w, view.h);

  // ふわふわ上昇するパーティクル(決定的配置なのでチラつかない)
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const seed = i * 127.31;
    const x = (seed * 7.3) % view.w;
    const speed = 8 + (i % 5) * 4;
    const y = view.h - ((seed + time * speed) % (view.h + 40)) + 20;
    const size = 1.5 + (i % 3);
    const tw = 0.25 + 0.3 * Math.abs(Math.sin(time * 1.2 + i));
    ctx.fillStyle = `rgba(${t.particle},${tw})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 四隅を落とすビネット
  const vg = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.45, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, view.w, view.h);
}
