// A* over the cell grid, 8 directions, no corner cutting.
export function findPath(map, sx, sy, tx, ty, blocked = null) {
  const { W, H } = map;
  if (sx === tx && sy === ty) return [];
  if (!map.walkable(tx, ty)) return null;
  const N = W * H;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = []; // [f, idx]
  const push = (f, i) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last; let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1; let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
      }
    }
    return top;
  };
  const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const s = sy * W + sx, t = ty * W + tx;
  g[s] = 0; push(h(sx, sy), s);
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, i] = pop();
    if (i === t) break;
    if (closed[i]) continue;
    closed[i] = 1;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy, cost] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!map.walkable(nx, ny)) continue;
      if (dx && dy && (!map.walkable(x + dx, y) || !map.walkable(x, y + dy))) continue;
      const ni = ny * W + nx;
      if (blocked && blocked.has(ni) && ni !== t) continue;
      const ng = g[i] + cost;
      if (ng < g[ni]) { g[ni] = ng; from[ni] = i; push(ng + h(nx, ny), ni); }
    }
  }
  if (from[t] === -1) return null;
  const out = [];
  for (let i = t; i !== s; i = from[i]) out.push([i % W, (i / W) | 0]);
  return out.reverse();
}

// Nearest walkable cells to (tx,ty), in ring order. Used to spread a group across a click target.
export function nearbyWalkable(map, tx, ty, count, avoid = new Set()) {
  const out = [];
  const seen = new Set();
  const q = [[tx, ty]];
  seen.add(ty * map.W + tx);
  while (q.length && out.length < count) {
    const [x, y] = q.shift();
    if (map.walkable(x, y) && !avoid.has(y * map.W + x)) out.push([x, y]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy, k = ny * map.W + nx;
      if (map.inB(nx, ny) && !seen.has(k) && Math.abs(nx - tx) + Math.abs(ny - ty) < 12) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return out;
}
