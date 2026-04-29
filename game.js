// ─────────────────────────────────────────────
//  CroqKey — Core Prototype
//  Canvas 2D + Vanilla JS, no dependencies
// ─────────────────────────────────────────────

// ══════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════
const CFG = {
  PLAYER_R:        24,
  ENEMY_R:         22,
  ENEMY_COUNT:      6,
  ENEMY_BASE_SPEED: 0.9,
  SLOW_FACTOR:      0.25,   // world speed during connection
  FRICTION:         0.84,
  MAX_SPEED:        14,
  FLICK_MIN:        18,     // px – minimum flick distance
  INNER_R:          62,     // circular UI inner ring
  OUTER_R:          98,     // circular UI outer ring
  KEY_COLOR:       '#e8453c',
  ENEMY_HP:         3,
  GHOST_FRAMES:     90,
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
window.addEventListener('resize', () => { resize(); initPlayer(); });

const W = () => canvas.width;
const H = () => canvas.height;

// ══════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════
const State = { IDLE: 'idle', CONNECTED: 'connected' };
let state         = State.IDLE;
let connectedEnemy = null;
let score          = 0;
let frame          = 0;

// timers (in frames)
let beamFlash  = 0;
let uiShake    = 0;
let ghostTimer = 0;
let screenFlash = null; // { r, g, b, alpha }

// ══════════════════════════════════════════════
//  PLAYER
// ══════════════════════════════════════════════
const player = { x: 0, y: 0, vx: 0, vy: 0, r: CFG.PLAYER_R, invincible: 0 };

function initPlayer() {
  player.x = W() / 2;
  player.y = H() * 0.65;
  player.vx = player.vy = 0;
}

// ══════════════════════════════════════════════
//  ENEMIES
// ══════════════════════════════════════════════
const enemies = [];
const DIRS    = ['right', 'left', 'up', 'down'];

function spawnEnemies() {
  enemies.length = 0;
  for (let i = 0; i < CFG.ENEMY_COUNT; i++) addEnemy();
}

function addEnemy() {
  const margin = 90;
  let x, y, tries = 0;
  do {
    x = margin + Math.random() * (W() - margin * 2);
    y = margin + Math.random() * (H() - margin * 2);
  } while (++tries < 20 && Math.hypot(x - player.x, y - player.y) < 140);

  const spd   = CFG.ENEMY_BASE_SPEED * (0.5 + Math.random() * 0.8);
  const angle = Math.random() * Math.PI * 2;
  enemies.push({
    x, y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    r:  CFG.ENEMY_R,
    hp: CFG.ENEMY_HP,
    maxHp: CFG.ENEMY_HP,
    requiredDir: DIRS[Math.floor(Math.random() * DIRS.length)],
    alive: true,
    crackShake: 0,  // frames of crack shake
  });
}

// ══════════════════════════════════════════════
//  VISUAL EFFECTS
// ══════════════════════════════════════════════
const effects = [];

function addFx(type, x, y, opts = {}) {
  effects.push({ type, x, y, age: 0, maxAge: 30, ...opts });
}

// ══════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════
let touch = null; // { x, y, t }

function pointerDown(x, y) {
  touch = { x, y, t: performance.now() };

  if (state === State.IDLE) {
    // Try to connect to tapped enemy
    for (const e of enemies) {
      if (!e.alive) continue;
      if (Math.hypot(x - e.x, y - e.y) < e.r + 28) {
        connectEnemy(e);
        touch = null;
        return;
      }
    }
  }
}

function pointerUp(x, y) {
  if (!touch) return;
  const dx = x - touch.x;
  const dy = y - touch.y;
  const dist = Math.hypot(dx, dy);
  const dt   = Math.max(performance.now() - touch.t, 30);

  if (state === State.IDLE) {
    if (dist > CFG.FLICK_MIN) {
      const spd = Math.min(dist / dt * 22, CFG.MAX_SPEED);
      const a   = Math.atan2(dy, dx);
      player.vx = Math.cos(a) * spd;
      player.vy = Math.sin(a) * spd;
    }
  } else if (state === State.CONNECTED) {
    const uiDist = Math.hypot(x - player.x, y - player.y);
    if (uiDist > CFG.OUTER_R - 8) {
      emergencyEscape();
    } else if (dist > CFG.FLICK_MIN) {
      tryUnlock(dx, dy);
    }
  }

  touch = null;
}

// Touch
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  pointerDown(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  pointerUp(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener('touchcancel', e => { e.preventDefault(); touch = null; }, { passive: false });

// Mouse (desktop testing)
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

function tryUnlock(dx, dy) {
  if (!connectedEnemy) return;
  const detected = flickDir(dx, dy);
  if (detected === connectedEnemy.requiredDir) {
    connectedEnemy.hp--;
    connectedEnemy.crackShake = 18;
    beamFlash = 8;
    addFx('hit', connectedEnemy.x, connectedEnemy.y, { color: CFG.KEY_COLOR, maxAge: 22 });

    if (connectedEnemy.hp <= 0) {
      fullyUnlock(connectedEnemy);
    } else {
      ghostTimer = CFG.GHOST_FRAMES; // show hint again
    }
  } else {
    uiShake = 10;
    addFx('miss', player.x, player.y, { maxAge: 16 });
  }
}

function fullyUnlock(enemy) {
  enemy.alive = false;
  score++;
  addFx('explosion', enemy.x, enemy.y, { color: CFG.KEY_COLOR, maxAge: 55 });
  screenFlash = { r: 232, g: 69, b: 60, alpha: 0.35 };
  connectedEnemy = null;
  state          = State.IDLE;
  ghostTimer     = 0;

  if (enemies.every(e => !e.alive)) {
    setTimeout(() => spawnEnemies(), 1200);
  }
}

function emergencyEscape() {
  if (connectedEnemy) {
    const dx = player.x - connectedEnemy.x;
    const dy = player.y - connectedEnemy.y;
    const len = Math.hypot(dx, dy) || 1;
    player.vx = (dx / len) * 5;
    player.vy = (dy / len) * 5;
  }
  player.invincible = 14;
  addFx('escape', player.x, player.y, { maxAge: 22 });
  connectedEnemy = null;
  state          = State.IDLE;
  ghostTimer     = 0;
}

function flickDir(dx, dy) {
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  if (a > -45  && a <=  45) return 'right';
  if (a >  45  && a <= 135) return 'down';
  if (a > 135  || a <= -135) return 'left';
  return 'up';
}

// ══════════════════════════════════════════════
//  UPDATE
// ══════════════════════════════════════════════
function update() {
  frame++;
  const sf = state === State.CONNECTED ? CFG.SLOW_FACTOR : 1.0;

  // Player
  if (state === State.IDLE) {
    player.x += player.vx;
    player.y += player.vy;
    player.vx *= CFG.FRICTION;
    player.vy *= CFG.FRICTION;
    player.x = clamp(player.x, player.r, W() - player.r);
    player.y = clamp(player.y, player.r, H() - player.r);
  }
  if (player.invincible > 0) player.invincible--;

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    e.x += e.vx * sf;
    e.y += e.vy * sf;
    if (e.x < e.r || e.x > W() - e.r) { e.vx *= -1; e.x = clamp(e.x, e.r, W() - e.r); }
    if (e.y < e.r || e.y > H() - e.r) { e.vy *= -1; e.y = clamp(e.y, e.r, H() - e.r); }
    if (e.crackShake > 0) e.crackShake--;
  }

  // Effects
  for (let i = effects.length - 1; i >= 0; i--) {
    if (++effects[i].age >= effects[i].maxAge) effects.splice(i, 1);
  }

  // Timers
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

  // Background
  ctx.fillStyle = '#f8f7f4';
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.save();
  ctx.strokeStyle = '#e6e4de';
  ctx.lineWidth = 0.5;
  const gs = 48;
  for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.restore();

  // Effects (behind entities)
  renderEffects(t);

  // Beam
  if (state === State.CONNECTED && connectedEnemy) renderBeam(t);

  // Enemies
  for (const e of enemies) if (e.alive) renderEnemy(e, t);

  // Player
  renderPlayer(t);

  // Circular UI
  if (state === State.CONNECTED) renderCircularUI(t);

  // Screen flash overlay
  if (screenFlash) {
    ctx.fillStyle = `rgba(${screenFlash.r},${screenFlash.g},${screenFlash.b},${screenFlash.alpha})`;
    ctx.fillRect(0, 0, w, h);
  }

  // HUD
  renderHUD(w, h);
}

// ──────────────────────────────────────────────
function renderEffects(t) {
  for (const e of effects) {
    const p = e.age / e.maxAge; // 0→1
    ctx.save();

    if (e.type === 'explosion') {
      // Expanding ring
      ctx.globalAlpha = (1 - p) * 0.65;
      ctx.strokeStyle = e.color;
      ctx.lineWidth   = 3 * (1 - p) + 0.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 75, 0, Math.PI * 2); ctx.stroke();
      // Fill glow
      ctx.globalAlpha = (1 - p) * 0.18;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 50, 0, Math.PI * 2); ctx.fill();
      // Sparks
      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a  = (i / 8) * Math.PI * 2;
        const r0 = p * 35;
        const r1 = p * 65;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0);
        ctx.lineTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1);
        ctx.stroke();
      }
    }

    if (e.type === 'hit') {
      ctx.globalAlpha = (1 - p) * 0.75;
      ctx.strokeStyle = e.color;
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * 22, 0, Math.PI * 2); ctx.stroke();
    }

    if (e.type === 'escape') {
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.strokeStyle = '#888';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, p * CFG.OUTER_R, 0, Math.PI * 2); ctx.stroke();
    }

    if (e.type === 'miss') {
      ctx.globalAlpha = (1 - p) * 0.55;
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth   = 1.5;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + p * Math.PI;
        const r = p * 22;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 6);
        ctx.lineTo(e.x + Math.cos(a) * r,  e.y + Math.sin(a) * r);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

// ──────────────────────────────────────────────
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
    const wobble = Math.sin(u * Math.PI * 4 + t * 9) * 4.5 * Math.sin(u * Math.PI);
    pts.push({ x: bx + nx * wobble, y: by + ny * wobble });
  }

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap  = 'round';

  // Glow
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = CFG.KEY_COLOR;
  ctx.lineWidth   = 12;
  drawPath(pts);

  // Core
  ctx.globalAlpha = flash ? 1.0 : 0.88;
  ctx.strokeStyle = flash ? '#fff' : CFG.KEY_COLOR;
  ctx.lineWidth   = flash ? 4.5 : 2.0;
  drawPath(pts);

  ctx.restore();
}

function drawPath(pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

// ──────────────────────────────────────────────
function renderEnemy(e, t) {
  const focused = connectedEnemy === e;

  ctx.save();
  ctx.translate(e.x, e.y);

  // Crack shake
  if (e.crackShake > 0) {
    const s = (Math.random() - 0.5) * 2.5;
    ctx.translate(s, s * 0.5);
  }

  // Proximity pulse ring (idle only)
  if (state === State.IDLE) {
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist < 210) {
      ctx.globalAlpha = 0.12 + 0.09 * Math.sin(t * 3.5);
      ctx.strokeStyle = '#777';
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Body
  ctx.fillStyle   = focused ? 'rgba(190,188,183,0.3)' : 'rgba(210,208,202,0.15)';
  ctx.strokeStyle = focused ? '#222' : '#777';
  ctx.lineWidth   = focused ? 2.5 : 1.5;
  ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Keyhole
  ctx.strokeStyle = focused ? '#2a2a2a' : '#888';
  ctx.fillStyle   = focused ? '#2a2a2a' : '#888';
  ctx.lineWidth   = 1.5;
  // Circle
  ctx.beginPath(); ctx.arc(0, -5, 5.5, 0, Math.PI * 2); ctx.stroke();
  // Stem
  ctx.beginPath();
  ctx.moveTo(-4, -1.5);
  ctx.lineTo(-4,  7);
  ctx.lineTo( 4,  7);
  ctx.lineTo( 4, -1.5);
  ctx.stroke();

  // HP pips (small dots around perimeter)
  for (let i = 0; i < e.maxHp; i++) {
    const a  = (i / e.maxHp) * Math.PI * 2 - Math.PI * 0.5;
    const r  = e.r + 7;
    ctx.fillStyle = i < e.hp ? CFG.KEY_COLOR : '#ccc';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crack lines (one per lost HP)
  const lost = e.maxHp - e.hp;
  if (lost > 0) {
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth   = 1;
    for (let i = 0; i < lost; i++) {
      const a  = (i / e.maxHp) * Math.PI * 2 - Math.PI * 0.5;
      const r0 = e.r * 0.45;
      const r1 = e.r * 0.88;
      const da = 0.35;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)      * r0, Math.sin(a)      * r0);
      ctx.lineTo(Math.cos(a + da) * r1, Math.sin(a + da) * r1);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ──────────────────────────────────────────────
function renderPlayer(t) {
  ctx.save();
  ctx.translate(player.x, player.y);

  // Invincible blink
  if (player.invincible > 0 && Math.floor(player.invincible / 3) % 2 === 1) {
    ctx.globalAlpha = 0.35;
  }

  // Outer ring
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI * 2); ctx.stroke();

  // Dark inner fill
  ctx.fillStyle = '#242424';
  ctx.beginPath(); ctx.arc(0, 0, player.r * 0.65, 0, Math.PI * 2); ctx.fill();

  // Eyes: dot + horizontal line (design spec)
  ctx.strokeStyle = '#f0ede6';
  ctx.fillStyle   = '#f0ede6';
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = 'round';
  for (const ex of [-7, 7]) {
    ctx.beginPath(); ctx.arc(ex, -3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ex - 4.5, -3); ctx.lineTo(ex + 4.5, -3); ctx.stroke();
  }

  // Key gem (colored accent, top-right)
  const kx = player.r * 0.68, ky = -player.r * 0.68;
  ctx.fillStyle   = CFG.KEY_COLOR;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.arc(kx, ky, 4.5, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  ctx.restore();
}

// ──────────────────────────────────────────────
function renderCircularUI(t) {
  const cx = player.x;
  const cy = player.y;

  // Shake translation
  const shakeX = uiShake > 0 ? Math.sin(uiShake * 1.8) * (uiShake / 10) * 5 : 0;
  ctx.save();
  ctx.translate(shakeX, 0);

  // ── Outer ring (escape zone) ──
  ctx.strokeStyle = 'rgba(200, 68, 68, 0.42)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([9, 6]);
  ctx.beginPath(); ctx.arc(cx, cy, CFG.OUTER_R, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(200, 68, 68, 0.04)';
  ctx.beginPath(); ctx.arc(cx, cy, CFG.OUTER_R, 0, Math.PI * 2); ctx.fill();

  // ── Inner ring (input zone, flowing dashes) ──
  const dashOffset = -(t * 0.55 % 1) * 20;
  ctx.globalAlpha = 0.78;
  ctx.strokeStyle = CFG.KEY_COLOR;
  ctx.lineWidth   = 2.2;
  ctx.setLineDash([13, 7]);
  ctx.lineDashOffset = dashOffset;
  ctx.beginPath(); ctx.arc(cx, cy, CFG.INNER_R, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = CFG.KEY_COLOR;
  ctx.beginPath(); ctx.arc(cx, cy, CFG.INNER_R, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // ── Ghost direction guide ──
  if (ghostTimer > 0 && connectedEnemy) {
    const alpha = Math.min(ghostTimer / 25, 1) * 0.58;
    ctx.globalAlpha = alpha;
    renderDirectionGuide(cx, cy, connectedEnemy.requiredDir);
    ctx.globalAlpha = 1;
  }

  // ── Zone labels ──
  ctx.fillStyle = 'rgba(110,108,103,0.55)';
  ctx.font      = '11px -apple-system, "Helvetica Neue", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('フリック: 解錠',  cx, cy + CFG.OUTER_R + 18);
  ctx.fillText('外側へ: 緊急離脱', cx, cy + CFG.OUTER_R + 33);

  ctx.restore();
}

function renderDirectionGuide(cx, cy, dir) {
  const dirAngles = { right: 0, left: Math.PI, up: -Math.PI / 2, down: Math.PI / 2 };
  const a   = dirAngles[dir] ?? 0;
  const len = CFG.INNER_R * 0.62;
  const ex  = cx + Math.cos(a) * len;
  const ey  = cy + Math.sin(a) * len;

  ctx.strokeStyle = CFG.KEY_COLOR;
  ctx.fillStyle   = CFG.KEY_COLOR;
  ctx.lineWidth   = 2.8;
  ctx.lineCap     = 'round';

  // Stem (starts slightly off-center so it doesn't obscure player)
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Arrowhead (filled triangle)
  const hw = Math.PI / 5.5;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - Math.cos(a - hw) * 14, ey - Math.sin(a - hw) * 14);
  ctx.lineTo(ex - Math.cos(a + hw) * 14, ey - Math.sin(a + hw) * 14);
  ctx.closePath();
  ctx.fill();
}

// ──────────────────────────────────────────────
function renderHUD(w, h) {
  // HP bar (top-center, thin)
  const barW = Math.min(w * 0.52, 260);
  const barH = 4;
  const bx   = (w - barW) / 2;
  const by   = 18;

  ctx.fillStyle = '#dbd9d2';
  roundRect(bx, by, barW, barH, 2);

  ctx.fillStyle = CFG.KEY_COLOR;
  roundRect(bx, by, barW * 0.72, barH, 2);

  // Score (top-right)
  ctx.fillStyle = '#999';
  ctx.font      = 'bold 13px -apple-system, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`解錠 ${score}`, w - 16, 32);

  // Alive count (top-left)
  const alive = enemies.filter(e => e.alive).length;
  ctx.fillStyle = '#bbb';
  ctx.font      = '12px -apple-system, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`トジテ ×${alive}`, 16, 32);

  // State hint (bottom)
  ctx.fillStyle = '#aaa';
  ctx.font      = '11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  if (state === State.IDLE) {
    ctx.fillText('トジテをタップして接続 | フリックで移動', w / 2, h - 18);
  } else {
    ctx.fillText('内側フリック: 解錠  |  外側フリック: 緊急離脱', w / 2, h - 18);
  }
}

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

// ══════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════
function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
initPlayer();
spawnEnemies();
requestAnimationFrame(loop);
