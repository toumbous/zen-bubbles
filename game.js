// game.js
// Zen Bubbles – main game loop, state, intro, input

import {
  INTRO_DURATION,
  ZEN_BACKGROUNDS,
  randomRange,
  blendColor
} from "./config.js";

import { Bubble, spawnMiniBubbles } from "./bubbles.js";

// Supabase config
// ---------------------
const SUPABASE_URL = "https://zgvgafsczatxfrkbvsvf.supabase.co";
const SUPABASE_KEY = "sb_publishable_DwMcC_-AuwcnZdayA1pi1Q_Ap1BafON";
const SUPABASE_TABLE = "scores";

// --------------------------------------------------
// Tunable constants
// --------------------------------------------------
const POP_POOL_SIZE = 6;
const POP_VOLUME = 0.4;

const GOLDEN_BUBBLE_CHANCE = 0.1;            // 10% πιθανότητα να είναι golden
const GOLDEN_BLAST_RADIUS_MULTIPLIER = 5.0;   // πόσο μεγάλη η "έκρηξη"
const GOLDEN_FLAT_BONUS = 40;                 // extra πόντοι όταν σκάει

const LIFE_BUBBLE_CHANCE = 0.06;       // 6% περίπου
const LIFE_BUBBLE_MIN_ELAPSED = 15;    // να εμφανίζεται μετά από 15"
const MAX_LIVES = 10;                  // δεν πάμε πάνω από 10 ζωές
const LIFE_BUBBLE_SCORE = 15;          // λίγοι έξτρα πόντοι

const INITIAL_LIVES = 7;
const MAX_BUBBLES = 18;

const DIFFICULTY_RAMP_SECONDS = 90; // 0 → 1 σε ~90s

const SPAWN_INTERVAL_MAX = 1400;
const SPAWN_INTERVAL_MIN = 400;

const BG_BLEND_SPEED = 0.18;
const BACKGROUND_SCORE_STEP = 320;

const STREAK_WINDOW_MS = 600;

// --------------------------------------------------
// Easing helpers
// --------------------------------------------------
function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

// --------------------------------------------------
// Canvas setup
// --------------------------------------------------
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

// --------------------------------------------------
// HUD & overlay
// --------------------------------------------------
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const overlayContent = document.getElementById("overlay-content");
const startButton = document.getElementById("startButton");

// --------------------------------------------------
// Pop sound pool (για λιγότερο lag σε κινητά)
// --------------------------------------------------
const popSounds = [];
let popIndex = 0;
let audioUnlocked = false;

for (let i = 0; i < POP_POOL_SIZE; i++) {
  const a = new Audio("pop.mp3");
  a.volume = POP_VOLUME;
  a.preload = "auto";
  popSounds.push(a);
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  popSounds.forEach((a) => {
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
      })
      .catch(() => {
        // mobile browsers μπορεί να μπλοκάρουν autoplay – δεν μας νοιάζει
      });
  });
}

function playPopSound() {
  const s = popSounds[popIndex];
  popIndex = (popIndex + 1) % POP_POOL_SIZE;

  try {
    s.currentTime = 0;
  } catch (e) {
    // κάποιοι mobile browsers γκρινιάζουν εδώ – safe to ignore
  }

  s.play().catch(() => {
    // αν αποτύχει, απλά δεν θα ακουστεί αυτό το pop
  });
}

// --------------------------------------------------
// Game state
// --------------------------------------------------
let bubbles = [];
let miniBubbles = [];

let bonusDudes = [];
let lastBonusSpawn = 0;

const BONUS_MIN_ELAPSED = 20;      // μετά από ~20" αρχίζουν να εμφανίζονται
const BONUS_SPAWN_INTERVAL = 9000; // κάθε ~9" max ένα ανθρωπάκι
const MAX_BONUS_DUDES = 2;         // όχι περισσότερα από 2 ταυτόχρονα
const BONUS_DUDE_SCORE = 60;       // πόντοι όταν το πετυχαίνεις

let lastSpawn = 0;
let spawnInterval = SPAWN_INTERVAL_MAX;
let lastTime = 0;

let score = 0;
let lives = INITIAL_LIVES;
let running = false;
let gameOver = false;
let elapsed = 0;

let streak = 0;
let lastPopTime = 0;

// Intro / mother bubble (ιδέα Αναστασίας)
let inIntro = false;
let introTime = 0;
let motherSplitDone = false;

let motherX = 0;
let motherY = 0;
let introSeeds = [];

// Background blending (ιδέα Έλενας)
let currentBackgroundIndex = 0;
let targetBackgroundIndex = 0;
let bgBlend = 1;
let nextBackgroundScore = BACKGROUND_SCORE_STEP;

// --------------------------------------------------
// Intro helpers (μητρική φούσκα)
// --------------------------------------------------
function motherBubbleParams() {
  const motherRadius = Math.min(width, height) * 0.35;
  const cx = width / 2;
  const cy = height + motherRadius * 0.1; // λίγο κάτω από το κάτω όριο
  return { motherRadius, cx, cy };
}

function getMotherRadius() {
  return Math.min(width, height) * 0.16; // μπορείς να το αλλάξεις αν τη θες πιο μεγάλη/μικρή
}

function initIntro() {
  introTime = 0;
  motherSplitDone = false;

  const r = getMotherRadius();
  motherX = width / 2;
  // ξεκινάει τελείως κάτω από την οθόνη
  motherY = height + r + 40;

  introSeeds = [];

  const seedCount = 6;
  for (let i = 0; i < seedCount; i++) {
    introSeeds.push({
      x: motherX + randomRange(-40, 40),
      y: motherY + randomRange(30, 120),
      offsetY: randomRange(40, 120),
      radius: randomRange(6, 11),
    });
  }
}


function updateIntro(dt) {
  introTime += dt;

  const t = Math.min(introTime / INTRO_DURATION, 1);
  const eased = easeOutQuad(t); // η helper που βάλαμε πριν

  const r = getMotherRadius();

  const startY = height + r + 40;               // τελείως κάτω
  const endY = height - r * 0.5;               // να φαίνεται αρκετά μέσα στο παιχνίδι

  motherY = startY + (endY - startY) * eased;
  motherX = width / 2;

  // οι μικρές φουσκίτσες ακολουθούν την μητρική από πίσω
  introSeeds.forEach((s) => {
    const targetX = motherX + randomRange(-25, 25);
    const targetY = motherY + s.offsetY;

    s.x += (targetX - s.x) * 2.2 * dt;
    s.y += (targetY - s.y) * 2.5 * dt;
  });

  // όταν τελειώσει το intro → σπάει σε κόρες
  if (!motherSplitDone && t >= 1) {
    motherSplitDone = true;
    inIntro = false;

    spawnMotherSplit(motherX, motherY);
  }
}



function drawIntro(ctx) {
  const r = getMotherRadius();

  ctx.save();

  // "τοίχωμα" στο κάτω μέρος – μια απλή soft γραμμή
  const wallGradient = ctx.createLinearGradient(
    0,
    height - 4,
    0,
    height + 40
  );
  wallGradient.addColorStop(0, "rgba(15, 23, 42, 0.9)");
  wallGradient.addColorStop(1, "rgba(15, 23, 42, 0.0)");

  ctx.fillStyle = wallGradient;
  ctx.fillRect(0, height - 4, width, 44);

  // μητρική φούσκα
  const bubbleGrad = ctx.createRadialGradient(
    motherX - r * 0.3,
    motherY - r * 0.3,
    r * 0.2,
    motherX,
    motherY,
    r
  );
  bubbleGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  bubbleGrad.addColorStop(0.25, "rgba(196, 181, 253, 0.85)");
  bubbleGrad.addColorStop(1, "rgba(15, 23, 42, 0.9)");

  ctx.beginPath();
  ctx.fillStyle = bubbleGrad;
  ctx.arc(motherX, motherY, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.9)";
  ctx.stroke();

  // "σποράκια" που την ακολουθούν
  introSeeds.forEach((s) => {
    ctx.beginPath();
    ctx.fillStyle = "rgba(244, 244, 255, 0.9)";
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}



// --------------------------------------------------
// Mother split → κόρες φούσκες + mini-bubbles
// --------------------------------------------------

function spawnMotherSplit(cx, cy) {
  const baseR = getMotherRadius();

  const childCount = 6;
  for (let i = 0; i < childCount; i++) {
    const b = new Bubble();

    const angle = randomRange(-Math.PI / 2.2, -Math.PI / 0.9); // προς τα πάνω
    const dist = baseR * randomRange(0.4, 1.1);

    b.x = cx + Math.cos(angle) * dist + randomRange(-12, 12);
    b.y = cy + Math.sin(angle) * dist + randomRange(-6, 6);

    b.radius = randomRange(26, 42);
    b.baseSpeed *= 0.9;

    bubbles.push(b);
  }
}


function handleBubblePop(bubble, index, now) {
  // αφαιρούμε τη φούσκα που πατήθηκε
  bubbles.splice(index, 1);

  // streak logic
  if (lastPopTime && now - lastPopTime < STREAK_WINDOW_MS) {
    streak += 1;
  } else {
    streak = 1;
  }
  lastPopTime = now;

  // base scoring
  const base = Math.round((50 - bubble.radius) + randomRange(3, 7));
  const baseScore = Math.max(base, 5);
  const bonusFromStreak = (streak - 1) * 2;
  let gained = baseScore + Math.max(bonusFromStreak, 0);

  // LIFE BUBBLE → δίνει ζωή + λίγους πόντους + απαλή έκρηξη
  if (bubble.type === "life") {
    const oldLives = lives;
    lives = Math.min(lives + 1, MAX_LIVES);
    livesEl.textContent = lives;

    // λίγοι σίγουροι πόντοι
    gained += LIFE_BUBBLE_SCORE;

    // μικρό healing effect (aqua mini bubbles)
    miniBubbles.push(
      ...spawnMiniBubbles(bubble.x, bubble.y, 14, 1.1)
    );
  }

  // GOLDEN BUBBLE → μεγάλη έκρηξη
  if (bubble.type === "golden") {
    const blastRadius = bubble.radius * GOLDEN_BLAST_RADIUS_MULTIPLIER;
    const blastRadiusSq = blastRadius * blastRadius;

    let cleared = 0;

    for (let j = bubbles.length - 1; j >= 0; j--) {
      const other = bubbles[j];
      const dx = other.x - bubble.x;
      const dy = other.y - bubble.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= blastRadiusSq) {
        const base2 = Math.round((50 - other.radius) + randomRange(3, 7));
        const baseScore2 = Math.max(base2, 5);
        gained += baseScore2;

        bubbles.splice(j, 1);
        cleared++;
      }
    }

    gained += GOLDEN_FLAT_BONUS + cleared * 3;

    miniBubbles.push(
      ...spawnMiniBubbles(bubble.x, bubble.y, 22, 1.4)
    );
  }

  // τελικό score
  score += gained;
  scoreEl.textContent = score;

  // αλλαγή background
  if (score >= nextBackgroundScore) {
    currentBackgroundIndex = targetBackgroundIndex;
    targetBackgroundIndex =
      (targetBackgroundIndex + 1) % ZEN_BACKGROUNDS.length;
    nextBackgroundScore += BACKGROUND_SCORE_STEP;
    bgBlend = 0;
  }
}

// --------------------------------------------------
// Game loop
// --------------------------------------------------
function gameLoop(timestamp) {
  if (!running) return;

  if (!lastTime) lastTime = timestamp;
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

class BonusDude {
  constructor() {
    const fromLeft = Math.random() < 0.5;
    const margin = 40;

    this.radius = 14;
    this.y = randomRange(height * 0.25, height * 0.75);

    if (fromLeft) {
      this.x = -margin;
      this.vx = randomRange(40, 80);
    } else {
      this.x = width + margin;
      this.vx = randomRange(-80, -40);
    }

    this.vy = randomRange(-10, 10);
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt + Math.sin(this.t * 3) * 8 * dt;

  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.strokeStyle = "rgba(248, 250, 252, 0.9)";
    ctx.lineWidth = 2;

    // κεφάλι
    ctx.beginPath();
    ctx.arc(0, -this.radius * 0.6, this.radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    // σώμα
    ctx.beginPath();
    ctx.moveTo(0, -this.radius * 0.1);
    ctx.lineTo(0, this.radius * 0.9);
    ctx.stroke();

    // χέρια
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.7, this.radius * 0.2);
    ctx.lineTo(this.radius * 0.7, this.radius * 0.2);
    ctx.stroke();

    // πόδια
    ctx.beginPath();
    ctx.moveTo(0, this.radius * 0.9);
    ctx.lineTo(-this.radius * 0.7, this.radius * 1.7);
    ctx.moveTo(0, this.radius * 0.9);
    ctx.lineTo(this.radius * 0.7, this.radius * 1.7);
    ctx.stroke();

    ctx.restore();
  }

  isOffScreen() {
    return (
      this.x < -80 ||
      this.x > width + 80 ||
      this.y < -80 ||
      this.y > height + 80
    );
  }

  containsPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const r = this.radius * 1.3;
    return dx * dx + dy * dy <= r * r;
  }
}

function update(dt) {
  elapsed += dt;

  if (inIntro) {
    updateIntro(dt);
  }

  // difficulty factor 0 → 1
  const difficultyFactor = Math.min(
    elapsed / DIFFICULTY_RAMP_SECONDS,
    1
  );

  // spawn interval από 1400ms σε 400ms
  spawnInterval =
    SPAWN_INTERVAL_MAX -
    (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN) * difficultyFactor;

  // spawn νέων φουσκών (όχι στο intro)
  if (
  !inIntro &&
  performance.now() - lastSpawn > spawnInterval &&
  bubbles.length < MAX_BUBBLES
) {
  let type = "normal";
  const r = Math.random();

  // Προτεραιότητα: life → golden → normal
  if (elapsed > LIFE_BUBBLE_MIN_ELAPSED && r < LIFE_BUBBLE_CHANCE) {
    type = "life";
  } else if (r < LIFE_BUBBLE_CHANCE + GOLDEN_BUBBLE_CHANCE) {
    type = "golden";
  }

  bubbles.push(new Bubble(width, height, type));
  lastSpawn = performance.now();
}

// spawn bonus ανθρωπάκια
  if (
    elapsed > BONUS_MIN_ELAPSED &&
    performance.now() - lastBonusSpawn > BONUS_SPAWN_INTERVAL &&
    bonusDudes.length < MAX_BONUS_DUDES
  ) {
    bonusDudes.push(new BonusDude());
    lastBonusSpawn = performance.now();
  }


  // update κανονικές φούσκες
  bubbles.forEach((b) => b.update(dt, difficultyFactor));

  // update mini-bubbles
  miniBubbles.forEach((mb) => mb.update(dt));
  miniBubbles = miniBubbles.filter((mb) => !mb.isDead());

  bonusDudes.forEach((d) => d.update(dt));
  bonusDudes = bonusDudes.filter((d) => !d.isOffScreen());

  // φούσκες που πάνε off-screen → χάνεις ζωές
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

    // reset streak
    streak = 0;

    if (lives <= 0) endGame();
  }

  // background blending
  if (bgBlend < 1) {
    bgBlend += dt * BG_BLEND_SPEED;
    if (bgBlend > 1) bgBlend = 1;
  }
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  // background soft glow
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

  // intro
  if (inIntro) {
    drawIntro(ctx);
  }

  // bubbles
  bubbles.forEach((b) => b.draw(ctx));

  // mini-bubbles
  miniBubbles.forEach((mb) => mb.draw(ctx));

    // Κανονικές φούσκες
  bubbles.forEach((b) => b.draw(ctx));

  // Mini-bubbles
  miniBubbles.forEach((mb) => mb.draw(ctx));

  // Ανθρωπάκια bonus
  bonusDudes.forEach((d) => d.draw(ctx));

  // "New Stage" indicator
  if (bgBlend < 1) {
    ctx.save();
    ctx.font =
      "24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = "center";
    ctx.fillText("New Stage", width / 2, height * 0.2);
    ctx.restore();
  }

  // streak text
  if (streak >= 3) {
    ctx.save();
    ctx.font =
      "14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
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

    // Πρώτα τσεκάρουμε τα ανθρωπάκια bonus
  for (let i = bonusDudes.length - 1; i >= 0; i--) {
    const dude = bonusDudes[i];
    if (dude.containsPoint(x, y)) {
      playPopSound();
      bonusDudes.splice(i, 1);

      // Bonus score
      score += BONUS_DUDE_SCORE;
      scoreEl.textContent = score;

      // Μικρό visual burst
      miniBubbles.push(
        ...spawnMiniBubbles(dude.x, dude.y, 16, 1.2)
      );

      popped = true;
      break;
    }
  }

  if (popped) {
    // αν χτύπησες ανθρωπάκι, δεν χρειάζεται να συνεχίσουμε στους bubbles
    return;
  }

  // top-most bubble first
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];
    if (bubble.containsPoint(x, y)) {
      playPopSound();
      handleBubblePop(bubble, i, now);
      popped = true;
      break;
    }
  }

  if (!popped) {
    // miss click → σπάει μόνο το streak
    streak = 0;
  }
});


// --------------------------------------------------
// Game control
// --------------------------------------------------
function resetGame() {
  bubbles = [];
  miniBubbles = [];
  bonusDudes = [];
  score = 0;
  lives = INITIAL_LIVES;
  elapsed = 0;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  lastTime = 0;
  lastSpawn = performance.now();
  lastBonusSpawn = performance.now();
  gameOver = false;
  streak = 0;
  lastPopTime = 0;

  // intro / μητρική
  inIntro = true;
  introTime = 0;
  motherSplitDone = false;
  initIntro();

  // backgrounds
  currentBackgroundIndex = 0;
  targetBackgroundIndex = 0;
  bgBlend = 1;
  nextBackgroundScore = BACKGROUND_SCORE_STEP;
}

function startGame() {
  resetGame();
  overlay.classList.add("hidden");
  running = true;
  requestAnimationFrame(gameLoop);
}

async function submitScoreToSupabase(name, score, avatar) {
  const payload = {
    name,
    score,
    avatar: avatar && avatar.trim() !== "" ? avatar.trim() : null,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error submitting score:", text);
      return null;
    }

    const data = await res.json();
    return data[0] || null;
  } catch (err) {
    console.error("Network error submitting score:", err);
    return null;
  }
}

async function fetchLeaderboardFromSupabase(limit = 10) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}` +
        `?select=name,score,avatar&order=score.desc&limit=${limit}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Error fetching leaderboard:", text);
      return [];
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Network error fetching leaderboard:", err);
    return [];
  }
}

function renderLeaderboardList(listElement, entries) {
  listElement.innerHTML = "";

  if (!entries || entries.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No scores yet. Be the first!";
    listElement.appendChild(li);
    return;
  }

  entries.forEach((entry, index) => {
    const li = document.createElement("li");

    // Avatar: emoji ή URL (προαιρετικό)
    let avatarPart = "";
    if (entry.avatar) {
      if (entry.avatar.startsWith("http")) {
        // εικόνα
        avatarPart = `<img src="${entry.avatar}" alt="" class="lb-avatar" />`;
      } else {
        // π.χ. emoji
        avatarPart = `<span class="lb-avatar-text">${entry.avatar}</span>`;
      }
    }

    li.innerHTML = `
      <span class="lb-rank">#${index + 1}</span>
      ${avatarPart}
      <span class="lb-name">${entry.name}</span>
      <span class="lb-score">${entry.score}</span>
    `;

    listElement.appendChild(li);
  });
}

function endGame() {
  running = false;
  gameOver = true;

  overlay.classList.remove("hidden");

  overlayContent.innerHTML = `
    <h1>Game Over</h1>
    <p>Your score: <strong>${score}</strong></p>

    <div class="leaderboard-section">
      <h2>Leaderboard</h2>

      <div class="leaderboard-form">
        <label>
          Name:
          <input id="playerNameInput" type="text" maxlength="12" />
        </label>
        <label>
          Avatar (optional):
          <input id="playerAvatarInput" type="text" maxlength="32" placeholder="emoji or image URL" />
        </label>
        <button id="saveScoreButton">Save score</button>
      </div>

      <ol id="leaderboardList"></ol>
    </div>

    <button id="startButton">Play Again</button>
  `;

  const nameInput = document.getElementById("playerNameInput");
  const avatarInput = document.getElementById("playerAvatarInput");
  const saveScoreButton = document.getElementById("saveScoreButton");
  const leaderboardList = document.getElementById("leaderboardList");
  const newButton = document.getElementById("startButton");
  let playerName = localStorage.getItem("zenPlayerName") || "";

  // Προγέμισμα name από localStorage αν υπάρχει
  nameInput.value = playerName || "";

  // Φέρνουμε αρχικά leaderboard
  fetchLeaderboardFromSupabase(10).then((entries) => {
    renderLeaderboardList(leaderboardList, entries);
  });

  saveScoreButton.addEventListener("click", async () => {
    let name = nameInput.value.trim();
    const avatar = avatarInput.value.trim();

    if (!name) {
      name = "Player";
    }

    playerName = name;
    localStorage.setItem("zenPlayerName", playerName);

    // 1) Στέλνουμε score στο Supabase
    await submitScoreToSupabase(name, score, avatar);

    // 2) Ξαναφέρνουμε το leaderboard
    const updated = await fetchLeaderboardFromSupabase(10);
    renderLeaderboardList(leaderboardList, updated);
  });

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