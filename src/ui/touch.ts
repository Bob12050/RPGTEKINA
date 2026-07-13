// ============================================================
// スマホ用タッチ操作(バーチャル十字キー + A/Bボタン)
// タッチ端末を検出したときだけDOMオーバーレイを生成し、
// Input の仮想キーとしてゲームに流し込む。
// ============================================================
import type { GameKey, Input } from '../core/input';

const STYLE = `
#touch-ui {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  font-family: sans-serif;
  -webkit-user-select: none;
  user-select: none;
}
#touch-pad {
  position: absolute;
  left: 16px;
  bottom: 16px;
  width: min(42vmin, 200px);
  height: min(42vmin, 200px);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.25);
  pointer-events: auto;
  touch-action: none;
}
#touch-pad .arrow {
  position: absolute;
  color: rgba(255, 255, 255, 0.55);
  font-size: min(7vmin, 32px);
  pointer-events: none;
  transform: translate(-50%, -50%);
}
#touch-pad .arrow.active { color: #ffd94a; }
.touch-btn {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.10);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  touch-action: none;
  font-weight: bold;
}
.touch-btn .sub { font-size: 10px; opacity: 0.7; font-weight: normal; }
.touch-btn.active { background: rgba(255, 217, 74, 0.35); border-color: #ffd94a; }
#touch-a {
  right: 18px;
  bottom: 42px;
  width: min(20vmin, 88px);
  height: min(20vmin, 88px);
  font-size: min(6vmin, 26px);
}
#touch-b {
  right: min(28vmin, 134px);
  bottom: 14px;
  width: min(16vmin, 70px);
  height: min(16vmin, 70px);
  font-size: min(5vmin, 21px);
}
#rotate-hint {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(8, 8, 24, 0.85);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  z-index: 11;
  display: none;
  pointer-events: none;
}
@media (orientation: portrait) {
  #rotate-hint.touch-enabled { display: block; }
}
`;

export function setupTouchControls(input: Input): void {
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  let built = false;
  const build = () => {
    if (built) return;
    built = true;
    buildUi(input);
  };
  if (isTouchDevice) build();
  // ハイブリッド端末: 実際にタッチされたら表示する
  else window.addEventListener('touchstart', build, { once: true });
}

function buildUi(input: Input): void {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'touch-ui';

  // ---- 十字パッド ----
  const pad = document.createElement('div');
  pad.id = 'touch-pad';
  const arrows: Partial<Record<GameKey, HTMLElement>> = {};
  const arrowDefs: [GameKey, string, string, string][] = [
    ['up', '▲', '50%', '18%'],
    ['down', '▼', '50%', '82%'],
    ['left', '◀', '18%', '50%'],
    ['right', '▶', '82%', '50%'],
  ];
  for (const [key, ch, x, y] of arrowDefs) {
    const el = document.createElement('div');
    el.className = 'arrow';
    el.textContent = ch;
    el.style.left = x;
    el.style.top = y;
    pad.appendChild(el);
    arrows[key] = el;
  }

  let padPointer: number | null = null;
  let padDir: GameKey | null = null;

  const setDir = (dir: GameKey | null) => {
    if (dir === padDir) return;
    if (padDir) {
      input.virtualRelease(padDir);
      arrows[padDir]?.classList.remove('active');
    }
    if (dir) {
      input.virtualPress(dir);
      arrows[dir]?.classList.add('active');
    }
    padDir = dir;
  };

  const updatePad = (e: PointerEvent) => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return; // デッドゾーンでは方向を維持
    setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };

  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    padPointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    updatePad(e);
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === padPointer) updatePad(e);
  });
  const endPad = (e: PointerEvent) => {
    if (e.pointerId !== padPointer) return;
    padPointer = null;
    setDir(null);
  };
  pad.addEventListener('pointerup', endPad);
  pad.addEventListener('pointercancel', endPad);

  // ---- A / B ボタン ----
  const makeButton = (id: string, label: string, sub: string, key: GameKey) => {
    const btn = document.createElement('div');
    btn.id = id;
    btn.className = 'touch-btn';
    btn.innerHTML = `<span>${label}</span><span class="sub">${sub}</span>`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('active');
      input.virtualPress(key);
    });
    const release = () => {
      btn.classList.remove('active');
      input.virtualRelease(key);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    return btn;
  };
  root.appendChild(pad);
  root.appendChild(makeButton('touch-a', 'A', 'けってい', 'confirm'));
  root.appendChild(makeButton('touch-b', 'B', 'もどる', 'cancel'));
  document.body.appendChild(root);

  // ---- 縦持ちヒント ----
  const hint = document.createElement('div');
  hint.id = 'rotate-hint';
  hint.className = 'touch-enabled';
  hint.textContent = '📱 よこ向きにすると あそびやすいよ!';
  document.body.appendChild(hint);
  // 10秒後に消す
  setTimeout(() => hint.remove(), 10000);
}
