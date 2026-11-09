// Browser-compatible port of one SeqSeg trace. Arrays are flat, indexed x + nx*(y + ny*z).
const PLAN = { patch: [10, 12, 12], spacing: [0.5, 0.3515625, 0.3515625], clip: [23, 742], mean: 282.50688063781877, std: 142.85545305074632 };
export const CONFIG = {
  ratio: 5.5,
  maxPercEnlarge: 0.33,
  addRadius: 0.3,
  magnRadius: 1,
  minRadius: 0.3,
  minRes: 5,
  stopRadius: 0.4,
  angleAllow: 135,
  maxStepsBranch: 100,
  maxMag: 1.3,
  addMag: 0.2,
};

// Resample along one axis. order 3 = cubic B-spline with edge padding; order 1 = linear.
function splineCoefs(line) {
  const pole = Math.sqrt(3) - 2,
    n = line.length,
    c = Float64Array.from(line, (v) => v * 6);
  let sum = c[0],
    zn = pole;
  for (let k = 1; k < Math.min(n, 28); k++) {
    sum += zn * c[k];
    zn *= pole;
  }
  c[0] = sum;
  for (let k = 1; k < n; k++) c[k] += pole * c[k - 1];
  c[n - 1] = (pole / (pole * pole - 1)) * (c[n - 1] + pole * c[n - 2]);
  for (let k = n - 2; k >= 0; k--) c[k] = pole * (c[k + 1] - c[k]);
  return c;
}
function resampleLine(src, m, order) {
  const n = src.length,
    f = n / m,
    out = new Float64Array(m);
  if (order === 1) {
    for (let i = 0; i < m; i++) {
      const x = Math.min(Math.max((i + 0.5) * f - 0.5, 0), n - 1),
        a = Math.floor(x),
        b = Math.min(a + 1, n - 1),
        t = x - a;
      out[i] = src[a] * (1 - t) + src[b] * t;
    }
    return out;
  }
  const pad = 12,
    padded = new Float64Array(n + 2 * pad);
  for (let i = 0; i < padded.length; i++) padded[i] = src[Math.min(Math.max(i - pad, 0), n - 1)];
  const c = splineCoefs(padded),
    L = c.length;
  for (let i = 0; i < m; i++) {
    const x = Math.min(Math.max((i + 0.5) * f - 0.5, 0), n - 1) + pad,
      a = Math.floor(x),
      t = x - a;
    const w = [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
    let v = 0;
    for (let k = -1; k <= 2; k++) v += w[k + 1] * c[Math.min(Math.max(a + k, 0), L - 1)];
    out[i] = v;
  }
  return out;
}
// dims are [nz, ny, nx]; memory order has x fastest.
function resample3d(data, dims, target, order) {
  let cur = data,
    d = dims.slice();
  for (const axis of [2, 1, 0]) {
    if (d[axis] === target[axis]) continue;
    const next = d.slice();
    next[axis] = target[axis];
    const out = new Float32Array(next[0] * next[1] * next[2]);
    const strideOf = (s) => (axis === 2 ? 1 : axis === 1 ? s[2] : s[1] * s[2]);
    const a = (axis + 1) % 3,
      b = (axis + 2) % 3,
      line = new Float64Array(d[axis]);
    const idx = (s, co) => co[0] * s[1] * s[2] + co[1] * s[2] + co[2];
    for (let i = 0; i < d[a]; i++)
      for (let j = 0; j < d[b]; j++) {
        const co = [0, 0, 0];
        co[a] = i;
        co[b] = j;
        co[axis] = 0;
        const b0 = idx(d, co),
          b1 = idx(next, co),
          s0 = strideOf(d),
          s1 = strideOf(next);
        for (let k = 0; k < d[axis]; k++) line[k] = cur[b0 + k * s0];
        const r = resampleLine(line, next[axis], order);
        for (let k = 0; k < next[axis]; k++) out[b1 + k * s1] = r[k];
      }
    cur = out;
    d = next;
  }
  return cur;
}
function tileStarts(size, patch) {
  if (size <= patch) return [0];
  const num = Math.ceil((size - patch) / (patch * 0.5)) + 1,
    actual = (size - patch) / (num - 1);
  return Array.from({ length: num }, (_, i) => Math.round(actual * i));
}
function gaussianPatch() {
  const [pz, py, px] = PLAN.patch,
    g = new Float32Array(pz * py * px);
  const axis = (p) => Array.from({ length: p }, (_, i) => Math.exp(-((i - (p >> 1)) ** 2) / (2 * (p / 8) ** 2)));
  const gz = axis(pz),
    gy = axis(py),
    gx = axis(px);
  let max = 0;
  for (let z = 0, n = 0; z < pz; z++)
    for (let y = 0; y < py; y++)
      for (let x = 0; x < px; x++, n++) {
        g[n] = gz[z] * gy[y] * gx[x];
        max = Math.max(max, g[n]);
      }
  return g.map((v) => (v / max) * 10);
}
const GAUSS = gaussianPatch();

// Equivalent of predictor.predict_single_npy_array: returns the probability of vessel on the input grid.
export async function predict(ort, session, img, dims, spacing, stats, batch = 32) {
  const t0 = performance.now();
  const norm = new Float32Array(img.length);
  for (let i = 0; i < img.length; i++) norm[i] = (Math.min(Math.max(img[i], PLAN.clip[0]), PLAN.clip[1]) - PLAN.mean) / PLAN.std;
  const shape = dims.map((d, a) => Math.round((spacing[a] / PLAN.spacing[a]) * d));
  const lo = norm.reduce((a, v) => Math.min(a, v), Infinity),
    hi = norm.reduce((a, v) => Math.max(a, v), -Infinity);
  const res = resample3d(norm, dims, shape, 3).map((v) => Math.min(Math.max(v, lo), hi));
  const [pz, py, px] = PLAN.patch;
  // Pad symmetrically when the volume is smaller than one patch.
  const size = shape.map((s, a) => Math.max(s, PLAN.patch[a])),
    off = size.map((s, a) => Math.floor((s - shape[a]) / 2));
  let vol = res;
  if (size.some((s, a) => s !== shape[a])) {
    vol = new Float32Array(size[0] * size[1] * size[2]);
    for (let z = 0; z < shape[0]; z++)
      for (let y = 0; y < shape[1]; y++)
        for (let x = 0; x < shape[2]; x++) vol[x + off[2] + size[2] * (y + off[1] + size[1] * (z + off[0]))] = res[x + shape[2] * (y + shape[1] * z)];
  }
  const tiles = [];
  for (const z of tileStarts(size[0], pz)) for (const y of tileStarts(size[1], py)) for (const x of tileStarts(size[2], px)) tiles.push([z, y, x]);
  const flips = [];
  for (let f = 0; f < 8; f++) flips.push([f & 1, (f >> 1) & 1, (f >> 2) & 1]);
  const jobs = tiles.flatMap((t) => flips.map((f) => [t, f]));
  const pn = pz * py * px,
    sum = new Float32Array(vol.length),
    weight = new Float32Array(vol.length);
  const t1 = performance.now();
  for (let b = 0; b < jobs.length; b += batch) {
    const part = jobs.slice(b, b + batch),
      input = new Float32Array(part.length * pn);
    part.forEach(([[tz, ty, tx], [fz, fy, fx]], j) => {
      let n = j * pn;
      for (let z = 0; z < pz; z++)
        for (let y = 0; y < py; y++)
          for (let x = 0; x < px; x++, n++) {
            input[n] = vol[tx + (fx ? px - 1 - x : x) + size[2] * (ty + (fy ? py - 1 - y : y) + size[1] * (tz + (fz ? pz - 1 - z : z)))];
          }
    });
    const y = (await session.run({ x: new ort.Tensor("float32", input, [part.length, 1, pz, py, px]) })).y,
      out = y.data ?? (await y.getData());
    part.forEach(([[tz, ty, tx], [fz, fy, fx]], j) => {
      for (let z = 0, n = 0; z < pz; z++)
        for (let yy = 0; yy < py; yy++)
          for (let x = 0; x < px; x++, n++) {
            const lx = fx ? px - 1 - x : x,
              ly = fy ? py - 1 - yy : yy,
              lz = fz ? pz - 1 - z : z,
              g = GAUSS[lx + px * (ly + py * lz)];
            const v = tx + lx + size[2] * (ty + ly + size[1] * (tz + lz));
            const diff = out[(j * 2 + 1) * pn + n] - out[j * 2 * pn + n];
            sum[v] += (diff / 8) * g;
            if (fz + fy + fx === 0) weight[v] += g;
          }
    });
  }
  const t2 = performance.now();
  let logits = new Float32Array(shape[0] * shape[1] * shape[2]);
  for (let z = 0, n = 0; z < shape[0]; z++)
    for (let y = 0; y < shape[1]; y++)
      for (let x = 0; x < shape[2]; x++, n++) {
        const v = x + off[2] + size[2] * (y + off[1] + size[1] * (z + off[0]));
        logits[n] = sum[v] / weight[v];
      }
  logits = resample3d(logits, shape, dims, 1);
  const prob = logits.map((l) => 1 / (1 + Math.exp(-l)));
  if (stats) {
    stats.tiles = (stats.tiles ?? 0) + tiles.length;
    stats.pre = (stats.pre ?? 0) + t1 - t0;
    stats.net = (stats.net ?? 0) + t2 - t1;
    stats.post = (stats.post ?? 0) + performance.now() - t2;
  }
  return prob;
}

const rint = (v) => {
  const r = Math.round(v);
  return Math.abs(v % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
};
const sub = (a, b) => a.map((v, i) => v - b[i]);
const norm3 = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const n = norm3(a);
  return a.map((v) => v / n);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// 6-connected flood fill; returns labels and the component sizes.
function components(mask, [nx, ny, nz], conn26 = false) {
  const labels = new Int32Array(mask.length),
    sizes = [0],
    nb = [];
  for (let z = -1; z <= 1; z++)
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++) {
        const m = Math.abs(x) + Math.abs(y) + Math.abs(z);
        if (m && (conn26 || m === 1)) nb.push([x, y, z]);
      }
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = sizes.length,
      stack = [start];
    labels[start] = id;
    let count = 0;
    while (stack.length) {
      const v = stack.pop();
      count++;
      const z = Math.floor(v / (nx * ny)),
        y = Math.floor(v / nx) % ny,
        x = v % nx;
      for (const [a, b, c] of nb) {
        const X = x + a,
          Y = y + b,
          Z = z + c;
        if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
        const w = X + nx * (Y + ny * Z);
        if (mask[w] && !labels[w]) {
          labels[w] = id;
          stack.push(w);
        }
      }
    }
    sizes.push(count);
  }
  return { labels, sizes };
}
function edt1d(f, n, sp, out, v, zz) {
  const parabola = (q) => f[q] + (q * sp) ** 2;
  let k = 0;
  v[0] = 0;
  zz[0] = -Infinity;
  zz[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (parabola(q) - parabola(v[k])) / (2 * sp * sp * (q - v[k]));
    while (s <= zz[k]) {
      k--;
      s = (parabola(q) - parabola(v[k])) / (2 * sp * sp * (q - v[k]));
    }
    k++;
    v[k] = q;
    zz[k] = s;
    zz[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (zz[k + 1] < q) k++;
    out[q] = ((q - v[k]) * sp) ** 2 + f[v[k]];
  }
}
// Euclidean distance (physical units) from each foreground voxel to the nearest background voxel.
function distanceInside(mask, [nx, ny, nz], [sx, sy, sz]) {
  const d = new Float64Array(mask.length).map((_, i) => (mask[i] ? 1e20 : 0)),
    max = Math.max(nx, ny, nz);
  const f = new Float64Array(max),
    o = new Float64Array(max),
    v = new Int32Array(max),
    zz = new Float64Array(max + 1);
  const pass = (n, sp, at) => (a, b) => {
    for (let q = 0; q < n; q++) f[q] = d[at(q, a, b)];
    edt1d(f, n, sp, o, v, zz);
    for (let q = 0; q < n; q++) d[at(q, a, b)] = o[q];
  };
  let p = pass(nx, sx, (q, y, z) => q + nx * (y + ny * z));
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) p(y, z);
  p = pass(ny, sy, (q, x, z) => x + nx * (q + ny * z));
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) p(x, z);
  p = pass(nz, sz, (q, x, y) => x + nx * (y + ny * q));
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) p(x, y);
  return d.map((v) => Math.sqrt(Math.min(v, 1e12)));
}
// ITK's Maurer map: distance to the nearest boundary voxel of the mask, measured centre to centre.
function distanceToBoundary(mask, [nx, ny, nz], sp) {
  const inner = new Uint8Array(mask.length);
  for (let z = 0, v = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++, v++) {
        if (!mask[v]) continue;
        const boundary =
          (x > 0 && !mask[v - 1]) ||
          (x < nx - 1 && !mask[v + 1]) ||
          (y > 0 && !mask[v - nx]) ||
          (y < ny - 1 && !mask[v + nx]) ||
          (z > 0 && !mask[v - nx * ny]) ||
          (z < nz - 1 && !mask[v + nx * ny]);
        inner[v] = boundary ? 0 : 1;
      }
  return distanceInside(inner, [nx, ny, nz], sp);
}
// Least-cost paths inside the vessel, favouring its middle, from source to each target.
function centerlines(mask, dist, [nx, ny, nz], sp, source, targets) {
  const dmax = dist.reduce((a, b) => Math.max(a, b), 0),
    cost = new Float64Array(mask.length).fill(Infinity),
    prev = new Int32Array(mask.length).fill(-1);
  const heap = [[0, source]];
  cost[source] = 0;
  const push = (e) => {
    heap.push(e);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        let m = i;
        const l = 2 * i + 1,
          r = l + 1;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const nbs = [];
  for (let z = -1; z <= 1; z++)
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (x || y || z) nbs.push([x, y, z, Math.hypot(x * sp[0], y * sp[1], z * sp[2])]);
  while (heap.length) {
    const [c, v] = pop();
    if (c > cost[v]) continue;
    const z = Math.floor(v / (nx * ny)),
      y = Math.floor(v / nx) % ny,
      x = v % nx;
    for (const [a, b, e, len] of nbs) {
      const X = x + a,
        Y = y + b,
        Z = z + e;
      if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
      const w = X + nx * (Y + ny * Z);
      if (!mask[w]) continue;
      const speed = 0.01 + (0.99 * dist[w]) / dmax,
        nc = c + len / speed;
      if (nc < cost[w]) {
        cost[w] = nc;
        prev[w] = v;
        push([nc, w]);
      }
    }
  }
  return targets.map((t) => {
    if (prev[t] < 0 && t !== source) return null;
    const path = [];
    for (let v = t; v >= 0; v = prev[v]) path.push(v);
    return path.reverse();
  });
}
// Separable [1 2 1] blur, repeated, with edge clamping.
function blur(mask, [nx, ny, nz], passes = 2) {
  let cur = Float32Array.from(mask);
  const stride = [1, nx, nx * ny],
    dims = [nx, ny, nz];
  for (let p = 0; p < passes; p++)
    for (let axis = 0; axis < 3; axis++) {
      const out = new Float32Array(cur.length),
        st = stride[axis],
        n = dims[axis];
      for (let z = 0, v = 0; z < nz; z++)
        for (let y = 0; y < ny; y++)
          for (let x = 0; x < nx; x++, v++) {
            const i = axis === 0 ? x : axis === 1 ? y : z;
            out[v] = 0.25 * cur[i > 0 ? v - st : v] + 0.5 * cur[v] + 0.25 * cur[i < n - 1 ? v + st : v];
          }
      cur = out;
    }
  return cur;
}
// Nearest-neighbour upsampling so the smallest axis has at least 40 voxels, as SeqSeg does locally.
function upsampleMask(mask, [nx, ny, nz], sp) {
  const smallest = Math.min(nx, ny, nz);
  if (smallest >= 40) return { mask, size: [nx, ny, nz], spacing: sp };
  const divide = smallest / 40,
    size = [nx, ny, nz].map((n) => Math.trunc(n / divide)),
    out = new Uint8Array(size[0] * size[1] * size[2]);
  const at = (i, n) => Math.min(Math.round(i * divide), n - 1);
  for (let z = 0, v = 0; z < size[2]; z++)
    for (let y = 0; y < size[1]; y++) for (let x = 0; x < size[0]; x++, v++) out[v] = mask[at(x, nx) + nx * (at(y, ny) + ny * at(z, nz))];
  return { mask: out, size, spacing: sp.map((v) => v * divide) };
}
function smooth(points, passes = 3) {
  let p = points.map((q) => q.slice());
  for (let n = 0; n < passes; n++)
    p = p.map((q, i) => (i === 0 || i === p.length - 1 ? q : q.map((v, a) => (p[i - 1][a] + 2 * v + p[i + 1][a]) / 4)));
  return p;
}
// Physical <-> continuous index, using the image direction (flat 3x3, row order, orthonormal).
function toPhys(vol, idx) {
  const d = vol.direction,
    s = vol.spacing,
    o = vol.origin,
    a = idx[0] * s[0],
    b = idx[1] * s[1],
    c = idx[2] * s[2];
  return [o[0] + d[0] * a + d[1] * b + d[2] * c, o[1] + d[3] * a + d[4] * b + d[5] * c, o[2] + d[6] * a + d[7] * b + d[8] * c];
}
function toIndex(vol, p) {
  const d = vol.direction,
    s = vol.spacing,
    x = p[0] - vol.origin[0],
    y = p[1] - vol.origin[1],
    z = p[2] - vol.origin[2];
  return [(d[0] * x + d[3] * y + d[6] * z) / s[0], (d[1] * x + d[4] * y + d[7] * z) / s[1], (d[2] * x + d[5] * y + d[8] * z) / s[2]];
}
function mapToImage(point, radius, ratio, vol) {
  const { size, spacing } = vol;
  if (!Number.isFinite(radius) || radius <= 0 || !point.every(Number.isFinite)) throw new Error("invalid point or radius");
  let r = radius,
    sizeX,
    index,
    border = false;
  for (;;) {
    sizeX = spacing.map((s) => Math.ceil((ratio * r) / s));
    if (Math.min(...sizeX) >= CONFIG.minRes) break;
    r *= 1.05;
  }
  const centre = toIndex(vol, point);
  index = centre.map((c, a) => Math.round(c - ((ratio / 2) * r) / spacing[a]));
  for (let a = 0; a < 3; a++) {
    if (index[a] < 0 || index[a] + sizeX[a] > size[a]) {
      border = true;
      const end = Math.min(index[a] + sizeX[a], size[a]);
      index[a] = Math.max(index[a], 0);
      sizeX[a] = end - index[a];
    }
  }
  if (Math.min(...sizeX) < CONFIG.minRes) throw new Error("box outside image");
  return { sizeX, index, border };
}
function extract(vol, index, s) {
  const [nx, ny] = vol.size,
    out = new Float32Array(s[0] * s[1] * s[2]);
  for (let z = 0, n = 0; z < s[2]; z++)
    for (let y = 0; y < s[1]; y++) {
      const o = index[0] + nx * (y + index[1] + ny * (z + index[2]));
      out.set(vol.data.subarray(o, o + s[0]), n);
      n += s[0];
    }
  return out;
}

export async function trace(ort, session, vol, seeds, maxSteps, onStep) {
  const makeStep = (oldP, oldR, p, r) => ({ old: oldP, oldR, point: p, radius: r, tangent: unit(sub(p, oldP)) });
  const list = Array.isArray(seeds) ? seeds : [seeds];
  const initial = list.map((s) => makeStep(s.start, s.radius, s.direction, s.radius)),
    queue = [],
    steps = [],
    stats = {};
  const voxels = vol.size[0] * vol.size[1] * vol.size[2],
    sp = vol.spacing;
  const assembly = new Float32Array(voxels),
    weights = new Float32Array(voxels);
  let current = initial.shift(),
    branchStart = 0;
  while (current && steps.length < maxSteps) {
    const t0 = performance.now(),
      st = current,
      i = steps.length,
      fatal = (m) => {
        st.chances = 3;
        return new Error(m);
      };
    let next = null,
      reason = null,
      perc = 1,
      predicted = false;
    st.chances ??= 0;
    try {
      if (st.radius < CONFIG.stopRadius) throw fatal("radius below limit");
      if (steps.length - branchStart > CONFIG.maxStepsBranch) throw fatal("branch step limit");
      let mag = st.radius > 3 ? CONFIG.maxMag : 1,
        go = true,
        box,
        prob,
        bin;
      while (perc > CONFIG.maxPercEnlarge && go) {
        if (mag >= CONFIG.maxMag) {
          mag = 1;
          go = false;
        }
        box = mapToImage(st.point, st.radius * mag, CONFIG.ratio, vol);
        const img = extract(vol, box.index, box.sizeX);
        prob = await predict(ort, session, img, [box.sizeX[2], box.sizeX[1], box.sizeX[0]], [sp[2], sp[1], sp[0]], stats);
        bin = prob.map((p) => (p > 0.5 ? 1 : 0));
        perc = bin.reduce((a, b) => a + b, 0) / bin.length;
        mag += CONFIG.addMag;
        predicted = true;
      }
      const s = box.sizeX,
        [nx, ny, nz] = s,
        tn = performance.now();
      const { labels, sizes } = components(bin, s);
      // Keep the piece at the box centre (the step point), as SeqSeg's remove_other_vessels does.
      const c = s.map((v) => rint(v / 2)),
        lab = labels[Math.min(c[0], nx - 1) + nx * (Math.min(c[1], ny - 1) + ny * Math.min(c[2], nz - 1))];
      const keep = lab || sizes.indexOf(Math.max(...sizes.slice(1)));
      if (keep <= 0) throw new Error("empty prediction");
      const mask = labels.map((l) => (l === keep ? 1 : 0));
      const phys = (v) => {
        const z = Math.floor(v / (nx * ny)),
          y = Math.floor(v / nx) % ny,
          x = v % nx;
        return toPhys(vol, [box.index[0] + x, box.index[1] + y, box.index[2] + z]);
      };
      // ITK measures to boundary voxel centres, so its inside distance is one voxel less than a plain transform.
      const fine = upsampleMask(mask, s, sp),
        fs = fine.size,
        fsp = fine.spacing,
        maxSp = Math.max(...fsp);
      const dist = distanceToBoundary(fine.mask, fs, fsp);
      const physFine = (v) => {
        const z = Math.floor(v / (fs[0] * fs[1])),
          y = Math.floor(v / fs[0]) % fs[1],
          x = v % fs[0];
        return toPhys(vol, [box.index[0] + (x * fsp[0]) / sp[0], box.index[1] + (y * fsp[1]) / sp[1], box.index[2] + (z * fsp[2]) / sp[2]]);
      };
      const nearestFine = (p) => {
        let best = -1,
          bd = Infinity;
        for (let n = 0; n < fine.mask.length; n++)
          if (fine.mask[n]) {
            const q = physFine(n),
              d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
            if (d < bd) {
              bd = d;
              best = n;
            }
          }
        return best;
      };
      // Caps: where the vessel leaves the box.
      // SeqSeg finds caps on a smoothed surface, which drops thin spurs; smooth the mask the same way.
      const soft = blur(mask, s);
      const face = new Uint8Array(mask.length);
      for (let z = 0, n = 0; z < nz; z++)
        for (let y = 0; y < ny; y++)
          for (let x = 0; x < nx; x++, n++)
            if (soft[n] > 0.5 && (x === 0 || y === 0 || z === 0 || x === nx - 1 || y === ny - 1 || z === nz - 1)) face[n] = 1;
      const cl = components(face, s, true),
        caps = [];
      for (let id = 1; id < cl.sizes.length; id++) {
        let sum = [0, 0, 0];
        for (let n = 0; n < mask.length; n++)
          if (cl.labels[n] === id) {
            const p = phys(n);
            sum = sum.map((v, a) => v + p[a]);
          }
        caps.push({ centre: sum.map((v) => v / cl.sizes[id]) });
      }
      if (caps.length < 2 && i > 1) throw new Error("fewer than 2 caps");
      if (!caps.length) throw new Error("no caps");
      const prevN = steps.slice(Math.max(branchStart, i - 2));
      const ref = i === 0 ? st.old : (prevN[0] ?? st).old;
      let source, targets;
      if (i <= 1 && caps.length === 1) {
        source = nearestFine(st.point);
        targets = [nearestFine(caps[0].centre)];
      } else {
        let id = 0,
          bd = Infinity;
        caps.forEach((cap, k) => {
          const d = norm3(sub(cap.centre, ref));
          if (d < bd) {
            bd = d;
            id = k;
          }
        });
        source = nearestFine(caps[id].centre);
        targets = caps.filter((_, k) => k !== id).map((cap) => nearestFine(cap.centre));
      }
      const paths = centerlines(fine.mask, dist, fs, fsp, source, targets).filter(Boolean);
      const oldVec = unit(sub(st.point, st.old)),
        found = [];
      for (const path of paths) {
        if (path.length < 4) continue;
        const locs = smooth(path.map(physFine)),
          rads = path.map((v) => Math.max(dist[v], maxSp));
        const save = Math.floor((locs.length * 4) / 5),
          vec = unit(sub(locs[locs.length - 1], st.point));
        const angle = (180 / Math.PI) * Math.acos(Math.min(Math.max(dot(oldVec, vec), -1), 1));
        if (angle >= CONFIG.angleAllow) continue;
        let r = rads[save];
        if (st.oldR > r) r = (2 / 3) * r + (1 / 3) * st.oldR;
        r = Math.max(r, CONFIG.minRadius);
        const p = norm3(sub(st.point, locs[save])) > rads[save] / 4 ? locs[save] : st.point.map((v, a) => v + 0.5 * rads[save] * vec[a]);
        found.push({ p, r: (r + CONFIG.addRadius) * CONFIG.magnRadius, angle });
      }
      found.sort((a, b) => b.r - a.r);
      // Assembly: Gaussian-weighted average of the step probabilities.
      const ax = (n) => Array.from({ length: n }, (_, k) => (n === 1 ? 0 : -1 + (2 * k) / (n - 1)));
      const wx = ax(nx),
        wy = ax(ny),
        wz = ax(nz),
        [gx, gy] = vol.size;
      for (let z = 0, n = 0; z < nz; z++)
        for (let y = 0; y < ny; y++)
          for (let x = 0; x < nx; x++, n++) {
            const w = Math.exp(-0.5 * ((wx[x] ** 2 + wy[y] ** 2 + wz[z] ** 2) / 0.25));
            const g = box.index[0] + x + gx * (box.index[1] + y + gy * (box.index[2] + z));
            const c0 = weights[g];
            assembly[g] = c0 > 0 ? (w * prob[n] + c0 * assembly[g]) / (c0 + w) : prob[n];
            weights[g] += w;
          }
      stats.geo = (stats.geo ?? 0) + performance.now() - tn;
      steps.push(st);
      onStep?.({ i, point: st.point, radius: st.radius, size: s, caps: caps.length, branches: found.length, perc, ms: performance.now() - t0 });
      if (box.border) {
        const [gx0, gy0, gz0] = vol.size;
        for (let z = 0, n = 0; z < nz; z++)
          for (let y = 0; y < ny; y++)
            for (let x = 0; x < nx; x++, n++) {
              const X = box.index[0] + x,
                Y = box.index[1] + y,
                Z = box.index[2] + z;
              if (mask[n] && (X === 0 || Y === 0 || Z === 0 || X === gx0 - 1 || Y === gy0 - 1 || Z === gz0 - 1)) throw fatal("reached image border");
            }
      }
      if (found.length) {
        next = makeStep(st.point, st.radius, found[0].p, found[0].r);
        for (const f of found.slice(1)) queue.push(makeStep(st.point, st.radius, f.p, f.r));
      } else throw new Error("no next point");
    } catch (error) {
      reason = error.message;
    }
    if (reason) {
      if (st.chances < 3) {
        onStep?.({ i, stopped: `${reason}; retry ${st.chances + 1}` });
        if (predicted && perc > 0.33 && st.chances > 0) st.radius *= 1.2;
        st.point = st.point.map((v, a) => v + st.radius * st.tangent[a]);
        st.chances += 1;
        next = st;
      } else {
        onStep?.({ i, stopped: reason });
        queue.sort((a, b) => b.radius - a.radius);
        next = initial.shift() ?? queue.shift();
        branchStart = steps.length;
      }
    }
    current = next;
  }
  const seg = new Uint8Array(voxels);
  for (let n = 0; n < voxels; n++) seg[n] = assembly[n] >= 0.5 ? 1 : 0;
  // Keep only what connects to the traced path, as SeqSeg does.
  const { labels } = components(seg, vol.size),
    keepLabels = new Set();
  for (const st of steps) {
    const i = toIndex(vol, st.point).map(Math.round);
    if (i.some((v, a) => v < 0 || v >= vol.size[a])) continue;
    const l = labels[i[0] + vol.size[0] * (i[1] + vol.size[1] * i[2])];
    if (l) keepLabels.add(l);
  }
  for (let n = 0; n < voxels; n++) seg[n] = keepLabels.has(labels[n]) ? 1 : 0;
  return { steps, seg, assembly, stats };
}
