import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  makeMask,
  SEED,
  SHAPES,
} from "./generate-pack.js";

const ONBOARD_SHAPES = [
  "full", "diamond", "plus", "corners", "ring", "pyramid",
  "hourglass", "stairs", "bridge", "diamond",
  "plus", "corners", "ring", "hourglass", "pyramid", "stairs", "bridge", "corners", "hourglass", "ring",
  "plus", "diamond", "ring", "pyramid", "stairs",
];

function boardSize(id) {
  if (id <= 9) return { cols: 7, rows: 7 };
  if (id <= 35) return { cols: 8, rows: 8 };
  if (id <= 80) return { cols: 8, rows: 9 };
  return { cols: 9, rows: 9 };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function minPlayableSegment(mask, cols, rows) {
  let min = Infinity;
  for (let y = 0; y < rows; y++) {
    let run = 0;
    for (let x = 0; x <= cols; x++) {
      const play = x < cols && mask[y][x] === 0;
      if (play) run++;
      else {
        if (run > 0 && run < min) min = run;
        run = 0;
      }
    }
  }
  for (let x = 0; x < cols; x++) {
    let run = 0;
    for (let y = 0; y <= rows; y++) {
      const play = y < rows && mask[y][x] === 0;
      if (play) run++;
      else {
        if (run > 0 && run < min) min = run;
        run = 0;
      }
    }
  }
  return min === Infinity ? 0 : min;
}

function maskIsValid(mask, cols, rows) {
  let playable = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) if (mask[y][x] === 0) playable++;
  }
  if (!playable) return false;
  return minPlayableSegment(mask, cols, rows) !== 2;
}

// Raw shape validity (before resolveMask fallback)
console.log("=== Raw shape validity by board size ===");
for (const cols of [7, 8, 9]) {
  for (const rows of [7, 8, 9]) {
    const line = SHAPES.map((s) => {
      const m = makeMask(cols, rows, s);
      const min = minPlayableSegment(m, cols, rows);
      const ok = maskIsValid(m, cols, rows);
      return `${s}:${ok ? "ok" : "BAD(" + min + ")"}`;
    });
    console.log(`${cols}x${rows} → ${line.join(" | ")}`);
  }
}

const pack = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "levels", "pack.json"), "utf8"));

const badInPack = [];
const byShape = {};
for (const lv of pack.levels) {
  byShape[lv.shape] = (byShape[lv.shape] || 0) + 1;
  const min = minPlayableSegment(lv.mask, lv.cols, lv.rows);
  if (min === 2) badInPack.push(lv.id);
}

console.log("\n=== Pack: levels with 2-wide segments ===");
console.log("count:", badInPack.length, badInPack.length ? badInPack : "none");

console.log("\n=== Pack shape distribution ===");
Object.entries(byShape)
  .sort((a, b) => b[1] - a[1])
  .forEach(([s, n]) => console.log(`${s}: ${n}`));

// Compare wanted vs actual
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Re-import pickShape - it's not exported. Use ONBOARD for 1-25 and note fallbacks.
const fallback = [];
for (const lv of pack.levels) {
  let wanted = lv.id <= 25 ? ONBOARD_SHAPES[lv.id - 1] : null;
  if (wanted && lv.shape !== wanted) {
    const { cols, rows } = boardSize(lv.id);
    const wantedOk = maskIsValid(makeMask(cols, rows, wanted), cols, rows);
    fallback.push({ id: lv.id, wanted, actual: lv.shape, wantedOk });
  }
}

console.log("\n=== Levels 1-25: wanted shape vs actual (fallbacks) ===");
fallback.forEach((f) =>
  console.log(`#${f.id} wanted ${f.wanted} (${f.wantedOk ? "valid" : "INVALID"}) → ${f.actual}`)
);

const plusLevels = pack.levels.filter((l) => {
  const wanted = l.id <= 25 ? ONBOARD_SHAPES[l.id - 1] : null;
  return l.shape === "plus" || wanted === "plus";
});
console.log("\n=== All plus-related levels in pack ===");
plusLevels.forEach((l) => {
  const min = minPlayableSegment(l.mask, l.cols, l.rows);
  console.log(`#${l.id} shape=${l.shape} ${l.cols}x${l.rows} minSeg=${min}`);
});
