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
const ENDLESS_THRESHOLD   = 20;   // enemy_boost stacks to trigger endless / paint mode

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

// Accumulate all active inscription effects into a mods object
function getMods() {
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
  const skipW = 160, skipH = 42;
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

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const W = () => canvas.width;
const H = () => canvas.height;

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
const State = { IDLE: 'idle', CONNECTED: 'connected', GAMEOVER: 'gameover', DRAFT: 'draft', PAUSED: 'paused', FUSION_SELECT: 'fusion_select', PAINT_DRAFT: 'paint_draft' };
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
  effects.push({ type, x, y, age: 0, maxAge: 30, ...opts });
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
      if (s.slot.dur > 0) { selectedSlotIdx = s.idx; playSlotSelectSound(); }
      return true;
    }
  }
  return false;
}

function pauseButtonBounds() {
  return { x: 12, y: 62, w: 52, h: 28 };
}

function fusionConfirmBounds(w, h) {
  const cx = w / 2, btnY = h / 2 + 60;
  return {
    confirm: { x: cx - 160, y: btnY, w: 140, h: 48 },
    cancel:  { x: cx + 20,  y: btnY, w: 140, h: 48 },
  };
}

function pointerDown(sx, sy) {
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
        fusionSlotA = -1; fusionSlotB = -1;
        state = State.IDLE;
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
  // PAINT_DRAFT: pick one of 3 paint choices
  if (state === State.PAINT_DRAFT) {
    if (performance.now() - paintDraftOpenedAt >= 700) {
      const bounds = paintDraftCardBounds(W(), H());
      for (const b of bounds) {
        if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
          applyPaintInscription(paintDraftChoices[b.index]);
          paintDraftChoices = [];
          state = State.IDLE;
          break;
        }
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
  // Paint reset button (bottom center, shown when activePaints > 0)
  if (activePaints.length > 0) {
    const rb = paintResetBounds(W(), H());
    if (sx >= rb.x && sx <= rb.x + rb.w && sy >= rb.y && sy <= rb.y + rb.h) {
      activePaints.length = 0;
      touch = null; return;
    }
  }
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
    const w = W(), h = H();
    const cx = w / 2, cy = h / 2;
    const cardH = 420;
    const cardY = cy - cardH / 2;
    const resumeY = cardY + 82;
    const resetY  = cardY + 146;
    const tSx = touch.sx, tSy = touch.sy;
    if (tSx >= cx - 80 && tSx <= cx + 80 && tSy >= resumeY && tSy <= resumeY + 44) {
      state = stateBeforePause;
    } else if (tSx >= cx - 80 && tSx <= cx + 80 && tSy >= resetY && tSy <= resetY + 44) {
      resetGame();
    }
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

canvas.addEventListener('touchstart',  e => { e.preventDefault(); const t = e.changedTouches[0]; pointerDown(t.clientX, t.clientY); }, { passive: false });
canvas.addEventListener('touchend',    e => { e.preventDefault(); const t = e.changedTouches[0]; pointerUp(t.clientX, t.clientY);   }, { passive: false });
canvas.addEventListener('touchcancel', e => { e.preventDefault(); touch = null; }, { passive: false });
canvas.addEventListener('mousedown', e => pointerDown(e.clientX, e.clientY));
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
  }

  // Fusion inscription orb (200 kills, then every 100)
  // If all colors are already fused, spawn enemy boost inscription instead
  if (killCount >= nextFusionInsAt) {
    nextFusionInsAt += FUSION_INS_INTERVAL;
    if (allColorsFused()) {
      spawnEnemyBoostOrb();
    } else {
      spawnFusionInscriptionOrb();
    }
  }

  // Infection inscription — one-shot at 1000 kills
  if (!infectionOrbSpawned && killCount >= INFECTION_KILLS) {
    infectionOrbSpawned = true;
    spawnInfectionOrb();
  }
  // Phantom inscription — one-shot at 1500 kills
  if (!phantomOrbSpawned && killCount >= PHANTOM_KILLS) {
    phantomOrbSpawned = true;
    spawnPhantomOrb();
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
  screenFlash = { r: er, g: eg, b: eb, alpha: 0.22 };
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
    if (inscriptionOrbs[i].type === 'enemy_boost' || (inscriptionOrbs[i].type === 'paint' && inscriptionOrbs[i].fromPhantom)) {
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
  infectedMode = false; infectionOrbSpawned = false; orbAnnounce = null;
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
  if (state === State.DRAFT || state === State.PAUSED || state === State.FUSION_SELECT || state === State.PAINT_DRAFT) return;
  frame++;
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

function paintDraftCardBounds(w, h) {
  const cardW = Math.min((w - 64) / 3, 170);
  const cardH = 180;
  const totalW = cardW * 3 + 24;
  const startX = (w - totalW) / 2;
  const cardY = h / 2 - cardH / 2 - 10;
  return [0, 1, 2].map(i => ({ x: startX + i * (cardW + 12), y: cardY, w: cardW, h: cardH, index: i }));
}

function paintResetBounds(w, h) {
  const bw = 110, bh = 30;
  return { x: w / 2 - bw / 2, y: h - 52, w: bw, h: bh };
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

function renderPaintDraft(w, h, t) {
  // Dim overlay
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, w, h);
  // Title
  ctx.fillStyle = '#ffeeaa';
  ctx.font = 'bold 17px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('着彩刻印', w / 2, h / 2 - 110);

  const bounds = paintDraftCardBounds(w, h);
  for (const b of bounds) {
    const p = paintDraftChoices[b.index];
    if (!p) continue;
    // Card
    ctx.fillStyle = 'rgba(20,15,35,0.88)';
    ctx.strokeStyle = 'rgba(220,200,255,0.38)';
    ctx.lineWidth = 1.5;
    ctx.save(); ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.stroke(); ctx.restore();
    // Color preview bar
    ctx.save(); ctx.beginPath(); ctx.roundRect(b.x + 8, b.y + 10, b.w - 16, 28, 4); ctx.clip();
    drawPaintColorBar(b.x + 8, b.y + 10, b.w - 16, 28, p.pair);
    ctx.restore();
    // Name
    ctx.fillStyle = '#eeddff';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.pair.name, b.x + b.w / 2, b.y + 60);
    // Attributes line
    ctx.fillStyle = 'rgba(200,180,255,0.75)';
    ctx.font = '11px -apple-system, sans-serif';
    const blendLabel = { '沈': '乗算', '昇': 'スクリーン', '冴': 'オーバーレイ', '載': '通常' }[p.blend.char] || p.blend.char;
    const motionLabel = { '凪': '静止', '遷': 'ドリフト', '脈': '脈動', '転': '回転' }[p.motion.char] || p.motion.char;
    const densityLabel = { '淡': '淡', '半': '中', '濃': '濃' }[p.density.char] || p.density.char;
    ctx.fillText(`${blendLabel}・${motionLabel}・${densityLabel}`, b.x + b.w / 2, b.y + 80);
    // Full name small
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillText(p.name, b.x + b.w / 2, b.y + 98);
  }
}

function renderPaintResetButton(w, h) {
  if (activePaints.length === 0) return;
  const rb = paintResetBounds(w, h);
  ctx.fillStyle = 'rgba(30,20,50,0.75)';
  ctx.strokeStyle = 'rgba(200,180,255,0.45)';
  ctx.lineWidth = 1;
  ctx.save(); ctx.beginPath(); ctx.roundRect(rb.x, rb.y, rb.w, rb.h, 7); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(220,200,255,0.75)';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('着彩リセット', rb.x + rb.w / 2, rb.y + 20);
}

function render() {
  const w = W(), h = H();
  const t = performance.now() / 1000;

  ctx.fillStyle = phantomMode ? '#08100e' : '#f8f7f4';
  ctx.fillRect(0, 0, w, h);

  // ── World transform (camera zoom: positive=zoom in/narrow, negative=zoom out/wide) ──
  ctx.save();
  const zoomMod = getMods().cameraZoom;
  if (zoomMod !== 0) {
    const scale = 1 + zoomMod * 0.4;
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);
  }
  ctx.translate(-cam.x, -cam.y);

  if (!phantomMode) drawInfiniteGrid();
  renderEffectsWorld(t);
  renderKeyDrops(t);
  renderInscriptionOrbs(t);
  if (state === State.CONNECTED && connectedEnemy) renderBeam(t);
  for (const e of enemies) if (e.alive) renderEnemy(e, t);
  renderPlayer(t);

  ctx.restore();

  // 着彩レイヤー (world の上・UIの下)
  if (activePaints.length > 0) renderPaintLayers(t);

  // Phantom hue tint — plain alpha fillRect, no compositing mode (fastest possible)
  if (phantomMode) {
    const hue = Math.round((t * 25) % 360);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = `hsl(${hue}, 90%, 55%)`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  // ── Screen space ──

  if (screenFlash) {
    ctx.fillStyle = `rgba(${screenFlash.r},${screenFlash.g},${screenFlash.b},${screenFlash.alpha})`;
    ctx.fillRect(0, 0, w, h);
  }
  renderEdgeIndicators();
  renderInscriptionEdgeIndicators();
  if (state === State.CONNECTED) renderCircularUI(t);
  renderKeyPanel(t);
  renderHUD(w, h);
  if (orbAnnounce) renderOrbAnnounce(w, h);
  renderPaintResetButton(w, h);
  if (state === State.GAMEOVER) renderGameOver(w, h);
  if (state === State.DRAFT)    renderDraft(w, h, t);
  if (state === State.PAUSED)        renderPause(w, h);
  if (state === State.FUSION_SELECT) renderFusionSelect(w, h, t);
  if (state === State.PAINT_DRAFT)   renderPaintDraft(w, h, t);
}


function renderOrbAnnounce(w, h) {
  const a = orbAnnounce;
  const p = a.age / a.maxAge;
  const fadeIn  = Math.min(1, a.age / 10);
  const fadeOut = a.age > a.maxAge - 22 ? (a.maxAge - a.age) / 22 : 1;
  const alpha   = fadeIn * fadeOut;

  // Dark overlay
  ctx.save();
  ctx.fillStyle = `rgba(8, 6, 18, ${0.76 * alpha})`;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;

  // Glow halo behind text
  ctx.globalAlpha = 0.18 * alpha;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 160);
  grad.addColorStop(0, a.color);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Main label
  ctx.globalAlpha = alpha;
  ctx.fillStyle = a.color;
  ctx.font = `bold ${Math.round(Math.min(w, h) * 0.11)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = a.color;
  ctx.shadowBlur  = 28;
  ctx.fillText(a.label, cx, cy + 10);
  ctx.shadowBlur = 0;

  // Sub-label (only if explicitly set)
  if (a.sub) {
    ctx.globalAlpha = alpha * 0.65;
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px -apple-system, sans-serif';
    ctx.fillText(a.sub, cx, cy + 46);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawInfiniteGrid() {
  const gs  = 48;
  const wx0 = Math.floor(cam.x / gs) * gs;
  const wy0 = Math.floor(cam.y / gs) * gs;
  const wx1 = cam.x + W() + gs;
  const wy1 = cam.y + H() + gs;
  ctx.save();
  ctx.strokeStyle = '#e6e4de';
  ctx.lineWidth   = 0.5;
  for (let x = wx0; x < wx1; x += gs) {
    ctx.beginPath(); ctx.moveTo(x, wy0); ctx.lineTo(x, wy1); ctx.stroke();
  }
  for (let y = wy0; y < wy1; y += gs) {
    ctx.beginPath(); ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); ctx.stroke();
  }
  ctx.restore();
}

function renderEffectsWorld(t) {
  for (const e of effects) {
    const p = e.age / e.maxAge;
    ctx.save();
    if (e.type === 'explosion') {
      ctx.globalAlpha = (1 - p) * 0.65;
      ctx.strokeStyle = e.color; ctx.lineWidth = 3 * (1 - p) + 0.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 75, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - p) * 0.18; ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 50, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = (1 - p) * 0.85; ctx.strokeStyle = e.color; ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * p * 35, e.y + Math.sin(a) * p * 35);
        ctx.lineTo(e.x + Math.cos(a) * p * 65, e.y + Math.sin(a) * p * 65);
        ctx.stroke();
      }
    }
    if (e.type === 'hit') {
      const sz = e.crit ? 36 : 22;
      ctx.globalAlpha = (1 - p) * (e.crit ? 0.9 : 0.75);
      ctx.strokeStyle = e.color; ctx.lineWidth = e.crit ? 3 : 1.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * sz, 0, Math.PI * 2); ctx.stroke();
      if (e.crit) {
        ctx.globalAlpha = (1 - p) * 0.3; ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, p * sz * 0.6, 0, Math.PI * 2); ctx.fill();
        // "Crit" label — floats upward
        ctx.globalAlpha = (1 - p) * 0.95;
        ctx.fillStyle = '#ffe566';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Crit', e.x, e.y - 18 - p * 28);
      }
    }
    if (e.type === 'escape') {
      ctx.globalAlpha = (1 - p) * 0.5; ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * CFG.OUTER_R, 0, Math.PI * 2); ctx.stroke();
    }
    if (e.type === 'miss') {
      ctx.globalAlpha = (1 - p) * 0.55; ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + p * Math.PI;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * 6,      e.y + Math.sin(a) * 6);
        ctx.lineTo(e.x + Math.cos(a) * p * 22, e.y + Math.sin(a) * p * 22);
        ctx.stroke();
      }
    }
    if (e.type === 'dmg') {
      ctx.globalAlpha = (1 - p) * 0.75; ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 22, 0, Math.PI * 2); ctx.stroke();
    }
    if (e.type === 'slowAura') {
      ctx.globalAlpha = (1 - p) * 0.55; ctx.strokeStyle = e.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 220, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - p) * 0.12; ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 220, 0, Math.PI * 2); ctx.fill();
    }
    if (e.type === 'healAura') {
      ctx.globalAlpha = (1 - p) * 0.35; ctx.strokeStyle = e.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 200, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - p) * 0.08; ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 200, 0, Math.PI * 2); ctx.fill();
    }
    if (e.type === 'chain') {
      // Line arc from source to target
      ctx.globalAlpha = (1 - p) * 0.85; ctx.strokeStyle = e.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.fromX, e.fromY); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 20, 0, Math.PI * 2); ctx.stroke();
    }
    if (e.type === 'heal') {
      const col = COLOR_HEX['green'];
      ctx.globalAlpha = (1 - p) * 0.8; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 30, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - p) * 0.35; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 18, 0, Math.PI * 2); ctx.fill();
    }
    if (e.type === 'bomb') {
      ctx.globalAlpha = (1 - p) * 0.55; ctx.strokeStyle = e.color; ctx.lineWidth = 3 * (1-p) + 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 160, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - p) * 0.12; ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 160, 0, Math.PI * 2); ctx.fill();
    }
    if (e.type === 'noDur') {
      ctx.globalAlpha = (1 - p) * 0.7; ctx.strokeStyle = e.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.x - 10, e.y - 10); ctx.lineTo(e.x + 10, e.y + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.x + 10, e.y - 10); ctx.lineTo(e.x - 10, e.y + 10); ctx.stroke();
    }
    if (e.type === 'keyCollect') {
      ctx.globalAlpha = (1 - p) * 0.8; ctx.strokeStyle = e.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 28, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - p) * 0.25; ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function renderKeyDrops(t) {
  for (const k of keyDrops) {
    const bob  = Math.sin(k.age * KEY_BOB_SPEED / 60 * Math.PI * 2) * KEY_BOB_AMP;
    const col  = COLOR_HEX[k.color];
    const x    = k.x, y = k.y + bob;
    const sz   = 9;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3 + k.age * 0.08);

    ctx.save();
    ctx.translate(x, y);

    // Glow
    ctx.globalAlpha = 0.18 * pulse;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, sz * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Diamond shape
    ctx.globalAlpha = 0.9 * pulse;
    ctx.fillStyle = col;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -sz);
    ctx.lineTo(sz * 0.65, 0);
    ctx.lineTo(0, sz);
    ctx.lineTo(-sz * 0.65, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.6 * pulse;
    ctx.stroke();

    // Inner highlight
    ctx.globalAlpha = 0.4 * pulse;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -sz * 0.55);
    ctx.lineTo(sz * 0.3, -sz * 0.05);
    ctx.lineTo(0, sz * 0.15);
    ctx.lineTo(-sz * 0.3, -sz * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

function renderBeam(t) {
  const px = player.x, py = player.y;
  const ex = connectedEnemy.x, ey = connectedEnemy.y;
  const flash = beamFlash > 0;
  const N = 24;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u  = i / N;
    const bx = px + (ex - px) * u;
    const by = py + (ey - py) * u;
    const dx = ex - px, dy = ey - py;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const wob = Math.sin(u * Math.PI * 4 + t * 9) * 4.5 * Math.sin(u * Math.PI);
    pts.push({ x: bx + nx * wob, y: by + ny * wob });
  }
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const beamCol = connectedEnemy ? COLOR_HEX[connectedEnemy.color] : CFG.KEY_COLOR;
  ctx.globalAlpha = 0.18; ctx.strokeStyle = beamCol; ctx.lineWidth = 12;
  drawPath(pts);
  ctx.globalAlpha = flash ? 1.0 : 0.88;
  ctx.strokeStyle = flash ? '#fff' : beamCol;
  ctx.lineWidth   = flash ? 4.5 : 2.0;
  drawPath(pts);
  ctx.restore();
}

function drawPath(pts) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function renderEnemy(e, t) {
  const focused    = connectedEnemy === e;
  const ecol       = COLOR_HEX[e.color] || CFG.KEY_COLOR;
  const worldDist  = Math.hypot(e.x - player.x, e.y - player.y);
  const colorVisible = getMods().enemyColorFarHide === 0 || worldDist < 180;
  const ecol_v     = colorVisible ? ecol : '#888888';
  const getCol     = c => colorVisible ? (COLOR_HEX[c] || '#888888') : '#888888';
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.crackShake > 0) ctx.translate((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 1.5);

  // Proximity pulse (colored)
  if (state === State.IDLE) {
    const d = worldDist;
    if (d < 210) {
      ctx.globalAlpha = 0.10 + 0.07 * Math.sin(t * 3.5);
      ctx.strokeStyle = ecol_v; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  const allColors = e.colors || [e.color];

  // Green healer aura (any component)
  if (allColors.includes('green')) {
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(t * 2.5 + (e.healAuraTimer || 0) * 0.1);
    ctx.strokeStyle = getCol('green'); ctx.lineWidth = 1.2; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(0, 0, 200, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Purple warning pulse
  if (allColors.includes('purple')) {
    ctx.globalAlpha = 0.07 + 0.05 * Math.sin(t * 5);
    ctx.strokeStyle = getCol('purple'); ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Slow frost ring
  if (e.slowTimer > 0) {
    const fp = e.slowTimer / 180;
    ctx.globalAlpha = fp * 0.55;
    ctx.strokeStyle = COLOR_HEX['blue']; ctx.lineWidth = 2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(0, 0, e.r + 10, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Body — fusion: gradient fill + arc-segment outer ring (mirrors fused key ring)
  if (e.fusion && allColors.length > 1) {
    // Gradient fill — visible blend of all component colors (or gray if hidden)
    const grad = ctx.createLinearGradient(-e.r, 0, e.r, 0);
    allColors.forEach((c, ci) => {
      const stop = ci / Math.max(allColors.length - 1, 1);
      grad.addColorStop(stop, getCol(c) + (focused ? '70' : '45'));
    });
    ctx.fillStyle = grad;
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();

    // Outer ring: one arc segment per color, slowly rotating dashes
    const segAngle = (Math.PI * 2) / allColors.length;
    const dashOff  = -(t * 0.38 % 1) * 18;
    allColors.forEach((c, ci) => {
      ctx.globalAlpha = focused ? 0.92 : 0.78;
      ctx.strokeStyle = getCol(c);
      ctx.lineWidth   = focused ? 3.0 : 2.2;
      ctx.setLineDash([9, 5]);
      ctx.lineDashOffset = dashOff - ci * 14;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, ci * segAngle, (ci + 1) * segAngle);
      ctx.stroke();
    });
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle   = focused ? `${ecol_v}28` : `${ecol_v}12`;
    ctx.strokeStyle = focused ? '#222' : '#777';
    ctx.lineWidth   = focused ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // Keyhole (colored)
  const kr = e.r * 0.28, ky = -e.r * 0.22, ksw = e.r * 0.22, ksh = e.r * 0.45;
  ctx.strokeStyle = focused ? ecol_v : `${ecol_v}99`; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, ky, kr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-ksw, ky + kr * 0.7); ctx.lineTo(-ksw, ky + ksh);
  ctx.lineTo( ksw, ky + ksh);      ctx.lineTo( ksw, ky + kr * 0.7);
  ctx.stroke();


  // HP pips — start from top, decrease clockwise
  for (let i = 0; i < e.maxHp; i++) {
    const a = -(i / e.maxHp) * Math.PI * 2 - Math.PI * 0.5;
    const pipCol = colorVisible ? COLOR_HEX[allColors[i % allColors.length]] : '#666666';
    ctx.fillStyle = i < e.hp ? pipCol : '#888888';
    ctx.beginPath(); ctx.arc(Math.cos(a) * (e.r + 8), Math.sin(a) * (e.r + 8), 2.5, 0, Math.PI * 2); ctx.fill();
  }

  const lost = e.maxHp - e.hp;
  if (lost > 0) {
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
    for (let i = 0; i < lost; i++) {
      const a = -(i / e.maxHp) * Math.PI * 2 - Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.r * 0.45,        Math.sin(a) * e.r * 0.45);
      ctx.lineTo(Math.cos(a + 0.35) * e.r * 0.88, Math.sin(a + 0.35) * e.r * 0.88);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function renderPlayer(t) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invincible > 0 && Math.floor(player.invincible / 3) % 2 === 1) ctx.globalAlpha = 0.35;

  // Hit flash ring
  if (player.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = (player.hitFlash / 22) * 0.5;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(0, 0, player.r + 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = '#242424';
  ctx.beginPath(); ctx.arc(0, 0, player.r * 0.65, 0, Math.PI * 2); ctx.fill();

  const er = player.r * 0.42, ey0 = -player.r * 0.1;
  ctx.strokeStyle = '#f0ede6'; ctx.fillStyle = '#f0ede6'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (const ex of [-er, er]) {
    ctx.beginPath(); ctx.arc(ex, ey0, player.r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ex - player.r * 0.28, ey0); ctx.lineTo(ex + player.r * 0.28, ey0); ctx.stroke();
  }

  const pSlot = activeSlot();
  const dotX  = player.r * 0.68, dotY = -player.r * 0.68, dotR = player.r * 0.28;
  if (pSlot.colors.length > 1) {
    const grad = ctx.createLinearGradient(dotX - dotR, dotY, dotX + dotR, dotY);
    pSlot.colors.forEach((c, ci) => grad.addColorStop(ci / Math.max(pSlot.colors.length - 1, 1), COLOR_HEX[c]));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = pSlot.dur > 0 ? (COLOR_HEX[pSlot.colors[0]] || CFG.KEY_COLOR) : '#888';
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  ctx.restore();
}

function renderCircularUI(t) {
  const ps = playerScreenPos();
  const cx = ps.x, cy = ps.y;
  const shakeX = uiShake > 0 ? Math.sin(uiShake * 1.8) * (uiShake / 10) * 5 : 0;
  const _slot  = activeSlot();
  const keyCol = _slot.dur > 0 ? (COLOR_HEX[_slot.colors[0]] || CFG.KEY_COLOR) : '#888888';

  ctx.save();
  ctx.translate(shakeX, 0);

  // Inner ring (unlock zone) — per-color arc segments for fused slots
  const dashOff = -(t * 0.55 % 1) * 20;
  if (_slot.colors.length > 1 && _slot.dur > 0) {
    const segAngle = (Math.PI * 2) / _slot.colors.length;
    _slot.colors.forEach((c, ci) => {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = COLOR_HEX[c]; ctx.lineWidth = 3.5;
      ctx.setLineDash([13, 7]); ctx.lineDashOffset = dashOff - ci * 20;
      ctx.beginPath();
      ctx.arc(cx, cy, CFG.INNER_R, ci * segAngle, (ci + 1) * segAngle);
      ctx.stroke();
    });
    ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
    const ringGrad = ctx.createLinearGradient(cx - CFG.INNER_R, cy, cx + CFG.INNER_R, cy);
    _slot.colors.forEach((c, ci) => ringGrad.addColorStop(ci / Math.max(_slot.colors.length - 1, 1), COLOR_HEX[c] + '30'));
    ctx.globalAlpha = 0.18; ctx.fillStyle = ringGrad;
    ctx.beginPath(); ctx.arc(cx, cy, CFG.INNER_R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 1.0; ctx.strokeStyle = keyCol; ctx.lineWidth = 3.5;
    ctx.setLineDash([13, 7]); ctx.lineDashOffset = dashOff;
    ctx.beginPath(); ctx.arc(cx, cy, CFG.INNER_R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    ctx.globalAlpha = 0.18; ctx.fillStyle = keyCol;
    ctx.beginPath(); ctx.arc(cx, cy, CFG.INNER_R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Direction guides: show only as many arrows as hits remaining to kill
  if (connectedEnemy) {
    const q    = connectedEnemy.angleQueue;
    const uiMods  = getMods();
    const hasKey  = _slot.dur > 0;
    const eCols   = connectedEnemy.colors || [connectedEnemy.color];
    const dmg     = (hasKey && _slot.colors.some(c => eCols.includes(c))) ? 2 : 1;
    const hitsLeft = Math.ceil(connectedEnemy.hp / dmg);
    const maxShow  = Math.max(1, 3 - Math.round(uiMods.predictArrowSub));
    const show    = Math.min(hitsLeft, maxShow);
    const dynamicTol = Math.max(5 * Math.PI / 180, CFG.UNLOCK_TOLERANCE + uiMods.flickTolerance);
    const ghostAlpha = ghostTimer > 0 ? Math.min(ghostTimer / 25, 1) : 0.55;
    const arrowColors = _slot.dur > 0 && _slot.colors.length > 1 ? _slot.colors.map(c => COLOR_HEX[c]) : null;

    if (show >= 3 && q.length > 2) {
      ctx.globalAlpha = 0.25;
      renderDirectionGuide(cx, cy, q[2], keyCol, 2, dynamicTol, arrowColors);
    }
    if (show >= 2 && q.length > 1) {
      ctx.globalAlpha = 0.52;
      renderDirectionGuide(cx, cy, q[1], keyCol, 3, dynamicTol, arrowColors);
    }
    ctx.globalAlpha = ghostAlpha;
    renderDirectionGuide(cx, cy, q[0], keyCol, 5, dynamicTol, arrowColors);
    ctx.globalAlpha = 1;
  }

  // cannotEscape indicator
  if (getMods().cannotEscape > 0) {
    ctx.fillStyle = 'rgba(232,69,60,0.7)';
    ctx.font = 'bold 10px -apple-system, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⛓ 離脱不可', cx, cy + CFG.INNER_R + 22);
  } else {
    ctx.fillStyle = 'rgba(110,108,103,0.55)';
    ctx.font = '11px -apple-system, "Helvetica Neue", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('円内フリック: 解錠  円外フリック: 離脱＆移動', cx, cy + CFG.INNER_R + 22);
  }

  ctx.restore();
}

// lineW: stem line width (also scales arrowhead); tol: effective angle tolerance in radians
// colors: optional hex color array for multi-color gradient (fused slots)
function renderDirectionGuide(cx, cy, angle, color, lineW = 4, tol = CFG.UNLOCK_TOLERANCE, colors = null) {
  const stemStart = CFG.INNER_R * 0.25;
  const stemEnd   = CFG.OUTER_R * 0.88;
  const ex = cx + Math.cos(angle) * stemEnd;
  const ey = cy + Math.sin(angle) * stemEnd;
  const ssx = cx + Math.cos(angle) * stemStart;
  const ssy = cy + Math.sin(angle) * stemStart;
  const useGrad = colors && colors.length > 1;

  // Tolerance fan
  const safeTol = Math.max(5 * Math.PI / 180, tol);
  const baseAlpha = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = baseAlpha * 0.38;
  if (useGrad) {
    const fanGrad = ctx.createLinearGradient(
      cx + Math.cos(angle - safeTol) * CFG.OUTER_R * 0.85,
      cy + Math.sin(angle - safeTol) * CFG.OUTER_R * 0.85,
      cx + Math.cos(angle + safeTol) * CFG.OUTER_R * 0.85,
      cy + Math.sin(angle + safeTol) * CFG.OUTER_R * 0.85
    );
    colors.forEach((c, ci) => fanGrad.addColorStop(ci / Math.max(colors.length - 1, 1), c));
    ctx.fillStyle = fanGrad;
  } else {
    ctx.fillStyle = color;
  }
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle - safeTol) * CFG.INNER_R,
             cy + Math.sin(angle - safeTol) * CFG.INNER_R);
  ctx.arc(cx, cy, CFG.OUTER_R * 0.85, angle - safeTol, angle + safeTol);
  ctx.arc(cx, cy, CFG.INNER_R,        angle + safeTol, angle - safeTol, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Stem
  if (useGrad) {
    const stemGrad = ctx.createLinearGradient(ssx, ssy, ex, ey);
    colors.forEach((c, ci) => stemGrad.addColorStop(ci / Math.max(colors.length - 1, 1), c));
    ctx.strokeStyle = stemGrad;
  } else {
    ctx.strokeStyle = color;
  }
  ctx.lineWidth = lineW; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ssx, ssy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Arrowhead (tip = last color in gradient)
  const tipCol = useGrad ? colors[colors.length - 1] : color;
  const hw = Math.PI / 5;
  const hs = 10 + lineW * 2.4;
  ctx.fillStyle = tipCol;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - Math.cos(angle - hw) * hs, ey - Math.sin(angle - hw) * hs);
  ctx.lineTo(ex - Math.cos(angle + hw) * hs, ey - Math.sin(angle + hw) * hs);
  ctx.closePath();
  ctx.fill();
}

// Returns screen-space slot descriptors for the key panel
function keyPanelSlots() {
  const w = W(), h = H();
  const slotR   = 28;
  const spacing = 68;
  const n       = keySlots.length;
  const totalW  = Math.max(0, n - 1) * spacing;
  const panelY  = h - 62;
  return keySlots.map((slot, i) => ({
    slot,
    idx: i,
    cx: w / 2 - totalW / 2 + i * spacing,
    cy: panelY,
    r:  slotR,
  }));
}

function renderKeyPanel(t) {
  const w = W(), h = H();
  const slots  = keyPanelSlots();
  if (!slots.length) return;
  const panelY = h - 62;
  const DUR_MAX = 24;

  // Background pill
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#1e1e1e';
  const pw = slots[slots.length - 1].cx - slots[0].cx + 80;
  roundRect(slots[0].cx - 40, panelY - 38, pw, 88, 18);
  ctx.restore();

  for (const s of slots) {
    const slot    = s.slot;
    const dur     = slot.dur;
    const active  = s.idx === selectedSlotIdx;
    const hasKey  = dur > 0;
    const cols    = slot.colors;
    const primCol = COLOR_HEX[cols[0]];
    const drawCol = (active && !hasKey) ? '#888888' : primCol;
    const pulse   = active ? 0.85 + 0.15 * Math.sin(t * 4) : 1;
    const isFused = cols.length > 1;

    ctx.save();

    // Durability arc track (dim full ring)
    ctx.strokeStyle = drawCol;
    ctx.lineWidth   = 3;
    ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2); ctx.stroke();

    // Filled durability arc — for fused slots draw each color's segment
    if (dur > 0) {
      const ratio  = Math.min(dur / DUR_MAX, 1);
      const arcEnd = -Math.PI / 2 + Math.PI * 2 * ratio;
      ctx.globalAlpha = active ? 0.85 * pulse : 0.5;
      ctx.lineWidth   = 3;
      if (isFused) {
        const segSize = (arcEnd - (-Math.PI / 2)) / cols.length;
        for (let ci = 0; ci < cols.length; ci++) {
          ctx.strokeStyle = COLOR_HEX[cols[ci]];
          ctx.beginPath();
          ctx.arc(s.cx, s.cy, s.r + 4,
            -Math.PI / 2 + ci * segSize,
            -Math.PI / 2 + (ci + 1) * segSize);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = drawCol;
        ctx.beginPath();
        ctx.arc(s.cx, s.cy, s.r + 4, -Math.PI / 2, arcEnd);
        ctx.stroke();
      }
    }

    // Active: glow halo + thick ring + bottom triangle indicator
    if (active) {
      // Glow halo
      ctx.shadowColor = drawCol;
      ctx.shadowBlur  = 18;
      ctx.strokeStyle = drawCol;
      ctx.lineWidth   = 3.5;
      ctx.globalAlpha = 0.95 * pulse;
      ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur  = 0;
      // Second thin outer ring
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.45 * pulse;
      ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r + 14, 0, Math.PI * 2); ctx.stroke();
      // Bottom triangle indicator
      ctx.globalAlpha = 0.85 * pulse;
      ctx.fillStyle   = drawCol;
      const tx = s.cx, ty = s.cy + s.r + 22;
      ctx.beginPath();
      ctx.moveTo(tx - 5, ty); ctx.lineTo(tx + 5, ty); ctx.lineTo(tx, ty + 6);
      ctx.closePath(); ctx.fill();
    }

    // Slot background — gradient fill for fused
    ctx.globalAlpha = hasKey ? 0.2 : (active ? 0.12 : 0.07);
    if (isFused) {
      const bg = ctx.createLinearGradient(s.cx - s.r, s.cy, s.cx + s.r, s.cy);
      cols.forEach((c, ci) => bg.addColorStop(ci / Math.max(cols.length - 1, 1), COLOR_HEX[c]));
      ctx.fillStyle = bg;
    } else {
      ctx.fillStyle = drawCol;
    }
    ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2); ctx.fill();

    // Icon
    if (hasKey) {
      if (isFused) {
        // Colored dots in a ring for each component color
        const dotR = 5, orbitR = cols.length <= 2 ? 9 : 11;
        cols.forEach((c, ci) => {
          const a = (ci / cols.length) * Math.PI * 2 - Math.PI / 2;
          ctx.globalAlpha = active ? 0.95 * pulse : 0.75;
          ctx.fillStyle = COLOR_HEX[c];
          ctx.beginPath(); ctx.arc(s.cx + Math.cos(a) * orbitR, s.cy + Math.sin(a) * orbitR, dotR, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = active ? 0.4 * pulse : 0.2;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
          ctx.stroke();
        });
      } else {
        // Single diamond icon
        const sz = 9;
        ctx.globalAlpha = active ? 0.95 * pulse : 0.65;
        ctx.fillStyle   = primCol;
        ctx.beginPath();
        ctx.moveTo(s.cx,             s.cy - sz);
        ctx.lineTo(s.cx + sz * 0.65, s.cy);
        ctx.lineTo(s.cx,             s.cy + sz);
        ctx.lineTo(s.cx - sz * 0.65, s.cy);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = active ? 0.5 * pulse : 0.25;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = drawCol; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(s.cx, s.cy, 7, 0, Math.PI * 2); ctx.stroke();
    }

    // Durability number
    if (dur > 0) {
      ctx.globalAlpha = active ? 0.95 : 0.65;
      ctx.fillStyle   = dur <= CFG.DUR_COST_NORMAL ? '#ff8888' : '#fff';
      ctx.font        = `bold ${dur >= 10 ? 9 : 10}px -apple-system, monospace`;
      ctx.textAlign   = 'center';
      ctx.fillText(dur, s.cx, s.cy + s.r + 16);
    }

    ctx.restore();
  }
}

function renderHUD(w, h) {
  // HP bar (top center)
  const barW = Math.min(w * 0.52, 260), barH = 6;
  const bx = (w - barW) / 2, by = 16;
  ctx.fillStyle = '#dbd9d2'; roundRect(bx, by, barW, barH, 3);
  const hudMods = getMods();
  const maxHp = Math.max(1, CFG.PLAYER_HP_MAX + hudMods.maxHpBonus - hudMods.maxHpMalus);
  const hpRatio = player.hp / maxHp;
  const hpCol = hpRatio > 0.5 ? '#3db86a' : hpRatio > 0.25 ? '#ddb830' : '#e8453c';
  if (barW * hpRatio > 6) { ctx.fillStyle = hpCol; roundRect(bx, by, barW * hpRatio, barH, 3); }
  ctx.fillStyle = '#888'; ctx.font = '10px -apple-system, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`HP ${player.hp.toFixed(1)} / ${maxHp.toFixed(1)}`, bx, by + barH + 13);

  ctx.fillStyle = '#999'; ctx.font = 'bold 13px -apple-system, monospace'; ctx.textAlign = 'right';
  ctx.fillText(`解錠 ${score}`, w - 16, 32);
  if (highScore > 0) {
    ctx.fillStyle = '#bbb'; ctx.font = '10px -apple-system, monospace'; ctx.textAlign = 'right';
    ctx.fillText(`BEST ${highScore}`, w - 16, 46);
  }
  ctx.fillStyle = '#bbb'; ctx.font = '11px -apple-system, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`${Math.floor(gameTime)}s`, 16, 30);

  const alive = enemies.filter(e => e.alive).length;
  ctx.fillStyle = '#bbb'; ctx.font = '11px -apple-system, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`敵 ×${alive}`, 16, 44);
  if (enemyBoostStacks > 0) {
    ctx.fillStyle = '#ff8844'; ctx.font = 'bold 10px -apple-system, monospace'; ctx.textAlign = 'left';
    ctx.fillText(`敵増 +${enemyBoostStacks * 7}  頻 ×${Math.pow(1.3, enemyBoostStacks).toFixed(2)}`, 16, 58);
  }

  // Combo display (top center below HP)
  if (combo >= 2) {
    const comboAlpha = Math.min(1, combo / 5);
    const comboSize  = 11 + Math.min(combo, 20);
    ctx.save();
    ctx.globalAlpha = comboAlpha;
    ctx.font = `bold ${comboSize}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    const hue = Math.min(60, combo * 4); // yellow at high combos
    ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
    ctx.fillText(`${combo} COMBO`, w / 2, by + barH + 38);
    ctx.restore();
  }

  // Inscription count (top-left corner)
  if (activeInscriptions.length > 0) {
    ctx.fillStyle = '#b044d8';
    ctx.font = 'bold 11px -apple-system, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`◆ 刻印 ×${activeInscriptions.length}`, 16, 48);
  }

  // Pause button
  {
    const pb = pauseButtonBounds();
    ctx.save();
    ctx.fillStyle = 'rgba(30,28,40,0.6)';
    ctx.strokeStyle = 'rgba(180,180,200,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(pb.x, pb.y, pb.w, pb.h, 6); ctx.fill(); ctx.stroke();
    // Two vertical bars (pause icon)
    ctx.fillStyle = 'rgba(200,200,210,0.8)';
    const bx = pb.x + pb.w / 2, by = pb.y + 7, bh = pb.h - 14;
    ctx.fillRect(bx - 7, by, 4, bh);
    ctx.fillRect(bx + 3, by, 4, bh);
    ctx.restore();
  }

  ctx.fillStyle = '#aaa'; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'center';
  if (state === State.IDLE)
    ctx.fillText('タップ: 接続/停止  フリック: 移動', w / 2, h - 100);
  else
    ctx.fillText('内側起点フリック: 解錠  外側起点フリック: 離脱', w / 2, h - 100);
}

function renderGameOver(w, h) {
  const res = lastResult || { score, killCount, maxCombo, gameTime };

  // Dark overlay
  ctx.fillStyle = 'rgba(8, 8, 12, 0.78)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  // Card background
  const cardW = Math.min(w - 48, 320), cardH = 310;
  const cardX = cx - cardW / 2, cardY = cy - cardH / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Title
  ctx.fillStyle = '#e8453c';
  ctx.font = 'bold 28px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', cx, cardY + 46);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, cardY + 58); ctx.lineTo(cardX + cardW - 24, cardY + 58);
  ctx.stroke();

  // New high score banner
  const isNewBest = res.killCount >= highScore && res.killCount > 0;
  if (isNewBest) {
    ctx.fillStyle = '#ddb830';
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ NEW BEST ★', cx, cardY + 66);
  }

  // Stats
  const stats = [
    { label: '生存時間',    value: (() => { const s = Math.floor(res.gameTime); return s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`; })() },
    { label: '解錠数',      value: `${res.killCount}`, highlight: isNewBest },
    { label: 'MAXコンボ',  value: `${res.maxCombo}` },
    { label: '取得刻印',    value: `${res.inscriptions || 0}個` },
    { label: 'ハイスコア',  value: `${highScore}`, dim: true },
  ];
  const rowH = 42;
  stats.forEach((s, i) => {
    const ry = cardY + 88 + i * rowH;
    ctx.fillStyle = s.dim ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.38)';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(s.label, cardX + 32, ry);
    ctx.fillStyle = s.highlight ? '#ddb830' : s.dim ? 'rgba(255,255,255,0.45)' : '#ffffff';
    ctx.font = `bold ${s.dim ? 16 : 22}px -apple-system, monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(s.value, cardX + cardW - 32, ry);
  });

  // Hold-to-restart indicator
  const holdFrac = gameOverHoldStart > 0
    ? Math.min(1, (performance.now() - gameOverHoldStart) / GAMEOVER_HOLD_MS)
    : 0;
  const hintY = cardY + cardH - 36;
  // Progress arc
  if (holdFrac > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, hintY - 4, 10, -Math.PI / 2, -Math.PI / 2 + holdFrac * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = holdFrac > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)';
  ctx.font = '12px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('長押しで再スタート', cx, cardY + cardH - 14);
}

// ══════════════════════════════════════════════
//  EDGE INDICATORS
// ══════════════════════════════════════════════
function renderInscriptionOrbs(t) {
  for (const orb of inscriptionOrbs) {
    const pulse = Math.sin(t * 3.2 + (orb.pulse || 0) * 0.05) * 0.5 + 0.5;
    ctx.save();
    ctx.translate(orb.x, orb.y);

    if (orb.type === 'infection') {
      // Pulsing dark-violet corrupted orb
      const r = 24 + pulse * 6;
      // Outer glow rings
      [r + 8, r, r - 8].forEach((rr, i) => {
        ctx.globalAlpha = (0.12 + pulse * 0.08) / (i + 1);
        ctx.strokeStyle = '#8800cc'; ctx.lineWidth = 4 - i;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      });
      // Spinning dashed ring
      ctx.setLineDash([5, 3]); ctx.lineDashOffset = t * -60;
      ctx.globalAlpha = 0.55 + pulse * 0.3;
      ctx.strokeStyle = '#cc44ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Dark corrupted diamond
      ctx.globalAlpha = 0.9 + pulse * 0.1;
      ctx.fillStyle = '#2a0044';
      ctx.strokeStyle = '#bb33ff'; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(10, 0); ctx.lineTo(0, 13); ctx.lineTo(-10, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Inner glow
      ctx.globalAlpha = 0.6 + pulse * 0.3;
      ctx.fillStyle = '#cc44ff';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 2); ctx.lineTo(-4, 0);
      ctx.closePath(); ctx.fill();
      // "感" kanji hint
      ctx.globalAlpha = 0.7 + pulse * 0.2;
      ctx.fillStyle = '#ffccff';
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('感', 0, 0);
      ctx.textBaseline = 'alphabetic';
    } else if (orb.type === 'enemy_boost') {
      // Angry pulsing red ring + warning diamond
      const r = 22 + pulse * 5;
      ctx.globalAlpha = 0.22 + pulse * 0.15;
      ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      // Dashed faster ring
      ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 40;
      ctx.globalAlpha = 0.45 + pulse * 0.3;
      ctx.strokeStyle = '#ff8844'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Dark red diamond
      ctx.globalAlpha = 0.85 + pulse * 0.15;
      ctx.fillStyle = '#cc2200';
      ctx.strokeStyle = '#ff6622'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(9, 0); ctx.lineTo(0, 12); ctx.lineTo(-9, 0);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.7 + pulse * 0.2;
      ctx.stroke();
      // "+" symbol in center
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffcc88';
      ctx.font = 'bold 11px -apple-system, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', 0, 0);
      ctx.textBaseline = 'alphabetic';
    } else if (orb.type === 'paint') {
      // Iridescent paint orb — slowly cycling hue ring + palette diamond
      const hue = Math.round((t * 40 + (orb.pulse || 0)) % 360);
      const r2 = 22 + pulse * 5;
      ctx.globalAlpha = 0.22 + pulse * 0.15;
      ctx.strokeStyle = `hsl(${hue},90%,65%)`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, r2, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 35;
      ctx.globalAlpha = 0.50 + pulse * 0.3;
      ctx.strokeStyle = `hsl(${(hue + 60) % 360},90%,70%)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r2 - 6, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.85 + pulse * 0.15;
      ctx.fillStyle = `hsl(${(hue + 120) % 360},80%,40%)`;
      ctx.strokeStyle = `hsl(${hue},90%,70%)`; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(9, 0); ctx.lineTo(0, 12); ctx.lineTo(-9, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px -apple-system, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('彩', 0, 0);
      ctx.textBaseline = 'alphabetic';
    } else if (orb.type === 'phantom') {
      // Ethereal cyan phantom orb
      const r = 22 + pulse * 6;
      [r + 10, r, r - 8].forEach((rr, i) => {
        ctx.globalAlpha = (0.10 + pulse * 0.08) / (i + 1);
        ctx.strokeStyle = '#44ffdd'; ctx.lineWidth = 3.5 - i;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.setLineDash([5, 3]); ctx.lineDashOffset = t * 55;
      ctx.globalAlpha = 0.55 + pulse * 0.3;
      ctx.strokeStyle = '#aaffee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.88 + pulse * 0.12;
      ctx.fillStyle = '#004433';
      ctx.strokeStyle = '#44ffdd'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(10, 0); ctx.lineTo(0, 13); ctx.lineTo(-10, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#88ffdd';
      ctx.font = 'bold 9px -apple-system, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('幻', 0, 0);
      ctx.textBaseline = 'alphabetic';
    } else if (orb.type === 'fusion') {
      // Multi-color spinning ring segments
      const segColors = ['#e8453c', '#3c7de8', '#ddb830', '#3db86a', '#9844e8'];
      const numSeg = 5;
      const segAngle = Math.PI * 2 / numSeg;
      ctx.lineWidth = 4;
      for (let i = 0; i < numSeg; i++) {
        ctx.globalAlpha = 0.5 + pulse * 0.4;
        ctx.strokeStyle = segColors[i];
        ctx.beginPath();
        ctx.arc(0, 0, 22 + pulse * 5, i * segAngle + t * 1.1, (i + 0.75) * segAngle + t * 1.1);
        ctx.stroke();
      }
      // Gold diamond
      ctx.globalAlpha = 0.8 + pulse * 0.2;
      ctx.fillStyle = '#ffcc44';
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(9, 0); ctx.lineTo(0, 12); ctx.lineTo(-9, 0);
      ctx.closePath(); ctx.fill();
      // White inner
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 2); ctx.lineTo(-4, 0);
      ctx.closePath(); ctx.fill();
    } else {
      const col = RARITY_COLOR[orb.rarity];
      // Glow ring
      ctx.globalAlpha = 0.18 + pulse * 0.14;
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 22 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
      // Core diamond
      ctx.globalAlpha = 0.7 + pulse * 0.3;
      ctx.fillStyle   = col;
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(7, 0); ctx.lineTo(0, 10); ctx.lineTo(-7, 0);
      ctx.closePath(); ctx.fill();
      // White inner highlight
      ctx.globalAlpha = 0.5;
      ctx.fillStyle   = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(3, 0); ctx.lineTo(0, 1); ctx.lineTo(-3, 0);
      ctx.closePath(); ctx.fill();
    }

    ctx.restore();
  }
}

function renderInscriptionEdgeIndicators() {
  const margin = 54;
  const t = performance.now() / 1000;
  for (const orb of inscriptionOrbs) {
    const angle = Math.atan2(orb.y - player.y, orb.x - player.x);
    const d     = Math.hypot(orb.x - player.x, orb.y - player.y);
    if (d < 350) continue;
    const { x, y } = screenEdgePoint(angle, margin);
    const isFusion     = orb.type === 'fusion';
    const isEnemyBoost = orb.type === 'enemy_boost';
    const isInfection  = orb.type === 'infection';
    const isPhantom    = orb.type === 'phantom';
    const isPaint      = orb.type === 'paint';
    const paintEdgeCol = isPaint ? `hsl(${Math.round((performance.now() / 1000 * 40) % 360)},90%,65%)` : '#fff';
    const col = isInfection ? '#cc44ff' : isEnemyBoost ? '#ff4400' : isFusion ? '#ffcc44' : isPhantom ? '#44ffdd' : isPaint ? paintEdgeCol : RARITY_COLOR[orb.rarity];
    const pulse     = 0.72 + 0.28 * Math.sin(t * 3.8 + (orb.pulse || 0) * 0.05);

    ctx.save();
    ctx.translate(x, y);

    // Pill badge background — completely different shape from triangular enemy arrows
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = 'rgba(10,8,20,0.88)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.roundRect(-22, -17, 44, 34, 8); ctx.fill();
    ctx.globalAlpha = 0.55 * pulse;
    ctx.stroke();

    // Upright diamond (not rotated with angle — clearly differs from enemy triangles)
    ctx.globalAlpha = pulse;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -4); ctx.lineTo(3, 0); ctx.lineTo(0, 1); ctx.lineTo(-3, 0);
    ctx.closePath(); ctx.fill();

    // Text label below diamond
    ctx.globalAlpha = 0.95 * pulse;
    ctx.fillStyle = col;
    ctx.font = `bold 8px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(isInfection ? '感染' : isEnemyBoost ? '敵増' : isFusion ? '融合' : isPhantom ? '幻影' : '刻印', 0, 22);

    // Small direction tick pointing toward orb (outside the badge)
    ctx.globalAlpha = 0.65 * pulse;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    const ax = Math.cos(angle), ay = Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(ax * 24, ay * 24);
    ctx.lineTo(ax * 30, ay * 30);
    ctx.stroke();
    ctx.save();
    ctx.translate(ax * 30, ay * 30);
    ctx.rotate(angle);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(-2, -3); ctx.lineTo(-2, 3);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}

function renderDraft(w, h, t) {
  if (draftIsFusion) { renderFusionDraft(w, h, t); return; }
  if (infectedMode && draftChoices.length > 0 && Array.isArray(draftChoices[0])) {
    renderInfectedDraft(w, h, t); return;
  }

  // Dim overlay
  ctx.fillStyle = 'rgba(8, 8, 14, 0.72)';
  ctx.fillRect(0, 0, w, h);

  // Title
  ctx.fillStyle = '#e0d0ff';
  ctx.font = 'bold 20px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('刻印を選択', w / 2, h / 2 - 180);

  const bounds = draftCardBounds(w, h);
  const cardBounds = bounds.slice(0, 3);
  const skipBound  = bounds[3];

  // Draw inscription cards
  cardBounds.forEach((b, i) => {
    if (i >= draftChoices.length) return;
    const ins   = draftChoices[i];
    const rcol  = RARITY_COLOR[ins.rarity];

    // Card bg
    ctx.fillStyle   = 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = rcol;
    ctx.lineWidth   = 1.5;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Rarity label
    ctx.fillStyle = rcol;
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ins.rarity.toUpperCase(), b.x + b.w / 2, b.y + 20);

    // Diamond icon
    const cx = b.x + b.w / 2, dy = b.y + 50;
    ctx.fillStyle = rcol;
    ctx.beginPath();
    ctx.moveTo(cx, dy - 14); ctx.lineTo(cx + 10, dy); ctx.lineTo(cx, dy + 14); ctx.lineTo(cx - 10, dy);
    ctx.closePath(); ctx.fill();

    // Buff section
    ctx.fillStyle = 'rgba(100,255,120,0.9)';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ バフ', b.x + b.w / 2, b.y + 92);

    ctx.fillStyle = '#ddffd0';
    ctx.font = '11px -apple-system, sans-serif';
    wrapText(ctx, ins.buff.label, b.x + b.w / 2, b.y + 112, b.w - 20, 15);

    // Debuff section
    ctx.fillStyle = 'rgba(255,100,100,0.9)';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText('▼ デバフ', b.x + b.w / 2, b.y + 170);

    ctx.fillStyle = '#ffd0d0';
    ctx.font = '11px -apple-system, sans-serif';
    wrapText(ctx, ins.debuff.label, b.x + b.w / 2, b.y + 190, b.w - 20, 15);

    // Tap hint
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillText('タップで取得', b.x + b.w / 2, b.y + b.h - 12);
  });

  // Skip button
  ctx.fillStyle   = 'rgba(255,255,255,0.08)';
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth   = 1;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(skipBound.x, skipBound.y, skipBound.w, skipBound.h, 8);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('見送る（最少耐久の鍵を補充）', skipBound.x + skipBound.w / 2, skipBound.y + skipBound.h / 2 + 4);

  // Active inscriptions count
  if (activeInscriptions.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`刻印 ${activeInscriptions.length}個 取得済み`, w / 2, h - 40);
  }
}

function renderInfectedDraft(w, h, t) {
  // Dark violet overlay
  ctx.fillStyle = 'rgba(10, 0, 22, 0.82)';
  ctx.fillRect(0, 0, w, h);

  // Title
  ctx.fillStyle = '#cc44ff';
  ctx.font = 'bold 18px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('刻印感染 — 5刻印を選択', w / 2, h / 2 - 195);

  const bounds = draftCardBounds(w, h);
  const cardBounds = bounds.slice(0, 3);
  const skipBound  = bounds[3];

  cardBounds.forEach((b, i) => {
    if (i >= draftChoices.length) return;
    const bundle = draftChoices[i]; // array of 5 inscriptions

    // Card bg — taller to fit 5 items; reuse bound but clip internally
    ctx.fillStyle   = 'rgba(40,0,60,0.55)';
    ctx.strokeStyle = '#9922cc';
    ctx.lineWidth   = 1.5;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Infected badge
    ctx.fillStyle = '#cc44ff';
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('感染 ×5', b.x + b.w / 2, b.y + 16);

    // List the 5 inscriptions compactly
    const lineH = (b.h - 40) / 5;
    bundle.forEach((ins, j) => {
      const ry = b.y + 28 + j * lineH;
      const rcol = RARITY_COLOR[ins.rarity];

      // Rarity dot
      ctx.fillStyle = rcol;
      ctx.beginPath();
      ctx.arc(b.x + 8, ry + lineH / 2 - 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Buff
      ctx.fillStyle = '#aaffaa';
      ctx.font = '9px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`▲ ${ins.buff.label}`, b.x + 16, ry + lineH / 2 - 3);

      // Debuff
      ctx.fillStyle = '#ffaaaa';
      ctx.fillText(`▼ ${ins.debuff.label}`, b.x + 16, ry + lineH / 2 + 9);

      // Divider (except after last)
      if (j < bundle.length - 1) {
        ctx.strokeStyle = 'rgba(150,50,200,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(b.x + 6, ry + lineH);
        ctx.lineTo(b.x + b.w - 6, ry + lineH);
        ctx.stroke();
      }
    });

    // Tap hint
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('タップで取得', b.x + b.w / 2, b.y + b.h - 6);
  });

  // Skip button
  ctx.fillStyle   = 'rgba(255,255,255,0.06)';
  ctx.strokeStyle = 'rgba(200,100,255,0.3)';
  ctx.lineWidth   = 1;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(skipBound.x, skipBound.y, skipBound.w, skipBound.h, 8);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('見送る（最少耐久の鍵を補充）', skipBound.x + skipBound.w / 2, skipBound.y + skipBound.h / 2 + 4);

  if (activeInscriptions.length > 0) {
    ctx.fillStyle = 'rgba(200,100,255,0.35)';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`刻印 ${activeInscriptions.length}個 取得済み`, w / 2, h - 40);
  }
}

function renderFusionDraft(w, h, t) {
  // Overlay with warm gold tint
  ctx.fillStyle = 'rgba(8, 7, 14, 0.80)';
  ctx.fillRect(0, 0, w, h);

  // Gold frame accent
  ctx.strokeStyle = 'rgba(255,200,60,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  // Title
  ctx.fillStyle = '#ffcc44';
  ctx.font = 'bold 22px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('色融合刻印', w / 2, h / 2 - 185);

  ctx.fillStyle = 'rgba(255,200,60,0.55)';
  ctx.font = '12px -apple-system, sans-serif';
  ctx.fillText('デバフなし — 複数の色の力を融合強化', w / 2, h / 2 - 162);

  const bounds    = draftCardBounds(w, h);
  const cardBounds = bounds.slice(0, 3);
  const skipBound  = bounds[3];

  cardBounds.forEach((b, i) => {
    if (i >= draftChoices.length) return;
    const ins = draftChoices[i];

    // Card bg with gold border
    ctx.fillStyle   = 'rgba(255,200,60,0.07)';
    ctx.strokeStyle = 'rgba(255,200,60,0.55)';
    ctx.lineWidth   = 1.5;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Color count label
    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ins.colors.length}色融合`, b.x + b.w / 2, b.y + 20);

    // Color swatches
    const swatchR  = 9;
    const swatchY  = b.y + 48;
    const sw       = ins.colors.length;
    const swSpacing = Math.min(22, (b.w - 20) / Math.max(sw, 1));
    ins.colors.forEach((c, ci) => {
      const sx = b.x + b.w / 2 + (ci - (sw - 1) / 2) * swSpacing;
      ctx.fillStyle = COLOR_HEX[c];
      ctx.beginPath(); ctx.arc(sx, swatchY, swatchR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Effects list
    ins.effects.forEach((eff, ei) => {
      const ey = b.y + 78 + ei * 28;
      ctx.fillStyle = COLOR_HEX[ins.colors[ei]];
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('▲', b.x + 10, ey);
      ctx.fillStyle = '#fff';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      wrapText(ctx, eff.label, b.x + b.w / 2, ey, b.w - 22, 14);
    });

    // Tap hint
    ctx.fillStyle = 'rgba(255,200,60,0.45)';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('タップで取得', b.x + b.w / 2, b.y + b.h - 12);
  });

  // Skip button
  ctx.fillStyle   = 'rgba(255,255,255,0.07)';
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth   = 1;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(skipBound.x, skipBound.y, skipBound.w, skipBound.h, 8);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('見送る（最少耐久の鍵を補充）', skipBound.x + skipBound.w / 2, skipBound.y + skipBound.h / 2 + 4);

  if (activeInscriptions.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`刻印 ${activeInscriptions.length}個 取得済み`, w / 2, h - 40);
  }
}

function renderFusionSelect(w, h, t) {
  ctx.fillStyle = 'rgba(8,7,18,0.68)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const nameMap = { red:'赤', blue:'青', yellow:'黄', green:'緑', purple:'紫' };

  // Header panel
  ctx.fillStyle   = 'rgba(255,200,60,0.12)';
  ctx.strokeStyle = 'rgba(255,200,60,0.45)';
  ctx.lineWidth   = 1.5;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(cx - 190, 48, 380, 86, 12); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffcc44';
  ctx.font = 'bold 18px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('色融合刻印', cx, 78);

  if (fusionSlotB !== -1) {
    // ── Confirmation stage ──
    const sA = keySlots[fusionSlotA];
    const sB = keySlots[fusionSlotB];
    const mergedColors = sA && sB ? [...new Set([...sA.colors, ...sB.colors])] : [];
    const labelA = sA ? sA.colors.map(c => nameMap[c] || c).join('+') : '?';
    const labelB = sB ? sB.colors.map(c => nameMap[c] || c).join('+') : '?';
    const labelM = mergedColors.map(c => nameMap[c] || c).join('+');

    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillStyle = '#ffcc44';
    ctx.fillText('融合内容を確認', cx, 103);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(`「${labelA}」＋「${labelB}」 → 「${labelM}」`, cx, 122);

    // Preview card
    const cardW = 280, cardH = 90, cardY = h / 2 - 60;
    ctx.fillStyle = 'rgba(255,200,60,0.08)';
    ctx.strokeStyle = 'rgba(255,200,60,0.38)';
    ctx.lineWidth = 1.5;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(cx - cardW / 2, cardY, cardW, cardH, 10); ctx.fill(); ctx.stroke();
    ctx.restore();
    const dotR = 14;
    const spacing = Math.min(52, (cardW - 40) / Math.max(mergedColors.length, 1));
    const startDotX = cx - spacing * (mergedColors.length - 1) / 2;
    mergedColors.forEach((col, ci) => {
      const dx = startDotX + ci * spacing;
      const dy = cardY + cardH / 2;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = COLOR_HEX[col];
      ctx.beginPath(); ctx.arc(dx, dy, dotR, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(dx, dy, dotR, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.fillStyle = '#ccc'; ctx.textAlign = 'center';
      ctx.fillText(nameMap[col] || col, dx, dy + dotR + 13);
    });

    // Confirm / Cancel buttons
    const btn = fusionConfirmBounds(w, h);
    ctx.fillStyle = 'rgba(80,200,100,0.18)';
    ctx.strokeStyle = 'rgba(80,200,100,0.65)';
    ctx.lineWidth = 1.5;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(btn.confirm.x, btn.confirm.y, btn.confirm.w, btn.confirm.h, 9); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#7de899';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('融合する', btn.confirm.x + btn.confirm.w / 2, btn.confirm.y + 30);

    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(btn.cancel.x, btn.cancel.y, btn.cancel.w, btn.cancel.h, 9); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('キャンセル', btn.cancel.x + btn.cancel.w / 2, btn.cancel.y + 28);

    // Pulse highlights on both chosen slots
    const fslots = keyPanelSlots();
    [fusionSlotA, fusionSlotB].forEach((idx, ii) => {
      const s = fslots.find(fs => fs.idx === idx);
      if (!s) return;
      const pulse = 0.75 + 0.25 * Math.sin(t * 5 + ii * Math.PI);
      ctx.strokeStyle = ii === 0 ? '#ffcc44' : '#7de899';
      ctx.lineWidth = 3; ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r + 14, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    });
  } else {
    // ── Selection stage ──
    ctx.font = '13px -apple-system, sans-serif';
    if (fusionSlotA === -1) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('融合させたい1つ目の鍵をタップ', cx, 103);
    } else {
      const sA = keySlots[fusionSlotA];
      const label = sA ? sA.colors.map(c => nameMap[c] || c).join('+') : '?';
      ctx.fillStyle = '#ffcc44';
      ctx.fillText(`「${label}」選択中  →  融合する2つ目をタップ`, cx, 103);
    }

    // Pulsing highlight on selected slot A
    if (fusionSlotA !== -1) {
      const fslots = keyPanelSlots();
      const sA = fslots.find(s => s.idx === fusionSlotA);
      if (sA) {
        const pulse = 0.75 + 0.25 * Math.sin(t * 5);
        ctx.strokeStyle = '#ffcc44';
        ctx.lineWidth   = 3;
        ctx.globalAlpha = pulse;
        ctx.beginPath(); ctx.arc(sA.cx, sA.cy, sA.r + 14, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.5 * pulse;
        ctx.beginPath(); ctx.arc(sA.cx, sA.cy, sA.r + 20, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }
}

function renderPause(w, h) {
  // Dark frosted overlay
  ctx.fillStyle = 'rgba(14, 12, 24, 0.78)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const cardW = Math.min(w - 48, 300), cardH = 420;
  const cardX = cx - cardW / 2, cardY = cy - cardH / 2;

  // Card
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill(); ctx.stroke();
  ctx.restore();

  // Title
  ctx.fillStyle = '#d8d6e8';
  ctx.font = 'bold 26px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSE', cx, cardY + 50);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, cardY + 62); ctx.lineTo(cardX + cardW - 24, cardY + 62);
  ctx.stroke();

  // Resume button
  const resumeY = cardY + 82;
  ctx.fillStyle   = 'rgba(80,200,100,0.14)';
  ctx.strokeStyle = 'rgba(80,200,100,0.55)';
  ctx.lineWidth   = 1.5;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(cx - 90, resumeY, 180, 48, 9); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#7de899';
  ctx.font = 'bold 16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('再開', cx, resumeY + 30);

  // Reset button
  const resetY = cardY + 146;
  ctx.fillStyle   = 'rgba(200,70,70,0.12)';
  ctx.strokeStyle = 'rgba(200,70,70,0.42)';
  ctx.lineWidth   = 1.5;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(cx - 90, resetY, 180, 48, 9); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#e07878';
  ctx.font = 'bold 16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('リセット', cx, resetY + 30);

  // Divider before how-to
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, cardY + 212); ctx.lineTo(cardX + cardW - 24, cardY + 212);
  ctx.stroke();

  // How-to section
  ctx.fillStyle = 'rgba(200,195,230,0.55)';
  ctx.font = 'bold 11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('操作説明', cx, cardY + 230);

  const tips = [
    ['フリック', '移動'],
    ['敵をタップ', '解錠モード'],
    ['円外フリック', '緊急離脱'],
    ['下部タップ', '鍵を選択'],
    ['同色の鍵', 'クリティカルヒット'],
  ];
  const labelX = cardX + 20;
  const valX   = cardX + cardW - 20;
  let tipY = cardY + 252;
  ctx.font = '13px -apple-system, sans-serif';
  for (const [label, desc] of tips) {
    ctx.fillStyle = '#b8b4d4';
    ctx.textAlign = 'left';
    ctx.fillText(label, labelX, tipY);
    ctx.fillStyle = 'rgba(200,195,230,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(desc, valX, tipY);
    tipY += 26;
  }
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split('');
  let line = '';
  for (const ch of words) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line !== '') {
      ctx.fillText(line, cx, y); y += lineH; line = ch;
    } else { line = test; }
  }
  ctx.fillText(line, cx, y);
}

function renderEdgeIndicators() {
  const margin = 22; // distance inset from screen edge
  for (const e of enemies) {
    if (!e.alive) continue;
    const angle = Math.atan2(e.y - player.y, e.x - player.x);
    const { x, y } = screenEdgePoint(angle, margin);
    const sz = 7; // arrow half-size

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur  = 4;

    // Fill: enemy color (gray if D-V4 active), opacity by hp remaining
    const edgeMods = getMods();
    const edgeCol  = edgeMods.enemyColorFarHide > 0 ? '#888' : (COLOR_HEX[e.color] || CFG.KEY_COLOR);
    ctx.globalAlpha = 0.55 + (e.hp / e.maxHp) * 0.35;
    ctx.fillStyle   = edgeCol;
    ctx.beginPath();
    ctx.moveTo( sz,       0);
    ctx.lineTo(-sz * 0.6, -sz * 0.65);
    ctx.lineTo(-sz * 0.6,  sz * 0.65);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// Returns the point on the screen edge in the given angle from screen center
function screenEdgePoint(angle, margin) {
  const hw = W() / 2 - margin;
  const hh = H() / 2 - margin;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const tx = cos !== 0 ? hw / Math.abs(cos) : Infinity;
  const ty = sin !== 0 ? hh / Math.abs(sin) : Infinity;
  const t  = Math.min(tx, ty);
  return { x: W() / 2 + cos * t, y: H() / 2 + sin * t };
}

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,   x + w, y + r,   r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath(); ctx.fill();
}

// ══════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════
function loop() { update(); render(); requestAnimationFrame(loop); }

initPlayer();
spawnEnemies();
orbAnnounce = { label: 'Tap & Flick', color: '#cccccc', age: 0, maxAge: 110, slowFrames: 70 };
requestAnimationFrame(loop);
