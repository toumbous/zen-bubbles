# Zen Bubbles

### 🎮 Play Online

👉 https://toumbous.github.io/zen-bubbles/

![Zen Bubbles Screenshot](screenshot.png)

A minimal, relaxing bubble-popper game built with HTML5 Canvas and vanilla JavaScript.

Zen Bubbles starts calm, encouraging a “flow state”, and gradually becomes more challenging as bubbles spawn faster and rise quicker. Designed to feel meditative at first and lightly intense towards the end – the perfect mix of focus and relaxation.

---

## 🎮 Gameplay

- Bubbles rise slowly from the bottom of the screen.
- Click/tap on bubbles to pop them and gain points.
- Smaller bubbles are worth more.
- If too many bubbles escape the top, you lose lives.
- Once your lives reach zero, the game ends.
- Difficulty increases gradually over ~90 seconds:
  - faster spawn rate
  - faster bubble movement
  - slightly increased bubble density

### ⭐ Streak System

If you pop bubbles quickly in succession (<600ms between pops):

- you build a **combo streak**
- each streak gives a small bonus to score
- higher streak = higher points
- missing bubbles or clicking empty areas resets the streak

---

## 🧘 Design Philosophy

Zen Bubbles is designed around:

- gentle pacing at the start
- focus-building mid-game
- smooth escalation into a light challenge
- a simple, mindful loop

No harsh failures, no loud effects — just subtle visuals, soft gradients, and a meditative progression into difficulty.

---

## 🛠️ Tech

- **HTML5 Canvas** rendering
- **Vanilla JavaScript** (no dependencies)
- Custom bubble physics & gradient shading
- Responsive full-screen layout
- Pointer events for both mouse & touch
- Adaptive difficulty curve
- FPS-independent game loop

---

## 📂 Project Structure

index.html -> Base HTML structure & HUD
style.css -> UI, overlay, background styling
game.js -> Game logic, bubbles, loop, input handling
README.md -> Project documentation

---

## 🚀 Run the Game

Simply open `index.html` in any modern browser:

- Chrome
- Firefox
- Edge
- Safari

No server required.  
Just double-click → play.

---

## 🧱 Future Ideas (optional)

- Zen Mode (infinite lives)
- Rare “breathing bubble” that restores a life
- Sound design (soft pops / ambient pad)
- Scoreboard or session high score
- Color themes (Ocean, Sunset, Neon)

---

## 📜 License

Personal/learning use.  
If you fork or reuse, credit is appreciated!

---

Enjoy the flow 🫧
