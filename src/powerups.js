import { GROUND_Y } from "./player.js";

export const POWERUP_INFO = {
  shield: { name: "护盾", color: "#58d6ff" },
  doubleScore: { name: "双倍积分", color: "#ffd866" },
  rocket: { name: "火箭", color: "#ff6b7a" },
};

export class PowerUpManager {
  constructor() {
    this.items = [];
    this.timer = 4.5;
  }

  reset() {
    this.items = [];
    this.timer = 4.5;
  }

  update(dt, speed, score, blockers = []) {
    this.timer -= dt;
    if (this.timer <= 0) {
      const candidate = this.create();
      if (this.hasSpawnConflict(candidate, blockers)) {
        this.timer = 1.1;
      } else {
        this.items.push(candidate);
        this.timer = Math.max(5.2, 9 + Math.random() * 5 - score * 0.002);
      }
    }

    for (const item of this.items) {
      item.x -= speed * dt;
      item.float += dt * 4;
    }
    this.items = this.items.filter((item) => item.x + item.width > -80);
  }

  create() {
    const roll = Math.random();
    const type = roll < 0.42 ? "shield" : roll < 0.76 ? "doubleScore" : "rocket";
    return {
      type,
      x: 1040,
      y: GROUND_Y - 188 - Math.random() * 76,
      width: 54,
      height: 54,
      float: Math.random() * Math.PI * 2,
      collected: false,
    };
  }

  hitbox(item) {
    return {
      x: item.x + 6,
      y: item.y + 6,
      width: item.width - 12,
      height: item.height - 12,
    };
  }

  hasSpawnConflict(candidate, blockers) {
    const candidateCenter = candidate.x + candidate.width / 2;
    const allBlockers = [...blockers, ...this.items];
    return allBlockers.some((item) => {
      const blockerCenter = item.x + item.width / 2;
      return Math.abs(candidateCenter - blockerCenter) < 220;
    });
  }
}
