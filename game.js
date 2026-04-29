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
// Phase table: time (seconds) → which colors can spawn
// New color introduced with only red, then previous colors gradually return
const COLOR_PHASES = [
  { t:   0, colors: ['red'] },
  { t:  60, colors: ['red', 'blue'] },
  { t: 120, colors: ['red', 'yellow'] },
  { t: 180, colors: ['red', 'blue', 'yellow'] },
  { t: 240, colors: ['red', 'green'] },
  { t: 300, colors: ['red', 'blue', 'green'] },
  { t: 360, colors: ['red', 'blue', 'yellow', 'green'] },
  { t: 420, colors: ['red', 'purple'] },
  { t: 480, colors: ['red', 'blue', 'purple'] },
  { t: 540, colors: ['red', 'blue', 'yellow', 'purple'] },
  { t: 600, colors: ['red', 'blue', 'yellow', 'green', 'purple'] },
];

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
  DUR_COST_NORMAL:    2,   // durability spent on non-crit hit
  DUR_COST_CRIT:      1,   // durability spent on crit hit
  GHOST_FRAMES:       90,
  UNLOCK_TOLERANCE:  Math.PI / 4,
  PLAYER_HP_MAX:     10,
  HIT_COOLDOWN:      90,
  SPAWN_INTERVAL:   480,   // frames between trickle spawns (~8s)
  ENEMY_COUNT_MAX:  14,    // hard cap
};

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

function updateCamera() {
  cam.x = player.x - W() * 0.5;
  cam.y = player.y - H() * 0.5;
}

// World ↔ Screen helpers
function w2s(wx, wy) { return { x: wx - cam.x, y: wy - cam.y }; }
function s2w(sx, sy) { return { x: sx + cam.x, y: sy + cam.y }; }

// ══════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════
const State = { IDLE: 'idle', CONNECTED: 'connected', GAMEOVER: 'gameover' };
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
// keyInventory stores durability totals, not counts
const keyInventory = { red: 16, blue: 0, yellow: 0, green: 0, purple: 0 };

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
  updateCamera();
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

function availableColors() {
  let phase = COLOR_PHASES[0];
  for (const p of COLOR_PHASES) {
    if (gameTime >= p.t) phase = p;
    else break;
  }
  return phase.colors;
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

  const cols = availableColors();
  const color = cols[Math.floor(Math.random() * cols.length)];

  // Color-specific stats
  const colorSpeedMult = { red: 1.0, blue: 0.5, yellow: 2.0, green: 1.0, purple: 1.1 };
  const colorHp        = { red: 6,   blue: 8,   yellow: 3,   green: 6,   purple: 6   };
  const spdMult = colorSpeedMult[color] || 1.0;
  const hp      = colorHp[color] || CFG.ENEMY_HP;
  const spd = CFG.ENEMY_BASE_SPEED * (0.5 + Math.random() * 0.8) * spdMult;
  const ang = Math.random() * Math.PI * 2;
  enemies.push({
    x, y,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    maxSpd: spd * 1.4,
    r:  CFG.ENEMY_R,
    hp,
    maxHp: hp,
    color,
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
const KEY_PICK_RADIUS  = 28;    // auto-collect distance
const KEY_BOB_AMP      = 3.5;   // pixel amplitude of bob
const KEY_BOB_SPEED    = 2.2;   // radians/s

function dropKey(x, y, color) {
  keyDrops.push({ x, y, color, age: 0 });
}

function updateKeyDrops() {
  for (let i = keyDrops.length - 1; i >= 0; i--) {
    const k = keyDrops[i];
    k.age++;
    if (Math.hypot(player.x - k.x, player.y - k.y) < KEY_PICK_RADIUS) {
      collectKey(k.color);
      addFx('keyCollect', k.x, k.y, { color: COLOR_HEX[k.color], maxAge: 22 });
      keyDrops.splice(i, 1);
    }
  }
}

function collectKey(color) {
  keyInventory[color] = (keyInventory[color] || 0) + CFG.KEY_DROP_DUR;
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

// hitsLanded: hits on this enemy so far after this blow (1 = first hit)
// maxHp: enemy's max HP — determines pitch ceiling
function playHitSound(hitsLanded, maxHp, crit) {
  const a   = ac();
  const now = a.currentTime;

  // Pitch rises from hit 1 → maxHp. Map to two octaves (220–880 Hz)
  const t        = Math.min((hitsLanded - 1) / Math.max(maxHp - 1, 1), 1);
  const baseFreq = 220 * Math.pow(4, t * 0.85);

  const master = a.createGain();
  master.gain.setValueAtTime(crit ? 0.5 : 0.32, now);
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

  // ── シャーン: metallic bell partials (1, 2.756, 5.404) ──
  const partials = [1, 2.756, 5.404];
  const amps     = [1.0, 0.45, 0.22];
  const decay    = 0.38 + t * 0.55 + (crit ? 0.25 : 0);

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
      if (keyInventory[s.color] > 0) selectedKeyColor = s.color;
      return true;
    }
  }
  return false;
}

function pointerDown(sx, sy) {
  if (handlePanelTap(sx, sy)) return;
  touch = { sx, sy, t: performance.now() };

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
  if (!touch) return;
  const dx   = sx - touch.sx;
  const dy   = sy - touch.sy;
  const dist = Math.hypot(dx, dy);
  const dt   = Math.max(performance.now() - touch.t, 25);

  if (state === State.IDLE) {
    if (dist < CFG.FLICK_MIN) {
      // Tap → immediate stop
      player.vx = player.vy = 0;
    } else {
      // Flick → move
      const spd = Math.min(dist / dt * 12, CFG.MAX_SPEED);
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
      emergencyEscape(dx, dy, dt);
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
  ghostTimer     = CFG.GHOST_FRAMES;
}

let selectedKeyColor = 'red';

function activeKeyColor() {
  return selectedKeyColor;
}

function tryUnlock(dx, dy) {
  if (!connectedEnemy) return;
  const flickAngle = Math.atan2(dy, dx);
  const diff = angleDiff(flickAngle, connectedEnemy.angleQueue[0]);
  if (Math.abs(diff) < CFG.UNLOCK_TOLERANCE) {
    const keyCol  = activeKeyColor();
    const hasKey  = keyInventory[keyCol] > 0;
    const crit    = hasKey && keyCol === connectedEnemy.color;
    const dmg     = crit ? 2 : 1;

    if (hasKey) {
      const durCost = crit ? CFG.DUR_COST_CRIT : CFG.DUR_COST_NORMAL;
      keyInventory[keyCol] = Math.max(0, keyInventory[keyCol] - durCost);
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
    });
    if (hasKey) applyKeyEffect(keyCol, connectedEnemy);
    if (connectedEnemy.hp <= 0) {
      fullyUnlock(connectedEnemy);
    } else {
      const hitsLanded = connectedEnemy.maxHp - connectedEnemy.hp;
      playHitSound(hitsLanded, connectedEnemy.maxHp, crit);
      ghostTimer = CFG.GHOST_FRAMES;
    }
  } else {
    uiShake = 10;
    addFx('miss', player.x, player.y, { maxAge: 16 });
  }
}

function angleDiff(a, b) {
  let d = a - b;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Called on crit — applies the active key's special effect
function applyKeyEffect(keyCol, target) {
  if (keyCol === 'blue') {
    // Slow: area debuff — all alive enemies within radius 220
    const SLOW_R = 220;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - target.x, e.y - target.y) < SLOW_R) {
        e.slowTimer = Math.max(e.slowTimer || 0, 180);
      }
    }
    addFx('slowAura', target.x, target.y, { maxAge: 30, color: COLOR_HEX['blue'] });
  } else if (keyCol === 'yellow') {
    // Chain: damage the closest other alive enemy
    let closest = null, bestDist = Infinity;
    for (const e of enemies) {
      if (!e.alive || e === target) continue;
      const d = Math.hypot(e.x - target.x, e.y - target.y);
      if (d < bestDist) { bestDist = d; closest = e; }
    }
    if (closest) {
      closest.hp = Math.max(0, closest.hp - 1);
      closest.crackShake = 12;
      addFx('chain', closest.x, closest.y, {
        color: COLOR_HEX['yellow'],
        fromX: target.x, fromY: target.y,
        maxAge: 28,
      });
      if (closest.hp <= 0) {
        // Chain kill — resolve without changing connected state
        closest.alive = false;
        score++;
        if (Math.random() < KEY_DROP_CHANCE) dropKey(closest.x, closest.y, closest.color);
        addFx('explosion', closest.x, closest.y, { color: COLOR_HEX[closest.color], maxAge: 45 });
      }
    }
  } else if (keyCol === 'green') {
    // Heal player +1 HP
    player.hp = Math.min(CFG.PLAYER_HP_MAX, player.hp + 1);
    addFx('heal', player.x, player.y, { maxAge: 35 });
  } else if (keyCol === 'purple') {
    // Bomb: 1 damage to all alive enemies within radius 160
    const BOMB_R = 160;
    addFx('bomb', target.x, target.y, { maxAge: 40, color: COLOR_HEX['purple'] });
    for (const e of enemies) {
      if (!e.alive || e === target) continue;
      if (Math.hypot(e.x - target.x, e.y - target.y) < BOMB_R) {
        e.hp = Math.max(0, e.hp - 1);
        e.crackShake = 10;
        if (e.hp <= 0) {
          e.alive = false;
          score++;
          if (Math.random() < KEY_DROP_CHANCE) dropKey(e.x, e.y, e.color);
          addFx('explosion', e.x, e.y, { color: COLOR_HEX[e.color], maxAge: 45 });
        }
      }
    }
  }
  // red: no special effect (シンプル)
}

function fullyUnlock(enemy) {
  enemy.alive = false;
  score++;
  const hex = COLOR_HEX[enemy.color] || CFG.KEY_COLOR;
  const [er, eg, eb] = [
    parseInt(hex.slice(1,3),16),
    parseInt(hex.slice(3,5),16),
    parseInt(hex.slice(5,7),16),
  ];
  addFx('explosion', enemy.x, enemy.y, { color: hex, maxAge: 55 });
  playUnlockSound();
  screenFlash = { r: er, g: eg, b: eb, alpha: 0.22 };
  if (Math.random() < KEY_DROP_CHANCE) dropKey(enemy.x, enemy.y, enemy.color);

  // Purple: death explosion — damages player if within 150px
  if (enemy.color === 'purple') {
    const PURP_R = 150;
    addFx('bomb', enemy.x, enemy.y, { maxAge: 35, color: COLOR_HEX['purple'] });
    if (player.invincible <= 0 && Math.hypot(player.x - enemy.x, player.y - enemy.y) < PURP_R) {
      player.hp = Math.max(0, player.hp - 1);
      player.invincible = CFG.HIT_COOLDOWN;
      player.hitFlash   = 22;
      addFx('dmg', player.x, player.y, { maxAge: 25 });
      if (player.hp <= 0) {
        player.hp = 0;
        state = State.GAMEOVER;
        connectedEnemy = null;
        setTimeout(resetGame, 3000);
        return;
      }
    }
  }

  connectedEnemy = null;
  state          = State.IDLE;
  ghostTimer     = 0;
  if (enemies.every(e => !e.alive)) setTimeout(() => spawnEnemies(), 1200);
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

function resetGame() {
  enemies.length = 0;
  effects.length = 0;
  keyDrops.length = 0;
  for (const c of COLORS) keyInventory[c] = 0;
  keyInventory.red = 16;
  score = 0; frame = 0; gameTime = 0; spawnTimer = 0;
  beamFlash = uiShake = ghostTimer = 0;
  screenFlash = null; connectedEnemy = null;
  selectedKeyColor = 'red';
  state = State.IDLE;
  initPlayer();
  spawnEnemies();
}

// ══════════════════════════════════════════════
//  UPDATE
// ══════════════════════════════════════════════
function update() {
  if (state === State.GAMEOVER) return;
  frame++;
  gameTime = frame / 60;
  const sf = state === State.CONNECTED ? CFG.SLOW_FACTOR : 1.0;

  // Player
  if (state === State.IDLE) {
    player.x += player.vx;
    player.y += player.vy;
    player.vx *= CFG.FRICTION;
    player.vy *= CFG.FRICTION;
  }
  if (player.invincible > 0) player.invincible--;
  if (player.hitFlash   > 0) player.hitFlash--;

  updateCamera();

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const slowMult = (e.slowTimer > 0) ? 0.3 : 1.0;
    if (e.slowTimer > 0) e.slowTimer--;
    e.x += e.vx * sf * slowMult;
    e.y += e.vy * sf * slowMult;
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    e.vx += Math.cos(a) * 0.04;
    e.vy += Math.sin(a) * 0.04;
    const spd = Math.hypot(e.vx, e.vy);
    if (spd > e.maxSpd) { e.vx = (e.vx / spd) * e.maxSpd; e.vy = (e.vy / spd) * e.maxSpd; }
    if (e.crackShake > 0) e.crackShake--;

    // Green: healer aura — restore 1 HP to nearby enemies every 120 frames
    if (e.color === 'green') {
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
        player.hp--;
        player.invincible = CFG.HIT_COOLDOWN;
        player.hitFlash   = 22;
        addFx('dmg', player.x, player.y, { maxAge: 25 });
        if (player.hp <= 0) {
          player.hp = 0;
          state = State.GAMEOVER;
          connectedEnemy = null;
          setTimeout(resetGame, 3000);
        }
      }
    }
  }

  // Continuous enemy trickle
  {
    const alive    = enemies.filter(e => e.alive).length;
    const maxCount = Math.min(CFG.ENEMY_COUNT_MAX, CFG.ENEMY_COUNT + Math.floor(gameTime / 30));
    const interval = Math.max(180, CFG.SPAWN_INTERVAL - Math.floor(gameTime / 20) * 40);
    spawnTimer++;
    if (spawnTimer >= interval && alive < maxCount) {
      spawnEnemy();
      spawnTimer = 0;
    }
  }

  updateKeyDrops();

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
function render() {
  const w = W(), h = H();
  const t = performance.now() / 1000;

  ctx.fillStyle = '#f8f7f4';
  ctx.fillRect(0, 0, w, h);

  // ── World transform ──
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  drawInfiniteGrid();
  renderEffectsWorld(t);
  renderKeyDrops(t);
  if (state === State.CONNECTED && connectedEnemy) renderBeam(t);
  for (const e of enemies) if (e.alive) renderEnemy(e, t);
  renderPlayer(t);

  ctx.restore();
  // ── Screen space ──

  if (screenFlash) {
    ctx.fillStyle = `rgba(${screenFlash.r},${screenFlash.g},${screenFlash.b},${screenFlash.alpha})`;
    ctx.fillRect(0, 0, w, h);
  }
  renderEdgeIndicators();
  if (state === State.CONNECTED) renderCircularUI(t);
  renderKeyPanel(t);
  renderHUD(w, h);
  if (state === State.GAMEOVER) renderGameOver(w, h);
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
  const focused = connectedEnemy === e;
  const ecol    = COLOR_HEX[e.color] || CFG.KEY_COLOR;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.crackShake > 0) ctx.translate((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 1.5);

  // Proximity pulse (colored)
  if (state === State.IDLE) {
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    if (d < 210) {
      ctx.globalAlpha = 0.10 + 0.07 * Math.sin(t * 3.5);
      ctx.strokeStyle = ecol; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Green healer: persistent aura ring
  if (e.color === 'green') {
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(t * 2.5 + (e.healAuraTimer || 0) * 0.1);
    ctx.strokeStyle = ecol; ctx.lineWidth = 1.2; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(0, 0, 200, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Purple: warning pulse showing blast radius
  if (e.color === 'purple') {
    ctx.globalAlpha = 0.07 + 0.05 * Math.sin(t * 5);
    ctx.strokeStyle = ecol; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]);
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

  // Body (subtle color tint)
  ctx.fillStyle   = focused ? `${ecol}28` : `${ecol}12`;
  ctx.strokeStyle = focused ? '#222' : '#777';
  ctx.lineWidth   = focused ? 2.5 : 1.5;
  ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Keyhole (colored)
  const kr = e.r * 0.28, ky = -e.r * 0.22, ksw = e.r * 0.22, ksh = e.r * 0.45;
  ctx.strokeStyle = focused ? ecol : `${ecol}99`; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, ky, kr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-ksw, ky + kr * 0.7); ctx.lineTo(-ksw, ky + ksh);
  ctx.lineTo( ksw, ky + ksh);      ctx.lineTo( ksw, ky + kr * 0.7);
  ctx.stroke();

  // Color dot above enemy
  ctx.fillStyle = ecol;
  ctx.beginPath(); ctx.arc(0, -e.r - 5, 3, 0, Math.PI * 2); ctx.fill();

  // HP pips (enemy color)
  for (let i = 0; i < e.maxHp; i++) {
    const a = (i / e.maxHp) * Math.PI * 2 - Math.PI * 0.5;
    ctx.fillStyle = i < e.hp ? ecol : '#ccc';
    ctx.beginPath(); ctx.arc(Math.cos(a) * (e.r + 7), Math.sin(a) * (e.r + 7), 2.5, 0, Math.PI * 2); ctx.fill();
  }

  const lost = e.maxHp - e.hp;
  if (lost > 0) {
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
    for (let i = 0; i < lost; i++) {
      const a = (i / e.maxHp) * Math.PI * 2 - Math.PI * 0.5;
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

  ctx.fillStyle = CFG.KEY_COLOR; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(player.r * 0.68, -player.r * 0.68, player.r * 0.28, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  ctx.restore();
}

function renderCircularUI(t) {
  const ps = playerScreenPos();
  const cx = ps.x, cy = ps.y;
  const shakeX = uiShake > 0 ? Math.sin(uiShake * 1.8) * (uiShake / 10) * 5 : 0;
  const _akc   = activeKeyColor();
  const keyCol = keyInventory[_akc] > 0 ? (COLOR_HEX[_akc] || CFG.KEY_COLOR) : '#888888';

  ctx.save();
  ctx.translate(shakeX, 0);

  // Inner ring (unlock zone) — active key color, no outer escape ring
  const dashOff = -(t * 0.55 % 1) * 20;
  ctx.globalAlpha = 1.0; ctx.strokeStyle = keyCol; ctx.lineWidth = 3.5;
  ctx.setLineDash([13, 7]); ctx.lineDashOffset = dashOff;
  ctx.beginPath(); ctx.arc(cx, cy, CFG.INNER_R, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.globalAlpha = 0.18; ctx.fillStyle = keyCol;
  ctx.beginPath(); ctx.arc(cx, cy, CFG.INNER_R, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Direction guides: show only as many arrows as hits remaining to kill
  if (connectedEnemy) {
    const q    = connectedEnemy.angleQueue;
    const hasKey  = keyInventory[activeKeyColor()] > 0;
    const dmg     = (hasKey && activeKeyColor() === connectedEnemy.color) ? 2 : 1;
    const hitsLeft = Math.ceil(connectedEnemy.hp / dmg);
    const show    = Math.min(hitsLeft, 3);
    const ghostAlpha = ghostTimer > 0 ? Math.min(ghostTimer / 25, 1) : 0.55;

    if (show >= 3 && q.length > 2) {
      ctx.globalAlpha = 0.25;
      renderDirectionGuide(cx, cy, q[2], keyCol, 2);
    }
    if (show >= 2 && q.length > 1) {
      ctx.globalAlpha = 0.52;
      renderDirectionGuide(cx, cy, q[1], keyCol, 3);
    }
    ctx.globalAlpha = ghostAlpha;
    renderDirectionGuide(cx, cy, q[0], keyCol, 5);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = 'rgba(110,108,103,0.55)';
  ctx.font = '11px -apple-system, "Helvetica Neue", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('円内フリック: 解錠  円外フリック: 離脱＆移動', cx, cy + CFG.INNER_R + 22);

  ctx.restore();
}

// lineW: stem line width (also scales arrowhead)
function renderDirectionGuide(cx, cy, angle, color, lineW = 4) {
  const stemStart = CFG.INNER_R * 0.25;
  const stemEnd   = CFG.OUTER_R * 0.88;
  const ex = cx + Math.cos(angle) * stemEnd;
  const ey = cy + Math.sin(angle) * stemEnd;

  // Tolerance fan (±45°)
  const baseAlpha = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = baseAlpha * 0.38;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle - CFG.UNLOCK_TOLERANCE) * CFG.INNER_R,
             cy + Math.sin(angle - CFG.UNLOCK_TOLERANCE) * CFG.INNER_R);
  ctx.arc(cx, cy, CFG.OUTER_R * 0.85, angle - CFG.UNLOCK_TOLERANCE, angle + CFG.UNLOCK_TOLERANCE);
  ctx.arc(cx, cy, CFG.INNER_R,        angle + CFG.UNLOCK_TOLERANCE, angle - CFG.UNLOCK_TOLERANCE, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Stem
  ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle) * stemStart, cy + Math.sin(angle) * stemStart);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Arrowhead (scales with lineW)
  const hw = Math.PI / 5;
  const hs = 10 + lineW * 2.4;
  ctx.fillStyle = color;
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
  const totalW  = (COLORS.length - 1) * spacing;
  const panelY  = h - 62;
  return COLORS.map((c, i) => ({
    color: c,
    cx: w / 2 - totalW / 2 + i * spacing,
    cy: panelY,
    r:  slotR,
  }));
}

function renderKeyPanel(t) {
  const w = W(), h = H();
  const slots  = keyPanelSlots();
  const panelY = h - 62;

  // Background pill
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#1e1e1e';
  const pw = slots[slots.length-1].cx - slots[0].cx + 80;
  roundRect(slots[0].cx - 40, panelY - 38, pw, 88, 18);
  ctx.restore();

  for (const s of slots) {
    const col     = COLOR_HEX[s.color];
    const dur     = keyInventory[s.color] || 0;
    const active  = selectedKeyColor === s.color;
    const hasKey  = dur > 0;
    // When active but empty, show grey to indicate colorless-key fallback
    const drawCol = (active && !hasKey) ? '#888888' : col;
    const pulse   = active ? 0.85 + 0.15 * Math.sin(t * 4) : 1;
    const DUR_MAX = 24;

    ctx.save();

    // Durability arc track
    ctx.strokeStyle = drawCol;
    ctx.lineWidth   = 3;
    ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2); ctx.stroke();

    // Filled arc for remaining durability
    if (dur > 0) {
      const ratio = Math.min(dur / DUR_MAX, 1);
      ctx.globalAlpha = active ? 0.85 * pulse : 0.5;
      ctx.strokeStyle = drawCol;
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
    }

    // Active selection ring
    if (active) {
      ctx.strokeStyle = drawCol;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.7 * pulse;
      ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r + 9, 0, Math.PI * 2); ctx.stroke();
    }

    // Slot background
    ctx.globalAlpha = hasKey ? 0.2 : (active ? 0.12 : 0.07);
    ctx.fillStyle   = drawCol;
    ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2); ctx.fill();

    // Diamond icon
    if (hasKey) {
      const sz = 9;
      ctx.globalAlpha = active ? 0.95 * pulse : 0.65;
      ctx.fillStyle   = col;
      ctx.beginPath();
      ctx.moveTo(s.cx,               s.cy - sz);
      ctx.lineTo(s.cx + sz * 0.65,   s.cy);
      ctx.lineTo(s.cx,               s.cy + sz);
      ctx.lineTo(s.cx - sz * 0.65,   s.cy);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = active ? 0.5 * pulse : 0.25;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Empty slot indicator
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = col; ctx.lineWidth = 1.2;
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
  const hpRatio = player.hp / CFG.PLAYER_HP_MAX;
  const hpCol = hpRatio > 0.5 ? '#3db86a' : hpRatio > 0.25 ? '#ddb830' : '#e8453c';
  if (barW * hpRatio > 6) { ctx.fillStyle = hpCol; roundRect(bx, by, barW * hpRatio, barH, 3); }
  ctx.fillStyle = '#888'; ctx.font = '10px -apple-system, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`HP ${player.hp} / ${CFG.PLAYER_HP_MAX}`, bx, by + barH + 13);

  ctx.fillStyle = '#999'; ctx.font = 'bold 13px -apple-system, monospace'; ctx.textAlign = 'right';
  ctx.fillText(`解錠 ${score}`, w - 16, 32);
  ctx.fillStyle = '#bbb'; ctx.font = '11px -apple-system, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`${Math.floor(gameTime)}s`, 16, 30);

  const alive = enemies.filter(e => e.alive).length;
  ctx.fillStyle = '#bbb'; ctx.font = '11px -apple-system, monospace'; ctx.textAlign = 'right';
  ctx.fillText(`トジテ ×${alive}`, w - 16, 48);

  ctx.fillStyle = '#aaa'; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'center';
  if (state === State.IDLE)
    ctx.fillText('タップ: 接続/停止  フリック: 移動', w / 2, h - 100);
  else
    ctx.fillText('内側起点フリック: 解錠  外側起点フリック: 離脱', w / 2, h - 100);
}

function renderGameOver(w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px -apple-system, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', w / 2, h / 2 - 18);
  ctx.fillStyle = '#aaa'; ctx.font = '16px -apple-system, sans-serif';
  ctx.fillText(`解錠数: ${score}`, w / 2, h / 2 + 14);
  ctx.fillText('まもなく再スタート…', w / 2, h / 2 + 40);
}

// ══════════════════════════════════════════════
//  EDGE INDICATORS
// ══════════════════════════════════════════════
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

    // Fill: enemy color, opacity by hp remaining
    ctx.globalAlpha = 0.55 + (e.hp / e.maxHp) * 0.35;
    ctx.fillStyle   = COLOR_HEX[e.color] || CFG.KEY_COLOR;
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
requestAnimationFrame(loop);
