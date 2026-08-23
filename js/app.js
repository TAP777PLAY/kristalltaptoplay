(function () {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const gemSrc = (color, world) => {
    const w = world || (current && current.world) || 1;
    return "assets/gems/w" + w + "/gem-" + color + ".png?v=33";
  };
  const { SPECIAL, BLOCKER } = GemEngine;
  const SP = SPECIAL;

  let pack = { levels: [], worlds: [] };
  let save = Save.load();
  if (!save.boosters) save.boosters = { hammer: 3, shuffle: 1 };
  let current = null;
  let board = null;
  let gems = new Map();
  let blockers = new Map();
  let toolMode = null;
  let selected = null;
  let busy = false;
  let state = "idle";
  let moves = 0;
  let score = 0;
  let goals = [];
  let rewardUsed = false;
  let rewardBusy = false;
  let pendingInterstitial = false;
  let leaving = false;

  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
    hideOvs();
  }
  function ov(id, on) { $(id).classList.toggle("show", on); }
  function hideOvs() { ["ov-start", "ov-pause", "ov-win", "ov-lose", "ov-season", "ov-help"].forEach((id) => ov(id, false)); }
  function persist() { Save.save(save); refreshMeta(); }
  function trophies() {
    return Object.values(save.stars || {}).reduce((a, s) => a + s, 0) * 10 + (save.coins || 0);
  }
  function bestLevel() {
    const fromStars = Math.max(0, ...Object.keys(save.stars || {}).map(Number));
    return Math.max(fromStars, Math.max(0, (save.unlocked || 1) - 1));
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }
  function setAva(id, url) {
    const el = $(id);
    if (!el) return;
    if (url) {
      el.src = url;
      el.hidden = false;
    } else {
      el.removeAttribute("src");
      el.hidden = true;
    }
  }
  function refreshMeta() {
    save.trophies = trophies();
    const level = bestLevel();
    if ($("home-level")) $("home-level").textContent = level;
    if ($("home-score")) $("home-score").textContent = save.trophies;
    if ($("desk-score")) $("desk-score").textContent = save.trophies;
    $("desk-name").textContent = save.name;
    $("desk-next").textContent = "Уровень " + save.unlocked;
    setAva("desk-ava", save.photo);
    Sfx.set(save.sfx !== false);
    Sfx.setMusic(save.music !== false);
    syncAudioUi();
  }

  function syncAudioUi() {
    const sfxOn = save.sfx !== false;
    const musOn = save.music !== false;
    const sfxEl = $("set-sfx");
    const musEl = $("set-music");
    if (sfxEl) sfxEl.checked = sfxOn;
    if (musEl) musEl.checked = musOn;
    const homeSfx = $("home-sfx");
    const homeMus = $("home-music");
    if (homeSfx) {
      homeSfx.classList.toggle("on", sfxOn);
      homeSfx.classList.toggle("off", !sfxOn);
      homeSfx.title = sfxOn ? "Звук включён" : "Звук выключен";
      homeSfx.setAttribute("aria-pressed", String(sfxOn));
    }
    if (homeMus) {
      homeMus.classList.toggle("on", musOn);
      homeMus.classList.toggle("off", !musOn);
      homeMus.title = musOn ? "Мелодия включена" : "Мелодия выключена";
      homeMus.setAttribute("aria-pressed", String(musOn));
    }
    document.querySelectorAll(".track-btn").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.track) === (save.musicIndex || 0));
    });
  }

  function toggleSfx() {
    save.sfx = !(save.sfx !== false);
    Sfx.set(save.sfx);
    persist();
    if (save.sfx) Sfx.play("click");
  }

  function toggleMusic() {
    save.music = !(save.music !== false);
    Sfx.unlock();
    Sfx.setMusic(save.music);
    persist();
    if (save.sfx !== false) Sfx.play("click");
  }

  function goalHtml(g) {
    if (g.kind === "break") {
      if (g.target === "ice") {
        return '<div class="goal' + (g.remaining <= 0 ? " done" : "") + '"><span class="goal-icon">🧊</span><div>' + Math.max(0, g.remaining) + "</div></div>";
      }
      return '<div class="goal' + (g.remaining <= 0 ? " done" : "") + '"><img class="goal-crate" src="assets/obstacles/crate.svg" alt="" /><div>' + Math.max(0, g.remaining) + "</div></div>";
    }
    return '<div class="goal' + (g.remaining <= 0 ? " done" : "") + '"><img src="' + gemSrc(g.gem, current && current.world) + '" alt="" /><div>' + Math.max(0, g.remaining) + "</div></div>";
  }

  function syncBoostUi() {
    const h = save.boosters.hammer || 0;
    const s = save.boosters.shuffle || 0;
    if ($("cnt-hammer")) $("cnt-hammer").textContent = h;
    if ($("cnt-shuffle")) $("cnt-shuffle").textContent = s;
    const canUse = state === "play" && !busy;
    const hammerBtn = $("btn-hammer");
    const shuffleBtn = $("btn-shuffle");
    if (hammerBtn) {
      hammerBtn.disabled = !h || !canUse;
      hammerBtn.classList.toggle("active", toolMode === "hammer");
    }
    if (shuffleBtn) shuffleBtn.disabled = !s || !canUse;
  }

  function toggleHammer() {
    if (!save.boosters.hammer || state !== "play" || busy) return;
    toolMode = toolMode === "hammer" ? null : "hammer";
    selected = null;
    highlight(null);
    syncBoostUi();
    Sfx.play("click");
  }

  async function useShuffleBoost() {
    if (!save.boosters.shuffle || state !== "play" || busy) return;
    busy = true;
    toolMode = null;
    save.boosters.shuffle -= 1;
    persist();
    syncBoostUi();
    const btn = $("btn-shuffle");
    if (btn) btn.classList.add("spinning");
    Sfx.play("click");

    const boardEl = $("board");
    if (boardEl) boardEl.classList.add("board-shuffling");
    gems.forEach((el) => {
      el.classList.add("gem-shuffle");
      el.style.transition = "transform .28s cubic-bezier(.22,.8,.25,1), opacity .22s ease";
      el.style.transform = "scale(.55) rotate(" + (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 50) + "deg)";
      el.style.opacity = "0.35";
    });
    await wait(280);

    board.shuffle();
    drawBoard();
    gems.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "scale(.6)";
      el.offsetHeight;
      el.style.transition = "transform .32s cubic-bezier(.22,.8,.25,1), opacity .28s ease";
      el.style.opacity = "";
      el.style.transform = "";
    });
    await wait(320);
    if (boardEl) boardEl.classList.remove("board-shuffling");
    if (btn) btn.classList.remove("spinning");
    busy = false;
  }

  async function useHammerAt(cell) {
    if (toolMode !== "hammer" || !save.boosters.hammer || state !== "play" || busy) return;
    const smashed = board.smashAt(cell.x, cell.y);
    if (!smashed.length) return;
    busy = true;
    toolMode = null;
    save.boosters.hammer -= 1;
    persist();
    syncBoostUi();
    Sfx.play("swap");

    const gemsHit = smashed.filter((c) => c.color);
    const blkHit = smashed.filter((c) => c.kind);
    if (gemsHit.length) await blastAndClear(gemsHit, null, 1);
    applyBlockerGoals(blkHit);
    blkHit.forEach(({ x, y, kind }) => {
      if (kind === "crate") GemFX.crateBreak($("board"), { x, y, tile: tilePx() });
      else if (kind === "ice") GemFX.iceBreak($("board"), { x, y, tile: tilePx() });
      removeBlocker(x, y);
    });
    if (blkHit.some((c) => c.kind === "crate")) await wait(160);
    // после ящика/льда всегда обрушиваем поле — иначе клетка пустая до следующего хода
    await collapse();
    if (goalsDone()) { await win(); busy = false; return; }
    await runCascade(null);
    busy = false;
  }

  function awardBoosters(stars) {
    if (stars >= 3 && Math.random() < 0.4) save.boosters.hammer = (save.boosters.hammer || 0) + 1;
    if (current.id % 10 === 0) save.boosters.shuffle = (save.boosters.shuffle || 0) + 1;
    if (current.id === 5 && (save.boosters.hammer || 0) < 2) save.boosters.hammer = 2;
  }

  function specialClass(sp) {
    if (sp === SP.ROCKET_H) return " sp-rocket-h";
    if (sp === SP.ROCKET_V) return " sp-rocket-v";
    if (sp === SP.BOMB) return " sp-bomb";
    if (sp === SP.RAINBOW) return " sp-rainbow";
    return "";
  }

  function renderLevels() {
    const root = $("levels-scroll");
    root.innerHTML = "";
    (pack.worlds || []).forEach((world) => {
      const wrap = document.createElement("div");
      wrap.className = "panel w" + ((world.id - 1) % 8 + 1);
      wrap.innerHTML = '<div class="world-title">' + esc(world.name) + "</div>";
      const grid = document.createElement("div");
      grid.className = "level-grid";
      pack.levels
        .filter((l) => l.world === world.id)
        .forEach((lv) => {
          const b = document.createElement("button");
          const locked = lv.id > save.unlocked;
          const stars = save.stars[lv.id] || 0;
          b.className = "lvl" + (locked ? " locked" : "");
          b.type = "button";
          b.innerHTML = lv.id + '<div class="stars">' + (locked ? "" : "★".repeat(stars) + "☆".repeat(3 - stars)) + "</div>";
          if (!locked) b.addEventListener("click", () => startLevel(lv.id));
          grid.appendChild(b);
        });
      wrap.appendChild(grid);
      root.appendChild(wrap);
    });
    if (pack.comingSoon !== false) {
      const soon = document.createElement("div");
      soon.className = "panel coming-soon";
      soon.innerHTML =
        '<div class="world-title">Скоро</div>' +
        '<div class="coming-soon-dots" aria-hidden="true">···</div>' +
        '<p class="coming-soon-text">Новые уровни уже в пути</p>';
      root.appendChild(soon);
    }
  }

  function localRatingRows() {
    if (!save.trophies && bestLevel() < 1) return [];
    return [{
      place: 1,
      id: save.vkId || 0,
      name: save.name,
      level: Math.max(1, bestLevel()),
      trophies: save.trophies,
      photo: save.photo || "",
    }];
  }

  function sortRatingRows(rows) {
    return rows
      .slice()
      .sort(
        (a, b) =>
          (b.level || 0) - (a.level || 0) ||
          (b.trophies || 0) - (a.trophies || 0)
      )
      .map((r, i) => ({ ...r, place: i + 1 }));
  }

  function rankHtml(rows, meId) {
    if (!rows.length) return '<p style="font-weight:800">Пока пусто — пройди уровень.</p>';
    return rows
      .map((r) => {
        const mine = (Number(r.id) > 0 && Number(meId) > 0 && Number(r.id) === Number(meId)) || (!r.id && r.name === save.name);
        const ava = r.photo
          ? '<img class="rank-ava" src="' + esc(r.photo) + '" alt="" />'
          : '<span class="rank-ava empty"></span>';
        const pts = r.trophies ?? r.score ?? 0;
        const lvl = r.level || 1;
        return (
          '<div class="rank' + (mine ? " me" : "") + '">' +
            '<b class="rank-place">' + r.place + "</b>" + ava +
            '<div class="rank-meta">' +
              '<div class="rank-name" title="' + esc(r.name) + '">' + esc(r.name) + "</div>" +
              '<div class="rank-stats">' +
                '<span class="rank-level">Уровень ' + lvl + "</span>" +
                (pts > 0 ? '<span class="rank-pts">Очки ' + pts + "</span>" : "") +
              "</div>" +
            "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function paintRatings(rows, meId, statusText) {
    const html = rankHtml(rows, meId);
    $("rating-list").innerHTML = html;
    if ($("desk-rating")) $("desk-rating").innerHTML = html;
    const status = $("rating-status");
    if (status) {
      status.textContent = statusText || "";
      status.hidden = !statusText;
    }
    const boardBtn = $("btn-vk-board");
    if (boardBtn) boardBtn.hidden = !Platform.isVk || Platform.isDesktop;
  }

  function mergeRatingRows(remote, meId) {
    const local = localRatingRows();
    let rows = remote && Array.isArray(remote.items) ? remote.items.slice() : [];
    if (remote && remote.me && !rows.some((r) => Number(r.id) === Number(remote.me.id))) {
      rows.push(remote.me);
    }
    const hasMe = (id) => Number(id) > 0 && rows.some((r) => Number(r.id) === Number(id));
    if (local.length && !hasMe(meId) && !hasMe(local[0].id) && !rows.some((r) => r.name === local[0].name && Number(r.level) === Number(local[0].level))) {
      rows = rows.concat(local);
    }
    if (!rows.length) rows = local;
    return sortRatingRows(rows);
  }

  function submitNote(sent) {
    if (!sent || sent.ok) return "";
    const map = {
      no_api: "Общий топ не подключён",
      no_launch: "VK не передал подпись запуска — очки не отправлены",
      network: "Нет связи с сервером топа",
      sign: "Сервер отклонил подпись VK",
      save: "Сервер не смог сохранить очки",
    };
    const key = sent.error === "sign" && sent.reason ? sent.reason : sent.error;
    return map[key] || map[sent.error] || "Очки не отправлены";
  }

  async function renderRatings() {
    const meId = save.vkId || 0;
    const local = localRatingRows();
    paintRatings(local, meId, "");
    const base = Platform.apiBase ? Platform.apiBase() : "";
    if (!base) {
      paintRatings(local, meId, "Общий топ не подключён");
      return;
    }
    let sent = null;
    if (save.trophies > 0 || bestLevel() >= 1) {
      sent = await Platform.submitScore({
        trophies: save.trophies,
        level: Math.max(1, bestLevel()),
        score: score || 0,
        name: save.name,
        photo: save.photo || "",
      });
    }
    const problem = submitNote(sent);
    const remote = await Platform.fetchLeaderboard();
    if (!remote || !remote.ok) {
      paintRatings(local, meId, problem || "Нет связи с сервером топа");
      return;
    }
    const rows = mergeRatingRows(remote, meId);
    const note = problem || (remote.total > 1 ? "" : "Пока только вы — другие появятся после своих побед");
    paintRatings(rows, remote.me ? remote.me.id : meId, note);
  }

  function pushRating() {
    Platform.submitScore({
      trophies: save.trophies,
      level: Math.max(1, bestLevel()),
      score: score || 0,
      name: save.name,
      photo: save.photo || "",
    }).then((data) => {
      if (data && data.ok) renderRatings();
    });
  }

  async function applyVkProfile() {
    const user = await Platform.getUser();
    if (!user) return;
    save.vkId = user.id;
    save.photo = user.photo || "";
    if (!save.nameCustom && (!save.name || save.name === "Боец" || save.name === "Игрок")) {
      save.name = user.name.slice(0, 24);
      if ($("set-name")) $("set-name").value = save.name;
    }
    persist();
  }

  function bindDevMode() {
    const DEV_KEY = "gem-brawl-dev";
    let taps = 0;
    let tapTimer = 0;
    const unlocked = () => sessionStorage.getItem(DEV_KEY) === "1";
    function showDev(ok) {
      const box = $("dev-box");
      if (!box) return;
      box.hidden = false;
      $("dev-gate").hidden = ok;
      $("dev-tools").hidden = !ok;
    }
    function onSecretTap() {
      if (unlocked()) {
        showDev(true);
        return;
      }
      clearTimeout(tapTimer);
      taps += 1;
      tapTimer = setTimeout(() => { taps = 0; }, 2500);
      if (taps < 5) return;
      taps = 0;
      Sfx.play("click");
      show("screen-settings");
      showDev(false);
      const input = $("dev-pass");
      if (input) {
        input.value = "";
        input.focus();
      }
    }
    function tryUnlock() {
      const pass = (($("dev-pass") && $("dev-pass").value) || "").trim();
      if (pass === "admin1991") {
        sessionStorage.setItem(DEV_KEY, "1");
        if ($("dev-err")) $("dev-err").hidden = true;
        showDev(true);
        Sfx.play("click");
      } else if ($("dev-err")) {
        $("dev-err").hidden = false;
        Sfx.play("lose");
      }
    }
    if (unlocked()) showDev(true);
    document.querySelectorAll('[data-go="settings"]').forEach((btn) => {
      btn.addEventListener("click", onSecretTap);
    });
    if ($("set-title")) $("set-title").addEventListener("click", onSecretTap);
    if ($("btn-dev-ok")) $("btn-dev-ok").addEventListener("click", tryUnlock);
    if ($("dev-pass")) {
      $("dev-pass").addEventListener("keydown", (e) => {
        if (e.key === "Enter") tryUnlock();
      });
    }
  }

  function tilePx() {
    const wrap = document.querySelector(".board-wrap");
    const pad = 28;
    const w = wrap ? Math.max(160, wrap.clientWidth - pad) : 380;
    const h = wrap ? Math.max(160, wrap.clientHeight - pad) : 520;
    const raw = Math.min(w / current.cols, h / current.rows);
    return Math.max(30, Math.floor(raw * 0.96));
  }

  function cellPos(x, y) {
    const t = tilePx();
    return { left: x * t, top: y * t };
  }
  function key(x, y) { return x + "," + y; }

  function drawBoard() {
    const el = $("board");
    el.innerHTML = "";
    gems.clear();
    blockers.clear();
    el.className = "world-" + (current.world || 1);
    const t = tilePx();
    el.style.setProperty("--tile", t + "px");
    el.style.setProperty("--cols", current.cols);
    el.style.setProperty("--rows", current.rows);
    const wrap = el.parentElement;
    if (wrap) {
      wrap.className = "board-wrap world-" + (current.world || 1);
      wrap.style.setProperty("--tile", t + "px");
      wrap.style.setProperty("--cols", current.cols);
      wrap.style.setProperty("--rows", current.rows);
    }
    el.style.width = current.cols * t + "px";
    el.style.height = current.rows * t + "px";
    for (let y = 0; y < current.rows; y++) {
      for (let x = 0; x < current.cols; x++) {
        if (!board.isPlayable(x, y)) continue;
        const tile = document.createElement("div");
        tile.className = "tile" + ((x + y) % 2 ? " odd" : "");
        const p = cellPos(x, y);
        tile.style.left = p.left + "px";
        tile.style.top = p.top + "px";
        el.appendChild(tile);
        const blk = board.blockers[x][y];
        if (blk === BLOCKER.CRATE) makeBlocker(x, y, "crate");
        else if (blk === BLOCKER.ICE) makeBlocker(x, y, "ice");
        if (board.gems[x][y] > 0) makeGem(x, y, board.gems[x][y], board.specials[x][y]);
      }
    }
  }

  function makeBlocker(x, y, kind) {
    const el = document.createElement("div");
    el.className = "blocker blocker-" + kind;
    const p = cellPos(x, y);
    el.style.left = p.left + "px";
    el.style.top = p.top + "px";
    $("board").appendChild(el);
    blockers.set(key(x, y), el);
    return el;
  }

  function removeBlocker(x, y) {
    const el = blockers.get(key(x, y));
    if (el) {
      const isCrate = el.classList.contains("blocker-crate");
      el.classList.add("break");
      setTimeout(() => el.remove(), isCrate ? 340 : 280);
      blockers.delete(key(x, y));
      if (board.gems[x][y] > 0) refreshGemEl(x, y);
    }
  }

  function makeGem(x, y, color, special) {
    removeGemAt(x, y);
    const el = document.createElement("div");
    el.className = "gem" + specialClass(special || 0) + (isIced(x, y) ? " under-ice" : "");
    el.style.backgroundImage = "url(" + gemSrc(color) + ")";
    el.dataset.x = x;
    el.dataset.y = y;
    el.dataset.color = color;
    el.dataset.special = special || 0;
    const p = cellPos(x, y);
    el.style.left = p.left + "px";
    el.style.top = p.top + "px";
    $("board").appendChild(el);
    gems.set(key(x, y), el);
    return el;
  }

  function isIced(x, y) {
    return board && board.blockers[x][y] === BLOCKER.ICE;
  }

  function applyGemState(el, x, y, color, special) {
    const p = cellPos(x, y);
    el.style.backgroundImage = "url(" + gemSrc(color) + ")";
    el.style.left = p.left + "px";
    el.style.top = p.top + "px";
    el.style.transform = "";
    el.style.opacity = "";
    el.style.transition = "";
    el.dataset.x = x;
    el.dataset.y = y;
    el.dataset.color = color;
    el.dataset.special = special || 0;
    el.className = "gem" + specialClass(special || 0) + (isIced(x, y) ? " under-ice" : "");
  }

  function removeGemEl(el) {
    if (!el) return;
    gems.forEach((node, k) => { if (node === el) gems.delete(k); });
    el.remove();
  }

  function removeGemAt(x, y) {
    removeGemEl(gems.get(key(x, y)));
  }

  function mapPutGem(next, x, y, el) {
    const k = key(x, y);
    const prev = next.get(k);
    if (prev && prev !== el) prev.remove();
    next.set(k, el);
  }

  /** Сверка DOM с полем: ровно один .gem на каждую занятую клетку. */
  function reconcileGems() {
    if (!board || !current) return;
    const expected = new Map();
    for (let y = 0; y < current.rows; y++) {
      for (let x = 0; x < current.cols; x++) {
        if (board.gems[x][y] > 0) {
          expected.set(key(x, y), {
            x, y,
            color: board.gems[x][y],
            special: board.specials[x][y],
          });
        }
      }
    }

    const claimed = new Set();
    const next = new Map();
    const boardEl = $("board");
    const allDom = boardEl ? [...boardEl.querySelectorAll(".gem")] : [];

    expected.forEach((data, k) => {
      const el = gems.get(k);
      if (el && el.isConnected && !claimed.has(el)) {
        claimed.add(el);
        applyGemState(el, data.x, data.y, data.color, data.special);
        next.set(k, el);
      }
    });

    allDom.forEach((el) => {
      if (claimed.has(el)) return;
      const x = +el.dataset.x;
      const y = +el.dataset.y;
      const k = key(x, y);
      if (expected.has(k) && !next.has(k)) {
        claimed.add(el);
        const data = expected.get(k);
        applyGemState(el, data.x, data.y, data.color, data.special);
        next.set(k, el);
      }
    });

    allDom.forEach((el) => {
      if (!claimed.has(el)) el.remove();
    });

    expected.forEach((data, k) => {
      if (!next.has(k)) {
        next.set(k, makeGem(data.x, data.y, data.color, data.special));
      }
    });

    gems = next;
  }

  function refreshGemEl(x, y) {
    const color = board.gems[x][y];
    const special = board.specials[x][y];
    if (!color) {
      removeGemAt(x, y);
      return;
    }
    const el = gems.get(key(x, y));
    if (el) applyGemState(el, x, y, color, special);
    else makeGem(x, y, color, special);
  }

  function highlight(cell) {
    gems.forEach((g) => g.classList.remove("selected"));
    if (!cell) return;
    const el = gems.get(key(cell.x, cell.y));
    if (el) el.classList.add("selected");
  }

  function matchCenter(cells) {
    const n = cells.length || 1;
    return {
      x: cells.reduce((s, c) => s + c.x, 0) / n,
      y: cells.reduce((s, c) => s + c.y, 0) / n,
    };
  }

  function expandClears(cells) {
    let all = cells.slice();
    cells.forEach((c) => {
      const sp = board.specialAt(c.x, c.y);
      if (sp) all = all.concat(board.expandSpecial(c.x, c.y, c.color || board.colorAt(c.x, c.y)));
    });
    return board.uniqueCells(all);
  }

  function keepKeys(keep) {
    const keys = new Set();
    if (!keep) return keys;
    const add = (k) => { if (k && k.x != null) keys.add(key(k.x, k.y)); };
    if (Array.isArray(keep)) keep.forEach(add);
    else add(keep);
    return keys;
  }

  async function blastAndClear(cells, keep, wave, syncCell, fxHint) {
    const kKeep = keepKeys(keep);
    const toBlast = kKeep.size
      ? cells.filter((c) => !kKeep.has(key(c.x, c.y)))
      : cells;
    await explodeCells(toBlast, wave, syncCell, fxHint);
    const blk = board.damageAdjacentBlockers(cells);
    applyBlockerGoals(blk);
    blk.forEach(({ x, y, kind }) => {
      if (kind === "crate") GemFX.crateBreak($("board"), { x, y, tile: tilePx() });
      else if (kind === "ice") GemFX.iceBreak($("board"), { x, y, tile: tilePx() });
      removeBlocker(x, y);
    });
    board.clearCells(cells, keep);
    reconcileGems();
  }

  function detectFxHint(cells, syncCell) {
    if (!cells || !cells.length) return { kind: "match" };
    const cols = current.cols;
    const rows = current.rows;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const sp = board.specialAt(c.x, c.y);
      if (sp === SP.RAINBOW) {
        return { kind: "rainbow", from: { x: c.x, y: c.y }, cols, rows };
      }
      if (sp === SP.ROCKET_H) {
        return { kind: "line-h", from: { x: c.x, y: c.y }, cols, rows };
      }
      if (sp === SP.ROCKET_V) {
        return { kind: "line-v", from: { x: c.x, y: c.y }, cols, rows };
      }
      if (sp === SP.BOMB) {
        return { kind: "bomb", from: { x: c.x, y: c.y }, cols, rows };
      }
    }
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    const from = syncCell || {
      x: Math.round(xs.reduce((s, v) => s + v, 0) / xs.length),
      y: Math.round(ys.reduce((s, v) => s + v, 0) / ys.length),
    };
    return { kind: "match", from, wave: 1 };
  }

  function placeBoosters(boosters) {
    boosters.forEach((b) => {
      board.placeBooster(b);
      refreshGemEl(b.x, b.y);
      const el = gems.get(key(b.x, b.y));
      if (el) el.classList.remove("charge", "shatter", "selected", "landing");
    });
  }

  function fxFromSpecials(ax, ay, bx, by) {
    const sa = board.specialAt(ax, ay);
    const sb = board.specialAt(bx, by);
    const cols = current.cols;
    const rows = current.rows;
    if (sa === SP.RAINBOW || sb === SP.RAINBOW) {
      const from = sa === SP.RAINBOW ? { x: ax, y: ay } : { x: bx, y: by };
      const other = sa === SP.RAINBOW ? { x: bx, y: by } : { x: ax, y: ay };
      return {
        kind: "rainbow",
        from,
        color: board.colorAt(other.x, other.y),
        cols,
        rows,
      };
    }
    if (sa === SP.ROCKET_H || sb === SP.ROCKET_H) {
      const from = sa === SP.ROCKET_H ? { x: ax, y: ay } : { x: bx, y: by };
      if (sa === SP.ROCKET_V || sb === SP.ROCKET_V) {
        return { kind: "bomb", from, cols, rows };
      }
      return { kind: "line-h", from, cols, rows };
    }
    if (sa === SP.ROCKET_V || sb === SP.ROCKET_V) {
      const from = sa === SP.ROCKET_V ? { x: ax, y: ay } : { x: bx, y: by };
      return { kind: "line-v", from, cols, rows };
    }
    if (sa === SP.BOMB || sb === SP.BOMB) {
      const from = sa === SP.BOMB ? { x: ax, y: ay } : { x: bx, y: by };
      return { kind: "bomb", from, cols, rows };
    }
    return { kind: "match", from: { x: bx, y: by }, cols, rows };
  }

  async function explodeCells(cells, wave, syncCell, fxHint) {
    const t = tilePx();
    const mid = matchCenter(cells);
    const syncKey = syncCell ? key(syncCell.x, syncCell.y) : "";
    const dying = [];
    const fxCells = [];
    const hint = fxHint || detectFxHint(cells, syncCell);

    cells.forEach(({ x, y, color }) => {
      const k = key(x, y);
      const el = gems.get(k);
      const c = color || board.colorAt(x, y) || 1;
      fxCells.push({ x, y, color: c, src: gemSrc(c) });
      if (!el) return;
      dying.push(el);
      gems.delete(k);
      el.classList.remove("selected", "landing", "slow-fx");
      const slow =
        hint.kind === "rainbow" ||
        hint.kind === "line-h" ||
        hint.kind === "line-v" ||
        hint.kind === "bomb";
      if (slow) el.classList.add("slow-fx");
      el.classList.add("charge");
      let delay;
      if (hint.kind === "line-h" && (syncCell || hint.from)) {
        const origin = syncCell || hint.from;
        delay = Math.min(320, Math.abs(x - origin.x) * 40);
      } else if (hint.kind === "line-v" && (syncCell || hint.from)) {
        const origin = syncCell || hint.from;
        delay = Math.min(320, Math.abs(y - origin.y) * 40);
      } else if (hint.kind === "rainbow" && hint.from) {
        delay = Math.min(360, Math.round(Math.hypot(x - hint.from.x, y - hint.from.y) * 28));
      } else if (hint.kind === "bomb" && hint.from) {
        delay = Math.min(280, Math.round(Math.hypot(x - hint.from.x, y - hint.from.y) * 42));
      } else if (syncKey) {
        delay = Math.min(90, Math.round(Math.hypot(x - syncCell.x, y - syncCell.y) * 12));
      } else {
        delay = Math.min(90, Math.round(Math.hypot(x - mid.x, y - mid.y) * 12));
      }
      const shatterPad = hint.kind === "match" || !hint.kind ? 35 : 90;
      setTimeout(() => {
        if (el.isConnected) el.classList.add("shatter");
      }, delay + shatterPad);
    });

    applyGoals(cells, wave);
    const waitMs = GemFX.playClear($("board"), fxCells, t, {
      kind: hint.kind || "match",
      from: hint.from || syncCell || mid,
      cols: current.cols,
      rows: current.rows,
      wave,
      color: hint.color,
    });
    await wait(waitMs);
    dying.forEach((el) => el.remove());
  }

  function applyBlockerGoals(cleared) {
    cleared.forEach(({ kind }) => {
      const g = goals.find((t) => t.kind === "break" && t.target === kind && t.remaining > 0);
      if (g) {
        g.remaining -= 1;
        if (g.remaining === 0) Sfx.play("target");
      }
    });
    $("goals").innerHTML = goals.map(goalHtml).join("");
  }

  function applyGoals(cells, wave) {
    const bonus = 10 + (wave || 1) * 6;
    cells.forEach(({ color }) => {
      if (!color) return;
      const g = goals.find((t) => t.gem === color && t.remaining > 0);
      if (g) {
        g.remaining -= 1;
        if (g.remaining === 0) Sfx.play("target");
      }
      score += bonus;
      save.coins += 1;
    });
    $("goals").innerHTML = goals.map(goalHtml).join("");
  }

  function goalsDone() {
    return goals.every((g) => g.remaining <= 0);
  }

  function goalGemTotal() {
    return (current.goals || [])
      .filter((g) => g.kind === "collect")
      .reduce((s, g) => s + (g.count || 0), 0);
  }

  /** Пороги ★★ / ★★★ из пака; запасной расчёт — жёсткий. */
  function starThresholds() {
    const need = Math.max(8, goalGemTotal());
    const two = Math.round(need * 34 + current.moves * 20);
    const three = Math.round(need * 48 + current.moves * 32);
    const json = current.starScores;
    if (json && json[1] > 0 && json[2] > json[1]) {
      return { twoScore: json[1], threeScore: json[2] };
    }
    return { twoScore: two, threeScore: three };
  }

  /**
   * Звёзды за эффективность (запас ходов). Очки помогают только при ненулевом запасе —
   * «идеал» с 0 ходов больше невозможен.
   * ★ — просто победа
   * ★★ — запас ≥28% или высокий скор при запасе ≥10%
   * ★★★ — запас ≥48% или топ-скор при запасе ≥22%
   */
  function starCount() {
    const start = Math.max(1, current.moves);
    const left = Math.max(0, moves);
    const twoMoves = Math.max(3, Math.ceil(start * 0.28));
    const threeMoves = Math.max(6, Math.ceil(start * 0.48));
    const scoreTwoFloor = Math.max(1, Math.ceil(start * 0.1));
    const scoreThreeFloor = Math.max(2, Math.ceil(start * 0.22));
    const { twoScore, threeScore } = starThresholds();

    if (left >= threeMoves || (score >= threeScore && left >= scoreThreeFloor)) return 3;
    if (left >= twoMoves || (score >= twoScore && left >= scoreTwoFloor)) return 2;
    return 1;
  }

  function renderWinStars(n) {
    $("win-stars").innerHTML = [1, 2, 3]
      .map((i) => '<span class="star' + (i <= n ? " on" : "") + '" style="--d:' + (i - 1) * 0.16 + 's">★</span>')
      .join("");
    const left = Math.max(0, moves);
    const hint =
      n === 3
        ? "Идеально!"
        : n === 2
          ? "Отлично!"
          : left === 0
            ? "Впритык!"
            : "Уровень пройден";
    $("win-hint").textContent = hint;
  }

  async function collapse() {
    const movesG = board.applyGravity();
    const next = new Map();
    const used = new Set();
    const falling = [];
    let maxEnd = 0;

    movesG.forEach((m) => {
      const el = gems.get(key(m.fromX, m.fromY));
      if (!el) return;
      const from = cellPos(m.fromX, m.fromY);
      const to = cellPos(m.toX, m.toY);
      const dist = m.toY - m.fromY;
      const ms = GemFX.fallMs(dist);
      const delay = m.fromX * 8;
      GemFX.prepareFall(el);
      el.style.left = from.left + "px";
      el.style.top = from.top + "px";
      el.dataset.x = m.toX;
      el.dataset.y = m.toY;
      el.dataset.color = m.color;
      el.dataset.special = m.special || 0;
      el.className = "gem" + specialClass(m.special || 0);
      el.style.transform = "";
      el.style.opacity = "";
      el.offsetHeight;
      GemFX.playFall(el, to.top, ms, delay);
      falling.push({ el, landAt: delay + ms, x: m.toX, y: m.toY });
      maxEnd = Math.max(maxEnd, delay + ms);
      mapPutGem(next, m.toX, m.toY, el);
      used.add(el);
    });

    gems.forEach((el) => {
      if (used.has(el)) return;
      const x = +el.dataset.x;
      const y = +el.dataset.y;
      const k = key(x, y);
      if (board.gems[x] && board.gems[x][y] > 0) {
        mapPutGem(next, x, y, el);
        used.add(el);
      } else el.remove();
    });

    const spawned = board.fillFromTop();
    spawned.forEach(({ x, y, color, special, fromY }) => {
      if (next.has(key(x, y))) return;
      const el = document.createElement("div");
      el.className = "gem" + specialClass(special || 0) + (isIced(x, y) ? " under-ice" : "");
      el.style.backgroundImage = "url(" + gemSrc(color) + ")";
      const from = cellPos(x, fromY);
      const to = cellPos(x, y);
      el.style.left = from.left + "px";
      el.style.top = from.top + "px";
      el.dataset.x = x;
      el.dataset.y = y;
      el.dataset.color = color;
      el.dataset.special = special || 0;
      $("board").appendChild(el);
      const dist = y - fromY;
      const ms = GemFX.fallMs(dist);
      const delay = 12 + x * 8 + Math.abs(fromY + 1) * 16;
      el.offsetHeight;
      GemFX.playFall(el, to.top, ms, delay);
      falling.push({ el, landAt: delay + ms, x, y });
      maxEnd = Math.max(maxEnd, delay + ms);
      mapPutGem(next, x, y, el);
    });

    gems = next;
    Sfx.play("drop");

    falling.forEach(({ el, landAt, x, y }) => {
      setTimeout(() => {
        GemFX.land(el);
        el.style.left = cellPos(x, y).left + "px";
        el.style.top = cellPos(x, y).top + "px";
      }, landAt);
    });
    await wait(maxEnd + 40);
    falling.forEach(({ el, x, y }) => {
      el.style.transition = "";
      el.style.transform = "";
      el.style.left = cellPos(x, y).left + "px";
      el.style.top = cellPos(x, y).top + "px";
    });
    reconcileGems();
  }

  async function runCascade(swapCell) {
    let wave = 0;
    while (state === "play" || state === "busy") {
      const groups = board.mergeGroups(board.findMatchGroups());
      if (!groups.length) break;
      wave++;
      Sfx.playMatch(wave);

      let cells = board.cellsFromGroups(groups, swapCell);
      const boosters = board.collectBoosters(groups, swapCell);
      const syncCell = swapCell;
      swapCell = null;
      const keep = boosters.length ? boosters : null;

      await blastAndClear(cells, keep, wave, syncCell);
      if (boosters.length) placeBoosters(boosters);
      await collapse();
      if (goalsDone()) { await win(); return; }
    }
    reconcileGems();
    if (moves <= 0 && !goalsDone()) { lose(); return; }
    if (!board.hasPossibleMove()) {
      board.shuffle();
      drawBoard();
    }
  }

  async function resolve() {
    await runCascade(null);
  }

  async function trySwap(a, b) {
    if (!board.isAdjacent(a, b)) {
      selected = b;
      highlight(b);
      return;
    }
    busy = true;
    state = "busy";
    try {
      Sfx.play("swap");
      const elA = gems.get(key(a.x, a.y));
      const elB = gems.get(key(b.x, b.y));
      const pa = cellPos(a.x, a.y);
      const pb = cellPos(b.x, b.y);
      [elA, elB].forEach((el) => {
        if (!el) return;
        el.classList.remove("selected", "landing");
        el.style.transition = "left .18s cubic-bezier(.22,.7,.2,1), top .18s cubic-bezier(.22,.7,.2,1)";
      });
      if (elA) { elA.style.left = pb.left + "px"; elA.style.top = pb.top + "px"; }
      if (elB) { elB.style.left = pa.left + "px"; elB.style.top = pa.top + "px"; }
      await wait(150);

      const hadSpecial = board.specialAt(a.x, a.y) || board.specialAt(b.x, b.y);
      board.swap(a.x, a.y, b.x, b.y);
      if (elA) {
        elA.dataset.x = b.x;
        elA.dataset.y = b.y;
        elA.dataset.color = board.gems[b.x][b.y];
        elA.dataset.special = board.specials[b.x][b.y];
        elA.className = "gem" + specialClass(board.specials[b.x][b.y]);
      }
      if (elB) {
        elB.dataset.x = a.x;
        elB.dataset.y = a.y;
        elB.dataset.color = board.gems[a.x][a.y];
        elB.dataset.special = board.specials[a.x][a.y];
        elB.className = "gem" + specialClass(board.specials[a.x][a.y]);
      }
      const groups = board.mergeGroups(board.findMatchGroups());
      const hasMatch = groups.length > 0;

      if (!hasMatch && !hadSpecial) {
        board.swap(a.x, a.y, b.x, b.y);
        if (elA) {
          elA.style.left = pa.left + "px";
          elA.style.top = pa.top + "px";
          elA.dataset.x = a.x;
          elA.dataset.y = a.y;
          elA.dataset.color = board.gems[a.x][a.y];
          elA.dataset.special = board.specials[a.x][a.y];
          elA.className = "gem" + specialClass(board.specials[a.x][a.y]);
        }
        if (elB) {
          elB.style.left = pb.left + "px";
          elB.style.top = pb.top + "px";
          elB.dataset.x = b.x;
          elB.dataset.y = b.y;
          elB.dataset.color = board.gems[b.x][b.y];
          elB.dataset.special = board.specials[b.x][b.y];
          elB.className = "gem" + specialClass(board.specials[b.x][b.y]);
        }
        await wait(150);
        selected = null;
        highlight(null);
        state = "play";
        return;
      }

      const next = new Map(gems);
      if (elA) { elA.dataset.x = b.x; elA.dataset.y = b.y; next.set(key(b.x, b.y), elA); next.delete(key(a.x, a.y)); }
      if (elB) { elB.dataset.x = a.x; elB.dataset.y = a.y; next.set(key(a.x, a.y), elB); next.delete(key(b.x, b.y)); }
      gems = next;

      moves -= 1;
      $("moves").textContent = moves;
      selected = null;
      highlight(null);
      state = "play";

      if (hadSpecial) {
        const fx = fxFromSpecials(a.x, a.y, b.x, b.y);
        const cells = board.uniqueCells(board.activateSwap(a.x, a.y, b.x, b.y));
        if (cells.length) {
          Sfx.playMatch(1);
          await blastAndClear(cells, null, 1, fx.from || b, fx);
          await collapse();
          if (goalsDone()) { await win(); return; }
        }
        // каскад только для новых матчей после обвала — бонус уже израсходован
        await runCascade(null);
      } else if (hasMatch) {
        await runCascade(b);
      }
      reconcileGems();
    } finally {
      busy = false;
    }
  }

  function pick(ev) {
    const rect = $("board").getBoundingClientRect();
    const t = rect.width / current.cols;
    const x = Math.floor((ev.clientX - rect.left) / t);
    const y = Math.floor((ev.clientY - rect.top) / t);
    if (!board.isPlayable(x, y)) return null;
    return { x, y };
  }

  function pickGem(ev) {
    const cell = pick(ev);
    if (!cell || !board.hasGem(cell.x, cell.y)) return null;
    return cell;
  }

  let dragFrom = null;
  function onBoardDown(ev) {
    if (busy || state !== "play") return;
    ev.preventDefault();
    const cell = pick(ev);
    if (!cell) return;
    try { $("board").setPointerCapture(ev.pointerId); } catch (e) {}
    if (toolMode === "hammer") {
      useHammerAt(cell);
      return;
    }
    const gemCell = board.hasGem(cell.x, cell.y) ? cell : null;
    if (!gemCell) return;
    if (selected && board.isAdjacent(selected, gemCell) && (selected.x !== gemCell.x || selected.y !== gemCell.y)) {
      dragFrom = null;
      trySwap(selected, gemCell);
      return;
    }
    selected = gemCell;
    highlight(gemCell);
    dragFrom = gemCell;
  }
  function onBoardMove(ev) {
    if (!dragFrom || busy || state !== "play" || toolMode) return;
    const cell = pickGem(ev);
    if (!cell || (cell.x === dragFrom.x && cell.y === dragFrom.y)) return;
    if (board.isAdjacent(dragFrom, cell)) {
      const from = dragFrom;
      dragFrom = null;
      trySwap(from, cell);
    }
  }
  function onBoardUp() { dragFrom = null; }

  function startLevel(id) {
    if (id > pack.levels.length) {
      showSeason();
      return;
    }
    current = pack.levels.find((l) => l.id === id);
    if (!current) return;
    Sfx.play("click");
    toolMode = null;
    score = 0;
    moves = current.moves;
    goals = current.goals.map((g) => ({ ...g, remaining: g.count }));
    board = new GemEngine.Board(current);
    board.generateInitial();
    show("screen-game");
    Platform.fit($("stage"));
    rewardUsed = false;
    rewardBusy = false;
    $("moves").textContent = moves;
    $("goals").innerHTML = goals.map(goalHtml).join("");
    if ($("hud-level")) $("hud-level").textContent = current.id;
    syncRewardUi();
    $("start-title").textContent = "УРОВЕНЬ " + current.id;
    $("start-world").textContent = current.worldName;
    $("start-moves").textContent = current.moves;
    $("start-goals").innerHTML = goals.map(goalHtml).join("");
    const hintEl = $("start-hint");
    if (hintEl) {
      hintEl.textContent = current.hint || "";
      hintEl.hidden = !current.hint;
    }
    syncBoostUi();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawBoard();
        state = "start";
        ov("ov-start", true);
      });
    });
  }

  async function win() {
    if (state === "win") return;
    state = "win";
    Sfx.play("win");
    const left = Math.max(0, moves);
    // Бонус за запас ходов — эффективность кормит рейтинг ★
    score += left * 40;
    const stars = starCount();
    save.stars[current.id] = Math.max(save.stars[current.id] || 0, stars);
    if (current.id >= save.unlocked) save.unlocked = current.id + 1;
    Save.addScore(save, { name: save.name, level: current.id, score, trophies: stars * 10, at: Date.now() });
    save.clears = (save.clears || 0) + 1;
    pendingInterstitial = save.clears % 2 === 0;
    awardBoosters(stars);
    persist();
    pushRating();
    syncRewardUi();
    if (current.id >= pack.levels.length) {
      showSeason();
      return;
    }
    renderWinStars(stars);
    $("win-text").textContent = current.worldName + " · " + score + " очков";
    ov("ov-win", true);
  }

  function showSeason() {
    state = "season";
    $("season-text").textContent = "Уровень: " + bestLevel() + " · очки: " + save.trophies;
    show("screen-home");
    ov("ov-season", true);
  }

  function lose() {
    if (state === "lose" || state === "win") return;
    state = "lose";
    Sfx.play("lose");
    persist();
    $("lose-text").textContent = "Ходы закончились на уровне " + current.id;
    ov("ov-lose", true);
    syncRewardUi();
  }

  function syncRewardUi() {
    const hud = $("btn-reward");
    const loseBtn = $("btn-reward-lose");
    const blocked = rewardUsed || rewardBusy || state === "win" || state === "season";
    if (hud) hud.disabled = blocked || (state !== "play" && state !== "paused" && state !== "start");
    if (loseBtn) {
      loseBtn.disabled = rewardUsed || rewardBusy;
      loseBtn.classList.toggle("hidden", rewardUsed);
    }
  }

  function grantMoves(n) {
    moves += n;
    $("moves").textContent = moves;
    if (state === "lose") {
      ov("ov-lose", false);
      state = "play";
    }
  }

  async function watchReward(fromLose) {
    if (rewardUsed || rewardBusy) return;
    if (fromLose) {
      if (state !== "lose") return;
    } else if (state !== "play" && state !== "paused") {
      return;
    }
    rewardBusy = true;
    syncRewardUi();
    Sfx.play("click");
    const ok = await Platform.showReward();
    rewardBusy = false;
    if (!ok) {
      syncRewardUi();
      return;
    }
    rewardUsed = true;
    grantMoves(3);
    syncRewardUi();
  }

  async function leaveAfterLevel(next) {
    if (leaving) return;
    leaving = true;
    Sfx.play("click");
    hideOvs();
    if (pendingInterstitial) {
      pendingInterstitial = false;
      Platform.armInterstitial();
      await Platform.showInterstitial();
    }
    leaving = false;
    next();
  }

  function goHome() {
    hideOvs();
    state = "idle";
    busy = false;
    show("screen-home");
    refreshMeta();
    renderRatings();
  }

  async function boot() {
    await Platform.init();
    Platform.fit($("stage"));
    window.addEventListener("resize", () => {
      Platform.fit($("stage"));
      if (current && board && !busy && (state === "play" || state === "start" || state === "paused")) {
        drawBoard();
      }
    });
    refreshMeta();
    $("set-name").value = save.name;
    syncAudioUi();
    Sfx.load();
    Sfx.set(save.sfx !== false);
    Sfx.startMusic(save.musicIndex || 0);
    Sfx.setMusic(save.music !== false);

    const res = await fetch("levels/pack.json?v=65");
    pack = await res.json();
    try {
      const tutRes = await fetch("levels/tutorial.json");
      const tut = await tutRes.json();
      (tut.overrides || []).forEach((ov) => {
        const i = pack.levels.findIndex((l) => l.id === ov.id);
        if (i >= 0) pack.levels[i] = { ...pack.levels[i], ...ov };
      });
    } catch (e) {}

    document.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        Sfx.play("click");
        const to = btn.dataset.go;
        if (to === "levels") renderLevels();
        if (to === "ratings") renderRatings();
        show("screen-" + to);
      });
    });
    bindDevMode();
    $("btn-play").addEventListener("click", () => startLevel(save.unlocked));
    $("btn-help").addEventListener("click", () => { Sfx.play("click"); ov("ov-help", true); });
    $("btn-help-close").addEventListener("click", () => { Sfx.play("click"); ov("ov-help", false); });
    $("btn-to-levels").addEventListener("click", () => { Sfx.play("click"); renderLevels(); show("screen-levels"); });
    $("btn-to-ratings").addEventListener("click", () => { Sfx.play("click"); renderRatings(); show("screen-ratings"); });
    if ($("btn-vk-board")) {
      $("btn-vk-board").addEventListener("click", () => {
        Sfx.play("click");
        Platform.showOfficialBoard(save.trophies);
      });
    }
    $("btn-start").addEventListener("click", () => {
      Sfx.play("click");
      toolMode = null;
      ov("ov-start", false);
      state = "play";
      syncRewardUi();
      syncBoostUi();
    });
    $("btn-pause").addEventListener("click", () => { if (state === "play") { Sfx.play("click"); ov("ov-pause", true); state = "paused"; } });
    $("btn-resume").addEventListener("click", () => { Sfx.play("click"); ov("ov-pause", false); state = "play"; });
    $("btn-restart").addEventListener("click", () => startLevel(current.id));
    $("btn-quit").addEventListener("click", goHome);
    $("btn-retry").addEventListener("click", () => startLevel(current.id));
    $("btn-lose-home").addEventListener("click", goHome);
    $("btn-win-home").addEventListener("click", () => leaveAfterLevel(goHome));
    $("btn-next").addEventListener("click", () => {
      leaveAfterLevel(() => {
        const n = current.id + 1;
        if (n > pack.levels.length) showSeason();
        else startLevel(n);
      });
    });
    $("btn-season-home").addEventListener("click", () => leaveAfterLevel(goHome));
    $("btn-season-ratings").addEventListener("click", () => {
      leaveAfterLevel(() => {
        hideOvs();
        renderRatings();
        show("screen-ratings");
      });
    });
    $("btn-reward").addEventListener("click", () => watchReward(false));
    $("btn-reward-lose").addEventListener("click", () => watchReward(true));
    if ($("btn-hammer")) $("btn-hammer").addEventListener("click", toggleHammer);
    if ($("btn-shuffle")) $("btn-shuffle").addEventListener("click", useShuffleBoost);
    $("board").addEventListener("pointerdown", onBoardDown);
    $("board").addEventListener("pointermove", onBoardMove);
    $("board").addEventListener("pointerup", onBoardUp);
    $("board").addEventListener("pointercancel", onBoardUp);
    $("set-name").addEventListener("change", () => {
      save.name = $("set-name").value.slice(0, 24).trim() || "Игрок";
      save.nameCustom = true;
      persist();
    });
    $("set-sfx").addEventListener("change", () => {
      save.sfx = $("set-sfx").checked;
      Sfx.set(save.sfx);
      persist();
      if (save.sfx) Sfx.play("click");
    });
    $("set-music").addEventListener("change", () => {
      save.music = $("set-music").checked;
      Sfx.unlock();
      Sfx.setMusic(save.music);
      persist();
    });
    $("home-sfx").addEventListener("click", toggleSfx);
    $("home-music").addEventListener("click", toggleMusic);
    document.querySelectorAll(".track-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        save.musicIndex = Number(btn.dataset.track);
        Sfx.unlock();
        Sfx.startMusic(save.musicIndex);
        persist();
        syncAudioUi();
        Sfx.play("click");
      });
    });
    renderRatings();
    await applyVkProfile();
    if (save.trophies > 0) pushRating();
    else renderRatings();
    window.__game = { get pack() { return pack; }, get save() { return save; } };
  }

  boot();
})();
