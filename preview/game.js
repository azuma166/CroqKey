// ─────────────────────────────────────────────
//  CroqKey — Core Prototype v2
// ─────────────────────────────────────────────

// Enemy / key colors
const COLORS = ['red', 'blue', 'yellow', 'green', 'purple'];
const COLOR_HEX = {
  red:    '#e8453c',
  blue:   '#3c7de8',
  yellow: '#ddb830',
  green:  '#3db86a',
  purple: '#9844e8',
};
// Color weather: continuous weight system
// Each color's weight evolves over time using a sinusoidal pattern.
// Colors unlock gradually; v4 spec keeps a "tutorial slope" for the first run.
// unlock_t: time(s) at which color starts becoming available
// base: weight once fully available (0–1 scale, red stays at 1.0)
// period: oscillation period in seconds for weather waves
// phase: wave offset so colors don't peak simultaneously
const COLOR_WEATHER = {
  red:    { unlock_t:   0, base: 1.0, period: 180, phase: 0.00 },
  blue:   { unlock_t:  60, base: 0.7, period: 220, phase: 0.30 },
  yellow: { unlock_t: 120, base: 0.5, period: 160, phase: 0.55 },
  green:  { unlock_t: 240, base: 0.6, period: 200, phase: 0.80 },
  purple: { unlock_t: 420, base: 0.5, period: 240, phase: 0.15 },
};

const CFG = {
  PLAYER_R:          13,
  ENEMY_R:           15,
  ENEMY_COUNT:        6,
  ENEMY_BASE_SPEED:   0.9,
  SLOW_FACTOR:        0.25,
  FRICTION:           0.97,
  MAX_SPEED:          10,
  FLICK_MIN:          16,
  INNER_R:            62,
  OUTER_R:           180,
  KEY_COLOR:         '#e8453c',
  ENEMY_HP:           6,
  KEY_DROP_DUR:       8,   // durability added per key pickup
  DUR_COST_NORMAL:    1,   // durability spent on non-crit hit
  DUR_COST_CRIT:      2,   // durability spent on crit hit
  COMBO_COEFF:        0.21, // combo damage multiplier coefficient
  GHOST_FRAMES:       90,
  UNLOCK_TOLERANCE:  Math.PI / 4,
  PLAYER_HP_MAX:     10,
  HIT_COOLDOWN:      90,
  SPAWN_INTERVAL:   480,   // frames between trickle spawns (~8s)
  ENEMY_COUNT_MAX:  14,    // hard cap
};

// ══════════════════════════════════════════════
//  INSCRIPTION CATALOG
// ══════════════════════════════════════════════
const RARITY = { COMMON: 'common', RARE: 'rare', EPIC: 'epic' };
const RARITY_COLOR = { common: '#aaa', rare: '#3c7de8', epic: '#b044d8' };
const RARITY_WEIGHT = { common: 0.70, rare: 0.25, epic: 0.05 };
const ORB_UNLOCK_KILLS = 100; // first orb after 100 kills, then every 10
const ORB_INTERVAL_KILLS = 10;
const FUSION_INS_UNLOCK   = 200; // first fusion inscription orb after 200 kills
const FUSION_INS_INTERVAL = 100; // one fusion inscription orb every 100 kills after that
const INFECTION_KILLS     = 1000; // infection inscription spawns once at 1000 kills
const PHANTOM_KILLS       = 1500; // phantom inscription spawns once at 1500 kills
const PHANTOM_HOLD_MS     = 700;  // hold duration to toggle phantom mode
const ENDLESS_THRESHOLD   = 25;   // enemy_boost stacks to trigger endless / paint mode

// ── 着彩刻印カタログ ─────────────────────────────────────────────────────────
const PAINT_PAIRS = [
  { name: '夕日', type: 'radial',   colors: ['#ff8c00', '#6a0dad'] },
  { name: '胡粉', type: 'radial',   colors: ['#ffffff', 'rgba(255,255,255,0)'] },
  { name: '極彩', type: 'radial',   colors: ['#ff0000','#ff8800','#ffff00','#00cc44','#0055ff'] },
  { name: '暗幕', type: 'vignette', colors: ['#000000'] },
  { name: '緋',   type: 'vignette', colors: ['#cc0000'] },
  { name: '宵闇', type: 'vignette', colors: ['#1a0080'] },
  { name: '暁',   type: 'linear',   colors: ['#0044cc', '#ffffff'] },
  { name: '焔',   type: 'linear',   colors: ['#ff2200', '#ff8800', '#ffff00'] },
  { name: '霧',   type: 'linear',   colors: ['#aaaaaa', '#666666'] },
  { name: '藍',   type: 'flat',     colors: ['#002288'] },
  { name: '褪',   type: 'flat',     colors: ['#8b6343'] },
  { name: '若草', type: 'flat',     colors: ['#44aa44'] },
  { name: '銀幕', type: 'scanline', colors: ['#888888'] },
  { name: '走査', type: 'scanline', colors: ['#00cc44'] },
  { name: '万華', type: 'grid',     colors: null },
  { name: '羅針', type: 'grid',     colors: ['#4455cc', '#8844cc'] },
];
const PAINT_BLENDS = [
  { char: '沈', op: 'multiply' },
  { char: '昇', op: 'screen' },
  { char: '冴', op: 'overlay' },
  { char: '載', op: 'source-over' },
];
const PAINT_MOTIONS = [
  { char: '凪', type: 'static' },
  { char: '遷', type: 'drift' },
  { char: '脈', type: 'pulse' },
  { char: '転', type: 'rotate' },
];
const PAINT_DENSITIES = [
  { char: '淡', alpha: 0.15 },
  { char: '半', alpha: 0.35 },
  { char: '濃', alpha: 0.60 },
];

// Per-color effect for fusion inscriptions (buff only, no debuff)
const FUSION_COLOR_EFFECT = {
  red:    { key: 'globalDmgMult',    val: 1.20, label: '全ダメ +20%' },
  blue:   { key: 'blueSlowRadMult',  val: 0.30, label: 'スロー半径 +30%' },
  yellow: { key: 'yellowChainExtra', val: 1,    label: '黄チェイン +1段' },
  green:  { key: 'greenHealBonus',   val: 1,    label: '緑回復量 +1' },
  purple: { key: 'purpleBombDmg',    val: 2,    label: 'ボムダメ +2' },
};

// Each buff/debuff entry: { id, label, tier('light'|'medium'|'heavy'), applyMod(mods, val) }
// val is the numeric effect size for display; actual effect is in getMods()
const BUFF_CATALOG = {
  light: [
    { id:'B-R1', label: '赤ダメ +2',            key: 'redDmgFlat',            val: 2    },
    { id:'B-U1', label: 'スロー半径 +25%',       key: 'blueSlowRadMult',       val: 0.25 },
    { id:'B-U2', label: 'スロー減速 +10%',       key: 'blueSlowFactor',        val: -0.10 },
    { id:'B-U3', label: 'スロー持続 +1s',        key: 'blueSlowDuration',      val: 60   },
    { id:'B-Y1', label: '黄チェイン +1段',       key: 'yellowChainExtra',      val: 1    },
    { id:'B-Y2', label: '黄チェインダメ +1',     key: 'yellowChainDmgBonus',   val: 1    },
    { id:'B-G1', label: '緑回復量 +1',           key: 'greenHealBonus',        val: 1    },
    { id:'B-P1', label: '紫ボム半径 +25%',       key: 'purpleBombRadMult',     val: 0.25 },
    { id:'B-P2', label: '紫ボムダメ +1',         key: 'purpleBombDmg',         val: 1    },
    { id:'B-D1', label: '全ダメ +15%',           key: 'globalDmgMult',         val: 1.15 },
    { id:'B-D2', label: 'クリット倍率 +1.2',     key: 'critMult',              val: 1.2  },
    { id:'B-D3', label: '色不一致クリット 50%',  key: 'mismatchCritChance',    val: 0.50 },
    { id:'B-D4', label: '撃破余波ダメ 1',        key: 'splashDmgOnKill',       val: 1    },
    { id:'B-C1', label: 'コンボ係数 +0.3',      key: 'comboCoeff',            val: 0.3  },
    { id:'B-C2', label: 'ミス許容 1回',          key: 'comboForgives',         val: 1    },
    { id:'B-C4', label: '許容角 +10°',           key: 'flickTolerance',        val: 10 * Math.PI / 180 },
    { id:'B-S1', label: '最大HP +1',             key: 'maxHpBonus',            val: 1    },
    { id:'B-S2', label: '撃破HP+ 5%',            key: 'healOnKillChance',      val: 0.05 },
    { id:'B-S3', label: '7コンボ毎に無敵',        key: 'comboInvincible',       val: 7    },
    { id:'B-S4', label: '無敵時間 +0.3s',        key: 'invincibleBonus',       val: 18   },
    { id:'B-M1', label: '耐久取得 +4',           key: 'keyDropDurBonus',       val: 4    },
    { id:'B-M2', label: '撃破耐久 +1',           key: 'bonusDurOnKill',        val: 1    },
    { id:'B-M3', label: '耐久上限 +20%',         key: 'durPoolMult',           val: 0.20 },
    { id:'B-M4', label: '刻印頻度 +20%',         key: 'orbFreqMult',           val: 0.20 },
    { id:'B-V1', label: '視野拡大 +10%',         key: 'cameraZoom',            val: -0.10 },
    { id:'B-A1', label: '移動速度 +10%',         key: 'speedMult',             val: 0.10 },
    { id:'B-A2', label: '鍵取得範囲 +25%',       key: 'keyPickRadiusMult',     val: 0.25 },
  ],
  medium: [
    { id:'B-R1', label: '赤ダメ +4',            key: 'redDmgFlat',            val: 4    },
    { id:'B-U1', label: 'スロー半径 +50%',        key: 'blueSlowRadMult',       val: 0.50 },
    { id:'B-U2', label: 'スロー減速 +20%',        key: 'blueSlowFactor',        val: -0.20 },
    { id:'B-U3', label: 'スロー持続 +2s',         key: 'blueSlowDuration',      val: 120  },
    { id:'B-Y1', label: '黄チェイン +2段',        key: 'yellowChainExtra',      val: 2    },
    { id:'B-Y2', label: '黄チェインダメ +2',      key: 'yellowChainDmgBonus',   val: 2    },
    { id:'B-G1', label: '緑回復量 +2',            key: 'greenHealBonus',        val: 2    },
    { id:'B-P1', label: '紫ボム半径 +45%',        key: 'purpleBombRadMult',     val: 0.45 },
    { id:'B-P2', label: '紫ボムダメ +2',          key: 'purpleBombDmg',         val: 2    },
    { id:'B-D1', label: '全ダメ +30%',            key: 'globalDmgMult',         val: 1.30 },
    { id:'B-D2', label: 'クリット倍率 +1.5',      key: 'critMult',              val: 1.5  },
    { id:'B-D3', label: '色不一致クリット 70%',   key: 'mismatchCritChance',    val: 0.70 },
    { id:'B-D4', label: '撃破余波ダメ 2',         key: 'splashDmgOnKill',       val: 2    },
    { id:'B-C1', label: 'コンボ係数 +0.5',       key: 'comboCoeff',            val: 0.5  },
    { id:'B-C2', label: 'ミス許容 1回',           key: 'comboForgives',         val: 1    },
    { id:'B-C4', label: '許容角 +15°',            key: 'flickTolerance',        val: 15 * Math.PI / 180 },
    { id:'B-S1', label: '最大HP +2',              key: 'maxHpBonus',            val: 2    },
    { id:'B-S2', label: '撃破HP+ 12%',            key: 'healOnKillChance',      val: 0.12 },
    { id:'B-S3', label: '5コンボ毎に無敵',         key: 'comboInvincible',       val: 5    },
    { id:'B-S4', label: '無敵時間 +0.6s',         key: 'invincibleBonus',       val: 36   },
    { id:'B-M1', label: '耐久取得 +8',            key: 'keyDropDurBonus',       val: 8    },
    { id:'B-M2', label: '撃破耐久 +2',            key: 'bonusDurOnKill',        val: 2    },
    { id:'B-M3', label: '耐久上限 +40%',          key: 'durPoolMult',           val: 0.40 },
    { id:'B-M4', label: '刻印頻度 +40%',          key: 'orbFreqMult',           val: 0.40 },
    { id:'B-V1', label: '視野拡大 +20%',          key: 'cameraZoom',            val: -0.20 },
    { id:'B-A1', label: '移動速度 +20%',          key: 'speedMult',             val: 0.20 },
    { id:'B-A2', label: '鍵取得範囲 +50%',        key: 'keyPickRadiusMult',     val: 0.50 },
    { id:'B-X3', label: '被弾時 自動スロー',      key: 'autoSlowOnHit',         val: 1    },
  ],
  heavy: [
    { id:'B-R1', label: '赤ダメ +6',            key: 'redDmgFlat',            val: 6    },
    { id:'B-U1', label: 'スロー半径 +90%',        key: 'blueSlowRadMult',       val: 0.90 },
    { id:'B-U2', label: 'スロー減速 +35%',        key: 'blueSlowFactor',        val: -0.35 },
    { id:'B-U3', label: 'スロー持続 +4s',         key: 'blueSlowDuration',      val: 240  },
    { id:'B-Y1', label: '黄チェイン +3段',        key: 'yellowChainExtra',      val: 3    },
    { id:'B-Y2', label: '黄チェインダメ +3',      key: 'yellowChainDmgBonus',   val: 3    },
    { id:'B-G1', label: '緑回復量 +3',            key: 'greenHealBonus',        val: 3    },
    { id:'B-P1', label: '紫ボム半径 +80%',        key: 'purpleBombRadMult',     val: 0.80 },
    { id:'B-P2', label: '紫ボムダメ +3',          key: 'purpleBombDmg',         val: 3    },
    { id:'B-D1', label: '全ダメ +50%',            key: 'globalDmgMult',         val: 1.50 },
    { id:'B-D2', label: 'クリット倍率 +2.0',      key: 'critMult',              val: 2.0  },
    { id:'B-D3', label: '色不一致クリット 100%',   key: 'mismatchCritChance',    val: 1.00 },
    { id:'B-D4', label: '撃破余波ダメ 3',         key: 'splashDmgOnKill',       val: 3    },
    { id:'B-C1', label: 'コンボ係数 +1.0',       key: 'comboCoeff',            val: 1.0  },
    { id:'B-C2', label: 'ミス許容 2回',           key: 'comboForgives',         val: 2    },
    { id:'B-C4', label: '許容角 +25°',            key: 'flickTolerance',        val: 25 * Math.PI / 180 },
    { id:'B-S1', label: '最大HP +4',              key: 'maxHpBonus',            val: 4    },
    { id:'B-S2', label: '撃破HP+ 25%',            key: 'healOnKillChance',      val: 0.25 },
    { id:'B-S3', label: '2コンボ毎に無敵',          key: 'comboInvincible',       val: 2    },
    { id:'B-S4', label: '無敵時間 +1.2s',         key: 'invincibleBonus',       val: 72   },
    { id:'B-M1', label: '耐久取得 +15',           key: 'keyDropDurBonus',       val: 15   },
    { id:'B-M2', label: '撃破耐久 +4',            key: 'bonusDurOnKill',        val: 4    },
    { id:'B-M3', label: '耐久上限 +70%',          key: 'durPoolMult',           val: 0.70 },
    { id:'B-M4', label: '刻印頻度 +70%',          key: 'orbFreqMult',           val: 0.70 },
    { id:'B-V1', label: '視野拡大 +35%',          key: 'cameraZoom',            val: -0.35 },
    { id:'B-A1', label: '移動速度 +35%',          key: 'speedMult',             val: 0.35 },
    { id:'B-A2', label: '鍵取得範囲 +100%',       key: 'keyPickRadiusMult',     val: 1.00 },
    { id:'B-X2', label: '枯渇でも効果発動',       key: 'depletedEffects',       val: 1    },
    { id:'B-X4', label: '紫撃破でボム連鎖',       key: 'bombChainOnKill',       val: 1    },
    { id:'B-X5', label: '無傷ボーナス ×1.5',           key: 'untouchedBonus',        val: 1    },
    { id:'B-X6', label: '全効果範囲 ×2',          key: 'effectRangeMult',       val: 2    },
    { id:'B-X7', label: 'チェインが効果伝播',     key: 'chainPropagatesEffects',val: 1    },
  ],
};

const DEBUFF_CATALOG = {
  light: [
    { id:'D-M1', label: '移動速度 -10%',         key: 'speedMult',             val: -0.10 },
    { id:'D-M2', label: '慣性増加 +15%',         key: 'inertiaBonus',          val: 0.15  },
    { id:'D-M4', label: 'フリック初速 -15%',     key: 'flickSpeedCap',         val: -0.15 },
    { id:'D-V1', label: '視野縮小 -10%',         key: 'cameraZoom',            val: 0.10  },
    { id:'D-O2', label: '許容角 -10°',           key: 'flickTolerance',        val: -10 * Math.PI / 180 },
    { id:'D-O3', label: '接続中被ダメ +30%',     key: 'connectedDmgMult',      val: 0.30  },
    { id:'D-E1', label: '敵数 +2',               key: 'enemyCountBonus',       val: 2     },
    { id:'D-E2', label: 'スポーン速度 +15%',     key: 'spawnIntervalMult',     val: -0.15 },
    { id:'D-E4', label: '敵HP +1',               key: 'enemyHpBonus',          val: 1     },
    { id:'D-E3', label: '敵速度 +10%',           key: 'enemySpeedMult',        val: 0.10  },
    { id:'D-R1', label: '耐久取得量 -20%',       key: 'keyDropDurMult',        val: -0.20 },
    { id:'D-R4', label: '鍵ドロップ率 -20%',     key: 'keyDropChanceMult',     val: -0.20 },
    { id:'D-R5', label: '刻印頻度 -10%',         key: 'orbFreqMalus',          val: -0.10 },
    { id:'D-S1', label: '最大HP -1',             key: 'maxHpMalus',            val: 1     },
    { id:'D-S2', label: '無敵時間 -0.3s',        key: 'invincibleMalus',       val: -18   },
  ],
  medium: [
    { id:'D-M1', label: '移動速度 -20%',         key: 'speedMult',             val: -0.20 },
    { id:'D-M2', label: '慣性増加 +30%',         key: 'inertiaBonus',          val: 0.30  },
    { id:'D-M3', label: 'タップ停止無効',        key: 'noTapStop',             val: 1     },
    { id:'D-M4', label: 'フリック初速 -30%',     key: 'flickSpeedCap',         val: -0.30 },
    { id:'D-V1', label: '視野縮小 -20%',         key: 'cameraZoom',            val: 0.20  },
    { id:'D-V4', label: '敵色 近距離のみ',       key: 'enemyColorFarHide',     val: 1     },
    { id:'D-O2', label: '許容角 -15°',           key: 'flickTolerance',        val: -15 * Math.PI / 180 },
    { id:'D-O3', label: '接続中被ダメ +50%',     key: 'connectedDmgMult',      val: 0.50  },
    { id:'D-E1', label: '敵数 +4',               key: 'enemyCountBonus',       val: 4     },
    { id:'D-E2', label: 'スポーン速度 +30%',      key: 'spawnIntervalMult',     val: -0.30 },
    { id:'D-E3', label: '敵速度 +20%',           key: 'enemySpeedMult',        val: 0.20  },
    { id:'D-E5', label: '敵追尾加速 +30%',       key: 'enemyAccelMult',        val: 0.30  },
    { id:'D-E4', label: '敵HP +2',               key: 'enemyHpBonus',          val: 2     },
    { id:'D-R1', label: '耐久取得量 -40%',       key: 'keyDropDurMult',        val: -0.40 },
    { id:'D-R2', label: '耐久上限 -35%',         key: 'durPoolMult',           val: -0.35 },
    { id:'D-R4', label: '鍵ドロップ率 -40%',     key: 'keyDropChanceMult',     val: -0.40 },
    { id:'D-R5', label: '刻印頻度 -20%',         key: 'orbFreqMalus',          val: -0.20 },
    { id:'D-S1', label: '最大HP -2',             key: 'maxHpMalus',            val: 2     },
    { id:'D-S2', label: '無敵時間 -0.6s',        key: 'invincibleMalus',       val: -36   },
    { id:'D-S4', label: '緑回復量 -1',           key: 'greenHealMalus',        val: -1    },
    { id:'D-S5', label: '被弾後硬直 0.4s',       key: 'stunOnHit',             val: 24    },
  ],
  heavy: [
    { id:'D-M1', label: '移動速度 -35%',         key: 'speedMult',             val: -0.35 },
    { id:'D-M2', label: '慣性増加 +50%',         key: 'inertiaBonus',          val: 0.50  },
    { id:'D-M4', label: 'フリック初速 -50%',     key: 'flickSpeedCap',         val: -0.50 },
    { id:'D-V1', label: '視野縮小 -35%',         key: 'cameraZoom',            val: 0.35  },
    { id:'D-V2', label: '予測矢印 -1本',          key: 'predictArrowSub',       val: 1     },
    { id:'D-O1', label: '緊急離脱不可',          key: 'cannotEscape',          val: 1     },
    { id:'D-O2', label: '許容角 -25°',           key: 'flickTolerance',        val: -25 * Math.PI / 180 },
    { id:'D-O3', label: '接続中被ダメ +80%',     key: 'connectedDmgMult',      val: 0.80  },
    { id:'D-E1', label: '敵数 +7',               key: 'enemyCountBonus',       val: 7     },
    { id:'D-E2', label: 'スポーン速度 +50%',      key: 'spawnIntervalMult',     val: -0.50 },
    { id:'D-E3', label: '敵速度 +35%',           key: 'enemySpeedMult',        val: 0.35  },
    { id:'D-E4', label: '敵HP +3',               key: 'enemyHpBonus',          val: 3     },
    { id:'D-E5', label: '敵追尾加速 +50%',       key: 'enemyAccelMult',        val: 0.50  },
    { id:'D-E6', label: '融合個体 出現頻度上昇',     key: 'fusionEarlySpawn',      val: 1     },
    { id:'D-R1', label: '耐久取得量 -65%',       key: 'keyDropDurMult',        val: -0.65 },
    { id:'D-R2', label: '耐久上限 -55%',         key: 'durPoolMult',           val: -0.55 },
    { id:'D-R4', label: '鍵ドロップ率 -65%',     key: 'keyDropChanceMult',     val: -0.65 },
    { id:'D-R5', label: '刻印頻度 -30%',         key: 'orbFreqMalus',          val: -0.30 },
    { id:'D-S1', label: '最大HP -3',             key: 'maxHpMalus',            val: 3     },
    { id:'D-S2', label: '無敵時間 -1.0s',        key: 'invincibleMalus',       val: -60   },
    { id:'D-S3', label: '被ダメ +1',             key: 'incomingDmgBonus',      val: 1     },
    { id:'D-S4', label: '緑回復量 -2',            key: 'greenHealMalus',        val: -2    },
    { id:'D-S5', label: '被弾後硬直 0.7s',       key: 'stunOnHit',             val: 42    },
  ],
};

// Accumulate all active inscription effects into a mods object.
// Inscriptions are only ever appended (or cleared on reset), so the length is
// a sufficient cache key; callers treat the returned object as read-only.
let _modsCache = null, _modsLen = -1;
function getMods() {
  if (_modsCache && _modsLen === activeInscriptions.length) return _modsCache;
  const m = {
    globalDmgMult:    1,
    critMult:         0,
    comboCoeff:       0,
    comboForgives:    0,
    comboInvincible:  0, // combo threshold for temp invincibility (0=disabled)
    flickTolerance:   0,
    maxHpBonus:       0,
    healOnKillChance: 0,
    keyDropDurBonus:  0,
    bonusDurOnKill:   0,
    durPoolMult:      0, // net cap multiplier (positive=buff, negative=debuff)
    greenHealBonus:   0,
    greenHealMalus:   0,
    blueSlowRadMult:  0,
    blueSlowFactor:   0,
    purpleBombRadMult:0,
    purpleBombDmg:    0,
    yellowChainExtra: 0,
    speedMult:        0,
    enemySpeedMult:   0,
    enemyAccelMult:   0,
    enemyCountBonus:  0,
    enemyHpBonus:     0,
    spawnIntervalMult:0,
    keyDropChanceMult:0,
    predictArrowSub:  0,
    invincibleBonus:  0,
    invincibleMalus:  0,
    cameraZoom:       0, // positive = zoom in (narrower), negative = zoom out (wider)
    redCritAll:       0,
    depletedEffects:  0,
    effectRangeMult:  1,
    autoSlowOnHit:    0,
    cannotEscape:     0,
    noTapStop:        0,
    incomingDmgBonus: 0,
    fusionEarlySpawn: 0,
    redDmgMult:             1,
    redDmgFlat:             0,
    redCritMult:            0,
    blueSlowDuration:       0,
    yellowChainDmgBonus:    0,
    mismatchCritChance:     0,
    splashDmgOnKill:        0,
    orbFreqMult:            0,
    orbFreqMalus:           0,
    bombChainOnKill:        0,
    untouchedBonus:         0,
    chainPropagatesEffects: 0,
    inertiaBonus:           0,
    flickSpeedCap:          0,
    ghostTimerMult:         0,
    enemyColorFarHide:      0,
    connectedDmgMult:       0,
    keyDropDurMult:         0,
    maxHpMalus:             0,
    stunOnHit:              0,
    comboDrainAccel:        0,
    keyPickRadiusMult:      0,
  };
  for (const ins of activeInscriptions) {
    applyInscriptionMod(m, ins.buff);
    applyInscriptionMod(m, ins.debuff);
  }
  // clamp some
  m.globalDmgMult = Math.max(0.1, m.globalDmgMult);
  m.effectRangeMult = Math.max(1, m.effectRangeMult);
  m.redDmgMult = Math.max(0.1, m.redDmgMult);
  _modsCache = m; _modsLen = activeInscriptions.length;
  return m;
}

function applyInscriptionMod(m, entry) {
  const k = entry.key, v = entry.val;
  switch (k) {
    case 'globalDmgMult':    m.globalDmgMult    *= v; break;
    case 'critMult':         m.critMult         += v; break;
    case 'comboCoeff':       m.comboCoeff       += v; break;
    case 'flickTolerance':   m.flickTolerance   += v; break;
    case 'maxHpBonus':       m.maxHpBonus       += v; break;
    case 'healOnKillChance': m.healOnKillChance += v; break;
    case 'keyDropDurBonus':  m.keyDropDurBonus  += v; break;
    case 'bonusDurOnKill':   m.bonusDurOnKill   += v; break;
    case 'greenHealBonus':   m.greenHealBonus   += v; break;
    case 'greenHealMalus':   m.greenHealMalus   += v; break;
    case 'blueSlowRadMult':  m.blueSlowRadMult  += v; break;
    case 'blueSlowFactor':   m.blueSlowFactor   += v; break;
    case 'purpleBombRadMult':m.purpleBombRadMult+= v; break;
    case 'purpleBombDmg':    m.purpleBombDmg    += v; break;
    case 'comboForgives':    m.comboForgives    += v; break;
    case 'comboInvincible':
      // take the lowest (most lenient) threshold; 0 means disabled
      if (m.comboInvincible === 0 || v < m.comboInvincible) m.comboInvincible = v; break;
    case 'durPoolMult':      m.durPoolMult      += v; break;
    case 'yellowChainExtra': m.yellowChainExtra += v; break;
    case 'speedMult':        m.speedMult        += v; break;
    case 'enemySpeedMult':   m.enemySpeedMult   += v; break;
    case 'enemyAccelMult':   m.enemyAccelMult   += v; break;
    case 'enemyCountBonus':  m.enemyCountBonus  += v; break;
    case 'enemyHpBonus':     m.enemyHpBonus     += v; break;
    case 'spawnIntervalMult':m.spawnIntervalMult+= v; break;
    case 'keyDropChanceMult':m.keyDropChanceMult+= v; break;
    case 'predictArrowSub':  m.predictArrowSub  += v; break;
    case 'invincibleBonus':  m.invincibleBonus  += v; break;
    case 'invincibleMalus':  m.invincibleMalus  += v; break;
    case 'cameraZoom':       m.cameraZoom       += v; break;
    case 'redCritAll':       m.redCritAll       += v; break;
    case 'depletedEffects':  m.depletedEffects  += v; break;
    case 'effectRangeMult':  m.effectRangeMult  *= v; break;
    case 'autoSlowOnHit':    m.autoSlowOnHit    += v; break;
    case 'cannotEscape':     m.cannotEscape     += v; break;
    case 'noTapStop':        m.noTapStop        += v; break;
    case 'incomingDmgBonus': m.incomingDmgBonus += v; break;
    case 'fusionEarlySpawn': m.fusionEarlySpawn += v; break;
    case 'redDmgMult':             m.redDmgMult             *= v; break;
    case 'redDmgFlat':             m.redDmgFlat             += v; break;
    case 'redCritMult':            m.redCritMult            += v; break;
    case 'blueSlowDuration':       m.blueSlowDuration       += v; break;
    case 'yellowChainDmgBonus':    m.yellowChainDmgBonus    += v; break;
    case 'mismatchCritChance':     m.mismatchCritChance     += v; break;
    case 'splashDmgOnKill':        m.splashDmgOnKill        += v; break;
    case 'orbFreqMult':            m.orbFreqMult            += v; break;
    case 'orbFreqMalus':           m.orbFreqMalus           += v; break;
    case 'bombChainOnKill':        m.bombChainOnKill        += v; break;
    case 'untouchedBonus':         m.untouchedBonus         += v; break;
    case 'chainPropagatesEffects': m.chainPropagatesEffects += v; break;
    case 'inertiaBonus':           m.inertiaBonus           += v; break;
    case 'flickSpeedCap':          m.flickSpeedCap          += v; break;
    case 'ghostTimerMult':         m.ghostTimerMult         += v; break;
    case 'enemyColorFarHide':      m.enemyColorFarHide      += v; break;
    case 'connectedDmgMult':       m.connectedDmgMult       += v; break;
    case 'keyDropDurMult':         m.keyDropDurMult         += v; break;
    case 'maxHpMalus':             m.maxHpMalus             += v; break;
    case 'stunOnHit':              m.stunOnHit              += v; break;
    case 'comboDrainAccel':        m.comboDrainAccel        += v; break;
    case 'keyPickRadiusMult':      m.keyPickRadiusMult      += v; break;
  }
}

function pickRarity() {
  const r = Math.random();
  if (r < RARITY_WEIGHT.epic)   return RARITY.EPIC;
  if (r < RARITY_WEIGHT.epic + RARITY_WEIGHT.rare) return RARITY.RARE;
  return RARITY.COMMON;
}

function pickFromTier(catalog, tier) {
  const pool = catalog[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateInscription(rarity = pickRarity()) {
  const tier   = rarity === RARITY.EPIC ? 'heavy' : rarity === RARITY.RARE ? 'medium' : 'light';
  let buff   = pickFromTier(BUFF_CATALOG,   tier);
  let debuff = pickFromTier(DEBUFF_CATALOG, tier);
  // avoid cancellation (same key, opposite sign — simple check)
  if (buff.key === debuff.key) debuff = pickFromTier(DEBUFF_CATALOG, tier);
  return { rarity, buff, debuff };
}

function spawnInscriptionOrb() {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 400 + Math.random() * 350;
  inscriptionOrbs.push({
    type:   'normal',
    x:      player.x + Math.cos(angle) * dist,
    y:      player.y + Math.sin(angle) * dist,
    rarity: pickRarity(),
    pulse:  0,
  });
}

function spawnFusionInscriptionOrb() {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 450 + Math.random() * 350;
  inscriptionOrbs.push({
    type:   'fusion',
    x:      player.x + Math.cos(angle) * dist,
    y:      player.y + Math.sin(angle) * dist,
    rarity: RARITY.EPIC,
    pulse:  0,
  });
}

function spawnEnemyBoostOrb() {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 450 + Math.random() * 350;
  inscriptionOrbs.push({
    type:  endlessMode ? 'paint' : 'enemy_boost',
    x:     player.x + Math.cos(angle) * dist,
    y:     player.y + Math.sin(angle) * dist,
    pulse: 0,
  });
}

function spawnPhantomOrb() {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 500 + Math.random() * 300;
  inscriptionOrbs.push({ type: 'phantom', x: player.x + Math.cos(angle) * dist, y: player.y + Math.sin(angle) * dist, pulse: 0 });
}

function spawnInfectionOrb() {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 500 + Math.random() * 300;
  inscriptionOrbs.push({
    type:  'infection',
    x:     player.x + Math.cos(angle) * dist,
    y:     player.y + Math.sin(angle) * dist,
    pulse: 0,
  });
}

function generateFusionInscription() {
  const w = colorWeather();
  let pool = COLORS.filter(c => w[c] > 0.05);
  if (pool.length < 2) pool = COLORS.slice(0, 2);
  const maxColors = killCount >= 300 ? 4 : killCount >= 200 ? 3 : 2;
  const numColors = 2 + Math.floor(Math.random() * Math.max(1, maxColors - 1));
  const shuffled  = pool.slice().sort(() => Math.random() - 0.5);
  const colors    = shuffled.slice(0, Math.min(numColors, pool.length));
  const effects   = colors.map(c => FUSION_COLOR_EFFECT[c]);
  return { type: 'fusion', colors, effects };
}

function openDraft(orbIndex) {
  const orb = inscriptionOrbs[orbIndex];
  inscriptionOrbs.splice(orbIndex, 1);
  if (orb.type === 'paint') {
    playPaintPickupSound();
    paintDraftChoices = [generatePaintInscription(), generatePaintInscription(), generatePaintInscription()];
    paintDraftOpenedAt = performance.now();
    state = State.PAINT_DRAFT;
  } else if (orb.type === 'enemy_boost') {
    enemyBoostStacks++;
    playEnemyBoostKeySound();
    addFx('explosion', player.x, player.y, { color: '#ff4400', maxAge: 35 });
    screenFlash = { r: 220, g: 60, b: 20, alpha: 0.18 };
    if (enemyBoostStacks >= ENDLESS_THRESHOLD && !endlessMode) {
      endlessMode = true;
      // Convert remaining enemy_boost orbs on field to paint
      for (const o of inscriptionOrbs) { if (o.type === 'enemy_boost') o.type = 'paint'; }
      orbAnnounce = { label: 'Endless', color: '#ffdd44', age: 0, maxAge: 140, slowFrames: 90 };
    } else {
      orbAnnounce = { label: '敵増加', color: '#ff6622', age: 0, maxAge: 100, slowFrames: 65 };
    }
  } else if (orb.type === 'infection') {
    infectedMode = true;
    playInfectionSound();
    screenFlash = { r: 60, g: 0, b: 100, alpha: 0.30 };
    orbAnnounce = { label: '刻印感染', color: '#cc44ff', age: 0, maxAge: 110, slowFrames: 70 };
  } else if (orb.type === 'phantom') {
    phantomOrbPickedUp = true;
    playPhantomPickupSound();
    screenFlash = { r: 120, g: 255, b: 220, alpha: 0.22 };
    orbAnnounce = { label: '幻影刻印', sub: '長押しで幻影切替', color: '#88ffdd', age: 0, maxAge: 220, slowFrames: 0 };
  } else if (orb.type === 'fusion') {
    fusionSlotA = -1;
    state = State.FUSION_SELECT;
  } else {
    hintEvent('draft');
    if (infectedMode) {
      // Each choice is a bundle of 5 random inscriptions
      draftChoices = [
        Array.from({ length: 5 }, () => generateInscription()),
        Array.from({ length: 5 }, () => generateInscription()),
        Array.from({ length: 5 }, () => generateInscription()),
      ];
    } else {
      const r = orb.rarity;
      draftChoices = [generateInscription(r), generateInscription(r), generateInscription(r)];
    }
    state = State.DRAFT;
    draftOpenedAt = performance.now();
  }
}

function fuseSlots(idxA, idxB) {
  if (idxA === idxB || idxA < 0 || idxB < 0 || idxA >= keySlots.length || idxB >= keySlots.length) return;
  const a = keySlots[idxA], b = keySlots[idxB];
  const merged = {
    colors: [...new Set([...a.colors, ...b.colors])],
    dur: Math.min(durCap(), a.dur + b.dur),
  };
  const hi = Math.max(idxA, idxB), lo = Math.min(idxA, idxB);
  keySlots.splice(hi, 1);
  keySlots.splice(lo, 1);
  keySlots.splice(lo, 0, merged);
  selectedSlotIdx = Math.min(selectedSlotIdx, keySlots.length - 1);
}

function applyDraftChoice(index) {
  if (index >= 0 && index < draftChoices.length) {
    const oldMaxHp = Math.max(1, CFG.PLAYER_HP_MAX + getMods().maxHpBonus - getMods().maxHpMalus);
    const choice = draftChoices[index];
    if (Array.isArray(choice)) {
      // Infected mode: apply all 5 inscriptions in the bundle
      for (const ins of choice) activeInscriptions.push(ins);
      const rarities = [RARITY.EPIC, RARITY.RARE, RARITY.COMMON];
      const topRarity = rarities.find(r => choice.some(ins => ins.rarity === r)) || RARITY.COMMON;
      playDraftPickSound(topRarity);
    } else {
      activeInscriptions.push(choice);
      playDraftPickSound(choice.rarity);
      if (navigator.vibrate) {
        navigator.vibrate(choice.rarity === RARITY.EPIC ? [30, 20, 30] : choice.rarity === RARITY.RARE ? [20] : [10]);
      }
    }
    // Adjust player HP to reflect maxHp changes from the inscription
    const newMaxHp = Math.max(1, CFG.PLAYER_HP_MAX + getMods().maxHpBonus - getMods().maxHpMalus);
    if (newMaxHp > oldMaxHp) {
      // B-S1 buff: grant the extra HP immediately
      player.hp = Math.min(player.hp + (newMaxHp - oldMaxHp), newMaxHp);
    } else if (newMaxHp < oldMaxHp) {
      // D-S1 debuff: cap current HP at new max
      player.hp = Math.min(player.hp, newMaxHp);
    }
    player.hp = Math.max(1, player.hp);
  } else {
    // Skip: refill least-durable slot
    let minSlot = keySlots[0];
    for (const s of keySlots) { if (s.dur < minSlot.dur) minSlot = s; }
    if (minSlot) minSlot.dur = CFG.KEY_DROP_DUR * 3;
    playDraftSkipSound();
  }
  draftChoices = [];
  state = State.IDLE;
}

// Layout constants for the draft card grid (recomputed per tap)
function draftCardBounds(w, h) {
  const cards = [];
  const cardW = Math.min((w - 64) / 3, 170);
  const cardH = 260;
  const totalW = cardW * 3 + 24;
  const startX = (w - totalW) / 2;
  const cardY  = h / 2 - cardH / 2 - 20;
  for (let i = 0; i < 3; i++) {
    cards.push({ x: startX + i * (cardW + 12), y: cardY, w: cardW, h: cardH, index: i });
  }
  // Skip button below cards
  const skipW = Math.min(w - 40, 260), skipH = 42;
  cards.push({ x: w / 2 - skipW / 2, y: cardY + cardH + 18, w: skipW, h: skipH, index: -1 });
  return cards;
}

function handleDraftTap(sx, sy) {
  if (performance.now() - draftOpenedAt < 700) return; // 0.7s tap lockout
  const bounds = draftCardBounds(W(), H());
  for (const b of bounds) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
      applyDraftChoice(b.index);
      return;
    }
  }
}

// ══════════════════════════════════════════════
//  CANVAS
// ══════════════════════════════════════════════
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');

// Logical (CSS px) size for all game/UI math; the backing store is DPR-scaled for crisp lines
let DPR = Math.min(window.devicePixelRatio || 1, 2);
let viewW = window.innerWidth, viewH = window.innerHeight;
function resize() {
  viewW = window.innerWidth; viewH = window.innerHeight;
  canvas.width  = Math.round(viewW * DPR);
  canvas.height = Math.round(viewH * DPR);
  canvas.style.width  = viewW + 'px';
  canvas.style.height = viewH + 'px';
}
resize();
window.addEventListener('resize', resize);

const W = () => viewW;
const H = () => viewH;

// ══════════════════════════════════════════════
//  CAMERA  (world coords of viewport top-left)
// ══════════════════════════════════════════════
const cam = { x: 0, y: 0 };

// Smooth follow: lerp toward (player + velocity lead)
const CAMERA_LERP = 0.10;  // 0=frozen, 1=instant
const CAMERA_LEAD = 13;    // pixels of look-ahead per px/frame of velocity

function updateCamera() {
  const tx = player.x + player.vx * CAMERA_LEAD - W() * 0.5;
  const ty = player.y + player.vy * CAMERA_LEAD - H() * 0.5;
  cam.x += (tx - cam.x) * CAMERA_LERP;
  cam.y += (ty - cam.y) * CAMERA_LERP;
}

function snapCamera() {
  cam.x = player.x - W() * 0.5;
  cam.y = player.y - H() * 0.5;
}

// World ↔ Screen helpers
function w2s(wx, wy) { return { x: wx - cam.x, y: wy - cam.y }; }
function s2w(sx, sy) { return { x: sx + cam.x, y: sy + cam.y }; }

// ══════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════
const State = { TITLE: 'title', IDLE: 'idle', CONNECTED: 'connected', GAMEOVER: 'gameover', DRAFT: 'draft', PAUSED: 'paused', FUSION_SELECT: 'fusion_select', PAINT_DRAFT: 'paint_draft' };
let state          = State.IDLE;
let connectedEnemy = null;
let score          = 0;
let frame          = 0;
let gameTime       = 0;   // seconds elapsed
let spawnTimer     = 0;
let beamFlash      = 0;
let uiShake        = 0;
let ghostTimer     = 0;
let screenFlash    = null;
let combo          = 0;
let maxCombo       = 0;
let killCount      = 0;
let comboMissCount = 0; // counts forgiven misses this combo chain
let enemyBoostStacks = 0; // accumulated from enemy-boost key pickups (all-fused state)
let infectedMode = false;     // true after 刻印感染 orb is collected
let orbAnnounce       = null;  // { label, sub?, color, age, maxAge, slowFrames } — full-screen pickup announcement
let phantomOrbSpawned = false;
let phantomOrbPickedUp = false;
let phantomMode       = false;
let phantomHoldFired  = false;
let endlessMode       = false;
let activePaints      = [];   // up to 3 cached paint layers
let paintDraftChoices = [];   // 3 options shown during PAINT_DRAFT
let paintDraftOpenedAt = 0;
let infectionOrbSpawned = false; // one-shot flag
let fusionInsAnnounced  = false; // one-shot announce flag
let enemyBoostAnnounced = false; // one-shot announce flag
let normalOrbAnnounced  = false; // one-shot announce flag
let firstKeyAnnounced   = false; // one-shot: first key pickup announcement
let untouchedStreak = 0; // B-X5: kills without taking damage
let comboIdleFrames = 0; // D-R3: frames in IDLE without hitting
let player_stunTimer = 0; // D-S5: input-freeze frames after hit (legacy; use player.stunTimer)
const activeInscriptions = [];
const inscriptionOrbs    = [];
let draftChoices         = [];
let draftOpenedAt        = 0; // performance.now() when draft opened — for tap lockout
let draftIsFusion        = false;
let nextOrbAt            = ORB_UNLOCK_KILLS;
let nextFusionInsAt      = FUSION_INS_UNLOCK;
let stateBeforePause     = State.IDLE;
// Key slots — each slot can fuse multiple colors together
const keySlots = [
  { colors: ['red'],    dur: 16 },
  { colors: ['blue'],   dur: 0  },
  { colors: ['yellow'], dur: 0  },
  { colors: ['green'],  dur: 0  },
  { colors: ['purple'], dur: 0  },
];
let selectedSlotIdx = 0;
let fusionSlotA     = -1; // first slot chosen in FUSION_SELECT mode
let fusionSlotB     = -1; // second slot chosen — awaiting confirmation

// ══════════════════════════════════════════════
//  PLAYER  (world coords)
// ══════════════════════════════════════════════
const player = {
  x: 0, y: 0, vx: 0, vy: 0,
  r: CFG.PLAYER_R,
  hp: CFG.PLAYER_HP_MAX,
  invincible: 0,
  hitFlash: 0,
};

function initPlayer() {
  player.x = player.y = 0;
  player.vx = player.vy = 0;
  player.hp = CFG.PLAYER_HP_MAX;
  player.invincible = player.hitFlash = 0;
  player.stunTimer = 0;
  snapCamera();
}

// ══════════════════════════════════════════════
//  ENEMIES  (world coords)
// ══════════════════════════════════════════════
const enemies = [];
function randomAngle() { return Math.random() * Math.PI * 2; }

function spawnEnemies() {
  enemies.length = 0;
  for (let i = 0; i < CFG.ENEMY_COUNT; i++) addEnemy();
}

// single enemy spawn used by trickle system
function spawnEnemy() { addEnemy(); }

// Returns a color sampled by weight from the current color weather.
// Each color ramps in from 0 at its unlock_t, reaching full base weight by
// unlock_t + 60s, then oscillates with a gentle sine wave.
function colorWeather() {
  const weights = {};
  for (const col of COLORS) {
    const cw = COLOR_WEATHER[col];
    if (gameTime < cw.unlock_t) { weights[col] = 0; continue; }
    const ramp = Math.min(1, (gameTime - cw.unlock_t) / 60); // 0→1 over 60s
    const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * gameTime / cw.period + cw.phase * Math.PI * 2);
    weights[col] = cw.base * ramp * (0.5 + 0.5 * wave); // oscillates between 0 and base
  }
  return weights;
}

function sampleColorWeather() {
  const w = colorWeather();
  let total = 0;
  for (const col of COLORS) total += w[col];
  if (total <= 0) return 'red'; // fallback
  let r = Math.random() * total;
  for (const col of COLORS) {
    r -= w[col];
    if (r <= 0) return col;
  }
  return 'red';
}

const COLOR_SPD_MULT = { red: 1.0, blue: 0.5, yellow: 2.0, green: 1.0, purple: 1.1 };
const COLOR_HP      = { red: 6,   blue: 8,   yellow: 3,   green: 6,   purple: 6   };
const FUSION_UNLOCK_KILLS = 100; // fusion enemies start appearing after 100 kills
const FUSION_CHANCE_BASE  = 0.20; // 20% of spawns become fusion once unlocked

function makeFusionEnemy(x, y, components) {
  // Fusion rules: HP = sum of components, speed = average, behavior = all combined
  const mods = getMods();
  const hp = components.reduce((s, c) => s + (COLOR_HP[c] || CFG.ENEMY_HP), 0) + mods.enemyHpBonus;
  const avgSpdMult = components.reduce((s, c) => s + (COLOR_SPD_MULT[c] || 1), 0) / components.length;
  const spd = CFG.ENEMY_BASE_SPEED * (0.5 + Math.random() * 0.8) * avgSpdMult * (1 + mods.enemySpeedMult);
  const ang = Math.random() * Math.PI * 2;
  return {
    x, y,
    vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    maxSpd: spd * 1.4,
    r: CFG.ENEMY_R + 2 * (components.length - 1), // slightly bigger
    hp, maxHp: hp,
    color: components[0], // primary color for display tint
    colors: components,   // all component colors
    fusion: true,
    angleQueue: [randomAngle(), randomAngle(), randomAngle(), randomAngle()],
    alive: true,
    crackShake: 0,
    slowTimer: 0,
    healAuraTimer: 0,
  };
}

function addEnemy() {
  let x, y, tries = 0;
  const minDist = 150;
  const maxDist = Math.max(W(), H()) * 0.7;
  do {
    const a = Math.random() * Math.PI * 2;
    const d = minDist + Math.random() * maxDist;
    x = player.x + Math.cos(a) * d;
    y = player.y + Math.sin(a) * d;
  } while (++tries < 20 && Math.hypot(x - player.x, y - player.y) < minDist);

  // Fusion chance after threshold — color count grows every 100 kills
  const mods = getMods();
  const fusionUnlock = FUSION_UNLOCK_KILLS - (mods.fusionEarlySpawn > 0 ? 12 : 0);
  if (killCount >= fusionUnlock && Math.random() < FUSION_CHANCE_BASE) {
    const w = colorWeather();
    const pool = COLORS.filter(c => w[c] > 0.05);
    if (pool.length >= 2) {
      // 100-199: 2-color only; 200-299: 2-3; 300+: 2-4
      const maxColors = killCount >= 300 ? 4 : killCount >= 200 ? 3 : 2;
      const numColors = 2 + Math.floor(Math.random() * Math.max(1, maxColors - 1));
      const shuffled = pool.slice().sort(() => Math.random() - 0.5);
      const components = shuffled.slice(0, Math.min(numColors, shuffled.length));
      if (components.length >= 2) {
        enemies.push(makeFusionEnemy(x, y, components));
        return;
      }
    }
  }

  const color = sampleColorWeather();
  const spdMult = (COLOR_SPD_MULT[color] || 1.0) * (1 + mods.enemySpeedMult);
  const hp      = (COLOR_HP[color] || CFG.ENEMY_HP) + mods.enemyHpBonus;
  const spd = CFG.ENEMY_BASE_SPEED * (0.5 + Math.random() * 0.8) * spdMult;
  const ang = Math.random() * Math.PI * 2;
  enemies.push({
    x, y,
    vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    maxSpd: spd * 1.4,
    r:  CFG.ENEMY_R,
    hp, maxHp: hp,
    color,
    colors: [color],
    fusion: false,
    angleQueue: [randomAngle(), randomAngle(), randomAngle(), randomAngle()],
    alive: true,
    crackShake: 0,
    slowTimer: 0,
    healAuraTimer: 0,
  });
}

// ══════════════════════════════════════════════
//  EFFECTS
// ══════════════════════════════════════════════
const effects = [];
function addFx(type, x, y, opts = {}) {
  effects.push({ type, x, y, age: 0, maxAge: 30, seed: Math.random() * 6.283, ...opts });
  if (type === 'explosion' && STAIN_COLORS.has(opts.color)) addStain(x, y, opts.color);
}

// ══════════════════════════════════════════════
//  KEY DROPS  (world-space collectibles)
// ══════════════════════════════════════════════
const keyDrops = [];
const KEY_DROP_CHANCE  = 1.00;  // probability an enemy drops a key
function effectiveDropChance() {
  return Math.max(0.05, KEY_DROP_CHANCE + getMods().keyDropChanceMult);
}
const KEY_PICK_RADIUS  = 28;    // auto-collect distance
const KEY_BOB_AMP      = 3.5;   // pixel amplitude of bob
const KEY_BOB_SPEED    = 2.2;   // radians/s

function allColorsFused() {
  // True only when a single slot contains all 5 colors (fusion is pointless)
  return keySlots.some(s => COLORS.every(c => s.colors.includes(c)));
}

const KEY_DROP_CAP = 30;
function dropKey(x, y, color) {
  if (keyDrops.length >= KEY_DROP_CAP) keyDrops.splice(0, 1); // remove oldest
  keyDrops.push({ x, y, color, age: 0 });
}

function updateKeyDrops() {
  const pickR = KEY_PICK_RADIUS * (1 + getMods().keyPickRadiusMult);
  for (let i = keyDrops.length - 1; i >= 0; i--) {
    const k = keyDrops[i];
    k.age++;
    if (Math.hypot(player.x - k.x, player.y - k.y) < pickR) {
      collectKey(k.color);
      addFx('keyCollect', k.x, k.y, { color: COLOR_HEX[k.color], maxAge: 22 });
      keyDrops.splice(i, 1);
    }
  }
}

function durCap() {
  return Math.max(8, Math.round(CFG.KEY_DROP_DUR * 4 * (1 + getMods().durPoolMult)));
}

function collectKey(color) {
  const mods = getMods();
  const cap  = durCap();
  const slot = keySlots.find(s => s.colors.includes(color));
  if (slot) {
    const baseDur = CFG.KEY_DROP_DUR + mods.keyDropDurBonus;
    const actualDur = Math.max(1, Math.round(baseDur * Math.max(0.1, 1 + mods.keyDropDurMult)));
    slot.dur = Math.min(cap, slot.dur + actualDur);
  }
  hintEvent('key');
  if (!firstKeyAnnounced && color === 'blue') { firstKeyAnnounced = true; orbAnnounce = { label: 'タップで鍵切替', color: '#6699ff', age: 0, maxAge: 110, slowFrames: 70 }; }
  playKeyPickupSound(color);
}

// ══════════════════════════════════════════════
//  AUDIO  (Web Audio API — procedural synthesis)
// ══════════════════════════════════════════════
let _ac = null;
function ac() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  if (_ac.state === 'suspended') _ac.resume();
  return _ac;
}

// Noise burst for the カチッ click transient
function makeClickNode(ac, freq, duration) {
  const len  = Math.ceil(ac.sampleRate * duration);
  const buf  = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bpf = ac.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = freq;
  bpf.Q.value = 4;
  src.connect(bpf);
  return { node: bpf, src };
}

// hitsLanded: hits so far after this blow (1=first); combo: current combo count; depleted: no key dur
function playHitSound(hitsLanded, maxHp, crit, combo = 0, depleted = false) {
  const a   = ac();
  const now = a.currentTime;

  // Pitch: 220→880 Hz as HP is depleted (t → 1 when nearly dead)
  const t        = Math.min((hitsLanded - 1) / Math.max(maxHp - 1, 1), 1);
  const baseFreq = 220 * Math.pow(4, t * 0.85);

  // 枯渇時: 解錠音と同じ構造、トライアングル波で鈍い音色
  if (depleted) {
    const master = a.createGain();
    master.gain.setValueAtTime(0.45, now);
    master.connect(a.destination);
    [[880, 0.9], [880 * 2.756, 0.5], [880 * 5.404, 0.25]].forEach(([f, amp]) => {
      const osc = a.createOscillator(), g = a.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(g); g.connect(master);
      osc.start(now); osc.stop(now + 0.32);
    });
    const { node: cn, src: cs } = makeClickNode(a, 4000, 0.02);
    const cg = a.createGain();
    cg.gain.setValueAtTime(1.2, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    cn.connect(cg); cg.connect(master);
    cs.start(now); cs.stop(now + 0.025);
    return;
  }

  const masterVol = crit ? 0.52 : 0.32;
  const master = a.createGain();
  master.gain.setValueAtTime(masterVol, now);
  master.connect(a.destination);

  // ── カチッ: noise burst through bandpass ──
  const { node: clickOut, src: clickSrc } = makeClickNode(a, baseFreq * 6, 0.03);
  const clickGain = a.createGain();
  clickGain.gain.setValueAtTime(0.9, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
  clickOut.connect(clickGain);
  clickGain.connect(master);
  clickSrc.start(now);
  clickSrc.stop(now + 0.035);

  // ── シャーン: metallic bell partials ──
  const partials = [1, 2.756, 5.404];
  const amps     = [1.0, 0.45, 0.22];
  const decay    = 0.38 + t * 0.55 + (crit ? 0.28 : 0);

  for (let i = 0; i < partials.length; i++) {
    const osc  = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * partials[i], now);
    gain.gain.setValueAtTime(amps[i] * 0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }

  // ── クリティカル専用: 上昇スイープ + 高域リン ──
  if (crit && !depleted) {
    // 上昇スイープ（シャーッと鳴る）
    const sweepOsc  = a.createOscillator();
    const sweepGain = a.createGain();
    sweepOsc.type = 'sawtooth';
    sweepOsc.frequency.setValueAtTime(baseFreq * 1.5, now);
    sweepOsc.frequency.exponentialRampToValueAtTime(baseFreq * 7, now + 0.13);
    sweepGain.gain.setValueAtTime(0.30, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    sweepOsc.connect(sweepGain);
    sweepGain.connect(master);
    sweepOsc.start(now);
    sweepOsc.stop(now + 0.20);

    // 高域リン（余韻のベル）
    const ringOsc  = a.createOscillator();
    const ringGain = a.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(1760 + baseFreq * 0.5, now);
    ringGain.gain.setValueAtTime(0.38, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.60);
    ringOsc.connect(ringGain);
    ringGain.connect(master);
    ringOsc.start(now);
    ringOsc.stop(now + 0.65);
  }

  // ── コンボ輝き: 高域シマーがコンボに連動して増す ──
  if (!depleted && combo > 2) {
    const shimAmp  = Math.min(0.20, 0.04 * Math.sqrt(combo - 2));
    const shimFreq = 4200 + t * 3500;
    const shimOsc  = a.createOscillator();
    const shimGain = a.createGain();
    shimOsc.type = 'sine';
    shimOsc.frequency.setValueAtTime(shimFreq, now);
    shimGain.gain.setValueAtTime(shimAmp, now);
    shimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    shimOsc.connect(shimGain);
    shimGain.connect(master);
    shimOsc.start(now);
    shimOsc.stop(now + 0.24);
  }
}

// Full unlock: bright shimmering chord
function playUnlockSound() {
  const a   = ac();
  const now = a.currentTime;

  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);

  // Chord: A5 + C#6 + E6 + A6
  const freqs = [880, 1108.73, 1318.51, 1760];
  const amps  = [0.9, 0.75, 0.65, 0.5];
  for (let i = 0; i < freqs.length; i++) {
    const osc  = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqs[i], now);
    gain.gain.setValueAtTime(amps[i], now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 1.7);
  }

  // Click transient on top
  const { node: clickOut, src: clickSrc } = makeClickNode(a, 4000, 0.02);
  const cg = a.createGain();
  cg.gain.setValueAtTime(1.2, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
  clickOut.connect(cg);
  cg.connect(master);
  clickSrc.start(now);
  clickSrc.stop(now + 0.025);
}

// Soft triangle tone: slot A selected
function playFusionSelectSound() {
  const a = ac();
  const now = a.currentTime;
  const osc  = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain); gain.connect(a.destination);
  osc.start(now); osc.stop(now + 0.25);
}

// Two-note harmony: slot B chosen, preview stage
function playFusionPreviewSound() {
  const a = ac();
  const now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  [[523.25, 0], [659.26, 0.06]].forEach(([f, delay]) => {
    const osc = a.createOscillator();
    const g   = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now + delay);
    g.gain.setValueAtTime(0.8, now + delay);
    g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.55);
    osc.connect(g); g.connect(master);
    osc.start(now + delay); osc.stop(now + delay + 0.6);
  });
}

// Rising arpeggio + click transient: fusion confirmed
function playFusionCompleteSound() {
  const a = ac();
  const now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  [261.63, 329.63, 392, 523.25, 659.26, 783.99].forEach((f, i) => {
    const osc = a.createOscillator();
    const g   = a.createGain();
    const t0  = now + i * 0.065;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.7, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + 0.65);
  });
  const { node: co, src: cs } = makeClickNode(a, 3000, 0.02);
  const cg = a.createGain();
  cg.gain.setValueAtTime(1.0, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  co.connect(cg); cg.connect(master);
  cs.start(now); cs.stop(now + 0.025);
}

// 刻印取得音: レアリティに応じたアクセント
function playDraftPickSound(rarity) {
  const a = ac();
  const now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);

  if (rarity === RARITY.EPIC) {
    // C5→E5→G5→C6 アルペジオ + 高域シマー
    [523.25, 659.26, 783.99, 1046.5].forEach((f, i) => {
      const osc = a.createOscillator(), g = a.createGain(), t0 = now + i * 0.052;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.70, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.3);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + 1.4);
    });
    const shimO = a.createOscillator(), shimG = a.createGain();
    shimO.type = 'triangle'; shimO.frequency.value = 5200;
    shimG.gain.setValueAtTime(0.28, now);
    shimG.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    shimO.connect(shimG); shimG.connect(master);
    shimO.start(now); shimO.stop(now + 0.35);
    const { node: co, src: cs } = makeClickNode(a, 5000, 0.02);
    const cg = a.createGain(); cg.gain.setValueAtTime(1.0, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    co.connect(cg); cg.connect(master); cs.start(now); cs.stop(now + 0.02);
  } else if (rarity === RARITY.RARE) {
    // C5→E5 上昇2音
    [[523.25, 0], [659.26, 0.09]].forEach(([f, delay]) => {
      const osc = a.createOscillator(), g = a.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + delay);
      g.gain.setValueAtTime(0.75, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.60);
      osc.connect(g); g.connect(master);
      osc.start(now + delay); osc.stop(now + delay + 0.65);
    });
    const { node: co, src: cs } = makeClickNode(a, 3500, 0.02);
    const cg = a.createGain(); cg.gain.setValueAtTime(0.7, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    co.connect(cg); cg.connect(master); cs.start(now); cs.stop(now + 0.02);
  } else {
    // Common: E5 単発ピン
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'sine'; osc.frequency.value = 659.26;
    g.gain.setValueAtTime(0.65, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.37);
  }
}

// 鍵スロット切替音: カチッ (鍵取得と同程度の音量)
function playSlotSelectSound() {
  const a = ac(), now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.9, now);
  master.connect(a.destination);
  // 高めのトーン + 倍音
  [[1200, 0.9], [2400, 0.3]].forEach(([f, amp]) => {
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);
    g.gain.setValueAtTime(amp, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.065);
  });
  // クリックノイズ
  const { node: cn, src: cs } = makeClickNode(a, 3000, 0.010);
  const cg = a.createGain();
  cg.gain.setValueAtTime(1.0, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.010);
  cn.connect(cg); cg.connect(master);
  cs.start(now); cs.stop(now + 0.015);
}

// 鍵枯渇音: くぐもった解錠音 (低周波直結でフィルター損失なし)
function playKeyDepletedSound() {
  const a = ac(), now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  [[100, 1.0], [150, 0.8], [200, 0.5]].forEach(([f, amp]) => {
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.linearRampToValueAtTime(f * 0.5, now + 0.30);
    g.gain.setValueAtTime(amp, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.36);
  });
  const { node: cn, src: cs } = makeClickNode(a, 180, 0.025);
  const cg = a.createGain();
  cg.gain.setValueAtTime(1.5, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  cn.connect(cg); cg.connect(master);
  cs.start(now); cs.stop(now + 0.030);
}

function playDraftSkipSound() {
  const a = ac();
  const now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  [[392, 0], [329.63, 0.10]].forEach(([f, delay]) => {
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now + delay);
    g.gain.setValueAtTime(0.7, now + delay);
    g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
    osc.connect(g); g.connect(master);
    osc.start(now + delay); osc.stop(now + delay + 0.33);
  });
}

// 鍵取得音: 色ごとのピッチで短いチャイム
function playKeyPickupSound(color) {
  const a = ac();
  const now = a.currentTime;
  const pitchMap = { red: 659.26, blue: 587.33, yellow: 783.99, green: 523.25, purple: 698.46 };
  const freq = pitchMap[color] || 659.26;
  const master = a.createGain();
  master.gain.setValueAtTime(0.28, now);
  master.connect(a.destination);
  // 基音 + 1オクターブ上の倍音
  [[freq, 1.0], [freq * 2, 0.35]].forEach(([f, amp]) => {
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);
    g.gain.setValueAtTime(amp, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.35);
  });
  // 短いクリック
  const { node: co, src: cs } = makeClickNode(a, freq * 4, 0.015);
  const cg = a.createGain();
  cg.gain.setValueAtTime(0.6, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
  co.connect(cg); cg.connect(master);
  cs.start(now); cs.stop(now + 0.018);
}

function playDamageSound() {
  const a = ac();
  const now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.28, now);
  master.connect(a.destination);
  [[280, 1.0], [140, 0.5]].forEach(([f, amp]) => {
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.linearRampToValueAtTime(f * 0.45, now + 0.22);
    g.gain.setValueAtTime(amp, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.28);
  });
  const { node: cn, src: cs } = makeClickNode(a, 600, 0.02);
  const cg = a.createGain();
  cg.gain.setValueAtTime(1.0, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
  cn.connect(cg); cg.connect(master);
  cs.start(now); cs.stop(now + 0.025);
}

function playPhantomPickupSound() {
  const a = ac(), now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  // Ethereal rising chime
  [[880, 1320, 0.5], [1320, 2200, 0.3], [2200, 3300, 0.15]].forEach(([f0, f1, amp], i) => {
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, now + i * 0.08);
    osc.frequency.linearRampToValueAtTime(f1, now + 0.5 + i * 0.08);
    g.gain.setValueAtTime(amp, now + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.9 + i * 0.08);
    osc.connect(g); g.connect(master);
    osc.start(now + i * 0.08); osc.stop(now + 1.0);
  });
}

function playPhantomEnterSound() {
  const a = ac(), now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  // Broadband crack — multiple staggered noise bursts
  for (let i = 0; i < 5; i++) {
    const { node: n, src: s } = makeClickNode(a, 300 + i * 800, 0.03);
    const g = a.createGain();
    g.gain.setValueAtTime(0.8 - i * 0.12, now + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06 + i * 0.04);
    n.connect(g); g.connect(master);
    s.start(now + i * 0.04); s.stop(now + 0.10 + i * 0.04);
  }
  // Mid-range whoosh (triangle has audible harmonics on phone speakers)
  const osc = a.createOscillator(), tg = a.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, now); osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);
  tg.gain.setValueAtTime(0.9, now); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
  osc.connect(tg); tg.connect(master); osc.start(now); osc.stop(now + 0.40);
}

function playPhantomOrbCollectSound() {
  const a = ac(), now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  const { node: n, src: s } = makeClickNode(a, 1200, 0.015);
  const g = a.createGain();
  g.gain.setValueAtTime(1.0, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  n.connect(g); g.connect(master); s.start(now); s.stop(now + 0.05);
  const osc = a.createOscillator(), og = a.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(1600, now); osc.frequency.exponentialRampToValueAtTime(400, now + 0.12);
  og.gain.setValueAtTime(0.4, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  osc.connect(og); og.connect(master); osc.start(now); osc.stop(now + 0.16);
}

function playPhantomExitSound() {
  const a = ac(), now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  // Simultaneous shatter — many rapid noise bursts
  for (let i = 0; i < 8; i++) {
    const { node: n, src: s } = makeClickNode(a, 400 + i * 600, 0.025);
    const g = a.createGain();
    g.gain.setValueAtTime(0.7, now + i * 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + i * 0.015);
    n.connect(g); g.connect(master);
    s.start(now + i * 0.015); s.stop(now + 0.08 + i * 0.015);
  }
  // Mid boom (triangle for audibility on phone speakers)
  const osc = a.createOscillator(), bg = a.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
  bg.gain.setValueAtTime(1.0, now); bg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  osc.connect(bg); bg.connect(master); osc.start(now); osc.stop(now + 0.58);
}

function playInfectionSound() {
  const a = ac();
  const now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  // Ominous downward sweep (triangle for harmonics audible on phone speakers)
  [[220, 90, 0.7], [330, 140, 0.5], [550, 220, 0.3]].forEach(([f0, f1, amp], i) => {
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, now + i * 0.05);
    osc.frequency.exponentialRampToValueAtTime(f1, now + 0.6 + i * 0.05);
    g.gain.setValueAtTime(amp, now + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.8 + i * 0.05);
    osc.connect(g); g.connect(master);
    osc.start(now + i * 0.05); osc.stop(now + 0.9);
  });
  // Eerie high shimmer
  const shimmer = a.createOscillator(), sg = a.createGain();
  shimmer.type = 'sine';
  shimmer.frequency.setValueAtTime(1200, now);
  shimmer.frequency.linearRampToValueAtTime(800, now + 1.0);
  sg.gain.setValueAtTime(0.0, now);
  sg.gain.linearRampToValueAtTime(0.35, now + 0.15);
  sg.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
  shimmer.connect(sg); sg.connect(master);
  shimmer.start(now); shimmer.stop(now + 1.2);
}

function playEnemyBoostKeySound() {
  const a = ac();
  const now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  // Warning thud — triangle for odd harmonics (audible on phone speakers)
  const thud = a.createOscillator();
  const tg = a.createGain();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(300, now);
  thud.frequency.exponentialRampToValueAtTime(110, now + 0.18);
  tg.gain.setValueAtTime(1.0, now);
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  thud.connect(tg); tg.connect(master);
  thud.start(now); thud.stop(now + 0.30);
  // Dissonant overtone
  const over = a.createOscillator();
  const og = a.createGain();
  over.type = 'sawtooth';
  over.frequency.setValueAtTime(380, now);
  og.gain.setValueAtTime(0.35, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
  over.connect(og); og.connect(master);
  over.start(now); over.stop(now + 0.22);
  // Noise burst
  const { node: no, src: ns } = makeClickNode(a, 200, 0.04);
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.6, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  no.connect(ng); ng.connect(master);
  ns.start(now); ns.stop(now + 0.06);
}

function playPaintPickupSound() {
  const a = ac(), now = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.45, now);
  master.connect(a.destination);
  // Ascending iridescent arpeggio — staggered sine tones
  [[523, 0.55], [659, 0.45], [784, 0.35], [1047, 0.25], [1319, 0.18]].forEach(([f, amp], i) => {
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now + i * 0.055);
    g.gain.setValueAtTime(amp, now + i * 0.055);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + i * 0.055);
    osc.connect(g); g.connect(master);
    osc.start(now + i * 0.055); osc.stop(now + 0.65);
  });
  // Shimmer click at the top
  const { node: cn, src: cs } = makeClickNode(a, 3000, 0.012);
  const cg = a.createGain();
  cg.gain.setValueAtTime(0.9, now + 0.22);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
  cn.connect(cg); cg.connect(master);
  cs.start(now + 0.22); cs.stop(now + 0.28);
}

// ══════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════
let touch                = null; // { sx, sy, t }  — screen coords
let touchStartInsideRing = false;

function playerScreenPos() { return w2s(player.x, player.y); }

// Returns true if the tap was handled by the key panel
function handlePanelTap(sx, sy) {
  const slots = keyPanelSlots();
  for (const s of slots) {
    if (Math.hypot(sx - s.cx, sy - s.cy) < s.r + 6) {
      if (s.slot.dur > 0) { selectedSlotIdx = s.idx; playSlotSelectSound(); hintEvent('slot'); }
      return true;
    }
  }
  return false;
}


function fusionConfirmBounds(w, h) {
  const cx = w / 2, btnY = h / 2 + 60;
  return {
    confirm: { x: cx - 160, y: btnY, w: 140, h: 48 },
    cancel:  { x: cx + 20,  y: btnY, w: 140, h: 48 },
  };
}

function pointerDown(sx, sy) {
  if (state === State.TITLE) {
    ac();
    state = State.IDLE;
    orbAnnounce = { label: 'Tap & Flick', color: '#cccccc', age: 0, maxAge: 110, slowFrames: 70 };
    touch = null;
    return;
  }
  if (state === State.GAMEOVER) {
    gameOverHoldStart = performance.now();
    return;
  }
  // Pause button (available during IDLE and CONNECTED)
  if (state === State.IDLE || state === State.CONNECTED) {
    const pb = pauseButtonBounds();
    if (sx >= pb.x && sx <= pb.x + pb.w && sy >= pb.y && sy <= pb.y + pb.h) {
      stateBeforePause = state;
      state = State.PAUSED;
      return;
    }
  }
  // FUSION_SELECT: select → confirm two-step flow
  if (state === State.FUSION_SELECT) {
    if (fusionSlotB !== -1) {
      // Confirmation stage: only confirm/cancel buttons are active
      const btn = fusionConfirmBounds(W(), H());
      const inBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      if (inBox(btn.confirm, sx, sy)) {
        fuseSlots(fusionSlotA, fusionSlotB);
        playFusionCompleteSound();
        fusionSlotA = -1; fusionSlotB = -1;
        state = State.IDLE;
        touch = null; return;
      }
      if (inBox(btn.cancel, sx, sy)) {
        fusionSlotA = -1; fusionSlotB = -1; // 選択し直し、FUSION_SELECT継続
      }
      touch = null; return;
    }
    // Selection stage: tap a slot
    const fslots = keyPanelSlots();
    for (const s of fslots) {
      if (Math.hypot(sx - s.cx, sy - s.cy) < s.r + 10) {
        if (fusionSlotA === -1) {
          fusionSlotA = s.idx;
          playFusionSelectSound();
        } else if (s.idx !== fusionSlotA) {
          fusionSlotB = s.idx;
          playFusionPreviewSound();
        }
        touch = null; return;
      }
    }
    // Tap outside panel: ignore
    touch = null; return;
  }
  // PAINT_DRAFT: pick one of 3 paint choices, skip, or reset
  if (state === State.PAINT_DRAFT) {
    if (performance.now() - paintDraftOpenedAt >= 700) {
      const { cards, skip, reset } = paintDraftAllBounds(W(), H());
      for (const b of cards) {
        if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
          applyPaintInscription(paintDraftChoices[b.index]);
          paintDraftChoices = []; state = State.IDLE; break;
        }
      }
      if (sx >= skip.x && sx <= skip.x + skip.w && sy >= skip.y && sy <= skip.y + skip.h) {
        paintDraftChoices = []; state = State.IDLE;
      }
      if (sx >= reset.x && sx <= reset.x + reset.w && sy >= reset.y && sy <= reset.y + reset.h) {
        activePaints.length = 0; paintDraftChoices = []; state = State.IDLE;
      }
    }
    touch = null; return;
  }
  // PAUSED: record touch for button detection in pointerUp
  if (state === State.PAUSED) {
    touch = { sx, sy, t: performance.now() };
    return;
  }
  if (handlePanelTap(sx, sy)) return;
  touch = { sx, sy, t: performance.now() };
  phantomHoldFired = false;

  if (state === State.IDLE) {
    // Enemy tap? (convert screen → world)
    const { x: wx, y: wy } = s2w(sx, sy);
    for (const e of enemies) {
      if (!e.alive) continue;
      if (Math.hypot(wx - e.x, wy - e.y) < e.r + 28) {
        connectEnemy(e);
        touch = null;
        return;
      }
    }
  } else if (state === State.CONNECTED) {
    // Record whether touch origin is inside inner ring (screen space)
    const ps = playerScreenPos();
    touchStartInsideRing = Math.hypot(sx - ps.x, sy - ps.y) < CFG.INNER_R;
  }
}

function pointerUp(sx, sy) {
  if (state === State.GAMEOVER) { gameOverHoldStart = 0; return; }
  if (!touch) return;
  const dx   = sx - touch.sx;
  const dy   = sy - touch.sy;
  const dist = Math.hypot(dx, dy);
  const dt   = Math.max(performance.now() - touch.t, 25);

  if (state === State.PAUSED) {
    const L = pauseLayout(W(), H());
    const hit = b => touch.sx >= b.x && touch.sx <= b.x + b.w && touch.sy >= b.y && touch.sy <= b.y + b.h;
    if (hit(L.resume)) state = stateBeforePause;
    else if (hit(L.reset)) resetGame();
    else if (hit(L.hints)) { resetHints(); playSlotSelectSound(); }
    touch = null;
    return;
  }

  if (state === State.DRAFT) {
    handleDraftTap(touch.sx, touch.sy);
    touch = null;
    return;
  }

  // Phantom mode toggle: fires during hold (phantomHoldFired); on release just consume the touch
  if (phantomOrbPickedUp && state === State.IDLE && dt >= PHANTOM_HOLD_MS && dist < 25) {
    touch = null;
    return;
  }

  if (state === State.IDLE) {
    if (dist < CFG.FLICK_MIN) {
      // Tap → immediate stop (unless noTapStop debuff active)
      if (getMods().noTapStop <= 0) player.vx = player.vy = 0;
    } else {
      // Flick → move
      const moveMult = 1 + getMods().speedMult;
      const flickCapMult = Math.max(0.2, 1 + getMods().flickSpeedCap);
      const spd = Math.min(dist / dt * 12 * Math.max(0.1, moveMult) * flickCapMult, CFG.MAX_SPEED * flickCapMult);
      const a   = Math.atan2(dy, dx);
      player.vx = Math.cos(a) * spd;
      player.vy = Math.sin(a) * spd;
      hintEvent('move');
    }
  } else if (state === State.CONNECTED) {
    if (touchStartInsideRing) {
      // Started inside inner ring → unlock attempt, regardless of where it ends
      if (dist < CFG.FLICK_MIN) {
        uiShake = 10;
        addFx('miss', player.x, player.y, { maxAge: 16 });
      } else {
        tryUnlock(dx, dy);
      }
    } else {
      // Started outside inner ring → disconnect and move in flick direction
      if (getMods().cannotEscape > 0) {
        uiShake = 8; // feedback: can't escape
      } else {
        emergencyEscape(dx, dy, dt);
      }
    }
  }

  touch = null;
}

canvas.addEventListener('touchstart',  e => { e.preventDefault(); const t = e.changedTouches[0]; trailStart(t.clientX, t.clientY); pointerDown(t.clientX, t.clientY); }, { passive: false });
canvas.addEventListener('touchmove',   e => { e.preventDefault(); const t = e.changedTouches[0]; trailMove(t.clientX, t.clientY); }, { passive: false });
canvas.addEventListener('touchend',    e => { e.preventDefault(); const t = e.changedTouches[0]; pointerUp(t.clientX, t.clientY);   }, { passive: false });
canvas.addEventListener('touchcancel', e => { e.preventDefault(); touch = null; }, { passive: false });
canvas.addEventListener('mousedown', e => { trailStart(e.clientX, e.clientY); pointerDown(e.clientX, e.clientY); });
canvas.addEventListener('mousemove', e => trailMove(e.clientX, e.clientY));
canvas.addEventListener('mouseup',   e => pointerUp(e.clientX, e.clientY));

// ══════════════════════════════════════════════
//  GAME LOGIC
// ══════════════════════════════════════════════
function connectEnemy(enemy) {
  connectedEnemy = enemy;
  state          = State.CONNECTED;
  player.vx      = player.vy = 0;
  beamFlash      = 0;
  ghostTimer     = Math.max(10, Math.round(CFG.GHOST_FRAMES * Math.max(0.05, 1 + getMods().ghostTimerMult)));
  hintEvent('connect');
}

function activeSlot() {
  return keySlots[Math.min(selectedSlotIdx, keySlots.length - 1)] || keySlots[0] || { colors: ['red'], dur: 0 };
}
function activeKeyColor() {
  return activeSlot().colors[0];
}

function tryUnlock(dx, dy) {
  if (!connectedEnemy) return;
  const flickAngle = Math.atan2(dy, dx);
  const diff = angleDiff(flickAngle, connectedEnemy.angleQueue[0]);
  const mods      = getMods();
  const tolerance = CFG.UNLOCK_TOLERANCE + mods.flickTolerance;
  if (Math.abs(diff) < Math.max(5 * Math.PI / 180, tolerance)) {
    const slot       = activeSlot();
    const slotColors = slot.colors;
    const hasKey     = slot.dur > 0;
    const redCritAll = mods.redCritAll > 0 && slotColors.includes('red');
    const enemyColors = connectedEnemy.colors || [connectedEnemy.color];
    const colorMatch = slotColors.some(c => enemyColors.includes(c));
    const mismatchCrit = !colorMatch && !redCritAll && mods.mismatchCritChance > 0 && Math.random() < mods.mismatchCritChance;
    const crit       = (hasKey || mods.depletedEffects > 0) && (colorMatch || redCritAll || mismatchCrit);

    const effectiveCoeff = Math.max(0, CFG.COMBO_COEFF + mods.comboCoeff);
    const comboMult = 1 + effectiveCoeff * Math.sqrt(combo);
    const isRed = slotColors.includes('red');
    const redDmgBonus = isRed ? mods.redDmgMult : 1;
    const critBonus = 2 + mods.critMult + (crit && isRed ? mods.redCritMult : 0);
    const untouchedMult = mods.untouchedBonus > 0 && untouchedStreak > 0 ? 1.5 : 1;
    const baseDmg = Math.round(comboMult * mods.globalDmgMult * redDmgBonus * untouchedMult * (crit ? critBonus : 1));
    const dmg = Math.max(1, baseDmg + (isRed ? mods.redDmgFlat : 0));

    if (hasKey) {
      const prevDur = slot.dur;
      slot.dur = Math.max(0, slot.dur - (crit ? CFG.DUR_COST_CRIT : CFG.DUR_COST_NORMAL));
      if (prevDur > 0 && slot.dur === 0) playKeyDepletedSound();
    }

    combo++;
    comboMissCount = 0;
    if (combo > maxCombo) maxCombo = combo;

    // B-S3: temp invincibility at combo threshold
    const comboInvThreshold = mods.comboInvincible;
    if (comboInvThreshold > 0 && combo > 0 && combo % comboInvThreshold === 0) {
      player.invincible = Math.max(player.invincible, 60); // 1 second
      addFx('heal', player.x, player.y, { maxAge: 20 });
    }

    hintEvent('hit');
    if (crit) hintEvent('crit');
    connectedEnemy.hp -= dmg;
    connectedEnemy.crackShake = 18;
    beamFlash = 8;
    connectedEnemy.angleQueue.shift();
    if (connectedEnemy.angleQueue.length < 3) connectedEnemy.angleQueue.push(randomAngle());
    addFx('hit', connectedEnemy.x, connectedEnemy.y, {
      color: hasKey ? COLOR_HEX[connectedEnemy.color] : '#aaaaaa',
      maxAge: crit ? 30 : 22,
      crit,
      dmg,
    });
    if (crit && navigator.vibrate) navigator.vibrate(14);
    // Apply all effects of every color in the active slot
    if (hasKey || mods.depletedEffects > 0) {
      for (const col of slotColors) applyKeyEffect(col, connectedEnemy);
    }
    if (connectedEnemy.hp <= 0) {
      fullyUnlock(connectedEnemy);
    } else {
      const hitsLanded = connectedEnemy.maxHp - connectedEnemy.hp;
      playHitSound(hitsLanded, connectedEnemy.maxHp, crit, combo, !hasKey);
      ghostTimer = Math.max(10, Math.round(CFG.GHOST_FRAMES * Math.max(0.05, 1 + getMods().ghostTimerMult)));
    }
  } else {
    const missMods = getMods();
    if (missMods.comboForgives > 0 && comboMissCount < missMods.comboForgives) {
      comboMissCount++;
      // forgiven miss: shake but don't break combo
      uiShake = 6;
    } else {
      combo = 0;
      comboMissCount = 0;
      uiShake = 10;
    }
    addFx('miss', player.x, player.y, { maxAge: 16 });
  }
}

function angleDiff(a, b) {
  let d = a - b;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Applies the active key's special effect (always when hasKey or depletedEffects mod active)
function applyKeyEffect(keyCol, target) {
  const mods = getMods();
  const rangeMult = mods.effectRangeMult;

  if (keyCol === 'blue') {
    const SLOW_R = 220 * (1 + mods.blueSlowRadMult) * rangeMult;
    const slowDur = Math.max(1, Math.round(180 + mods.blueSlowFactor * 180 + mods.blueSlowDuration));
    for (const e of enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - target.x, e.y - target.y) < SLOW_R) {
        e.slowTimer = Math.max(e.slowTimer || 0, Math.max(60, slowDur));
      }
    }
    addFx('slowAura', target.x, target.y, { maxAge: 30, color: COLOR_HEX['blue'] });
  } else if (keyCol === 'yellow') {
    const chainCount = 1 + Math.round(mods.yellowChainExtra);
    let hits = 0;
    const sorted = enemies
      .filter(e => e.alive && e !== target)
      .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
    for (const e of sorted) {
      if (hits >= chainCount) break;
      const chainHit = 1 + Math.round(mods.yellowChainDmgBonus);
      e.hp = Math.max(0, e.hp - chainHit);
      e.crackShake = 12;
      addFx('chain', e.x, e.y, { color: COLOR_HEX['yellow'], fromX: target.x, fromY: target.y, maxAge: 28 });
      if (mods.chainPropagatesEffects > 0) {
        const chainSlot = activeSlot();
        for (const col of chainSlot.colors) {
          if (col !== 'yellow') applyKeyEffect(col, e);
        }
      }
      if (e.hp <= 0) {
        e.alive = false;
        score++;
        killCount++;
        if (Math.random() < effectiveDropChance()) dropKey(e.x, e.y, e.color);
        addFx('explosion', e.x, e.y, { color: COLOR_HEX[e.color], maxAge: 45 });
      }
      hits++;
    }
  } else if (keyCol === 'green') {
    const healAmt = Math.max(0, 1 + mods.greenHealBonus + mods.greenHealMalus);
    if (healAmt > 0) {
      const maxHp = Math.max(1, CFG.PLAYER_HP_MAX + mods.maxHpBonus - mods.maxHpMalus);
      player.hp = Math.min(maxHp, player.hp + healAmt);
      addFx('heal', player.x, player.y, { maxAge: 35 });
    }
  } else if (keyCol === 'purple') {
    const BOMB_R = 160 * (1 + mods.purpleBombRadMult) * rangeMult;
    const bombDmg = 1 + Math.round(mods.purpleBombDmg);
    addFx('bomb', target.x, target.y, { maxAge: 40, color: COLOR_HEX['purple'] });
    for (const e of enemies) {
      if (!e.alive || e === target) continue;
      if (Math.hypot(e.x - target.x, e.y - target.y) < BOMB_R) {
        e.hp = Math.max(0, e.hp - bombDmg);
        e.crackShake = 10;
        if (e.hp <= 0) {
          e.alive = false;
          score++;
          killCount++;
          if (Math.random() < effectiveDropChance()) dropKey(e.x, e.y, e.color);
          addFx('explosion', e.x, e.y, { color: COLOR_HEX[e.color], maxAge: 45 });
          if (mods.bombChainOnKill > 0) {
            const chainR = BOMB_R * 0.6, chainDmg = Math.max(1, bombDmg - 1);
            addFx('bomb', e.x, e.y, { maxAge: 25, color: COLOR_HEX['purple'] });
            for (const e2 of enemies) {
              if (!e2.alive || e2 === e) continue;
              if (Math.hypot(e2.x - e.x, e2.y - e.y) < chainR) {
                e2.hp = Math.max(0, e2.hp - chainDmg);
                if (e2.hp <= 0) { e2.alive = false; score++; killCount++; if (Math.random() < effectiveDropChance()) dropKey(e2.x, e2.y, e2.color); addFx('explosion', e2.x, e2.y, { color: COLOR_HEX[e2.color], maxAge: 45 }); }
              }
            }
          }
        }
      }
    }
  }
  // red: no special effect
}

function fullyUnlock(enemy) {
  enemy.alive = false;
  score++;
  killCount++;

  // Normal inscription orb spawn threshold (up to 8; oldest normal orb replaced when full)
  if (killCount >= nextOrbAt) {
    const orbInterval = Math.max(3, Math.round(ORB_INTERVAL_KILLS / Math.max(0.2, 1 + getMods().orbFreqMult + getMods().orbFreqMalus)));
    nextOrbAt = killCount + orbInterval;
    const normalOrbs = inscriptionOrbs.filter(o => o.type === 'normal');
    if (normalOrbs.length >= 8) {
      const oldest = normalOrbs[0];
      const idx = inscriptionOrbs.indexOf(oldest);
      if (idx !== -1) inscriptionOrbs.splice(idx, 1);
    }
    spawnInscriptionOrb();
    if (!normalOrbAnnounced) { normalOrbAnnounced = true; orbAnnounce = { label: '刻印出現', color: '#aaaaaa', age: 0, maxAge: 110, slowFrames: 70 }; }
  }

  // Fusion inscription orb (200 kills, then every 100)
  // If all colors are already fused, spawn enemy boost inscription instead
  if (killCount >= nextFusionInsAt) {
    nextFusionInsAt += FUSION_INS_INTERVAL;
    if (allColorsFused()) {
      spawnEnemyBoostOrb();
      if (!enemyBoostAnnounced) { enemyBoostAnnounced = true; orbAnnounce = { label: '敵増加刻印', color: '#ff6622', age: 0, maxAge: 110, slowFrames: 70 }; }
    } else {
      spawnFusionInscriptionOrb();
      if (!fusionInsAnnounced) { fusionInsAnnounced = true; orbAnnounce = { label: '色融合刻印', color: '#ffcc44', age: 0, maxAge: 110, slowFrames: 70 }; }
    }
  }

  // Infection inscription — one-shot at 1000 kills
  if (!infectionOrbSpawned && killCount >= INFECTION_KILLS) {
    infectionOrbSpawned = true;
    spawnInfectionOrb();
    orbAnnounce = { label: '刻印感染', color: '#cc44ff', age: 0, maxAge: 110, slowFrames: 70 };
  }
  // Phantom inscription — one-shot at 1500 kills
  if (!phantomOrbSpawned && killCount >= PHANTOM_KILLS) {
    phantomOrbSpawned = true;
    spawnPhantomOrb();
    orbAnnounce = { label: '幻影刻印', color: '#44ffdd', age: 0, maxAge: 110, slowFrames: 70 };
  }

  // B-S2: heal on kill chance
  const mods = getMods();
  if (mods.healOnKillChance > 0 && Math.random() < mods.healOnKillChance) {
    player.hp = Math.min(Math.max(1, CFG.PLAYER_HP_MAX + mods.maxHpBonus - mods.maxHpMalus), player.hp + 1);
    addFx('heal', player.x, player.y, { maxAge: 25 });
  }
  // B-M2: bonus durability on kill for the active slot
  if (mods.bonusDurOnKill > 0) {
    const s = activeSlot();
    s.dur = Math.min(durCap(), s.dur + mods.bonusDurOnKill);
  }
  // B-D4: splash damage to nearby enemies on kill
  if (mods.splashDmgOnKill > 0) {
    const splashR = 100 * mods.effectRangeMult;
    const splashDmg = Math.round(mods.splashDmgOnKill);
    for (const e of enemies) {
      if (!e.alive || e === enemy) continue;
      if (Math.hypot(e.x - enemy.x, e.y - enemy.y) < splashR) {
        e.hp = Math.max(0, e.hp - splashDmg);
        e.crackShake = 8;
        addFx('hit', e.x, e.y, { color: '#ffdd88', maxAge: 18, crit: false, dmg: splashDmg });
        if (e.hp <= 0) {
          e.alive = false; score++; killCount++;
          if (Math.random() < effectiveDropChance()) dropKey(e.x, e.y, e.color);
          addFx('explosion', e.x, e.y, { color: COLOR_HEX[e.color], maxAge: 45 });
        }
      }
    }
  }
  // B-X5: untouched streak tracks kills without taking damage
  untouchedStreak++;
  const hex = COLOR_HEX[enemy.color] || CFG.KEY_COLOR;
  const [er, eg, eb] = [
    parseInt(hex.slice(1,3),16),
    parseInt(hex.slice(3,5),16),
    parseInt(hex.slice(5,7),16),
  ];
  addFx('explosion', enemy.x, enemy.y, { color: hex, maxAge: 55 });
  playUnlockSound();
  if (navigator.vibrate) navigator.vibrate([20, 10, 10]);
  screenFlash = { r: er, g: eg, b: eb, alpha: 0.12 };
  // Drop all component color keys for fusion enemies
  const dropColors = enemy.fusion ? enemy.colors : [enemy.color];
  for (const dc of dropColors) {
    if (Math.random() < effectiveDropChance()) dropKey(enemy.x, enemy.y, dc);
  }

  // Purple: death explosion — damages player if within 150px (including fusion with purple)
  if ((enemy.colors || [enemy.color]).includes('purple')) {
    const PURP_R = 150;
    addFx('bomb', enemy.x, enemy.y, { maxAge: 35, color: COLOR_HEX['purple'] });
    if (player.invincible <= 0 && Math.hypot(player.x - enemy.x, player.y - enemy.y) < PURP_R) {
      const purpMods = getMods();
      player.hp = Math.max(0, player.hp - (1 + Math.max(0, purpMods.incomingDmgBonus)));
      playDamageSound();
      player.invincible = Math.max(30, CFG.HIT_COOLDOWN + purpMods.invincibleBonus + purpMods.invincibleMalus);
      player.hitFlash   = 22;
      player.stunTimer  = Math.round(purpMods.stunOnHit);
      untouchedStreak   = 0;
      addFx('dmg', player.x, player.y, { maxAge: 25 });
      if (player.hp <= 0) {
        player.hp = 0;
        triggerGameOver();
        return;
      }
    }
  }

  connectedEnemy = null;
  state          = State.IDLE;
  ghostTimer     = 0;
  if (enemies.every(e => !e.alive)) setTimeout(() => { if (!enemies.some(e => e.alive)) spawnEnemies(); }, 1200);
}

function enterPhantomMode() {
  phantomMode = true;
  hintEvent('phantom');
  playPhantomEnterSound();
  screenFlash = { r: 200, g: 255, b: 240, alpha: 0.40 };
  // Clear floor clutter
  keyDrops.length = 0;
  for (let i = inscriptionOrbs.length - 1; i >= 0; i--) {
    if (inscriptionOrbs[i].type === 'normal') inscriptionOrbs.splice(i, 1);
  }
  // Convert all alive enemies to enemy_boost orbs (same as existing ones)
  for (const e of enemies) {
    if (!e.alive) continue;
    e.alive = false;
    inscriptionOrbs.push({ type: endlessMode ? 'paint' : 'enemy_boost', x: e.x, y: e.y, pulse: 0, fromPhantom: true });
  }
  orbAnnounce = { label: '幻影', color: '#88ffdd', age: 0, maxAge: 70, slowFrames: 0 };
}

function exitPhantomMode() {
  phantomMode = false;
  playPhantomExitSound();
  // Remove and explode all enemy_boost orbs on phantom exit
  for (let i = inscriptionOrbs.length - 1; i >= 0; i--) {
    if (inscriptionOrbs[i].type === 'enemy_boost' || inscriptionOrbs[i].type === 'paint') {
      addFx('explosion', inscriptionOrbs[i].x, inscriptionOrbs[i].y, { color: '#ff4400', maxAge: 45 });
      inscriptionOrbs.splice(i, 1);
    }
  }
  screenFlash = { r: 200, g: 255, b: 240, alpha: 0.35 };
  orbAnnounce = { label: '幻影解除', color: '#aacccc', age: 0, maxAge: 75, slowFrames: 0 };
}

function emergencyEscape(dx, dy, dt) {
  const dist = Math.hypot(dx, dy);
  if (dist >= CFG.FLICK_MIN) {
    const spd = Math.min(dist / dt * 12, CFG.MAX_SPEED);
    const a   = Math.atan2(dy, dx);
    player.vx = Math.cos(a) * spd;
    player.vy = Math.sin(a) * spd;
  }
  addFx('escape', player.x, player.y, { maxAge: 22 });
  hintEvent('escape');
  connectedEnemy = null;
  state          = State.IDLE;
  ghostTimer     = 0;
}

let lastResult        = null; // stores result snapshot for GAMEOVER screen
let gameOverHoldStart = 0;   // performance.now() when hold begins; 0 = not holding
const GAMEOVER_HOLD_MS = 800;

function triggerGameOver() {
  lastResult = { score, killCount, maxCombo, gameTime, inscriptions: activeInscriptions.length };
  if (killCount > highScore) { highScore = killCount; }
  totalKills += killCount;
  persistSave();
  state = State.GAMEOVER;
  connectedEnemy = null;
  gameOverHoldStart = 0;
}
let highScore    = 0;    // best kill count this session (persisted to localStorage)
let totalKills   = 0;    // cumulative kills across sessions

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem('croqkey_save') || '{}');
    highScore  = s.highScore  || 0;
    totalKills = s.totalKills || 0;
  } catch (e) { /* ignore */ }
}

function persistSave() {
  try {
    localStorage.setItem('croqkey_save', JSON.stringify({ highScore, totalKills }));
  } catch (e) { /* ignore */ }
}

loadSave();

function resetGame() {
  enemies.length = 0;
  effects.length = 0;
  keyDrops.length = 0;
  keySlots.length = 0;
  keySlots.push(
    { colors: ['red'],    dur: 16 },
    { colors: ['blue'],   dur: 0  },
    { colors: ['yellow'], dur: 0  },
    { colors: ['green'],  dur: 0  },
    { colors: ['purple'], dur: 0  },
  );
  selectedSlotIdx = 0;
  fusionSlotA = -1;
  fusionSlotB = -1;
  score = 0; frame = 0; gameTime = 0; spawnTimer = 0; enemyBoostStacks = 0;
  infectedMode = false; infectionOrbSpawned = false; fusionInsAnnounced = false; enemyBoostAnnounced = false; normalOrbAnnounced = false; firstKeyAnnounced = false; orbAnnounce = null;
  phantomMode = false; phantomOrbSpawned = false; phantomOrbPickedUp = false; phantomHoldFired = false;
  endlessMode = false; activePaints.length = 0; paintDraftChoices = [];
  beamFlash = uiShake = ghostTimer = 0;
  screenFlash = null; connectedEnemy = null;
  combo = 0; maxCombo = 0; killCount = 0; comboMissCount = 0;
  untouchedStreak = 0;
  comboIdleFrames = 0;
  lastResult = null;
  activeInscriptions.length = 0;
  inscriptionOrbs.length    = 0;
  draftChoices              = [];
  draftIsFusion             = false;
  nextOrbAt                 = ORB_UNLOCK_KILLS;
  nextFusionInsAt           = FUSION_INS_UNLOCK;
  stateBeforePause          = State.IDLE;
  state = State.IDLE;
  stainChunks.clear();
  stainBounds.x0 = stainBounds.y0 = Infinity; stainBounds.x1 = stainBounds.y1 = -Infinity;
  fieldNotes.length = 0;
  inkTrail.length = 0;
  activeHint = null;
  initPlayer();
  spawnEnemies();
  orbAnnounce = { label: 'Tap & Flick', color: '#cccccc', age: 0, maxAge: 110, slowFrames: 70 };
}

// ══════════════════════════════════════════════
//  UPDATE
// ══════════════════════════════════════════════
function update() {
  if (state === State.GAMEOVER) {
    if (gameOverHoldStart > 0 && performance.now() - gameOverHoldStart >= GAMEOVER_HOLD_MS) {
      gameOverHoldStart = 0;
      resetGame();
    }
    return;
  }
  if (state === State.TITLE || state === State.DRAFT || state === State.PAUSED || state === State.FUSION_SELECT || state === State.PAINT_DRAFT) return;
  frame++;
  updateHints();
  updateFieldNotes();
  gameTime = frame / 60;

  // Orb announce: age and compute slow factor
  let announceSf = 1.0;
  if (orbAnnounce) {
    orbAnnounce.age++;
    if (orbAnnounce.age >= orbAnnounce.maxAge) { orbAnnounce = null; }
    else if (orbAnnounce.age < orbAnnounce.slowFrames) { announceSf = 0.10; }
  }

  const sf = (state === State.CONNECTED ? CFG.SLOW_FACTOR : 1.0) * announceSf;

  // Player — apply speed mod cap
  if (state === State.IDLE) {
    const movMod = getMods().speedMult;
    const maxSpd = CFG.MAX_SPEED * Math.max(0.1, 1 + movMod);
    const spd    = Math.hypot(player.vx, player.vy);
    if (spd > maxSpd) {
      player.vx = (player.vx / spd) * maxSpd;
      player.vy = (player.vy / spd) * maxSpd;
    }
    player.x += player.vx * announceSf;
    player.y += player.vy * announceSf;
    const friction = Math.min(0.998, CFG.FRICTION + getMods().inertiaBonus * 0.018);
    player.vx *= friction;
    player.vy *= friction;
  }
  if (player.invincible > 0) player.invincible--;
  if (player.hitFlash   > 0) player.hitFlash--;
  if (player.stunTimer  > 0) player.stunTimer--;

  // D-R3: combo idle decay
  if (combo > 0) {
    if (state === State.IDLE) {
      comboIdleFrames++;
      const decayInterval = getMods().comboDrainAccel > 0 ? 45 : 300;
      if (comboIdleFrames >= decayInterval) { combo = Math.max(0, combo - 1); comboIdleFrames = 0; }
    } else {
      comboIdleFrames = 0;
    }
  }

  updateCamera();

  // Phantom hold-to-toggle: fire at threshold while finger is still down
  if (touch && phantomOrbPickedUp && state === State.IDLE && !phantomHoldFired) {
    if (performance.now() - touch.t >= PHANTOM_HOLD_MS) {
      phantomHoldFired = true;
      if (phantomMode) exitPhantomMode(); else enterPhantomMode();
    }
  }

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const slowMult = (e.slowTimer > 0) ? 0.3 : 1.0;
    if (e.slowTimer > 0) e.slowTimer--;
    e.x += e.vx * sf * slowMult;
    e.y += e.vy * sf * slowMult;
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    const accelBase = 0.04 * (1 + getMods().enemyAccelMult);
    e.vx += Math.cos(a) * accelBase;
    e.vy += Math.sin(a) * accelBase;
    const spd = Math.hypot(e.vx, e.vy);
    if (spd > e.maxSpd) { e.vx = (e.vx / spd) * e.maxSpd; e.vy = (e.vy / spd) * e.maxSpd; }
    if (e.crackShake > 0) e.crackShake--;

    // Green: healer aura — restore 1 HP to nearby enemies every 120 frames
    if ((e.colors || [e.color]).includes('green')) {
      e.healAuraTimer = (e.healAuraTimer || 0) + 1;
      if (e.healAuraTimer >= 120) {
        e.healAuraTimer = 0;
        for (const other of enemies) {
          if (!other.alive || other === e) continue;
          if (Math.hypot(other.x - e.x, other.y - e.y) < 200 && other.hp < other.maxHp) {
            other.hp++;
            addFx('heal', other.x, other.y, { maxAge: 28 });
          }
        }
        addFx('healAura', e.x, e.y, { maxAge: 35, color: COLOR_HEX['green'] });
      }
    }

    // Contact damage
    if (player.invincible <= 0) {
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      if (d < player.r + e.r) {
        const hitMods  = getMods();
        const connectedBonus = state === State.CONNECTED ? hitMods.connectedDmgMult : 0;
        const dmgTaken = 1 + Math.max(0, hitMods.incomingDmgBonus) + connectedBonus;
        const invTime  = Math.max(30, CFG.HIT_COOLDOWN + hitMods.invincibleBonus + hitMods.invincibleMalus);
        player.hp     -= dmgTaken;
        playDamageSound();
        player.invincible = invTime;
        player.hitFlash   = 22;
        player.stunTimer  = Math.round(hitMods.stunOnHit);
        untouchedStreak   = 0;
        combo = 0; comboMissCount = 0; // hit breaks combo
        addFx('dmg', player.x, player.y, { maxAge: 25 });

        // B-X3: auto-slow on hit
        if (hitMods.autoSlowOnHit > 0) {
          for (const enemy of enemies) {
            if (!enemy.alive) continue;
            if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 300) {
              enemy.slowTimer = Math.max(enemy.slowTimer || 0, 180);
            }
          }
          addFx('slowAura', player.x, player.y, { maxAge: 25, color: COLOR_HEX['blue'] });
        }

        if (player.hp <= 0) {
          player.hp = 0;
          triggerGameOver();
        }
      }
    }
  }

  // Compact dead enemies when array grows large (keeps per-frame iteration cost bounded)
  if (enemies.length > 120) {
    let w = 0;
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) enemies[w++] = enemies[i];
    }
    enemies.length = w;
  }

  // Continuous enemy trickle (suppressed during phantom mode)
  if (!phantomMode) {
    const mods0    = getMods();
    const alive    = enemies.filter(e => e.alive).length;
    const boostCount = enemyBoostStacks * 12;
    const baseMax  = CFG.ENEMY_COUNT + Math.floor(gameTime / 30) + Math.round(mods0.enemyCountBonus) + boostCount;
    const maxCount = Math.min(CFG.ENEMY_COUNT_MAX + Math.round(mods0.enemyCountBonus) + boostCount, baseMax);
    const baseInterval = Math.max(180, CFG.SPAWN_INTERVAL - Math.floor(gameTime / 20) * 40);
    const interval = Math.max(1, Math.round(baseInterval * (1 + mods0.spawnIntervalMult) / Math.pow(1.3, enemyBoostStacks)));
    spawnTimer++;
    if (spawnTimer >= interval && alive < maxCount) {
      spawnEnemy();
      spawnTimer = 0;
    }
  }


  updateKeyDrops();

  // Inscription orb pickup (only in IDLE state so player isn't mid-combat)
  if (state === State.IDLE) {
    for (let i = inscriptionOrbs.length - 1; i >= 0; i--) {
      const orb = inscriptionOrbs[i];
      orb.pulse = (orb.pulse || 0) + 1;
      if (Math.hypot(player.x - orb.x, player.y - orb.y) < 30) {
        openDraft(i);
        break;
      }
    }
  }

  // Effects
  for (let i = effects.length - 1; i >= 0; i--) {
    if (++effects[i].age >= effects[i].maxAge) effects.splice(i, 1);
  }

  if (beamFlash  > 0) beamFlash--;
  if (uiShake    > 0) uiShake--;
  if (ghostTimer > 0) ghostTimer--;
  if (screenFlash) {
    screenFlash.alpha -= 0.018;
    if (screenFlash.alpha <= 0) screenFlash = null;
  }
}

// ══════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//  着彩刻印
// ══════════════════════════════════════════════

function generatePaintInscription() {
  const pair  = PAINT_PAIRS[Math.floor(Math.random() * PAINT_PAIRS.length)];
  const blend = PAINT_BLENDS[Math.floor(Math.random() * PAINT_BLENDS.length)];
  let motion  = PAINT_MOTIONS[Math.floor(Math.random() * PAINT_MOTIONS.length)];
  let density = PAINT_DENSITIES[Math.floor(Math.random() * PAINT_DENSITIES.length)];
  // Readability clamp: center-covering patterns cannot be 濃
  if (['flat', 'radial', 'linear'].includes(pair.type) && density.char === '濃') density = PAINT_DENSITIES[1];
  // Rotate is meaningless on non-grid patterns → treat as static
  if (motion.type === 'rotate' && pair.type !== 'grid') motion = PAINT_MOTIONS[0];
  return { pair, blend, motion, density, name: `${pair.name}-${blend.char}/${motion.char}/${density.char}`, cachedLayer: null };
}

function buildPaintLayer(paint) {
  const w = W(), h = H();
  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h;
  const c = oc.getContext('2d');
  const { pair } = paint;
  if (pair.type === 'radial') {
    const cx = w / 2, cy = h / 2, r = Math.hypot(cx, cy);
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    if (pair.name === '極彩') {
      ['#ff0000','#ff8800','#ffff00','#00cc44','#0055ff'].forEach((col, i) => g.addColorStop(i / 4, col));
    } else {
      g.addColorStop(0, pair.colors[0]); g.addColorStop(1, pair.colors[1]);
    }
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  } else if (pair.type === 'vignette') {
    const cx = w / 2, cy = h / 2, r = Math.hypot(cx, cy);
    const g = c.createRadialGradient(cx, cy, Math.min(w, h) * 0.28, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, pair.colors[0]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  } else if (pair.type === 'linear') {
    const g = c.createLinearGradient(0, 0, 0, h);
    if (pair.name === '焔') {
      g.addColorStop(0, '#ffff00'); g.addColorStop(0.5, '#ff8800'); g.addColorStop(1, '#ff2200');
    } else {
      g.addColorStop(0, pair.colors[0]); g.addColorStop(1, pair.colors[1]);
    }
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  } else if (pair.type === 'flat') {
    c.fillStyle = pair.colors[0]; c.fillRect(0, 0, w, h);
  } else if (pair.type === 'scanline') {
    c.strokeStyle = pair.colors[0]; c.lineWidth = 1;
    for (let y = 1; y < h; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  } else if (pair.type === 'grid') {
    const gs = 40;
    if (pair.name === '万華') {
      for (let x = 0; x <= w; x += gs) {
        c.strokeStyle = `hsl(${Math.round(x / w * 360)},90%,60%)`; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
      }
      for (let y = 0; y <= h; y += gs) {
        c.strokeStyle = `hsl(${Math.round(y / h * 360)},90%,60%)`; c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      }
    } else {
      c.strokeStyle = pair.colors[0]; c.lineWidth = 0.8;
      for (let x = 0; x <= w; x += gs) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = 0; y <= h; y += gs) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.strokeStyle = pair.colors[1]; c.lineWidth = 0.4;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.stroke();
      c.beginPath(); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
    }
  }
  paint.cachedLayer = oc;
  paint.cachedW = w; paint.cachedH = h;
}

function applyPaintInscription(paint) {
  buildPaintLayer(paint);
  activePaints.push(paint);
  if (activePaints.length > 3) activePaints.shift();
}

function renderPaintLayers(t) {
  for (const paint of activePaints) {
    // Rebuild cache if screen size changed
    if (!paint.cachedLayer || paint.cachedW !== W() || paint.cachedH !== H()) buildPaintLayer(paint);
    const { motion, density, blend } = paint;
    ctx.save();
    ctx.globalCompositeOperation = blend.op;
    let alpha = density.alpha;
    if (motion.type === 'pulse') alpha *= 0.7 + 0.3 * Math.sin(t * 1.5);
    ctx.globalAlpha = alpha;
    if (motion.type === 'drift') ctx.translate(Math.sin(t * 0.2) * 18, Math.cos(t * 0.15) * 14);
    else if (motion.type === 'rotate') {
      const cx = W() / 2, cy = H() / 2;
      ctx.translate(cx, cy); ctx.rotate(t * 0.04); ctx.translate(-cx, -cy);
    }
    ctx.drawImage(paint.cachedLayer, 0, 0);
    ctx.restore();
  }
}

function paintDraftAllBounds(w, h) {
  const cardW = Math.min((w - 64) / 3, 170);
  const cardH = 160;
  const totalW = cardW * 3 + 24;
  const startX = (w - totalW) / 2;
  const cardY = h / 2 - cardH / 2 - 30;
  const cards = [0, 1, 2].map(i => ({ x: startX + i * (cardW + 12), y: cardY, w: cardW, h: cardH, index: i }));
  const btnY = cardY + cardH + 18;
  const btnW = Math.min(totalW / 2 - 8, 150), btnH = 40;
  const skip  = { x: w / 2 - btnW - 6, y: btnY, w: btnW, h: btnH };
  const reset = { x: w / 2 + 6,        y: btnY, w: btnW, h: btnH };
  return { cards, skip, reset };
}

function drawPaintColorBar(cx2, cy2, bw, bh, pair) {
  if (pair.type === 'flat') {
    ctx.fillStyle = pair.colors[0]; ctx.fillRect(cx2, cy2, bw, bh);
  } else if (pair.type === 'vignette') {
    const g = ctx.createLinearGradient(cx2, cy2, cx2 + bw, cy2);
    g.addColorStop(0, pair.colors[0]); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, pair.colors[0]);
    ctx.fillStyle = g; ctx.fillRect(cx2, cy2, bw, bh);
  } else if (pair.type === 'linear' || pair.type === 'radial') {
    if (pair.name === '極彩') {
      const g = ctx.createLinearGradient(cx2, cy2, cx2 + bw, cy2);
      ['#ff0000','#ff8800','#ffff00','#00cc44','#0055ff'].forEach((c, i) => g.addColorStop(i / 4, c));
      ctx.fillStyle = g; ctx.fillRect(cx2, cy2, bw, bh);
    } else if (pair.name === '焔') {
      const g = ctx.createLinearGradient(cx2, cy2, cx2 + bw, cy2);
      g.addColorStop(0, '#ff2200'); g.addColorStop(0.5, '#ff8800'); g.addColorStop(1, '#ffff00');
      ctx.fillStyle = g; ctx.fillRect(cx2, cy2, bw, bh);
    } else {
      const g = ctx.createLinearGradient(cx2, cy2, cx2 + bw, cy2);
      g.addColorStop(0, pair.colors[0]); g.addColorStop(1, pair.colors[pair.colors.length - 1]);
      ctx.fillStyle = g; ctx.fillRect(cx2, cy2, bw, bh);
    }
  } else if (pair.type === 'scanline') {
    ctx.fillStyle = '#111'; ctx.fillRect(cx2, cy2, bw, bh);
    ctx.strokeStyle = pair.colors[0]; ctx.lineWidth = 1;
    for (let y = cy2 + 2; y < cy2 + bh; y += 4) { ctx.beginPath(); ctx.moveTo(cx2, y); ctx.lineTo(cx2 + bw, y); ctx.stroke(); }
  } else if (pair.type === 'grid') {
    ctx.fillStyle = '#111'; ctx.fillRect(cx2, cy2, bw, bh);
    const gcol = pair.colors ? pair.colors[0] : '#ffffff';
    ctx.strokeStyle = gcol; ctx.lineWidth = 0.8;
    for (let x = cx2 + 10; x < cx2 + bw; x += 10) { ctx.beginPath(); ctx.moveTo(x, cy2); ctx.lineTo(x, cy2 + bh); ctx.stroke(); }
  }
}

// ══════════════════════════════════════════════
//  VISUAL FOUNDATION — クロッキー帳の世界
//  紙の上を錠前が這い、解いた錠から色がにじむ。
// ══════════════════════════════════════════════
const TAU        = Math.PI * 2;
const PAPER      = '#f3eee2';
const PAPER_DEEP = '#e6dfcd';
const INK        = '#2a251f';
const INK_MID    = 'rgba(42,37,31,0.62)';
const INK_FAINT  = 'rgba(42,37,31,0.30)';
const SHU        = '#c4402f';
const BUFF_INK   = '#2e7d4f';
const PHANTOM_BG = '#0a1820';
const F_UI  = '"Klee One", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';
const F_MIN = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif';
const fnt = (px, w = 600, fam = F_UI) => `${w} ${px}px ${fam}`;
const COLOR_NAME = { red: '赤', blue: '青', yellow: '黄', green: '緑', purple: '紫' };
const RARITY_INK = { common: '#8a8173', rare: '#3a6fc4', epic: '#8b45c9' };
const RARITY_JP  = { common: '並', rare: '稀', epic: '極' };

let RM = null; // getMods() snapshot for the current render frame

const _keySprites  = new Map();
const _lockSprites = new Map();
const _sealSprites = new Map();
function invalidateSprites() { _keySprites.clear(); _lockSprites.clear(); _sealSprites.clear(); }
if (document.fonts) {
  document.fonts.ready.then(invalidateSprites);
  if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', invalidateSprites);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
function easeOut(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function viewScale() { const z = getMods().cameraZoom; return z !== 0 ? 1 + z * 0.4 : 1; }
function visibleWorld(margin = 0) {
  const s = viewScale(), w = W(), h = H();
  const hw = w / (2 * s), hh = h / (2 * s);
  const cx = cam.x + w / 2, cy = cam.y + h / 2;
  return { x0: cx - hw - margin, y0: cy - hh - margin, x1: cx + hw + margin, y1: cy + hh + margin };
}
// world → screen including camera zoom
function w2sz(wx, wy) {
  const s = viewScale(), w = W(), h = H();
  return { x: (wx - cam.x - w / 2) * s + w / 2, y: (wy - cam.y - h / 2) * s + h / 2 };
}

// Smooth closed blob through jittered points (flat array x0,y0,x1,y1…)
function blobPath(g, pts) {
  const n = pts.length / 2;
  const mx = i => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = i => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  g.moveTo(mx(0), my(0));
  for (let i = 1; i <= n; i++) g.quadraticCurveTo(pts[(i % n) * 2], pts[(i % n) * 2 + 1], mx(i), my(i));
  g.closePath();
}

// Rounded rect stroked twice with a small offset — reads as a pencil line
function sketchRect(g, x, y, w, h, r, rnd, lw = 1.4, col = INK) {
  g.strokeStyle = col;
  g.lineWidth = lw; g.globalAlpha = 0.9;
  g.beginPath(); g.roundRect(x, y, w, h, r); g.stroke();
  g.lineWidth = lw * 0.6; g.globalAlpha = 0.35;
  g.beginPath(); g.roundRect(x + (rnd() - 0.5) * 1.6, y + (rnd() - 0.5) * 1.6, w + (rnd() - 0.5) * 1.4, h + (rnd() - 0.5) * 1.4, r); g.stroke();
  g.globalAlpha = 1;
}

// ── 紙 ─────────────────────────────────────────
let paperPat = null, paperPatDark = null;
function buildPaperPattern(dark) {
  const S = 192;
  const canScale = typeof DOMMatrix !== 'undefined' && typeof CanvasPattern !== 'undefined' && CanvasPattern.prototype.setTransform;
  const k = canScale ? 2 : 1;
  const c = makeCanvas(S * k, S * k), g = c.getContext('2d');
  g.scale(k, k);
  g.fillStyle = dark ? PHANTOM_BG : PAPER; g.fillRect(0, 0, S, S);
  const rnd = mulberry32(dark ? 11 : 5);
  const wrap = fn => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); };
  for (let i = 0; i < 10; i++) {
    const x = rnd() * S, y = rnd() * S, r = 16 + rnd() * 30;
    wrap((dx, dy) => {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, dark ? 'rgba(40,130,160,0.05)' : 'rgba(196,172,128,0.035)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    });
  }
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * S, y = rnd() * S, a = rnd();
    g.fillStyle = dark ? `rgba(140,220,255,${a * 0.06})` : `rgba(90,66,30,${a * 0.075})`;
    g.fillRect(x, y, rnd() < 0.8 ? 0.6 : 1.2, 0.6);
  }
  g.lineWidth = 0.5;
  for (let i = 0; i < 24; i++) {
    const x = 10 + rnd() * (S - 20), y = 10 + rnd() * (S - 20), a = rnd() * Math.PI, l = 4 + rnd() * 9;
    g.strokeStyle = dark ? 'rgba(140,220,255,0.07)' : 'rgba(90,66,30,0.08)';
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 3, y + Math.sin(a) * l * 0.5 + (rnd() - 0.5) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // 方眼 (sketchbook grid; blueprint lines in phantom)
  g.lineWidth = dark ? 0.7 : 0.6;
  g.strokeStyle = dark ? 'rgba(90,210,255,0.22)' : 'rgba(96,128,160,0.17)';
  for (let p = 0; p < S; p += 48) {
    g.beginPath(); g.moveTo(p + 0.5, 0); g.lineTo(p + 0.5, S); g.stroke();
    g.beginPath(); g.moveTo(0, p + 0.5); g.lineTo(S, p + 0.5); g.stroke();
  }
  const pat = ctx.createPattern(c, 'repeat');
  if (k !== 1) pat.setTransform(new DOMMatrix().scale(1 / k));
  return pat;
}
function drawPaper() {
  if (!paperPat) { paperPat = buildPaperPattern(false); paperPatDark = buildPaperPattern(true); }
  const v = visibleWorld(4);
  ctx.fillStyle = phantomMode ? paperPatDark : paperPat;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
}
let _vig = null;
function drawPageVignette() {
  const w = W(), h = H();
  if (!_vig || _vig.w !== w || _vig.h !== h) {
    const c = makeCanvas(w / 2, h / 2), g = c.getContext('2d');
    const gr = g.createRadialGradient(w / 4, h / 4, Math.min(w, h) * 0.22, w / 4, h / 4, Math.hypot(w, h) / 4);
    gr.addColorStop(0, 'rgba(120,92,52,0)');
    gr.addColorStop(1, 'rgba(120,92,52,0.16)');
    g.fillStyle = gr; g.fillRect(0, 0, w / 2, h / 2);
    _vig = { c, w, h };
  }
  ctx.drawImage(_vig.c, 0, 0, w, h);
}

// ── 水彩のしみ (解いた錠の色が頁に残る) ───────────
// World is split into chunks drawn at half resolution; least-recently-used
// chunks are dropped so memory stays bounded however far the player roams.
const STAIN_CH = 512, STAIN_RES = 0.5, STAIN_MAX = 56;
const stainChunks = new Map();
let stainBudget = 10, stainTick = 0;
const STAIN_COLORS = new Set(Object.values(COLOR_HEX));
const stainBounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
function getStainChunk(cx, cy, create) {
  const k = cx + ',' + cy;
  let ch = stainChunks.get(k);
  if (!ch && create) {
    if (stainChunks.size >= STAIN_MAX) {
      let oldK = null, oldT = Infinity;
      for (const [kk, c] of stainChunks) if (c.used < oldT) { oldT = c.used; oldK = kk; }
      stainChunks.delete(oldK);
    }
    const c = makeCanvas(STAIN_CH * STAIN_RES, STAIN_CH * STAIN_RES);
    ch = { c, g: c.getContext('2d'), cx, cy, used: stainTick, n: 0 };
    stainChunks.set(k, ch);
  }
  if (ch) ch.used = stainTick;
  return ch;
}
function addStain(x, y, hex, size = 1) {
  if (stainBudget <= 0 || phantomMode) return;
  stainBudget--;
  const r = (24 + Math.random() * 18) * size;
  stainBounds.x0 = Math.min(stainBounds.x0, x); stainBounds.x1 = Math.max(stainBounds.x1, x);
  stainBounds.y0 = Math.min(stainBounds.y0, y); stainBounds.y1 = Math.max(stainBounds.y1, y);
  const n = 16, pts = [], ph = Math.random() * TAU;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    const rr = r * (0.8 + 0.18 * Math.sin(a * 3 + ph) + Math.random() * 0.14);
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  const drops = [];
  const nd = 3 + (Math.random() * 4 | 0);
  for (let i = 0; i < nd; i++) {
    const a = Math.random() * TAU, d = r * (1.15 + Math.random() * 0.8);
    drops.push(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.4 + Math.random() * 3.2);
  }
  const reach = r * 2.1;
  const cx0 = Math.floor((x - reach) / STAIN_CH), cx1 = Math.floor((x + reach) / STAIN_CH);
  const cy0 = Math.floor((y - reach) / STAIN_CH), cy1 = Math.floor((y + reach) / STAIN_CH);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const ch = getStainChunk(cx, cy, true), g = ch.g;
    // Old pigment slowly lifts so heavily played areas never turn to mud
    if (++ch.n % 40 === 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.16;
      g.fillRect(0, 0, ch.c.width, ch.c.height);
      g.globalCompositeOperation = 'source-over';
    }
    g.setTransform(STAIN_RES, 0, 0, STAIN_RES, -cx * STAIN_CH * STAIN_RES, -cy * STAIN_CH * STAIN_RES);
    g.beginPath(); blobPath(g, pts);
    g.globalAlpha = 0.20; g.fillStyle = hex; g.fill();
    g.globalAlpha = 0.34; g.lineWidth = 2.4; g.strokeStyle = hex; g.stroke();
    g.globalAlpha = 0.30; g.beginPath();
    for (let i = 0; i < drops.length; i += 3) { g.moveTo(drops[i] + drops[i + 2], drops[i + 1]); g.arc(drops[i], drops[i + 1], drops[i + 2], 0, TAU); }
    g.fill();
    g.globalAlpha = 1;
  }
}
function renderStains() {
  if (phantomMode || stainChunks.size === 0) return;
  stainTick++;
  const v = visibleWorld(0);
  const cx0 = Math.floor(v.x0 / STAIN_CH), cx1 = Math.floor(v.x1 / STAIN_CH);
  const cy0 = Math.floor(v.y0 / STAIN_CH), cy1 = Math.floor(v.y1 / STAIN_CH);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const ch = stainChunks.get(cx + ',' + cy);
    if (!ch) continue;
    ch.used = stainTick;
    ctx.drawImage(ch.c, cx * STAIN_CH, cy * STAIN_CH, STAIN_CH, STAIN_CH);
  }
  ctx.restore();
}

// ── 鍵 (sprite) ───────────────────────────────
function drawKeyShape(g, size, colors, dim) {
  const bowR = size * 0.42, bx = -size * 0.52, bw = size * 0.15;
  let fill;
  if (dim) fill = 'rgba(160,150,135,0.35)';
  else if (colors.length > 1) {
    fill = g.createLinearGradient(-size, 0, size, 0);
    colors.forEach((c, i) => fill.addColorStop(i / (colors.length - 1), COLOR_HEX[c]));
  } else fill = COLOR_HEX[colors[0]];
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(bx + bowR * 0.8, -bw); g.lineTo(size, -bw); g.lineTo(size, bw);
  g.lineTo(size * 0.84, bw); g.lineTo(size * 0.84, bw + size * 0.26);
  g.lineTo(size * 0.66, bw + size * 0.26); g.lineTo(size * 0.66, bw);
  g.lineTo(size * 0.50, bw); g.lineTo(size * 0.50, bw + size * 0.17);
  g.lineTo(size * 0.36, bw + size * 0.17); g.lineTo(size * 0.36, bw);
  g.lineTo(bx + bowR * 0.8, bw); g.closePath();
  g.moveTo(bx + bowR, 0); g.arc(bx, 0, bowR, 0, TAU);
  g.fillStyle = fill; g.fill();
  g.strokeStyle = dim ? 'rgba(90,80,70,0.55)' : INK;
  g.lineWidth = Math.max(1, size * 0.1); g.stroke();
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(bx, 0, bowR * 0.42, 0, TAU); g.fill();
  g.restore();
  g.beginPath(); g.arc(bx, 0, bowR * 0.42, 0, TAU); g.stroke();
  if (!dim) {
    g.globalAlpha = 0.55; g.strokeStyle = '#fff'; g.lineWidth = Math.max(0.6, size * 0.06);
    g.beginPath(); g.moveTo(bx + bowR * 0.9, -bw * 0.35); g.lineTo(size * 0.92, -bw * 0.35); g.stroke();
    g.globalAlpha = 1;
  }
}
function keySprite(colors, size, dim) {
  const k = colors.join('+') + '|' + size + '|' + (dim ? 1 : 0);
  let s = _keySprites.get(k);
  if (s) return s;
  const S = 3, box = size * 2.6;
  const c = makeCanvas(box * S, box * S), g = c.getContext('2d');
  g.scale(S, S); g.translate(box / 2, box / 2); g.rotate(-Math.PI / 4);
  drawKeyShape(g, size, colors, dim);
  s = { c, box };
  _keySprites.set(k, s);
  return s;
}
function drawKeyIcon(x, y, colors, size, dim, rot = 0) {
  const s = keySprite(colors, size, dim);
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(s.c, -s.box / 2, -s.box / 2, s.box, s.box); ctx.restore(); }
  else ctx.drawImage(s.c, x - s.box / 2, y - s.box / 2, s.box, s.box);
}

// ── 錠前 (enemy body sprite; shackle is drawn live so it can open) ──
function lockGeom(r) {
  const bw = r * 1.72, bh = r * 1.30, by = r * 0.26;
  return { bw, bh, by, x0: -bw / 2, y0: by - bh / 2, rad: r * 0.32 };
}
function lockSprite(colors, r, hidden, boil) {
  const k = (hidden ? 'h' : colors.join('+')) + '|' + r + '|' + boil;
  let s = _lockSprites.get(k);
  if (s) return s;
  const S = 3, box = r * 2.4;
  const c = makeCanvas(box * S, box * S), g = c.getContext('2d');
  g.scale(S, S); g.translate(box / 2, box / 2);
  const L = lockGeom(r);
  const rnd = mulberry32(17 + boil * 101 + colors.length * 7);
  g.save();
  g.beginPath(); g.roundRect(L.x0, L.y0, L.bw, L.bh, L.rad); g.clip();
  const cols = hidden ? ['#8a857c'] : colors.map(c2 => COLOR_HEX[c2]);
  if (cols.length > 1) {
    const sw = L.bw / cols.length;
    cols.forEach((cc, i) => { g.fillStyle = hexA(cc, 0.78); g.fillRect(L.x0 + i * sw - 0.5, L.y0, sw + 1, L.bh); });
  } else { g.fillStyle = hexA(cols[0], 0.78); g.fillRect(L.x0, L.y0, L.bw, L.bh); }
  // paper bloom highlight (top-left) + pigment pooling (bottom)
  const hl = g.createRadialGradient(L.x0 + L.bw * 0.3, L.y0 + L.bh * 0.25, 0, L.x0 + L.bw * 0.3, L.y0 + L.bh * 0.25, L.bw * 0.7);
  hl.addColorStop(0, 'rgba(255,252,240,0.55)'); hl.addColorStop(1, 'rgba(255,252,240,0)');
  g.fillStyle = hl; g.fillRect(L.x0, L.y0, L.bw, L.bh);
  g.fillStyle = 'rgba(42,37,31,0.16)';
  g.fillRect(L.x0, L.y0 + L.bh * 0.78, L.bw, L.bh * 0.22);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.18})`;
    g.fillRect(L.x0 + rnd() * L.bw, L.y0 + rnd() * L.bh, 0.8, 0.8);
  }
  g.restore();
  sketchRect(g, L.x0, L.y0, L.bw, L.bh, L.rad, rnd, Math.max(1.2, r * 0.095));
  // keyhole
  const kx = 0, ky = L.by - L.bh * 0.06, kr = r * 0.17;
  g.fillStyle = INK;
  g.beginPath(); g.arc(kx, ky, kr, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(kx - kr * 0.55, ky + kr * 0.4); g.lineTo(kx + kr * 0.55, ky + kr * 0.4);
  g.lineTo(kx + kr * 0.9, ky + kr * 2.5); g.lineTo(kx - kr * 0.9, ky + kr * 2.5); g.closePath(); g.fill();
  // rivets
  g.fillStyle = 'rgba(42,37,31,0.55)';
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * L.bw * 0.34, L.y0 + L.bh * 0.2, r * 0.06, 0, TAU); g.fill(); }
  s = { c, box };
  _lockSprites.set(k, s);
  return s;
}

// ── 落款 (inscription seal sprite) ───────────────
const SEAL_STYLE = {
  normal:      { ch: '刻', round: false },
  fusion:      { ch: '融', round: true,  col: '#c98f16' },
  enemy_boost: { ch: '増', round: false, col: SHU },
  infection:   { ch: '感', round: false, col: '#7a2fb0' },
  phantom:     { ch: '幻', round: true,  col: '#1f9c8a' },
  paint:       { ch: '彩', round: true,  col: null },
};
function sealSprite(type, rarity, size = 30, chOverride = null) {
  const k = type + '|' + (rarity || '') + '|' + size + '|' + (chOverride || '');
  let s = _sealSprites.get(k);
  if (s) return s;
  const st = SEAL_STYLE[type] || SEAL_STYLE.normal;
  const S = 3, box = size * 1.3;
  const c = makeCanvas(box * S, box * S), g = c.getContext('2d');
  g.scale(S, S); g.translate(box / 2, box / 2);
  const col = type === 'normal' ? RARITY_INK[rarity || 'common'] : (st.col || '#c4402f');
  const h = size / 2;
  g.beginPath();
  if (st.round) g.arc(0, 0, h, 0, TAU); else g.roundRect(-h, -h, size, size, size * 0.14);
  if (type === 'paint') {
    let gr;
    if (g.createConicGradient) {
      gr = g.createConicGradient(0, 0, 0);
      ['#e8453c', '#ddb830', '#3db86a', '#3c7de8', '#9844e8', '#e8453c'].forEach((cc, i) => gr.addColorStop(i / 5, cc));
    } else {
      gr = g.createLinearGradient(-h, -h, h, h);
      ['#e8453c', '#ddb830', '#3db86a', '#3c7de8', '#9844e8'].forEach((cc, i) => gr.addColorStop(i / 4, cc));
    }
    g.fillStyle = gr;
  } else g.fillStyle = col;
  g.fill();
  // stamp texture: uneven ink
  const rnd = mulberry32(size * 13 + type.length * 31 + (rarity ? rarity.length : 0));
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) {
    g.globalAlpha = 0.25 + rnd() * 0.5;
    g.beginPath(); g.arc((rnd() - 0.5) * size, (rnd() - 0.5) * size, rnd() * size * 0.05 + 0.3, 0, TAU); g.fill();
  }
  // 白文: character carved out so the paper shows through
  g.globalAlpha = 1;
  g.font = fnt(size * 0.66, 800, F_MIN);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(chOverride || st.ch, 0, size * 0.03);
  g.restore();
  g.lineWidth = Math.max(0.8, size * 0.04);
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  if (st.round) g.arc(0, 0, h - size * 0.1, 0, TAU); else g.roundRect(-h + size * 0.1, -h + size * 0.1, size * 0.8, size * 0.8, size * 0.08);
  g.stroke();
  s = { c, box, col };
  _sealSprites.set(k, s);
  return s;
}
function drawSeal(x, y, type, rarity, size, rot = -0.08, alpha = 1, chOverride = null) {
  const s = sealSprite(type, rarity, size, chOverride);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.drawImage(s.c, -s.box / 2, -s.box / 2, s.box, s.box);
  ctx.restore();
  return s.col;
}
function orbColor(orb, t) {
  if (orb.type === 'paint') return `hsl(${Math.round((t * 40) % 360)},80%,55%)`;
  if (orb.type === 'normal') return RARITY_INK[orb.rarity];
  return SEAL_STYLE[orb.type] ? SEAL_STYLE[orb.type].col : SHU;
}

// ══════════════════════════════════════════════
//  WORLD RENDERING
// ══════════════════════════════════════════════
function renderEffectsWorld(t) {
  for (const e of effects) {
    const p = e.age / e.maxAge, q = 1 - p, sd = e.seed || 0;
    ctx.save();
    if (e.type === 'explosion') {
      const ease = easeOut(p);
      ctx.globalAlpha = q * 0.22; ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, 12 + ease * 44, 0, TAU); ctx.fill();
      ctx.globalAlpha = q * 0.55; ctx.strokeStyle = e.color; ctx.lineWidth = 2.2 * q + 0.4;
      ctx.beginPath(); ctx.arc(e.x, e.y, ease * 72, 0, TAU); ctx.stroke();
      ctx.globalAlpha = q * 0.85; ctx.fillStyle = e.color;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = sd + i * 0.698, d = 16 + ease * (34 + (i % 3) * 16), rr = (3 - (i % 3) * 0.7) * (1 - p * 0.6);
        const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
        ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, TAU);
      }
      ctx.fill();
      // broken shackle flying off
      if (p < 0.6) {
        ctx.globalAlpha = (0.6 - p) / 0.6 * 0.8; ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        const sx = e.x + Math.cos(sd) * ease * 30, sy = e.y - 10 - ease * 26;
        ctx.beginPath(); ctx.arc(sx, sy, 6, Math.PI + sd * 0.3, sd * 0.3); ctx.stroke();
      }
    } else if (e.type === 'hit') {
      const sz = e.crit ? 34 : 20;
      ctx.globalAlpha = q * (e.crit ? 0.9 : 0.7);
      ctx.strokeStyle = e.color; ctx.lineWidth = e.crit ? 2.6 : 1.4;
      ctx.beginPath(); ctx.arc(e.x, e.y, easeOut(p) * sz, 0, TAU); ctx.stroke();
      ctx.fillStyle = e.color; ctx.beginPath();
      const nd = e.crit ? 7 : 4;
      for (let i = 0; i < nd; i++) {
        const a = sd + i * TAU / nd, d = 8 + easeOut(p) * sz * 0.9, rr = e.crit ? 2.4 : 1.6;
        ctx.moveTo(e.x + Math.cos(a) * d + rr, e.y + Math.sin(a) * d); ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, rr, 0, TAU);
      }
      ctx.fill();
      if (e.crit) {
        ctx.globalAlpha = q;
        ctx.font = fnt(15, 800, F_MIN); ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = PAPER; ctx.strokeText('会心', e.x, e.y - 20 - p * 26);
        ctx.fillStyle = SHU; ctx.fillText('会心', e.x, e.y - 20 - p * 26);
      }
    } else if (e.type === 'escape') {
      ctx.globalAlpha = q * 0.45; ctx.strokeStyle = INK_MID; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(e.x, e.y, easeOut(p) * CFG.OUTER_R, 0, TAU); ctx.stroke();
    } else if (e.type === 'miss') {
      ctx.globalAlpha = q * 0.6; ctx.strokeStyle = INK_MID; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      const d = 6 + p * 14;
      ctx.beginPath(); ctx.moveTo(e.x - d, e.y - d * 0.8); ctx.lineTo(e.x + d, e.y + d * 0.8);
      ctx.moveTo(e.x + d * 0.9, e.y - d); ctx.lineTo(e.x - d * 0.9, e.y + d); ctx.stroke();
    } else if (e.type === 'dmg') {
      ctx.globalAlpha = q * 0.75; ctx.strokeStyle = SHU; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 24, 0, TAU); ctx.stroke();
    } else if (e.type === 'slowAura' || e.type === 'healAura' || e.type === 'bomb') {
      const R = e.type === 'slowAura' ? 220 : e.type === 'healAura' ? 200 : 160;
      const ease = easeOut(p);
      ctx.globalAlpha = q * (e.type === 'healAura' ? 0.3 : 0.5); ctx.strokeStyle = e.color; ctx.lineWidth = 2;
      if (e.type === 'slowAura') ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.arc(e.x, e.y, ease * R, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = q * (e.type === 'healAura' ? 0.06 : 0.12); ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, ease * R, 0, TAU); ctx.fill();
    } else if (e.type === 'chain') {
      ctx.globalAlpha = q * 0.9; ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      const dx = e.x - e.fromX, dy = e.y - e.fromY, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      ctx.beginPath(); ctx.moveTo(e.fromX, e.fromY);
      for (let i = 1; i < 6; i++) {
        const u = i / 6, j = Math.sin(sd * 7 + i * 2.1) * 9;
        ctx.lineTo(e.fromX + dx * u + nx * j, e.fromY + dy * u + ny * j);
      }
      ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.globalAlpha = q * 0.6; ctx.beginPath(); ctx.arc(e.x, e.y, p * 20, 0, TAU); ctx.stroke();
    } else if (e.type === 'heal') {
      const col = COLOR_HEX.green;
      ctx.globalAlpha = q * 0.85; ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      const y = e.y - 8 - p * 18;
      ctx.beginPath(); ctx.moveTo(e.x - 5, y); ctx.lineTo(e.x + 5, y); ctx.moveTo(e.x, y - 5); ctx.lineTo(e.x, y + 5); ctx.stroke();
      ctx.globalAlpha = q * 0.3; ctx.beginPath(); ctx.arc(e.x, e.y, p * 26, 0, TAU); ctx.stroke();
    } else if (e.type === 'keyCollect') {
      ctx.globalAlpha = q * 0.8; ctx.strokeStyle = e.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, easeOut(p) * 26, 0, TAU); ctx.stroke();
      ctx.fillStyle = e.color;
      for (let i = 0; i < 4; i++) {
        const a = sd + i * TAU / 4, d = 6 + p * 18;
        ctx.save(); ctx.translate(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-1.6, -1.6, 3.2, 3.2); ctx.restore();
      }
    }
    ctx.restore();
  }
}

function renderKeyDrops(t) {
  const v = visibleWorld(30);
  for (const k of keyDrops) {
    if (k.x < v.x0 || k.x > v.x1 || k.y < v.y0 || k.y > v.y1) continue;
    const bob = Math.sin(k.age * KEY_BOB_SPEED / 60 * TAU) * KEY_BOB_AMP;
    const fresh = Math.min(1, k.age / 12);
    ctx.globalAlpha = 0.13 * fresh; ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(k.x, k.y + 10, 8 - bob * 0.4, 2.4, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = fresh;
    drawKeyIcon(k.x, k.y + bob - 2 - (1 - fresh) * 10, [k.color], 9, false, Math.sin(t * 2 + k.age * 0.05) * 0.15);
  }
  ctx.globalAlpha = 1;
}

function renderBeam(t) {
  const px = player.x, py = player.y, ex = connectedEnemy.x, ey = connectedEnemy.y;
  const flash = beamFlash > 0;
  const N = 24, pts = [];
  const dx = ex - px, dy = ey - py, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const sag = Math.min(18, len * 0.06);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const wob = Math.sin(u * Math.PI * 4 + t * 9) * 3.5 * Math.sin(u * Math.PI) + Math.sin(u * Math.PI) * sag * (flash ? 0.2 : 1);
    pts.push({ x: px + dx * u + nx * wob, y: py + dy * u + ny * wob });
  }
  const beamCol = COLOR_HEX[connectedEnemy.color] || CFG.KEY_COLOR;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.globalAlpha = 0.16; ctx.strokeStyle = beamCol; ctx.lineWidth = 10; drawPath(pts);
  ctx.globalAlpha = 0.9; ctx.strokeStyle = flash ? INK : beamCol; ctx.lineWidth = flash ? 3.6 : 1.8; drawPath(pts);
  ctx.globalAlpha = 0.5; ctx.strokeStyle = INK; ctx.lineWidth = 0.7; drawPath(pts);
  // knot where the thread meets the lock
  ctx.globalAlpha = 0.9; ctx.fillStyle = beamCol;
  ctx.beginPath(); ctx.arc(pts[N - 2].x, pts[N - 2].y, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawPath(pts) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function renderEnemy(e, t) {
  const focused = connectedEnemy === e;
  const dist = Math.hypot(e.x - player.x, e.y - player.y);
  const colorVisible = RM.enemyColorFarHide === 0 || dist < 180;
  const cols = e.colors || [e.color];
  const ecol = colorVisible ? (COLOR_HEX[e.color] || INK) : '#8a857c';
  if (e._seed === undefined) e._seed = Math.random() * 3;
  const r = e.r;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.crackShake > 0) ctx.translate((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 1.5);

  // Auras only matter near the player — drawing them everywhere buried the page in rings
  if (cols.includes('green') && dist < 520) {
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * 2.5 + (e.healAuraTimer || 0) * 0.1);
    ctx.strokeStyle = colorVisible ? COLOR_HEX.green : '#888'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 7]);
    ctx.beginPath(); ctx.arc(0, 0, 200, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (cols.includes('purple') && dist < 340) {
    const near = clamp01(1 - (dist - 150) / 190);
    ctx.globalAlpha = 0.10 + 0.4 * near * (0.75 + 0.25 * Math.sin(t * 6));
    ctx.strokeStyle = colorVisible ? COLOR_HEX.purple : '#888'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    if (dist < 150) {
      ctx.globalAlpha = 0.05; ctx.fillStyle = COLOR_HEX.purple;
      ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.fill();
    }
  }
  if (e.slowTimer > 0) {
    ctx.globalAlpha = Math.min(1, e.slowTimer / 180) * 0.6;
    ctx.strokeStyle = COLOR_HEX.blue; ctx.lineWidth = 1.6; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.arc(0, 0, r + 11, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (state === State.IDLE && dist < 210) {
    ctx.globalAlpha = 0.12 + 0.08 * Math.sin(t * 3.5);
    ctx.strokeStyle = ecol; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r + 15, 0, TAU); ctx.stroke();
  }

  // shadow on the paper
  ctx.globalAlpha = 0.11; ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(1.5, r * 1.02, r * 0.95, r * 0.26, 0, 0, TAU); ctx.fill();

  // shackle — lifts open as the lock weakens
  const L = lockGeom(r);
  const open = 1 - Math.max(0, e.hp) / e.maxHp;
  const lift = open * r * 0.42;
  const sr = r * 0.44, baseY = L.y0 + 1, topY = L.y0 - r * 0.36 - lift;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-sr, baseY); ctx.lineTo(-sr, topY);
  ctx.arc(0, topY, sr, Math.PI, 0);
  ctx.lineTo(sr, Math.min(baseY, topY + r * 0.26 + (1 - open) * (baseY - topY)));
  ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = r * 0.26; ctx.stroke();
  ctx.strokeStyle = focused ? '#efe7d6' : '#c9bfae'; ctx.lineWidth = r * 0.1; ctx.stroke();

  // body
  const boil = Math.floor(t * 5 + e._seed) % 3;
  const spr = lockSprite(cols, r, !colorVisible, boil);
  ctx.drawImage(spr.c, -spr.box / 2, -spr.box / 2, spr.box, spr.box);

  if (focused) {
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 8);
    ctx.strokeStyle = ecol; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(L.x0 - 4, L.y0 - 4, L.bw + 8, L.bh + 8, L.rad + 3); ctx.stroke();
  }

  // cracks
  const lost = e.maxHp - e.hp;
  if (lost > 0) {
    const nCr = Math.min(3, Math.ceil(lost / Math.max(1, e.maxHp / 4)));
    ctx.globalAlpha = 0.7; ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 0; i < nCr; i++) {
      const sx = L.x0 + L.bw * (0.2 + 0.3 * i), sy = L.y0 + 2;
      ctx.moveTo(sx, sy); ctx.lineTo(sx + 3, sy + L.bh * 0.25); ctx.lineTo(sx - 1, sy + L.bh * 0.42); ctx.lineTo(sx + 2.5, sy + L.bh * 0.6);
    }
    ctx.stroke();
  }

  // HP pips (batched per colour)
  const pr = r + 10, maxHp = e.maxHp;
  ctx.globalAlpha = 1;
  if (cols.length === 1 || !colorVisible) {
    ctx.fillStyle = colorVisible ? COLOR_HEX[cols[0]] : '#6d6860';
    ctx.beginPath();
    for (let i = 0; i < Math.min(e.hp, maxHp); i++) {
      const a = -(i / maxHp) * TAU - Math.PI * 0.5, x = Math.cos(a) * pr, y = Math.sin(a) * pr;
      ctx.moveTo(x + 2.4, y); ctx.arc(x, y, 2.4, 0, TAU);
    }
    ctx.fill();
  } else {
    for (let ci = 0; ci < cols.length; ci++) {
      ctx.fillStyle = COLOR_HEX[cols[ci]];
      ctx.beginPath();
      for (let i = ci; i < Math.min(e.hp, maxHp); i += cols.length) {
        const a = -(i / maxHp) * TAU - Math.PI * 0.5, x = Math.cos(a) * pr, y = Math.sin(a) * pr;
        ctx.moveTo(x + 2.4, y); ctx.arc(x, y, 2.4, 0, TAU);
      }
      ctx.fill();
    }
  }
  if (lost > 0) {
    ctx.strokeStyle = 'rgba(42,37,31,0.35)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = Math.max(0, e.hp); i < maxHp; i++) {
      const a = -(i / maxHp) * TAU - Math.PI * 0.5, x = Math.cos(a) * pr, y = Math.sin(a) * pr;
      ctx.moveTo(x + 1.8, y); ctx.arc(x, y, 1.8, 0, TAU);
    }
    ctx.stroke();
  }
  ctx.restore();
}

const inkTrail = [];
function renderPlayer(t) {
  const spd = Math.hypot(player.vx, player.vy);
  if (spd > 2.2 && frame % 2 === 0 && state === State.IDLE) {
    inkTrail.push({ x: player.x - player.vx * 1.6 + (Math.random() - 0.5) * 5, y: player.y - player.vy * 1.6 + (Math.random() - 0.5) * 5, r: 1.2 + Math.random() * 2.6 * Math.min(1, spd / 8), a: 0.9 });
    if (inkTrail.length > 40) inkTrail.shift();
  }
  ctx.save();
  ctx.fillStyle = phantomMode ? '#aaf5e6' : INK;
  for (let i = inkTrail.length - 1; i >= 0; i--) {
    const d = inkTrail[i];
    d.a -= 0.018;
    if (d.a <= 0) { inkTrail.splice(i, 1); continue; }
    ctx.globalAlpha = d.a * 0.45;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
  }
  ctx.restore();

  const r = player.r;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invincible > 0 && Math.floor(player.invincible / 3) % 2 === 1) ctx.globalAlpha = 0.35;
  const baseAlpha = ctx.globalAlpha;

  if (player.hitFlash > 0) {
    ctx.globalAlpha = baseAlpha * (player.hitFlash / 22) * 0.45; ctx.fillStyle = SHU;
    ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, TAU); ctx.fill();
    ctx.globalAlpha = baseAlpha;
  }
  ctx.globalAlpha = baseAlpha * 0.14; ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(1, r * 0.95, r * 0.9, r * 0.26, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = baseAlpha;

  // 墨の子: a wobbling ink drop that squashes along its velocity
  const ang = Math.atan2(player.vy, player.vx);
  const st = Math.min(spd / CFG.MAX_SPEED, 1) * 0.22;
  ctx.save();
  ctx.rotate(ang); ctx.scale(1 + st, 1 - st * 0.55); ctx.rotate(-ang);
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU;
    const rr = r * (1 + 0.05 * Math.sin(a * 3 + t * 5) + 0.03 * Math.sin(a * 5 - t * 3.3));
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.beginPath(); blobPath(ctx, pts);
  ctx.fillStyle = phantomMode ? '#e8fbf6' : INK; ctx.fill();
  ctx.globalAlpha = baseAlpha * 0.22; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.2, r * 0.62, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  ctx.globalAlpha = baseAlpha;
  ctx.restore();

  // eyes look toward the thread or the direction of travel
  let lookA = null;
  if (connectedEnemy) lookA = Math.atan2(connectedEnemy.y - player.y, connectedEnemy.x - player.x);
  else if (spd > 0.6) lookA = ang;
  const lx = lookA === null ? 0 : Math.cos(lookA) * 1.6, ly = lookA === null ? 0 : Math.sin(lookA) * 1.4;
  const blink = (t % 3.7) < 0.12;
  const eyeCol = phantomMode ? PHANTOM_BG : '#fbf7ec';
  for (const sx of [-1, 1]) {
    const ex = sx * r * 0.36 + lx, ey = -r * 0.1 + ly;
    if (blink) {
      ctx.strokeStyle = eyeCol; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - r * 0.17, ey); ctx.lineTo(ex + r * 0.17, ey); ctx.stroke();
    } else {
      ctx.fillStyle = eyeCol;
      ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.18, r * 0.24, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = phantomMode ? '#e8fbf6' : INK;
      ctx.beginPath(); ctx.arc(ex + lx * 0.5, ey + ly * 0.5, r * 0.08, 0, TAU); ctx.fill();
    }
  }

  // key charm dangling from the drop (active key)
  const slot = activeSlot();
  const swing = Math.sin(t * 3) * 0.25 - Math.max(-0.5, Math.min(0.5, player.vx * 0.05));
  ctx.save();
  ctx.translate(r * 0.78, -r * 0.55);
  ctx.rotate(swing);
  ctx.strokeStyle = phantomMode ? '#aaf5e6' : INK; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3, 5); ctx.stroke();
  drawKeyIcon(6.5, 9, slot.colors, 6.5, slot.dur <= 0, 0.6);
  ctx.restore();
  ctx.restore();
}

function renderInscriptionOrbs(t) {
  const v = visibleWorld(50);
  for (const orb of inscriptionOrbs) {
    if (orb.x < v.x0 || orb.x > v.x1 || orb.y < v.y0 || orb.y > v.y1) continue;
    const pulse = Math.sin(t * 3.2 + (orb.pulse || 0) * 0.05) * 0.5 + 0.5;
    const bob = Math.sin(t * 2.1 + orb.x * 0.01) * 3;
    const col = orbColor(orb, t);
    ctx.save();
    ctx.translate(orb.x, orb.y);
    ctx.globalAlpha = 0.12; ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, 18, 13 - bob * 0.5, 3.4, 0, 0, TAU); ctx.fill();
    // halo
    ctx.globalAlpha = 0.16 + pulse * 0.16;
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, bob, 22 + pulse * 5, 0, TAU); ctx.stroke();
    if (orb.type === 'fusion') {
      for (let i = 0; i < 5; i++) {
        ctx.globalAlpha = 0.55 + pulse * 0.35; ctx.strokeStyle = COLOR_HEX[COLORS[i]]; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, bob, 26 + pulse * 4, i * TAU / 5 + t * 1.1, (i + 0.7) * TAU / 5 + t * 1.1); ctx.stroke();
      }
    } else if (orb.type === 'enemy_boost' || orb.type === 'infection' || orb.type === 'phantom' || orb.type === 'paint') {
      ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 40;
      ctx.globalAlpha = 0.5 + pulse * 0.3; ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, bob, 27 + pulse * 3, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (orb.type === 'normal' && orb.rarity === RARITY.EPIC) {
      ctx.fillStyle = col; ctx.globalAlpha = 0.7;
      for (let i = 0; i < 3; i++) {
        const a = t * 1.5 + i * TAU / 3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 24, bob + Math.sin(a) * 24, 1.8, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    drawSeal(0, bob, orb.type, orb.rarity, orb.type === 'normal' ? 24 : 27, -0.08 + Math.sin(t * 1.3 + orb.x) * 0.05);
    ctx.restore();
  }
}


// ══════════════════════════════════════════════
//  FRAME
// ══════════════════════════════════════════════
function render() {
  const w = W(), h = H();
  const t = performance.now() / 1000;
  RM = getMods();
  stainBudget = 10;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = phantomMode ? PHANTOM_BG : PAPER;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  const scale = viewScale();
  if (scale !== 1) { ctx.translate(w / 2, h / 2); ctx.scale(scale, scale); ctx.translate(-w / 2, -h / 2); }
  ctx.translate(-cam.x, -cam.y);
  drawPaper();
  renderStains();
  renderEffectsWorld(t);
  renderKeyDrops(t);
  renderInscriptionOrbs(t);
  if (state === State.CONNECTED && connectedEnemy) renderBeam(t);
  const v = visibleWorld(210);
  for (const e of enemies) {
    if (!e.alive || e.x < v.x0 || e.x > v.x1 || e.y < v.y0 || e.y > v.y1) continue;
    renderEnemy(e, t);
  }
  renderPlayer(t);
  ctx.restore();

  if (!phantomMode) drawPageVignette();
  if (activePaints.length > 0 && !phantomMode) renderPaintLayers(t);
  if (phantomMode) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = `hsl(${Math.round((t * 25) % 360)}, 80%, 55%)`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (screenFlash) {
    ctx.fillStyle = `rgba(${screenFlash.r},${screenFlash.g},${screenFlash.b},${screenFlash.alpha})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (state === State.TITLE) { renderTitle(w, h, t); return; }
  renderSwipeTrail();
  renderEdgeIndicators();
  renderInscriptionEdgeIndicators(t);
  if (state === State.CONNECTED) renderCircularUI(t);
  renderHoldRing();
  renderFieldNotes(t);
  renderKeyPanel(t);
  renderHUD(w, h, t);
  renderHint(t);
  if (orbAnnounce) renderOrbAnnounce(w, h, t);
  if (state === State.GAMEOVER)      renderGameOver(w, h, t);
  if (state === State.DRAFT)         renderDraft(w, h, t);
  if (state === State.PAUSED)        renderPause(w, h, t);
  if (state === State.FUSION_SELECT) renderFusionSelect(w, h, t);
  if (state === State.PAINT_DRAFT)   renderPaintDraft(w, h, t);
}

// ── shared UI pieces ───────────────────────────
function paperCard(x, y, w, h, r = 12, opts = {}) {
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.fillStyle = 'rgba(20,14,8,0.22)';
  ctx.beginPath(); ctx.roundRect(x + 2, y + 4, w, h, r); ctx.fill();
  ctx.fillStyle = opts.fill || PAPER;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  if (opts.band) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
    ctx.fillStyle = opts.band; ctx.fillRect(x, y, w, opts.bandH || 5);
    ctx.restore();
  }
  ctx.strokeStyle = opts.stroke || INK; ctx.lineWidth = opts.lw || 1.3;
  ctx.globalAlpha = (opts.alpha ?? 1) * 0.85;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
  ctx.globalAlpha = (opts.alpha ?? 1) * 0.3; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.roundRect(x + 1.2, y - 0.8, w - 1.6, h + 1.2, r); ctx.stroke();
  ctx.restore();
}
function inkButton(b, label, opts = {}) {
  paperCard(b.x, b.y, b.w, b.h, 10, { fill: opts.fill || PAPER, stroke: opts.stroke || INK, band: opts.band, bandH: 4 });
  ctx.fillStyle = opts.color || INK;
  ctx.font = fnt(opts.size || 14, 600);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}
function darkWash(alpha = 0.62) {
  ctx.fillStyle = phantomMode ? `rgba(2,10,14,${alpha})` : `rgba(30,23,15,${alpha})`;
  ctx.fillRect(0, 0, W(), H());
}
function brushLine(x0, y, x1, col, lw = 3, alpha = 0.8) {
  ctx.save();
  ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x0, y + 1); ctx.quadraticCurveTo((x0 + x1) / 2, y - 2, x1, y); ctx.stroke();
  ctx.lineWidth = lw * 0.4; ctx.globalAlpha = alpha * 0.5;
  ctx.beginPath(); ctx.moveTo(x0 + 6, y + 3); ctx.quadraticCurveTo((x0 + x1) / 2, y + 1, x1 - 4, y + 2.5); ctx.stroke();
  ctx.restore();
}
function headerText(text, x, y, size, col = PAPER) {
  ctx.font = fnt(size, 800, F_MIN); ctx.textAlign = 'center';
  ctx.fillStyle = col; ctx.fillText(text, x, y);
}

// ══════════════════════════════════════════════
//  INDICATORS
// ══════════════════════════════════════════════
function renderEdgeIndicators() {
  const margin = 22, sz = 7, v = visibleWorld(-6);
  const byCol = new Map();
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.x > v.x0 && e.x < v.x1 && e.y > v.y0 && e.y < v.y1) continue; // on screen: no arrow needed
    const col = RM.enemyColorFarHide > 0 ? '#888' : (COLOR_HEX[e.color] || INK);
    let arr = byCol.get(col); if (!arr) byCol.set(col, arr = []);
    arr.push(e);
  }
  ctx.save();
  for (const [col, arr] of byCol) {
    ctx.fillStyle = col; ctx.globalAlpha = 0.82;
    ctx.beginPath();
    for (const e of arr) {
      const a = Math.atan2(e.y - player.y, e.x - player.x);
      const { x, y } = screenEdgePoint(a, margin);
      const c = Math.cos(a), s = Math.sin(a);
      ctx.moveTo(x + c * sz, y + s * sz);
      ctx.lineTo(x - c * sz * 0.6 + s * sz * 0.62, y - s * sz * 0.6 - c * sz * 0.62);
      ctx.lineTo(x - c * sz * 0.2, y - s * sz * 0.2);
      ctx.lineTo(x - c * sz * 0.6 - s * sz * 0.62, y - s * sz * 0.6 + c * sz * 0.62);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.restore();
}

const ORB_TAG = { infection: '感染', enemy_boost: '敵増', fusion: '融合', phantom: '幻影', paint: '着彩', normal: '刻印' };
function renderInscriptionEdgeIndicators(t) {
  const margin = 54;
  for (const orb of inscriptionOrbs) {
    const d = Math.hypot(orb.x - player.x, orb.y - player.y);
    if (d < 350) continue;
    const angle = Math.atan2(orb.y - player.y, orb.x - player.x);
    const { x, y } = screenEdgePoint(angle, margin);
    const col = orbColor(orb, t);
    const pulse = 0.75 + 0.25 * Math.sin(t * 3.8 + (orb.pulse || 0) * 0.05);
    ctx.save();
    ctx.translate(x, y);
    paperCard(-21, -19, 42, 40, 8, { lw: 1, alpha: 0.92 });
    drawSeal(0, -4, orb.type, orb.rarity, 18, -0.06, pulse);
    ctx.fillStyle = INK; ctx.globalAlpha = 0.85;
    ctx.font = fnt(9, 600); ctx.textAlign = 'center';
    ctx.fillText(ORB_TAG[orb.type] || '刻印', 0, 16);
    const ax = Math.cos(angle), ay = Math.sin(angle);
    ctx.globalAlpha = 0.8 * pulse; ctx.fillStyle = col;
    ctx.translate(ax * 28, ay * 28); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -4); ctx.lineTo(-1, 0); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ══════════════════════════════════════════════
//  UNLOCK DIAL
// ══════════════════════════════════════════════
function renderCircularUI(t) {
  const ps = playerScreenPos();
  const cx = ps.x, cy = ps.y;
  const shakeX = uiShake > 0 ? Math.sin(uiShake * 1.8) * (uiShake / 10) * 5 : 0;
  const _slot = activeSlot();
  const keyCol = _slot.dur > 0 ? (COLOR_HEX[_slot.colors[0]] || CFG.KEY_COLOR) : '#8a857c';
  const R = CFG.INNER_R;
  ctx.save();
  ctx.translate(shakeX, 0);

  // dial face
  ctx.globalAlpha = 0.5; ctx.fillStyle = phantomMode ? 'rgba(10,24,32,0.6)' : 'rgba(250,246,236,0.75)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // tick marks like a combination lock
  ctx.strokeStyle = phantomMode ? 'rgba(170,245,230,0.5)' : INK_MID; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * TAU + t * 0.05, l = i % 3 === 0 ? 7 : 4;
    ctx.moveTo(cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3));
    ctx.lineTo(cx + Math.cos(a) * (R + 3 + l), cy + Math.sin(a) * (R + 3 + l));
  }
  ctx.stroke();

  const dashOff = -(t * 0.55 % 1) * 20;
  if (_slot.colors.length > 1 && _slot.dur > 0) {
    const segAngle = TAU / _slot.colors.length;
    _slot.colors.forEach((c, ci) => {
      ctx.strokeStyle = COLOR_HEX[c]; ctx.lineWidth = 3.5;
      ctx.setLineDash([13, 7]); ctx.lineDashOffset = dashOff - ci * 20;
      ctx.beginPath(); ctx.arc(cx, cy, R, ci * segAngle, (ci + 1) * segAngle); ctx.stroke();
    });
  } else {
    ctx.strokeStyle = keyCol; ctx.lineWidth = 3.5;
    ctx.setLineDash([13, 7]); ctx.lineDashOffset = dashOff;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.globalAlpha = 0.12; ctx.fillStyle = keyCol;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  if (connectedEnemy) {
    const q = connectedEnemy.angleQueue;
    const hasKey = _slot.dur > 0;
    const eCols = connectedEnemy.colors || [connectedEnemy.color];
    const dmg = (hasKey && _slot.colors.some(c => eCols.includes(c))) ? 2 : 1;
    const hitsLeft = Math.ceil(connectedEnemy.hp / dmg);
    const maxShow = Math.max(1, 3 - Math.round(RM.predictArrowSub));
    const show = Math.min(hitsLeft, maxShow);
    const tol = Math.max(5 * Math.PI / 180, CFG.UNLOCK_TOLERANCE + RM.flickTolerance);
    const ghostAlpha = ghostTimer > 0 ? Math.min(ghostTimer / 25, 1) : 0.55;
    const arrowColors = _slot.dur > 0 && _slot.colors.length > 1 ? _slot.colors.map(c => COLOR_HEX[c]) : null;
    if (show >= 3 && q.length > 2) { ctx.globalAlpha = 0.22; renderDirectionGuide(cx, cy, q[2], keyCol, 2, tol, arrowColors); }
    if (show >= 2 && q.length > 1) { ctx.globalAlpha = 0.48; renderDirectionGuide(cx, cy, q[1], keyCol, 3, tol, arrowColors); }
    ctx.globalAlpha = ghostAlpha;
    renderDirectionGuide(cx, cy, q[0], keyCol, 5, tol, arrowColors);
    ctx.globalAlpha = 1;
  }

  if (RM.cannotEscape > 0) {
    ctx.fillStyle = SHU; ctx.font = fnt(11, 600); ctx.textAlign = 'center';
    ctx.fillText('⛓ 離脱できない', cx, cy + R + 26);
  }
  ctx.restore();
}

function renderDirectionGuide(cx, cy, angle, color, lineW = 4, tol = CFG.UNLOCK_TOLERANCE, colors = null) {
  const R = CFG.INNER_R, OR = CFG.OUTER_R;
  const stemStart = R * 0.25, stemEnd = OR * 0.88;
  const ex = cx + Math.cos(angle) * stemEnd, ey = cy + Math.sin(angle) * stemEnd;
  const ssx = cx + Math.cos(angle) * stemStart, ssy = cy + Math.sin(angle) * stemStart;
  const useGrad = colors && colors.length > 1;
  const safeTol = Math.max(5 * Math.PI / 180, tol);
  const baseAlpha = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = baseAlpha * 0.3;
  if (useGrad) {
    const g = ctx.createLinearGradient(
      cx + Math.cos(angle - safeTol) * OR * 0.85, cy + Math.sin(angle - safeTol) * OR * 0.85,
      cx + Math.cos(angle + safeTol) * OR * 0.85, cy + Math.sin(angle + safeTol) * OR * 0.85);
    colors.forEach((c, ci) => g.addColorStop(ci / Math.max(colors.length - 1, 1), c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle - safeTol) * R, cy + Math.sin(angle - safeTol) * R);
  ctx.arc(cx, cy, OR * 0.85, angle - safeTol, angle + safeTol);
  ctx.arc(cx, cy, R, angle + safeTol, angle - safeTol, true);
  ctx.closePath(); ctx.fill();
  // fan edges in ink
  ctx.globalAlpha = baseAlpha * 0.35; ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();

  // brush stem: thick at the root, tapering to the head
  ctx.save();
  if (useGrad) {
    const g = ctx.createLinearGradient(ssx, ssy, ex, ey);
    colors.forEach((c, ci) => g.addColorStop(ci / Math.max(colors.length - 1, 1), c));
    ctx.strokeStyle = g; ctx.fillStyle = g;
  } else { ctx.strokeStyle = color; ctx.fillStyle = color; }
  const nx = -Math.sin(angle), ny = Math.cos(angle);
  const w0 = lineW * 0.75, w1 = lineW * 0.35;
  ctx.beginPath();
  ctx.moveTo(ssx + nx * w0, ssy + ny * w0);
  ctx.lineTo(ex + nx * w1, ey + ny * w1);
  ctx.lineTo(ex - nx * w1, ey - ny * w1);
  ctx.lineTo(ssx - nx * w0, ssy - ny * w0);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(ssx, ssy, w0, 0, TAU); ctx.fill();
  const tipCol = useGrad ? colors[colors.length - 1] : color;
  const hw = Math.PI / 5, hs = 10 + lineW * 2.4;
  ctx.fillStyle = tipCol;
  ctx.beginPath();
  ctx.moveTo(ex + Math.cos(angle) * 3, ey + Math.sin(angle) * 3);
  ctx.lineTo(ex - Math.cos(angle - hw) * hs, ey - Math.sin(angle - hw) * hs);
  ctx.quadraticCurveTo(ex - Math.cos(angle) * hs * 0.45, ey - Math.sin(angle) * hs * 0.45, ex - Math.cos(angle + hw) * hs, ey - Math.sin(angle + hw) * hs);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha *= 0.6; ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.restore();
}

// ══════════════════════════════════════════════
//  KEY CASE (bottom panel)
// ══════════════════════════════════════════════
function keyPanelSlots() {
  const w = W(), h = H();
  const slotR = 28, spacing = 68, n = keySlots.length;
  const totalW = Math.max(0, n - 1) * spacing;
  const panelY = h - 62;
  return keySlots.map((slot, i) => ({ slot, idx: i, cx: w / 2 - totalW / 2 + i * spacing, cy: panelY, r: slotR }));
}

function renderKeyPanel(t) {
  const slots = keyPanelSlots();
  if (!slots.length) return;
  const panelY = H() - 62, DUR_MAX = 24;
  const x0 = slots[0].cx - 40, pw = slots[slots.length - 1].cx - slots[0].cx + 80;
  paperCard(x0, panelY - 38, pw, 88, 22, { alpha: 0.95 });
  ctx.save();
  ctx.strokeStyle = INK; ctx.globalAlpha = 0.22; ctx.lineWidth = 0.8; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.roundRect(x0 + 6, panelY - 32, pw - 12, 76, 17); ctx.stroke();
  ctx.restore();

  for (const s of slots) {
    const slot = s.slot, dur = slot.dur, cols = slot.colors;
    const active = s.idx === selectedSlotIdx, hasKey = dur > 0, isFused = cols.length > 1;
    const primCol = COLOR_HEX[cols[0]];
    const pulse = active ? 0.85 + 0.15 * Math.sin(t * 4) : 1;
    ctx.save();
    ctx.strokeStyle = INK; ctx.globalAlpha = 0.12; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r - 4, 0, TAU); ctx.stroke();
    if (hasKey) {
      const ratio = Math.min(dur / DUR_MAX, 1), a0 = -Math.PI / 2, a1 = a0 + TAU * ratio;
      ctx.globalAlpha = active ? 0.95 : 0.6; ctx.lineWidth = 3; ctx.lineCap = 'round';
      if (isFused) {
        const seg = (a1 - a0) / cols.length;
        cols.forEach((c, ci) => { ctx.strokeStyle = COLOR_HEX[c]; ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r - 4, a0 + ci * seg, a0 + (ci + 1) * seg); ctx.stroke(); });
      } else { ctx.strokeStyle = primCol; ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r - 4, a0, a1); ctx.stroke(); }
      ctx.globalAlpha = 0.14;
      if (isFused) {
        const bg = ctx.createLinearGradient(s.cx - s.r, s.cy, s.cx + s.r, s.cy);
        cols.forEach((c, ci) => bg.addColorStop(ci / (cols.length - 1), COLOR_HEX[c]));
        ctx.fillStyle = bg;
      } else ctx.fillStyle = primCol;
      ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r - 6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = hasKey ? 1 : 0.8;
    drawKeyIcon(s.cx, s.cy - 2, cols, active ? 12.5 : 11, !hasKey);
    if (active) {
      ctx.globalAlpha = 0.9 * pulse; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.cx, s.cy, s.r + 1, s.r - 1, -0.15, 0.25, TAU - 0.1); ctx.stroke();
      ctx.globalAlpha = 0.4 * pulse; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(s.cx + 0.8, s.cy - 0.6, s.r + 3, s.r + 1, -0.1, 0, TAU - 0.3); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.fillStyle = hasKey ? primCol : '#8a857c';
      ctx.beginPath(); ctx.moveTo(s.cx - 5, s.cy - s.r - 9); ctx.lineTo(s.cx + 5, s.cy - s.r - 9); ctx.lineTo(s.cx, s.cy - s.r - 3); ctx.closePath(); ctx.fill();
    }
    if (hasKey) {
      ctx.globalAlpha = active ? 1 : 0.7;
      ctx.fillStyle = dur <= CFG.DUR_COST_NORMAL ? SHU : INK;
      ctx.font = fnt(10, 600); ctx.textAlign = 'center';
      ctx.fillText(dur, s.cx, s.cy + s.r + 6);
    }
    ctx.restore();
  }
}

// ══════════════════════════════════════════════
//  HUD
// ══════════════════════════════════════════════
function pauseButtonBounds() { return { x: 12, y: 12, w: 40, h: 40 }; }

function renderHUD(w, h, t) {
  const dark = phantomMode;
  const txt = dark ? '#d8f6ef' : INK, txtMid = dark ? 'rgba(216,246,239,0.65)' : INK_MID;
  // pause
  const pb = pauseButtonBounds();
  ctx.save();
  ctx.fillStyle = 'rgba(20,14,8,0.18)'; ctx.beginPath(); ctx.arc(pb.x + 21, pb.y + 23, 19, 0, TAU); ctx.fill();
  ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(pb.x + 20, pb.y + 20, 19, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.roundRect(pb.x + 13, pb.y + 12, 4.5, 16, 2); ctx.roundRect(pb.x + 22.5, pb.y + 12, 4.5, 16, 2); ctx.fill();
  ctx.restore();

  // HP — a brush stroke in a paper groove
  const maxHp = Math.max(1, CFG.PLAYER_HP_MAX + RM.maxHpBonus - RM.maxHpMalus);
  const hpRatio = Math.max(0, player.hp / maxHp);
  const scoreW = 92;
  const bx = pb.x + pb.w + 14, bw = Math.max(80, Math.min(230, w - bx - scoreW - 18)), by = 20, bh = 10;
  ctx.save();
  ctx.fillStyle = dark ? 'rgba(216,246,239,0.12)' : PAPER_DEEP;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();
  const hpCol = hpRatio > 0.5 ? COLOR_HEX.green : hpRatio > 0.25 ? COLOR_HEX.yellow : COLOR_HEX.red;
  if (hpRatio > 0) {
    ctx.fillStyle = hpCol; ctx.globalAlpha = 0.9;
    ctx.beginPath();
    const fw = bw * hpRatio;
    ctx.moveTo(bx + 3, by + 1); ctx.lineTo(bx + fw - 2, by + 0.5);
    ctx.quadraticCurveTo(bx + fw + 1.5, by + bh / 2, bx + fw - 3, by + bh - 0.5);
    ctx.lineTo(bx + 3, by + bh - 1); ctx.quadraticCurveTo(bx - 1, by + bh / 2, bx + 3, by + 1);
    ctx.fill();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.fillRect(bx + 4, by + 2, Math.max(0, fw - 8), 2);
  }
  ctx.globalAlpha = 0.8; ctx.strokeStyle = txt; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.stroke();
  if (maxHp <= 24) {
    ctx.globalAlpha = 0.25; ctx.beginPath();
    for (let i = 1; i < maxHp; i++) { const x = bx + bw * i / maxHp; ctx.moveTo(x, by + 2); ctx.lineTo(x, by + bh - 2); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.fillStyle = txtMid; ctx.font = fnt(10, 600); ctx.textAlign = 'left';
  ctx.fillText(`HP ${player.hp.toFixed(1)} / ${maxHp}`, bx + 2, by + bh + 13);
  ctx.restore();

  // score
  ctx.textAlign = 'right';
  ctx.fillStyle = txtMid; ctx.font = fnt(10, 600);
  ctx.fillText('解錠', w - 16, 20);
  ctx.fillStyle = txt; ctx.font = fnt(24, 800, F_MIN);
  ctx.fillText(score, w - 16, 44);
  let ry = 58;
  if (highScore > 0) { ctx.fillStyle = txtMid; ctx.font = fnt(10, 600); ctx.fillText(`BEST ${highScore}`, w - 16, ry); ry += 14; }
  if (!phantomMode) {
    const left = nextOrbAt - killCount;
    if (left > 0) {
      ctx.fillStyle = dark ? '#d8f6ef' : '#8a8173'; ctx.font = fnt(10, 600);
      ctx.fillText(`次の刻印まで ${left}`, w - 16, ry);
    }
  }

  // left column
  const lx = 16; let ly = 72;
  ctx.textAlign = 'left';
  const s = Math.floor(gameTime);
  ctx.fillStyle = txt; ctx.font = fnt(13, 600);
  ctx.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, lx, ly); ly += 16;
  const alive = enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  ctx.fillStyle = txtMid; ctx.font = fnt(11, 600);
  ctx.fillText(`錠 ×${alive}`, lx, ly); ly += 15;
  if (activeInscriptions.length > 0) {
    drawSeal(lx + 6, ly - 4, 'normal', 'epic', 11, 0);
    ctx.fillStyle = RARITY_INK.epic; ctx.font = fnt(11, 600);
    ctx.fillText(`×${activeInscriptions.length}`, lx + 15, ly); ly += 15;
  }
  if (enemyBoostStacks > 0) {
    drawSeal(lx + 6, ly - 4, 'enemy_boost', null, 11, 0);
    ctx.fillStyle = SHU; ctx.font = fnt(10, 600);
    ctx.fillText(`×${enemyBoostStacks}  頻×${Math.pow(1.3, enemyBoostStacks).toFixed(enemyBoostStacks > 20 ? 0 : 1)}`, lx + 15, ly); ly += 15;
  }
  if (endlessMode) { ctx.fillStyle = txt; ctx.font = fnt(10, 600); ctx.fillText(`着彩 ${activePaints.length}/3`, lx, ly); }

  // combo
  if (combo >= 2) {
    const cy = by + bh + 44;
    const a = Math.min(1, combo / 4);
    const col = combo >= 25 ? SHU : combo >= 10 ? '#c77a14' : txt;
    const size = 20 + Math.min(combo, 30) * 0.6;
    ctx.save();
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.font = fnt(size, 800, F_MIN); ctx.fillStyle = col;
    ctx.fillText(combo, w / 2, cy);
    ctx.font = fnt(10, 600); ctx.fillStyle = txtMid;
    ctx.fillText('COMBO', w / 2, cy + 13);
    if (combo >= 10) brushLine(w / 2 - 26, cy + 18, w / 2 + 26, col, 2.5, 0.6 * a);
    ctx.restore();
  }
}

// ══════════════════════════════════════════════
//  ANNOUNCEMENT — a stamp across the page
// ══════════════════════════════════════════════
const ANNOUNCE_SEAL = {
  '刻印出現': '刻', '色融合刻印': '融', '敵増加刻印': '増', '敵増加': '増', '刻印感染': '感',
  '幻影刻印': '幻', '幻影': '幻', '幻影解除': '解', 'Endless': '彩', 'タップで鍵切替': '鍵', 'Tap & Flick': '錠',
};
function renderOrbAnnounce(w, h, t) {
  const a = orbAnnounce;
  const fadeIn = Math.min(1, a.age / 10);
  const fadeOut = a.age > a.maxAge - 22 ? (a.maxAge - a.age) / 22 : 1;
  const alpha = fadeIn * fadeOut;
  const dark = phantomMode;
  const cx = w / 2, cy = h * 0.44;
  ctx.save();
  ctx.fillStyle = dark ? `rgba(2,12,16,${0.5 * alpha})` : `rgba(243,238,226,${0.45 * alpha})`;
  ctx.fillRect(0, 0, w, h);
  // band of paper torn across the page
  const bandH = 128;
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  const base = dark ? '13,32,40' : '247,243,233';
  g.addColorStop(0, `rgba(${base},0)`); g.addColorStop(0.12, `rgba(${base},0.96)`);
  g.addColorStop(0.88, `rgba(${base},0.96)`); g.addColorStop(1, `rgba(${base},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, cy - bandH / 2, w, bandH);
  const lineCol = dark ? 'rgba(170,245,230,0.6)' : 'rgba(42,37,31,0.55)';
  ctx.strokeStyle = lineCol; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w * 0.08, cy - bandH / 2 + 6); ctx.lineTo(w * 0.92, cy - bandH / 2 + 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.1, cy + bandH / 2 - 6); ctx.lineTo(w * 0.9, cy + bandH / 2 - 5); ctx.stroke();

  const size = Math.round(Math.min(w * 0.11, h * 0.07, 54));
  ctx.font = fnt(size, 800, F_MIN);
  const tw = ctx.measureText(a.label).width;
  const slide = (1 - easeOut(a.age / 14)) * 24;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = dark ? '#e8fbf6' : INK;
  ctx.fillText(a.label, cx - slide, cy - (a.sub ? 8 : 0));
  ctx.textBaseline = 'alphabetic';
  const ulCol = (a.color === '#cccccc' || a.color === '#aaaaaa') ? '#8a8173' : a.color;
  brushLine(cx - tw / 2, cy + size * 0.42 - (a.sub ? 8 : 0), cx + tw / 2 * easeOut(a.age / 18), ulCol, 4, 0.75 * alpha);
  if (a.sub) {
    ctx.font = fnt(14, 600); ctx.fillStyle = dark ? 'rgba(232,251,246,0.8)' : INK_MID;
    ctx.fillText(a.sub, cx, cy + size * 0.42 + 18);
  }
  // seal stamped onto the corner of the word
  const sc = a.age < 6 ? 0 : 1 + 0.8 * (1 - easeOut((a.age - 6) / 7));
  if (sc > 0) {
    const ch = ANNOUNCE_SEAL[a.label] || a.label[0];
    const sx = Math.min(w - 30, cx + tw / 2 + 10), sy = cy - size * 0.55;
    ctx.save();
    ctx.translate(sx, sy); ctx.scale(sc, sc);
    ctx.globalAlpha = alpha * (a.age < 13 ? 0.7 + 0.3 * ((a.age - 6) / 7) : 1);
    drawSealColored(0, 0, ch, a.color, 38, -0.14);
    ctx.restore();
  }
  ctx.restore();
}
// seal with an arbitrary colour/character (for announcements)
const _freeSeals = new Map();
function drawSealColored(x, y, ch, col, size, rot) {
  const k = ch + col + size;
  let s = _freeSeals.get(k);
  if (!s) {
    const S = 3, box = size * 1.3;
    const c = makeCanvas(box * S, box * S), g = c.getContext('2d');
    g.scale(S, S); g.translate(box / 2, box / 2);
    g.fillStyle = col === '#cccccc' || col === '#aaaaaa' ? '#8a8173' : col;
    g.beginPath(); g.roundRect(-size / 2, -size / 2, size, size, size * 0.14); g.fill();
    g.globalCompositeOperation = 'destination-out';
    const rnd = mulberry32(size + ch.charCodeAt(0));
    for (let i = 0; i < 40; i++) { g.globalAlpha = 0.3 + rnd() * 0.5; g.beginPath(); g.arc((rnd() - 0.5) * size, (rnd() - 0.5) * size, rnd() * size * 0.05 + 0.3, 0, TAU); g.fill(); }
    g.globalAlpha = 1; g.font = fnt(size * 0.66, 800, F_MIN); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, 0, size * 0.03);
    s = { c, box };
    if (document.fonts && document.fonts.status === 'loaded') _freeSeals.set(k, s);
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.drawImage(s.c, -s.box / 2, -s.box / 2, s.box, s.box);
  ctx.restore();
}

// ══════════════════════════════════════════════
//  DRAFTS
// ══════════════════════════════════════════════
function draftReady(openedAt) { return clamp01((performance.now() - openedAt) / 700); }

function drawInsCard(b, ins, ready, t) {
  const rcol = RARITY_INK[ins.rarity];
  const lift = (1 - easeOut(ready * 1.6)) * 14;
  const y = b.y + lift;
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * ready;
  paperCard(b.x, y, b.w, b.h, 12, { band: rcol, bandH: 6 });
  ctx.fillStyle = rcol; ctx.font = fnt(11, 600); ctx.textAlign = 'center';
  ctx.fillText(`${RARITY_JP[ins.rarity]}  ${ins.rarity.toUpperCase()}`, b.x + b.w / 2, y + 24);
  drawSeal(b.x + b.w / 2, y + 54, 'normal', ins.rarity, 28, -0.06);
  ctx.strokeStyle = INK_FAINT; ctx.lineWidth = 0.8; ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(b.x + 12, y + 80); ctx.lineTo(b.x + b.w - 12, y + 80); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = BUFF_INK; ctx.font = fnt(11, 600);
  ctx.fillText('▲ 強化', b.x + b.w / 2, y + 98);
  ctx.fillStyle = INK; ctx.font = fnt(12, 600);
  wrapText(ctx, ins.buff.label, b.x + b.w / 2, y + 117, b.w - 18, 16);
  ctx.fillStyle = SHU; ctx.font = fnt(11, 600);
  ctx.fillText('▼ 代償', b.x + b.w / 2, y + 170);
  ctx.fillStyle = INK; ctx.font = fnt(12, 600);
  wrapText(ctx, ins.debuff.label, b.x + b.w / 2, y + 189, b.w - 18, 16);
  ctx.fillStyle = INK_FAINT; ctx.font = fnt(10, 600);
  ctx.fillText(ready >= 1 ? 'タップで刻む' : '…', b.x + b.w / 2, y + b.h - 12);
  ctx.restore();
}

function renderDraft(w, h, t) {
  if (infectedMode && draftChoices.length > 0 && Array.isArray(draftChoices[0])) { renderInfectedDraft(w, h, t); return; }
  darkWash(0.64);
  headerText('刻印を選ぶ', w / 2, h / 2 - 182, 22);
  ctx.fillStyle = 'rgba(243,238,226,0.75)'; ctx.font = fnt(12, 600);
  ctx.fillText('▲強化と ▼代償は、ひとつの刻印に刻まれている', w / 2, h / 2 - 160);
  const bounds = draftCardBounds(w, h);
  const ready = draftReady(draftOpenedAt);
  bounds.slice(0, 3).forEach((b, i) => { if (draftChoices[i]) drawInsCard(b, draftChoices[i], ready, t); });
  inkButton(bounds[3], '見送る（最少耐久の鍵を補充）', { size: 12 });
  if (activeInscriptions.length > 0) {
    ctx.fillStyle = 'rgba(243,238,226,0.55)'; ctx.font = fnt(11, 600); ctx.textAlign = 'center';
    ctx.fillText(`刻まれた刻印 ${activeInscriptions.length}`, w / 2, h - 40);
  }
}

function renderInfectedDraft(w, h, t) {
  ctx.fillStyle = 'rgba(28,6,40,0.78)'; ctx.fillRect(0, 0, w, h);
  headerText('刻印感染', w / 2, h / 2 - 196, 22, '#e7c8ff');
  ctx.fillStyle = 'rgba(231,200,255,0.75)'; ctx.font = fnt(12, 600);
  ctx.fillText('5つの刻印が束になって刻まれる', w / 2, h / 2 - 174);
  const bounds = draftCardBounds(w, h);
  const ready = draftReady(draftOpenedAt);
  bounds.slice(0, 3).forEach((b, i) => {
    const bundle = draftChoices[i];
    if (!bundle) return;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * ready;
    paperCard(b.x, b.y, b.w, b.h, 12, { band: '#7a2fb0', bandH: 6 });
    ctx.fillStyle = '#7a2fb0'; ctx.font = fnt(10, 600); ctx.textAlign = 'center';
    ctx.fillText('感染 ×5', b.x + b.w / 2, b.y + 20);
    const lineH = (b.h - 40) / 5;
    bundle.forEach((ins, j) => {
      const ry = b.y + 28 + j * lineH;
      ctx.fillStyle = RARITY_INK[ins.rarity];
      ctx.beginPath(); ctx.arc(b.x + 9, ry + lineH / 2 - 3, 3, 0, TAU); ctx.fill();
      ctx.textAlign = 'left'; ctx.font = fnt(9, 600);
      ctx.fillStyle = BUFF_INK; ctx.fillText(`▲ ${ins.buff.label}`, b.x + 16, ry + lineH / 2 - 3);
      ctx.fillStyle = SHU; ctx.fillText(`▼ ${ins.debuff.label}`, b.x + 16, ry + lineH / 2 + 9);
      if (j < bundle.length - 1) {
        ctx.strokeStyle = 'rgba(122,47,176,0.25)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(b.x + 6, ry + lineH); ctx.lineTo(b.x + b.w - 6, ry + lineH); ctx.stroke();
      }
    });
    ctx.restore();
  });
  inkButton(bounds[3], '見送る（最少耐久の鍵を補充）', { size: 12 });
}

function renderFusionSelect(w, h, t) {
  darkWash(0.55);
  const cx = w / 2;
  const cardW = Math.min(380, w - 24);
  paperCard(cx - cardW / 2, 48, cardW, 86, 12, { band: '#c98f16', bandH: 5 });
  drawSeal(cx - cardW / 2 + 30, 91, 'fusion', null, 30, -0.1);
  ctx.fillStyle = INK; ctx.font = fnt(18, 800, F_MIN); ctx.textAlign = 'center';
  ctx.fillText('色融合刻印', cx + 10, 80);
  const label = s => s ? s.colors.map(c => COLOR_NAME[c] || c).join('+') : '?';
  const fslots = keyPanelSlots();
  const ringAt = (idx, col, ph) => {
    const s = fslots.find(fs => fs.idx === idx); if (!s) return;
    const p = 0.75 + 0.25 * Math.sin(t * 5 + ph);
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = p;
    ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r + 14, 0, TAU); ctx.stroke(); ctx.restore();
  };
  if (fusionSlotB !== -1) {
    const sA = keySlots[fusionSlotA], sB = keySlots[fusionSlotB];
    const merged = sA && sB ? [...new Set([...sA.colors, ...sB.colors])] : [];
    ctx.font = fnt(13, 600); ctx.fillStyle = '#9a6a0c';
    ctx.fillText('この組み合わせで融合する？', cx + 10, 102);
    ctx.fillStyle = INK_MID; ctx.font = fnt(11, 600);
    ctx.fillText(`「${label(sA)}」＋「${label(sB)}」 → 「${merged.map(c => COLOR_NAME[c]).join('+')}」`, cx + 10, 121);
    const pw = 280, ph = 90, py = h / 2 - 60;
    paperCard(cx - pw / 2, py, pw, ph, 12);
    if (sA && sB) {
      drawKeyIcon(cx - 92, py + ph / 2, sA.colors, 13, false);
      ctx.fillStyle = INK; ctx.font = fnt(18, 600); ctx.fillText('＋', cx - 52, py + ph / 2 + 6);
      drawKeyIcon(cx - 14, py + ph / 2, sB.colors, 13, false);
      ctx.fillText('→', cx + 28, py + ph / 2 + 6);
      drawKeyIcon(cx + 80, py + ph / 2, merged, 17, false);
    }
    const btn = fusionConfirmBounds(w, h);
    inkButton(btn.confirm, '融合する', { band: '#c98f16', size: 15 });
    inkButton(btn.cancel, '選び直す', { size: 14, color: INK_MID });
    ringAt(fusionSlotA, '#c98f16', 0); ringAt(fusionSlotB, BUFF_INK, Math.PI);
  } else {
    ctx.font = fnt(13, 600);
    if (fusionSlotA === -1) { ctx.fillStyle = INK; ctx.fillText('下の鍵から、1本目をタップ', cx + 10, 108); }
    else { ctx.fillStyle = '#9a6a0c'; ctx.fillText(`「${label(keySlots[fusionSlotA])}」と合わせる2本目をタップ`, cx + 10, 108); ringAt(fusionSlotA, '#c98f16', 0); }
    ctx.fillStyle = 'rgba(243,238,226,0.8)'; ctx.font = fnt(11, 600);
    ctx.fillText('融合した鍵は、すべての色の効果を一度に振るう', cx, 156);
    // nudge toward the key case
    const bob = Math.sin(t * 4) * 4;
    ctx.fillStyle = 'rgba(243,238,226,0.85)'; ctx.font = fnt(18, 600);
    ctx.fillText('↓', cx, H() - 118 + bob);
  }
}

function renderPaintDraft(w, h, t) {
  darkWash(0.66);
  headerText('着彩刻印', w / 2, h / 2 - 150, 22);
  ctx.fillStyle = 'rgba(243,238,226,0.7)'; ctx.font = fnt(11, 600);
  ctx.fillText('頁に色をのせる（重ねられるのは3枚まで）', w / 2, h / 2 - 128);
  const ready = draftReady(paintDraftOpenedAt);
  const { cards, skip, reset } = paintDraftAllBounds(w, h);
  for (const b of cards) {
    const p = paintDraftChoices[b.index];
    if (!p) continue;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * ready;
    paperCard(b.x, b.y, b.w, b.h, 12);
    ctx.save(); ctx.beginPath(); ctx.roundRect(b.x + 10, b.y + 12, b.w - 20, 34, 6); ctx.clip();
    drawPaintColorBar(b.x + 10, b.y + 12, b.w - 20, 34, p.pair);
    ctx.restore();
    ctx.strokeStyle = INK_FAINT; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(b.x + 10, b.y + 12, b.w - 20, 34, 6); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = fnt(24, 800, F_MIN); ctx.textAlign = 'center';
    ctx.fillText(p.pair.name, b.x + b.w / 2, b.y + 90);
    ctx.fillStyle = INK_MID; ctx.font = fnt(13, 600);
    ctx.fillText(`${p.blend.char}/${p.motion.char}/${p.density.char}`, b.x + b.w / 2, b.y + 116);
    ctx.restore();
  }
  inkButton(skip, '選ばない', { size: 13 });
  inkButton(reset, '着彩リセット', { size: 13, color: SHU });
}

// ══════════════════════════════════════════════
//  PAUSE — with an illustrated 手引き
// ══════════════════════════════════════════════
function pauseLayout(w, h) {
  const cx = w / 2, cy = h / 2, cardW = Math.min(w - 32, 320), cardH = 420;
  const cardX = cx - cardW / 2, cardY = cy - cardH / 2;
  return { cx, cardW, cardH, cardX, cardY,
    resume: { x: cx - 90, y: cardY + 82, w: 180, h: 44 },
    reset:  { x: cx - 90, y: cardY + 146, w: 180, h: 44 },
    hints:  { x: cx - 80, y: cardY + cardH - 40, w: 160, h: 28 } };
}
function renderPause(w, h, t) {
  darkWash(0.66);
  const L = pauseLayout(w, h);
  paperCard(L.cardX, L.cardY, L.cardW, L.cardH, 16);
  headerText('一時停止', L.cx, L.cardY + 48, 24, INK);
  brushLine(L.cx - 50, L.cardY + 60, L.cx + 50, SHU, 2.5, 0.6);
  inkButton(L.resume, '再開', { band: BUFF_INK, size: 16 });
  inkButton(L.reset, 'リセット', { color: SHU, size: 15 });
  ctx.fillStyle = INK; ctx.font = fnt(12, 800, F_MIN); ctx.textAlign = 'center';
  ctx.fillText('手引き', L.cx, L.cardY + 222);
  // three gestures, drawn
  const colW = (L.cardW - 24) / 3, gy = L.cardY + 270;
  const caps = [['錠前をタップ', '糸でつなぐ'], ['円の内から', 'はじいて解錠'], ['円の外から', 'はじいて離脱']];
  for (let i = 0; i < 3; i++) {
    const gx = L.cardX + 12 + colW * i + colW / 2;
    ctx.save();
    if (i === 0) {
      const spr = lockSprite(['red'], 13, false, 0);
      ctx.drawImage(spr.c, gx - spr.box / 2, gy - spr.box / 2 - 4, spr.box, spr.box);
      const p = (t * 0.8) % 1;
      ctx.strokeStyle = INK; ctx.globalAlpha = 1 - p; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(gx, gy - 2, 8 + p * 16, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      drawFinger(gx + 4, gy + 2, 0.5, 0.9, 0.7);
    } else {
      ctx.strokeStyle = i === 1 ? COLOR_HEX.red : INK_MID; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.arc(gx, gy, 15, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(gx, gy, 5, 0, TAU); ctx.fill();
      const p = (t * 0.7 + i * 0.3) % 1, e = easeOut(p * 1.4);
      const sx = i === 1 ? gx + 2 : gx + 21, sy = i === 1 ? gy - 2 : gy - 14;
      const ex2 = sx + (i === 1 ? 22 : 18) * e, ey2 = sy - (i === 1 ? 18 : 10) * e;
      ctx.strokeStyle = i === 1 ? COLOR_HEX.red : INK; ctx.globalAlpha = 0.7; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex2, ey2); ctx.stroke();
      ctx.globalAlpha = 1;
      drawFinger(ex2, ey2, 0.3, 0.9, 0.7);
    }
    ctx.restore();
    ctx.fillStyle = INK; ctx.font = fnt(11, 600); ctx.textAlign = 'center';
    ctx.fillText(caps[i][0], gx, gy + 38);
    ctx.fillStyle = INK_MID; ctx.fillText(caps[i][1], gx, gy + 52);
  }
  // lock colours
  const traits = [['red', '基本'], ['blue', '硬い'], ['yellow', '速い'], ['green', '癒す'], ['purple', '爆ぜる']];
  const tw = (L.cardW - 24) / 5, ty = L.cardY + 352;
  traits.forEach(([c, tr], i) => {
    const tx = L.cardX + 12 + tw * i + tw / 2;
    ctx.fillStyle = COLOR_HEX[c]; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.roundRect(tx - 7, ty - 9, 14, 11, 3); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = INK; ctx.font = fnt(10, 600); ctx.textAlign = 'center';
    ctx.fillText(tr, tx, ty + 14);
  });
  inkButton(L.hints, 'ヒントを最初から', { size: 11, color: INK_MID });
}

// ══════════════════════════════════════════════
//  GAME OVER — the page you coloured
// ══════════════════════════════════════════════
function buildRunArt(TW, TH) {
  if (!stainChunks.size || stainBounds.x0 > stainBounds.x1) return null;
  const pad = 90;
  let bx0 = stainBounds.x0 - pad, by0 = stainBounds.y0 - pad;
  let bw = stainBounds.x1 - stainBounds.x0 + pad * 2, bh = stainBounds.y1 - stainBounds.y0 + pad * 2;
  // match the frame's aspect so the painting fills it
  if (bw / bh < TW / TH) { const nw = bh * TW / TH; bx0 -= (nw - bw) / 2; bw = nw; }
  else { const nh = bw * TH / TW; by0 -= (nh - bh) / 2; bh = nh; }
  const sc = TW / bw;
  const c = makeCanvas(TW * 2, TH * 2), g = c.getContext('2d');
  g.scale(2, 2);
  g.fillStyle = PAPER; g.fillRect(0, 0, TW, TH);
  g.globalCompositeOperation = 'multiply';
  for (const ch of stainChunks.values()) {
    g.drawImage(ch.c, (ch.cx * STAIN_CH - bx0) * sc, (ch.cy * STAIN_CH - by0) * sc, STAIN_CH * sc, STAIN_CH * sc);
  }
  return c;
}
function renderGameOver(w, h, t) {
  const res = lastResult || { score, killCount, maxCombo, gameTime };
  darkWash(0.7);
  const cx = w / 2, cardW = Math.min(w - 32, 330), cardH = 430;
  const cardX = cx - cardW / 2, cardY = Math.max(12, h / 2 - cardH / 2);
  paperCard(cardX, cardY, cardW, cardH, 16);
  headerText('GAME OVER', cx, cardY + 44, 28, INK);
  const isNewBest = res.killCount >= highScore && res.killCount > 0;
  if (isNewBest) drawSealColored(cardX + cardW - 40, cardY + 36, '新', SHU, 30, 0.12);
  // the page
  const TW = cardW - 40, TH = 110;
  if (lastResult && lastResult.art === undefined) lastResult.art = buildRunArt(TW, TH);
  const ax = cardX + 20, ay = cardY + 62;
  if (lastResult && lastResult.art) {
    ctx.drawImage(lastResult.art, ax, ay, TW, TH);
    ctx.strokeStyle = INK_FAINT; ctx.lineWidth = 1; ctx.strokeRect(ax, ay, TW, TH);
    ctx.fillStyle = INK_MID; ctx.font = fnt(10, 600); ctx.textAlign = 'right';
    ctx.fillText('この頁の彩り', ax + TW - 4, ay + TH - 6);
  }
  const fmt = s => { s = Math.floor(s); return s >= 60 ? `${Math.floor(s / 60)}分${s % 60}秒` : `${s}秒`; };
  const stats = [
    ['生存時間', fmt(res.gameTime)],
    ['解錠数', `${res.killCount}`, isNewBest],
    ['最大コンボ', `${res.maxCombo}`],
    ['刻んだ刻印', `${res.inscriptions || 0}`],
    ['ベスト', `${highScore}`, false, true],
  ];
  stats.forEach(([label, val, hi, dim], i) => {
    const ry = cardY + 202 + i * 36;
    ctx.fillStyle = dim ? INK_FAINT : INK_MID; ctx.font = fnt(12, 600); ctx.textAlign = 'left';
    ctx.fillText(label, cardX + 30, ry);
    ctx.fillStyle = hi ? SHU : dim ? INK_MID : INK; ctx.font = fnt(dim ? 16 : 22, 800, F_MIN); ctx.textAlign = 'right';
    ctx.fillText(val, cardX + cardW - 30, ry);
    if (i < stats.length - 1) { ctx.strokeStyle = 'rgba(42,37,31,0.1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cardX + 26, ry + 12); ctx.lineTo(cardX + cardW - 26, ry + 12); ctx.stroke(); }
  });
  const holdFrac = gameOverHoldStart > 0 ? Math.min(1, (performance.now() - gameOverHoldStart) / GAMEOVER_HOLD_MS) : 0;
  const hy = cardY + cardH - 28;
  ctx.strokeStyle = INK_FAINT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx - 62, hy - 4, 9, 0, TAU); ctx.stroke();
  if (holdFrac > 0) { ctx.strokeStyle = SHU; ctx.beginPath(); ctx.arc(cx - 62, hy - 4, 9, -Math.PI / 2, -Math.PI / 2 + holdFrac * TAU); ctx.stroke(); }
  ctx.fillStyle = holdFrac > 0 ? INK : INK_MID; ctx.font = fnt(13, 600); ctx.textAlign = 'left';
  ctx.fillText('長押しで次の頁へ', cx - 46, hy);
}

// ══════════════════════════════════════════════
//  TITLE — the sketchbook cover
// ══════════════════════════════════════════════
function renderTitle(w, h, t) {
  ctx.fillStyle = 'rgba(243,238,226,0.95)'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.6;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.globalAlpha = 0.25; ctx.strokeRect(20, 20, w - 40, h - 40);
  ctx.globalAlpha = 1;
  const cy = h * 0.36;
  // illustration: lock + key
  const spr = lockSprite(['red', 'blue', 'yellow'], 26, false, Math.floor(t * 4) % 3);
  ctx.save();
  ctx.translate(w / 2 - 22, cy - 82);
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 7;
  const L = lockGeom(26), lift = (Math.sin(t * 1.4) * 0.5 + 0.5) * 9;
  ctx.beginPath(); ctx.moveTo(-11.5, L.y0 + 1); ctx.lineTo(-11.5, L.y0 - 9 - lift); ctx.arc(0, L.y0 - 9 - lift, 11.5, Math.PI, 0); ctx.lineTo(11.5, L.y0 - 2 - lift * 0.8); ctx.stroke();
  ctx.strokeStyle = '#d6cdbb'; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.drawImage(spr.c, -spr.box / 2, -spr.box / 2, spr.box, spr.box);
  ctx.restore();
  drawKeyIcon(w / 2 + 42, cy - 70 + Math.sin(t * 2) * 3, ['red'], 18, false, 0.3 + Math.sin(t * 1.4) * 0.1);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK; ctx.font = fnt(Math.min(64, w * 0.16), 800, F_MIN);
  ctx.fillText('CroqKey', w / 2, cy + 18);
  brushLine(w / 2 - 92, cy + 32, w / 2 + 92, SHU, 3.5, 0.75);
  ctx.fillStyle = INK_MID; ctx.font = fnt(13, 600);
  ctx.fillText('クロッキー帳に棲む錠前たち', w / 2, cy + 58);
  ctx.fillStyle = INK; ctx.font = fnt(15, 600, F_MIN);
  ctx.fillText('錠を解き、色を集め、頁を彩れ。', w / 2, cy + 100);
  if (highScore > 0 || totalKills > 0) {
    ctx.fillStyle = INK_MID; ctx.font = fnt(11, 600);
    ctx.fillText(`ベスト ${highScore}　通算解錠 ${totalKills}`, w / 2, cy + 130);
  }
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3);
  ctx.fillStyle = INK; ctx.font = fnt(15, 600);
  ctx.fillText('タップしてひらく', w / 2, h * 0.78);
  ctx.globalAlpha = 1;
  drawSealColored(w - 52, h - 52, '錠', SHU, 30, -0.12);
}

function wrapText(c, text, cx, y, maxW, lineH) {
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (c.measureText(test).width > maxW && line !== '') { c.fillText(line, cx, y); y += lineH; line = ch; }
    else line = test;
  }
  c.fillText(line, cx, y);
}

function screenEdgePoint(angle, margin) {
  const hw = W() / 2 - margin, hh = H() / 2 - margin;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const tx = cos !== 0 ? hw / Math.abs(cos) : Infinity;
  const ty = sin !== 0 ? hh / Math.abs(sin) : Infinity;
  const t = Math.min(tx, ty);
  return { x: W() / 2 + cos * t, y: H() / 2 + sin * t };
}


// ══════════════════════════════════════════════
//  手引き — contextual coach marks
//  Shown one at a time, only when the situation calls for it, and
//  retired for good once the player has done the thing themselves.
// ══════════════════════════════════════════════
const HINT_STORE = 'croqkey_hints_v1';
let hintsLearned = new Set();
try { hintsLearned = new Set(JSON.parse(localStorage.getItem(HINT_STORE) || '[]')); } catch (e) { /* private mode */ }
let activeHint = null;
let hintCooldown = 50;
const hintPending = {};

function saveHints() { try { localStorage.setItem(HINT_STORE, JSON.stringify([...hintsLearned])); } catch (e) { /* ignore */ } }
function learnHint(id) {
  if (hintsLearned.has(id)) return;
  hintsLearned.add(id); saveHints();
  if (activeHint && activeHint.def.id === id) activeHint.done = true;
}
function resetHints() { hintsLearned.clear(); saveHints(); activeHint = null; fieldNotes.length = 0; hintCooldown = 30; }
function hintEvent(ev) { for (const d of HINT_DEFS) if (d.ev === ev) learnHint(d.id); }

function onScreenPt(p, m = 0) { return p && p.x > m && p.x < W() - m && p.y > m && p.y < H() - m; }
function nearestEnemyScreen() {
  let best = null, bd = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const p = w2sz(e.x, e.y);
    if (!onScreenPt(p, 30) || p.y > H() - 140 || p.y < 90) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function nearestKeyScreen() {
  let best = null, bd = Infinity;
  for (const k of keyDrops) {
    const p = w2sz(k.x, k.y);
    if (!onScreenPt(p, 20)) continue;
    const d = Math.hypot(k.x - player.x, k.y - player.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function nearestOrbScreen(type) {
  let best = null, bd = Infinity;
  for (const o of inscriptionOrbs) {
    if (o.type !== type) continue;
    const d = Math.hypot(o.x - player.x, o.y - player.y);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return null;
  const p = w2sz(best.x, best.y);
  return onScreenPt(p, 30) ? p : screenEdgePoint(Math.atan2(best.y - player.y, best.x - player.x), 54);
}
function threatNear(d) {
  for (const e of enemies) if (e.alive && e !== connectedEnemy && Math.hypot(e.x - player.x, e.y - player.y) < d) return e;
  return null;
}
function otherKeyReady() {
  let idx = -1;
  keySlots.forEach((s, i) => { if (idx < 0 && i !== selectedSlotIdx && s.dur > 0) idx = i; });
  return idx;
}
function matchSlotIdx() {
  if (!connectedEnemy) return -1;
  const ec = connectedEnemy.colors || [connectedEnemy.color];
  return keySlots.findIndex(s => s.dur > 0 && s.colors.some(c => ec.includes(c)));
}
function activeMatches() {
  if (!connectedEnemy) return false;
  const ec = connectedEnemy.colors || [connectedEnemy.color], s = activeSlot();
  return s.dur > 0 && s.colors.some(c => ec.includes(c));
}
function slotScreen(i) { const s = keyPanelSlots().find(k => k.idx === i); return s ? { x: s.cx, y: s.cy - 4 } : null; }

const HINT_DEFS = [
  { id: 'connect', ev: 'connect', title: '錠前をタップ', sub: '糸がつながると、解錠がはじまる', gesture: 'tap',
    when: () => state === State.IDLE && nearestEnemyScreen(), target: nearestEnemyScreen },
  { id: 'unlock', ev: 'hit', title: '矢印の向きへ、はじく', sub: '円の内側から指を払う', gesture: 'ring', delay: 4,
    when: () => state === State.CONNECTED && !!connectedEnemy, target: () => playerScreenPos() },
  { id: 'move', ev: 'move', title: 'はじいて移動', sub: '落ちた鍵に触れると拾える', gesture: 'flickTo',
    when: () => state === State.IDLE && hintsLearned.has('unlock') && nearestKeyScreen(), target: nearestKeyScreen },
  { id: 'switch', ev: 'slot', title: '鍵をタップで持ち替え', sub: '錠前と同じ色の鍵なら 会心', gesture: 'tap', anchorBottom: true,
    when: () => (state === State.IDLE || state === State.CONNECTED) && otherKeyReady() >= 0, target: () => slotScreen(otherKeyReady()) },
  { id: 'match', ev: 'crit', title: '同じ色の鍵で 会心', sub: '会心はダメージ2倍以上、鍵は2減る', gesture: 'tap', anchorBottom: true,
    when: () => state === State.CONNECTED && hintsLearned.has('switch') && matchSlotIdx() >= 0 && !activeMatches(), target: () => slotScreen(matchSlotIdx()) },
  { id: 'escape', ev: 'escape', title: '円の外からはじくと離脱', sub: '囲まれたら、いったん逃げる', gesture: 'escape',
    when: () => state === State.CONNECTED && hintsLearned.has('unlock') && threatNear(95), target: () => playerScreenPos() },
  { id: 'worn', title: '鍵がすり減った', sub: '同じ色の鍵を拾えば、また使える', gesture: 'point', anchorBottom: true, learnOnResolve: true,
    when: () => activeSlot().dur === 0 && killCount > 2, target: () => slotScreen(selectedSlotIdx) },
  { id: 'orb', ev: 'draft', title: '刻印に触れる', sub: '強化と代償をひとつ選ぶ', gesture: 'flickTo',
    when: () => state === State.IDLE && inscriptionOrbs.some(o => o.type === 'normal'), target: () => nearestOrbScreen('normal') },
  { id: 'phantom', ev: 'phantom', title: '長押しで 幻影へ', sub: 'もう一度長押しで戻る', gesture: 'hold',
    when: () => state === State.IDLE && phantomOrbPickedUp && !phantomMode, target: () => ({ x: W() / 2, y: H() * 0.6 }) },
];

function updateHints() {
  if (activeHint) {
    const a = activeHint;
    a.age++;
    if (a.done || a.fading) {
      if (++a.fade > 18) { hintCooldown = a.done ? 8 : 70; activeHint = null; }
      return;
    }
    let ok = false;
    try { ok = !!a.def.when(); } catch (e) { ok = false; }
    if (!ok) {
      if (++a.lost > 24) { if (a.def.learnOnResolve && a.age > 80) learnHint(a.def.id); a.fading = true; }
    } else a.lost = 0;
    return;
  }
  if (hintCooldown > 0) { hintCooldown--; return; }
  if (orbAnnounce) return;
  for (const d of HINT_DEFS) {
    if (hintsLearned.has(d.id)) continue;
    let ok = false;
    try { ok = !!d.when(); } catch (e) { ok = false; }
    hintPending[d.id] = ok ? (hintPending[d.id] || 0) + 1 : 0;
    if (hintPending[d.id] > (d.delay ?? 24)) {
      hintPending[d.id] = 0;
      activeHint = { def: d, age: 0, fade: 0, lost: 0, done: false, fading: false };
      return;
    }
  }
}

// a ghost fingertip, drawn in ink
function drawFinger(x, y, press, alpha, scale = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.scale(scale, scale);
  const r = 11 - press * 2;
  ctx.fillStyle = 'rgba(255,253,246,0.85)'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, r * 0.3);
  ctx.arc(0, 0, r, Math.PI * 0.9, Math.PI * 0.1 + TAU, false);
  ctx.lineTo(r * 1.2 + 14, r + 34);
  ctx.lineTo(-r * 0.4 + 6, r + 40);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.globalAlpha *= 0.45; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(1, -r * 0.35, r * 0.45, r * 0.3, -0.4, 0, TAU); ctx.stroke();
  ctx.restore();
}

function renderHint(t) {
  const a = activeHint;
  if (!a || orbAnnounce || !(state === State.IDLE || state === State.CONNECTED)) return;
  const fadeIn = Math.min(1, a.age / 12);
  const alpha = fadeIn * ((a.done || a.fading) ? Math.max(0, 1 - a.fade / 18) : 1);
  if (alpha <= 0) return;
  const d = a.def;
  let target = null;
  try { target = d.target(); } catch (e) { target = null; }
  const w = W(), h = H();
  ctx.save();
  ctx.globalAlpha = alpha;

  // card
  ctx.font = fnt(16, 600);
  const tw = ctx.measureText(d.title).width;
  ctx.font = fnt(11, 600);
  const sw = ctx.measureText(d.sub).width;
  const cw = Math.min(w - 24, Math.max(tw, sw) + 44), chh = 56;
  const cx = w / 2 - cw / 2;
  const cy = d.anchorBottom ? h - 196 : h - 182;
  paperCard(cx, cy, cw, chh, 12, { band: SHU, bandH: 4 });
  drawSealColored(cx + 4, cy + 4, '手', SHU, 18, -0.12);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK; ctx.font = fnt(16, 600);
  ctx.fillText(d.title, w / 2, cy + 26);
  ctx.fillStyle = INK_MID; ctx.font = fnt(11, 600);
  ctx.fillText(d.sub, w / 2, cy + 44);

  const cyc = t % 1.6 / 1.6;
  if (target && (d.gesture === 'tap' || d.gesture === 'point')) {
    // leader line from the card to the thing
    ctx.save();
    ctx.strokeStyle = INK; ctx.globalAlpha = alpha * 0.45; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    const fromY = target.y < cy ? cy : cy + chh;
    ctx.beginPath(); ctx.moveTo(w / 2, fromY); ctx.quadraticCurveTo(w / 2, (fromY + target.y) / 2, target.x, target.y + (target.y < cy ? 26 : -26)); ctx.stroke();
    ctx.restore();
  }
  if (target && d.gesture === 'tap') {
    const press = cyc > 0.35 && cyc < 0.55 ? 1 : 0;
    const app = easeOut(cyc / 0.35);
    if (cyc > 0.35) {
      const rp = (cyc - 0.35) / 0.65;
      ctx.strokeStyle = SHU; ctx.lineWidth = 2; ctx.globalAlpha = alpha * (1 - rp);
      ctx.beginPath(); ctx.arc(target.x, target.y, 10 + rp * 26, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    drawFinger(target.x + (1 - app) * 18, target.y + (1 - app) * 26, press, 1);
  } else if (target && d.gesture === 'point') {
    const bob = Math.sin(t * 6) * 4;
    ctx.fillStyle = SHU;
    ctx.beginPath(); ctx.moveTo(target.x, target.y - 34 + bob); ctx.lineTo(target.x - 8, target.y - 46 + bob); ctx.lineTo(target.x + 8, target.y - 46 + bob); ctx.closePath(); ctx.fill();
  } else if (d.gesture === 'ring' && connectedEnemy) {
    const ps = playerScreenPos(), ang = connectedEnemy.angleQueue[0];
    const c = Math.cos(ang), s = Math.sin(ang);
    const p = cyc < 0.15 ? 0 : easeOut((cyc - 0.15) / 0.4);
    const r0 = 10, r1 = CFG.INNER_R + 50;
    const fx = ps.x + c * (r0 + (r1 - r0) * p), fy = ps.y + s * (r0 + (r1 - r0) * p);
    ctx.globalAlpha = alpha * 0.18 * (0.6 + 0.4 * Math.sin(t * 5));
    ctx.fillStyle = COLOR_HEX[activeKeyColor()] || INK;
    ctx.beginPath(); ctx.arc(ps.x, ps.y, CFG.INNER_R, 0, TAU); ctx.fill();
    if (p > 0) {
      ctx.globalAlpha = alpha * 0.75 * (cyc > 0.7 ? 1 - (cyc - 0.7) / 0.3 : 1);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ps.x + c * r0, ps.y + s * r0); ctx.lineTo(fx, fy); ctx.stroke();
    }
    ctx.globalAlpha = alpha * (cyc > 0.75 ? 1 - (cyc - 0.75) / 0.25 : 1);
    drawFinger(fx, fy, cyc < 0.15 ? 1 : 0.3, 1);
  } else if (d.gesture === 'escape') {
    const ps = playerScreenPos();
    const th = threatNear(140) || connectedEnemy;
    const away = th ? Math.atan2(player.y - th.y, player.x - th.x) : -Math.PI / 2;
    const c = Math.cos(away), s = Math.sin(away);
    const r0 = CFG.INNER_R + 26, p = cyc < 0.15 ? 0 : easeOut((cyc - 0.15) / 0.4);
    const sx = ps.x + c * r0, sy = ps.y + s * r0, fx = sx + c * 70 * p, fy = sy + s * 70 * p;
    ctx.strokeStyle = INK; ctx.globalAlpha = alpha * 0.4; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(ps.x, ps.y, CFG.INNER_R + 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (p > 0) { ctx.globalAlpha = alpha * 0.6; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(fx, fy); ctx.stroke(); }
    ctx.globalAlpha = alpha * (cyc > 0.75 ? 1 - (cyc - 0.75) / 0.25 : 1);
    drawFinger(fx, fy, cyc < 0.15 ? 1 : 0.3, 1);
  } else if (d.gesture === 'flickTo' && target) {
    const ps = w2sz(player.x, player.y);
    const ang = Math.atan2(target.y - ps.y, target.x - ps.x);
    const len = Math.min(90, Math.hypot(target.x - ps.x, target.y - ps.y) * 0.6);
    const c = Math.cos(ang), s = Math.sin(ang), p = cyc < 0.15 ? 0 : easeOut((cyc - 0.15) / 0.4);
    const sx = ps.x + c * 30, sy = ps.y + s * 30, fx = sx + c * len * p, fy = sy + s * len * p;
    ctx.strokeStyle = SHU; ctx.globalAlpha = alpha * 0.8; ctx.lineWidth = 2; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.arc(target.x, target.y, 22 + Math.sin(t * 5) * 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (p > 0) { ctx.strokeStyle = INK; ctx.globalAlpha = alpha * 0.6; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(fx, fy); ctx.stroke(); }
    ctx.globalAlpha = alpha * (cyc > 0.75 ? 1 - (cyc - 0.75) / 0.25 : 1);
    drawFinger(fx, fy, cyc < 0.15 ? 1 : 0.3, 1);
  } else if (d.gesture === 'hold' && target) {
    const p = clamp01(cyc / 0.8);
    ctx.strokeStyle = INK_FAINT; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(target.x, target.y, 30, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#1f9c8a'; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(target.x, target.y, 30, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke();
    drawFinger(target.x, target.y, 1, 1);
  }
  ctx.restore();
}

// ── 観察メモ: hand-written notes that label new things on the page ──
const NOTE_TEXT = {
  note_blue:   ['青の錠', '遅いが、硬い'],
  note_yellow: ['黄の錠', '速いが、脆い'],
  note_green:  ['緑の錠', 'まわりの錠を癒す'],
  note_purple: ['紫の錠', '開けると爆ぜる。近いと痛い'],
  note_fusion: ['混色の錠', '色の数だけ硬く、性質も合わさる'],
  note_o_fusion:      ['色融合刻印', '鍵どうしを合わせ、まとめて振るう'],
  note_o_enemy_boost: ['敵増加刻印', '拾うと錠前が増える'],
  note_o_infection:   ['刻印感染', '以後の刻印は5つ束で刻まれる'],
  note_o_phantom:     ['幻影刻印', '長押しで、錠前を刻印に変える'],
  note_o_paint:       ['着彩刻印', '頁に色をのせる'],
};
const fieldNotes = [];
function updateFieldNotes() {
  for (let i = fieldNotes.length - 1; i >= 0; i--) {
    const n = fieldNotes[i];
    n.age++;
    const gone = n.isOrb ? !inscriptionOrbs.includes(n.ref) : !n.ref.alive;
    if (gone && !n.gone) { n.gone = true; n.age = Math.max(n.age, n.max - 20); }
    if (n.age >= n.max) fieldNotes.splice(i, 1);
  }
  if (fieldNotes.length || frame % 12 !== 0 || !hintsLearned.has('unlock')) return;
  if (activeHint && !activeHint.done) return;
  const v = visibleWorld(-40);
  const inView = o => o.x > v.x0 && o.x < v.x1 && o.y > v.y0 && o.y < v.y1 - 90;
  for (const e of enemies) {
    if (!e.alive || !inView(e)) continue;
    const id = e.fusion ? 'note_fusion' : 'note_' + e.color;
    if (!NOTE_TEXT[id] || hintsLearned.has(id)) continue;
    learnHint(id);
    fieldNotes.push({ ref: e, isOrb: false, text: NOTE_TEXT[id], col: COLOR_HEX[e.color], age: 0, max: 320 });
    return;
  }
  for (const o of inscriptionOrbs) {
    if (o.type === 'normal' || !inView(o)) continue;
    const id = 'note_o_' + o.type;
    if (!NOTE_TEXT[id] || hintsLearned.has(id)) continue;
    learnHint(id);
    fieldNotes.push({ ref: o, isOrb: true, text: NOTE_TEXT[id], col: SEAL_STYLE[o.type] && SEAL_STYLE[o.type].col || SHU, age: 0, max: 320 });
    return;
  }
}
function renderFieldNotes(t) {
  if (!(state === State.IDLE || state === State.CONNECTED)) return;
  for (const n of fieldNotes) {
    const a = Math.min(1, n.age / 14) * Math.min(1, (n.max - n.age) / 20);
    if (!n.gone) n.last = w2sz(n.ref.x, n.ref.y);
    const p = n.last;
    if (!p) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = fnt(13, 600);
    const tw1 = ctx.measureText(n.text[0]).width;
    ctx.font = fnt(10, 600);
    const tw2 = ctx.measureText(n.text[1]).width;
    const bw = Math.max(tw1, tw2) + 26, bh = 40;
    let lx = p.x + 34, ly = p.y - 66;
    if (lx + bw > W() - 8) lx = p.x - 34 - bw;
    if (ly < 76) ly = p.y + 30;
    lx = Math.max(8, lx);
    // circled subject + leader line
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 27, 24, -0.2, 0.3, TAU - 0.2); ctx.stroke();
    const ax = lx < p.x ? lx + bw : lx, ay = ly + bh / 2;
    const ang = Math.atan2(ay - p.y, ax - p.x);
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(p.x + Math.cos(ang) * 28, p.y + Math.sin(ang) * 25); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.setLineDash([]);
    paperCard(lx, ly, bw, bh, 8, { lw: 1 });
    ctx.fillStyle = n.col; ctx.beginPath(); ctx.arc(lx + 11, ly + 15, 4, 0, TAU); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = INK; ctx.font = fnt(13, 600); ctx.fillText(n.text[0], lx + 19, ly + 19);
    ctx.fillStyle = INK_MID; ctx.font = fnt(10, 600); ctx.fillText(n.text[1], lx + 10, ly + 33);
    ctx.restore();
  }
}

// ── 指の軌跡 & long-press gauge ────────────────
const swipeTrail = { pts: [], col: INK };
function trailStart(x, y) {
  swipeTrail.pts = [{ x, y, t: performance.now() }];
  let col = phantomMode ? '#aaf5e6' : INK;
  if (state === State.CONNECTED) {
    const ps = playerScreenPos();
    if (Math.hypot(x - ps.x, y - ps.y) < CFG.INNER_R) col = COLOR_HEX[activeKeyColor()] || INK;
  }
  swipeTrail.col = col;
}
function trailMove(x, y) {
  if (!touch) return;
  swipeTrail.pts.push({ x, y, t: performance.now() });
  if (swipeTrail.pts.length > 30) swipeTrail.pts.shift();
}
function renderSwipeTrail() {
  if (!(state === State.IDLE || state === State.CONNECTED)) return;
  const now = performance.now(), pts = swipeTrail.pts;
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.strokeStyle = swipeTrail.col;
  for (let i = 1; i < pts.length; i++) {
    const age = (now - pts[i].t) / 280;
    if (age >= 1) continue;
    ctx.globalAlpha = (1 - age) * 0.5;
    ctx.lineWidth = 1 + (1 - age) * 6;
    ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
  }
  ctx.restore();
}
function renderHoldRing() {
  if (!touch || !phantomOrbPickedUp || state !== State.IDLE || phantomHoldFired) return;
  const el = performance.now() - touch.t;
  if (el < 140) return;
  const last = swipeTrail.pts[swipeTrail.pts.length - 1];
  if (last && Math.hypot(last.x - touch.sx, last.y - touch.sy) > 25) return;
  const p = clamp01((el - 140) / (PHANTOM_HOLD_MS - 140));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = phantomMode ? 'rgba(170,245,230,0.3)' : INK_FAINT; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(touch.sx, touch.sy, 34, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#1f9c8a'; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.arc(touch.sx, touch.sy, 34, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke();
  ctx.fillStyle = phantomMode ? '#e8fbf6' : INK; ctx.font = fnt(12, 600); ctx.textAlign = 'center';
  ctx.fillText(phantomMode ? '幻影を解く' : '幻影へ', touch.sx, touch.sy - 44);
  ctx.restore();
}

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

// ══════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════
// Drop to 1x pixel density for the rest of the session if the device can't keep up
let _lastNow = 0, _perfSum = 0, _perfN = 0;
function loop(now) {
  if (_lastNow) { const dt = now - _lastNow; if (dt < 250) { _perfSum += dt; _perfN++; } }
  _lastNow = now;
  if (_perfN >= 120) {
    if (DPR > 1 && _perfSum / _perfN > 22) { DPR = 1; resize(); }
    _perfSum = _perfN = 0;
  }
  update(); render(); requestAnimationFrame(loop);
}

initPlayer();
spawnEnemies();
state = State.TITLE;
requestAnimationFrame(loop);
