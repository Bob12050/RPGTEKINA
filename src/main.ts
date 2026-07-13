// ============================================================
// エントリポイント: キャンバス生成・入力・ゲームループ
// 画面の向き(縦/横)に応じて内部解像度を切り替える。
// ============================================================
import type { App } from './core/app';
import { Input } from './core/input';
import { SceneManager } from './core/scene';
import { setupTouchControls } from './ui/touch';
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

  // 画面の向きに合わせて内部解像度を切り替える(回転してもゲーム続行OK)
  const applySize = () => {
    const portrait = window.innerHeight > window.innerWidth;
    const w = portrait ? PORTRAIT_W : LANDSCAPE_W;
    const h = portrait ? PORTRAIT_H : LANDSCAPE_H;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.aspectRatio = `${w} / ${h}`;
    view.w = w;
    view.h = h;
    ctx.imageSmoothingEnabled = false; // リサイズでリセットされるため再設定
  };
  applySize();
  window.addEventListener('resize', applySize);
  window.addEventListener('orientationchange', applySize);

  const input = new Input();
  input.attach(window);
  setupTouchControls(input); // スマホならタッチ操作UIを表示

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
    ctx!.clearRect(0, 0, view.w, view.h);
    scenes.draw(ctx!);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
