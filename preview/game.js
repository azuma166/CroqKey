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
  fieldNotes.length = 0;
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
//  VISUAL SYSTEM — flat, hairline, high-contrast
// ══════════════════════════════════════════════
const TAU        = Math.PI * 2;
const BG         = '#f6f7f8';
const BG_PH      = '#050f0e';
const INK        = '#16181b';
const INK2       = 'rgba(22,24,27,0.56)';
const INK3       = 'rgba(22,24,27,0.26)';
const PANEL      = 'rgba(16,18,21,0.92)';
const PANEL_LINE = 'rgba(255,255,255,0.12)';
const WHITE2     = 'rgba(255,255,255,0.64)';
const WHITE3     = 'rgba(255,255,255,0.34)';
const PH_COL     = '#44ffdd';
const BUFF_COL   = '#3db86a';
const DEBUFF_COL = '#e8453c';
const F_TXT = '"Barlow", "Zen Kaku Gothic New", -apple-system, "Hiragino Sans", sans-serif';
const fnt = (px, w = 700) => `${w} ${px}px ${F_TXT}`;
const COLOR_NAME = { red: '赤', blue: '青', yellow: '黄', green: '緑', purple: '紫' };
const ORB_CHAR = { normal: '刻', fusion: '融', enemy_boost: '増', infection: '感', phantom: '幻', paint: '彩' };
const ORB_TAG  = { normal: '刻印', fusion: '融合', enemy_boost: '敵増', infection: '感染', phantom: '幻影', paint: '着彩' };

let RM = null; // getMods() snapshot for this render frame

const _enemySprites = new Map();
function invalidateSprites() { _enemySprites.clear(); }

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
  const hw = w / (2 * s), hh = h / (2 * s), cx = cam.x + w / 2, cy = cam.y + h / 2;
  return { x0: cx - hw - margin, y0: cy - hh - margin, x1: cx + hw + margin, y1: cy + hh + margin };
}
function w2sz(wx, wy) {
  const s = viewScale(), w = W(), h = H();
  return { x: (wx - cam.x - w / 2) * s + w / 2, y: (wy - cam.y - h / 2) * s + h / 2 };
}
function diamondPath(x, y, s, wr = 0.68) {
  ctx.moveTo(x, y - s); ctx.lineTo(x + s * wr, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * wr, y); ctx.closePath();
}
function panelRect(x, y, w, h, r = 6, line = PANEL_LINE) {
  ctx.fillStyle = PANEL;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke();
}
function textBtn(b, label, col = '#fff', line = PANEL_LINE, size = 14) {
  panelRect(b.x, b.y, b.w, b.h, 6, line);
  ctx.fillStyle = col; ctx.font = fnt(size, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}
function dim(alpha = 0.74) { ctx.fillStyle = `rgba(8,9,12,${alpha})`; ctx.fillRect(0, 0, W(), H()); }

// ── field grid (pattern, hairlines) ─────────────
let gridPat = null, gridPatPh = null;
function buildGrid(ph) {
  const S = 192;
  const canScale = typeof DOMMatrix !== 'undefined' && typeof CanvasPattern !== 'undefined' && CanvasPattern.prototype.setTransform;
  const k = canScale ? 2 : 1;
  const c = makeCanvas(S * k, S * k), g = c.getContext('2d');
  g.scale(k, k);
  g.fillStyle = ph ? BG_PH : BG; g.fillRect(0, 0, S, S);
  g.strokeStyle = ph ? 'rgba(68,255,221,0.09)' : '#e3e5e8'; g.lineWidth = 0.5;
  for (let p = 48; p < S; p += 48) {
    g.beginPath(); g.moveTo(p + 0.25, 0); g.lineTo(p + 0.25, S); g.stroke();
    g.beginPath(); g.moveTo(0, p + 0.25); g.lineTo(S, p + 0.25); g.stroke();
  }
  g.strokeStyle = ph ? 'rgba(68,255,221,0.18)' : '#d3d6db'; g.lineWidth = 0.75;
  g.beginPath(); g.moveTo(0.4, 0); g.lineTo(0.4, S); g.moveTo(0, 0.4); g.lineTo(S, 0.4); g.stroke();
  const pat = ctx.createPattern(c, 'repeat');
  if (k !== 1) pat.setTransform(new DOMMatrix().scale(1 / k));
  return pat;
}
function drawGrid() {
  if (!gridPat) { gridPat = buildGrid(false); gridPatPh = buildGrid(true); }
  const v = visibleWorld(4);
  ctx.fillStyle = phantomMode ? gridPatPh : gridPat;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
}

// ── enemy body sprite ───────────────────────────
function enemySprite(colors, r, hidden, focused) {
  const k = (hidden ? 'h' : colors.join('+')) + '|' + r + '|' + (focused ? 1 : 0);
  let s = _enemySprites.get(k);
  if (s) return s;
  const S = 3, box = r * 2 + 8;
  const c = makeCanvas(box * S, box * S), g = c.getContext('2d');
  g.scale(S, S); g.translate(box / 2, box / 2);
  const cols = hidden ? ['#8c9096'] : colors.map(cc => COLOR_HEX[cc]);
  if (cols.length > 1) {
    const gr = g.createLinearGradient(-r, 0, r, 0);
    cols.forEach((cc, i) => gr.addColorStop(i / (cols.length - 1), hexA(cc, focused ? 0.34 : 0.22)));
    g.fillStyle = gr;
  } else g.fillStyle = hexA(cols[0], focused ? 0.20 : 0.10);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  if (cols.length > 1) {
    const seg = TAU / cols.length;
    g.lineWidth = focused ? 2.6 : 2;
    cols.forEach((cc, i) => { g.strokeStyle = cc; g.beginPath(); g.arc(0, 0, r, -Math.PI / 2 + i * seg + 0.06, -Math.PI / 2 + (i + 1) * seg - 0.06); g.stroke(); });
  } else {
    g.strokeStyle = focused ? INK : '#5b6068'; g.lineWidth = focused ? 2 : 1.4;
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  }
  const kr = r * 0.24, ky = -r * 0.16;
  g.fillStyle = cols.length > 1 ? INK : cols[0];
  g.beginPath(); g.arc(0, ky, kr, 0, TAU); g.fill();
  g.beginPath();
  g.moveTo(-kr * 0.5, ky + kr * 0.5); g.lineTo(kr * 0.5, ky + kr * 0.5);
  g.lineTo(kr * 0.95, ky + kr * 2.4); g.lineTo(-kr * 0.95, ky + kr * 2.4); g.closePath(); g.fill();
  s = { c, box };
  _enemySprites.set(k, s);
  return s;
}

// ══════════════════════════════════════════════
//  WORLD
// ══════════════════════════════════════════════
function renderEffectsWorld(t) {
  for (const e of effects) {
    const p = e.age / e.maxAge, q = 1 - p;
    ctx.save();
    if (e.type === 'explosion') {
      const ease = easeOut(p);
      ctx.globalAlpha = q * 0.7; ctx.strokeStyle = e.color; ctx.lineWidth = 2 * q + 0.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, ease * 72, 0, TAU); ctx.stroke();
      ctx.globalAlpha = q * 0.12; ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, ease * 46, 0, TAU); ctx.fill();
      ctx.globalAlpha = q * 0.9; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (e.seed || 0) + i / 8 * TAU;
        ctx.moveTo(e.x + Math.cos(a) * ease * 34, e.y + Math.sin(a) * ease * 34);
        ctx.lineTo(e.x + Math.cos(a) * ease * 62, e.y + Math.sin(a) * ease * 62);
      }
      ctx.stroke();
    } else if (e.type === 'hit') {
      const sz = e.crit ? 36 : 22;
      ctx.globalAlpha = q * (e.crit ? 0.9 : 0.7); ctx.strokeStyle = e.color; ctx.lineWidth = e.crit ? 2.4 : 1.3;
      ctx.beginPath(); ctx.arc(e.x, e.y, easeOut(p) * sz, 0, TAU); ctx.stroke();
      if (e.crit) {
        ctx.globalAlpha = q; ctx.font = fnt(12, 700); ctx.textAlign = 'center';
        ctx.fillStyle = phantomMode ? '#fff' : INK;
        ctx.fillText('CRIT', e.x, e.y - 20 - p * 26);
      }
    } else if (e.type === 'escape') {
      ctx.globalAlpha = q * 0.45; ctx.strokeStyle = phantomMode ? '#fff' : INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, easeOut(p) * CFG.OUTER_R, 0, TAU); ctx.stroke();
    } else if (e.type === 'miss') {
      ctx.globalAlpha = q * 0.6; ctx.strokeStyle = phantomMode ? '#fff' : INK2; ctx.lineWidth = 1.4;
      const d = 5 + p * 12;
      ctx.beginPath(); ctx.moveTo(e.x - d, e.y - d); ctx.lineTo(e.x + d, e.y + d); ctx.moveTo(e.x + d, e.y - d); ctx.lineTo(e.x - d, e.y + d); ctx.stroke();
    } else if (e.type === 'dmg') {
      ctx.globalAlpha = q * 0.8; ctx.strokeStyle = DEBUFF_COL; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 24, 0, TAU); ctx.stroke();
    } else if (e.type === 'slowAura' || e.type === 'healAura' || e.type === 'bomb') {
      const R = e.type === 'slowAura' ? 220 : e.type === 'healAura' ? 200 : 160, ease = easeOut(p);
      ctx.globalAlpha = q * (e.type === 'healAura' ? 0.3 : 0.55); ctx.strokeStyle = e.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, ease * R, 0, TAU); ctx.stroke();
      ctx.globalAlpha = q * 0.08; ctx.fillStyle = e.color; ctx.fill();
    } else if (e.type === 'chain') {
      ctx.globalAlpha = q * 0.9; ctx.strokeStyle = e.color; ctx.lineWidth = 1.6;
      const dx = e.x - e.fromX, dy = e.y - e.fromY, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      ctx.beginPath(); ctx.moveTo(e.fromX, e.fromY);
      for (let i = 1; i < 5; i++) { const j = (i % 2 ? 1 : -1) * 7; ctx.lineTo(e.fromX + dx * i / 5 + nx * j, e.fromY + dy * i / 5 + ny * j); }
      ctx.lineTo(e.x, e.y); ctx.stroke();
    } else if (e.type === 'heal') {
      ctx.globalAlpha = q * 0.85; ctx.strokeStyle = COLOR_HEX.green; ctx.lineWidth = 2;
      const y = e.y - 8 - p * 16;
      ctx.beginPath(); ctx.moveTo(e.x - 4.5, y); ctx.lineTo(e.x + 4.5, y); ctx.moveTo(e.x, y - 4.5); ctx.lineTo(e.x, y + 4.5); ctx.stroke();
    } else if (e.type === 'keyCollect') {
      ctx.globalAlpha = q * 0.8; ctx.strokeStyle = e.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); diamondPath(e.x, e.y, 9 + p * 16); ctx.stroke();
    }
    ctx.restore();
  }
}

function renderKeyDrops(t) {
  const v = visibleWorld(30);
  ctx.save();
  for (const k of keyDrops) {
    if (k.x < v.x0 || k.x > v.x1 || k.y < v.y0 || k.y > v.y1) continue;
    const bob = Math.sin(k.age * KEY_BOB_SPEED / 60 * TAU) * KEY_BOB_AMP;
    const col = COLOR_HEX[k.color], x = k.x, y = k.y + bob, sz = 8.5;
    const pulse = (t * 1.2 + k.age * 0.01) % 1;
    ctx.globalAlpha = (1 - pulse) * 0.45; ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); diamondPath(x, y, sz + 3 + pulse * 9); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = col;
    ctx.beginPath(); diamondPath(x, y, sz); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(x, y - sz * 0.6); ctx.lineTo(x + sz * 0.28, y - sz * 0.05); ctx.lineTo(x, y + sz * 0.1); ctx.lineTo(x - sz * 0.28, y - sz * 0.05); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function renderBeam(t) {
  const px = player.x, py = player.y, ex = connectedEnemy.x, ey = connectedEnemy.y;
  const flash = beamFlash > 0, N = 24, pts = [];
  const dx = ex - px, dy = ey - py, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (let i = 0; i <= N; i++) {
    const u = i / N, wob = Math.sin(u * Math.PI * 4 + t * 9) * 3.5 * Math.sin(u * Math.PI);
    pts.push({ x: px + dx * u + nx * wob, y: py + dy * u + ny * wob });
  }
  const col = COLOR_HEX[connectedEnemy.color] || CFG.KEY_COLOR;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.globalAlpha = 0.16; ctx.strokeStyle = col; ctx.lineWidth = 8; drawPath(pts);
  ctx.globalAlpha = 1; ctx.strokeStyle = flash ? (phantomMode ? '#fff' : INK) : col; ctx.lineWidth = flash ? 3.2 : 1.6; drawPath(pts);
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
  const ecol = colorVisible ? (COLOR_HEX[e.color] || INK) : '#8c9096';
  const r = e.r;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.crackShake > 0) ctx.translate((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 1.5);

  // ranged auras only near the player, where they matter
  if (cols.includes('green') && dist < 520) {
    ctx.globalAlpha = 0.16; ctx.strokeStyle = colorVisible ? COLOR_HEX.green : '#8c9096'; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.arc(0, 0, 200, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (cols.includes('purple') && dist < 340) {
    const near = clamp01(1 - (dist - 150) / 190);
    ctx.globalAlpha = 0.12 + 0.45 * near; ctx.strokeStyle = colorVisible ? COLOR_HEX.purple : '#8c9096'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (e.slowTimer > 0) {
    ctx.globalAlpha = Math.min(1, e.slowTimer / 180) * 0.7; ctx.strokeStyle = COLOR_HEX.blue; ctx.lineWidth = 1.2; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (state === State.IDLE && dist < 210) {
    ctx.globalAlpha = 0.14 + 0.08 * Math.sin(t * 3.5); ctx.strokeStyle = ecol; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r + 14, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const spr = enemySprite(cols, r, !colorVisible, focused);
  ctx.drawImage(spr.c, -spr.box / 2, -spr.box / 2, spr.box, spr.box);

  if (focused) { // target brackets
    const b = r + 7, l = 5;
    ctx.strokeStyle = ecol; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(sx * b, sy * (b - l)); ctx.lineTo(sx * b, sy * b); ctx.lineTo(sx * (b - l), sy * b);
    }
    ctx.stroke();
  }
  const lost = e.maxHp - e.hp;
  if (lost > 0) {
    ctx.strokeStyle = INK2; ctx.lineWidth = 0.9; ctx.beginPath();
    for (let i = 0; i < Math.min(lost, 6); i++) {
      const a = -(i / e.maxHp) * TAU - Math.PI * 0.5;
      ctx.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
      ctx.lineTo(Math.cos(a + 0.35) * r * 0.88, Math.sin(a + 0.35) * r * 0.88);
    }
    ctx.stroke();
  }
  // HP pips, batched per colour
  const pr = r + 7, maxHp = e.maxHp, hp = Math.min(Math.max(0, e.hp), maxHp);
  const pip = (i, rad) => { const a = -(i / maxHp) * TAU - Math.PI * 0.5, x = Math.cos(a) * pr, y = Math.sin(a) * pr; ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, TAU); };
  if (cols.length === 1 || !colorVisible) {
    ctx.fillStyle = colorVisible ? COLOR_HEX[cols[0]] : '#6c7076';
    ctx.beginPath(); for (let i = 0; i < hp; i++) pip(i, 2.2); ctx.fill();
  } else {
    for (let ci = 0; ci < cols.length; ci++) {
      ctx.fillStyle = COLOR_HEX[cols[ci]];
      ctx.beginPath(); for (let i = ci; i < hp; i += cols.length) pip(i, 2.2); ctx.fill();
    }
  }
  if (hp < maxHp) {
    ctx.fillStyle = 'rgba(140,144,150,0.45)';
    ctx.beginPath(); for (let i = Math.ceil(hp); i < maxHp; i++) pip(i, 1.4); ctx.fill();
  }
  ctx.restore();
}

const mochi = { sq: 0, sqv: 0, pvx: 0, pvy: 0, kickA: 0, lx: 0, ly: 0 };
function renderPlayer(t) {
  const r = player.r, ph = phantomMode;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invincible > 0 && Math.floor(player.invincible / 3) % 2 === 1) ctx.globalAlpha = 0.35;
  if (player.hitFlash > 0) {
    ctx.save(); ctx.globalAlpha *= (player.hitFlash / 22) * 0.5; ctx.fillStyle = DEBUFF_COL;
    ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, TAU); ctx.fill(); ctx.restore();
  }
  // もちもち: a spring squash kicked by sudden velocity changes, stretch with speed, idle breathing
  const spd = Math.hypot(player.vx, player.vy);
  const dvx = player.vx - mochi.pvx, dvy = player.vy - mochi.pvy, dv = Math.hypot(dvx, dvy);
  if (dv > 0.8) { mochi.sqv += Math.min(dv, 10) * 0.022; mochi.kickA = Math.atan2(dvy, dvx); }
  mochi.pvx = player.vx; mochi.pvy = player.vy;
  mochi.sqv += -mochi.sq * 0.22; mochi.sqv *= 0.8; mochi.sq += mochi.sqv;
  const st = Math.min(spd / CFG.MAX_SPEED, 1) * 0.2;
  const along = spd > 0.4 ? Math.atan2(player.vy, player.vx) : mochi.kickA;
  const breathe = spd < 0.4 ? Math.sin(t * 2.4) * 0.03 : 0;
  ctx.save();
  ctx.rotate(along);
  ctx.scale(1 + st + mochi.sq, Math.max(0.6, 1 - st * 0.55 - mochi.sq * 0.7));
  ctx.rotate(-along);
  ctx.scale(1 - breathe * 0.5, 1 + breathe);
  ctx.beginPath();
  for (let i = 0; i <= 36; i++) {
    const a = i / 36 * TAU;
    const rr = r * (1 + 0.045 * Math.sin(a * 3 + t * 5) + 0.03 * Math.sin(a * 5 - t * 3.3));
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = ph ? '#e9fffb' : '#1a1a1a'; ctx.fill();

  // 視線: thread target, else travel direction, else the nearest lock in view
  let tx = 0, ty = 0;
  if (connectedEnemy) { const a = Math.atan2(connectedEnemy.y - player.y, connectedEnemy.x - player.x); tx = Math.cos(a); ty = Math.sin(a); }
  else if (spd > 0.6) { tx = player.vx / spd; ty = player.vy / spd; }
  else {
    let best = null, bd = 260;
    for (const e of enemies) { if (!e.alive) continue; const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < bd) { bd = d; best = e; } }
    if (best) { const a = Math.atan2(best.y - player.y, best.x - player.x); tx = Math.cos(a) * 0.8; ty = Math.sin(a) * 0.8; }
  }
  mochi.lx += (tx - mochi.lx) * 0.18; mochi.ly += (ty - mochi.ly) * 0.18;
  const lx = mochi.lx * r * 0.14, ly = mochi.ly * r * 0.12;
  const blink = player.hitFlash > 0 || (t % 3.7) < 0.12;
  const white = ph ? BG_PH : '#ffffff', pupil = ph ? '#e9fffb' : '#1a1a1a';
  for (const sx of [-1, 1]) {
    const ex = sx * r * 0.36 + lx, ey = -r * 0.1 + ly;
    if (blink) {
      ctx.strokeStyle = white; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - r * 0.16, ey); ctx.lineTo(ex + r * 0.16, ey); ctx.stroke();
    } else {
      ctx.fillStyle = white;
      ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.17, r * 0.23, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pupil;
      ctx.beginPath(); ctx.arc(ex + mochi.lx * r * 0.07, ey + mochi.ly * r * 0.09, r * 0.085, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();

  const slot = activeSlot(), dX = r * 0.72, dY = -r * 0.72, dR = r * 0.28;
  if (slot.colors.length > 1 && slot.dur > 0) {
    const g = ctx.createLinearGradient(dX - dR, dY, dX + dR, dY);
    slot.colors.forEach((c, i) => g.addColorStop(i / (slot.colors.length - 1), COLOR_HEX[c]));
    ctx.fillStyle = g;
  } else ctx.fillStyle = slot.dur > 0 ? (COLOR_HEX[slot.colors[0]] || CFG.KEY_COLOR) : '#8c9096';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(dX, dY, dR, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function orbColor(orb, t) {
  if (orb.type === 'paint') return `hsl(${Math.round((t * 40) % 360)},85%,58%)`;
  if (orb.type === 'normal') return RARITY_COLOR[orb.rarity];
  return { fusion: '#e0b43a', enemy_boost: '#ff5a1f', infection: '#b044d8', phantom: '#2fd8bd' }[orb.type] || '#888';
}
function drawOrbGlyph(x, y, orb, t, size, alpha = 1) {
  const col = orbColor(orb, t);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = col;
  ctx.beginPath(); diamondPath(x, y, size, 0.78); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = fnt(Math.round(size * 0.82), 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ORB_CHAR[orb.type] || '刻', x, y + size * 0.06);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
  return col;
}
function renderInscriptionOrbs(t) {
  const v = visibleWorld(50);
  for (const orb of inscriptionOrbs) {
    if (orb.x < v.x0 || orb.x > v.x1 || orb.y < v.y0 || orb.y > v.y1) continue;
    const pulse = Math.sin(t * 3.2 + (orb.pulse || 0) * 0.05) * 0.5 + 0.5;
    const col = orbColor(orb, t);
    ctx.save();
    ctx.translate(orb.x, orb.y);
    ctx.strokeStyle = col; ctx.lineWidth = 1.2;
    if (orb.type === 'fusion') {
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = COLOR_HEX[COLORS[i]]; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(0, 0, 22, i * TAU / 5 + t * 1.1, (i + 0.72) * TAU / 5 + t * 1.1); ctx.stroke();
      }
    } else {
      ctx.globalAlpha = 0.35 + pulse * 0.4;
      ctx.beginPath(); ctx.arc(0, 0, 20 + pulse * 4, 0, TAU); ctx.stroke();
      if (orb.type !== 'normal') {
        ctx.globalAlpha = 0.7; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;
    drawOrbGlyph(0, 0, orb, t, orb.type === 'normal' ? 11 : 12.5);
    ctx.restore();
  }
}

// ══════════════════════════════════════════════
//  FRAME
// ══════════════════════════════════════════════
function render() {
  const w = W(), h = H(), t = performance.now() / 1000;
  RM = getMods();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = phantomMode ? BG_PH : BG;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  const scale = viewScale();
  if (scale !== 1) { ctx.translate(w / 2, h / 2); ctx.scale(scale, scale); ctx.translate(-w / 2, -h / 2); }
  ctx.translate(-cam.x, -cam.y);
  drawGrid();
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

  if (activePaints.length > 0 && !phantomMode) renderPaintLayers(t);
  if (phantomMode) {
    ctx.save(); ctx.globalAlpha = 0.18;
    ctx.fillStyle = `hsl(${Math.round((t * 25) % 360)}, 85%, 55%)`;
    ctx.fillRect(0, 0, w, h); ctx.restore();
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

// ══════════════════════════════════════════════
//  INDICATORS
// ══════════════════════════════════════════════
function renderEdgeIndicators() {
  const margin = 20, sz = 7, v = visibleWorld(-6), byCol = new Map();
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.x > v.x0 && e.x < v.x1 && e.y > v.y0 && e.y < v.y1) continue;
    const col = RM.enemyColorFarHide > 0 ? '#8c9096' : (COLOR_HEX[e.color] || INK);
    let arr = byCol.get(col); if (!arr) byCol.set(col, arr = []);
    arr.push(e);
  }
  ctx.save(); ctx.globalAlpha = 0.85;
  for (const [col, arr] of byCol) {
    ctx.fillStyle = col; ctx.beginPath();
    for (const e of arr) {
      const a = Math.atan2(e.y - player.y, e.x - player.x), { x, y } = screenEdgePoint(a, margin);
      const c = Math.cos(a), s = Math.sin(a);
      ctx.moveTo(x + c * sz, y + s * sz);
      ctx.lineTo(x - c * sz * 0.6 + s * sz * 0.65, y - s * sz * 0.6 - c * sz * 0.65);
      ctx.lineTo(x - c * sz * 0.6 - s * sz * 0.65, y - s * sz * 0.6 + c * sz * 0.65);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.restore();
}
function renderInscriptionEdgeIndicators(t) {
  for (const orb of inscriptionOrbs) {
    if (Math.hypot(orb.x - player.x, orb.y - player.y) < 350) continue;
    const angle = Math.atan2(orb.y - player.y, orb.x - player.x), { x, y } = screenEdgePoint(angle, 48);
    const pulse = 0.75 + 0.25 * Math.sin(t * 3.8 + (orb.pulse || 0) * 0.05);
    ctx.save(); ctx.translate(x, y);
    panelRect(-19, -17, 38, 34, 5);
    const col = drawOrbGlyph(0, -4, orb, t, 8.5, pulse);
    ctx.fillStyle = WHITE2; ctx.font = fnt(8, 700); ctx.textAlign = 'center';
    ctx.fillText(ORB_TAG[orb.type] || '刻印', 0, 13);
    ctx.fillStyle = col; ctx.translate(Math.cos(angle) * 24, Math.sin(angle) * 24); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-2, -3.5); ctx.lineTo(-2, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ══════════════════════════════════════════════
//  UNLOCK DIAL
// ══════════════════════════════════════════════
function renderCircularUI(t) {
  const ps = playerScreenPos(), cx = ps.x, cy = ps.y, R = CFG.INNER_R;
  const shakeX = uiShake > 0 ? Math.sin(uiShake * 1.8) * (uiShake / 10) * 5 : 0;
  const _slot = activeSlot();
  const keyCol = _slot.dur > 0 ? (COLOR_HEX[_slot.colors[0]] || CFG.KEY_COLOR) : '#8c9096';
  ctx.save(); ctx.translate(shakeX, 0);
  ctx.strokeStyle = phantomMode ? 'rgba(255,255,255,0.35)' : INK3; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * TAU, l = i % 4 === 0 ? 6 : 3;
    ctx.moveTo(cx + Math.cos(a) * (R + 5), cy + Math.sin(a) * (R + 5));
    ctx.lineTo(cx + Math.cos(a) * (R + 5 + l), cy + Math.sin(a) * (R + 5 + l));
  }
  ctx.stroke();
  const dashOff = -(t * 0.55 % 1) * 20;
  ctx.lineWidth = 3;
  if (_slot.colors.length > 1 && _slot.dur > 0) {
    const seg = TAU / _slot.colors.length;
    _slot.colors.forEach((c, i) => { ctx.strokeStyle = COLOR_HEX[c]; ctx.setLineDash([13, 7]); ctx.lineDashOffset = dashOff - i * 20; ctx.beginPath(); ctx.arc(cx, cy, R, i * seg, (i + 1) * seg); ctx.stroke(); });
  } else {
    ctx.strokeStyle = keyCol; ctx.setLineDash([13, 7]); ctx.lineDashOffset = dashOff;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.globalAlpha = 0.12; ctx.fillStyle = keyCol;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  if (connectedEnemy) {
    const q = connectedEnemy.angleQueue, hasKey = _slot.dur > 0;
    const eCols = connectedEnemy.colors || [connectedEnemy.color];
    const dmg = (hasKey && _slot.colors.some(c => eCols.includes(c))) ? 2 : 1;
    const show = Math.min(Math.ceil(connectedEnemy.hp / dmg), Math.max(1, 3 - Math.round(RM.predictArrowSub)));
    const tol = Math.max(5 * Math.PI / 180, CFG.UNLOCK_TOLERANCE + RM.flickTolerance);
    const ghostAlpha = ghostTimer > 0 ? Math.min(ghostTimer / 25, 1) : 0.55;
    const ac2 = _slot.dur > 0 && _slot.colors.length > 1 ? _slot.colors.map(c => COLOR_HEX[c]) : null;
    if (show >= 3 && q.length > 2) { ctx.globalAlpha = 0.22; renderDirectionGuide(cx, cy, q[2], keyCol, 2, tol, ac2); }
    if (show >= 2 && q.length > 1) { ctx.globalAlpha = 0.48; renderDirectionGuide(cx, cy, q[1], keyCol, 3, tol, ac2); }
    ctx.globalAlpha = ghostAlpha; renderDirectionGuide(cx, cy, q[0], keyCol, 4.5, tol, ac2); ctx.globalAlpha = 1;
  }
  if (RM.cannotEscape > 0) { ctx.fillStyle = DEBUFF_COL; ctx.font = fnt(10, 700); ctx.textAlign = 'center'; ctx.fillText('離脱不可', cx, cy + R + 26); }
  ctx.restore();
}
function renderDirectionGuide(cx, cy, angle, color, lineW = 4, tol = CFG.UNLOCK_TOLERANCE, colors = null) {
  const R = CFG.INNER_R, OR = CFG.OUTER_R;
  const ex = cx + Math.cos(angle) * OR * 0.88, ey = cy + Math.sin(angle) * OR * 0.88;
  const sx = cx + Math.cos(angle) * R * 0.25, sy = cy + Math.sin(angle) * R * 0.25;
  const useGrad = colors && colors.length > 1, safeTol = Math.max(5 * Math.PI / 180, tol), base = ctx.globalAlpha;
  const paint = (x0, y0, x1, y1) => { if (!useGrad) return color; const g = ctx.createLinearGradient(x0, y0, x1, y1); colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c)); return g; };
  ctx.save();
  ctx.globalAlpha = base * 0.28;
  ctx.fillStyle = paint(cx + Math.cos(angle - safeTol) * OR, cy + Math.sin(angle - safeTol) * OR, cx + Math.cos(angle + safeTol) * OR, cy + Math.sin(angle + safeTol) * OR);
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle - safeTol) * R, cy + Math.sin(angle - safeTol) * R);
  ctx.arc(cx, cy, OR * 0.85, angle - safeTol, angle + safeTol);
  ctx.arc(cx, cy, R, angle + safeTol, angle - safeTol, true);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = paint(sx, sy, ex, ey); ctx.lineWidth = lineW; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex - Math.cos(angle) * 6, ey - Math.sin(angle) * 6); ctx.stroke();
  const hw = Math.PI / 6, hs = 9 + lineW * 2.2;
  ctx.fillStyle = useGrad ? colors[colors.length - 1] : color;
  ctx.beginPath(); ctx.moveTo(ex, ey);
  ctx.lineTo(ex - Math.cos(angle - hw) * hs, ey - Math.sin(angle - hw) * hs);
  ctx.lineTo(ex - Math.cos(angle + hw) * hs, ey - Math.sin(angle + hw) * hs);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ══════════════════════════════════════════════
//  KEY PANEL
// ══════════════════════════════════════════════
function keyPanelSlots() {
  const w = W(), h = H(), spacing = 68, n = keySlots.length, totalW = Math.max(0, n - 1) * spacing;
  return keySlots.map((slot, i) => ({ slot, idx: i, cx: w / 2 - totalW / 2 + i * spacing, cy: h - 62, r: 28 }));
}
function renderKeyPanel(t) {
  const slots = keyPanelSlots();
  if (!slots.length) return;
  const panelY = H() - 62, DUR_MAX = 24;
  const x0 = slots[0].cx - 40, pw = slots[slots.length - 1].cx - slots[0].cx + 80;
  ctx.save();
  panelRect(x0, panelY - 38, pw, 84, 14);
  for (const s of slots) {
    const slot = s.slot, dur = slot.dur, cols = slot.colors;
    const active = s.idx === selectedSlotIdx, hasKey = dur > 0, fused = cols.length > 1;
    const prim = COLOR_HEX[cols[0]], drawCol = active && !hasKey ? '#8c9096' : prim;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r - 5, 0, TAU); ctx.stroke();
    if (hasKey) {
      const a0 = -Math.PI / 2, a1 = a0 + TAU * Math.min(dur / DUR_MAX, 1);
      ctx.globalAlpha = active ? 1 : 0.6; ctx.lineWidth = 2;
      if (fused) { const seg = (a1 - a0) / cols.length; cols.forEach((c, i) => { ctx.strokeStyle = COLOR_HEX[c]; ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r - 5, a0 + i * seg, a0 + (i + 1) * seg); ctx.stroke(); }); }
      else { ctx.strokeStyle = prim; ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r - 5, a0, a1); ctx.stroke(); }
    }
    if (active) {
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r, 0, TAU); ctx.stroke();
      ctx.fillStyle = drawCol;
      ctx.beginPath(); ctx.moveTo(s.cx - 4, s.cy - s.r - 7); ctx.lineTo(s.cx + 4, s.cy - s.r - 7); ctx.lineTo(s.cx, s.cy - s.r - 2.5); ctx.closePath(); ctx.fill();
    }
    if (hasKey) {
      if (fused) {
        const orbit = cols.length <= 2 ? 7 : 9;
        cols.forEach((c, i) => { const a = i / cols.length * TAU - Math.PI / 2; ctx.globalAlpha = active ? 1 : 0.7; ctx.fillStyle = COLOR_HEX[c]; ctx.beginPath(); ctx.arc(s.cx + Math.cos(a) * orbit, s.cy + Math.sin(a) * orbit, 4, 0, TAU); ctx.fill(); });
      } else {
        ctx.globalAlpha = active ? 1 : 0.7; ctx.fillStyle = prim;
        ctx.beginPath(); diamondPath(s.cx, s.cy, active ? 10 : 8.5); ctx.fill();
      }
      ctx.globalAlpha = active ? 1 : 0.6;
      ctx.fillStyle = dur <= CFG.DUR_COST_NORMAL ? DEBUFF_COL : '#fff'; ctx.font = fnt(10, 700); ctx.textAlign = 'center';
      ctx.fillText(dur, s.cx, s.cy + s.r + 6);
    } else {
      ctx.globalAlpha = 0.3; ctx.strokeStyle = drawCol; ctx.lineWidth = 1;
      ctx.beginPath(); diamondPath(s.cx, s.cy, 7); ctx.stroke();
    }
  }
  ctx.restore();
}

// ══════════════════════════════════════════════
//  HUD
// ══════════════════════════════════════════════
function pauseButtonBounds() { return { x: 12, y: 12, w: 36, h: 36 }; }
function renderHUD(w, h, t) {
  const ph = phantomMode, txt = ph ? '#e9fffb' : INK, txt2 = ph ? 'rgba(233,255,251,0.6)' : INK2;
  const pb = pauseButtonBounds();
  panelRect(pb.x, pb.y, pb.w, pb.h, 6);
  ctx.fillStyle = '#fff'; ctx.fillRect(pb.x + 12, pb.y + 11, 3.5, 14); ctx.fillRect(pb.x + 20.5, pb.y + 11, 3.5, 14);

  const maxHp = Math.max(1, CFG.PLAYER_HP_MAX + RM.maxHpBonus - RM.maxHpMalus);
  const ratio = clamp01(player.hp / maxHp);
  const bx = pb.x + pb.w + 12, bw = Math.max(80, Math.min(240, w - bx - 110)), by = 19, bh = 4;
  ctx.fillStyle = ph ? 'rgba(255,255,255,0.14)' : '#dfe2e6'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = ratio > 0.5 ? BUFF_COL : ratio > 0.25 ? '#ddb830' : DEBUFF_COL; ctx.fillRect(bx, by, bw * ratio, bh);
  if (maxHp <= 24) {
    ctx.fillStyle = ph ? BG_PH : BG;
    for (let i = 1; i < maxHp; i++) ctx.fillRect(bx + bw * i / maxHp - 0.5, by, 1, bh);
  }
  ctx.fillStyle = txt2; ctx.font = fnt(10, 600); ctx.textAlign = 'left';
  ctx.fillText(`HP ${player.hp.toFixed(1)} / ${maxHp}`, bx, by + bh + 13);

  ctx.textAlign = 'right';
  ctx.fillStyle = txt2; ctx.font = fnt(9, 700); ctx.fillText('解錠', w - 14, 18);
  ctx.fillStyle = txt; ctx.font = fnt(24, 700); ctx.fillText(score, w - 14, 41);
  let ry = 55;
  ctx.font = fnt(10, 600); ctx.fillStyle = txt2;
  if (highScore > 0) { ctx.fillText(`BEST ${highScore}`, w - 14, ry); ry += 13; }
  if (!phantomMode && nextOrbAt - killCount > 0) ctx.fillText(`次の刻印 ${nextOrbAt - killCount}`, w - 14, ry);

  ctx.textAlign = 'left';
  let ly = 66;
  const s = Math.floor(gameTime);
  ctx.fillStyle = txt; ctx.font = fnt(13, 700);
  ctx.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, 14, ly); ly += 15;
  ctx.fillStyle = txt2; ctx.font = fnt(10, 600);
  ctx.fillText(`敵 ×${enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0)}`, 14, ly); ly += 14;
  if (activeInscriptions.length > 0) { ctx.fillStyle = RARITY_COLOR.epic; ctx.fillText(`刻印 ×${activeInscriptions.length}`, 14, ly); ly += 14; }
  if (enemyBoostStacks > 0) { ctx.fillStyle = '#ff5a1f'; ctx.fillText(`敵増 ×${enemyBoostStacks}  頻×${Math.pow(1.3, enemyBoostStacks).toFixed(enemyBoostStacks > 20 ? 0 : 1)}`, 14, ly); ly += 14; }
  if (endlessMode) { ctx.fillStyle = txt2; ctx.fillText(`着彩 ${activePaints.length}/3`, 14, ly); }

  if (combo >= 2) {
    const cy = by + 46;
    ctx.save();
    ctx.globalAlpha = Math.min(1, combo / 4); ctx.textAlign = 'center';
    ctx.fillStyle = `hsl(${Math.min(60, combo * 4)}, 90%, ${ph ? 62 : 50}%)`;
    ctx.font = fnt(20 + Math.min(combo, 30) * 0.5, 700);
    ctx.fillText(combo, w / 2, cy);
    ctx.fillStyle = txt2; ctx.font = fnt(9, 700); ctx.fillText('COMBO', w / 2, cy + 12);
    ctx.restore();
  }
}

// ══════════════════════════════════════════════
//  ANNOUNCE — "Tap & Flick" style
// ══════════════════════════════════════════════
function renderOrbAnnounce(w, h, t) {
  const a = orbAnnounce;
  const alpha = Math.min(1, a.age / 10) * (a.age > a.maxAge - 22 ? (a.maxAge - a.age) / 22 : 1);
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.fillStyle = `rgba(8,9,12,${0.72 * alpha})`; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = alpha;
  const size = Math.round(Math.min(w, h) * 0.1);
  ctx.font = fnt(size, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(a.label).width;
  ctx.fillStyle = a.color; ctx.fillText(a.label, cx, cy);
  const lw = (tw / 2 + 24) * easeOut(a.age / 14);
  ctx.strokeStyle = a.color; ctx.lineWidth = 1; ctx.globalAlpha = alpha * 0.7;
  ctx.beginPath(); ctx.moveTo(cx - lw, cy - size * 0.78); ctx.lineTo(cx + lw, cy - size * 0.78);
  ctx.moveTo(cx - lw, cy + size * 0.78); ctx.lineTo(cx + lw, cy + size * 0.78); ctx.stroke();
  if (a.sub) {
    ctx.globalAlpha = alpha * 0.75; ctx.fillStyle = '#fff'; ctx.font = fnt(13, 600);
    ctx.fillText(a.sub, cx, cy + size * 0.78 + 18);
  }
  ctx.restore();
}

// ══════════════════════════════════════════════
//  DRAFTS
// ══════════════════════════════════════════════
function draftReady(openedAt) { return clamp01((performance.now() - openedAt) / 700); }
function header(text, y, col = '#fff', size = 18) {
  ctx.fillStyle = col; ctx.font = fnt(size, 700); ctx.textAlign = 'center'; ctx.fillText(text, W() / 2, y);
}
function renderDraft(w, h, t) {
  if (infectedMode && draftChoices.length > 0 && Array.isArray(draftChoices[0])) { renderInfectedDraft(w, h, t); return; }
  dim(0.76);
  header('刻印を選択', h / 2 - 176);
  const bounds = draftCardBounds(w, h), ready = draftReady(draftOpenedAt);
  bounds.slice(0, 3).forEach((b, i) => {
    const ins = draftChoices[i]; if (!ins) return;
    const rc = RARITY_COLOR[ins.rarity], cx = b.x + b.w / 2;
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.55 * ready;
    panelRect(b.x, b.y, b.w, b.h, 6, hexA(rc.length === 4 ? '#aaaaaa' : rc, 0.8));
    ctx.fillStyle = rc; ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 2);
    ctx.font = fnt(10, 700); ctx.textAlign = 'center'; ctx.fillText(ins.rarity.toUpperCase(), cx, b.y + 22);
    ctx.beginPath(); diamondPath(cx, b.y + 50, 12); ctx.fill();
    ctx.fillStyle = BUFF_COL; ctx.font = fnt(10, 700); ctx.fillText('▲ 強化', cx, b.y + 92);
    ctx.fillStyle = '#fff'; ctx.font = fnt(12, 600); wrapText(ctx, ins.buff.label, cx, b.y + 112, b.w - 18, 16);
    ctx.fillStyle = DEBUFF_COL; ctx.font = fnt(10, 700); ctx.fillText('▼ 代償', cx, b.y + 170);
    ctx.fillStyle = '#fff'; ctx.font = fnt(12, 600); wrapText(ctx, ins.debuff.label, cx, b.y + 190, b.w - 18, 16);
    ctx.restore();
  });
  textBtn(bounds[3], '見送る（鍵を補充）', WHITE2, PANEL_LINE, 12);
  if (activeInscriptions.length > 0) { ctx.fillStyle = WHITE3; ctx.font = fnt(10, 600); ctx.textAlign = 'center'; ctx.fillText(`刻印 ×${activeInscriptions.length}`, w / 2, h - 40); }
}
function renderInfectedDraft(w, h, t) {
  ctx.fillStyle = 'rgba(14,3,22,0.84)'; ctx.fillRect(0, 0, w, h);
  header('刻印感染 ×5', h / 2 - 190, '#cc66ff');
  const bounds = draftCardBounds(w, h), ready = draftReady(draftOpenedAt);
  bounds.slice(0, 3).forEach((b, i) => {
    const bundle = draftChoices[i]; if (!bundle) return;
    ctx.save(); ctx.globalAlpha = 0.45 + 0.55 * ready;
    panelRect(b.x, b.y, b.w, b.h, 6, 'rgba(176,68,216,0.7)');
    const lineH = (b.h - 24) / 5;
    bundle.forEach((ins, j) => {
      const ry = b.y + 14 + j * lineH;
      ctx.fillStyle = RARITY_COLOR[ins.rarity]; ctx.fillRect(b.x + 7, ry + lineH / 2 - 8, 2, 16);
      ctx.textAlign = 'left'; ctx.font = fnt(9, 600);
      ctx.fillStyle = BUFF_COL; ctx.fillText(`▲ ${ins.buff.label}`, b.x + 14, ry + lineH / 2 - 2);
      ctx.fillStyle = DEBUFF_COL; ctx.fillText(`▼ ${ins.debuff.label}`, b.x + 14, ry + lineH / 2 + 10);
    });
    ctx.restore();
  });
  textBtn(bounds[3], '見送る（鍵を補充）', WHITE2, PANEL_LINE, 12);
}
function renderFusionSelect(w, h, t) {
  dim(0.66);
  const cx = w / 2, pw = Math.min(340, w - 24);
  panelRect(cx - pw / 2, 52, pw, 74, 6, 'rgba(224,180,58,0.6)');
  ctx.fillStyle = '#e0b43a'; ctx.font = fnt(16, 700); ctx.textAlign = 'center'; ctx.fillText('色融合', cx, 82);
  const label = s => s ? s.colors.map(c => COLOR_NAME[c] || c).join('+') : '?';
  const fs = keyPanelSlots();
  const ring = (idx, col, ph2) => { const s = fs.find(f => f.idx === idx); if (!s) return; ctx.save(); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 5 + ph2); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r + 10, 0, TAU); ctx.stroke(); ctx.restore(); };
  if (fusionSlotB !== -1) {
    const sA = keySlots[fusionSlotA], sB = keySlots[fusionSlotB];
    const merged = sA && sB ? [...new Set([...sA.colors, ...sB.colors])] : [];
    ctx.fillStyle = '#fff'; ctx.font = fnt(13, 600);
    ctx.fillText(`${label(sA)} ＋ ${label(sB)} → ${merged.map(c => COLOR_NAME[c]).join('+')}`, cx, 108);
    const cw = 260, ch = 70, cy0 = h / 2 - 50;
    panelRect(cx - cw / 2, cy0, cw, ch, 6);
    const sp = Math.min(44, (cw - 40) / Math.max(merged.length, 1)), sx0 = cx - sp * (merged.length - 1) / 2;
    merged.forEach((c, i) => { ctx.fillStyle = COLOR_HEX[c]; ctx.beginPath(); diamondPath(sx0 + i * sp, cy0 + ch / 2, 13); ctx.fill(); });
    const btn = fusionConfirmBounds(w, h);
    textBtn(btn.confirm, '融合', '#e0b43a', 'rgba(224,180,58,0.7)', 15);
    textBtn(btn.cancel, '選び直す', WHITE2, PANEL_LINE, 14);
    ring(fusionSlotA, '#e0b43a', 0); ring(fusionSlotB, '#fff', Math.PI);
  } else {
    ctx.fillStyle = '#fff'; ctx.font = fnt(13, 600);
    ctx.fillText(fusionSlotA === -1 ? '1本目の鍵をタップ' : `${label(keySlots[fusionSlotA])} ＋ 2本目をタップ`, cx, 108);
    if (fusionSlotA !== -1) ring(fusionSlotA, '#e0b43a', 0);
  }
}
function renderPaintDraft(w, h, t) {
  dim(0.74);
  header('着彩刻印', h / 2 - 126);
  const ready = draftReady(paintDraftOpenedAt), { cards, skip, reset } = paintDraftAllBounds(w, h);
  for (const b of cards) {
    const p = paintDraftChoices[b.index]; if (!p) continue;
    ctx.save(); ctx.globalAlpha = 0.45 + 0.55 * ready;
    panelRect(b.x, b.y, b.w, b.h, 6);
    ctx.save(); ctx.beginPath(); ctx.rect(b.x + 10, b.y + 12, b.w - 20, 26); ctx.clip();
    drawPaintColorBar(b.x + 10, b.y + 12, b.w - 20, 26, p.pair); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = fnt(22, 700); ctx.textAlign = 'center'; ctx.fillText(p.pair.name, b.x + b.w / 2, b.y + 84);
    ctx.fillStyle = WHITE2; ctx.font = fnt(12, 600); ctx.fillText(`${p.blend.char}/${p.motion.char}/${p.density.char}`, b.x + b.w / 2, b.y + 106);
    ctx.restore();
  }
  textBtn(skip, '選ばない', WHITE2, PANEL_LINE, 13);
  textBtn(reset, '着彩リセット', '#ff8a80', 'rgba(232,69,60,0.5)', 13);
}

// ══════════════════════════════════════════════
//  PAUSE / GAME OVER / TITLE
// ══════════════════════════════════════════════
function pauseLayout(w, h) {
  const cx = w / 2, cardW = Math.min(w - 32, 300), cardH = 400, cardX = cx - cardW / 2, cardY = h / 2 - cardH / 2;
  return { cx, cardW, cardH, cardX, cardY,
    resume: { x: cx - 90, y: cardY + 70, w: 180, h: 44 },
    reset:  { x: cx - 90, y: cardY + 126, w: 180, h: 44 },
    hints:  { x: cx - 70, y: cardY + cardH - 44, w: 140, h: 28 } };
}
function renderPause(w, h, t) {
  dim(0.78);
  const L = pauseLayout(w, h);
  panelRect(L.cardX, L.cardY, L.cardW, L.cardH, 8);
  ctx.fillStyle = '#fff'; ctx.font = fnt(20, 700); ctx.textAlign = 'center'; ctx.fillText('PAUSE', L.cx, L.cardY + 44);
  textBtn(L.resume, '再開', BUFF_COL, 'rgba(61,184,106,0.6)', 15);
  textBtn(L.reset, 'リセット', '#ff8a80', 'rgba(232,69,60,0.5)', 15);
  ctx.strokeStyle = PANEL_LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(L.cardX + 20, L.cardY + 192); ctx.lineTo(L.cardX + L.cardW - 20, L.cardY + 192); ctx.stroke();
  const rows = [['TAP', '敵に接続 ／ 停止'], ['FLICK', '移動'], ['円内 FLICK', '解錠'], ['円外 FLICK', '離脱'], ['鍵 TAP', '鍵を持ち替え']];
  if (phantomOrbPickedUp) rows.push(['HOLD', '幻影切替']);
  rows.forEach(([k, v], i) => {
    const y = L.cardY + 216 + i * 21;
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = fnt(11, 700); ctx.fillText(k, L.cardX + 24, y);
    ctx.textAlign = 'right'; ctx.fillStyle = WHITE2; ctx.font = fnt(11, 600); ctx.fillText(v, L.cardX + L.cardW - 24, y);
  });
  const traits = [['red', '基本'], ['blue', '硬い'], ['yellow', '速い'], ['green', '回復'], ['purple', '爆発']];
  const tw = (L.cardW - 32) / 5, ty = L.cardY + L.cardH - 70;
  traits.forEach(([c, tr], i) => {
    const tx = L.cardX + 16 + tw * i + tw / 2;
    ctx.fillStyle = COLOR_HEX[c]; ctx.beginPath(); diamondPath(tx - 14, ty - 4, 5); ctx.fill();
    ctx.fillStyle = WHITE2; ctx.font = fnt(10, 600); ctx.textAlign = 'left'; ctx.fillText(tr, tx - 6, ty);
  });
  ctx.fillStyle = WHITE3; ctx.font = fnt(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ヒント再表示', L.hints.x + L.hints.w / 2, L.hints.y + L.hints.h / 2);
  ctx.textBaseline = 'alphabetic';
}
function renderGameOver(w, h, t) {
  const res = lastResult || { score, killCount, maxCombo, gameTime };
  dim(0.8);
  const cx = w / 2, cardW = Math.min(w - 48, 300), cardH = 300, cardX = cx - cardW / 2, cardY = h / 2 - cardH / 2;
  panelRect(cardX, cardY, cardW, cardH, 8);
  ctx.fillStyle = DEBUFF_COL; ctx.font = fnt(26, 700); ctx.textAlign = 'center'; ctx.fillText('GAME OVER', cx, cardY + 46);
  const isNewBest = res.killCount >= highScore && res.killCount > 0;
  if (isNewBest) { ctx.fillStyle = '#ddb830'; ctx.font = fnt(10, 700); ctx.fillText('NEW BEST', cx, cardY + 64); }
  const s = Math.floor(res.gameTime);
  const stats = [['生存時間', s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`], ['解錠', `${res.killCount}`, isNewBest], ['MAX COMBO', `${res.maxCombo}`], ['刻印', `${res.inscriptions || 0}`], ['BEST', `${highScore}`, false, true]];
  stats.forEach(([l, v, hi, dm], i) => {
    const ry = cardY + 98 + i * 34;
    ctx.textAlign = 'left'; ctx.fillStyle = dm ? WHITE3 : WHITE2; ctx.font = fnt(11, 600); ctx.fillText(l, cardX + 26, ry);
    ctx.textAlign = 'right'; ctx.fillStyle = hi ? '#ddb830' : dm ? WHITE2 : '#fff'; ctx.font = fnt(dm ? 15 : 20, 700); ctx.fillText(v, cardX + cardW - 26, ry);
  });
  const hold = gameOverHoldStart > 0 ? Math.min(1, (performance.now() - gameOverHoldStart) / GAMEOVER_HOLD_MS) : 0;
  const hy = cardY + cardH - 26;
  ctx.strokeStyle = WHITE3; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx - 50, hy - 4, 7, 0, TAU); ctx.stroke();
  if (hold > 0) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 50, hy - 4, 7, -Math.PI / 2, -Math.PI / 2 + hold * TAU); ctx.stroke(); }
  ctx.fillStyle = hold > 0 ? '#fff' : WHITE2; ctx.font = fnt(12, 600); ctx.textAlign = 'left'; ctx.fillText('長押しで再開', cx - 36, hy);
}
function renderTitle(w, h, t) {
  ctx.fillStyle = 'rgba(246,247,248,0.94)'; ctx.fillRect(0, 0, w, h);
  const cy = h * 0.42;
  ctx.textAlign = 'center';
  ctx.fillStyle = INK; ctx.font = fnt(Math.min(56, w * 0.14), 700); ctx.fillText('CroqKey', w / 2, cy);
  const lw = 70;
  ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w / 2 - lw, cy + 18); ctx.lineTo(w / 2 + lw, cy + 18); ctx.stroke();
  COLORS.forEach((c, i) => { ctx.fillStyle = COLOR_HEX[c]; ctx.beginPath(); diamondPath(w / 2 + (i - 2) * 18, cy + 40, 5); ctx.fill(); });
  if (highScore > 0) { ctx.fillStyle = INK2; ctx.font = fnt(11, 600); ctx.fillText(`BEST ${highScore}`, w / 2, cy + 74); }
  ctx.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3));
  ctx.fillStyle = INK; ctx.font = fnt(13, 700); ctx.fillText('TAP TO START', w / 2, h * 0.74);
  ctx.globalAlpha = 1;
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
  const hw = W() / 2 - margin, hh = H() / 2 - margin, cos = Math.cos(angle), sin = Math.sin(angle);
  const t = Math.min(cos !== 0 ? hw / Math.abs(cos) : Infinity, sin !== 0 ? hh / Math.abs(sin) : Infinity);
  return { x: W() / 2 + cos * t, y: H() / 2 + sin * t };
}

// ══════════════════════════════════════════════
//  HINTS — one short label at a time, retired once done
// ══════════════════════════════════════════════
const HINT_STORE = 'croqkey_hints_v1';
let hintsLearned = new Set();
try { hintsLearned = new Set(JSON.parse(localStorage.getItem(HINT_STORE) || '[]')); } catch (e) { /* private mode */ }
let activeHint = null, hintCooldown = 50;
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
function nearestScreen(list, filter, m = 30) {
  let best = null, bd = Infinity;
  for (const o of list) {
    if (!filter(o)) continue;
    const p = w2sz(o.x, o.y);
    if (!onScreenPt(p, m) || p.y > H() - 140 || p.y < 80) continue;
    const d = Math.hypot(o.x - player.x, o.y - player.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
const nearestEnemyScreen = () => nearestScreen(enemies, e => e.alive);
const nearestKeyScreen = () => nearestScreen(keyDrops, () => true, 20);
function nearestOrbScreen(type) {
  let best = null, bd = Infinity;
  for (const o of inscriptionOrbs) { if (o.type !== type) continue; const d = Math.hypot(o.x - player.x, o.y - player.y); if (d < bd) { bd = d; best = o; } }
  if (!best) return null;
  const p = w2sz(best.x, best.y);
  return onScreenPt(p, 30) ? p : screenEdgePoint(Math.atan2(best.y - player.y, best.x - player.x), 48);
}
function threatNear(d) { for (const e of enemies) if (e.alive && e !== connectedEnemy && Math.hypot(e.x - player.x, e.y - player.y) < d) return e; return null; }
function otherKeyReady() { let idx = -1; keySlots.forEach((s, i) => { if (idx < 0 && i !== selectedSlotIdx && s.dur > 0) idx = i; }); return idx; }
function matchSlotIdx() { if (!connectedEnemy) return -1; const ec = connectedEnemy.colors || [connectedEnemy.color]; return keySlots.findIndex(s => s.dur > 0 && s.colors.some(c => ec.includes(c))); }
function activeMatches() { if (!connectedEnemy) return false; const ec = connectedEnemy.colors || [connectedEnemy.color], s = activeSlot(); return s.dur > 0 && s.colors.some(c => ec.includes(c)); }
function slotScreen(i) { const s = keyPanelSlots().find(k => k.idx === i); return s ? { x: s.cx, y: s.cy } : null; }

const HINT_DEFS = [
  { id: 'connect', ev: 'connect', text: 'TAP', gesture: 'tap',
    when: () => state === State.IDLE && nearestEnemyScreen(), target: nearestEnemyScreen },
  { id: 'unlock', ev: 'hit', text: '円内から矢印へ FLICK', gesture: 'ring', delay: 4,
    when: () => state === State.CONNECTED && !!connectedEnemy, target: () => playerScreenPos() },
  { id: 'move', ev: 'move', text: 'FLICK で移動', gesture: 'flickTo',
    when: () => state === State.IDLE && hintsLearned.has('unlock') && nearestKeyScreen(), target: nearestKeyScreen },
  { id: 'switch', ev: 'slot', text: '鍵を TAP', gesture: 'tap', slot: true,
    when: () => (state === State.IDLE || state === State.CONNECTED) && otherKeyReady() >= 0, target: () => slotScreen(otherKeyReady()) },
  { id: 'match', ev: 'crit', text: '同色で CRIT', gesture: 'tap', slot: true,
    when: () => state === State.CONNECTED && hintsLearned.has('switch') && matchSlotIdx() >= 0 && !activeMatches(), target: () => slotScreen(matchSlotIdx()) },
  { id: 'escape', ev: 'escape', text: '円外から FLICK で離脱', gesture: 'escape',
    when: () => state === State.CONNECTED && hintsLearned.has('unlock') && threatNear(95), target: () => playerScreenPos() },
  { id: 'worn', text: '同色の鍵で回復', gesture: 'point', slot: true, learnOnResolve: true,
    when: () => activeSlot().dur === 0 && killCount > 2, target: () => slotScreen(selectedSlotIdx) },
  { id: 'orb', ev: 'draft', text: '刻印へ', gesture: 'flickTo',
    when: () => state === State.IDLE && inscriptionOrbs.some(o => o.type === 'normal'), target: () => nearestOrbScreen('normal') },
  { id: 'phantom', ev: 'phantom', text: 'HOLD で幻影', gesture: 'hold',
    when: () => state === State.IDLE && phantomOrbPickedUp && !phantomMode, target: () => ({ x: W() / 2, y: H() * 0.62 }) },
];

function updateHints() {
  if (activeHint) {
    const a = activeHint;
    a.age++;
    if (a.done || a.fading) { if (++a.fade > 14) { hintCooldown = a.done ? 8 : 70; activeHint = null; } return; }
    let ok = false; try { ok = !!a.def.when(); } catch (e) { ok = false; }
    if (!ok) { if (++a.lost > 24) { if (a.def.learnOnResolve && a.age > 80) learnHint(a.def.id); a.fading = true; } } else a.lost = 0;
    return;
  }
  if (hintCooldown > 0) { hintCooldown--; return; }
  if (orbAnnounce) return;
  for (const d of HINT_DEFS) {
    if (hintsLearned.has(d.id)) continue;
    let ok = false; try { ok = !!d.when(); } catch (e) { ok = false; }
    hintPending[d.id] = ok ? (hintPending[d.id] || 0) + 1 : 0;
    if (hintPending[d.id] > (d.delay ?? 24)) { hintPending[d.id] = 0; activeHint = { def: d, age: 0, fade: 0, lost: 0, done: false, fading: false }; return; }
  }
}

function hintLabel(x, y, text, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = fnt(12, 700);
  const tw = ctx.measureText(text).width, bw = tw + 20, bh = 24;
  const bx = Math.max(8, Math.min(W() - bw - 8, x - bw / 2)), byy = Math.max(8, Math.min(H() - bh - 8, y - bh / 2));
  panelRect(bx, byy, bw, bh, 4);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + bw / 2, byy + bh / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
function travelDot(x0, y0, x1, y1, cyc, col, alpha) {
  const p = cyc < 0.12 ? 0 : easeOut((cyc - 0.12) / 0.45), fade = cyc > 0.7 ? 1 - (cyc - 0.7) / 0.3 : 1;
  const x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p;
  ctx.save();
  ctx.globalAlpha = alpha * fade; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
  if (p > 0) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x, y, cyc < 0.12 ? 7 : 5.5, 0, TAU); ctx.fill();
  ctx.globalAlpha = alpha * fade * 0.5; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x0, y0, 10, 0, TAU); ctx.stroke();
  ctx.restore();
}
function renderHint(t) {
  const a = activeHint;
  if (!a || orbAnnounce || !(state === State.IDLE || state === State.CONNECTED)) return;
  const alpha = Math.min(1, a.age / 10) * ((a.done || a.fading) ? Math.max(0, 1 - a.fade / 14) : 1);
  if (alpha <= 0) return;
  const d = a.def;
  let target = null; try { target = d.target(); } catch (e) { target = null; }
  if (!target) return;
  const cyc = t % 1.4 / 1.4, ink = phantomMode ? '#ffffff' : INK;
  let lx = target.x, ly = target.y - 40;
  ctx.save();
  if (d.gesture === 'tap' || d.gesture === 'point') {
    if (d.slot) ly = target.y - 52;
    if (d.gesture === 'tap') {
      ctx.strokeStyle = d.slot ? '#ffffff' : ink; ctx.lineWidth = 1.5;
      for (const k of [0, 0.5]) { const p = (cyc + k) % 1; ctx.globalAlpha = alpha * (1 - p); ctx.beginPath(); ctx.arc(target.x, target.y, 8 + p * 22, 0, TAU); ctx.stroke(); }
    } else {
      ctx.globalAlpha = alpha; ctx.fillStyle = '#fff'; const b = Math.sin(t * 6) * 3;
      ctx.beginPath(); ctx.moveTo(target.x, target.y - 33 + b); ctx.lineTo(target.x - 5, target.y - 40 + b); ctx.lineTo(target.x + 5, target.y - 40 + b); ctx.closePath(); ctx.fill();
      ly = target.y - 60;
    }
  } else if (d.gesture === 'ring' && connectedEnemy) {
    const ang = connectedEnemy.angleQueue[0], c = Math.cos(ang), s = Math.sin(ang);
    travelDot(target.x + c * 6, target.y + s * 6, target.x + c * (CFG.INNER_R + 46), target.y + s * (CFG.INNER_R + 46), cyc, ink, alpha);
    lx = target.x; ly = target.y + CFG.INNER_R + 34;
  } else if (d.gesture === 'escape') {
    const th = threatNear(140) || connectedEnemy;
    const away = th ? Math.atan2(player.y - th.y, player.x - th.x) : -Math.PI / 2, c = Math.cos(away), s = Math.sin(away);
    const r0 = CFG.INNER_R + 24;
    ctx.globalAlpha = alpha * 0.5; ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(target.x, target.y, CFG.INNER_R + 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    travelDot(target.x + c * r0, target.y + s * r0, target.x + c * (r0 + 64), target.y + s * (r0 + 64), cyc, ink, alpha);
    lx = target.x; ly = target.y + CFG.INNER_R + 34;
  } else if (d.gesture === 'flickTo') {
    const ps = w2sz(player.x, player.y), ang = Math.atan2(target.y - ps.y, target.x - ps.x);
    const len = Math.min(80, Math.hypot(target.x - ps.x, target.y - ps.y) * 0.6), c = Math.cos(ang), s = Math.sin(ang);
    ctx.globalAlpha = alpha * 0.7; ctx.strokeStyle = ink; ctx.lineWidth = 1;
    const b = 16;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(target.x + sx * b, target.y + sy * (b - 5)); ctx.lineTo(target.x + sx * b, target.y + sy * b); ctx.lineTo(target.x + sx * (b - 5), target.y + sy * b); }
    ctx.stroke();
    travelDot(ps.x + c * 24, ps.y + s * 24, ps.x + c * (24 + len), ps.y + s * (24 + len), cyc, ink, alpha);
    lx = target.x; ly = target.y - 34;
  } else if (d.gesture === 'hold') {
    const p = clamp01(cyc / 0.8);
    ctx.globalAlpha = alpha; ctx.lineWidth = 2;
    ctx.strokeStyle = phantomMode ? 'rgba(255,255,255,0.25)' : INK3; ctx.beginPath(); ctx.arc(target.x, target.y, 26, 0, TAU); ctx.stroke();
    ctx.strokeStyle = PH_COL; ctx.beginPath(); ctx.arc(target.x, target.y, 26, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(target.x, target.y, 5, 0, TAU); ctx.fill();
    ly = target.y - 46;
  }
  ctx.restore();
  hintLabel(lx, ly, d.text, alpha);
}

// ── first-sight notes (one line, one at a time) ──
const NOTE_TEXT = {
  note_blue: '青 ｜ 遅い・硬い', note_yellow: '黄 ｜ 速い・脆い', note_green: '緑 ｜ 周囲を回復',
  note_purple: '紫 ｜ 撃破で爆発', note_fusion: '融合 ｜ 全色の性質',
  note_o_fusion: '色融合 ｜ 鍵を合成', note_o_enemy_boost: '敵増加 ｜ 敵が増える', note_o_infection: '感染 ｜ 刻印が5つ束に',
  note_o_phantom: '幻影 ｜ HOLD で切替', note_o_paint: '着彩 ｜ 画面に色',
};
const fieldNotes = [];
function updateFieldNotes() {
  for (let i = fieldNotes.length - 1; i >= 0; i--) {
    const n = fieldNotes[i];
    n.age++;
    const gone = n.isOrb ? !inscriptionOrbs.includes(n.ref) : !n.ref.alive;
    if (gone && !n.gone) { n.gone = true; n.age = Math.max(n.age, n.max - 14); }
    if (n.age >= n.max) fieldNotes.splice(i, 1);
  }
  if (fieldNotes.length || frame % 12 !== 0 || !hintsLearned.has('unlock')) return;
  if (activeHint && !activeHint.done) return;
  const v = visibleWorld(-40), inView = o => o.x > v.x0 && o.x < v.x1 && o.y > v.y0 && o.y < v.y1 - 90;
  for (const e of enemies) {
    if (!e.alive || !inView(e)) continue;
    const id = e.fusion ? 'note_fusion' : 'note_' + e.color;
    if (!NOTE_TEXT[id] || hintsLearned.has(id)) continue;
    learnHint(id); fieldNotes.push({ ref: e, isOrb: false, text: NOTE_TEXT[id], col: COLOR_HEX[e.color], age: 0, max: 240 });
    return;
  }
  for (const o of inscriptionOrbs) {
    if (o.type === 'normal' || !inView(o)) continue;
    const id = 'note_o_' + o.type;
    if (!NOTE_TEXT[id] || hintsLearned.has(id)) continue;
    learnHint(id); fieldNotes.push({ ref: o, isOrb: true, text: NOTE_TEXT[id], col: orbColor(o, 0), age: 0, max: 240 });
    return;
  }
}
function renderFieldNotes(t) {
  if (!(state === State.IDLE || state === State.CONNECTED)) return;
  for (const n of fieldNotes) {
    const a = Math.min(1, n.age / 10) * Math.min(1, (n.max - n.age) / 14);
    if (!n.gone) n.last = w2sz(n.ref.x, n.ref.y);
    const p = n.last; if (!p) continue;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = fnt(11, 700);
    const tw = ctx.measureText(n.text).width, bw = tw + 26, bh = 22;
    let lx = p.x + 28, ly = p.y - 42;
    if (lx + bw > W() - 8) lx = p.x - 28 - bw;
    if (ly < 70) ly = p.y + 24;
    lx = Math.max(8, lx);
    ctx.strokeStyle = n.col; ctx.lineWidth = 1;
    const ax = lx < p.x ? lx + bw : lx, ay = ly + bh / 2, ang = Math.atan2(ay - p.y, ax - p.x);
    ctx.beginPath(); ctx.moveTo(p.x + Math.cos(ang) * 22, p.y + Math.sin(ang) * 22); ctx.lineTo(ax, ay); ctx.stroke();
    panelRect(lx, ly, bw, bh, 4);
    ctx.fillStyle = n.col; ctx.fillRect(lx + 8, ly + bh / 2 - 3, 6, 6);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(n.text, lx + 19, ly + bh / 2 + 1);
    ctx.restore();
  }
}

// ── finger trail & long-press gauge ─────────────
const swipeTrail = { pts: [], col: INK };
function trailStart(x, y) {
  swipeTrail.pts = [{ x, y, t: performance.now() }];
  let col = phantomMode ? '#ffffff' : INK;
  if (state === State.CONNECTED) { const ps = playerScreenPos(); if (Math.hypot(x - ps.x, y - ps.y) < CFG.INNER_R) col = COLOR_HEX[activeKeyColor()] || INK; }
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
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = swipeTrail.col;
  for (let i = 1; i < pts.length; i++) {
    const age = (now - pts[i].t) / 240;
    if (age >= 1) continue;
    ctx.globalAlpha = (1 - age) * 0.4; ctx.lineWidth = 1 + (1 - age) * 3;
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
  ctx.save(); ctx.lineWidth = 2.5;
  ctx.strokeStyle = phantomMode ? 'rgba(255,255,255,0.25)' : INK3; ctx.beginPath(); ctx.arc(touch.sx, touch.sy, 32, 0, TAU); ctx.stroke();
  ctx.strokeStyle = PH_COL; ctx.beginPath(); ctx.arc(touch.sx, touch.sy, 32, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke();
  ctx.fillStyle = phantomMode ? '#fff' : INK; ctx.font = fnt(10, 700); ctx.textAlign = 'center';
  ctx.fillText(phantomMode ? '解除' : '幻影', touch.sx, touch.sy - 42);
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
