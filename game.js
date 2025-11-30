// Zen Bubbles - v2.5
// Pop sound pool (mobile-friendly), forgiving hitbox, Elena stages, Anastasia intro + mother bubble split in big playable bubbles

// Canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Ήχοι για το σκάσιμο της φούσκας (pool για λιγότερο lag σε κινητά)
const POP_POOL_SIZE = 6;
const popSounds = [];
let popIndex = 0;

for (let i = 0; i < POP_POOL_SIZE; i++) {
  const a = new Audio("pop.mp3");
  a.volume = 0.4;
  a.preload = "auto";
  popSounds.push(a);
}

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  // "ζεσταίνουμε" τα audio objects σε ένα user gesture
  popSounds.forEach((a) => {
    a.play().then(() => {
      a.pause();
      a.currentTime = 0;
    }).catch(() => {
      // σε κάποιους browsers μπορεί να αποτύχει σιωπηλά, δεν μας νοιάζει
    });
  });
}

function playPopSound() {
  const s = popSounds[popIndex];
  popIndex = (popIndex + 1) % POP_POOL_SIZE;

  try {
    s.currentTime = 0;
  } catch (e) {
    // σε κάποιους mobile browsers μπορεί να μην επιτρέπεται, αλλά συνήθως δουλεύει
  }

  s.play().catch(() => {
    // αν αποτύχει, το αγνοούμε – απλώς δεν θα ακουστεί ένα pop
  });
}

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
let lives = 7; // somewhat friendly
let running = false;
let gameOver = false;
let elapsed = 0; // total time in seconds

// tuning extras
let maxBubbles = 18;    // not indefinitely many
let streak = 0;         // πόσες στη σειρά
let lastPopTime = 0;    // για streak timing

// hitbox tuning (λίγο πιο forgiving)
const HITBOX_SCALE = 1.08;

// Intro (ιδέα Αναστασίας) – "μητρική φούσκα"
let inIntro = false;
let introTime = 0;
const INTRO_DURATION = 1.2; // πιο σύντομο intro για να μπαίνει γρήγορα στο παιχνίδι
let introSeeds = [];
let motherSplitDone = false; // για να σπάσει ΜΟΝΟ μία φορά η μητρική

// Zen background palette (ιδέα Έλενας)
const ZEN_BACKGROUNDS = [
  { top: "rgba(15, 23, 42, 0.4)", bottom: "rgba(15, 23, 42, 0.97)" },  // default
  { top: "rgba(52, 78, 98, 0.4)", bottom: "rgba(12, 24, 38, 0.97)" },  // blue-grey
  { top: "rgba(75, 56, 95, 0.4)", bottom: "rgba(20, 12, 33, 0.97)" },  // purple dusk
  { top: "rgba(40, 66, 60, 0.4)", bottom: "rgba(10, 25, 22, 0.97)" },  // teal forest
  { top: "rgba(98, 60, 60, 0.4)", bottom: "rgba(38, 15, 15, 0.97)" },  // warm rose
];

let currentBackgroundIndex = 0;
let targetBackgroundIndex = 0;
let bgBlend = 1;                // 1 = χωρίς transition
let nextBackgroundScore = 320;  // πιο αραιές αλλαγές "πίστας"

// --------------------------------------------------
// Βοηθητική συνάρτηση για ανάμιξη δύο rgba χρωμάτων
// --------------------------------------------------
function blendColor(c1, c2, t) {
  const parse = (c) => c.match(/[\d.]+/g).map(Number);
  let [r1, g1, b1, a1] = parse(c1);
  let [r2, g2, b2, a2] = parse(c2);
  let r = r1 + (r2 - r1) * t;
  let g = g1 + (g2 - g1) * t;
  let b = b1 + (b2 - b1) * t;
  let a = a1 + (a2 - a1) * t;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// --------------------------------------------------
// Intro seeds (μέσα στη "μητρική φούσκα") - ιδέα Αναστασίας
// --------------------------------------------------
function motherBubbleParams() {
  const motherRadius = Math.min(width, height) * 0.35;
  const cx = width / 2;
  const cy = height + motherRadius * 0.1; // λίγο κάτω από το κάτω όριο
  return { motherRadius, cx, cy };
}

function initIntroSeeds() {
  introSeeds = [];
  const { motherRadius, cx, cy } = motherBubbleParams();

  const count = 7;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI; // πάνω ημικύκλιο
    const r = motherRadius * 0.6 * Math.random();
    const x = cx + Math.cos(angle) * r;
    const y = cy - Math.sin(angle) * r;
    introSeeds.push({
      x,
      y,
      radius: randomRange(6, 10),
      vx: randomRange(-12, 12),
      vy: randomRange(-8, -2),
    });
  }
}

function updateIntro(dt) {
  const { motherRadius, cx, cy } = motherBubbleParams();

  introTime += dt;

  // Κίνηση των μικρών "σπόρων" μέσα στη μητρική
  introSeeds.forEach((s) => {
    s.x += s.vx * dt;
    s.y += s.vy * dt * 0.5; // πιο αργή κίνηση για zen feeling

    // Αναπήδηση στα όρια της μητρικής φούσκας (ημικύκλιο)
    const dx = s.x - cx;
    const dy = s.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > motherRadius * 0.8) {
      // Γύρνα προς το κέντρο
      s.vx *= -0.7;
      s.vy *= -0.7;
    }
  });

  // Όταν περάσει ο χρόνος intro → σπάει η μητρική φούσκα
  if (!motherSplitDone && introTime >= INTRO_DURATION) {
    motherSplitDone = true;
    inIntro = false;

    // Σπάει σε μεγαλύτερες "κόρες" playable bubbles
    spawnMotherSplit(cx, cy);
  }
}

function drawIntro(ctx) {
  const { motherRadius, cx, cy } = motherBubbleParams();

  ctx.save();

  // "μητρική" φούσκα ως ημικύκλιο
  const gradient = ctx.createRadialGradient(
    cx,
    cy - motherRadius * 0.3,
    motherRadius * 0.1,
    cx,
    cy,
    motherRadius
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  gradient.addColorStop(0.3, "rgba(129, 140, 248, 0.6)");
  gradient.addColorStop(1, "rgba(15, 23, 42, 0.9)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, motherRadius, Math.PI, 0, false); // ημικύκλιο
  ctx.closePath();
  ctx.fill();

  // outline
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
  ctx.stroke();

  // μικροί "σπόροι" φουσκίτσες μέσα στη "μήτρα"
  introSeeds.forEach((s) => {
    ctx.beginPath();
    ctx.fillStyle = "rgba(244, 244, 255, 0.9)";
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

// το σπάσιμο της μητρικής φούσκας σε μεγαλύτερες κανονικές φούσκες
function spawnMotherSplit(cx, cy) {
  const { motherRadius } = motherBubbleParams();

  const childCount = 6; // πόσες "κόρες" φούσκες
  for (let i = 0; i < childCount; i++) {
    // μοιράζουμε τις φούσκες πάνω στο ημικύκλιο της μητρικής
    const t = childCount === 1 ? 0.5 : i / (childCount - 1); // 0 → 1
    const angle = Math.PI - t * Math.PI; // από π (αριστερά) μέχρι 0 (δεξιά)
    const dist = motherRadius * 0.7;

    const x = cx + Math.cos(angle) * dist;
    const y = cy - Math.sin(angle) * dist;

    const b = new Bubble();
    b.x = x;
    b.y = y;
    b.radius = randomRange(26, 42); // λίγο μεγαλύτερες, "γεμάτες"
    b.baseSpeed *= 0.85; // ξεκινάνε λίγο πιο αργά για zen feeling

    bubbles.push(b);
  }
}

// --------------------------------------------------
// Bubble class
// --------------------------------------------------
class Bubble {
  constructor() {
    this.radius = randomRange(18, 42);
    this.x = randomRange(this.radius, width - this.radius);
    this.y = height + this.radius + randomRange(0, 40); // spawn slightly below
    this.baseSpeed = randomRange(24, 50); // slower start
    this.speed = this.baseSpeed;
    this.color = randomBubbleColor();
    this.alpha = randomRange(0.65, 0.95);
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
    const effectiveRadius = this.radius * HITBOX_SCALE;
    return dx * dx + dy * dy <= effectiveRadius * effectiveRadius;
  }
}

// --------------------------------------------------
// Utility functions
// --------------------------------------------------
function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function randomBubbleColor() {
  const palette = [
    "rgba(59, 130, 246, 0.9)",  // blue
    "rgba(129, 140, 248, 0.9)", // indigo
    "rgba(56, 189, 248, 0.9)",  // sky
    "rgba(34, 197, 94, 0.9)",   // green
    "rgba(244, 114, 182, 0.9)", // pink
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

// --------------------------------------------------
// Game loop
// --------------------------------------------------
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

  // intro phase
  if (inIntro) {
    updateIntro(dt);
  }

  // difficulty factor 0 → 1 σε ~90s
  const difficultyFactor = Math.min(elapsed / 90, 1);

  // adaptive spawn: από 1400ms σε 400ms
  const maxInterval = 1400;
  const minInterval = 400;
  spawnInterval = maxInterval - (maxInterval - minInterval) * difficultyFactor;

  // Spawn new bubbles μόνο όταν δεν είμαστε στο intro
  if (
    !inIntro &&
    performance.now() - lastSpawn > spawnInterval &&
    bubbles.length < maxBubbles
  ) {
    bubbles.push(new Bubble());
    lastSpawn = performance.now();
  }

  // Update κανονικές φούσκες
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

    // reset streak όταν χάνεις φούσκες
    streak = 0;

    if (lives <= 0) endGame();
  }

  // Smooth blending για αλλαγή background (ιδέα Έλενας)
  if (bgBlend < 1) {
    bgBlend += dt * 0.18; // πιο αργό fade για πιο zen
    if (bgBlend > 1) bgBlend = 1;
  }
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  // Background soft glow με blending ανάμεσα σε current & target
  const curr = ZEN_BACKGROUNDS[currentBackgroundIndex];
  const target = ZEN_BACKGROUNDS[targetBackgroundIndex];

  const top = blendColor(curr.top, target.top, bgBlend);
  const bottom = blendColor(curr.bottom, target.bottom, bgBlend);

  const bgGradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.1,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height)
  );
  bgGradient.addColorStop(0, top);
  bgGradient.addColorStop(1, bottom);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // intro "μητρική" φούσκα
  if (inIntro) {
    drawIntro(ctx);
  }

  // Κανονικές φούσκες
  bubbles.forEach((b) => b.draw(ctx));

  // Minimal "New Stage" indicator όταν γίνεται fade
  if (bgBlend < 1) {
    ctx.save();
    ctx.font = "24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = "center";
    ctx.fillText("New Stage", width / 2, height * 0.2);
    ctx.restore();
  }

  // Streak text
  if (streak >= 3) {
    ctx.save();
    ctx.font = "14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(190, 242, 100, 0.9)";
    ctx.textAlign = "center";
    ctx.fillText(`Streak x${streak}`, width / 2, 32);
    ctx.restore();
  }
}

// --------------------------------------------------
// Input handling
// --------------------------------------------------
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
      // Ήχος
      playPopSound();

      // Pop bubble
      bubbles.splice(i, 1);
      popped = true;

      // Streak logic
      if (lastPopTime && now - lastPopTime < 600) {
        streak += 1;
      } else {
        streak = 1;
      }
      lastPopTime = now;

      // Scoring
      const base = Math.round((50 - bubble.radius) + randomRange(3, 7));
      const baseScore = Math.max(base, 5);

      const bonus = (streak - 1) * 2;
      const gained = baseScore + Math.max(bonus, 0);

      score += gained;
      scoreEl.textContent = score;

      // Trigger αλλαγή background / "πίστας" (ιδέα Έλενας)
      if (score >= nextBackgroundScore) {
        currentBackgroundIndex = targetBackgroundIndex;
        targetBackgroundIndex =
          (targetBackgroundIndex + 1) % ZEN_BACKGROUNDS.length;
        nextBackgroundScore += 320; // κάθε 320 πόντοι, νέα "πίστα"
        bgBlend = 0; // ξεκινάει νέο fade
      }

      break;
    }
  }

  if (!popped) {
    // Miss click → μόνο σπάει το streak, δεν χάνει ζωή (zen)
    streak = 0;
  }
});

// --------------------------------------------------
// Game control
// --------------------------------------------------
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

  // reset intro / μητρική
  inIntro = true;
  introTime = 0;
  motherSplitDone = false;
  initIntroSeeds();

  // reset background progression (ιδέα Έλενας)
  currentBackgroundIndex = 0;
  targetBackgroundIndex = 0;
  bgBlend = 1;
  nextBackgroundScore = 320;
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
  newButton.addEventListener("click", () => {
    unlockAudio();
    startGame();
  });
}

// Initial overlay behaviour
startButton.addEventListener("click", () => {
  unlockAudio();
  startGame();
});
