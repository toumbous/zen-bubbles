// bubbles.js
// Bubble & MiniBubble classes + spawnMiniBubbles

import { HITBOX_SCALE, randomRange, randomBubbleColor } from "./config.js";

// Mini-bubbles (visual effect when mother bubble breaks)
const MINIBUBBLE = {
  BASE_MIN_RADIUS: 4,
  BASE_MAX_RADIUS: 9,
  GRAVITY: 30,
  LIFE_SECONDS: 1.0,
  VX_MIN: -40,
  VX_MAX: 40,
  VY_MIN: -60,
  VY_MAX: -20,
};

export class MiniBubble {
  constructor(x, y, color, radiusScale = 1) {
    this.x = x;
    this.y = y;
    this.radius =
      randomRange(
        MINIBUBBLE.BASE_MIN_RADIUS,
        MINIBUBBLE.BASE_MAX_RADIUS
      ) * radiusScale;
    this.vx =
      randomRange(MINIBUBBLE.VX_MIN, MINIBUBBLE.VX_MAX) *
      radiusScale;
    this.vy =
      randomRange(MINIBUBBLE.VY_MIN, MINIBUBBLE.VY_MAX) *
      radiusScale;
    this.life = 0;
    this.color = color;
  }

  update(dt) {
    this.life += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += MINIBUBBLE.GRAVITY * dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, 1 - this.life);
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isDead() {
    return this.life >= MINIBUBBLE.LIFE_SECONDS;
  }
}

export function spawnMiniBubbles(x, y, count = 12, radiusScale = 1.6) {
  const colors = [
    "rgba(253, 224, 71, 0.9)", // golden
    "rgba(156, 163, 175, 0.9)", // silver-ish
    "rgba(244, 114, 82, 0.9)", // warm bronze-ish
  ];
  const miniBubbles = [];
  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    miniBubbles.push(new MiniBubble(x, y, color, radiusScale));
  }
  return miniBubbles;
}

// Κανονικές + golden φούσκες
export class Bubble {
  constructor(width, height, type = "normal") {
    this.type = type; // "normal" | "golden" | "life"

    this.radius = randomRange(18, 42);
    this.x = randomRange(this.radius, width - this.radius);
    this.y = height + this.radius + randomRange(0, 40);
    this.baseSpeed = randomRange(24, 50);
    this.speed = this.baseSpeed;

    if (this.type === "golden") {
      this.color = "rgba(253, 224, 71, 0.95)";
      this.alpha = 0.95;
      this.radius *= 1.15;
    } else if (this.type === "life") {
      // life bubble: πιο απαλή, “healing”
      this.color = "rgba(45, 212, 191, 0.95)"; // teal / aqua
      this.alpha = 0.95;
      this.radius *= 1.1;
    } else {
      this.color = randomBubbleColor();
      this.alpha = randomRange(0.65, 0.95);
    }
  }


  update(dt, difficultyFactor) {
    this.speed = this.baseSpeed * (0.9 + difficultyFactor * 0.8);
    this.y -= this.speed * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;

    const gradient = ctx.createRadialGradient(
      this.x - this.radius * 0.3,
      this.y - this.radius * 0.3,
      this.radius * 0.2,
      this.x,
      this.y,
      this.radius
    );

    if (this.type === "golden") {
      gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      gradient.addColorStop(0.25, "rgba(253, 224, 71, 0.95)");
      gradient.addColorStop(1, "rgba(15, 23, 42, 0.9)");
    } else {
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      gradient.addColorStop(0.2, this.color);
      gradient.addColorStop(1, "rgba(15, 23, 42, 0.9)");
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = this.type === "golden" ? 2 : 1;
    ctx.strokeStyle =
      this.type === "golden"
        ? "rgba(253, 224, 71, 0.9)"
        : "rgba(148, 163, 184, 0.6)";
    ctx.stroke();

    // extra overlay για life bubble (μικρός σταυρός)
    if (this.type === "life") {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(240, 253, 250, 0.95)";
      const crossSize = this.radius * 0.4;
      // κάθετη γραμμή
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - crossSize / 2);
      ctx.lineTo(this.x, this.y + crossSize / 2);
      ctx.stroke();
      // οριζόντια γραμμή
      ctx.beginPath();
      ctx.moveTo(this.x - crossSize / 2, this.y);
      ctx.lineTo(this.x + crossSize / 2, this.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  isOffScreen() {
    return this.y + this.radius < 0;
  }

  containsPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const effectiveRadius = this.radius * HITBOX_SCALE;
    return dx * dx + dy * dy <= effectiveRadius * effectiveRadius;
  }
}
