/**
 * Браузерный генератор пака v4 — зеркало tools/generate-pack.js
 */
(function () {
  const LEVEL_COUNT = 200;
  const SEED = 20260825;

  const ONBOARD_SHAPES = [
    "full", "diamond", "plus", "corners", "ring", "pyramid",
    "hourglass", "stairs", "bridge", "diamond",
    "plus", "corners", "ring", "hourglass", "pyramid", "stairs", "bridge", "corners", "hourglass", "ring",
    "plus", "diamond", "ring", "pyramid", "stairs",
  ];

  const WORLDS = [
    { id: 1, name: "Травяная долина", from: 1, to: 10, colors: 4, vibe: "learn" },
    { id: 2, name: "Янтарные копи", from: 11, to: 20, colors: 4, vibe: "crates" },
    { id: 3, name: "Ледяные пики", from: 21, to: 30, colors: 5, vibe: "ice" },
    { id: 4, name: "Аметистовый каньон", from: 31, to: 40, colors: 5, vibe: "shapes" },
    { id: 5, name: "Ночная роща", from: 41, to: 50, colors: 5, vibe: "mix" },
    { id: 6, name: "Огненный кратер", from: 51, to: 60, colors: 6, vibe: "pressure" },
    { id: 7, name: "Неоновые недра", from: 61, to: 70, colors: 6, vibe: "neon" },
    { id: 8, name: "Кристальный шторм", from: 71, to: 80, colors: 6, vibe: "storm" },
    { id: 9, name: "Бездна сияния", from: 81, to: 90, colors: 6, vibe: "abyss" },
    { id: 10, name: "Вершина долины", from: 91, to: 100, colors: 6, vibe: "summit" },
    { id: 11, name: "Туманные гроты", from: 101, to: 110, colors: 6, vibe: "fog" },
    { id: 12, name: "Рубиновая кузня", from: 111, to: 120, colors: 6, vibe: "forge" },
    { id: 13, name: "Сапфировое озеро", from: 121, to: 130, colors: 6, vibe: "lake" },
    { id: 14, name: "Изумрудный лабиринт", from: 131, to: 140, colors: 6, vibe: "maze" },
    { id: 15, name: "Обсидиановые врата", from: 141, to: 150, colors: 6, vibe: "gates" },
    { id: 16, name: "Призрачная топь", from: 151, to: 160, colors: 6, vibe: "swamp" },
    { id: 17, name: "Грозовой хребет", from: 161, to: 170, colors: 6, vibe: "ridge" },
    { id: 18, name: "Звёздная пустошь", from: 171, to: 180, colors: 6, vibe: "void" },
    { id: 19, name: "Сердце кристалла", from: 181, to: 190, colors: 6, vibe: "heart" },
    { id: 20, name: "Корона долины", from: 191, to: 200, colors: 6, vibe: "crown" },
  ];

  const SHAPES = [
    "full", "diamond", "plus", "ring", "corners", "pyramid", "hourglass", "stairs", "bridge",
  ];

  const VIBE_SHAPES = {
    learn: ["full", "full", "diamond"],
    crates: ["full", "diamond", "plus"],
    ice: ["diamond", "plus", "ring"],
    shapes: ["ring", "corners", "pyramid", "hourglass"],
    mix: ["plus", "stairs", "bridge", "diamond"],
    pressure: ["full", "corners", "stairs"],
    neon: ["plus", "ring", "hourglass"],
    storm: ["stairs", "bridge", "ring", "hourglass"],
    abyss: ["ring", "pyramid", "corners"],
    summit: ["diamond", "plus", "bridge"],
    fog: ["ring", "corners", "full"],
    forge: ["plus", "stairs", "full"],
    lake: ["diamond", "ring", "hourglass"],
    maze: ["stairs", "bridge", "corners", "pyramid"],
    gates: ["bridge", "plus", "corners"],
    swamp: ["hourglass", "ring", "stairs"],
    ridge: ["stairs", "pyramid", "bridge"],
    void: ["ring", "corners", "hourglass"],
    heart: ["diamond", "plus", "pyramid"],
    crown: ["bridge", "stairs", "ring", "diamond"],
  };

  const BLOCKER = { NONE: 0, CRATE: 1, ICE: 2 };

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function worldOf(id) {
    return WORLDS.find((w) => id >= w.from && id <= w.to) || WORLDS[0];
  }

  function progress(id) {
    return (id - 1) / (LEVEL_COUNT - 1);
  }

  function inWorldPos(id) {
    return ((id - 1) % 10) + 1;
  }

  function isBoss(id) {
    return id % 10 === 0;
  }

  function isRelief(id) {
    const p = inWorldPos(id);
    if (id <= 25) return p === 1;
    return p === 1 || p === 4;
  }

  function isPeak(id) {
    const p = inWorldPos(id);
    return p === 7 || p === 10;
  }

  function boardSize(id) {
    if (id <= 9) return { cols: 7, rows: 7 };
    if (id <= 35) return { cols: 8, rows: 8 };
    if (id <= 80) return { cols: 8, rows: 9 };
    return { cols: 9, rows: 9 };
  }

  function makeMask(cols, rows, shape) {
    const mask = [];
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const maxD = Math.max(cx, cy);
    for (let y = 0; y < rows; y++) {
      mask[y] = [];
      for (let x = 0; x < cols; x++) {
        let play = true;
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        if (shape === "diamond") play = dx + dy <= Math.ceil(maxD);
        else if (shape === "plus") play = dx <= 1 || dy <= 1 || (dx <= 2 && dy <= 2 && cols >= 8);
        else if (shape === "ring") play = !(dx <= Math.max(1, Math.floor(cx / 3)) && dy <= Math.max(1, Math.floor(cy / 3)));
        else if (shape === "corners") play = !((x === 0 || x === cols - 1) && (y === 0 || y === rows - 1));
        else if (shape === "pyramid") play = y >= Math.floor(Math.abs(x - cx));
        else if (shape === "hourglass") play = dx + 0.4 >= dy || dy + 0.4 >= dx;
        else if (shape === "stairs") play = x + y >= Math.floor((cols + rows) / 4) && x + y <= cols + rows - 3;
        else if (shape === "bridge") play = y === Math.floor(cy) || x <= 1 || x >= cols - 2 || y <= 1 || y >= rows - 2;
        mask[y][x] = play ? 0 : 1;
      }
    }
    let playable = 0;
    mask.forEach((row) => row.forEach((c) => { if (c === 0) playable++; }));
    if (playable < cols * rows * 0.45) return makeMask(cols, rows, "full");
    return mask;
  }

  function placePattern(playable, count, pattern, rnd, cols, rows) {
    const pool = playable.slice();
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    if (pattern === "edge") {
      pool.sort((a, b) => {
        const ea = Math.min(a.x, cols - 1 - a.x, a.y, rows - 1 - a.y);
        const eb = Math.min(b.x, cols - 1 - b.x, b.y, rows - 1 - b.y);
        return ea - eb + (rnd() - 0.5) * 0.2;
      });
    } else if (pattern === "center") {
      pool.sort((a, b) => {
        const da = Math.abs(a.x - cx) + Math.abs(a.y - cy);
        const db = Math.abs(b.x - cx) + Math.abs(b.y - cy);
        return da - db + (rnd() - 0.5) * 0.2;
      });
    } else if (pattern === "diagonal") {
      pool.sort((a, b) => Math.abs(a.x - a.y) - Math.abs(b.x - b.y) + (rnd() - 0.5) * 0.3);
    } else {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
    return pool.slice(0, Math.max(0, count));
  }

  function pickPattern(id, rnd) {
    const patterns = ["scatter", "edge", "center", "diagonal"];
    if (id <= 4) return "scatter";
    return patterns[Math.floor(rnd() * patterns.length)];
  }

  function makeObstacles(cols, rows, mask, id, rnd) {
    const obs = [];
    for (let y = 0; y < rows; y++) {
      obs[y] = [];
      for (let x = 0; x < cols; x++) obs[y][x] = BLOCKER.NONE;
    }
    const playable = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (mask[y][x] === 0) playable.push({ x, y });
      }
    }

    const t = progress(id);
    const world = worldOf(id);
    const worldIdx = world.id;
    const p = inWorldPos(id);
    const boss = isBoss(id);
    const relief = isRelief(id);
    const peak = isPeak(id);

    let crates = 0;
    let ice = 0;

    if (worldIdx === 1) {
      if (id <= 2) return obs;
      crates = id <= 4 ? 1 : id <= 6 ? 2 : id <= 8 ? 3 : id <= 9 ? 4 : 5;
      if (boss) crates += 1;
      if (id >= 7) ice = id >= 10 ? 2 : 1;
    } else if (worldIdx === 2) {
      crates = 3 + Math.floor(p * 0.75) + (boss ? 2 : 0);
    } else if (worldIdx === 3) {
      crates = 2 + Math.floor(p * 0.35);
      ice = 2 + Math.floor(p * 0.45) + (boss ? 2 : 0);
    } else {
      const act = worldIdx <= 10 ? 0 : 1;
      crates = Math.round(2.0 + t * 4.8 + act * 0.8 + (boss ? 2 : 0) + (peak && !boss ? 1 : 0) + rnd() * 1.2);
      ice = Math.round(1.8 + t * 5.2 + act * 1.0 + (boss ? 2 : 0) + (peak && !boss ? 1 : 0) + rnd() * 1.2);
      if (relief) {
        crates = Math.max(1, Math.round(crates * 0.72));
        ice = Math.max(1, Math.round(ice * 0.72));
      }
      if (world.vibe === "forge" || world.vibe === "gates") crates = Math.round(crates * 1.12);
      if (world.vibe === "lake" || world.vibe === "ice" || world.vibe === "void") ice = Math.round(ice * 1.1);
      if (world.vibe === "swamp") {
        crates = Math.round(crates * 0.9);
        ice = Math.round(ice * 1.08);
      }
      if (worldIdx >= 18) {
        crates = Math.min(crates, 11 + (boss ? 2 : 0));
        ice = Math.min(ice, 12 + (boss ? 2 : 0));
      }
    }

    crates = Math.min(crates, Math.max(0, playable.length - 16));
    ice = Math.min(ice, Math.max(0, playable.length - crates - 14));

    const pattern = pickPattern(id, rnd);
    const crateSpots = placePattern(playable, crates, pattern, rnd, cols, rows);
    const used = new Set(crateSpots.map((c) => c.x + "," + c.y));
    crateSpots.forEach((c) => { obs[c.y][c.x] = BLOCKER.CRATE; });

    const rest = playable.filter((c) => !used.has(c.x + "," + c.y));
    const icePattern = pattern === "scatter" ? pickPattern(id + 3, rnd) : pattern;
    const iceSpots = placePattern(rest, ice, icePattern, rnd, cols, rows);
    iceSpots.forEach((c) => { obs[c.y][c.x] = BLOCKER.ICE; });

    return obs;
  }

  function countObstacles(obs, type) {
    let n = 0;
    obs.forEach((row) => row.forEach((v) => { if (v === type) n++; }));
    return n;
  }

  function buildGoals(id, colors, t, rnd, obs, moves) {
    const goals = [];
    const crates = countObstacles(obs, BLOCKER.CRATE);
    const ice = countObstacles(obs, BLOCKER.ICE);

    if (crates > 0) goals.push({ kind: "break", target: "crate", count: crates });
    if (ice > 0) goals.push({ kind: "break", target: "ice", count: ice });

    const breakHeavy = isBoss(id) && id >= 80 && rnd() < 0.22 && (crates + ice) >= 10;

    let collectCount =
      id <= 2 ? 1 :
      id <= 25 ? 2 :
      id <= 55 ? 2 :
      id <= 120 ? (rnd() < 0.35 ? 3 : 2) :
      3;

    if (breakHeavy) collectCount = 1;
    if (isRelief(id) && collectCount > 2) collectCount = 2;

    const used = new Set();
    const boss = isBoss(id);
    const peak = isPeak(id);
    const relief = isRelief(id);
    const breakLoad = crates + ice;

    let rate = 2.4 + t * 2.85;
    if (boss) rate += 0.45;
    else if (peak) rate += 0.22;
    if (relief) rate -= id <= 25 ? 0.25 : 0.4;
    if (id <= 2) rate = Math.min(rate, 2.55);
    else if (id <= 25) rate = Math.max(rate, 2.95);
    if (id >= 181) rate += 0.15;

    const collectBudget = Math.max(
      10,
      Math.round(moves * rate - breakLoad * 0.55 + (boss ? 4 : 0))
    );
    const perGoal = Math.max(7, Math.floor(collectBudget / collectCount));

    while (goals.filter((g) => g.kind === "collect").length < collectCount) {
      let gem = 1 + Math.floor(rnd() * colors);
      let guard = 0;
      while (used.has(gem) && guard++ < 24) gem = 1 + Math.floor(rnd() * colors);
      used.add(gem);
      const jitter = Math.round((rnd() - 0.5) * 5);
      const count = Math.max(7, perGoal + jitter + (boss ? 2 : 0));
      goals.push({ kind: "collect", gem, count });
    }
    return goals;
  }

  function pickShape(id, rnd, world) {
    if (id <= 25) return ONBOARD_SHAPES[id - 1];
    const pool = VIBE_SHAPES[world.vibe] || SHAPES;
    if (isBoss(id)) {
      const fancy = pool.filter((s) => s !== "full");
      return (fancy.length ? fancy : pool)[Math.floor(rnd() * (fancy.length || pool.length))];
    }
    if (rnd() < 0.7) return pool[Math.floor(rnd() * pool.length)];
    return SHAPES[Math.floor(rnd() * SHAPES.length)];
  }

  function movesFor(id, t) {
    let moves = Math.round(26 - t * 9.2);
    if (id === 1) moves += 2;
    else if (id <= 3) moves += 1;
    if (isRelief(id)) moves += id <= 25 ? 1 : 2;
    if (isPeak(id) && !isBoss(id)) moves -= 1;
    if (isBoss(id)) moves -= 2;
    if (id >= 150) moves -= 1;
    return Math.max(14, Math.min(30, moves));
  }

  function buildLevel(id, seed, override) {
    const rnd = mulberry32(seed + id * 997);
    const world = worldOf(id);
    const t = progress(id);
    const o = override || {};
    const auto = boardSize(id);
    const cols = o.cols || auto.cols;
    const rows = o.rows || auto.rows;
    const colors = o.colors || world.colors;
    const moves = o.moves || movesFor(id, t);
    const shape = o.shape || pickShape(id, rnd, world);
    const mask = makeMask(cols, rows, shape);
    const obstacles = makeObstacles(cols, rows, mask, id, rnd);
    const goals = buildGoals(id, colors, t, rnd, obstacles, moves);
    const needCollect = goals.filter((g) => g.kind === "collect").reduce((s, g) => s + g.count, 0);
    const needAll = goals.reduce((s, g) => s + g.count, 0);
    const typical =
      needCollect * (28 + t * 10) +
      moves * (10 + t * 4) +
      Math.round(moves * 0.3) * 40;
    const starSoft = isRelief(id) ? 0.94 : 1;

    return {
      id,
      world: world.id,
      worldName: world.name,
      cols,
      rows,
      colors,
      moves,
      shape,
      mask,
      obstacles,
      goals,
      starScores: [
        Math.round(typical * 0.5 * starSoft),
        Math.round(typical * 0.9 * starSoft),
        Math.round(typical * 1.32 + needAll * 2),
      ],
    };
  }

  function generatePack(count, seed) {
    const levels = [];
    for (let i = 1; i <= count; i++) levels.push(buildLevel(i, seed));
    return {
      version: 4,
      title: "Кристаллы три в ряд",
      seed,
      levelCount: count,
      comingSoon: true,
      worlds: WORLDS.map(({ id, name, from, to }) => ({ id, name, from, to })),
      levels,
    };
  }

  function draw(mask, obstacles) {
    const grid = document.getElementById("grid");
    const cols = mask[0].length;
    grid.style.gridTemplateColumns = "repeat(" + cols + ", 28px)";
    const cells = [];
    for (let y = 0; y < mask.length; y++) {
      for (let x = 0; x < cols; x++) {
        if (mask[y][x]) {
          cells.push('<div class="cell off"></div>');
        } else {
          const b = obstacles && obstacles[y] ? obstacles[y][x] : 0;
          const cls = b === BLOCKER.CRATE ? "crate" : b === BLOCKER.ICE ? "ice" : "on";
          cells.push('<div class="cell ' + cls + '"></div>');
        }
      }
    }
    grid.innerHTML = cells.join("");
  }

  function val(id) { return document.getElementById(id).value; }
  function num(id) { return Number(val(id)); }

  function currentOverride() {
    const shape = val("shape");
    return {
      cols: num("cols"),
      rows: num("rows"),
      colors: num("colors"),
      moves: num("moves"),
      shape: shape === "auto" ? undefined : shape,
    };
  }

  function preview() {
    const shape = val("shape") === "auto" ? "full" : val("shape");
    const mask = makeMask(num("cols"), num("rows"), shape);
    draw(mask, null);
    document.getElementById("out").value = JSON.stringify({ shape, mask }, null, 2);
  }

  function one() {
    const lv = buildLevel(num("id"), num("seed"), currentOverride());
    draw(lv.mask, lv.obstacles);
    document.getElementById("out").value = JSON.stringify(lv, null, 2);
    document.getElementById("cols").value = lv.cols;
    document.getElementById("rows").value = lv.rows;
    document.getElementById("colors").value = lv.colors;
    document.getElementById("moves").value = lv.moves;
  }

  function pack() {
    const data = generatePack(num("count"), num("seed"));
    draw(data.levels[0].mask, data.levels[0].obstacles);
    document.getElementById("out").value = JSON.stringify(data, null, 2);
    return data;
  }

  document.getElementById("preview").onclick = preview;
  document.getElementById("one").onclick = one;
  document.getElementById("pack").onclick = pack;
  document.getElementById("download").onclick = () => {
    const text = document.getElementById("out").value || JSON.stringify(pack(), null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pack.json";
    a.click();
  };
  one();
})();
