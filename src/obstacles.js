import { GROUND_Y } from "./player.js";

export const OBSTACLE_INFO = {
  groundBall: { name: "贴地篮球", action: "跳跃" },
  airBall: { name: "浮空篮球", action: "下蹲" },
  hoop: { name: "篮球框", action: "二连跳" },
};

export class ObstacleManager {
  constructor(images) {
    this.images = images;
    this.items = [];
    this.timer = 1.6;
  }

  reset() {
    this.items = [];
    this.timer = 1.6;
  }

  update(dt, speed, score) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.items.push(this.create());
      this.timer = Math.max(1.4, 2.24 + Math.random() * 0.84 - score * 0.0032);
    }

    for (const item of this.items) {
      item.x -= speed * dt;
      item.spin += dt * speed * 0.026;
    }
    this.items = this.items.filter((item) => item.x + item.width > -140);
  }

  create() {
    const roll = Math.random();
    if (roll < 0.42) return this.groundBall();
    if (roll < 0.74) return this.airBall();
    return this.hoop();
  }

  groundBall() {
    const size = 62;
    return { type: "groundBall", x: 1010, y: GROUND_Y - size, width: size, height: size, spin: 0, passed: false };
  }

  airBall() {
    const size = 58;
    return { type: "airBall", x: 1010, y: GROUND_Y - 142, width: size, height: size, spin: 0, passed: false };
  }

  hoop() {
    return { type: "hoop", x: 1010, y: GROUND_Y - 192, width: 92, height: 150, spin: 0, passed: false };
  }

  hitbox(item) {
    if (item.type === "hoop") {
      return { x: item.x + 8, y: item.y + 8, width: item.width - 16, height: item.height - 12 };
    }
    return { x: item.x + 7, y: item.y + 7, width: item.width - 14, height: item.height - 14 };
  }
}
