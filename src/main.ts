// ============================================================
// エントリポイント: キャンバス生成・入力・ゲームループ
// 画面の向き(縦/横)に応じて内部解像度を切り替える。
// ============================================================
import type { App } from './core/app';
import { Input } from './core/input';
import { SceneManager } from './core/scene';
import { LANDSCAPE_H, LANDSCAPE_W, PORTRAIT_H, PORTRAIT_W, view } from './ui/window';
import { TitleScene } from './scenes/title';

function boot(): void {
  const root = document.getElementById('game-root');
  if (!root) throw new Error('#game-root が見つかりません');

  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  root.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2Dコンテキストを取得できません');

  // 論理解像度と描画解像度を分離し、文字・高解像度素材をDPR対応で描く。
  let renderScale = 1;
  const applySize = () => {
    const portrait = window.innerHeight > window.innerWidth;
    const w = portrait ? PORTRAIT_W : LANDSCAPE_W;
    const h = portrait ? PORTRAIT_H : LANDSCAPE_H;
    renderScale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const renderW = Math.round(w * renderScale);
    const renderH = Math.round(h * renderScale);
    if (canvas.width !== renderW || canvas.height !== renderH) {
      canvas.width = renderW;
      canvas.height = renderH;
    }
    canvas.style.aspectRatio = `${w} / ${h}`;
    view.w = w;
    view.h = h;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  };
  applySize();
  window.addEventListener('resize', applySize);
  window.addEventListener('orientationchange', applySize);

  const input = new Input();
  input.attach(window);

  // タップ/クリック → キャンバス内部座標に変換して入力キューへ
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const x = ((e.clientX - r.left) / r.width) * view.w;
    const y = ((e.clientY - r.top) / r.height) * view.h;
    input.pushTap(x, y);
  });

  const scenes = new SceneManager();
  const app: App = { input, scenes, state: null };
  scenes.push(new TitleScene(app));

  // E2Eテスト・デバッグ用にアプリ状態を公開する
  (window as unknown as { __game?: App }).__game = app;

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    scenes.update(dt);
    ctx!.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx!.clearRect(0, 0, view.w, view.h);
    scenes.draw(ctx!);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
