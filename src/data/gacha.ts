// ============================================================
// ガチャ(モンスター召喚)の定義と抽選ロジック
//   通貨は「オーブ」。クエストの初回クリア報酬などで手に入る。
//   排出プールはランクE〜Sの全種族(ストーリーボスを除く)。
//   F ランク種はガチャに出ない(序盤クエストのドロップで仲間になる)。
// ============================================================
import { random, randInt, type RandomSource } from '../core/rng';
import { rankScore, type Rank, type SpeciesDef } from '../core/types';
import { SPECIES } from './monsters';

/** 単発の消費オーブ */
export const SINGLE_COST = 5;
/** 10連の消費オーブ(1回ぶんおトク) */
export const MULTI_COST = 45;
export const MULTI_COUNT = 10;

/** ガチャに出ない種族(ストーリーボス専用) */
export const GACHA_EXCLUDED: ReadonlySet<string> = new Set(['tekina']);

/** ランクごとの排出率(合計100)。ランク内は均等抽選 */
export const RANK_RATES: readonly { rank: Rank; weight: number }[] = [
  { rank: 'E', weight: 30 },
  { rank: 'D', weight: 35 },
  { rank: 'C', weight: 20 },
  { rank: 'B', weight: 10 },
  { rank: 'A', weight: 4 },
  { rank: 'S', weight: 1 },
];

/** 10連の最終枠は このランク以上(★4以上)が確定 */
export const GUARANTEE_MIN_RANK: Rank = 'C';

/** 指定ランクの排出候補 */
export function gachaPool(rank: Rank): SpeciesDef[] {
  return SPECIES.filter((s) => s.rank === rank && !GACHA_EXCLUDED.has(s.id));
}

/** その種族がガチャから出るか(図鑑の入手ヒントに使う) */
export function inGachaPool(speciesId: string): boolean {
  const sp = SPECIES.find((s) => s.id === speciesId);
  if (!sp || GACHA_EXCLUDED.has(sp.id)) return false;
  return RANK_RATES.some((r) => r.rank === sp.rank);
}

/** ランクを重みで抽選する(minRank 以上に限定可) */
function rollRank(rand: RandomSource, minRank?: Rank): Rank {
  const candidates = RANK_RATES.filter((r) => (minRank ? rankScore(r.rank) >= rankScore(minRank) : true));
  const total = candidates.reduce((s, r) => s + r.weight, 0);
  let roll = rand() * total;
  for (const r of candidates) {
    roll -= r.weight;
    if (roll <= 0) return r.rank;
  }
  return candidates[candidates.length - 1]!.rank;
}

function pull(rand: RandomSource, minRank?: Rank): SpeciesDef {
  const pool = gachaPool(rollRank(rand, minRank));
  return pool[Math.floor(rand() * pool.length)] ?? pool[0]!;
}

/** 単発ガチャ */
export function pullOne(rand: RandomSource = random): SpeciesDef {
  return pull(rand);
}

/** 10連ガチャ: 9枠は通常抽選 + 最終枠は ★4(Cランク)以上が確定 */
export function pullTen(rand: RandomSource = random): SpeciesDef[] {
  const results: SpeciesDef[] = [];
  for (let i = 0; i < MULTI_COUNT - 1; i++) results.push(pull(rand));
  results.push(pull(rand, GUARANTEE_MIN_RANK));
  return results;
}

/** ガチャ産モンスターの加入レベル。高レアほど少し高い(即戦力感) */
export function gachaLevel(rank: Rank): number {
  const base: Record<Rank, number> = { F: 1, E: 1, D: 2, C: 3, B: 5, A: 8, S: 10 };
  return base[rank] + randInt(0, 2);
}
