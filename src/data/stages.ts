// ============================================================
// ステージデータ(完全ステージ制)
//   各ステージ = 数戦の連戦(waves) + ボス(boss)。HPは道中もちこし。
//   クリアで requires が自分を指す次ステージが解放される。
//   新ステージはここに1つ足すだけ(テストが参照整合性を検証する)。
// ============================================================

/** 1体の敵 */
export interface StageEnemy {
  speciesId: string;
  level: number;
}

export interface StageDef {
  id: string;
  name: string;
  desc: string;
  /** すいしょうレベル(パーティ平均の目安) */
  recLevel: number;
  /** クリア前提のステージID(null なら最初から挑戦可能) */
  requires: string | null;
  /** クリア後に解放される やりこみステージか */
  postgame: boolean;
  /** 通常の連戦(順番に出てくる) */
  waves: StageEnemy[][];
  /** 最後のボス戦 */
  boss: StageEnemy[];
  /** 初回クリア報酬 */
  rewardGold: number;
  rewardItems: { itemId: string; count: number }[];
}

function stage(s: StageDef): StageDef {
  return s;
}

export const STAGES: StageDef[] = [
  // ================= メインストーリー =================
  stage({
    id: 'plains',
    name: 'そよかぜ草原',
    desc: 'ぼうけんの はじまりの ち。よわい モンスターが おおい。',
    recLevel: 3,
    requires: null,
    postgame: false,
    waves: [
      [{ speciesId: 'puni', level: 1 }],
      [{ speciesId: 'mandra', level: 2 }, { speciesId: 'goblin', level: 2 }],
      [{ speciesId: 'ghost', level: 3 }, { speciesId: 'muddoll', level: 3 }],
    ],
    boss: [{ speciesId: 'dekapuni', level: 4 }],
    rewardGold: 60,
    rewardItems: [{ itemId: 'herb', count: 3 }, { itemId: 'meatchunk', count: 1 }],
  }),
  stage({
    id: 'forest',
    name: 'こもれびの森',
    desc: 'ふかい みどりの もり。しぜんの モンスターが なわばりを まもる。',
    recLevel: 9,
    requires: 'plains',
    postgame: false,
    waves: [
      [{ speciesId: 'myconid', level: 7 }, { speciesId: 'wolf', level: 7 }],
      [{ speciesId: 'killerplant', level: 9 }, { speciesId: 'fangwolf', level: 9 }],
      [{ speciesId: 'imp', level: 10 }, { speciesId: 'mandra', level: 10 }],
      [{ speciesId: 'treant', level: 12 }],
    ],
    boss: [{ speciesId: 'dryad', level: 14 }, { speciesId: 'myconid', level: 11 }],
    rewardGold: 150,
    rewardItems: [{ itemId: 'goodherb', count: 2 }, { itemId: 'magicwater', count: 1 }],
  }),
  stage({
    id: 'cave',
    name: 'ちてい洞窟',
    desc: 'ひかりの とどかぬ どうくつ。きんぞくや アンデッドが うごめく。',
    recLevel: 16,
    requires: 'forest',
    postgame: false,
    waves: [
      [{ speciesId: 'skeleton', level: 14 }, { speciesId: 'imp', level: 14 }],
      [{ speciesId: 'orc', level: 15 }, { speciesId: 'ghoul', level: 15 }],
      [{ speciesId: 'stoneman', level: 16 }, { speciesId: 'karakuri', level: 16 }],
      [{ speciesId: 'mahopuni', level: 17 }, { speciesId: 'wraith', level: 17 }],
    ],
    boss: [{ speciesId: 'golem', level: 20 }, { speciesId: 'skeleton', level: 16 }],
    rewardGold: 300,
    rewardItems: [{ itemId: 'lifeleaf', count: 1 }, { itemId: 'magicwater', count: 2 }],
  }),
  stage({
    id: 'volcano',
    name: 'ごうか火山',
    desc: 'もえさかる かざん。りゅうや あくまが すみつく きけんちたい。',
    recLevel: 24,
    requires: 'cave',
    postgame: false,
    waves: [
      [{ speciesId: 'gargoyle', level: 21 }, { speciesId: 'wyvern', level: 21 }],
      [{ speciesId: 'demon', level: 23 }, { speciesId: 'sabertiger', level: 23 }],
      [{ speciesId: 'vampire', level: 25 }, { speciesId: 'flamedrake', level: 25 }],
      [{ speciesId: 'cerberus', level: 27 }, { speciesId: 'irongolem', level: 25 }],
    ],
    boss: [{ speciesId: 'grandragon', level: 29 }],
    rewardGold: 600,
    rewardItems: [{ itemId: 'royalmeat', count: 1 }, { itemId: 'goodherb', count: 3 }],
  }),
  stage({
    id: 'lair',
    name: 'まりゅうの ねぐら',
    desc: 'せかいを おびやかす まりゅうテキーナが ねむる さいおくの ま。',
    recLevel: 30,
    requires: 'volcano',
    postgame: false,
    waves: [
      [{ speciesId: 'archdemon', level: 28 }, { speciesId: 'demon', level: 26 }],
      [{ speciesId: 'grandragon', level: 30 }],
    ],
    boss: [{ speciesId: 'tekina', level: 32 }],
    rewardGold: 1500,
    rewardItems: [{ itemId: 'royalmeat', count: 2 }, { itemId: 'lifeleaf', count: 3 }],
  }),

  // ================= やりこみ(クリア後) =================
  stage({
    id: 'trial-dragon',
    name: 'りゅうの しれん',
    desc: 'つよき りゅうたちが まちうける しれんの ま。りゅうしんが すがたを あらわす…!',
    recLevel: 38,
    requires: 'lair',
    postgame: true,
    waves: [
      [{ speciesId: 'frostdragon', level: 34 }, { speciesId: 'flamedrake', level: 34 }],
      [{ speciesId: 'hydra', level: 36 }, { speciesId: 'wyvern', level: 34 }],
      [{ speciesId: 'grandragon', level: 37 }, { speciesId: 'leviathan', level: 37 }],
    ],
    boss: [{ speciesId: 'bahamut', level: 40 }],
    rewardGold: 2500,
    rewardItems: [{ itemId: 'royalmeat', count: 3 }, { itemId: 'lifeleaf', count: 3 }],
  }),
  stage({
    id: 'trial-light',
    name: 'ひかりの しれん',
    desc: 'せいなる モンスターたちの しれん。だいてんしが たちはだかる。',
    recLevel: 40,
    requires: 'lair',
    postgame: true,
    waves: [
      [{ speciesId: 'unicorn', level: 36 }, { speciesId: 'pegasus', level: 36 }],
      [{ speciesId: 'griffin', level: 38 }, { speciesId: 'sphinx', level: 38 }],
      [{ speciesId: 'valkyrie', level: 40 }, { speciesId: 'phoenix', level: 39 }],
    ],
    boss: [{ speciesId: 'seraphim', level: 42 }],
    rewardGold: 2500,
    rewardItems: [{ itemId: 'royalmeat', count: 3 }, { itemId: 'lifeleaf', count: 3 }],
  }),
  stage({
    id: 'trial-god',
    name: 'しんの しれん',
    desc: 'すべてを こえた もののみ たどりつく さいごの しれん。かみがみが まちうける。',
    recLevel: 46,
    requires: 'trial-dragon',
    postgame: true,
    waves: [
      [{ speciesId: 'vritra', level: 44 }, { speciesId: 'gaia', level: 44 }],
      [{ speciesId: 'seraphim', level: 45 }, { speciesId: 'metalking', level: 45 }],
      [{ speciesId: 'odin', level: 46 }],
    ],
    boss: [{ speciesId: 'omega', level: 48 }],
    rewardGold: 5000,
    rewardItems: [{ itemId: 'royalmeat', count: 5 }, { itemId: 'lifeleaf', count: 5 }],
  }),
];

const stageMap = new Map(STAGES.map((s) => [s.id, s]));

export function getStage(id: string): StageDef {
  const s = stageMap.get(id);
  if (!s) throw new Error(`未定義のステージ: ${id}`);
  return s;
}

export function hasStage(id: string): boolean {
  return stageMap.has(id);
}

/** クリア済み集合をもとに、そのステージが挑戦可能か */
export function isStageUnlocked(stage: StageDef, cleared: readonly string[]): boolean {
  return stage.requires === null || cleared.includes(stage.requires);
}

export const FIRST_STAGE = STAGES[0]!.id;
