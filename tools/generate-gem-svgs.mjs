/**
 * Генерирует яркие SVG-кристаллы для 8 арен × 6 цветов.
 * Запуск: node tools/generate-gem-svgs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "assets", "gems");

const PALETTE = [
  { base: "#ff6ef0", mid: "#e818c8", edge: "#8a0878", hi: "#fff0ff", glow: "#ff9ef8" },
  { base: "#8dff52", mid: "#48c818", edge: "#267a08", hi: "#f0ffd0", glow: "#b8ff78" },
  { base: "#5cc8ff", mid: "#2080f0", edge: "#0a4098", hi: "#e8f8ff", glow: "#88dcff" },
  { base: "#ff6878", mid: "#e02038", edge: "#880818", hi: "#ffe0e4", glow: "#ff98a4" },
  { base: "#ffe850", mid: "#f0a800", edge: "#986800", hi: "#fffad0", glow: "#fff080" },
  { base: "#58ffe0", mid: "#18b898", edge: "#086850", hi: "#e8fff8", glow: "#98ffe8" },
];

const SHAPES = [
  "M50 6 L92 36 L80 92 L20 92 L8 36 Z",
  "M50 4 L94 30 L84 90 L16 90 L6 30 Z",
  "M10 16 L90 6 L72 80 L14 90 Z",
  "M6 46 L50 4 L94 50 L56 96 L4 52 Z",
  "M18 4 L94 26 L74 94 L6 68 Z",
  "M48 0 L100 44 L54 100 L0 50 Z",
  "M4 22 L72 2 L98 66 L26 96 Z",
  "M50 2 L90 22 L94 76 L50 98 L10 74 L14 22 Z",
];

function gemSvg(world, color) {
  const c = PALETTE[color - 1] || PALETTE[0];
  const pathD = SHAPES[(world - 1) % SHAPES.length];
  const rot = ((world + color) * 11) % 360;
  const uid = "w" + world + "c" + color;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="g${uid}" x1="15%" y1="5%" x2="85%" y2="95%">
      <stop offset="0%" stop-color="${c.hi}"/>
      <stop offset="28%" stop-color="${c.base}"/>
      <stop offset="72%" stop-color="${c.mid}"/>
      <stop offset="100%" stop-color="${c.edge}"/>
    </linearGradient>
    <linearGradient id="f${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff" stop-opacity=".65"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="s${uid}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="2.5" flood-color="#000" flood-opacity=".4"/>
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${c.glow}" flood-opacity=".55"/>
    </filter>
  </defs>
  <g transform="rotate(${rot} 50 50)" filter="url(#s${uid})">
    <path d="${pathD}" fill="url(#g${uid})" stroke="${c.edge}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${pathD}" fill="url(#f${uid})" opacity=".5"/>
    <path d="${pathD}" fill="none" stroke="${c.hi}" stroke-width="1.5" opacity=".35" transform="scale(.55) translate(40.5 40.5)"/>
    <ellipse cx="36" cy="28" rx="16" ry="9" fill="#fff" opacity=".55" transform="rotate(-20 36 28)"/>
    <ellipse cx="62" cy="68" rx="8" ry="5" fill="${c.edge}" opacity=".25"/>
  </g>
</svg>`;
}

for (let w = 1; w <= 8; w++) {
  const dir = path.join(root, "w" + w);
  fs.mkdirSync(dir, { recursive: true });
  for (let c = 1; c <= 6; c++) {
    fs.writeFileSync(path.join(dir, "gem-" + c + ".svg"), gemSvg(w, c), "utf8");
  }
}
console.log("Generated 48 bright arena gem SVGs in assets/gems/w1..w8/");
