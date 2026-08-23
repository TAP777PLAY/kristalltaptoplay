/**
 * FX — лазер рядов, радужные болты, лёгкие всплески (с бюджетом).
 */
(function (global) {
  const TINT = {
    1: { glow: "#ff7ef5", spark: "#ffe0ff", deep: "#c018a8" },
    2: { glow: "#7dff4a", spark: "#eaffc8", deep: "#2f9a14" },
    3: { glow: "#5cc8ff", spark: "#d6f2ff", deep: "#1c5fd0" },
    4: { glow: "#ff6878", spark: "#ffd0d4", deep: "#c81d32" },
    5: { glow: "#ffe850", spark: "#fff6c8", deep: "#d89a00" },
    6: { glow: "#58ffe0", spark: "#d8fff6", deep: "#0f9a88" },
  };

  const RAINBOW = [
    "#ff5a6a", "#ffe14a", "#7dff4a", "#4db8ff", "#ff5ce8", "#58ffe0",
  ];

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let fxLayer = null;
  let activeFx = 0;
  const MAX_ACTIVE = 56;

  function tint(color) {
    return TINT[color] || TINT[3];
  }

  function fallMs(tiles) {
    const d = Math.max(1, tiles);
    if (reduced()) return Math.round(90 + Math.sqrt(d) * 70);
    return Math.round(120 + Math.sqrt(d) * 110);
  }

  function ensureLayer(boardEl) {
    if (fxLayer && fxLayer.parentElement === boardEl) return fxLayer;
    fxLayer = boardEl.querySelector(".fx-layer");
    if (!fxLayer) {
      fxLayer = document.createElement("div");
      fxLayer.className = "fx-layer";
      boardEl.appendChild(fxLayer);
    }
    return fxLayer;
  }

  function spawn(layer, className) {
    if (activeFx >= MAX_ACTIVE) return null;
    const el = document.createElement("div");
    el.className = className;
    layer.appendChild(el);
    activeFx++;
    return el;
  }

  function kill(el, ms) {
    if (!el) return;
    setTimeout(() => {
      el.remove();
      activeFx = Math.max(0, activeFx - 1);
    }, ms);
  }

  function pop(layer, { x, y, color, tile, delay }) {
    const run = () => {
      const host = ensureLayer(layer);
      const t = tint(color);
      const el = spawn(host, "fx-pop");
      if (!el) return;
      const s = tile * 0.92;
      el.style.left = x * tile + (tile - s) / 2 + "px";
      el.style.top = y * tile + (tile - s) / 2 + "px";
      el.style.width = s + "px";
      el.style.height = s + "px";
      el.style.background =
        "radial-gradient(circle, #fff 0%, " + t.glow + " 38%, transparent 72%)";
      kill(el, 360);
    };
    if (delay) setTimeout(run, delay);
    else run();
  }

  function shatter(layer, { x, y, color, tile, delay, power, lite }) {
    if (lite || reduced() || activeFx > MAX_ACTIVE * 0.75) {
      pop(layer, { x, y, color, tile, delay });
      return;
    }
    const host = ensureLayer(layer);
    const t = tint(color);
    const px = x * tile;
    const py = y * tile;
    const cx = px + tile / 2;
    const cy = py + tile / 2;
    const shards = Math.min(4, 2 + Math.min(2, power || 1));
    const dur = 480;

    setTimeout(() => {
      const flash = spawn(host, "fx-flash");
      if (flash) {
        flash.style.left = px + "px";
        flash.style.top = py + "px";
        flash.style.width = tile + "px";
        flash.style.height = tile + "px";
        flash.style.background =
          "radial-gradient(circle, #fff 0%, " + t.glow + " 42%, transparent 70%)";
        kill(flash, 200);
      }
      for (let i = 0; i < shards; i++) {
        const shard = spawn(host, "fx-shard");
        if (!shard) break;
        const size = tile * (0.2 + Math.random() * 0.2);
        shard.style.width = size + "px";
        shard.style.height = size + "px";
        shard.style.left = cx - size / 2 + "px";
        shard.style.top = cy - size / 2 + "px";
        shard.style.background = t.glow;
        shard.style.borderRadius = "40%";
        shard.style.boxShadow = "0 0 6px " + t.spark;
        const ang = ((Math.PI * 2) / shards) * i;
        const dist = tile * (0.4 + Math.random() * 0.5);
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist + tile * 0.25;
        shard.animate(
          [
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            { transform: "translate(" + dx + "px," + dy + "px) scale(.12)", opacity: 0 },
          ],
          { duration: dur, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }
        );
        kill(shard, dur + 30);
      }
    }, delay || 0);
  }

  /** Горизонтальный / вертикальный лазер ракеты. */
  function lineSweep(layer, { axis, x, y, cols, rows, tile, color }) {
    const host = ensureLayer(layer);
    const t = tint(color || 5);
    const dur = reduced() ? 380 : 720;

    if (axis === "h") {
      const beam = spawn(host, "fx-laser fx-laser-h");
      if (!beam) return 200;
      const h = Math.max(10, tile * 0.42);
      beam.style.left = "0px";
      beam.style.top = y * tile + (tile - h) / 2 + "px";
      beam.style.width = cols * tile + "px";
      beam.style.height = h + "px";
      beam.style.transformOrigin = ((x + 0.5) / cols) * 100 + "% 50%";
      beam.style.background =
        "linear-gradient(90deg, transparent 0%, " + t.spark + " 12%, #fff 50%, " + t.glow + " 88%, transparent 100%)";
      beam.style.boxShadow = "0 0 18px " + t.glow + ", 0 0 36px " + t.spark;
      beam.animate(
        [
          { transform: "scaleX(0)", opacity: 0.2 },
          { transform: "scaleX(1)", opacity: 1, offset: 0.35 },
          { transform: "scaleX(1)", opacity: 0.85, offset: 0.7 },
          { transform: "scaleX(1.02)", opacity: 0 },
        ],
        { duration: dur, easing: "cubic-bezier(.15,.85,.2,1)", fill: "forwards" }
      );
      kill(beam, dur + 40);

      // вторичная тонкая черта
      const core = spawn(host, "fx-laser fx-laser-h core");
      if (core) {
        const ch = Math.max(3, tile * 0.12);
        core.style.left = "0px";
        core.style.top = y * tile + (tile - ch) / 2 + "px";
        core.style.width = cols * tile + "px";
        core.style.height = ch + "px";
        core.style.transformOrigin = ((x + 0.5) / cols) * 100 + "% 50%";
        core.style.background = "#fff";
        core.animate(
          [
            { transform: "scaleX(0)", opacity: 1 },
            { transform: "scaleX(1)", opacity: 1, offset: 0.4 },
            { transform: "scaleX(1)", opacity: 0 },
          ],
          { duration: dur - 40, easing: "cubic-bezier(.1,.9,.2,1)", fill: "forwards" }
        );
        kill(core, dur);
      }
    } else {
      const beam = spawn(host, "fx-laser fx-laser-v");
      if (!beam) return 200;
      const w = Math.max(10, tile * 0.42);
      beam.style.left = x * tile + (tile - w) / 2 + "px";
      beam.style.top = "0px";
      beam.style.width = w + "px";
      beam.style.height = rows * tile + "px";
      beam.style.transformOrigin = "50% " + ((y + 0.5) / rows) * 100 + "%";
      beam.style.background =
        "linear-gradient(180deg, transparent 0%, " + t.spark + " 12%, #fff 50%, " + t.glow + " 88%, transparent 100%)";
      beam.style.boxShadow = "0 0 18px " + t.glow + ", 0 0 36px " + t.spark;
      beam.animate(
        [
          { transform: "scaleY(0)", opacity: 0.2 },
          { transform: "scaleY(1)", opacity: 1, offset: 0.35 },
          { transform: "scaleY(1)", opacity: 0.85, offset: 0.7 },
          { transform: "scaleY(1.02)", opacity: 0 },
        ],
        { duration: dur, easing: "cubic-bezier(.15,.85,.2,1)", fill: "forwards" }
      );
      kill(beam, dur + 40);

      const core = spawn(host, "fx-laser fx-laser-v core");
      if (core) {
        const cw = Math.max(3, tile * 0.12);
        core.style.left = x * tile + (tile - cw) / 2 + "px";
        core.style.top = "0px";
        core.style.width = cw + "px";
        core.style.height = rows * tile + "px";
        core.style.transformOrigin = "50% " + ((y + 0.5) / rows) * 100 + "%";
        core.style.background = "#fff";
        core.animate(
          [
            { transform: "scaleY(0)", opacity: 1 },
            { transform: "scaleY(1)", opacity: 1, offset: 0.4 },
            { transform: "scaleY(1)", opacity: 0 },
          ],
          { duration: dur - 40, easing: "cubic-bezier(.1,.9,.2,1)", fill: "forwards" }
        );
        kill(core, dur);
      }
    }
    return dur;
  }

  /** Радуга: лучи из центра к каждой цели. */
  function rainbowBolts(layer, { fromX, fromY, targets, tile }) {
    const host = ensureLayer(layer);
    const ox = fromX * tile + tile / 2;
    const oy = fromY * tile + tile / 2;
    const pulse = spawn(host, "fx-rainbow-pulse");
    if (pulse) {
      const s = tile * 1.85;
      pulse.style.left = ox - s / 2 + "px";
      pulse.style.top = oy - s / 2 + "px";
      pulse.style.width = s + "px";
      pulse.style.height = s + "px";
      kill(pulse, 720);
    }

    const list = targets.slice(0, reduced() ? 8 : 14);
    let maxWait = 520;
    list.forEach((tg, i) => {
      const tx = tg.x * tile + tile / 2;
      const ty = tg.y * tile + tile / 2;
      const dx = tx - ox;
      const dy = ty - oy;
      const dist = Math.max(8, Math.hypot(dx, dy));
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      const delay = Math.min(380, i * 42);
      const color = RAINBOW[i % RAINBOW.length];
      const hitColor = tg.color || ((i % 6) + 1);

      setTimeout(() => {
        const beam = spawn(host, "fx-bolt");
        if (!beam) {
          pop(layer, { x: tg.x, y: tg.y, color: hitColor, tile });
          return;
        }
        const thick = Math.max(4, tile * 0.18);
        beam.style.left = ox + "px";
        beam.style.top = oy - thick / 2 + "px";
        beam.style.width = "0px";
        beam.style.height = thick + "px";
        beam.style.transformOrigin = "0 50%";
        beam.style.transform = "rotate(" + ang + "deg)";
        beam.style.background =
          "linear-gradient(90deg, #fff 0%, " + color + " 40%, " + color + " 100%)";
        beam.style.boxShadow = "0 0 10px " + color + ", 0 0 18px #fff";
        const flight = reduced() ? 320 : 560;
        beam.animate(
          [
            { width: "0px", opacity: 1 },
            { width: dist + "px", opacity: 1, offset: 0.5 },
            { width: dist + "px", opacity: 0.85, offset: 0.78 },
            { width: dist + "px", opacity: 0 },
          ],
          { duration: flight, easing: "cubic-bezier(.12,.75,.18,1)", fill: "forwards" }
        );
        kill(beam, flight + 40);
        setTimeout(() => pop(layer, { x: tg.x, y: tg.y, color: hitColor, tile }), flight * 0.48);
      }, delay);
      maxWait = Math.max(maxWait, delay + (reduced() ? 400 : 640));
    });
    return maxWait;
  }

  /** Волна вдоль обычного матча (ряд/столбец) — быстрая. */
  function matchRipple(layer, cells, tile, wave) {
    if (!cells.length) return 140;
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    const sameY = ys.every((y) => y === ys[0]);
    const sameX = xs.every((x) => x === xs[0]);
    const mid = {
      x: cells.reduce((s, c) => s + c.x, 0) / cells.length,
      y: cells.reduce((s, c) => s + c.y, 0) / cells.length,
    };
    const color = cells[0].color || 3;

    if (sameY && cells.length >= 3) {
      const host = ensureLayer(layer);
      const beam = spawn(host, "fx-laser fx-laser-h");
      if (beam) {
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const h = Math.max(8, tile * 0.34);
        beam.style.left = minX * tile + "px";
        beam.style.top = ys[0] * tile + (tile - h) / 2 + "px";
        beam.style.width = (maxX - minX + 1) * tile + "px";
        beam.style.height = h + "px";
        beam.style.transformOrigin = "50% 50%";
        const t = tint(color);
        beam.style.background =
          "linear-gradient(90deg, transparent, " + t.glow + ", #fff, " + t.glow + ", transparent)";
        beam.style.boxShadow = "0 0 12px " + t.glow;
        beam.animate(
          [
            { transform: "scaleX(.25)", opacity: 0.45 },
            { transform: "scaleX(1)", opacity: 1, offset: 0.4 },
            { transform: "scaleX(1)", opacity: 0 },
          ],
          { duration: 280, fill: "forwards" }
        );
        kill(beam, 300);
      }
    } else if (sameX && cells.length >= 3) {
      const host = ensureLayer(layer);
      const beam = spawn(host, "fx-laser fx-laser-v");
      if (beam) {
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const w = Math.max(8, tile * 0.34);
        beam.style.left = xs[0] * tile + (tile - w) / 2 + "px";
        beam.style.top = minY * tile + "px";
        beam.style.width = w + "px";
        beam.style.height = (maxY - minY + 1) * tile + "px";
        const t = tint(color);
        beam.style.background =
          "linear-gradient(180deg, transparent, " + t.glow + ", #fff, " + t.glow + ", transparent)";
        beam.style.boxShadow = "0 0 12px " + t.glow;
        beam.animate(
          [
            { transform: "scaleY(.25)", opacity: 0.45 },
            { transform: "scaleY(1)", opacity: 1, offset: 0.4 },
            { transform: "scaleY(1)", opacity: 0 },
          ],
          { duration: 280, fill: "forwards" }
        );
        kill(beam, 300);
      }
    }

    let maxDelay = 0;
    const heavyCap = cells.length > 10 ? 2 : 3;
    cells.forEach((c, i) => {
      const d = Math.hypot(c.x - mid.x, c.y - mid.y);
      const delay = Math.min(90, Math.round(d * 14));
      maxDelay = Math.max(maxDelay, delay);
      shatter(layer, {
        x: c.x,
        y: c.y,
        color: c.color || 1,
        tile,
        delay,
        power: Math.min(2, wave || 1),
        lite: i >= heavyCap,
      });
    });
    return maxDelay + (reduced() ? 120 : 220);
  }

  /**
   * Главный вход: kind = match | line-h | line-v | rainbow | bomb
   */
  function playClear(layer, cells, tile, opts) {
    opts = opts || {};
    const kind = opts.kind || "match";
    const from = opts.from || { x: 0, y: 0 };
    const cols = opts.cols || 8;
    const rows = opts.rows || 8;

    if (kind === "rainbow") {
      const waitBolts = rainbowBolts(layer, {
        fromX: from.x,
        fromY: from.y,
        targets: cells,
        tile,
      });
      return waitBolts;
    }

    if (kind === "line-h") {
      const color = (cells[0] && cells[0].color) || 5;
      const laser = lineSweep(layer, {
        axis: "h",
        x: from.x,
        y: from.y,
        cols,
        rows,
        tile,
        color,
      });
      cells.forEach((c) => {
        const delay = Math.min(320, Math.abs(c.x - from.x) * 42);
        pop(layer, { x: c.x, y: c.y, color: c.color || color, tile, delay: delay + 80 });
      });
      return laser + 120;
    }

    if (kind === "line-v") {
      const color = (cells[0] && cells[0].color) || 5;
      const laser = lineSweep(layer, {
        axis: "v",
        x: from.x,
        y: from.y,
        cols,
        rows,
        tile,
        color,
      });
      cells.forEach((c) => {
        const delay = Math.min(320, Math.abs(c.y - from.y) * 42);
        pop(layer, { x: c.x, y: c.y, color: c.color || color, tile, delay: delay + 80 });
      });
      return laser + 120;
    }

    if (kind === "bomb") {
      const mid = from;
      const host = ensureLayer(layer);
      const cx = mid.x * tile + tile / 2;
      const cy = mid.y * tile + tile / 2;

      const flash = spawn(host, "fx-flash");
      if (flash) {
        const s = tile * 2.2;
        flash.style.left = cx - s / 2 + "px";
        flash.style.top = cy - s / 2 + "px";
        flash.style.width = s + "px";
        flash.style.height = s + "px";
        flash.style.background =
          "radial-gradient(circle, #fff 0%, #ffe14a 35%, #ff7a3a 55%, transparent 72%)";
        kill(flash, 320);
      }

      [1.6, 2.6, 3.6].forEach((mul, i) => {
        const ring = spawn(host, "fx-ring");
        if (!ring) return;
        const s = tile * mul;
        ring.style.left = cx - s / 2 + "px";
        ring.style.top = cy - s / 2 + "px";
        ring.style.width = s + "px";
        ring.style.height = s + "px";
        ring.style.borderColor = i === 0 ? "#fff6a8" : i === 1 ? "#ffe14a" : "#ff9a4a";
        ring.style.borderWidth = (3 - i) + "px";
        ring.style.animationDelay = i * 45 + "ms";
        kill(ring, 560 + i * 80);
      });

      let maxDelay = 0;
      cells.forEach((c) => {
        const d = Math.hypot(c.x - mid.x, c.y - mid.y);
        const delay = Math.min(320, Math.round(d * 52));
        maxDelay = Math.max(maxDelay, delay);
        shatter(layer, {
          x: c.x,
          y: c.y,
          color: c.color || 1,
          tile,
          delay,
          power: 3,
          lite: false,
        });
        pop(layer, {
          x: c.x,
          y: c.y,
          color: c.color || 5,
          tile,
          delay: delay + 40,
        });
      });
      return maxDelay + (reduced() ? 300 : 520);
    }

    return matchRipple(layer, cells, tile, opts.wave || 1);
  }

  function burstBatch(layer, cells, tile, wave) {
    return playClear(layer, cells, tile, { kind: "match", wave });
  }

  function land(el) {
    if (!el || reduced()) return;
    el.classList.remove("landing");
    void el.offsetWidth;
    el.classList.add("landing");
    el.addEventListener("animationend", () => el.classList.remove("landing"), { once: true });
  }

  function prepareFall(el) {
    el.classList.remove("landing", "selected", "charge", "shatter");
    el.style.transition = "none";
    el.style.willChange = "top, transform";
  }

  function playFall(el, toTop, ms, delay) {
    const start = () => {
      el.style.transition = "top " + ms + "ms cubic-bezier(.33,.05,.18,1.02)";
      el.style.top = toTop + "px";
    };
    if (delay) setTimeout(start, delay);
    else start();
  }

  /** Разлёт щепок при разбитии ящика */
  function crateBreak(layer, { x, y, tile }) {
    const host = ensureLayer(layer);
    const cx = x * tile + tile / 2;
    const cy = y * tile + tile / 2;
    const flash = spawn(host, "fx-flash");
    if (flash) {
      const s = tile * 1.1;
      flash.style.left = cx - s / 2 + "px";
      flash.style.top = cy - s / 2 + "px";
      flash.style.width = s + "px";
      flash.style.height = s + "px";
      flash.style.background =
        "radial-gradient(circle, #fff4d0 0%, #c88840 45%, transparent 70%)";
      kill(flash, 220);
    }
    const n = reduced() ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const chip = spawn(host, "fx-shard fx-crate-chip");
      if (!chip) break;
      const size = tile * (0.16 + Math.random() * 0.22);
      chip.style.width = size + "px";
      chip.style.height = size * (0.7 + Math.random() * 0.5) + "px";
      chip.style.left = cx - size / 2 + "px";
      chip.style.top = cy - size / 2 + "px";
      chip.style.background = i % 2 ? "#a86a2e" : "#d4a05a";
      chip.style.borderRadius = "2px";
      chip.style.boxShadow = "0 1px 2px rgba(0,0,0,.35)";
      const ang = ((Math.PI * 2) / n) * i + Math.random() * 0.4;
      const dist = tile * (0.55 + Math.random() * 0.55);
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist + tile * 0.35;
      chip.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: "translate(" + dx + "px," + dy + "px) rotate(" + (120 + Math.random() * 200) + "deg)", opacity: 0 },
        ],
        { duration: reduced() ? 280 : 420, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }
      );
      kill(chip, 450);
    }
    const ring = spawn(host, "fx-ring");
    if (ring) {
      const s = tile * 1.4;
      ring.style.left = cx - s / 2 + "px";
      ring.style.top = cy - s / 2 + "px";
      ring.style.width = s + "px";
      ring.style.height = s + "px";
      ring.style.borderColor = "#e8b86a";
      kill(ring, 360);
    }
  }

  function iceBreak(layer, { x, y, tile }) {
    const host = ensureLayer(layer);
    const cx = x * tile + tile / 2;
    const cy = y * tile + tile / 2;
    const n = reduced() ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const shard = spawn(host, "fx-shard");
      if (!shard) break;
      const size = tile * (0.14 + Math.random() * 0.18);
      shard.style.width = size + "px";
      shard.style.height = size + "px";
      shard.style.left = cx - size / 2 + "px";
      shard.style.top = cy - size / 2 + "px";
      shard.style.background = "rgba(210,245,255,.95)";
      shard.style.borderRadius = "30%";
      shard.style.boxShadow = "0 0 6px rgba(160,220,255,.8)";
      const ang = ((Math.PI * 2) / n) * i;
      const dist = tile * (0.4 + Math.random() * 0.4);
      shard.animate(
        [
          { transform: "translate(0,0)", opacity: 1 },
          { transform: "translate(" + Math.cos(ang) * dist + "px," + (Math.sin(ang) * dist + tile * 0.2) + "px)", opacity: 0 },
        ],
        { duration: 360, easing: "ease-out", fill: "forwards" }
      );
      kill(shard, 380);
    }
  }

  global.GemFX = {
    tint,
    fallMs,
    shatter,
    pop,
    burstBatch,
    playClear,
    lineSweep,
    rainbowBolts,
    crateBreak,
    iceBreak,
    land,
    prepareFall,
    playFall,
    reduced,
  };
})(window);
