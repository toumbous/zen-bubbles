// config.js
// Constants & helper functions for Zen Bubbles

// λίγο πιο forgiving hitbox
export const HITBOX_SCALE = 1.08;

// διάρκεια intro (μητρική φούσκα)
export const INTRO_DURATION = 2.6;

// Zen background palette (ιδέα Έλενας)
export const ZEN_BACKGROUNDS = [
  { top: "rgba(15, 23, 42, 0.4)", bottom: "rgba(15, 23, 42, 0.97)" },  // default
  { top: "rgba(52, 78, 98, 0.4)", bottom: "rgba(12, 24, 38, 0.97)" },  // blue-grey
  { top: "rgba(75, 56, 95, 0.4)", bottom: "rgba(20, 12, 33, 0.97)" },  // purple dusk
  { top: "rgba(40, 66, 60, 0.4)", bottom: "rgba(10, 25, 22, 0.97)" },  // teal forest
  { top: "rgba(98, 60, 60, 0.4)", bottom: "rgba(38, 15, 15, 0.97)" },  // warm rose
];

// τυχαίος αριθμός
export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

// επιλογή τυχαίου χρώματος φούσκας
export function randomBubbleColor() {
  const palette = [
    "rgba(59, 130, 246, 0.9)",  // blue
    "rgba(129, 140, 248, 0.9)", // indigo
    "rgba(56, 189, 248, 0.9)",  // sky
    "rgba(34, 197, 94, 0.9)",   // green
    "rgba(244, 114, 182, 0.9)", // pink
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

// ανάμιξη δύο rgba χρωμάτων
export function blendColor(c1, c2, t) {
  const parse = (c) => c.match(/[\d.]+/g).map(Number);
  let [r1, g1, b1, a1] = parse(c1);
  let [r2, g2, b2, a2] = parse(c2);
  let r = r1 + (r2 - r1) * t;
  let g = g1 + (g2 - g1) * t;
  let b = b1 + (b2 - b1) * t;
  let a = a1 + (a2 - a1) * t;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
