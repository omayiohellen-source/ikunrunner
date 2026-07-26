const GROUND_Y = 470;
const GRAVITY = 1900;
const JUMP_VELOCITY = -680;
const SECOND_JUMP_VELOCITY = -730;

export class Player {
  constructor() {
    this.x = 128;
    this.standWidth = 72;
    this.standHeight = 116;
    this.duckWidth = 104;
    this.duckHeight = 62;
    this.reset();
  }

  reset() {
    this.width = this.standWidth;
    this.height = this.standHeight;
    this.y = GROUND_Y - this.height;
    this.vy = 0;
    this.grounded = true;
    this.ducking = false;
    this.jumpsLeft = 1;
  }

  update(dt, gravityScale = 1) {
    if (!this.grounded) {
      this.vy += GRAVITY * gravityScale * dt;
      this.y += this.vy * dt;
      if (this.y + this.height >= GROUND_Y) {
        this.grounded = true;
        this.vy = 0;
        this.jumpsLeft = 1;
        this.y = GROUND_Y - this.height;
      }
    }
  }

  jump() {
    if (this.grounded) {
      this.ducking = false;
      this.stand();
      this.grounded = false;
      this.vy = JUMP_VELOCITY;
      this.jumpsLeft = 1;
      return true;
    }

    if (this.jumpsLeft > 0) {
      this.vy = SECOND_JUMP_VELOCITY;
      this.jumpsLeft -= 1;
      return true;
    }

    return false;
  }

  setDuck(active) {
    if (!this.grounded) return false;
    if (this.ducking === active) return false;
    this.ducking = active;
    if (active) {
      this.width = this.duckWidth;
      this.height = this.duckHeight;
      this.y = GROUND_Y - this.height;
    } else {
      this.stand();
    }
    return true;
  }

  stand() {
    this.width = this.standWidth;
    this.height = this.standHeight;
    if (this.grounded) this.y = GROUND_Y - this.height;
  }

  hitbox() {
    return this.ducking
      ? { x: this.x + 14, y: this.y + 12, width: this.width - 24, height: this.height - 18 }
      : { x: this.x + 14, y: this.y + 12, width: this.width - 26, height: this.height - 18 };
  }
}

export { GROUND_Y };
