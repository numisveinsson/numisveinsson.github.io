// CCTA quality metrics and scoring, ported from src/iqa_tool. No DOM use, so it also runs in Node.
// scripts/check_web_parity.py compares this file with the Python version on real cases.
// Volumes are { size, spacing, origin, direction, data } in LPS mm, indexed x + nx*(y + ny*z).

const AORTA = { erosion: 3, roi: 12, search: 25, recenter: 20, minBright: 120, fallback: 8, sigma: 1, depthTie: 0.01 };
const LUMEN = { ball: 0.7, percentile: 75, minRadius: 0.3 };
const CALCIUM_SD = 3;
const CALCIUM_BALL_MM = 1.5; // fixed, so the result does not depend on how radius was estimated
const FAT_RANGE = [-190, -30];
const FAT_SHELL = [1, 3];
const FAT = { snap: 3, roi: 5, erosion: 1, minVoxels: 30 };
const MIN_PATH_FRACTION = 0.3;
const DIP = { ratio: 0.7, minMm: 2, windowMm: 15, guardMm: 3 };
const SEPARATION_MM = 2;
const MAX_LEFT_MAIN_MM = 40;
const MIN_BRANCH_MM = 20;
const MAX_OSTIUM_GAP_MM = 8;
const MIN_REACH_RATIO = 0.25; // CAS-X vessels never fall below 0.33, so lower means a looping trace
const MIN_REACH_LENGTH_MM = 30;

// Provisional: from published CCTA norms and CAS-X, not from reader-scored quality.
export const SCORE = {
  aortaHu: [250, 350],
  aortaSnr: [6, 12],
  cnr: { proximal: [8, 13], mid: [6, 10], distal: [3, 6] },
  ratio: { proximal: [0.6, 0.85], mid: [0.4, 0.6], distal: [0.15, 0.3] },
  weights: { proximal: 0.4, mid: 0.35, distal: 0.25 },
  dipPenalty: 10,
  maxDipPenalty: 30,
  pass: 70,
  review: 50,
};
const MAIN_VESSELS = ["LAD", "LCx", "RCA"];

export class InvalidImage extends Error {}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function sorted(values) {
  return Float64Array.from(values).sort();
}

// Linear interpolation between ranks, as numpy.percentile does.
export function percentile(values, q) {
  const s = sorted(values);
  if (!s.length) return NaN;
  const at = (q / 100) * (s.length - 1);
  const low = Math.floor(at);
  const high = Math.min(low + 1, s.length - 1);
  return s[low] + (s[high] - s[low]) * (at - low);
}

const median = (values) => percentile(values, 50);

export function toIndex(vol, p) {
  const { direction: d, spacing: s, origin: o } = vol;
  const x = p[0] - o[0];
  const y = p[1] - o[1];
  const z = p[2] - o[2];
  return [(d[0] * x + d[3] * y + d[6] * z) / s[0], (d[1] * x + d[4] * y + d[7] * z) / s[1], (d[2] * x + d[5] * y + d[8] * z) / s[2]];
}

function toWorld(vol, idx) {
  const { direction: d, spacing: s, origin: o } = vol;
  const a = idx[0] * s[0];
  const b = idx[1] * s[1];
  const c = idx[2] * s[2];
  return [o[0] + d[0] * a + d[1] * b + d[2] * c, o[1] + d[3] * a + d[4] * b + d[5] * c, o[2] + d[6] * a + d[7] * b + d[8] * c];
}

// Flat indices of voxels within a ball, or a shell when inner > 0.
function ball(vol, center, radius, inner = 0) {
  const c = toIndex(vol, center);
  const { size, spacing } = vol;
  const low = [0, 1, 2].map((a) => Math.max(Math.floor(c[a]) - Math.ceil(radius / spacing[a]), 0));
  const high = [0, 1, 2].map((a) => Math.min(Math.ceil(c[a]) + Math.ceil(radius / spacing[a]) + 1, size[a]));
  const out = [];
  for (let z = low[2]; z < high[2]; z++) {
    for (let y = low[1]; y < high[1]; y++) {
      for (let x = low[0]; x < high[0]; x++) {
        const d2 = ((x - c[0]) * spacing[0]) ** 2 + ((y - c[1]) * spacing[1]) ** 2 + ((z - c[2]) * spacing[2]) ** 2;
        if (d2 <= radius * radius && d2 >= inner * inner) out.push(x + size[0] * (y + size[1] * z));
      }
    }
  }
  return out;
}

const pick = (vol, indices) => indices.map((i) => vol.data[i]);

export function checkImage(vol, maxBlank = 0.1) {
  const { data, size } = vol;
  const perSlice = size[0] * size[1];
  let lowest = Infinity;
  let blank = 0;
  for (let z = 0; z < size[2]; z++) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = z * perSlice, end = i + perSlice; i < end; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    if (min === max) blank += 1;
    if (min < lowest) lowest = min;
  }
  if (lowest >= 0) throw new InvalidImage("Image has no negative values, so it does not appear to be in HU.");
  const fraction = blank / size[2];
  if (fraction > maxBlank) throw new InvalidImage(`${Math.round(fraction * 100)}% of slices are blank, so the file may be corrupt or incomplete.`);
}

function cropBox(vol, indices) {
  const [nx, ny] = vol.size;
  const low = [Infinity, Infinity, Infinity];
  const high = [-1, -1, -1];
  for (const n of indices) {
    const z = Math.floor(n / (nx * ny));
    const y = Math.floor((n - z * nx * ny) / nx);
    const x = n - nx * (y + ny * z);
    [x, y, z].forEach((v, a) => {
      if (v < low[a]) low[a] = v;
      if (v > high[a]) high[a] = v;
    });
  }
  const dims = [0, 1, 2].map((a) => high[a] - low[a] + 1);
  const data = new Float32Array(dims[0] * dims[1] * dims[2]);
  for (let z = 0, n = 0; z < dims[2]; z++) {
    for (let y = 0; y < dims[1]; y++) {
      const offset = low[0] + nx * (y + low[1] + ny * (z + low[2]));
      data.set(vol.data.subarray(offset, offset + dims[0]), n);
      n += dims[0];
    }
  }
  return { data, dims, low };
}

// Separable Gaussian with reflected edges, sized in voxels as scipy's gaussian_filter is.
function gaussian(data, dims, sigma) {
  const reach = Math.round(4 * sigma);
  const kernel = [];
  for (let i = -reach; i <= reach; i++) kernel.push(Math.exp(-0.5 * (i / sigma) ** 2));
  const sum = kernel.reduce((a, b) => a + b, 0);
  const weights = kernel.map((v) => v / sum);
  const strides = [1, dims[0], dims[0] * dims[1]];
  let source = data;
  for (let axis = 0; axis < 3; axis++) {
    const out = new Float32Array(source.length);
    const n = dims[axis];
    const stride = strides[axis];
    const reflect = (i) => {
      const period = 2 * n;
      const m = ((i % period) + period) % period;
      return m < n ? m : period - 1 - m;
    };
    for (let i = 0; i < source.length; i++) {
      const position = Math.floor(i / stride) % n;
      const base = i - position * stride;
      let value = 0;
      for (let k = -reach; k <= reach; k++) value += weights[k + reach] * source[base + reflect(position + k) * stride];
      out[i] = value;
    }
    source = out;
  }
  return source;
}

// Distance in mm from each foreground voxel to the nearest background voxel.
function depthInside(mask, dims, spacing) {
  const [nx, ny, nz] = dims;
  const n = nx * ny * nz;
  const squared = new Float64Array(n);
  for (let i = 0; i < n; i++) squared[i] = mask[i] ? Infinity : 0;
  const strides = [1, nx, nx * ny];
  dims.forEach((length, axis) => {
    const stride = strides[axis];
    const step = spacing[axis] * spacing[axis];
    const line = new Float64Array(length);
    const result = new Float64Array(length);
    const hull = new Int32Array(length);
    const edges = new Float64Array(length + 1);
    for (let i = 0; i < n; i++) {
      if (Math.floor(i / stride) % length !== 0) continue;
      for (let k = 0; k < length; k++) line[k] = squared[i + k * stride];
      let top = -1;
      for (let q = 0; q < length; q++) {
        if (line[q] === Infinity) continue;
        let s = -Infinity;
        while (top >= 0) {
          const p = hull[top];
          s = (line[q] + step * q * q - (line[p] + step * p * p)) / (2 * step * (q - p));
          if (s > edges[top]) break;
          top -= 1;
        }
        top += 1;
        hull[top] = q;
        edges[top] = top === 0 ? -Infinity : s;
      }
      if (top < 0) continue;
      for (let q = 0, k = 0; q < length; q++) {
        while (k < top && edges[k + 1] < q) k += 1;
        result[q] = line[hull[k]] + step * (q - hull[k]) ** 2;
      }
      for (let k = 0; k < length; k++) squared[i + k * stride] = result[k];
    }
  });
  const depth = new Float32Array(n);
  for (let i = 0; i < n; i++) depth[i] = mask[i] ? Math.sqrt(squared[i]) : 0;
  return depth;
}

export function recenterOnLumen(vol, seed) {
  const indices = ball(vol, seed, AORTA.recenter);
  if (!indices.length) return [...seed];
  const { data, dims, low } = cropBox(vol, indices);
  const smooth = gaussian(data, dims, AORTA.sigma);
  const [nx, ny] = vol.size;
  const toCrop = (n) => {
    const z = Math.floor(n / (nx * ny));
    const y = Math.floor((n - z * nx * ny) / nx);
    const x = n - nx * (y + ny * z);
    return x - low[0] + dims[0] * (y - low[1] + dims[1] * (z - low[2]));
  };
  const cropIndices = indices.map(toCrop);
  const level = Math.max(AORTA.minBright, 0.6 * percentile(cropIndices.map((i) => smooth[i]), 98));
  const box = new Uint8Array(smooth.length);
  let any = false;
  for (const i of cropIndices) {
    if (smooth[i] > level) {
      box[i] = 1;
      any = true;
    }
  }
  if (!any) return [...seed];
  const depth = depthInside(box, dims, vol.spacing);
  const deepest = depth.reduce((a, b) => Math.max(a, b), 0);
  // Several voxels often share the greatest depth. Taking the one nearest the seed keeps
  // the result independent of scan order, and so identical to the Python version.
  let best = null;
  let bestDistance = Infinity;
  for (let i = 0; i < depth.length; i++) {
    if (depth[i] < deepest - AORTA.depthTie) continue;
    const z = Math.floor(i / (dims[0] * dims[1]));
    const y = Math.floor((i - z * dims[0] * dims[1]) / dims[0]);
    const world = toWorld(vol, [i - dims[0] * (y + dims[1] * z) + low[0], y + low[1], z + low[2]]);
    const d = dist(world, seed);
    if (d < bestDistance) {
      bestDistance = d;
      best = world;
    }
  }
  return best;
}

// voxels (flat indices of the ROI) and center (the recentred point) are for display only.
function roiStats(vol, voxels, voxelMl, source, seed) {
  const values = pick(vol, voxels);
  const center = median(values);
  // The median absolute deviation resists valve leaflets and streaks that would inflate a plain SD.
  const sd = 1.4826 * median(values.map((v) => Math.abs(v - center)));
  const stats = { median_hu: center, noise_sd: sd, snr: sd ? center / sd : NaN, roi_ml: values.length * voxelMl, source };
  Object.defineProperties(stats, { voxels: { value: voxels }, center: { value: seed } });
  return stats;
}

export function aortaMetrics(vol, rawSeed) {
  const voxelMl = (vol.spacing[0] * vol.spacing[1] * vol.spacing[2]) / 1000;
  const seed = recenterOnLumen(vol, rawSeed);
  const indices = ball(vol, seed, AORTA.search);
  if (!indices.length) throw new InvalidImage("The aortic point is outside the image.");
  const { data, dims, low } = cropBox(vol, indices);
  const smooth = gaussian(data, dims, AORTA.sigma);
  const level = 0.6 * median(pick(vol, ball(vol, seed, 5)));
  const c = toIndex(vol, seed).map((v, a) => v - low[a]);
  const start = c.map((v) => Math.trunc(v));
  const [nx, ny, nz] = dims;
  const grown = new Uint8Array(smooth.length);
  const first = start[0] + nx * (start[1] + ny * start[2]);
  if (first >= 0 && first < smooth.length && smooth[first] >= level) {
    grown[first] = 1;
    const stack = [first];
    const visit = (i) => {
      if (!grown[i] && smooth[i] >= level) {
        grown[i] = 1;
        stack.push(i);
      }
    };
    while (stack.length) {
      const i = stack.pop();
      const z = Math.floor(i / (nx * ny));
      const y = Math.floor((i - z * nx * ny) / nx);
      const x = i - nx * (y + ny * z);
      if (x > 0) visit(i - 1);
      if (x < nx - 1) visit(i + 1);
      if (y > 0) visit(i - nx);
      if (y < ny - 1) visit(i + nx);
      if (z > 0) visit(i - nx * ny);
      if (z < nz - 1) visit(i + nx * ny);
    }
  }
  const depth = depthInside(grown, dims, vol.spacing);
  const select = (minDepth) => {
    const values = [];
    for (let z = 0, i = 0; z < nz; z++) {
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++, i++) {
          if (depth[i] < minDepth) continue;
          const d2 = ((x - c[0]) * vol.spacing[0]) ** 2 + ((y - c[1]) * vol.spacing[1]) ** 2 + ((z - c[2]) * vol.spacing[2]) ** 2;
          if (d2 <= AORTA.roi ** 2 && grown[i]) values.push(x + low[0] + vol.size[0] * (y + low[1] + vol.size[1] * (z + low[2])));
        }
      }
    }
    return values;
  };
  let values = select(AORTA.erosion);
  if (values.length < 50) values = select(1);
  if (values.length >= 50) return roiStats(vol, values, voxelMl, "region_growing", seed);
  return roiStats(vol, ball(vol, seed, AORTA.fallback), voxelMl, "fixed_ball", seed);
}

// A fat region connected to the clicked point, or null if there is no fat near it.
export function fatMetrics(vol, seed) {
  const voxelMl = (vol.spacing[0] * vol.spacing[1] * vol.spacing[2]) / 1000;
  const indices = ball(vol, seed, FAT.roi + FAT.snap);
  if (!indices.length) return null;
  const { data, dims, low } = cropBox(vol, indices);
  const smooth = gaussian(data, dims, AORTA.sigma);
  const [nx, ny, nz] = dims;
  const sp = vol.spacing;
  const isFat = (i) => smooth[i] >= FAT_RANGE[0] && smooth[i] <= FAT_RANGE[1];
  const dist2 = (x, y, z, c) => ((x - c[0]) * sp[0]) ** 2 + ((y - c[1]) * sp[1]) ** 2 + ((z - c[2]) * sp[2]) ** 2;
  const s = toIndex(vol, seed).map((v, a) => v - low[a]);
  let center = null;
  let nearest = FAT.snap ** 2;
  for (let z = 0, i = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++, i++) {
        if (!isFat(i)) continue;
        const d = dist2(x, y, z, s);
        if (d < nearest || (center === null && d <= nearest)) {
          nearest = d;
          center = [x, y, z];
        }
      }
    }
  }
  if (!center) return null;
  const region = new Uint8Array(smooth.length);
  const first = center[0] + nx * (center[1] + ny * center[2]);
  region[first] = 1;
  const stack = [first];
  const visit = (i, x, y, z) => {
    if (!region[i] && isFat(i) && dist2(x, y, z, center) <= FAT.roi ** 2) {
      region[i] = 1;
      stack.push(i);
    }
  };
  while (stack.length) {
    const i = stack.pop();
    const z = Math.floor(i / (nx * ny));
    const y = Math.floor((i - z * nx * ny) / nx);
    const x = i - nx * (y + ny * z);
    if (x > 0) visit(i - 1, x - 1, y, z);
    if (x < nx - 1) visit(i + 1, x + 1, y, z);
    if (y > 0) visit(i - nx, x, y - 1, z);
    if (y < ny - 1) visit(i + nx, x, y + 1, z);
    if (z > 0) visit(i - nx * ny, x, y, z - 1);
    if (z < nz - 1) visit(i + nx * ny, x, y, z + 1);
  }
  const depth = depthInside(region, dims, sp);
  const collect = (minDepth) => {
    const out = [];
    for (let z = 0, i = 0; z < nz; z++) {
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++, i++) {
          if (region[i] && depth[i] >= minDepth) out.push(x + low[0] + vol.size[0] * (y + low[1] + vol.size[1] * (z + low[2])));
        }
      }
    }
    return out;
  };
  let voxels = collect(FAT.erosion);
  if (voxels.length < FAT.minVoxels) voxels = collect(0);
  const values = pick(vol, voxels);
  const middle = median(values);
  const stats = {
    median_hu: middle,
    noise_sd: 1.4826 * median(values.map((v) => Math.abs(v - middle))),
    roi_ml: values.length * voxelMl,
    center: toWorld(vol, center.map((v, a) => v + low[a])),
  };
  Object.defineProperty(stats, "voxels", { value: voxels });
  return stats;
}

// Lumen minus fat, over the aortic noise, as CCTA studies usually define CNR.
export const contrastToNoise = (aorta, fat) => (aorta.noise_sd ? (aorta.median_hu - fat.median_hu) / aorta.noise_sd : NaN);

function buildGraph(lines) {
  const nodes = new Map();
  const points = [];
  const radii = [];
  const adjacency = [];
  const nodeFor = (p) => {
    const key = p.map((v) => Math.round(v * 20)).join(",");
    if (!nodes.has(key)) {
      nodes.set(key, points.length);
      points.push(p.slice(0, 3));
      radii.push(p[3] ?? NaN);
      adjacency.push(new Map());
    }
    return nodes.get(key);
  };
  for (const line of lines) {
    let previous = nodeFor(line[0]);
    for (let i = 1; i < line.length; i++) {
      const node = nodeFor(line[i]);
      if (node !== previous) {
        const weight = dist(points[previous], points[node]);
        adjacency[previous].set(node, weight);
        adjacency[node].set(previous, weight);
      }
      previous = node;
    }
  }
  return { points, radii, adjacency };
}

function leafPaths(adjacency, root) {
  const n = adjacency.length;
  const distance = new Float64Array(n).fill(Infinity);
  const previous = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  distance[root] = 0;
  for (;;) {
    let node = -1;
    for (let i = 0; i < n; i++) if (!done[i] && distance[i] < Infinity && (node < 0 || distance[i] < distance[node])) node = i;
    if (node < 0) break;
    done[node] = 1;
    for (const [next, weight] of adjacency[node]) {
      if (distance[node] + weight < distance[next]) {
        distance[next] = distance[node] + weight;
        previous[next] = node;
      }
    }
  }
  const parents = new Set(previous);
  const paths = [];
  for (let i = 0; i < n; i++) {
    if (distance[i] === Infinity || parents.has(i)) continue;
    const ids = [i];
    while (ids[ids.length - 1] !== root) ids.push(previous[ids[ids.length - 1]]);
    paths.push({ length: distance[i], ids: ids.reverse() });
  }
  return paths.sort((a, b) => b.length - a.length);
}

// One-millimetre samples along a path, keeping the nearest node's radius.
function resample(ids, points, radii) {
  const source = ids.map((i) => points[i]);
  const arclength = [0];
  for (let i = 1; i < source.length; i++) arclength.push(arclength[i - 1] + dist(source[i - 1], source[i]));
  const total = arclength[arclength.length - 1];
  const out = [];
  const radius = [];
  const count = Math.max(Math.ceil(total), 1);
  for (let t = 0, k = 0; t < count; t++) {
    while (k < source.length - 2 && arclength[k + 1] < t) k += 1;
    const span = arclength[k + 1] - arclength[k] || 1;
    const f = (t - arclength[k]) / span;
    out.push([0, 1, 2].map((a) => source[k][a] + f * (source[k + 1][a] - source[k][a])));
    radius.push(radii[ids[f < 0.5 ? k : k + 1]]);
  }
  return { points: out, radius };
}

const pathLength = (points) => {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
};

export function extractMainVessels(lines, rawOstia) {
  const { points, radii, adjacency } = buildGraph(lines);
  const ostia = [...rawOstia].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const right = ostia[0];
  const left = ostia.slice(1);
  // Returns -1 when nothing was traced from this ostium, so one tree cannot be named twice.
  const nearest = (p) => {
    let best = -1;
    let bestDistance = MAX_OSTIUM_GAP_MM;
    for (let i = 0; i < points.length; i++) {
      if (adjacency[i].size === 0) continue;
      const d = dist(points[i], p);
      if (d <= bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    return best;
  };
  const vessel = (name, ids) => {
    const sampled = resample(ids, points, radii);
    return { name, ...sampled, length_mm: pathLength(sampled.points) };
  };
  const vessels = [];
  const paths = (o) => {
    const root = nearest(o);
    return root < 0 ? [] : leafPaths(adjacency, root);
  };
  const rightPaths = paths(right);
  if (rightPaths.length) vessels.push(vessel("RCA", rightPaths[0].ids));
  if (!left.length) return vessels;

  if (left.length > 1) {
    const longest = left.map((o) => paths(o)[0]?.ids).filter(Boolean);
    const anterior = (ids) => ids.slice(0, 40).reduce((sum, i) => sum + points[i][1], 0) / Math.min(ids.length, 40);
    longest.sort((a, b) => anterior(a) - anterior(b));
    longest.slice(0, 2).forEach((ids, i) => vessels.push(vessel(["LAD", "LCx"][i], ids)));
    return vessels;
  }

  const leftPaths = paths(left[0]);
  if (!leftPaths.length) return vessels;
  const mainIds = leftPaths[0].ids;
  const main = mainIds.map((i) => points[i]);
  let best = null;
  let bestLength = MIN_BRANCH_MM;
  let split = 0;
  for (const { ids } of leftPaths.slice(1)) {
    const candidate = ids.map((i) => points[i]);
    const index = candidate.findIndex((p) => main.reduce((low, q) => Math.min(low, dist(p, q)), Infinity) > SEPARATION_MM);
    if (index < 0) continue;
    const before = index > 0 ? pathLength(candidate.slice(0, index + 1)) : 0;
    const remaining = pathLength(candidate.slice(index));
    if (before <= MAX_LEFT_MAIN_MM && remaining > bestLength) {
      best = ids;
      bestLength = remaining;
      split = index;
    }
  }
  if (!best) {
    vessels.push(vessel("LAD", mainIds));
    return vessels;
  }
  if (split - 1 >= 2) vessels.push(vessel("LM", best.slice(0, split - 1)));
  const anterior = (ids) => {
    const part = ids.slice(split, split + 40);
    return part.reduce((sum, i) => sum + points[i][1], 0) / part.length;
  };
  const [lad, lcx] = anterior(mainIds) < anterior(best) ? [mainIds, best] : [best, mainIds];
  vessels.push(vessel("LAD", lad), vessel("LCx", lcx));
  return vessels;
}

// True when a long path stays near its start, as a trace circling one spot does.
export function isLost(points) {
  const length = pathLength(points);
  const reach = points.reduce((far, p) => Math.max(far, dist(p, points[0])), 0);
  return length >= MIN_REACH_LENGTH_MM && reach / length < MIN_REACH_RATIO;
}

export function vesselProfile(vol, vessel, aorta) {
  const n = vessel.points.length;
  const threshold = aorta.median_hu + CALCIUM_SD * aorta.noise_sd;
  const profile = { name: vessel.name, points: vessel.points, radius: [], lumen: [], fat: [], calcified: [], valid: [] };
  for (let i = 0; i < n; i++) {
    const point = vessel.points[i];
    const r = Number.isFinite(vessel.radius[i]) ? vessel.radius[i] : 0;
    const clean = pick(vol, ball(vol, point, LUMEN.ball)).filter((v) => v < threshold);
    const lumen = clean.length ? percentile(clean, LUMEN.percentile) : NaN;
    const around = pick(vol, ball(vol, point, CALCIUM_BALL_MM));
    const calcium = around.length ? around.filter((v) => v >= threshold).length / around.length : 0;
    const shell = pick(vol, ball(vol, point, r + FAT_SHELL[1], r + FAT_SHELL[0])).filter((v) => v >= FAT_RANGE[0] && v <= FAT_RANGE[1]);
    const calcified = calcium > 0.02;
    profile.radius.push(r);
    profile.lumen.push(lumen);
    profile.fat.push(shell.length >= 5 ? median(shell) : NaN);
    profile.calcified.push(calcified);
    profile.valid.push(r >= LUMEN.minRadius && !calcified && Number.isFinite(lumen));
  }
  return profile;
}

export function findFocalDips(profile) {
  const { lumen: hu, valid, calcified } = profile;
  const n = hu.length;
  if (n < DIP.windowMm) return [];
  const guard = new Array(n).fill(false);
  calcified.forEach((isCalcified, i) => {
    if (!isCalcified) return;
    for (let k = Math.max(0, i - DIP.guardMm); k <= Math.min(n - 1, i + DIP.guardMm); k++) guard[k] = true;
  });
  const half = Math.floor(DIP.windowMm / 2);
  const dipped = hu.map((value, i) => {
    if (!valid[i] || guard[i]) return false;
    const window = hu.slice(Math.max(0, i - half), i + half + 1).filter(Number.isFinite);
    return window.length >= 5 && value < DIP.ratio * median(window);
  });
  const dips = [];
  for (let i = 0; i < n; ) {
    if (!dipped[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < n && dipped[j + 1]) j += 1;
    const recovers = j + 1 < n && hu.slice(j + 1, j + 6).some(Number.isFinite);
    if (j - i + 1 >= DIP.minMm && recovers) {
      dips.push({ start_mm: i, end_mm: j, min_hu: Math.min(...hu.slice(i, j + 1).filter(Number.isFinite)) });
    }
    i = j + 1;
  }
  return dips;
}

export function thirdMetrics(profile, aorta) {
  const n = profile.lumen.length;
  const edges = [0, 1, 2, 3].map((k) => Math.trunc((k * n) / 3));
  const fats = profile.fat.filter(Number.isFinite);
  const fat = fats.length ? median(fats) : -100;
  return ["proximal", "mid", "distal"].map((third, k) => {
    const [start, stop] = [edges[k], edges[k + 1]];
    const keep = [];
    for (let i = start; i < stop; i++) if (profile.valid[i]) keep.push(profile.lumen[i]);
    const fraction = stop > start ? keep.length / (stop - start) : 0;
    if (keep.length < 3 || fraction < MIN_PATH_FRACTION) return { third, median_hu: null, hu_ratio: null, cnr: null, valid_fraction: fraction };
    const hu = median(keep);
    return { third, median_hu: hu, hu_ratio: hu / aorta.median_hu, cnr: (hu - fat) / aorta.noise_sd, valid_fraction: fraction };
  });
}

const ramp = (value, [low, high]) => 100 * Math.min(Math.max((value - low) / (high - low), 0), 1);

export function scoreVessel(name, thirds, dips, lengthMm, calcifiedMm) {
  let total = 0;
  let weight = 0;
  const reasons = [];
  for (const third of thirds) {
    if (third.cnr === null) continue;
    const w = SCORE.weights[third.third];
    const cnrBounds = SCORE.cnr[third.third];
    const ratioBounds = SCORE.ratio[third.third];
    total += w * Math.min(ramp(third.cnr, cnrBounds), ramp(third.hu_ratio, ratioBounds));
    weight += w;
    if (third.cnr < cnrBounds[0]) reasons.push(`Low contrast-to-noise in the ${third.third} third`);
    else if (third.hu_ratio < ratioBounds[0]) reasons.push(`Weak opacification in the ${third.third} third`);
  }
  const base = { name, length_mm: lengthMm, thirds, focal_dips: dips, calcified_mm: calcifiedMm };
  if (weight === 0) return { ...base, score: null, assessed_fraction: 0, reasons: ["Vessel could not be assessed"] };
  let score = total / weight;
  if (dips.length) {
    score = Math.max(score - Math.min(SCORE.dipPenalty * dips.length, SCORE.maxDipPenalty), 0);
    reasons.push(`${dips.length} focal HU dip(s): check for motion, misregistration or stenosis`);
  }
  if (weight < 1 - 1e-9) reasons.push("Part of the vessel was too small or calcified to assess");
  return { ...base, score, assessed_fraction: weight, reasons };
}

export function scoreExam(aorta, vessels) {
  const reasons = [];
  const aortaScore = Math.min(ramp(aorta.median_hu, SCORE.aortaHu), ramp(aorta.snr, SCORE.aortaSnr));
  if (aorta.median_hu < SCORE.aortaHu[0]) reasons.push(`Low aortic attenuation (${aorta.median_hu.toFixed(0)} HU)`);
  if (aorta.snr < SCORE.aortaSnr[0]) reasons.push(`Low aortic SNR (${aorta.snr.toFixed(1)})`);
  const found = Object.fromEntries(vessels.map((v) => [v.name, v]));
  const missing = MAIN_VESSELS.filter((name) => !found[name] || found[name].score === null);
  if (missing.length) reasons.push(`Not assessed: ${missing.join(", ")}`);
  const scored = MAIN_VESSELS.filter((name) => found[name] && found[name].score !== null).map((name) => found[name].score);
  if (!scored.length) return { score: 0, grade: "fail", aorta_score: aortaScore, reasons };
  const weakest = Math.min(...scored);
  const average = scored.reduce((a, b) => a + b, 0) / scored.length;
  let score = 0.2 * aortaScore + 0.5 * weakest + 0.3 * average;
  // Vessel ratios are relative to the aorta, so a weak bolus can look fine there.
  score = Math.min(score, 40 + 0.6 * aortaScore);
  if (missing.length) score = Math.min(score, SCORE.review);
  const grade = score >= SCORE.pass ? "pass" : score >= SCORE.review ? "review" : "fail";
  return { score: Math.round(score * 10) / 10, grade, aorta_score: Math.round(aortaScore * 10) / 10, reasons };
}

// Tracer steps become polylines of [x, y, z, radius]. A step starts where its parent ended,
// so the branches join into one graph.
export function linesFromSteps(steps) {
  return steps.map((s) => [[...s.old, s.oldR], [...s.point, s.radius]]);
}

export function assess(vol, lines, ostia, aortaSeed) {
  checkImage(vol);
  const aorta = aortaMetrics(vol, aortaSeed);
  const vessels = extractMainVessels(lines, ostia);
  const profiles = {};
  const scored = [];
  for (const vessel of vessels) {
    const profile = vesselProfile(vol, vessel, aorta);
    profiles[vessel.name] = profile;
    if (vessel.name === "LM") continue;
    if (isLost(vessel.points)) {
      scored.push({ name: vessel.name, score: null, length_mm: vessel.length_mm, assessed_fraction: 0, thirds: [], focal_dips: [], calcified_mm: 0, reasons: ["Trace left the vessel, so it was not scored"] });
      continue;
    }
    const calcifiedMm = profile.calcified.filter(Boolean).length;
    scored.push(scoreVessel(vessel.name, thirdMetrics(profile, aorta), findFocalDips(profile), vessel.length_mm, calcifiedMm));
  }
  return { report: { exam: scoreExam(aorta, scored), aorta, vessels: scored }, profiles };
}
