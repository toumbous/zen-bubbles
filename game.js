// Zen Bubbles - tuned version

// Canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let width = window.innerWidth;
let height = window.innerHeight;

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// HUD & overlay
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const overlayContent = document.getElementById("overlay-content");
const startButton = document.getElementById("startButton");

// Game state
let bubbles = [];
let lastSpawn = 0;
let spawnInterval = 1400; // slower start (ms)
let lastTime = 0;
let score = 0;
let lives = 7; // λίγο πιο φιλικό
let running = false;
let gameOver = false;
let elapsed = 0; // total time in seconds

// tuning extras
let maxBubbles = 18;     // όχι άπειρες φούσκες
let streak = 0;          // πόσες στη σειρά
let lastPopTime = 0;     // για streak timing

// Bubble class
class Bubble {
  constructor() {
    this.radius = randomRange(18, 42);
    this.x = randomRange(this.radius, width - this.radius);
    this.y = height + this.radius + randomRange(0, 40); // spawn slightly below
    this.baseSpeed = randomRange(24, 50); // πιο αργό αρχικά
    this.speed = this.baseSpeed;
    this.color = randomBubbleColor();
    this.alpha = randomRange(0.65, 0.95);
  }

  update(dt, difficultyFactor) {
    // αυξάνουμε λίγο την ταχύτητα με τον χρόνο
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
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(0.2, this.color);
    gradient.addColorStop(1, "rgba(15, 23, 42, 0.9)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // subtle outline
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    ctx.stroke();

    ctx.restore();
  }

  isOffScreen() {
    return this.y + this.radius < 0;
  }

  containsPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    // ελαφρώς μεγαλύτερο hitbox για πιο “forgiving” εμπειρία
    const effectiveRadius = this.radius * 1.05;
    return dx * dx + dy * dy <= effectiveRadius * effectiveRadius;
  }
}

// Utility functions
function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function randomBubbleColor() {
  // soft blues / purples / greens
  const palette = [
    "rgba(59, 130, 246, 0.9)",  // blue
    "rgba(129, 140, 248, 0.9)", // indigo
    "rgba(56, 189, 248, 0.9)",  // sky
    "rgba(34, 197, 94, 0.9)",   // green
    "rgba(244, 114, 182, 0.9)", // pink
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

// Game loop
function gameLoop(timestamp) {
  if (!running) return;

  if (!lastTime) lastTime = timestamp;
  const delta = (timestamp - lastTime) / 1000; // seconds
  lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

function update(dt) {
  elapsed += dt;

  // difficulty factor 0 → 1 σε ~90 δευτ.
  const difficultyFactor = Math.min(elapsed / 90, 1);

  // adaptive spawn: από 1400ms μέχρι 400ms
  const maxInterval = 1400;
  const minInterval = 400;
  spawnInterval = maxInterval - (maxInterval - minInterval) * difficultyFactor;

  // Spawn νέα bubbles, αλλά όχι πάνω από maxBubbles
  if (
    performance.now() - lastSpawn > spawnInterval &&
    bubbles.length < maxBubbles
  ) {
    bubbles.push(new Bubble());
    lastSpawn = performance.now();
  }

  // Update bubbles
  bubbles.forEach((b) => b.update(dt, difficultyFactor));

  // Handle off-screen bubbles
  let missed = 0;
  bubbles = bubbles.filter((b) => {
    if (b.isOffScreen()) {
      missed++;
      return false;
    }
    return true;
  });

  if (missed > 0) {
    lives -= missed;
    if (lives < 0) lives = 0;
    livesEl.textContent = lives;
    // reset streak όταν χάνεις
    if (missed > 0) {
      streak = 0;
    }
    if (lives <= 0) endGame();
  }
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  // Background soft glow
  const bgGradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.1,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height)
  );
  bgGradient.addColorStop(0, "rgba(15, 23, 42, 0.4)");
  bgGradient.addColorStop(1, "rgba(15, 23, 42, 0.97)");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  bubbles.forEach((b) => b.draw(ctx));

  // optional: μικρούλι text για streak στη γωνία (αν έχεις streak)
  if (streak >= 3) {
    ctx.save();
    ctx.font = "14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(190, 242, 100, 0.9)";
    ctx.textAlign = "center";
    ctx.fillText(`Streak x${streak}`, width / 2, 32);
    ctx.restore();
  }
}

// Input handling
canvas.addEventListener("pointerdown", (e) => {
  if (!running || gameOver) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const now = performance.now();
  let popped = false;

  // Find top-most bubble under pointer (last in array is drawn last)
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];
    if (bubble.containsPoint(x, y)) {
      // Pop bubble
      bubbles.splice(i, 1);
      popped = true;

      // streak logic: αν πέρασαν λιγότερα από 600ms από το προηγούμενο pop, αυξάνεται
      if (lastPopTime && now - lastPopTime < 600) {
        streak += 1;
      } else {
        streak = 1;
      }
      lastPopTime = now;

      // base score: μικρότερη φούσκα → περισσότερους πόντους
      const base = Math.round((50 - bubble.radius) + randomRange(3, 7));
      const baseScore = Math.max(base, 5);

      // bonus από streak (λίγο, για να είναι ζεν, όχι arcade φρενίτιδα)
      const bonus = (streak - 1) * 2;
      const gained = baseScore + Math.max(bonus, 0);

      score += gained;
      scoreEl.textContent = score;

      break;
    }
  }

  if (!popped) {
    // Miss click → σπάει το streak, αλλά δεν κόβουμε life για zen φάση
    streak = 0;
  }
});

// Game control
function resetGame() {
  bubbles = [];
  score = 0;
  lives = 7;
  elapsed = 0;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  lastTime = 0;
  lastSpawn = performance.now();
  gameOver = false;
  streak = 0;
  lastPopTime = 0;
}

function startGame() {
  resetGame();
  overlay.classList.add("hidden");
  running = true;
  requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;
  gameOver = true;

  overlay.classList.remove("hidden");
  overlayContent.innerHTML = `
    <h1>Game Over</h1>
    <p>Your score: <strong>${score}</strong></p>
    <p>Pop the bubbles, keep your focus, stay zen.</p>
    <button id="startButton">Play Again</button>
  `;

  const newButton = document.getElementById("startButton");
  newButton.addEventListener("click", startGame);
}

// Initial overlay behaviour
startButton.addEventListener("click", startGame);
