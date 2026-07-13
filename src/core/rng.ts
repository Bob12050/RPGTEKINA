// 乱数まわりのユーティリティ。
// テストしやすいよう乱数源を差し替え可能にしてある。

export type RandomSource = () => number;

let source: RandomSource = Math.random;

/** テスト用: 乱数源を差し替える */
export function setRandomSource(fn: RandomSource): void {
  source = fn;
}

export function random(): number {
  return source();
}

/** min 以上 max 以下の整数 */
export function randInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/** 0.0〜1.0 の判定 */
export function chance(p: number): boolean {
  return random() < p;
}

/** 1±spread の変動倍率(例: spread=0.125 → 0.875〜1.125) */
export function variance(spread: number): number {
  return 1 - spread + random() * spread * 2;
}

/** 重み付き抽選 */
export function weightedPick<T>(entries: { weight: number; value: T }[]): T {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let r = random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.value;
  }
  return entries[entries.length - 1]!.value;
}

let uidCounter = 0;

/** モンスター個体などの一意ID */
export function generateUid(): string {
  uidCounter = (uidCounter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${uidCounter.toString(36)}-${Math.floor(random() * 1e9).toString(36)}`;
}
