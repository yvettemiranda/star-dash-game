const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const panel = document.getElementById("panel");
const panelText = document.getElementById("panelText");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");

const storageKey = "star-dash-best";
const state = {
  mode: "ready",
  width: 720,
  height: 1280,
  dpr: 1,
  time: 0,
  score: 0,
  bonusScore: 0,
  best: Number(localStorage.getItem(storageKey) || 0),
  speed: 360,
  spawnTimer: 0,
  gemTimer: 1.2,
  shake: 0,
  pointerActive: false,
  targetX: 360,
  targetY: 960,
  ship: { x: 360, y: 960, r: 24 },
  rocks: [],
  gems: [],
  stars: [],
  lastFrame: 0
};

bestEl.textContent = state.best;

function resize() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = Math.max(320, Math.floor(rect.width));
  state.height = Math.max(480, Math.floor(rect.height));
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  state.targetX = clamp(state.targetX, 36, state.width - 36);
  state.targetY = clamp(state.targetY, 90, state.height - 36);
  state.ship.x = clamp(state.ship.x, 36, state.width - 36);
  state.ship.y = clamp(state.ship.y, 90, state.height - 36);
  seedStars();
}

function seedStars() {
  const count = Math.floor(state.width * state.height / 9000);
  state.stars = Array.from({ length: count }, () => ({
    x: Math.random() * state.width,
    y: Math.random() * state.height,
    r: Math.random() * 1.8 + 0.4,
    v: Math.random() * 35 + 25
  }));
}

function reset() {
  state.mode = "playing";
  state.time = 0;
  state.score = 0;
  state.bonusScore = 0;
  state.speed = 360;
  state.spawnTimer = 0.9;
  state.gemTimer = 1.1;
  state.shake = 0;
  state.rocks = [];
  state.gems = [];
  state.ship.x = state.width / 2;
  state.ship.y = state.height * 0.76;
  state.targetX = state.ship.x;
  state.targetY = state.ship.y;
  scoreEl.textContent = "0";
  pauseBtn.textContent = "Ⅱ";
  panel.classList.add("hidden");
}

function togglePause() {
  if (state.mode === "playing") {
    state.mode = "paused";
    pauseBtn.textContent = "▶";
    showPanel("暂停中", "点继续回到星轨。", "继续");
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
  state.shake = 14;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(storageKey, String(state.best));
    bestEl.textContent = state.best;
  }
  showPanel("撞毁了", `本局 ${state.score} 分。再来一把通常会更远。`, "再来");
}

function update(dt) {
  if (state.mode !== "playing") return;

  state.time += dt;
  state.speed = 300 + Math.min(400, state.time * 10);
  state.score = Math.floor(state.time * 12) + state.bonusScore;
  scoreEl.textContent = state.score;

  state.ship.x += (state.targetX - state.ship.x) * Math.min(1, dt * 12);
  state.ship.y += (state.targetY - state.ship.y) * Math.min(1, dt * 12);

  for (const star of state.stars) {
    star.y += star.v * dt + state.speed * dt * 0.08;
    if (star.y > state.height + 4) {
      star.y = -4;
      star.x = Math.random() * state.width;
    }
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnRock();
    state.spawnTimer = Math.max(0.34, 0.9 - state.time * 0.011);
  }

  state.gemTimer -= dt;
  if (state.gemTimer <= 0) {
    spawnGem();
    state.gemTimer = Math.max(1.4, 2.4 - state.time * 0.01);
  }

  moveObjects(state.rocks, dt);
  moveObjects(state.gems, dt);
  checkCollisions();
  state.shake = Math.max(0, state.shake - dt * 30);
}

function spawnRock() {
  const r = rand(18, 38);
  state.rocks.push({
    x: rand(r + 10, state.width - r - 10),
    y: -r - 20,
    r,
    spin: rand(-3, 3),
    a: rand(0, Math.PI),
    vx: rand(-35, 35),
    vy: rand(0.85, 1.18)
  });
}

function spawnGem() {
  state.gems.push({
    x: rand(34, state.width - 34),
    y: -50,
    r: 16,
    spin: rand(-5, 5),
    a: 0,
    vx: rand(-22, 22),
    vy: 0.72
  });
}

function moveObjects(list, dt) {
  for (const item of list) {
    item.y += state.speed * item.vy * dt;
    item.x += item.vx * dt;
    item.a += item.spin * dt;
  }
  while (list.length && list[0].y > state.height + 80) list.shift();
}

function checkCollisions() {
  for (const rock of state.rocks) {
    if (distance(state.ship, rock) < state.ship.r + rock.r * 0.78) {
      gameOver();
      return;
    }
  }

  for (let i = state.gems.length - 1; i >= 0; i -= 1) {
    const gem = state.gems[i];
    if (distance(state.ship, gem) < state.ship.r + gem.r) {
      state.bonusScore += 25;
      state.score = Math.floor(state.time * 12) + state.bonusScore;
      state.time += 2;
      scoreEl.textContent = state.score;
      state.gems.splice(i, 1);
    }
  }
}

function draw() {
  const sx = state.shake ? rand(-state.shake, state.shake) : 0;
  const sy = state.shake ? rand(-state.shake, state.shake) : 0;
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.save();
  ctx.translate(sx, sy);
  drawBackground();
  drawRocks();
  drawGems();
  drawShip();
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#121827");
  gradient.addColorStop(0.55, "#172238");
  gradient.addColorStop(1, "#231b2d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = "rgba(54, 214, 181, 0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const x = (state.width / 5) * (i + 1);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + Math.sin(state.time + i) * 30, state.height * 0.45, x - 20, state.height);
    ctx.stroke();
  }

  for (const star of state.stars) {
    ctx.fillStyle = `rgba(246, 240, 230, ${0.3 + star.r / 3})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShip() {
  const { x, y } = state.ship;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(54, 214, 181, 0.8)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#36d6b5";
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(24, 24);
  ctx.lineTo(0, 12);
  ctx.lineTo(-24, 24);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f6f0e6";
  ctx.beginPath();
  ctx.arc(0, -4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 120, 92, 0.88)";
  ctx.beginPath();
  ctx.moveTo(-9, 22);
  ctx.lineTo(0, 42 + Math.sin(state.time * 18) * 6);
  ctx.lineTo(9, 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRocks() {
  for (const rock of state.rocks) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.a);
    ctx.fillStyle = "#8e7d72";
    ctx.strokeStyle = "#d1bfae";
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

function drawGems() {
  for (const gem of state.gems) {
    ctx.save();
    ctx.translate(gem.x, gem.y);
    ctx.rotate(gem.a);
    ctx.shadowColor = "rgba(83, 172, 255, 0.9)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#53acff";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(17, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-17, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(246, 240, 230, 0.8)";
    ctx.stroke();
    ctx.restore();
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
    y: clamp(event.clientY - rect.top, 90, state.height - 32)
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
    state.targetY = clamp(state.targetY, 90, state.height - 32);
  }
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

resize();
requestAnimationFrame(frame);
