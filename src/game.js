import { Player, GROUND_Y } from "./player.js";
import { OBSTACLE_INFO, ObstacleManager } from "./obstacles.js";
import { POWERUP_INFO, PowerUpManager } from "./powerups.js";

const WORLD = { width: 960, height: 600 };
const STORAGE_KEY = "ikun-runner-best-score";
const WIND_EVENT = {
  duration: 5.5,
  speedMultiplier: 1.12,
  minDelay: 8,
  maxDelay: 15,
};
const GRAVITY_EVENT = {
  duration: 5.5,
  gravityScale: 0.62,
  minDelay: 9,
  maxDelay: 17,
};
const POWERUP_DURATION = {
  shield: 10,
  doubleScore: 10,
  rocket: 10,
  rocketLandingShield: 3,
};

export class Game {
  constructor({ canvas, assets, audio, ui }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.audio = audio;
    this.ui = ui;
    this.images = {};
    this.player = new Player();
    this.obstacles = new ObstacleManager(this.images);
    this.powerUps = new PowerUpManager();
    this.state = "ready";
    this.lastTime = performance.now();
    this.score = 0;
    this.scoreFloat = 0;
    this.best = Number(localStorage.getItem(STORAGE_KEY) || 0);
    this.distance = 0;
    this.bonus = 0;
    this.speed = 455;
    this.floorOffset = 0;
    this.shake = 0;
    this.particles = [];
    this.wind = this.createFieldState(WIND_EVENT);
    this.gravityField = this.createFieldState(GRAVITY_EVENT);
    this.effects = this.createEffectState();
  }

  async init() {
    await this.loadImages();
    this.bindInput();
    this.resize();
    this.ui.updateScore(this.score, this.best);
    this.ui.showStart();
    requestAnimationFrame((time) => this.loop(time));
  }

  async loadImages() {
    const entries = Object.entries(this.assets.images);
    const loaded = await Promise.all(entries.map(([, src]) => loadImage(src)));
    entries.forEach(([name], index) => {
      this.images[name] = loaded[index];
    });
  }

  bindInput() {
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });

    this.canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x >= rect.width / 2) {
        this.jump();
      } else {
        this.setDuck(true);
      }
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
      this.canvas.addEventListener(name, () => this.setDuck(false));
    });

    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
        event.preventDefault();
        this.jump();
      }
      if (["ArrowDown", "KeyS"].includes(event.code)) {
        event.preventDefault();
        this.setDuck(true);
      }
      if (["Escape", "KeyP"].includes(event.code)) {
        this.togglePause();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (["ArrowDown", "KeyS"].includes(event.code)) {
        event.preventDefault();
        this.setDuck(false);
      }
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(this.canvas.width / WORLD.width, 0, 0, this.canvas.height / WORLD.height, 0, 0);
  }

  start() {
    this.player.reset();
    this.obstacles.reset();
    this.powerUps.reset();
    this.state = "playing";
    this.score = 0;
    this.scoreFloat = 0;
    this.distance = 0;
    this.bonus = 0;
    this.speed = 455;
    this.floorOffset = 0;
    this.shake = 0;
    this.particles = [];
    this.wind = this.createFieldState(WIND_EVENT);
    this.gravityField = this.createFieldState(GRAVITY_EVENT);
    this.effects = this.createEffectState();
    this.audio.stopRocketMusic();
    this.ui.showGame();
    this.ui.setPaused(false);
    this.ui.updateScore(this.score, this.best);
  }

  togglePause() {
    if (this.state === "ready") return;
    if (this.state === "gameover") {
      this.start();
      return;
    }
    this.state = this.state === "paused" ? "playing" : "paused";
    this.ui.setPaused(this.state === "paused");
  }

  jump() {
    if (this.state !== "playing") {
      this.start();
      return;
    }
    if (this.player.jump()) {
      this.spawnBurst(this.player.x + this.player.width * 0.5, this.player.y + this.player.height, "#ffd866", 8);
      this.audio.playRandomVoice();
    }
  }

  setDuck(active) {
    if (this.state !== "playing") return;
    if (this.player.setDuck(active) && active) {
      this.spawnBurst(this.player.x + this.player.width * 0.4, GROUND_Y, "#f0b35a", 5);
      this.audio.playRandomVoice();
    }
  }

  loop(time) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.033);
    this.lastTime = time;
    this.update(dt);
    this.draw();
    requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    if (this.state !== "playing") return;

    this.updateFieldEvents(dt);
    this.speed = Math.min(720, 455 + this.score * 0.85);
    const effectiveSpeed = this.getEffectiveSpeed();
    this.updateEffects(dt);
    this.distance += effectiveSpeed * dt;
    this.floorOffset = (this.floorOffset + effectiveSpeed * dt) % 96;
    this.scoreFloat += (effectiveSpeed * dt * (this.effects.doubleScore > 0 ? 2 : 1)) / 12;
    this.score = Math.floor(this.scoreFloat) + this.bonus;
    this.shake = Math.max(0, this.shake - dt * 22);

    if (this.effects.rocket > 0) {
      this.updateRocketFlight(dt);
    } else {
      this.player.update(dt, this.getGravityScale());
    }
    this.obstacles.update(dt, effectiveSpeed, this.score);
    this.powerUps.update(dt, effectiveSpeed, this.score, this.obstacles.items);
    this.separatePowerUpsFromObstacles();
    this.updateObstacles();
    this.updatePowerUps();
    this.updateParticles(dt);
    this.ui.updateScore(this.score, this.best);
  }

  createEffectState() {
    return {
      shield: 0,
      doubleScore: 0,
      rocket: 0,
      rocketWasActive: false,
    };
  }

  updateEffects(dt) {
    this.effects.shield = Math.max(0, this.effects.shield - dt);
    this.effects.doubleScore = Math.max(0, this.effects.doubleScore - dt);
    const previousRocket = this.effects.rocket;
    this.effects.rocket = Math.max(0, this.effects.rocket - dt);
    if (previousRocket > 0 && this.effects.rocket === 0) {
      this.endRocketFlight();
    }
  }

  updateRocketFlight(dt) {
    const targetY = GROUND_Y - this.player.standHeight - 260;
    this.player.ducking = false;
    this.player.stand();
    this.player.grounded = false;
    this.player.jumpsLeft = 1;
    this.player.vy = 0;
    this.player.y += (targetY - this.player.y) * Math.min(1, dt * 5);
  }

  endRocketFlight() {
    this.effects.rocketWasActive = false;
    this.effects.shield = Math.max(this.effects.shield, POWERUP_DURATION.rocketLandingShield);
    this.player.grounded = false;
    this.player.vy = 220;
    this.audio.stopRocketMusic();
    this.spawnBurst(this.player.x + this.player.width * 0.5, this.player.y + this.player.height, "#58d6ff", 12);
  }

  createFieldState(config) {
    return {
      active: false,
      timer: randomRange(config.minDelay, config.maxDelay),
      duration: 0,
    };
  }

  updateFieldEvents(dt) {
    this.updateField(this.wind, WIND_EVENT, dt, () => {
      this.spawnBurst(this.player.x + this.player.width, this.player.y + this.player.height * 0.45, "#9be8ff", 10);
    });
    this.updateField(this.gravityField, GRAVITY_EVENT, dt, () => {
      this.spawnBurst(this.player.x + this.player.width * 0.5, this.player.y + this.player.height * 0.25, "#ffd866", 10);
    });
  }

  updateField(field, config, dt, onStart) {
    if (field.active) {
      field.duration -= dt;
      if (field.duration <= 0) {
        field.active = false;
        field.timer = randomRange(config.minDelay, config.maxDelay);
      }
      return;
    }

    field.timer -= dt;
    if (field.timer <= 0) {
      field.active = true;
      field.duration = config.duration;
      onStart();
    }
  }

  getEffectiveSpeed() {
    return this.wind.active ? this.speed * WIND_EVENT.speedMultiplier : this.speed;
  }

  getGravityScale() {
    return this.gravityField.active ? GRAVITY_EVENT.gravityScale : 1;
  }

  separatePowerUpsFromObstacles() {
    for (const powerUp of this.powerUps.items) {
      for (let attempts = 0; attempts < 4; attempts += 1) {
        const blocker = this.findPowerUpBlocker(powerUp);
        if (!blocker) break;
        powerUp.x = blocker.x + blocker.width + 130;
        powerUp.y = Math.min(GROUND_Y - 124, Math.max(72, powerUp.y - 34));
      }
    }
  }

  findPowerUpBlocker(powerUp) {
    const powerRect = expandRect(powerUp, 42);
    for (const obstacle of this.obstacles.items) {
      if (rectsOverlap(powerRect, expandRect(obstacle, 34))) return obstacle;
    }
    for (const other of this.powerUps.items) {
      if (other === powerUp) continue;
      if (rectsOverlap(powerRect, expandRect(other, 28))) return other;
    }
    return null;
  }

  updateObstacles() {
    if (this.effects.shield > 0 || this.effects.rocket > 0) return;

    const playerBox = this.player.hitbox();
    for (const obstacle of this.obstacles.items) {
      if (!obstacle.passed && obstacle.x + obstacle.width < this.player.x) {
        obstacle.passed = true;
        this.bonus += obstacle.type === "hoop" ? 60 : 25;
      }

      if (intersects(playerBox, this.obstacles.hitbox(obstacle))) {
        this.end(obstacle.type);
        return;
      }
    }
  }

  updatePowerUps() {
    const playerBox = this.player.hitbox();
    for (const powerUp of this.powerUps.items) {
      if (!powerUp.collected && intersects(playerBox, this.powerUps.hitbox(powerUp))) {
        powerUp.collected = true;
        this.collectPowerUp(powerUp.type);
      }
    }
    this.powerUps.items = this.powerUps.items.filter((item) => !item.collected);
  }

  collectPowerUp(type) {
    const info = POWERUP_INFO[type];
    if (type === "shield") {
      this.effects.shield = POWERUP_DURATION.shield;
    } else if (type === "doubleScore") {
      this.effects.doubleScore = POWERUP_DURATION.doubleScore;
    } else if (type === "rocket") {
      this.effects.rocket = POWERUP_DURATION.rocket;
      this.effects.rocketWasActive = true;
      this.effects.shield = Math.max(this.effects.shield, POWERUP_DURATION.rocket);
      this.audio.playRocketMusic();
    }
    this.spawnBurst(this.player.x + this.player.width * 0.5, this.player.y + this.player.height * 0.45, info.color, 14);
  }

  end(type) {
    this.state = "gameover";
    this.shake = 10;
    this.audio.stopRocketMusic();
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE_KEY, String(this.best));
    }
    const info = OBSTACLE_INFO[type];
    this.ui.updateScore(this.score, this.best);
    this.ui.showGameOver({ score: this.score, best: this.best, obstacle: info.name, action: info.action });
    this.spawnBurst(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, "#ff5f78", 14);
  }

  spawnBurst(x, y, color, count) {
    const capped = Math.min(count, 18);
    for (let i = 0; i < capped; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 130;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.28 + Math.random() * 0.2,
        size: 3 + Math.random() * 4,
        color,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw() {
    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);
    this.drawArena();
    this.drawMidground();
    this.drawCourt();
    this.drawObstacles();
    this.drawPowerUps();
    this.drawPlayer();
    this.drawParticles();
    this.drawForeground();
    this.drawFieldEvents();
    this.drawActiveEffects();
    this.ctx.restore();
  }

  drawArena() {
    const ctx = this.ctx;
    const wall = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    wall.addColorStop(0, "#050716");
    wall.addColorStop(0.46, "#151047");
    wall.addColorStop(0.8, "#2c1767");
    wall.addColorStop(1, "#101832");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, WORLD.width, GROUND_Y);

    const farScroll = this.distance * 0.1;
    this.drawSpotlights();
    this.drawAudience(farScroll);
  }

  drawSpotlights() {
    const ctx = this.ctx;
    for (let i = 0; i < 10; i += 1) {
      const x = 54 + i * 94;
      const y = 34 + (i % 2) * 8;
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 66);
      glow.addColorStop(0, "rgba(255, 238, 170, 0.62)");
      glow.addColorStop(1, "rgba(255, 238, 170, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 66, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff1a6";
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawAudience(scroll) {
    const ctx = this.ctx;
    const period = 600;
    const base = -positiveMod(scroll, period);
    for (let section = -1; section < 4; section += 1) {
      const x = base + section * period;
      ctx.fillStyle = "rgba(5, 9, 24, 0.58)";
      roundRect(ctx, x + 22, 112, 560, 190, 10);
      ctx.fill();

      const colors = ["#ff4d8d", "#55d8ff", "#ffe66d", "#8cff7a", "#b28cff"];
      for (let row = 0; row < 7; row += 1) {
        const y = 134 + row * 22;
        ctx.fillStyle = row % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.1)";
        ctx.fillRect(x + 36, y - 8, 530, 12);
        for (let i = 0; i < 22; i += 1) {
          ctx.globalAlpha = 0.24 + ((i + row) % 3) * 0.08;
          ctx.fillStyle = colors[(i + row) % colors.length];
          ctx.beginPath();
          ctx.arc(x + 50 + i * 24 + ((row * 9) % 13), y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      this.drawAd(x + 70, 70, 84, 32, "ball");
      this.drawAd(x + 206, 70, 78, 32, "bolt");
      this.drawAd(x + 336, 68, 90, 36, "RAP");
      this.drawAd(x + 482, 70, 78, 32, "note");
    }
  }

  drawAd(x, y, width, height, kind) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = "rgba(100, 220, 255, 0.78)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(12, 22, 55, 0.9)";
    roundRect(ctx, x, y, width, height, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(130, 245, 255, 0.72)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#82f5ff";
    ctx.strokeStyle = "#82f5ff";
    if (kind === "RAP") {
      ctx.font = "900 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("RAP", x + width / 2, y + height / 2 + 1);
    } else if (kind === "bolt") {
      ctx.beginPath();
      ctx.moveTo(x + width * 0.55, y + 6);
      ctx.lineTo(x + width * 0.32, y + height * 0.55);
      ctx.lineTo(x + width * 0.52, y + height * 0.55);
      ctx.lineTo(x + width * 0.42, y + height - 5);
      ctx.lineTo(x + width * 0.7, y + height * 0.42);
      ctx.lineTo(x + width * 0.5, y + height * 0.42);
      ctx.closePath();
      ctx.fill();
    } else if (kind === "note") {
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x + width * 0.6, y + 8);
      ctx.lineTo(x + width * 0.6, y + height - 8);
      ctx.arc(x + width * 0.48, y + height - 8, 7, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, 10, 0, Math.PI * 2);
      ctx.moveTo(x + width / 2 - 10, y + height / 2);
      ctx.lineTo(x + width / 2 + 10, y + height / 2);
      ctx.moveTo(x + width / 2, y + height / 2 - 10);
      ctx.lineTo(x + width / 2, y + height / 2 + 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMidground() {
    const ctx = this.ctx;
    const scroll = this.distance * 0.38;
    const period = 430;
    const base = -positiveMod(scroll, period);
    for (let i = -1; i < 4; i += 1) {
      const x = base + i * period;
      ctx.save();
      ctx.globalAlpha = 0.25;
      drawSmallHoop(ctx, x + 88, 320);
      ctx.restore();
      drawScoreboard(ctx, x + 210, 300, i);
      drawBench(ctx, x + 310, 376);
    }
  }

  drawCourt() {
    const ctx = this.ctx;
    const floor = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD.height);
    floor.addColorStop(0, "#a55f2a");
    floor.addColorStop(0.52, "#d59a4a");
    floor.addColorStop(1, "#7d4826");
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND_Y, WORLD.width, WORLD.height - GROUND_Y);

    ctx.fillStyle = "rgba(255, 221, 154, 0.16)";
    for (let y = GROUND_Y + 16; y < WORLD.height; y += 22) ctx.fillRect(0, y, WORLD.width, 2);

    ctx.strokeStyle = "rgba(73, 35, 18, 0.42)";
    ctx.lineWidth = 2;
    for (let x = -90; x < WORLD.width + 100; x += 58) {
      const px = x - (this.floorOffset % 58);
      ctx.beginPath();
      ctx.moveTo(px, GROUND_Y + 8);
      ctx.lineTo(px + 18, WORLD.height);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255, 253, 232, 0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 6);
    ctx.lineTo(WORLD.width, GROUND_Y + 6);
    ctx.stroke();

    const courtOffset = (this.distance * 0.95) % 600;
    for (let x = -600; x < WORLD.width + 600; x += 600) {
      const cx = x - courtOffset + 360;
      ctx.beginPath();
      ctx.arc(cx, GROUND_Y + 92, 92, Math.PI * 1.04, Math.PI * 1.96);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 102, GROUND_Y + 44, 42, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 48, GROUND_Y + 58);
      ctx.lineTo(cx + 48, GROUND_Y + 58);
      ctx.stroke();
    }
  }

  drawObstacles() {
    const ctx = this.ctx;
    for (const item of this.obstacles.items) {
      if (item.type === "hoop") {
        if (this.images.hoop) ctx.drawImage(this.images.hoop, item.x - 16, item.y - 24, item.width + 36, item.height + 74);
        else drawSmallHoop(ctx, item.x, item.y);
      } else if (this.images.basketball) {
        ctx.save();
        ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
        ctx.rotate(item.spin);
        ctx.drawImage(this.images.basketball, -item.width / 2 - 4, -item.height / 2 - 4, item.width + 8, item.height + 8);
        ctx.restore();
      }
    }
  }

  drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    const bounce = p.grounded && !p.ducking ? Math.sin(this.distance * 0.05) * 3 : 0;
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2 + bounce);
    if (p.ducking) ctx.rotate(-0.08);
    else if (!p.grounded) ctx.rotate(p.jumpsLeft === 0 ? 0.17 : -0.07);

    if (this.images.player) {
      ctx.drawImage(this.images.player, -p.width / 2 - 9, -p.height / 2 - 9, p.width + 18, p.height + 18);
    } else {
      ctx.fillStyle = "#45a4ff";
      roundRect(ctx, -p.width / 2, -p.height / 2, p.width, p.height, 8);
      ctx.fill();
    }
    ctx.restore();

    if (this.effects.shield > 0 || this.effects.rocket > 0) {
      const glow = this.effects.rocket > 0 ? "#ff6b7a" : "#58d6ff";
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = glow;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(p.x + p.width / 2, p.y + p.height / 2, p.width * 0.78, p.height * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(p.x + p.width / 2, p.y + p.height / 2, p.width * 0.88, p.height * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.effects.rocket > 0) {
      ctx.save();
      ctx.fillStyle = "#ffcf5c";
      ctx.strokeStyle = "#ff5f78";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y + p.height * 0.78);
      ctx.lineTo(p.x - 52 - Math.random() * 24, p.y + p.height * 0.9);
      ctx.lineTo(p.x - 4, p.y + p.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPowerUps() {
    const ctx = this.ctx;
    for (const item of this.powerUps.items) {
      const y = item.y + Math.sin(item.float) * 8;
      drawPowerUpIcon(ctx, item.type, item.x, y, item.width, item.height);
    }
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2.6);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawForeground() {
    const ctx = this.ctx;
    const scroll = this.distance * 1.08;
    const items = [
      { x: 64, y: 78, type: "confetti", color: "#ffd25f" },
      { x: 210, y: 126, type: "note", color: "#82f5ff" },
      { x: 540, y: 94, type: "bolt", color: "#ff64a6" },
      { x: 820, y: 190, type: "line", color: "#ffffff" },
      { x: 370, y: 72, type: "ghostBall", color: "#ffffff" },
    ];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const x = wrap(item.x - scroll * (0.18 + i * 0.02), -80, WORLD.width + 90);
      const y = item.y + Math.sin(this.distance * 0.018 + i) * 10;
      drawForegroundItem(ctx, x, y, item);
    }
  }

  drawFieldEvents() {
    const ctx = this.ctx;
    const notices = [];
    const pulse = 0.78 + Math.sin(this.distance * 0.08) * 0.18;

    if (!this.gravityField.active && this.gravityField.timer <= 2) {
      notices.push({ text: "重力变化", color: "#ffd866", alpha: pulse });
    }
    if (!this.wind.active && this.wind.timer <= 2) {
      notices.push({ text: "风力变化", color: "#9be8ff", alpha: pulse });
    }

    if (this.gravityField.active) {
      notices.push({ text: "重力变化", color: "#ffd866", alpha: 0.96 });
    }

    notices.forEach((notice, index) => {
      drawNotice(ctx, WORLD.width / 2, 74 + index * 48, notice.text, notice.color, notice.alpha);
    });

    if (!this.wind.active) return;

    const strength = Math.min(1, this.wind.duration / 0.8);
    const offset = (this.distance * 0.42) % 180;
    ctx.save();
    ctx.globalAlpha = 0.28 * strength;
    ctx.strokeStyle = "#9be8ff";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let y = 78; y < GROUND_Y - 34; y += 54) {
      for (let x = -180; x < WORLD.width + 180; x += 180) {
        const sx = x - offset + ((y * 1.7) % 90);
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.lineTo(sx + 86, y - 16);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(6, 16, 34, 0.72)";
    roundRect(ctx, WORLD.width - 178, 18, 154, 38, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(155, 232, 255, 0.72)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#d9fbff";
    ctx.font = "900 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("风力变化", WORLD.width - 101, 38);
    ctx.restore();
  }

  drawActiveEffects() {
    const ctx = this.ctx;
    const chips = [];
    if (this.effects.shield > 0) chips.push({ label: `护盾 ${Math.ceil(this.effects.shield)}s`, color: "#58d6ff" });
    if (this.effects.doubleScore > 0) chips.push({ label: `双倍 ${Math.ceil(this.effects.doubleScore)}s`, color: "#ffd866" });
    if (this.effects.rocket > 0) chips.push({ label: `火箭 ${Math.ceil(this.effects.rocket)}s`, color: "#ff6b7a" });
    if (chips.length === 0) return;

    ctx.save();
    ctx.font = "900 16px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    let x = 18;
    for (const chip of chips) {
      const width = Math.ceil(ctx.measureText(chip.label).width) + 28;
      ctx.fillStyle = "rgba(6, 16, 34, 0.76)";
      roundRect(ctx, x, 18, width, 34, 8);
      ctx.fill();
      ctx.strokeStyle = chip.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = chip.color;
      ctx.textAlign = "center";
      ctx.fillText(chip.label, x + width / 2, 36);
      x += width + 10;
    }
    ctx.restore();
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function rectsOverlap(a, b) {
  return intersects(a, b);
}

function expandRect(rect, padding) {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function positiveMod(value, period) {
  return ((value % period) + period) % period;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function wrap(value, min, max) {
  const span = max - min;
  return ((((value - min) % span) + span) % span) + min;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawSmallHoop(ctx, x, y) {
  ctx.fillStyle = "rgba(245,247,255,0.5)";
  roundRect(ctx, x, y, 72, 46, 5);
  ctx.fill();
  ctx.strokeStyle = "#c7d6ff";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = "#ff9b54";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 58);
  ctx.lineTo(x + 86, y + 58);
  ctx.stroke();
  ctx.strokeStyle = "#8795bc";
  ctx.beginPath();
  ctx.moveTo(x + 72, y + 20);
  ctx.lineTo(x + 72, y + 154);
  ctx.stroke();
}

function drawScoreboard(ctx, x, y, index) {
  const labels = ["24 : 8", "100", "RAP"];
  ctx.save();
  ctx.globalAlpha = 0.36;
  ctx.fillStyle = "#0b1028";
  roundRect(ctx, x, y, 96, 44, 6);
  ctx.fill();
  ctx.strokeStyle = "#45a4ff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffef7a";
  ctx.font = "900 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(labels[Math.abs(index) % labels.length], x + 48, y + 23);
  ctx.restore();
}

function drawBench(ctx, x, y) {
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = "#6d78a5";
  roundRect(ctx, x, y, 104, 14, 5);
  ctx.fill();
  ctx.fillRect(x + 12, y + 14, 7, 30);
  ctx.fillRect(x + 84, y + 14, 7, 30);
  ctx.restore();
}

function drawForegroundItem(ctx, x, y, item) {
  ctx.save();
  ctx.globalAlpha = item.type === "ghostBall" ? 0.13 : 0.42;
  ctx.strokeStyle = item.color;
  ctx.fillStyle = item.color;
  if (item.type === "note") {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 18, y - 22);
    ctx.lineTo(x + 18, y + 14);
    ctx.arc(x + 8, y + 14, 8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (item.type === "bolt") {
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 18);
    ctx.lineTo(x - 8, y + 6);
    ctx.lineTo(x + 6, y + 6);
    ctx.lineTo(x - 4, y + 28);
    ctx.lineTo(x + 20, y - 2);
    ctx.lineTo(x + 5, y - 2);
    ctx.closePath();
    ctx.fill();
  } else if (item.type === "line") {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 34, y);
    ctx.lineTo(x + 26, y - 8);
    ctx.stroke();
  } else if (item.type === "ghostBall") {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 28, y);
    ctx.lineTo(x + 28, y);
    ctx.moveTo(x, y - 28);
    ctx.lineTo(x, y + 28);
    ctx.stroke();
  } else {
    ctx.rotate(0.4);
    ctx.fillRect(x, y, 8, 18);
    ctx.fillRect(x + 16, y - 12, 7, 15);
  }
  ctx.restore();
}

function drawPowerUpIcon(ctx, type, x, y, width, height) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const info = POWERUP_INFO[type];
  ctx.save();
  ctx.shadowColor = info.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgba(8, 15, 32, 0.92)";
  ctx.strokeStyle = info.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, width / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = info.color;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (type === "shield") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx + 17, cy - 9);
    ctx.quadraticCurveTo(cx + 14, cy + 18, cx, cy + 24);
    ctx.quadraticCurveTo(cx - 14, cy + 18, cx - 17, cy - 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === "doubleScore") {
    ctx.font = "900 22px system-ui, sans-serif";
    ctx.fillText("x2", cx, cy + 1);
  } else {
    ctx.beginPath();
    ctx.moveTo(cx + 18, cy);
    ctx.lineTo(cx - 8, cy - 16);
    ctx.lineTo(cx - 2, cy);
    ctx.lineTo(cx - 8, cy + 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawNotice(ctx, x, y, text, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(6, 16, 34, 0.82)";
  roundRect(ctx, x - 92, y - 19, 184, 38, 9);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "900 20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}
