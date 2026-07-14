// ============================================================
// ステージデータ(モンスト・ノマダン式の2階層)
//   エリア(大ステージ) → クエスト(小ステージ)が複数
//   - クエストは同エリア内で上から順に解放
//   - エリアは「前エリアの最後のクエスト」をクリアすると解放
//   - 各クエストは 1〜2WAVE + ボスWAVE の短い連戦(シームレス)
//   新エリア/クエストはここに足すだけ(テストが整合性を検証する)。
// ============================================================

/** 1体の敵 */
export interface StageEnemy {
  speciesId: string;
  level: number;
}

/** エリア(大ステージ) */
export interface AreaDef {
  id: string;
  name: string;
  desc: string;
  /** クリア後のやりこみエリアか */
  postgame: boolean;
}

/** クエスト(小ステージ) */
export interface StageDef {
  id: string;
  areaId: string;
  name: string;
  /** すいしょうレベル(パーティ平均の目安) */
  recLevel: number;
  /** 道中の連戦 */
  waves: StageEnemy[][];
  /** 最後のボスWAVE */
  boss: StageEnemy[];
  /** 初回クリア報酬 */
  rewardGold: number;
  rewardItems: { itemId: string; count: number }[];
}

export const AREAS: AreaDef[] = [
  { id: 'plains', name: 'そよかぜ草原', desc: 'ぼうけんの はじまりの ち。よわい モンスターが おおい。', postgame: false },
  { id: 'forest', name: 'こもれびの森', desc: 'ふかい みどりの もり。しぜんの モンスターの なわばり。', postgame: false },
  { id: 'cave', name: 'ちてい洞窟', desc: 'ひかりの とどかぬ どうくつ。きんぞくや アンデッドが うごめく。', postgame: false },
  { id: 'volcano', name: 'ごうか火山', desc: 'もえさかる かざん。りゅうや あくまの すみか。', postgame: false },
  { id: 'lair', name: 'まりゅうの ねぐら', desc: 'せかいを おびやかす まりゅうテキーナが ねむる さいおくのち。', postgame: false },
  { id: 'trial', name: 'しれんの ま', desc: 'クリアごの ちょうせんしゃを まつ さいきょうの しれん。', postgame: true },
];

const q = (s: StageDef): StageDef => s;

export const STAGES: StageDef[] = [
  // ===== エリア1: そよかぜ草原 =====
  q({
    id: 'plains-1', areaId: 'plains', name: 'はじまりの みち', recLevel: 3,
    waves: [[{ speciesId: 'puni', level: 1 }], [{ speciesId: 'rabbit', level: 2 }, { speciesId: 'mandra', level: 2 }]],
    boss: [{ speciesId: 'goblin', level: 3 }],
    rewardGold: 30, rewardItems: [{ itemId: 'herb', count: 2 }],
  }),
  q({
    id: 'plains-2', areaId: 'plains', name: 'はなばたけ', recLevel: 4,
    waves: [[{ speciesId: 'mandra', level: 3 }, { speciesId: 'ghost', level: 3 }], [{ speciesId: 'muddoll', level: 4 }, { speciesId: 'goblin', level: 3 }]],
    boss: [{ speciesId: 'tsunopuni', level: 5 }],
    rewardGold: 40, rewardItems: [{ itemId: 'meatchunk', count: 1 }],
  }),
  q({
    id: 'plains-3', areaId: 'plains', name: 'でかぷにの おか', recLevel: 6,
    waves: [[{ speciesId: 'wolf', level: 5 }, { speciesId: 'rabbit', level: 4 }], [{ speciesId: 'ghost', level: 5 }, { speciesId: 'muddoll', level: 5 }]],
    boss: [{ speciesId: 'dekapuni', level: 7 }],
    rewardGold: 80, rewardItems: [{ itemId: 'herb', count: 3 }, { itemId: 'meatchunk', count: 1 }],
  }),

  // ===== エリア2: こもれびの森 =====
  q({
    id: 'forest-1', areaId: 'forest', name: 'もりの いりぐち', recLevel: 8,
    waves: [[{ speciesId: 'myconid', level: 7 }, { speciesId: 'wolf', level: 7 }], [{ speciesId: 'mandra', level: 8 }, { speciesId: 'myconid', level: 8 }]],
    boss: [{ speciesId: 'fangwolf', level: 9 }],
    rewardGold: 60, rewardItems: [{ itemId: 'goodherb', count: 1 }],
  }),
  q({
    id: 'forest-2', areaId: 'forest', name: 'くらやみの こみち', recLevel: 10,
    waves: [[{ speciesId: 'killerplant', level: 9 }, { speciesId: 'imp', level: 9 }], [{ speciesId: 'fangwolf', level: 10 }, { speciesId: 'wolf', level: 10 }]],
    boss: [{ speciesId: 'treant', level: 12 }],
    rewardGold: 80, rewardItems: [{ itemId: 'magicwater', count: 1 }],
  }),
  q({
    id: 'forest-3', areaId: 'forest', name: 'もりの ぬし', recLevel: 12,
    waves: [[{ speciesId: 'killerplant', level: 11 }, { speciesId: 'imp', level: 11 }], [{ speciesId: 'treant', level: 12 }]],
    boss: [{ speciesId: 'dryad', level: 14 }, { speciesId: 'myconid', level: 11 }],
    rewardGold: 150, rewardItems: [{ itemId: 'goodherb', count: 2 }, { itemId: 'meatchunk', count: 1 }],
  }),

  // ===== エリア3: ちてい洞窟 =====
  q({
    id: 'cave-1', areaId: 'cave', name: 'どうくつの いりぐち', recLevel: 14,
    waves: [[{ speciesId: 'skeleton', level: 13 }, { speciesId: 'imp', level: 13 }], [{ speciesId: 'karakuri', level: 14 }, { speciesId: 'dekapuni', level: 14 }]],
    boss: [{ speciesId: 'orc', level: 15 }],
    rewardGold: 100, rewardItems: [{ itemId: 'magicwater', count: 1 }],
  }),
  q({
    id: 'cave-2', areaId: 'cave', name: 'ちていこの ほとり', recLevel: 16,
    waves: [[{ speciesId: 'ghoul', level: 15 }, { speciesId: 'stoneman', level: 15 }], [{ speciesId: 'mahopuni', level: 16 }, { speciesId: 'skeleton', level: 15 }]],
    boss: [{ speciesId: 'wraith', level: 17 }],
    rewardGold: 130, rewardItems: [{ itemId: 'goodherb', count: 2 }],
  }),
  q({
    id: 'cave-3', areaId: 'cave', name: 'いわの ばんにん', recLevel: 18,
    waves: [[{ speciesId: 'stoneman', level: 17 }, { speciesId: 'karakuri', level: 17 }], [{ speciesId: 'lizardron', level: 17 }, { speciesId: 'ghoul', level: 17 }]],
    boss: [{ speciesId: 'golem', level: 20 }, { speciesId: 'skeleton', level: 16 }],
    rewardGold: 300, rewardItems: [{ itemId: 'lifeleaf', count: 1 }, { itemId: 'magicwater', count: 1 }],
  }),

  // ===== エリア4: ごうか火山 =====
  q({
    id: 'volcano-1', areaId: 'volcano', name: 'かざんの ふもと', recLevel: 21,
    waves: [[{ speciesId: 'gargoyle', level: 20 }, { speciesId: 'wyvern', level: 20 }], [{ speciesId: 'grizzly', level: 21 }, { speciesId: 'lizardron', level: 20 }]],
    boss: [{ speciesId: 'sabertiger', level: 23 }],
    rewardGold: 200, rewardItems: [{ itemId: 'goodherb', count: 2 }],
  }),
  q({
    id: 'volcano-2', areaId: 'volcano', name: 'しゃくねつの みち', recLevel: 24,
    waves: [[{ speciesId: 'demon', level: 23 }, { speciesId: 'gargoyle', level: 22 }], [{ speciesId: 'vampire', level: 24 }, { speciesId: 'wyvern', level: 23 }]],
    boss: [{ speciesId: 'flamedrake', level: 26 }, { speciesId: 'demon', level: 22 }],
    rewardGold: 300, rewardItems: [{ itemId: 'royalmeat', count: 1 }],
  }),
  q({
    id: 'volcano-3', areaId: 'volcano', name: 'ようがんの ぬし', recLevel: 27,
    waves: [[{ speciesId: 'irongolem', level: 25 }, { speciesId: 'demon', level: 24 }], [{ speciesId: 'cerberus', level: 27 }, { speciesId: 'vampire', level: 25 }]],
    boss: [{ speciesId: 'grandragon', level: 29 }],
    rewardGold: 600, rewardItems: [{ itemId: 'royalmeat', count: 1 }, { itemId: 'goodherb', count: 3 }],
  }),

  // ===== エリア5: まりゅうの ねぐら =====
  q({
    id: 'lair-1', areaId: 'lair', name: 'ねぐらの もんばん', recLevel: 29,
    waves: [[{ speciesId: 'archdemon', level: 28 }, { speciesId: 'demon', level: 26 }]],
    boss: [{ speciesId: 'grandragon', level: 30 }],
    rewardGold: 500, rewardItems: [{ itemId: 'lifeleaf', count: 2 }],
  }),
  q({
    id: 'lair-2', areaId: 'lair', name: 'けっせん! まりゅう', recLevel: 31,
    waves: [[{ speciesId: 'archdemon', level: 29 }, { speciesId: 'cerberus', level: 28 }]],
    boss: [{ speciesId: 'tekina', level: 32 }],
    rewardGold: 1500, rewardItems: [{ itemId: 'royalmeat', count: 2 }, { itemId: 'lifeleaf', count: 3 }],
  }),

  // ===== エリア6: しれんの ま(クリア後) =====
  q({
    id: 'trial-1', areaId: 'trial', name: 'りゅうの しれん', recLevel: 38,
    waves: [[{ speciesId: 'frostdragon', level: 34 }, { speciesId: 'flamedrake', level: 34 }], [{ speciesId: 'hydra', level: 36 }, { speciesId: 'grandragon', level: 36 }]],
    boss: [{ speciesId: 'bahamut', level: 40 }],
    rewardGold: 2500, rewardItems: [{ itemId: 'royalmeat', count: 3 }, { itemId: 'lifeleaf', count: 3 }],
  }),
  q({
    id: 'trial-2', areaId: 'trial', name: 'ひかりの しれん', recLevel: 41,
    waves: [[{ speciesId: 'unicorn', level: 36 }, { speciesId: 'pegasus', level: 36 }], [{ speciesId: 'valkyrie', level: 40 }, { speciesId: 'griffin', level: 38 }]],
    boss: [{ speciesId: 'seraphim', level: 42 }],
    rewardGold: 2500, rewardItems: [{ itemId: 'royalmeat', count: 3 }, { itemId: 'lifeleaf', count: 3 }],
  }),
  q({
    id: 'trial-3', areaId: 'trial', name: 'しんの しれん', recLevel: 46,
    waves: [[{ speciesId: 'vritra', level: 44 }, { speciesId: 'gaia', level: 44 }], [{ speciesId: 'seraphim', level: 45 }, { speciesId: 'metalking', level: 45 }]],
    boss: [{ speciesId: 'omega', level: 48 }],
    rewardGold: 5000, rewardItems: [{ itemId: 'royalmeat', count: 5 }, { itemId: 'lifeleaf', count: 5 }],
  }),
];

const stageMap = new Map(STAGES.map((s) => [s.id, s]));
const areaMap = new Map(AREAS.map((a) => [a.id, a]));

export function getStage(id: string): StageDef {
  const s = stageMap.get(id);
  if (!s) throw new Error(`未定義のクエスト: ${id}`);
  return s;
}

export function hasStage(id: string): boolean {
  return stageMap.has(id);
}

export function getArea(id: string): AreaDef {
  const a = areaMap.get(id);
  if (!a) throw new Error(`未定義のエリア: ${id}`);
  return a;
}

/** エリア内のクエスト一覧(定義順) */
export function questsOf(areaId: string): StageDef[] {
  return STAGES.filter((s) => s.areaId === areaId);
}

/** エリアの解放判定: 最初のエリア、または前エリアの最終クエストをクリア済み */
export function isAreaUnlocked(areaId: string, cleared: readonly string[]): boolean {
  const idx = AREAS.findIndex((a) => a.id === areaId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prevQuests = questsOf(AREAS[idx - 1]!.id);
  const last = prevQuests[prevQuests.length - 1];
  return last !== undefined && cleared.includes(last.id);
}

/** クエストの解放判定: エリア解放済み かつ (エリア先頭 or ひとつ前をクリア済み) */
export function isStageUnlocked(stage: StageDef, cleared: readonly string[]): boolean {
  if (!isAreaUnlocked(stage.areaId, cleared)) return false;
  const quests = questsOf(stage.areaId);
  const idx = quests.findIndex((s) => s.id === stage.id);
  if (idx <= 0) return idx === 0;
  return cleared.includes(quests[idx - 1]!.id);
}

/** エリアのクリア進捗 */
export function areaProgress(areaId: string, cleared: readonly string[]): { done: number; total: number } {
  const quests = questsOf(areaId);
  return { done: quests.filter((s) => cleared.includes(s.id)).length, total: quests.length };
}

export const FIRST_STAGE = STAGES[0]!.id;
