/*
 * 炸飞机 (Bomb the Plane) - human vs computer engine
 * UMD module: works in browser (window.ZFJ) and Node (module.exports).
 *
 * The computer's defense is NOT a pre-arranged hidden board. It is a dynamic
 * adapter that always answers consistently with a valid 3-plane placement and
 * greedily prefers "empty" over "body" over "head" (宁可先报空，后报身，最后才报头),
 * so it stays maximally ambiguous until constraints force it to reveal heads.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ZFJ = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BOARD = 10;
  var CELL_COUNT = BOARD * BOARD;
  var PLANE_COUNT = 3;

  // Canonical plane shape (head/nose at [0,0], pointing down), the classic
  // "士"-shaped 1:5:1:3 airplane: 1 nose + 5 wings + 1 body + 3 tail.
  var BASE_OFFSETS = [
    [0, 0],
    [1, -2], [1, -1], [1, 0], [1, 1], [1, 2],
    [2, 0],
    [3, -1], [3, 0], [3, 1]
  ];

  function rotateOffset(dr, dc, k) {
    var r = dr, c = dc;
    for (var i = 0; i < k; i++) {
      var nr = c;
      var nc = -r;
      r = nr;
      c = nc;
    }
    return [r, c];
  }

  function bit(idx) {
    return 1n << BigInt(idx);
  }

  function popcount(mask) {
    var count = 0;
    var m = mask;
    while (m !== 0n) {
      m &= (m - 1n);
      count++;
    }
    return count;
  }

  function indicesOf(mask) {
    var out = [];
    var m = mask;
    while (m !== 0n) {
      var b = m & (-m);
      out.push(b.toString(2).length - 1);
      m ^= b;
    }
    return out;
  }

  // Build every valid single-plane placement (head anchored, 4 orientations).
  function buildAllPlanes() {
    var planes = [];
    for (var k = 0; k < 4; k++) {
      var offs = [];
      for (var o = 0; o < BASE_OFFSETS.length; o++) {
        offs.push(rotateOffset(BASE_OFFSETS[o][0], BASE_OFFSETS[o][1], k));
      }
      for (var r = 0; r < BOARD; r++) {
        for (var c = 0; c < BOARD; c++) {
          var cells = [];
          var ok = true;
          for (var i = 0; i < offs.length; i++) {
            var rr = r + offs[i][0];
            var cc = c + offs[i][1];
            if (rr < 0 || rr >= BOARD || cc < 0 || cc >= BOARD) { ok = false; break; }
            cells.push(rr * BOARD + cc);
          }
          if (!ok) continue;

          var headIdx = r * BOARD + c;
          var cellsMask = 0n;
          var bodyMask = 0n;
          for (var j = 0; j < cells.length; j++) {
            var b = bit(cells[j]);
            cellsMask |= b;
            if (cells[j] !== headIdx) bodyMask |= b;
          }

          planes.push({
            k: k,
            headR: r,
            headC: c,
            headIdx: headIdx,
            cells: cells,
            cellsMask: cellsMask,
            bodyMask: bodyMask,
            headMask: bit(headIdx)
          });
        }
      }
    }
    return planes;
  }

  var ALL_PLANES = buildAllPlanes();

  // Fast lookup: key "r,c,k" -> plane (or undefined).
  var PLANE_BY_KEY = {};
  for (var i = 0; i < ALL_PLANES.length; i++) {
    var p = ALL_PLANES[i];
    PLANE_BY_KEY[p.headR + ',' + p.headC + ',' + p.k] = p;
  }

  var PLANES_BY_K = [[], [], [], []];
  for (var q = 0; q < ALL_PLANES.length; q++) {
    PLANES_BY_K[ALL_PLANES[q].k].push(ALL_PLANES[q]);
  }

  // Density: how many single-plane placements cover each cell (hunt heuristic).
  var DENSITY = (function () {
    var d = new Array(CELL_COUNT).fill(0);
    for (var q = 0; q < ALL_PLANES.length; q++) {
      var p = ALL_PLANES[q];
      for (var w = 0; w < p.cells.length; w++) d[p.cells[w]]++;
    }
    return d;
  })();

  function planeAt(headR, headC, k) {
    return PLANE_BY_KEY[headR + ',' + headC + ',' + k] || null;
  }

  // Does there exist a valid placement of exactly 3 non-overlapping planes
  // satisfying the given per-cell constraints (empty/body/head masks)?
  function existsConsistent(allPlanes, emptyMask, bodyMask, headMask) {
    allPlanes = allPlanes || ALL_PLANES;
    var headIdxs = indicesOf(headMask);
    if (headIdxs.length > PLANE_COUNT) return false;

    // Filter planes compatible with the fixed constraints.
    var comp = [];
    for (var i = 0; i < allPlanes.length; i++) {
      var p = allPlanes[i];
      if ((p.cellsMask & emptyMask) !== 0n) continue;
      if ((p.bodyMask & headMask) !== 0n) continue;
      if ((p.headMask & bodyMask) !== 0n) continue;
      comp.push(p);
    }

    var headCands = [];
    for (var h = 0; h < headIdxs.length; h++) {
      var hd = headIdxs[h];
      var cands = [];
      for (var a = 0; a < comp.length; a++) {
        if (comp[a].headIdx === hd) cands.push(comp[a]);
      }
      if (cands.length === 0) return false;
      headCands.push(cands);
    }

    var free = [];
    for (var b = 0; b < comp.length; b++) {
      if ((comp[b].headMask & headMask) === 0n) free.push(comp[b]);
    }

    function overlapsAny(p, list) {
      for (var i = 0; i < list.length; i++) {
        if ((p.cellsMask & list[i].cellsMask) !== 0n) return true;
      }
      return false;
    }

    function coversBodies(list) {
      var m = 0n;
      for (var i = 0; i < list.length; i++) m |= list[i].bodyMask;
      return (m & bodyMask) === bodyMask;
    }

    function recHead(i, chosen) {
      if (i === headCands.length) return recFree(0, chosen);
      var cands = headCands[i];
      for (var j = 0; j < cands.length; j++) {
        var p = cands[j];
        if (overlapsAny(p, chosen)) continue;
        chosen.push(p);
        if (recHead(i + 1, chosen)) return true;
        chosen.pop();
      }
      return false;
    }

    function recFree(start, chosen) {
      var need = PLANE_COUNT - chosen.length;
      if (need === 0) return coversBodies(chosen);
      if (free.length - start < need) return false;
      for (var j = start; j < free.length; j++) {
        var p = free[j];
        if (overlapsAny(p, chosen)) continue;
        chosen.push(p);
        if (recFree(j + 1, chosen)) return true;
        chosen.pop();
      }
      return false;
    }

    return recHead(0, []);
  }

  // Dynamic defense adapter (the computer's "board").
  function Adapter() {
    this.allPlanes = ALL_PLANES;
    this.emptyMask = 0n;
    this.bodyMask = 0n;
    this.headMask = 0n;
    this.headsRevealed = 0;
    this.bombed = 0;
  }

  Adapter.prototype.answer = function (cellIdx) {
    var b = bit(cellIdx);
    if (existsConsistent(this.allPlanes, this.emptyMask | b, this.bodyMask, this.headMask)) {
      this.emptyMask |= b;
      this.bombed++;
      return 'E';
    }
    if (existsConsistent(this.allPlanes, this.emptyMask, this.bodyMask | b, this.headMask)) {
      this.bodyMask |= b;
      this.bombed++;
      return 'B';
    }
    // Forced head.
    this.headMask |= b;
    this.headsRevealed++;
    this.bombed++;
    return 'H';
  };

  // Feedback-only attack AI. It never reads the player's real planes: it only
  // uses the feedback (miss/body/head) it has earned, plus the public plane
  // geometry, to hunt for planes and then target their heads.
  function PlayerBoardAI(difficulty) {
    this.difficulty = difficulty || 'normal';
    this.result = {};
    this.bombed = {};
    this.missMask = 0n;
    this.bodyMask = 0n;
    this.headMask = 0n;
    this.pendingHits = []; // body-hit cells not yet attributed to a killed plane
    this.candidates = [];  // candidate head cells (target mode)
    this.mode = 'hunt';
    this.headsHit = 0;
    this.lastResult = null;
  }

  // Record the referee's result for a cell the AI just bombed.
  PlayerBoardAI.prototype.observe = function (cellIdx, result) {
    this.result[cellIdx] = result;
    this.bombed[cellIdx] = true;
    this.lastResult = result;
    var b = bit(cellIdx);
    if (result === 'E') {
      this.missMask |= b;
    } else if (result === 'B') {
      this.bodyMask |= b;
      this.pendingHits.push(cellIdx);
    } else if (result === 'H') {
      this.headMask |= b;
      this.headsHit++;
      this._clearKilledPlane(cellIdx);
    }
    this._recompute();
  };

  // When a head is hit, infer the plane's orientation (most body hits covered
  // while staying consistent with misses) and drop its body hits so targeting
  // does not waste bombs on a plane that is already destroyed.
  PlayerBoardAI.prototype._clearKilledPlane = function (headIdx) {
    var r = Math.floor(headIdx / BOARD);
    var c = headIdx % BOARD;
    var bestPlane = null;
    var bestCover = -1;
    for (var k = 0; k < 4; k++) {
      var p = planeAt(r, c, k);
      if (!p) continue;
      if ((p.cellsMask & this.missMask) !== 0n) continue;
      var cover = 0;
      for (var i = 0; i < this.pendingHits.length; i++) {
        if ((p.bodyMask & bit(this.pendingHits[i])) !== 0n) cover++;
      }
      if (cover > bestCover) { bestCover = cover; bestPlane = p; }
    }
    if (bestPlane) {
      var keep = [];
      for (var j = 0; j < this.pendingHits.length; j++) {
        if ((bestPlane.bodyMask & bit(this.pendingHits[j])) === 0n) keep.push(this.pendingHits[j]);
      }
      this.pendingHits = keep;
    }
  };

  PlayerBoardAI.prototype._recompute = function () {
    var votes = {};
    for (var i = 0; i < this.pendingHits.length; i++) {
      var hib = bit(this.pendingHits[i]);
      for (var k = 0; k < 4; k++) {
        var list = PLANES_BY_K[k];
        for (var j = 0; j < list.length; j++) {
          var p = list[j];
          if ((p.bodyMask & hib) === 0n) continue;      // must cover this hit as body
          if (this.bombed[p.headIdx]) continue;          // head already decided
          if ((p.cellsMask & this.missMask) !== 0n) continue; // no overlap with misses
          if ((p.bodyMask & this.headMask) !== 0n) continue;  // body can't sit on a known head
          votes[p.headIdx] = (votes[p.headIdx] || 0) + 1;
        }
      }
    }
    var arr = [];
    for (var key in votes) {
      if (Object.prototype.hasOwnProperty.call(votes, key)) {
        arr.push({ idx: Number(key), v: votes[key] });
      }
    }
    arr.sort(function (a, b) { return b.v - a.v; });
    this.candidates = arr.map(function (x) { return x.idx; });
    this.mode = this.candidates.length ? 'target' : 'hunt';
  };

  PlayerBoardAI.prototype._hunt = function () {
    if (this.difficulty === 'easy') {
      var pool = [];
      for (var i = 0; i < CELL_COUNT; i++) {
        if (!this.bombed[i]) pool.push(i);
      }
      return pool[Math.floor(Math.random() * pool.length)];
    }
    var best = [];
    var maxD = -1;
    for (var i = 0; i < CELL_COUNT; i++) {
      if (this.bombed[i]) continue;
      var d = DENSITY[i];
      if (d > maxD) { maxD = d; best = [i]; }
      else if (d === maxD) { best.push(i); }
    }
    return best[Math.floor(Math.random() * best.length)];
  };

  PlayerBoardAI.prototype.choose = function () {
    if (this.mode === 'target' && this.candidates.length) {
      if (this.difficulty === 'easy' && this.candidates.length > 1 && Math.random() < 0.4) {
        var pool = this.candidates.slice(0, Math.min(this.candidates.length, 4));
        return pool[Math.floor(Math.random() * pool.length)];
      }
      return this.candidates[0];
    }
    return this._hunt();
  };

  // Referee: actual result for bombing a cell on a static 3-plane board.
  function resultForBoard(cellIdx, planes) {
    var b = bit(cellIdx);
    for (var i = 0; i < planes.length; i++) {
      if ((planes[i].headMask & b) !== 0n) return 'H';
      if ((planes[i].bodyMask & b) !== 0n) return 'B';
    }
    return 'E';
  }

  // Generate a random valid 3-plane layout (used for layout defaults/shuffle).
  function randomLayout(rng) {
    rng = rng || Math.random;
    // Prefer head positions in the central 6x6 zone, where every plane can
    // rotate to at least two directions. Fall back to the full board if the
    // central zone somehow cannot hold three planes.
    var zone = [];
    for (var i = 0; i < ALL_PLANES.length; i++) {
      var p = ALL_PLANES[i];
      if (p.headR >= 2 && p.headR <= 7 && p.headC >= 2 && p.headC <= 7) zone.push(p);
    }
    var chosen = pickNonOverlapping(zone, rng);
    if (chosen.length < PLANE_COUNT) chosen = pickNonOverlapping(ALL_PLANES, rng);
    return chosen;
  }

  function pickNonOverlapping(pool, rng) {
    var arr = pool.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    var chosen = [];
    for (var a = 0; a < arr.length; a++) {
      var ok = true;
      for (var b = 0; b < chosen.length; b++) {
        if ((arr[a].cellsMask & chosen[b].cellsMask) !== 0n) { ok = false; break; }
      }
      if (ok) {
        chosen.push(arr[a]);
        if (chosen.length === PLANE_COUNT) break;
      }
    }
    return chosen;
  }

  // Attempt to move plane at index pi by (dr, dc); returns new planes or null.
  // Editing is free: only the board edge is enforced here; overlap is validated
  // separately when the layout is confirmed.
  function movePlane(planes, pi, dr, dc) {
    var p = planes[pi];
    var next = planeAt(p.headR + dr, p.headC + dc, p.k);
    if (!next) return null;
    var copy = planes.slice();
    copy[pi] = next;
    return copy;
  }

  // Attempt to rotate plane at index pi clockwise; returns new planes or null.
  function rotatePlane(planes, pi) {
    var p = planes[pi];
    // Cycle clockwise through the other three orientations and take the first
    // one that fits on the board.
    for (var step = 1; step <= 3; step++) {
      var next = planeAt(p.headR, p.headC, (p.k + step) % 4);
      if (!next) continue;
      var copy = planes.slice();
      copy[pi] = next;
      return copy;
    }
    return null;
  }

  // True when any two planes share a cell.
  function hasOverlap(planes) {
    for (var i = 0; i < planes.length; i++) {
      for (var j = i + 1; j < planes.length; j++) {
        if ((planes[i].cellsMask & planes[j].cellsMask) !== 0n) return true;
      }
    }
    return false;
  }

  return {
    BOARD: BOARD,
    CELL_COUNT: CELL_COUNT,
    PLANE_COUNT: PLANE_COUNT,
    ALL_PLANES: ALL_PLANES,
    bit: bit,
    popcount: popcount,
    existsConsistent: existsConsistent,
    Adapter: Adapter,
    PlayerBoardAI: PlayerBoardAI,
    resultForBoard: resultForBoard,
    randomLayout: randomLayout,
    movePlane: movePlane,
    rotatePlane: rotatePlane,
    hasOverlap: hasOverlap
  };
});
