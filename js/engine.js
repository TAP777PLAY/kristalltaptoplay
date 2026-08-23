(function (global) {
  const BLOCKED = 1;
  const PLAYABLE = 0;

  const SPECIAL = {
    NONE: 0,
    ROCKET_H: 1,
    ROCKET_V: 2,
    BOMB: 3,
    RAINBOW: 4,
  };

  const BLOCKER = {
    NONE: 0,
    CRATE: 1,
    ICE: 2,
  };

  function key(x, y) {
    return x + "," + y;
  }

  class Board {
    constructor(level) {
      const { cols, rows, colors, mask } = level;
      this.cols = cols;
      this.rows = rows;
      this.maxColor = colors;
      this.cell = [];
      this.gems = [];
      this.specials = [];
      this.blockers = [];
      for (let x = 0; x < cols; x++) {
        this.cell[x] = [];
        this.gems[x] = [];
        this.specials[x] = [];
        this.blockers[x] = [];
        for (let y = 0; y < rows; y++) {
          const blocked = mask && mask[y] && mask[y][x] === BLOCKED;
          this.cell[x][y] = blocked ? BLOCKED : PLAYABLE;
          this.gems[x][y] = 0;
          this.specials[x][y] = SPECIAL.NONE;
          this.blockers[x][y] = BLOCKER.NONE;
        }
      }
      const obs = level.obstacles;
      if (obs && obs.length) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const v = obs[y] && obs[y][x];
            if (v === BLOCKER.CRATE || v === BLOCKER.ICE) this.blockers[x][y] = v;
          }
        }
      }
    }

    isPlayable(x, y) {
      return x >= 0 && y >= 0 && x < this.cols && y < this.rows && this.cell[x][y] === PLAYABLE;
    }

    hasCrate(x, y) {
      return this.isPlayable(x, y) && this.blockers[x][y] === BLOCKER.CRATE;
    }

    hasGem(x, y) {
      return this.isPlayable(x, y) && !this.hasCrate(x, y) && this.gems[x][y] > 0;
    }

    colorAt(x, y) {
      return this.hasGem(x, y) ? this.gems[x][y] : 0;
    }

    specialAt(x, y) {
      return this.hasGem(x, y) ? this.specials[x][y] : SPECIAL.NONE;
    }

    randomColor() {
      return 1 + Math.floor(Math.random() * this.maxColor);
    }

    wouldMatch(x, y, color) {
      if (this.colorAt(x - 1, y) === color && this.colorAt(x - 2, y) === color) return true;
      if (this.colorAt(x, y - 1) === color && this.colorAt(x, y - 2) === color) return true;
      return false;
    }

    fillColor(x, y) {
      const options = [];
      for (let c = 1; c <= this.maxColor; c++) {
        if (!this.wouldMatch(x, y, c)) options.push(c);
      }
      return options.length ? options[Math.floor(Math.random() * options.length)] : this.randomColor();
    }

    generateInitial() {
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (!this.isPlayable(x, y) || this.hasCrate(x, y)) continue;
          this.gems[x][y] = this.fillColor(x, y);
          this.specials[x][y] = SPECIAL.NONE;
        }
      }
      if (!this.hasPossibleMove()) this.shuffle();
    }

    /** Горизонтальные и вертикальные серии одного цвета (≥3). */
    findMatchGroups() {
      const groups = [];
      const addGroup = (cells, orientation) => {
        if (cells.length < 3) return;
        groups.push({
          cells: cells.slice(),
          orientation,
          length: cells.length,
          color: this.colorAt(cells[0].x, cells[0].y),
        });
      };

      for (let y = 0; y < this.rows; y++) {
        let run = [];
        for (let x = 0; x <= this.cols; x++) {
          const c = x < this.cols ? this.colorAt(x, y) : 0;
          const prev = run.length ? this.colorAt(run[0].x, run[0].y) : 0;
          if (c > 0 && c === prev) run.push({ x, y });
          else {
            addGroup(run, "h");
            run = c > 0 ? [{ x, y }] : [];
          }
        }
      }
      for (let x = 0; x < this.cols; x++) {
        let run = [];
        for (let y = 0; y <= this.rows; y++) {
          const c = y < this.rows ? this.colorAt(x, y) : 0;
          const prev = run.length ? this.colorAt(run[0].x, run[0].y) : 0;
          if (c > 0 && c === prev) run.push({ x, y });
          else {
            addGroup(run, "v");
            run = c > 0 ? [{ x, y }] : [];
          }
        }
      }
      return groups;
    }

    /** Объединяет пересекающиеся группы одного цвета (L/T → бомба). */
    mergeGroups(groups) {
      const byCell = new Map();
      groups.forEach((g, i) => {
        g.cells.forEach((c) => {
          const k = key(c.x, c.y);
          if (!byCell.has(k)) byCell.set(k, []);
          byCell.get(k).push(i);
        });
      });
      const used = new Set();
      const merged = [];
      groups.forEach((g, i) => {
        if (used.has(i)) return;
        const stack = [i];
        const cells = new Map();
        const orient = new Set();
        while (stack.length) {
          const id = stack.pop();
          if (used.has(id)) continue;
          used.add(id);
          orient.add(groups[id].orientation);
          groups[id].cells.forEach((c) => {
            cells.set(key(c.x, c.y), c);
            const overlap = byCell.get(key(c.x, c.y)) || [];
            overlap.forEach((oid) => {
              if (!used.has(oid)) stack.push(oid);
            });
          });
        }
        merged.push({
          cells: [...cells.values()],
          orientation: orient.has("h") && orient.has("v") ? "cross" : orient.has("h") ? "h" : "v",
          length: cells.size,
          color: g.color,
        });
      });
      return merged;
    }

    pickBooster(group, swapCell) {
      const len = group.length;
      const ori = group.orientation;
      let special = SPECIAL.NONE;
      // Г/Т/крест → бомба; 5+ в линию → радуга; 4 → ракета
      if (ori === "cross") special = SPECIAL.BOMB;
      else if (len >= 5) special = SPECIAL.RAINBOW;
      else if (len === 4) special = ori === "v" ? SPECIAL.ROCKET_V : SPECIAL.ROCKET_H;
      if (special === SPECIAL.NONE) return null;

      let spot = swapCell && group.cells.some((c) => c.x === swapCell.x && c.y === swapCell.y)
        ? swapCell
        : group.cells[Math.floor(group.cells.length / 2)];
      return { x: spot.x, y: spot.y, special, color: group.color };
    }

    /** Уничтожить клетку (молоток): фишка, лёд или ящик. */
    smashAt(x, y) {
      const cleared = [];
      if (!this.isPlayable(x, y)) return cleared;
      if (this.blockers[x][y] === BLOCKER.CRATE) {
        this.blockers[x][y] = BLOCKER.NONE;
        cleared.push({ x, y, kind: "crate" });
        return cleared;
      }
      if (this.blockers[x][y] === BLOCKER.ICE) {
        this.blockers[x][y] = BLOCKER.NONE;
        cleared.push({ x, y, kind: "ice" });
      }
      if (this.gems[x][y] > 0) {
        const color = this.gems[x][y];
        this.gems[x][y] = 0;
        this.specials[x][y] = SPECIAL.NONE;
        cleared.push({ x, y, color });
      }
      return cleared;
    }

    collectBoosters(groups, swapCell) {
      const boosters = [];
      const rank = (s) => (s === SPECIAL.RAINBOW ? 4 : s === SPECIAL.BOMB ? 3 : s === SPECIAL.ROCKET_V || s === SPECIAL.ROCKET_H ? 2 : 0);
      groups.forEach((g) => {
        const b = this.pickBooster(g, swapCell);
        if (!b) return;
        const k = key(b.x, b.y);
        const prev = boosters.find((x) => key(x.x, x.y) === k);
        if (prev) {
          if (rank(b.special) > rank(prev.special)) {
            prev.special = b.special;
            prev.color = b.color;
          }
        } else {
          boosters.push(b);
        }
      });
      return boosters;
    }

    cellsInLine(x, y, special) {
      const out = [];
      if (special === SPECIAL.ROCKET_H) {
        for (let cx = 0; cx < this.cols; cx++) {
          if (this.isPlayable(cx, y)) out.push({ x: cx, y, color: this.colorAt(cx, y) });
        }
      } else if (special === SPECIAL.ROCKET_V) {
        for (let cy = 0; cy < this.rows; cy++) {
          if (this.isPlayable(x, cy)) out.push({ x, y: cy, color: this.colorAt(x, cy) });
        }
      }
      return out;
    }

    cellsInBomb(x, y, radius) {
      const out = [];
      const r = radius || 1;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const cx = x + dx;
          const cy = y + dy;
          if (!this.isPlayable(cx, cy)) continue;
          out.push({ x: cx, y: cy, color: this.colorAt(cx, cy) });
        }
      }
      return out;
    }

    cellsForColor(color) {
      const out = [];
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (this.colorAt(x, y) === color) out.push({ x, y, color });
        }
      }
      return out;
    }

    allGemCells() {
      const out = [];
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (this.hasGem(x, y)) out.push({ x, y, color: this.gems[x][y] });
        }
      }
      return out;
    }

    expandSpecial(x, y, otherColor) {
      const sp = this.specialAt(x, y);
      if (sp === SPECIAL.ROCKET_H || sp === SPECIAL.ROCKET_V) {
        const line = this.cellsInLine(x, y, sp);
        return line;
      }
      if (sp === SPECIAL.BOMB) return this.cellsInBomb(x, y, 1);
      if (sp === SPECIAL.RAINBOW) {
        const color = otherColor > 0 ? otherColor : this.colorAt(x, y);
        const out = color > 0 ? this.cellsForColor(color) : this.allGemCells();
        // сам шар радуги тоже должен исчезнуть после одного использования
        out.push({ x, y, color: this.colorAt(x, y) });
        return out;
      }
      return [{ x, y, color: this.colorAt(x, y) }];
    }

    /** Все клетки для удаления: совпадения + цепная активация бонусов. */
    cellsFromGroups(groups, swapCell) {
      const cells = [];
      const seen = new Set();
      const add = (c) => {
        const k = key(c.x, c.y);
        if (seen.has(k)) return;
        seen.add(k);
        cells.push({ x: c.x, y: c.y, color: c.color || this.colorAt(c.x, c.y) });
      };

      groups.forEach((g) => g.cells.forEach((c) => add(c)));

      const queue = cells.slice();
      while (queue.length) {
        const c = queue.shift();
        const sp = this.specialAt(c.x, c.y);
        if (!sp) continue;
        this.expandSpecial(c.x, c.y, c.color || 0).forEach((h) => {
          const k = key(h.x, h.y);
          if (seen.has(k)) return;
          seen.add(k);
          const cell = { x: h.x, y: h.y, color: h.color || this.colorAt(h.x, h.y) };
          cells.push(cell);
          queue.push(cell);
        });
      }
      return cells;
    }

    /** Комбо двух бонусов после обмена. */
    comboCells(a, b, ax, ay, bx, by) {
      const sa = this.specialAt(ax, ay);
      const sb = this.specialAt(bx, by);
      if (!sa && !sb) return [];

      if (sa === SPECIAL.RAINBOW && sb === SPECIAL.RAINBOW) return this.allGemCells();
      if (sa === SPECIAL.RAINBOW || sb === SPECIAL.RAINBOW) {
        const other = sa === SPECIAL.RAINBOW ? sb : sa;
        const ox = sa === SPECIAL.RAINBOW ? bx : ax;
        const oy = sa === SPECIAL.RAINBOW ? by : ay;
        const color = this.colorAt(ox, oy);
        if (other === SPECIAL.BOMB) {
          const hits = new Map();
          this.cellsForColor(color).forEach((c) => hits.set(key(c.x, c.y), c));
          this.cellsForColor(color).forEach((c) => {
            this.cellsInBomb(c.x, c.y, 1).forEach((h) => hits.set(key(h.x, h.y), h));
          });
          return [...hits.values()];
        }
        if (other === SPECIAL.ROCKET_H || other === SPECIAL.ROCKET_V) {
          const hits = new Map();
          this.cellsForColor(color).forEach((c) => {
            hits.set(key(c.x, c.y), c);
            this.cellsInLine(c.x, c.y, other).forEach((h) => hits.set(key(h.x, h.y), h));
          });
          return [...hits.values()];
        }
        return color > 0 ? this.cellsForColor(color) : this.allGemCells();
      }

      if ((sa === SPECIAL.ROCKET_H || sa === SPECIAL.ROCKET_V) && (sb === SPECIAL.ROCKET_H || sb === SPECIAL.ROCKET_V)) {
        const hits = new Map();
        this.cellsInLine(ax, ay, SPECIAL.ROCKET_H).concat(this.cellsInLine(ax, ay, SPECIAL.ROCKET_V))
          .concat(this.cellsInLine(bx, by, SPECIAL.ROCKET_H))
          .concat(this.cellsInLine(bx, by, SPECIAL.ROCKET_V))
          .forEach((c) => hits.set(key(c.x, c.y), c));
        return [...hits.values()];
      }

      if (sa === SPECIAL.BOMB && sb === SPECIAL.BOMB) {
        const hits = new Map();
        this.cellsInBomb(ax, ay, 2).concat(this.cellsInBomb(bx, by, 2)).forEach((c) => hits.set(key(c.x, c.y), c));
        return [...hits.values()];
      }

      const hits = new Map();
      this.expandSpecial(ax, ay, this.colorAt(bx, by)).forEach((c) => hits.set(key(c.x, c.y), c));
      this.expandSpecial(bx, by, this.colorAt(ax, ay)).forEach((c) => hits.set(key(c.x, c.y), c));
      return [...hits.values()];
    }

    activateSwap(ax, ay, bx, by) {
      const sa = this.specialAt(ax, ay);
      const sb = this.specialAt(bx, by);
      if (!sa && !sb) return [];
      let cells;
      if (sa && sb) cells = this.comboCells(sa, sb, ax, ay, bx, by);
      else if (sa) cells = this.expandSpecial(ax, ay, this.colorAt(bx, by));
      else cells = this.expandSpecial(bx, by, this.colorAt(ax, ay));
      // оба участника обмена всегда удаляются (радуга/ракета/бомба расходуются один раз)
      return this.uniqueCells(
        cells.concat([
          { x: ax, y: ay, color: this.colorAt(ax, ay) },
          { x: bx, y: by, color: this.colorAt(bx, by) },
        ])
      );
    }

    uniqueCells(list) {
      const m = new Map();
      list.forEach((c) => m.set(key(c.x, c.y), c));
      return [...m.values()];
    }

    damageAdjacentBlockers(cells) {
      const hit = new Set(cells.map((c) => key(c.x, c.y)));
      const cleared = [];
      const neighbors = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
      ];
      cells.forEach(({ x, y }) => {
        neighbors.forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (!this.isPlayable(nx, ny)) return;
          if (this.blockers[nx][ny] === BLOCKER.CRATE) {
            this.blockers[nx][ny] = BLOCKER.NONE;
            cleared.push({ x: nx, y: ny, kind: "crate" });
          }
        });
        if (hit.has(key(x, y)) && this.blockers[x][y] === BLOCKER.ICE) {
          this.blockers[x][y] = BLOCKER.NONE;
          cleared.push({ x, y, kind: "ice" });
        }
      });
      return cleared;
    }

    clearCells(cells, keep) {
      const keepKeys = new Set();
      const addKeep = (k) => {
        if (k && k.x != null) keepKeys.add(key(k.x, k.y));
      };
      if (Array.isArray(keep)) keep.forEach(addKeep);
      else addKeep(keep);
      cells.forEach(({ x, y }) => {
        if (keepKeys.has(key(x, y))) return;
        this.gems[x][y] = 0;
        this.specials[x][y] = SPECIAL.NONE;
      });
    }

    placeBooster(b) {
      if (!b || !this.isPlayable(b.x, b.y) || this.hasCrate(b.x, b.y)) return;
      this.gems[b.x][b.y] = b.color || this.randomColor();
      this.specials[b.x][b.y] = b.special;
    }

    swap(x1, y1, x2, y2) {
      const tg = this.gems[x1][y1];
      this.gems[x1][y1] = this.gems[x2][y2];
      this.gems[x2][y2] = tg;
      const ts = this.specials[x1][y1];
      this.specials[x1][y1] = this.specials[x2][y2];
      this.specials[x2][y2] = ts;
    }

    isAdjacent(a, b) {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
    }

    applyGravity() {
      const moves = [];
      for (let x = 0; x < this.cols; x++) {
        let dest = null;
        for (let y = this.rows - 1; y >= 0; y--) {
          if (!this.isPlayable(x, y) || this.hasCrate(x, y)) {
            dest = null;
            continue;
          }
          if (dest === null) dest = y;
          const color = this.gems[x][y];
          const special = this.specials[x][y];
          if (color > 0) {
            if (y !== dest) {
              this.gems[x][dest] = color;
              this.specials[x][dest] = special;
              this.gems[x][y] = 0;
              this.specials[x][y] = SPECIAL.NONE;
              moves.push({ fromX: x, fromY: y, toX: x, toY: dest, color, special });
            }
            let next = dest - 1;
            while (next >= 0 && (!this.isPlayable(x, next) || this.hasCrate(x, next))) next--;
            dest = next >= 0 ? next : null;
          }
        }
      }
      return moves;
    }

    fillFromTop() {
      const spawned = [];
      for (let x = 0; x < this.cols; x++) {
        let slot = 0;
        for (let y = 0; y < this.rows; y++) {
          if (!this.isPlayable(x, y) || this.hasCrate(x, y) || this.gems[x][y] > 0) continue;
          const color = this.fillColor(x, y);
          this.gems[x][y] = color;
          this.specials[x][y] = SPECIAL.NONE;
          spawned.push({ x, y, color, special: SPECIAL.NONE, fromY: -1 - slot });
          slot++;
        }
      }
      return spawned;
    }

    createsMatchAfterSwap(x1, y1, x2, y2) {
      this.swap(x1, y1, x2, y2);
      const ok = this.findMatchGroups().length > 0;
      this.swap(x1, y1, x2, y2);
      return ok;
    }

    hasPossibleMove() {
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (!this.hasGem(x, y)) continue;
          const sp = this.specialAt(x, y);
          if (x + 1 < this.cols && (this.hasGem(x + 1, y) || this.specialAt(x + 1, y))) {
            if (sp || this.specialAt(x + 1, y)) return true;
            if (this.createsMatchAfterSwap(x, y, x + 1, y)) return true;
          }
          if (y + 1 < this.rows && (this.hasGem(x, y + 1) || this.specialAt(x, y + 1))) {
            if (sp || this.specialAt(x, y + 1)) return true;
            if (this.createsMatchAfterSwap(x, y, x, y + 1)) return true;
          }
        }
      }
      return false;
    }

    shuffle() {
      const data = [];
      for (let x = 0; x < this.cols; x++) {
        for (let y = 0; y < this.rows; y++) {
          if (this.gems[x][y] > 0) data.push({ color: this.gems[x][y], special: this.specials[x][y] });
        }
      }
      for (let i = data.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data[i], data[j]] = [data[j], data[i]];
      }
      let i = 0;
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (this.gems[x][y] > 0) {
            this.gems[x][y] = data[i].color;
            this.specials[x][y] = data[i].special;
            i++;
          }
        }
      }
      if (this.findMatchGroups().length || !this.hasPossibleMove()) this.generateInitial();
    }
  }

  global.GemEngine = { Board, PLAYABLE, BLOCKED, SPECIAL, BLOCKER };
})(window);
