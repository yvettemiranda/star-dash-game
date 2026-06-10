const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const weaponEl = document.getElementById("weapon");
const panel = document.getElementById("panel");
const panelText = document.getElementById("panelText");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");

const storageKey = "star-dash-best";
const weaponNames = {
  normal: "普通",
  spread: "散射",
  beam: "激光",
  pulse: "脉冲",
  fan: "扇翼",
  laser: "重光",
  nova: "星爆",
  prism: "棱镜",
  storm: "风暴",
  lance: "长枪",
  singular: "奇点",
  shield: "护盾"
};

const powerups = [
  { type: "spread", color: "#ffe06f", label: "散" },
  { type: "beam", color: "#53acff", label: "光" },
  { type: "pulse", color: "#b987ff", label: "脉" },
  { type: "shield", color: "#8ef36e", label: "盾" }
];

const state = {
  mode: "ready",
  width: 720,
  height: 1280,
  dpr: 1,
  time: 0,
  score: 0,
  bonusScore: 0,
  best: Number(localStorage.getItem(storageKey) || 0),
  speed: 300,
  spawnTimer: 0,
  powerTimer: 0,
  shotTimer: 0,
  bossTimer: 28,
  enemyTimer: 4,
  shake: 0,
  pointerActive: false,
  targetX: 360,
  targetY: 960,
  ship: { x: 360, y: 960, r: 20, shield: 0, armor: 8 },
  weapon: "normal",
  weaponLevel: 0,
  ammo: { spread: 0, beam: 0, pulse: 0 },
  rocks: [],
  powerups: [],
  bullets: [],
  enemyShots: [],
  enemies: [],
  particles: [],
  stars: [],
  clouds: [],
  comets: [],
  nextComet: 4,
  boss: null,
  lastFrame: 0
};

bestEl.textContent = state.best;
updateWeaponHud();

function resize() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = Math.max(320, Math.floor(rect.width));
  state.height = Math.max(480, Math.floor(rect.height));
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  state.targetX = clamp(state.targetX, 36, state.width - 36);
  state.targetY = clamp(state.targetY, 96, state.height - 36);
  state.ship.x = clamp(state.ship.x, 36, state.width - 36);
  state.ship.y = clamp(state.ship.y, 96, state.height - 36);
  seedStars();
  seedClouds();
}

function seedStars() {
  const count = Math.floor(state.width * state.height / 7600);
  state.stars = Array.from({ length: count }, () => ({
    x: Math.random() * state.width,
    y: Math.random() * state.height,
    r: Math.random() * 1.9 + 0.35,
    v: Math.random() * 42 + 22,
    hue: Math.random()
  }));
}

function seedClouds() {
  const count = Math.max(5, Math.floor(state.height / 140));
  state.clouds = Array.from({ length: count }, (_, index) => ({
    x: Math.random() * state.width,
    y: (state.height / count) * index + rand(-50, 50),
    r: rand(95, 210),
    vx: rand(-8, 8),
    vy: rand(8, 18),
    tone: Math.random()
  }));
}

function reset() {
  state.mode = "playing";
  state.time = 0;
  state.score = 0;
  state.bonusScore = 0;
  state.speed = 300;
  state.spawnTimer = 1.6;
  state.powerTimer = 1.4;
  state.shotTimer = 0.15;
  state.bossTimer = 46;
  state.enemyTimer = 4.2;
  state.shake = 0;
  state.weapon = "normal";
  state.weaponLevel = 0;
  state.ammo = { spread: 0, beam: 0, pulse: 0 };
  state.rocks = [];
  state.powerups = [];
  state.bullets = [];
  state.enemyShots = [];
  state.enemies = [];
  state.particles = [];
  state.comets = [];
  state.nextComet = 3.5;
  state.boss = null;
  state.ship.x = state.width / 2;
  state.ship.y = state.height * 0.78;
  state.ship.shield = 3;
  state.ship.armor = 8;
  state.targetX = state.ship.x;
  state.targetY = state.ship.y;
  scoreEl.textContent = "0";
  updateWeaponHud();
  pauseBtn.textContent = "Ⅱ";
  panel.classList.add("hidden");
}

function togglePause() {
  if (state.mode === "playing") {
    state.mode = "paused";
    pauseBtn.textContent = "▶";
    showPanel("暂停中", "黄色散射、蓝色激光、紫色脉冲会永久组合升级；绿色护盾保命。", "继续");
  } else if (state.mode === "paused") {
    state.mode = "playing";
    pauseBtn.textContent = "Ⅱ";
    panel.classList.add("hidden");
  }
}

function showPanel(title, text, buttonText) {
  panel.querySelector("h1").textContent = title;
  panelText.textContent = text;
  startBtn.textContent = buttonText;
  panel.classList.remove("hidden");
}

function gameOver() {
  state.mode = "over";
  state.shake = 16;
  burst(state.ship.x, state.ship.y, "#ff5b71", 38);
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(storageKey, String(state.best));
    bestEl.textContent = state.best;
  }
  showPanel("撞毁了", `本局 ${state.score} 分。多捡不同核心会解锁组合火力，下一把更容易滚起来。`, "再来");
}

function update(dt) {
  if (state.mode !== "playing") return;

  state.time += dt;
  state.speed = 205 + Math.min(245, state.time * 4.2);
  state.score = Math.floor(state.time * 8) + state.bonusScore;
  scoreEl.textContent = state.score;

  const hadShield = state.ship.shield > 0;
  state.ship.shield = Math.max(0, state.ship.shield - dt * 0.08);
  if (hadShield && state.ship.shield <= 0) {
    updateWeaponHud();
  }

  moveShip(dt);
  updateStars(dt);
  updateScenery(dt);
  updateSpawns(dt);
  firePlayer(dt);
  updateEnemies(dt);
  updateBoss(dt);
  moveBullets(dt);
  moveFalling(dt);
  updateParticles(dt);
  checkCollisions();
  state.shake = Math.max(0, state.shake - dt * 32);
}

function moveShip(dt) {
  state.ship.x += (state.targetX - state.ship.x) * Math.min(1, dt * 12);
  state.ship.y += (state.targetY - state.ship.y) * Math.min(1, dt * 12);
}

function updateStars(dt) {
  for (const star of state.stars) {
    star.y += star.v * dt + state.speed * dt * 0.1;
    if (star.y > state.height + 4) {
      star.y = -4;
      star.x = Math.random() * state.width;
      star.hue = Math.random();
    }
  }
}

function updateScenery(dt) {
  for (const cloud of state.clouds) {
    cloud.x += cloud.vx * dt;
    cloud.y += cloud.vy * dt + state.speed * dt * 0.025;
    if (cloud.y - cloud.r > state.height) {
      cloud.y = -cloud.r;
      cloud.x = Math.random() * state.width;
      cloud.r = rand(95, 210);
      cloud.tone = Math.random();
    }
    if (cloud.x < -cloud.r) cloud.x = state.width + cloud.r;
    if (cloud.x > state.width + cloud.r) cloud.x = -cloud.r;
  }

  state.nextComet -= dt;
  if (state.nextComet <= 0) {
    state.comets.push({
      x: rand(-80, state.width * 0.7),
      y: rand(-80, state.height * 0.34),
      vx: rand(170, 260),
      vy: rand(170, 240),
      life: rand(1.1, 1.8),
      maxLife: 1.8,
      color: Math.random() > 0.5 ? "#53acff" : "#ffe06f"
    });
    state.nextComet = rand(7, 11);
  }

  for (const comet of state.comets) {
    comet.x += comet.vx * dt;
    comet.y += comet.vy * dt;
    comet.life -= dt;
  }
  state.comets = state.comets.filter((comet) => comet.life > 0 && comet.x < state.width + 160 && comet.y < state.height + 160);
}

function updateSpawns(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnRock();
    state.spawnTimer = Math.max(0.92, 1.62 - state.time * 0.0035);
  }

  state.powerTimer -= dt;
  if (state.powerTimer <= 0) {
    spawnPowerup();
    state.powerTimer = rand(3.1, 4.6);
  }

  if (!state.boss) {
    state.bossTimer -= dt;
    if (state.bossTimer <= 0) spawnBoss();
  }

  state.enemyTimer -= dt;
  if (state.enemyTimer <= 0) {
    spawnEnemy();
    state.enemyTimer = Math.max(1.65, rand(4.2, 6.2) - difficultyTier() * 0.42);
  }
}

function firePlayer(dt) {
  state.shotTimer -= dt;
  if (state.shotTimer > 0) return;

  const level = state.weaponLevel;
  if (state.weapon === "singular") {
    addBullet(-0.4, "#ffe06f", 18 + level * 2, 1.1);
    addBullet(-0.16, "#b987ff", 24 + level * 2, 1.25, -9);
    addBullet(0, "#f6f0e6", 34 + level * 3, 1.52);
    addBullet(0.16, "#53acff", 24 + level * 2, 1.25, 9);
    addBullet(0.4, "#ffe06f", 18 + level * 2, 1.1);
    state.shotTimer = 0.1;
  } else if (state.weapon === "prism") {
    addBullet(-0.34, "#ffe06f", 16 + level * 2);
    addBullet(0, "#53acff", 28 + level * 3, 1.42);
    addBullet(0.34, "#ffe06f", 16 + level * 2);
    state.shotTimer = 0.12;
  } else if (state.weapon === "storm") {
    addBullet(-0.48, "#ffe06f", 15 + level * 2);
    addBullet(-0.2, "#b987ff", 22 + level * 2, 1.12);
    addBullet(0.2, "#b987ff", 22 + level * 2, 1.12);
    addBullet(0.48, "#ffe06f", 15 + level * 2);
    state.shotTimer = 0.14;
  } else if (state.weapon === "lance") {
    addBullet(-0.08, "#b987ff", 20 + level * 2, 1.2, -8);
    addBullet(0, "#53acff", 34 + level * 3, 1.55);
    addBullet(0.08, "#b987ff", 20 + level * 2, 1.2, 8);
    state.shotTimer = 0.1;
  } else if (state.weapon === "fan" || state.weapon === "spread") {
    const wing = level >= 2 ? 0.48 : 0.3;
    addBullet(-wing, "#ffe06f", 14 + level * 2);
    addBullet(0, "#fff7bb", 16 + level * 2);
    addBullet(wing, "#ffe06f", 14 + level * 2);
    if (level >= 2) {
      addBullet(-0.18, "#ffe9a6", 13 + level * 2, 1.04, -8);
      addBullet(0.18, "#ffe9a6", 13 + level * 2, 1.04, 8);
    }
    state.shotTimer = 0.17;
  } else if (state.weapon === "laser" || state.weapon === "beam") {
    addBullet(0, "#53acff", 24 + level * 4, 1.35);
    addBullet(0, "#bfe6ff", 13 + level * 2, 1.15, -13);
    addBullet(0, "#bfe6ff", 13 + level * 2, 1.15, 13);
    if (level >= 2) addBullet(0, "#f6f0e6", 18 + level * 2, 1.55);
    state.shotTimer = 0.11;
  } else if (state.weapon === "nova" || state.weapon === "pulse") {
    addBullet(-0.14, "#b987ff", 20 + level * 3, 1.08, -8);
    addBullet(0.14, "#d8c2ff", 20 + level * 3, 1.08, 8);
    if (level >= 2) addBullet(0, "#f6f0e6", 22 + level * 3, 1.22);
    state.shotTimer = 0.15;
  } else {
    addBullet(0, "#36d6b5", 15 + level);
    state.shotTimer = 0.2;
  }
}

function addBullet(angle, color, damage, speed = 1, offsetX = 0) {
  state.bullets.push({
    x: state.ship.x + offsetX,
    y: state.ship.y - 30,
    vx: Math.sin(angle) * 330,
    vy: -680 * speed,
    r: state.weapon === "beam" ? 5 : 4,
    color,
    damage
  });
}

function updateBoss(dt) {
  const boss = state.boss;
  if (!boss) return;

  boss.t += dt;
  boss.x = state.width / 2 + Math.sin(boss.t * 1.35) * Math.min(120, state.width * 0.26);
  boss.y += (boss.targetY - boss.y) * Math.min(1, dt * 2.2);
  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    fireBoss(boss);
    boss.fireTimer = Math.max(0.95, 1.28 - state.time * 0.0016);
  }
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    enemy.t += dt;
    enemy.y += enemy.vy * dt;
    if (enemy.kind === "zig") {
      enemy.x += Math.sin(enemy.t * 5.2) * enemy.drift * dt;
    } else {
      enemy.x += enemy.vx * dt;
    }
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && enemy.y > 20 && enemy.y < state.height * 0.72) {
      fireEnemy(enemy);
      enemy.fireTimer = enemy.kind === "guard" ? rand(1.6, 2.2) : rand(2.1, 2.8);
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.y < state.height + 70 && enemy.x > -80 && enemy.x < state.width + 80);
}

function fireEnemy(enemy) {
  const base = Math.atan2(state.ship.x - enemy.x, state.ship.y - enemy.y);
  const spread = enemy.kind === "guard" ? [-0.18, 0.18] : [0];
  for (const offset of spread) {
    const angle = base + offset;
    state.enemyShots.push({
      x: enemy.x,
      y: enemy.y + enemy.r,
      vx: Math.sin(angle) * (64 + difficultyTier() * 6),
      vy: Math.cos(angle) * (118 + difficultyTier() * 8),
      r: 4.5,
      color: enemy.kind === "guard" ? "#b987ff" : "#ffb15f"
    });
  }
}

function fireBoss(boss) {
  const base = Math.atan2(state.ship.x - boss.x, state.ship.y - boss.y);
  const tier = difficultyTier();
  const offsets = tier < 3 ? [-0.32, 0, 0.32] : [-0.46, -0.18, 0.18, 0.46];
  for (const offset of offsets) {
    const angle = base + offset;
    state.enemyShots.push({
      x: boss.x,
      y: boss.y + boss.r * 0.5,
      vx: Math.sin(angle) * (82 + tier * 5),
      vy: Math.cos(angle) * (132 + tier * 8),
      r: 5.5 + Math.min(2, tier * 0.25),
      color: "#ff7b92"
    });
  }
}

function moveBullets(dt) {
  for (const shot of state.bullets) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }
  for (const shot of state.enemyShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }
  state.bullets = state.bullets.filter((shot) => shot.y > -60 && shot.x > -50 && shot.x < state.width + 50);
  state.enemyShots = state.enemyShots.filter((shot) => shot.y < state.height + 70 && shot.x > -80 && shot.x < state.width + 80);
}

function moveFalling(dt) {
  for (const rock of state.rocks) {
    rock.y += state.speed * rock.vy * dt;
    rock.x += rock.vx * dt;
    rock.a += rock.spin * dt;
  }
  for (const item of state.powerups) {
    item.y += state.speed * item.vy * dt;
    item.x += Math.sin(state.time * 2 + item.seed) * 34 * dt;
    item.a += item.spin * dt;
  }
  state.rocks = state.rocks.filter((item) => item.y <= state.height + 80);
  state.powerups = state.powerups.filter((item) => item.y <= state.height + 80);
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vy += 40 * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

function spawnRock() {
  const tier = difficultyTier();
  const r = rand(13 + tier * 1.5, 27 + tier * 2.2);
  state.rocks.push({
    x: rand(r + 10, state.width - r - 10),
    y: -r - 20,
    r,
    hp: r * (1.25 + tier * 0.11),
    spin: rand(-3, 3),
    a: rand(0, Math.PI),
    vx: rand(-24 - tier * 3, 24 + tier * 3),
    vy: rand(0.54, 0.84 + tier * 0.035),
    tier
  });
}

function spawnPowerup() {
  const pool = state.ship.shield < 1 ? powerups : powerups.filter((item) => item.type !== "shield" || Math.random() > 0.45);
  const base = pool[Math.floor(Math.random() * pool.length)];
  state.powerups.push({
    ...base,
    x: rand(40, state.width - 40),
    y: -44,
    r: 18,
    a: 0,
    spin: rand(-2.2, 2.2),
    vy: 0.43,
    seed: Math.random() * 10
  });
}

function spawnEnemy() {
  const tier = difficultyTier();
  const roll = Math.random();
  const kind = tier >= 3 && roll > 0.68 ? "guard" : roll > 0.38 ? "zig" : "scout";
  const r = kind === "guard" ? 20 : kind === "zig" ? 17 : 15;
  state.enemies.push({
    kind,
    x: rand(r + 18, state.width - r - 18),
    y: -44,
    r,
    hp: (kind === "guard" ? 62 : kind === "zig" ? 44 : 34) + tier * 10,
    maxHp: (kind === "guard" ? 62 : kind === "zig" ? 44 : 34) + tier * 10,
    vx: kind === "scout" ? rand(-18, 18) : rand(-30, 30),
    vy: (kind === "guard" ? 86 : kind === "zig" ? 112 : 138) + tier * 10,
    drift: rand(60, 120),
    fireTimer: kind === "scout" ? rand(1.2, 2.2) : rand(0.8, 1.5),
    t: 0
  });
}

function spawnBoss() {
  const tier = difficultyTier();
  const maxHp = 150 + state.time * 3.2 + tier * 70;
  state.boss = {
    x: state.width / 2,
    y: -90,
    targetY: Math.max(122, state.height * 0.18),
    r: Math.min(55 + tier * 3, state.width * 0.15),
    hp: maxHp,
    maxHp,
    t: 0,
    fireTimer: 1,
    tier
  };
  state.bossTimer = Math.max(44, 56 - tier * 2);
  state.shake = 8;
  burst(state.width / 2, 40, "#ff5b71", 20);
}

function checkCollisions() {
  checkPlayerBullets();
  checkPlayerHits();
  checkPowerups();
}

function checkPlayerBullets() {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    let consumed = false;

    for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
      const enemy = state.enemies[j];
      if (distance(bullet, enemy) < bullet.r + enemy.r) {
        enemy.hp -= bullet.damage;
        consumed = true;
        burst(bullet.x, bullet.y, bullet.color, 4);
        if (enemy.hp <= 0) {
          state.bonusScore += enemy.kind === "guard" ? 36 : 24;
          burst(enemy.x, enemy.y, enemy.kind === "guard" ? "#b987ff" : "#ffb15f", 18);
          state.enemies.splice(j, 1);
        }
        break;
      }
    }

    for (let j = state.rocks.length - 1; !consumed && j >= 0; j -= 1) {
      const rock = state.rocks[j];
      if (distance(bullet, rock) < bullet.r + rock.r) {
        rock.hp -= bullet.damage;
        consumed = true;
        burst(bullet.x, bullet.y, bullet.color, 4);
        if (rock.hp <= 0) {
          state.bonusScore += 10;
          burst(rock.x, rock.y, "#d1bfae", 14);
          state.rocks.splice(j, 1);
        }
        break;
      }
    }

    const boss = state.boss;
    if (!consumed && boss && distance(bullet, boss) < bullet.r + boss.r) {
      boss.hp -= bullet.damage;
      consumed = true;
      burst(bullet.x, bullet.y, bullet.color, 5);
      if (boss.hp <= 0) {
        state.bonusScore += 220;
        burst(boss.x, boss.y, "#ffe06f", 60);
        state.boss = null;
        state.enemyShots = [];
        state.shake = 13;
      }
    }

    if (consumed) state.bullets.splice(i, 1);
  }
}

function checkPlayerHits() {
  for (const enemy of state.enemies) {
    if (distance(state.ship, enemy) < state.ship.r + enemy.r * 0.55) {
      absorbOrDie(enemy.x, enemy.y);
      return;
    }
  }

  for (const rock of state.rocks) {
    if (distance(state.ship, rock) < state.ship.r + rock.r * 0.48) {
      absorbOrDie(rock.x, rock.y);
      return;
    }
  }

  for (const shot of state.enemyShots) {
    if (distance(state.ship, shot) < state.ship.r + shot.r * 0.52) {
      absorbOrDie(shot.x, shot.y);
      return;
    }
  }

  if (state.boss && distance(state.ship, state.boss) < state.ship.r + state.boss.r * 0.5) {
    absorbOrDie(state.boss.x, state.boss.y);
  }
}

function checkPowerups() {
  for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
    const item = state.powerups[i];
    if (distance(state.ship, item) < state.ship.r + item.r + 34) {
      state.bonusScore += 45;
      if (item.type === "shield") {
        state.ship.shield = Math.min(5, state.ship.shield + 2.5);
      } else {
        state.ammo[item.type] += 1;
        applyAmmoBuild();
      }
      updateWeaponHud();
      burst(item.x, item.y, item.color, 24);
      state.powerups.splice(i, 1);
    }
  }
}

function absorbOrDie(x, y) {
  if (state.ship.shield > 0) {
    state.ship.shield = Math.max(0, state.ship.shield - 0.38);
    updateWeaponHud();
    state.enemyShots = state.enemyShots.filter((shot) => distance(shot, state.ship) > 120);
    state.rocks = state.rocks.filter((rock) => distance(rock, state.ship) > 112);
    state.enemies = state.enemies.filter((enemy) => distance(enemy, state.ship) > 112);
    state.shake = 9;
    burst(x, y, "#8ef36e", 30);
    return;
  }
  state.ship.armor -= 1;
  if (state.ship.armor <= 0) {
    gameOver();
    return;
  }
  state.ship.shield = 1.1;
  updateWeaponHud();
  state.enemyShots = state.enemyShots.filter((shot) => distance(shot, state.ship) > 120);
  state.rocks = state.rocks.filter((rock) => distance(rock, state.ship) > 112);
  state.enemies = state.enemies.filter((enemy) => distance(enemy, state.ship) > 112);
  state.shake = 12;
  burst(x, y, "#ffb15f", 28);
}

function draw() {
  const sx = state.shake ? rand(-state.shake, state.shake) : 0;
  const sy = state.shake ? rand(-state.shake, state.shake) : 0;
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.save();
  ctx.translate(sx, sy);
  drawBackground();
  drawScenery();
  drawPowerups();
  drawBullets();
  drawRocks();
  drawEnemies();
  drawBoss();
  drawEnemyShots();
  drawShip();
  drawParticles();
  drawBossBar();
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#121827");
  gradient.addColorStop(0.48, "#17223b");
  gradient.addColorStop(1, "#2b1d31");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  const glow = ctx.createRadialGradient(state.width * 0.3, state.height * 0.18, 10, state.width * 0.3, state.height * 0.18, state.width * 0.85);
  glow.addColorStop(0, "rgba(54, 214, 181, 0.15)");
  glow.addColorStop(0.42, "rgba(83, 172, 255, 0.08)");
  glow.addColorStop(1, "rgba(255, 91, 113, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = "rgba(246, 240, 230, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const x = (state.width / 6) * (i + 1);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + Math.sin(state.time * 0.8 + i) * 42, state.height * 0.46, x - 26, state.height);
    ctx.stroke();
  }

  for (const star of state.stars) {
    const tint = star.hue > 0.78 ? "83, 172, 255" : "246, 240, 230";
    ctx.fillStyle = `rgba(${tint}, ${0.28 + star.r / 3})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawScenery() {
  for (const cloud of state.clouds) {
    const color = cloud.tone > 0.5 ? "83, 172, 255" : "255, 91, 113";
    const g = ctx.createRadialGradient(cloud.x, cloud.y, cloud.r * 0.08, cloud.x, cloud.y, cloud.r);
    g.addColorStop(0, `rgba(${color}, 0.16)`);
    g.addColorStop(0.5, `rgba(${color}, 0.06)`);
    g.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlanet(state.width * 0.82, state.height * 0.22, Math.min(54, state.width * 0.12), "#6a5cff", "#53acff", true);
  drawPlanet(state.width * 0.16, state.height * 0.64, Math.min(34, state.width * 0.08), "#ff8aa0", "#ffe06f", false);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 224, 111, 0.28)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i += 1) {
    const y = state.height * 0.34 + i * 42 + Math.sin(state.time + i) * 8;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.lineTo(state.width + 20, y + Math.sin(i) * 26);
    ctx.stroke();
  }
  ctx.restore();

  for (const comet of state.comets) {
    const alpha = clamp(comet.life / comet.maxLife, 0, 1);
    ctx.save();
    ctx.strokeStyle = colorWithAlpha(comet.color, alpha * 0.78);
    ctx.lineWidth = 3;
    ctx.shadowColor = comet.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(comet.x, comet.y);
    ctx.lineTo(comet.x - 76, comet.y - 72);
    ctx.stroke();
    ctx.fillStyle = colorWithAlpha("#f6f0e6", alpha);
    ctx.beginPath();
    ctx.arc(comet.x, comet.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlanet(x, y, r, inner, outer, ring) {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 2, x, y, r);
  g.addColorStop(0, outer);
  g.addColorStop(1, inner);
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (ring) {
    ctx.strokeStyle = "rgba(246, 240, 230, 0.36)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.55, r * 0.38, -0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShip() {
  const { x, y } = state.ship;
  ctx.save();
  ctx.translate(x, y);

  if (state.ship.shield > 0) {
    ctx.strokeStyle = `rgba(142, 243, 110, ${0.45 + Math.sin(state.time * 8) * 0.18})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 37 + Math.sin(state.time * 9) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  const shipColor = weaponColor();
  ctx.shadowColor = colorWithAlpha(shipColor, 0.9);
  ctx.shadowBlur = 20;
  ctx.fillStyle = shipColor;
  ctx.beginPath();
  ctx.moveTo(0, -31);
  ctx.lineTo(25, 23);
  ctx.lineTo(0, 12);
  ctx.lineTo(-25, 23);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f6f0e6";
  ctx.beginPath();
  ctx.arc(0, -5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 120, 92, 0.92)";
  ctx.beginPath();
  ctx.moveTo(-9, 22);
  ctx.lineTo(0, 42 + Math.sin(state.time * 18) * 6);
  ctx.lineTo(9, 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBullets() {
  for (const bullet of state.bullets) {
    ctx.save();
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = bullet.color;
    fillRoundedRect(bullet.x - bullet.r, bullet.y - 11, bullet.r * 2, 22, bullet.r);
    ctx.restore();
  }
}

function drawEnemyShots() {
  for (const shot of state.enemyShots) {
    ctx.save();
    ctx.shadowColor = shot.color;
    ctx.shadowBlur = 13;
    ctx.fillStyle = shot.color;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRocks() {
  for (const rock of state.rocks) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.a);
    ctx.fillStyle = rock.tier >= 3 ? "#6f6578" : "#8e7d72";
    ctx.strokeStyle = rock.tier >= 3 ? "#b987ff" : "#d1bfae";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 9; i += 1) {
      const angle = (Math.PI * 2 * i) / 9;
      const radius = rock.r * (0.72 + ((i * 37) % 19) / 60);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const color = enemy.kind === "guard" ? "#b987ff" : enemy.kind === "zig" ? "#ffb15f" : "#53acff";
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = enemy.kind === "guard" ? "#34264e" : "#173553";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (enemy.kind === "guard") {
      ctx.moveTo(0, -enemy.r);
      ctx.lineTo(enemy.r * 1.15, 0);
      ctx.lineTo(0, enemy.r);
      ctx.lineTo(-enemy.r * 1.15, 0);
    } else {
      ctx.moveTo(0, -enemy.r);
      ctx.lineTo(enemy.r, enemy.r * 0.72);
      ctx.lineTo(0, enemy.r * 0.32);
      ctx.lineTo(-enemy.r, enemy.r * 0.72);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillRect(-enemy.r, enemy.r + 7, enemy.r * 2 * Math.max(0, enemy.hp / enemy.maxHp), 3);
    ctx.restore();
  }
}

function drawPowerups() {
  for (const item of state.powerups) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.a);
    ctx.shadowColor = item.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(20, 0);
    ctx.lineTo(0, 22);
    ctx.lineTo(-20, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(246, 240, 230, 0.92)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#10141f";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, 0, 1);
    ctx.restore();
  }
}

function drawBoss() {
  const boss = state.boss;
  if (!boss) return;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.shadowColor = "rgba(255, 91, 113, 0.75)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#55253c";
  ctx.strokeStyle = "#ff8aa0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    const radius = boss.r * (i % 2 ? 0.78 : 1);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.78;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffe06f";
  ctx.beginPath();
  ctx.arc(-boss.r * 0.28, -boss.r * 0.05, boss.r * 0.1, 0, Math.PI * 2);
  ctx.arc(boss.r * 0.28, -boss.r * 0.05, boss.r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBossBar() {
  const boss = state.boss;
  if (!boss) return;
  const w = Math.min(state.width - 36, 340);
  const x = (state.width - w) / 2;
  const y = 76;
  ctx.fillStyle = "rgba(16, 20, 31, 0.72)";
  ctx.fillRect(x, y, w, 9);
  ctx.fillStyle = "#ff5b71";
  ctx.fillRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 9);
  ctx.strokeStyle = "rgba(246, 240, 230, 0.5)";
  ctx.strokeRect(x, y, w, 9);
}

function drawParticles() {
  for (const p of state.particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = colorWithAlpha(p.color, alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, Math.PI * 2);
    const v = rand(40, 230);
    const life = rand(0.25, 0.7);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      r: rand(2, 5),
      color,
      life,
      maxLife: life
    });
  }
}

function frame(now) {
  const dt = Math.min(0.033, (now - state.lastFrame) / 1000 || 0);
  state.lastFrame = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function pointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(event.clientX - rect.left, 32, state.width - 32),
    y: clamp(event.clientY - rect.top, 96, state.height - 32)
  };
}

function setTarget(event) {
  const point = pointerPoint(event);
  state.targetX = point.x;
  state.targetY = point.y;
}

canvas.addEventListener("pointerdown", (event) => {
  state.pointerActive = true;
  canvas.setPointerCapture(event.pointerId);
  if (state.mode === "ready" || state.mode === "over") reset();
  if (state.mode === "playing") setTarget(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (state.pointerActive && state.mode === "playing") setTarget(event);
});

canvas.addEventListener("pointerup", () => {
  state.pointerActive = false;
});

canvas.addEventListener("pointercancel", () => {
  state.pointerActive = false;
});

startBtn.addEventListener("click", () => {
  if (state.mode === "paused") {
    togglePause();
  } else {
    reset();
  }
});

pauseBtn.addEventListener("click", togglePause);

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    if (state.mode === "playing") togglePause();
    else reset();
  }
  const step = 34;
  if (state.mode === "playing") {
    if (event.key === "ArrowLeft") state.targetX -= step;
    if (event.key === "ArrowRight") state.targetX += step;
    if (event.key === "ArrowUp") state.targetY -= step;
    if (event.key === "ArrowDown") state.targetY += step;
    state.targetX = clamp(state.targetX, 32, state.width - 32);
    state.targetY = clamp(state.targetY, 96, state.height - 32);
  }
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function difficultyTier() {
  return Math.min(8, Math.floor(state.time / 38) + Math.floor(state.bonusScore / 420));
}

function applyAmmoBuild() {
  const { spread, beam, pulse } = state.ammo;
  const minAll = Math.min(spread, beam, pulse);
  if (minAll >= 3) {
    state.weapon = "singular";
    state.weaponLevel = Math.min(4, minAll - 2);
  } else if (spread >= 2 && beam >= 2) {
    state.weapon = "prism";
    state.weaponLevel = Math.min(3, Math.min(spread, beam) - 1);
  } else if (spread >= 2 && pulse >= 2) {
    state.weapon = "storm";
    state.weaponLevel = Math.min(3, Math.min(spread, pulse) - 1);
  } else if (beam >= 2 && pulse >= 2) {
    state.weapon = "lance";
    state.weaponLevel = Math.min(3, Math.min(beam, pulse) - 1);
  } else if (spread >= 3) {
    state.weapon = "fan";
    state.weaponLevel = Math.min(3, Math.floor(spread / 3));
  } else if (beam >= 3) {
    state.weapon = "laser";
    state.weaponLevel = Math.min(3, Math.floor(beam / 3));
  } else if (pulse >= 3) {
    state.weapon = "nova";
    state.weaponLevel = Math.min(3, Math.floor(pulse / 3));
  } else if (spread > 0 || beam > 0 || pulse > 0) {
    const best = [
      ["spread", spread],
      ["beam", beam],
      ["pulse", pulse]
    ].sort((a, b) => b[1] - a[1])[0];
    state.weapon = best[0];
    state.weaponLevel = 1;
  } else {
    state.weapon = "normal";
    state.weaponLevel = 0;
  }
}

function weaponColor() {
  if (state.weapon === "spread" || state.weapon === "fan" || state.weapon === "storm") return "#ffe06f";
  if (state.weapon === "beam" || state.weapon === "laser" || state.weapon === "prism" || state.weapon === "lance") return "#53acff";
  if (state.weapon === "pulse" || state.weapon === "nova") return "#b987ff";
  if (state.weapon === "singular") return "#f6f0e6";
  return "#36d6b5";
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function updateWeaponHud() {
  const level = Math.max(1, state.weaponLevel);
  const shield = state.ship.shield > 0 ? `·盾${Math.ceil(state.ship.shield)}` : "";
  weaponEl.textContent = `${weaponNames[state.weapon]}${level}${shield}·甲${state.ship.armor}`;
}

function colorWithAlpha(color, alpha) {
  if (color.startsWith("#")) {
    const value = Number.parseInt(color.slice(1), 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function fillRoundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.fill();
}

resize();
requestAnimationFrame(frame);
