// Generic scan checks that need no segmentation: geometry, units, empty slices, sudden
// changes between slices, anatomy at the image edge, noise and metal. They apply to any CT or
// MR volume and are the first layer of the scan check page. Exam-specific checks (contrast
// timing, phase, motion) need anatomy and are not here.
//
// A volume is { size: [nx, ny, nz], spacing: [sx, sy, sz] in mm, data: any typed array in
// x-fastest order, slope, inter, direction }. Slices run along the third axis. Values are
// data * slope + inter. direction is optional: 9 numbers, row-major, whose columns are the unit
// world directions of the image axes.

export const STATUS_ORDER = { fail: 3, warn: 2, pass: 1, skip: 0 };

const SAMPLE_TARGET = 1_000_000;
const CT_BODY_HU = -500;
const CT_AIR_RANGE = [-1100, -950]; // lung reads about -850 to -900, so it is left out
const CT_AIR_OK = [-1030, -960];
const SOFT_TISSUE_HU = [0, 100];
const SLICE_TISSUE_HU = [-200, 300];
const METAL_HU = 3000;
const METAL_ML = 3; // dense contrast in the injection vein alone often reaches 1 to 2 mL
const NOISE_WINDOW_MM = 5;
const NOISE_SLICES = 30;
const EDGE_SLICES = 64;
const EDGE_GRID = 256;
const EDGE_TOUCH = 0.05; // share of an image edge the anatomy covers before it counts as touching
const EDGE_WARN = 0.25; // share of slices touching the edge before a warning
const MR_BAND = 1 / 8; // outer band of each in-plane axis used as MR background

export function percentile(values, q) {
  if (!values.length) return NaN;
  const sorted = Float64Array.from(values).sort();
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const median = (values) => percentile(values, 0.5);

function mad(values) {
  const m = median(values);
  return 1.4826 * median(values.map((v) => Math.abs(v - m)));
}

function reader(vol) {
  const { data } = vol;
  const slope = vol.slope || 1;
  const inter = vol.inter || 0;
  return slope === 1 && inter === 0 ? (i) => data[i] : (i) => data[i] * slope + inter;
}

// Every n-th voxel, about SAMPLE_TARGET in all.
export function sampleValues(vol) {
  const total = vol.size[0] * vol.size[1] * vol.size[2];
  const step = Math.max(1, Math.floor(total / SAMPLE_TARGET));
  const at = reader(vol);
  const out = new Float32Array(Math.ceil(total / step));
  let n = 0;
  for (let i = 0; i < total; i += step) {
    const v = at(i);
    if (Number.isFinite(v)) out[n++] = v;
  }
  return out.subarray(0, n);
}

// MR magnitude images have no values far below zero; CT has air at about -1000. A small share
// is enough, so that blank slices or a crop with little air still count as CT, and so does a
// CT clipped on export, such as at -200 HU.
export function guessModality(sample) {
  let low = 0;
  for (const v of sample) if (v <= -500) low++;
  return low / sample.length >= 0.002 || percentile(sample, 0.01) < -100 ? "ct" : "mr";
}

// A value that fills a large share of the volume at exactly the minimum is padding, such as
// -1024 or -3024 outside the CT reconstruction circle.
function paddingValue(sample) {
  let min = Infinity;
  for (const v of sample) if (v < min) min = v;
  let count = 0;
  for (const v of sample) if (v === min) count++;
  return count / sample.length > 0.02 ? min : null;
}

export function otsu(values) {
  const lo = percentile(values, 0.005);
  const hi = percentile(values, 0.995);
  if (!(hi > lo)) return lo;
  const bins = 256;
  const hist = new Float64Array(bins);
  for (const v of values) {
    if (v < lo || v > hi) continue;
    hist[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))]++;
  }
  let total = 0;
  let sum = 0;
  for (let b = 0; b < bins; b++) {
    total += hist[b];
    sum += b * hist[b];
  }
  let weight = 0;
  let partial = 0;
  let best = 0;
  let bestScore = -1;
  for (let b = 0; b < bins; b++) {
    weight += hist[b];
    if (!weight || weight === total) continue;
    partial += b * hist[b];
    const m0 = partial / weight;
    const m1 = (sum - partial) / (total - weight);
    const score = weight * (total - weight) * (m0 - m1) ** 2;
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return lo + ((best + 1) / bins) * (hi - lo);
}

// One pass over every slice: range, tissue mean, anatomy centroid, and very dense voxels.
function sliceStats(vol, ctx) {
  const [nx, ny, nz] = vol.size;
  const at = reader(vol);
  const perSlice = nx * ny;
  const stride = nx * ny > 300_000 ? 2 : 1;
  const slices = [];
  let metal = 0;
  let maxValue = -Infinity;
  let maxIndex = 0;
  let nonFinite = 0;
  let firstNonFinite = -1;
  for (let z = 0; z < nz; z++) {
    let min = Infinity;
    let max = -Infinity;
    const base = z * perSlice;
    for (let i = base, end = base + perSlice; i < end; i++) {
      const v = at(i);
      if (!Number.isFinite(v)) {
        if (firstNonFinite < 0) firstNonFinite = i;
        nonFinite++;
        continue;
      }
      if (v < min) min = v;
      if (v > max) max = v;
      if (ctx.modality === "ct" && v > METAL_HU) metal++;
      if (v > maxValue) {
        maxValue = v;
        maxIndex = i;
      }
    }
    let tissueSum = 0;
    let tissueCount = 0;
    let bodyCount = 0;
    let cx = 0;
    let cy = 0;
    for (let y = 0; y < ny; y += stride) {
      for (let x = 0; x < nx; x += stride) {
        const v = at(base + x + nx * y);
        if (!(v > ctx.bodyThreshold) || v === Infinity) continue;
        bodyCount++;
        cx += x;
        cy += y;
        if (ctx.modality === "mr" || (v >= SLICE_TISSUE_HU[0] && v <= SLICE_TISSUE_HU[1])) {
          tissueSum += v;
          tissueCount++;
        }
      }
    }
    // Stored slices that match the previous one exactly come from export or stacking bugs.
    const blank = !(max > min);
    let duplicate = false;
    if (z > 0 && !blank && !slices[z - 1].blank) {
      duplicate = true;
      for (let i = 0; i < perSlice; i++) {
        if (vol.data[base + i] !== vol.data[base - perSlice + i]) {
          duplicate = false;
          break;
        }
      }
    }
    slices.push({
      min,
      max,
      blank,
      duplicate,
      tissue: tissueCount ? tissueSum / tissueCount : NaN,
      tissueCount,
      bodyCount,
      centroid: bodyCount ? [(cx / bodyCount) * vol.spacing[0], (cy / bodyCount) * vol.spacing[1]] : null,
    });
  }
  return { slices, metal, maxValue, maxIndex, nonFinite, firstNonFinite };
}

const sliceCentre = (vol, z) => [Math.floor(vol.size[0] / 2), Math.floor(vol.size[1] / 2), z];

function indexToVoxel(vol, i) {
  const [nx, ny] = vol.size;
  const z = Math.floor(i / (nx * ny));
  const y = Math.floor((i - z * nx * ny) / nx);
  return [i - nx * (y + ny * z), y, z];
}

const fmt = (v, digits = 0) => (Number.isFinite(v) ? v.toFixed(digits).replace(/^-/, "−") : "–");
const mm = (v) => `${fmt(v, v < 10 ? 2 : 1)} mm`;

function finiteCheck(vol, stats) {
  const name = "Missing values";
  const total = vol.size[0] * vol.size[1] * vol.size[2];
  if (!stats.nonFinite) return { id: "finite", name, status: "pass", value: "none", detail: "Every voxel holds a number.", numbers: { non_finite: 0 } };
  return {
    id: "finite",
    name,
    status: "fail",
    value: `${stats.nonFinite.toLocaleString("en-US")} voxels`,
    detail: `${stats.nonFinite.toLocaleString("en-US")} voxels (${fmt((100 * stats.nonFinite) / total, 2)}%) are not a number or infinite, often left by resampling or registration. Most tools fail on them or spread them; fill them before use. They are left out of the other checks.`,
    at: indexToVoxel(vol, stats.firstNonFinite),
    numbers: { non_finite: stats.nonFinite },
  };
}

// A real CT or MR has thousands of distinct values. A few hundred mean an 8-bit export, and a
// handful mean a segmentation or mask.
function distinctCheck(sample) {
  const name = "Distinct values";
  const seen = new Set();
  for (const v of sample) {
    seen.add(v);
    if (seen.size > 1000) break;
  }
  const count = seen.size;
  const numbers = { distinct: count > 1000 ? ">1000" : count };
  if (count <= 16) {
    return { id: "distinct", name, status: "fail", value: String(count), detail: `The scan holds only ${count} different values, so it looks like a segmentation or mask rather than an image.`, numbers };
  }
  if (count <= 256) {
    return {
      id: "distinct",
      name,
      status: "warn",
      value: String(count),
      detail: `The scan holds only ${count} different values. Either it was exported as 8-bit (for example from PNG or JPEG images or a windowed view), and values may no longer be in their original units, or the scanner stored a narrow range of whole numbers. Either way, intensity differences smaller than one step are lost.`,
      numbers,
    };
  }
  const detail = count > 1000 ? "The scan has the full range of values of an original image." : `The scan has ${count} different values, more than an 8-bit export would.`;
  return { id: "distinct", name, status: "pass", value: count > 1000 ? "over 1,000" : String(count), detail, numbers };
}

function duplicateCheck(vol, slices) {
  const name = "Duplicate slices";
  const repeated = slices.flatMap((s, z) => (s.duplicate ? [z] : []));
  if (!repeated.length) return { id: "duplicate", name, status: "pass", value: "none", detail: "No slice is an exact copy of the one before it.", numbers: { duplicates: 0 } };
  return {
    id: "duplicate",
    name,
    status: "warn",
    value: `${repeated.length} ${repeated.length === 1 ? "slice" : "slices"}`,
    detail: `Slices ${ranges(repeated)} are exact copies of the slice before. Real neighbouring slices always differ through noise, so this comes from an export, conversion or stacking error, and distances along that axis will be off.`,
    at: sliceCentre(vol, repeated[0]),
    numbers: { duplicates: repeated.length, slices: repeated },
  };
}

// How far each image axis is from the nearest world axis. A tilted (oblique) scan is fine,
// but tools that ignore the orientation in the header will place or resample it wrongly.
function orientationCheck(vol) {
  const d = vol.direction;
  const tilt = Math.max(
    ...[0, 1, 2].map((c) => {
      const column = [d[c], d[3 + c], d[6 + c]];
      const length = Math.hypot(...column) || 1;
      return (Math.acos(Math.min(1, Math.max(...column.map((v) => Math.abs(v) / length)))) * 180) / Math.PI;
    })
  );
  const name = "Orientation";
  if (tilt <= 1) return { id: "orientation", name, status: "pass", value: "aligned", detail: "The image axes are aligned with the body axes.", numbers: { tilt_deg: tilt } };
  return {
    id: "orientation",
    name,
    status: "warn",
    value: `tilted ${fmt(tilt, 1)}°`,
    detail: `The image axes are tilted up to ${fmt(tilt, 1)}° from the body axes, as with an angled slice plan or gantry tilt. That is fine for viewing, but tools that ignore the orientation in the header will misplace or distort the scan, so resample it or check how your tools handle it.`,
    numbers: { tilt_deg: tilt },
  };
}

function geometryCheck(vol) {
  const { size, spacing } = vol;
  const thickest = Math.max(...spacing);
  const inPlane = Math.max(spacing[0], spacing[1]);
  const extent = size.map((n, i) => (n * spacing[i]) / 10);
  const value = `${spacing.map((s) => fmt(s, 2)).join(" × ")} mm`;
  const base = `${size.join(" × ")} voxels covering ${extent.map((e) => fmt(e, 1)).join(" × ")} cm.`;
  let status = "pass";
  let detail = `${base} Voxels are small enough for most measurements.`;
  if (thickest > 5) {
    status = "fail";
    detail = `${base} Voxels are ${mm(thickest)} along one axis, so small structures blur into their surroundings and 3D measurements are unreliable.`;
  } else if (thickest > 1.5 || inPlane > 1.5) {
    status = "warn";
    detail = `${base} Voxels are up to ${mm(thickest)}, which is fine for large organs, but small structures such as vessels and nodules may be blurred or missed. Thin reconstructions of about 1 mm or less are better.`;
  }
  return { id: "geometry", name: "Voxel size", status, value, detail, numbers: { size, spacing_mm: spacing, extent_cm: extent } };
}

// A CT windowed on export piles its brightest voxels on one value well below the scanner's
// limit (usually 3071 or 4095 HU), such as 1000 HU.
function topClipping(sample, maxValue) {
  if (!(maxValue < 2000)) return null;
  let atMax = 0;
  for (const v of sample) if (v === maxValue) atMax++;
  return atMax / sample.length >= 5e-4 ? { value: maxValue, share: atMax / sample.length } : null;
}

function unitsCheck(sample, padding, maxValue) {
  const result = lowUnitsCheck(sample, padding);
  const top = topClipping(sample, maxValue);
  if (!top) return result;
  const lowClip = result.numbers.clipped_at !== undefined;
  const share = `${fmt(top.share * 100, 2)}% of the scan`;
  const alone = result.status === "pass" || result.status === "skip";
  const note = lowClip
    ? `They are also cut off at ${fmt(top.value)} HU at the bright end (${share}), so bone, contrast and anything denser read the same too.`
    : `Values are cut off at ${fmt(top.value)} HU at the bright end (${share}), so bone, contrast and anything denser all read the same. The scan was probably windowed on export.`;
  return {
    ...result,
    status: STATUS_ORDER[result.status] > STATUS_ORDER.warn ? result.status : "warn",
    value: lowClip ? `clipped at ${fmt(result.numbers.clipped_at)} and ${fmt(top.value)} HU` : alone ? `clipped at ${fmt(top.value)} HU` : `${result.value}, clipped at ${fmt(top.value)} HU`,
    detail: alone ? note : `${result.detail} ${note}`,
    numbers: { ...result.numbers, clipped_top_at: top.value },
  };
}

function lowUnitsCheck(sample, padding) {
  if (padding !== null && padding < -100 && padding > -950) {
    return {
      id: "units",
      name: "Hounsfield units",
      status: "warn",
      value: `clipped at ${fmt(padding)} HU`,
      detail: `Values are cut off at ${fmt(padding)} HU, so air, lung and part of the fat all read the same. The scan was probably windowed or clipped on export. Measurements in those tissues will be wrong, and the calibration cannot be checked.`,
      numbers: { clipped_at: padding },
    };
  }
  const values = padding === null ? sample : sample.filter((v) => v !== padding);
  const lowest = percentile(values, 0.001);
  if (!(lowest < -200)) {
    return {
      id: "units",
      name: "Hounsfield units",
      status: "fail",
      value: `lowest ${fmt(lowest)}`,
      detail: "There are no values below −200, so the scan does not look like it is in Hounsfield units. If it is a CT, the rescale slope and intercept (often −1024) may not have been applied.",
      numbers: { lowest },
    };
  }
  const air = values.filter((v) => v >= CT_AIR_RANGE[0] && v <= CT_AIR_RANGE[1]);
  if (air.length < values.length * 0.002) {
    return {
      id: "units",
      name: "Hounsfield units",
      status: "skip",
      value: "no air",
      detail: "There is too little air outside the body to check the calibration against, which is common when the field of view is narrow or the scan is cropped.",
      numbers: { air_hu: null },
    };
  }
  const airHu = median(air);
  const ok = airHu >= CT_AIR_OK[0] && airHu <= CT_AIR_OK[1];
  return {
    id: "units",
    name: "Hounsfield units",
    status: ok ? "pass" : "warn",
    value: `air ${fmt(airHu)} HU`,
    detail: ok
      ? "Air reads close to −1000 HU, as it should."
      : `Air reads ${fmt(airHu)} HU instead of about −1000 HU, so the values may be shifted or the scanner calibration may be off.`,
    numbers: { air_hu: airHu },
  };
}

function ranges(indices) {
  const out = [];
  for (const i of indices) {
    const last = out[out.length - 1];
    if (last && i === last[1] + 1) last[1] = i;
    else out.push([i, i]);
  }
  return out.map(([a, b]) => (a === b ? `${a + 1}` : `${a + 1}–${b + 1}`)).join(", ");
}

function blankCheck(vol, slices) {
  const blank = slices.flatMap((s, z) => (s.blank ? [z] : []));
  const share = blank.length / slices.length;
  const name = "Empty slices";
  if (!blank.length) return { id: "blank", name, status: "pass", value: "none", detail: "Every slice has image content.", numbers: { blank: 0 } };
  // A few empty slices at either end are usually padding from resampling or export.
  let first = 0;
  while (first < slices.length && slices[first].blank) first++;
  let last = slices.length - 1;
  while (last >= 0 && slices[last].blank) last--;
  const atEnds = first + (slices.length - 1 - last);
  if (atEnds === blank.length && share <= 0.02) {
    return {
      id: "blank",
      name,
      status: "pass",
      value: `${blank.length} at the ends`,
      detail: `Slices ${ranges(blank)} at the ends of the scan are empty, which is usually padding.`,
      numbers: { blank: blank.length, slices: blank },
    };
  }
  return {
    id: "blank",
    name,
    status: share > 0.1 ? "fail" : "warn",
    value: `${blank.length} of ${slices.length}`,
    detail: `Slices ${ranges(blank)} hold a single value, so the file may be incomplete or damaged, or slices were blanked on export.`,
    at: sliceCentre(vol, blank[0]),
    numbers: { blank: blank.length, slices: blank },
  };
}

// Neighbouring slices of one acquisition look alike. A jump in mean tissue value or a shift of
// the anatomy between two slices suggests stacks stitched together, a misaligned series or a
// table move. It does not catch most patient motion.
function jumpCheck(vol, slices, ctx) {
  const name = "Sudden changes between slices";
  const counts = slices.map((s) => s.tissueCount);
  const typical = median(counts.filter((c) => c > 0));
  const valid = slices.map((s) => !s.blank && s.tissueCount >= 0.5 * typical && s.centroid);
  const pairs = [];
  for (let z = 0; z + 1 < slices.length; z++) {
    if (!valid[z] || !valid[z + 1]) continue;
    const a = slices[z];
    const b = slices[z + 1];
    pairs.push({
      z,
      value: Math.abs(b.tissue - a.tissue),
      shift: Math.hypot(b.centroid[0] - a.centroid[0], b.centroid[1] - a.centroid[1]),
      area: Math.abs(b.bodyCount - a.bodyCount) / Math.max(a.bodyCount, b.bodyCount),
    });
  }
  if (pairs.length < 10) {
    return { id: "jumps", name, status: "skip", value: "too few slices", detail: "There are too few slices with anatomy to compare neighbours.", numbers: {} };
  }
  const values = pairs.map((p) => p.value);
  const shifts = pairs.map((p) => p.shift);
  const valueLimit = Math.max(ctx.jumpFloor, median(values) + 8 * mad(values));
  const shiftLimit = Math.max(5, median(shifts) + 8 * mad(shifts));
  // A shift with a matching change in area is anatomy entering or leaving, such as the shoulders.
  const flagged = pairs.filter((p) => p.value > valueLimit || (p.shift > shiftLimit && p.area < 0.15));
  if (!flagged.length) {
    return { id: "jumps", name, status: "pass", value: "none", detail: "Neighbouring slices change smoothly.", numbers: { jumps: 0 } };
  }
  const worst = flagged.reduce((a, b) => (b.value / valueLimit + b.shift / shiftLimit > a.value / valueLimit + a.shift / shiftLimit ? b : a));
  const where = flagged.slice(0, 5).map((p) => `${p.z + 1}–${p.z + 2}`).join(", ");
  const unit = ctx.modality === "ct" ? " HU" : "";
  return {
    id: "jumps",
    name,
    status: "warn",
    value: `${flagged.length} ${flagged.length === 1 ? "place" : "places"}`,
    detail: `The image changes abruptly between slices ${where}${flagged.length > 5 ? " and more" : ""} (largest: ${fmt(worst.value)}${unit} in mean value, ${fmt(worst.shift, 1)} mm shift). This can mean stacks stitched together, a misaligned series or a table move.`,
    at: sliceCentre(vol, worst.z + 1),
    numbers: { jumps: flagged.length, slices: flagged.map((p) => p.z) },
  };
}

function largestComponent(mask, w, h) {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start]) continue;
    next++;
    let top = 0;
    let size = 0;
    stack[top++] = start;
    label[start] = next;
    while (top) {
      const i = stack[--top];
      size++;
      const x = i % w;
      const neighbours = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of neighbours) {
        if (j < 0 || j >= w * h || !mask[j] || label[j]) continue;
        label[j] = next;
        stack[top++] = j;
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  return { label, best, size: bestSize };
}

function evenly(indices, count) {
  if (indices.length <= count) return indices;
  return Array.from({ length: count }, (_, k) => indices[Math.floor(((k + 0.5) * indices.length) / count)]);
}

// The anatomy (largest connected region above the body threshold) touching an image edge on
// many slices means a narrow field of view or a crop. CT values near a truncated edge can be off.
function edgeCheck(vol, slices, ctx) {
  const name = "Anatomy at the image edge";
  const [nx, ny] = vol.size;
  const at = reader(vol);
  const step = Math.max(1, Math.ceil(Math.max(nx, ny) / EDGE_GRID));
  const w = Math.ceil(nx / step);
  const h = Math.ceil(ny / step);
  const candidates = slices.flatMap((s, z) => (!s.blank && s.bodyCount > 0 ? [z] : []));
  const chosen = evenly(candidates, EDGE_SLICES);
  if (!chosen.length) return { id: "edge", name, status: "skip", value: "no anatomy", detail: "No anatomy was found above the threshold.", numbers: {} };
  const touching = [];
  const sides = { left: 0, right: 0, top: 0, bottom: 0 };
  const mask = new Uint8Array(w * h);
  for (const z of chosen) {
    const base = z * nx * ny;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[x + w * y] = at(base + x * step + nx * y * step) > ctx.bodyThreshold ? 1 : 0;
    const { label, best, size } = largestComponent(mask, w, h);
    if (size < 0.01 * w * h) continue;
    const share = (cells) => cells.filter((i) => label[i] === best).length / cells.length;
    const edges = {
      left: share(Array.from({ length: h }, (_, y) => w * y)),
      right: share(Array.from({ length: h }, (_, y) => w - 1 + w * y)),
      top: share(Array.from({ length: w }, (_, x) => x)),
      bottom: share(Array.from({ length: w }, (_, x) => x + w * (h - 1))),
    };
    const hit = Object.keys(edges).filter((k) => edges[k] > EDGE_TOUCH);
    if (hit.length) {
      touching.push(z);
      for (const k of hit) sides[k]++;
    }
  }
  const share = touching.length / chosen.length;
  const numbers = { slices_checked: chosen.length, slices_touching: touching.length };
  if (share <= EDGE_WARN) {
    return { id: "edge", name, status: "pass", value: `${Math.round(share * 100)}% of slices`, detail: "The anatomy sits inside the image on most slices.", numbers };
  }
  const truncation = ctx.modality === "ct" ? " CT values near a cut-off edge can also be wrong." : "";
  return {
    id: "edge",
    name,
    status: "warn",
    value: `${Math.round(share * 100)}% of slices`,
    detail: `The anatomy reaches the edge of the image on ${Math.round(share * 100)}% of the slices checked. That is expected if the field of view was narrowed or the scan cropped on purpose; otherwise part of the anatomy is cut off.${truncation}`,
    at: sliceCentre(vol, touching[Math.floor(touching.length / 2)]),
    numbers,
  };
}

// CT noise as a global noise index: the most common local standard deviation over soft tissue,
// in windows of about 5 mm, which is robust to edges (Christianson et al., Radiology 2015).
function ctNoiseCheck(vol, slices) {
  const name = "Noise";
  const [nx, ny] = vol.size;
  const at = reader(vol);
  const k = Math.max(1, Math.round(NOISE_WINDOW_MM / 2 / Math.min(vol.spacing[0], vol.spacing[1])));
  const candidates = slices.flatMap((s, z) => (!s.blank && s.tissueCount > 0 ? [z] : []));
  const chosen = evenly(candidates.slice(Math.floor(candidates.length * 0.1), Math.ceil(candidates.length * 0.9)), NOISE_SLICES);
  const binWidth = 0.5;
  const hist = new Float64Array(400);
  let used = 0;
  const W = nx + 1;
  const s1 = new Float64Array(W * (ny + 1));
  const s2 = new Float64Array(W * (ny + 1));
  for (const z of chosen) {
    const base = z * nx * ny;
    for (let y = 0; y < ny; y++) {
      let r1 = 0;
      let r2 = 0;
      for (let x = 0; x < nx; x++) {
        const v = at(base + x + nx * y);
        r1 += v;
        r2 += v * v;
        s1[(y + 1) * W + x + 1] = s1[y * W + x + 1] + r1;
        s2[(y + 1) * W + x + 1] = s2[y * W + x + 1] + r2;
      }
    }
    const n = (2 * k + 1) ** 2;
    for (let y = k; y < ny - k; y += 2) {
      for (let x = k; x < nx - k; x += 2) {
        const v = at(base + x + nx * y);
        if (v < SOFT_TISSUE_HU[0] || v > SOFT_TISSUE_HU[1]) continue;
        const a = (y - k) * W + (x - k);
        const b = (y - k) * W + (x + k + 1);
        const c = (y + k + 1) * W + (x - k);
        const d = (y + k + 1) * W + (x + k + 1);
        const sum = s1[d] - s1[b] - s1[c] + s1[a];
        const sq = s2[d] - s2[b] - s2[c] + s2[a];
        const mean = sum / n;
        if (mean < SOFT_TISSUE_HU[0] || mean > SOFT_TISSUE_HU[1]) continue;
        const sd = Math.sqrt(Math.max(0, (sq - sum * mean) / (n - 1)));
        const bin = Math.floor(sd / binWidth);
        if (bin < hist.length) hist[bin]++;
        used++;
      }
    }
  }
  if (used < 2000) {
    return { id: "noise", name, status: "skip", value: "no soft tissue", detail: "There is too little soft tissue (0 to 100 HU) to measure noise.", numbers: { noise_hu: null } };
  }
  let best = 0;
  let bestValue = -1;
  for (let b = 2; b < hist.length - 2; b++) {
    const smooth = hist[b - 2] + hist[b - 1] + hist[b] + hist[b + 1] + hist[b + 2];
    if (smooth > bestValue) {
      bestValue = smooth;
      best = b;
    }
  }
  const noise = (best + 0.5) * binWidth;
  const high = noise > ctNoiseLimit(vol);
  return {
    id: "noise",
    name,
    status: high ? "warn" : "pass",
    value: `${fmt(noise, 1)} HU`,
    detail: high
      ? `Noise in soft tissue is high (${fmt(noise, 1)} HU). Low dose, a sharp reconstruction kernel or thin slices all raise it, and it hides low-contrast detail.`
      : `Noise in soft tissue is ${fmt(noise, 1)} HU. It depends on dose, kernel and slice thickness, so compare scans of the same protocol.`,
    numbers: { noise_hu: noise, window_mm: (2 * k + 1) * Math.min(vol.spacing[0], vol.spacing[1]) },
  };
}

export const CT_NOISE_WARN_HU = 40;
const ctNoiseLimit = () => CT_NOISE_WARN_HU;

// MR SNR from the background, where magnitude noise follows a Rayleigh distribution:
// sigma = sqrt(mean(b^2) / 2). It needs a background that has not been blanked.
function mrNoiseCheck(vol, sample, ctx) {
  const name = "Signal to noise";
  const [nx, ny, nz] = vol.size;
  const at = reader(vol);
  const bx = Math.max(1, Math.floor(nx * MR_BAND));
  const by = Math.max(1, Math.floor(ny * MR_BAND));
  const step = Math.max(1, Math.floor((nx * ny * nz) / (4 * SAMPLE_TARGET)));
  const background = [];
  let zeros = 0;
  let minimum = Infinity;
  for (const v of sample) if (v < minimum) minimum = v;
  for (let i = 0; i < nx * ny * nz; i += step) {
    const x = i % nx;
    const y = Math.floor(i / nx) % ny;
    if (x >= bx && x < nx - bx && y >= by && y < ny - by) continue;
    const v = at(i);
    if (v > ctx.bodyThreshold) continue;
    background.push(v);
    if (v === minimum) zeros++;
  }
  const foreground = Array.from(sample).filter((v) => v > ctx.bodyThreshold);
  if (background.length < 500 || zeros / background.length > 0.5) {
    return {
      id: "noise",
      name,
      status: "skip",
      value: "no background",
      detail: "The background around the anatomy is missing, blanked or masked, so noise cannot be estimated from it.",
      numbers: { snr: null },
    };
  }
  // The mode of Rayleigh noise is sigma. Unlike the mean, the mode ignores dark tissue and
  // artifacts that fall in the background band.
  const offset = 0; // magnitude images are not negative; negative values are artifacts
  const top = percentile(background, 0.95) - offset;
  const bins = 200;
  const hist = new Float64Array(bins);
  for (const v of background) {
    const b = Math.floor(((v - offset) / top) * bins);
    if (b > 0 && b < bins) hist[b]++; // bin 0 holds exact zeros from masking, not noise
  }
  let best = 1;
  let bestCount = -1;
  for (let b = 2; b < bins - 2; b++) {
    const smooth = hist[b - 2] + hist[b - 1] + hist[b] + hist[b + 1] + hist[b + 2];
    if (smooth > bestCount) {
      bestCount = smooth;
      best = b;
    }
  }
  const sigma = ((best + 0.5) / bins) * top;
  const signal = median(foreground) - offset;
  const snr = signal / sigma;
  const low = snr < 10;
  return {
    id: "noise",
    name,
    status: low ? "warn" : "pass",
    value: fmt(snr, 1),
    detail: low
      ? `Signal to noise is low (${fmt(snr, 1)}): the median tissue signal over the background noise. Grainy images hide small structures.`
      : `Signal to noise is ${fmt(snr, 1)}: the median tissue signal over the background noise. It depends on the field strength, coil, sequence and voxel size.`,
    numbers: { snr, signal, noise_sigma: sigma },
  };
}

// MR magnitude values are not negative, and values at the limits of a 16-bit integer mean
// the data overflowed or wrapped on export.
function rangeCheck(sample) {
  const name = "Value range";
  let limit = 0;
  let negative = 0;
  for (const v of sample) {
    if (Math.abs(v) >= 32700) limit++;
    if (v < -100) negative++;
  }
  const numbers = { at_limit_share: limit / sample.length, negative_share: negative / sample.length };
  if (limit / sample.length > 1e-4) {
    return {
      id: "range",
      name,
      status: "fail",
      value: "at the limits",
      detail: "Some values sit at the limits of a 16-bit integer (about ±32,767), so the data probably overflowed or wrapped when it was saved. Intensity measurements will be wrong.",
      numbers,
    };
  }
  if (negative / sample.length > 0.005) {
    return {
      id: "range",
      name,
      status: "warn",
      value: `${fmt((100 * negative) / sample.length, 1)}% negative`,
      detail: "Many values are negative, which a magnitude MR image should not have. This may be a phase, subtracted or processed image, or a CT read as MRI.",
      numbers,
    };
  }
  return { id: "range", name, status: "pass", value: "normal", detail: "Values look like a magnitude image.", numbers };
}

function metalCheck(vol, stats) {
  const name = "Very dense material";
  const ml = (stats.metal * vol.spacing[0] * vol.spacing[1] * vol.spacing[2]) / 1000;
  if (ml < 0.05) return { id: "metal", name, status: "pass", value: "none", detail: `Nothing in the scan is above ${METAL_HU} HU, so there is no sign of metal.`, numbers: { metal_ml: ml } };
  const what = `${fmt(ml, 1)} mL of the scan is above ${METAL_HU} HU: metal such as a stent, wire, clip or implant, or undiluted contrast in the vein it was injected into.`;
  if (ml <= METAL_ML) {
    return { id: "metal", name, status: "pass", value: `${fmt(ml, 1)} mL`, detail: `${what} That little is usually harmless.`, at: indexToVoxel(vol, stats.maxIndex), numbers: { metal_ml: ml, max_hu: stats.maxValue } };
  }
  return {
    id: "metal",
    name,
    status: "warn",
    value: `${fmt(ml, 1)} mL`,
    detail: `${what} Both cause streaks that change nearby values, so check the regions you plan to measure.`,
    at: indexToVoxel(vol, stats.maxIndex),
    numbers: { metal_ml: ml, max_hu: stats.maxValue },
  };
}

const lower = (name) => (name.startsWith("Hounsfield") ? name : name[0].toLowerCase() + name.slice(1));

function list(names) {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function verdict(checks) {
  const worst = checks.reduce((a, c) => (STATUS_ORDER[c.status] > STATUS_ORDER[a] ? c.status : a), "skip");
  const flagged = checks.filter((c) => c.status === worst && (worst === "warn" || worst === "fail"));
  if (worst === "fail") return { level: "fail", label: "Likely problems", summary: `Check ${list(flagged.map((c) => lower(c.name)))} before using this scan.` };
  if (worst === "warn") return { level: "warn", label: "Usable, with concerns", summary: `Look at ${list(flagged.map((c) => lower(c.name)))}.` };
  return { level: "pass", label: "No problems found", summary: "These general checks found nothing wrong. They do not look at motion, contrast timing or exam-specific quality." };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function runChecks(vol, { modality = null, onProgress = () => {} } = {}) {
  onProgress("Sampling values");
  await tick();
  const sample = sampleValues(vol);
  const kind = modality || guessModality(sample);
  const padding = kind === "ct" ? paddingValue(sample) : null;
  const usable = padding === null ? sample : sample.filter((v) => v !== padding);
  const floor = percentile(usable, 0.01);
  // In a CT clipped above air, the body starts just above the clipping value.
  const ctBody = padding !== null && padding > -950 ? Math.max(CT_BODY_HU, padding + 50) : CT_BODY_HU;
  const bodyThreshold = kind === "ct" ? ctBody : otsu(usable.filter((v) => v > floor));
  const ctx = { modality: kind, bodyThreshold, jumpFloor: kind === "ct" ? 25 : 0.1 * median(usable.filter((v) => v > bodyThreshold)) };

  onProgress("Reading every slice");
  await tick();
  const stats = sliceStats(vol, ctx);
  const checks = [geometryCheck(vol)];
  if (vol.direction) checks.push(orientationCheck(vol));
  checks.push(finiteCheck(vol, stats), distinctCheck(sample));
  checks.push(kind === "ct" ? unitsCheck(sample, padding, stats.maxValue) : rangeCheck(sample));
  checks.push(blankCheck(vol, stats.slices), duplicateCheck(vol, stats.slices));
  checks.push(jumpCheck(vol, stats.slices, ctx));
  onProgress("Finding the anatomy");
  await tick();
  checks.push(edgeCheck(vol, stats.slices, ctx));
  onProgress("Measuring noise");
  await tick();
  checks.push(kind === "ct" ? ctNoiseCheck(vol, stats.slices) : mrNoiseCheck(vol, usable, ctx));
  if (kind === "ct") checks.push(metalCheck(vol, stats));
  return { modality: kind, guessed: !modality, verdict: verdict(checks), checks, body_threshold: bodyThreshold, padding };
}

// A uniform region around a clicked voxel, for signal and background measurements. The seed is
// a ball of about 1.5 mm; the region then grows from the click through connected voxels within
// 3 robust SDs of the seed median, up to radiusMm, so it stops at edges between tissues.
export const SEED_RADIUS_MM = 1.5;
export const REGION_RADIUS_MM = 5;
const MIN_REGION_VOXELS = 20;

function robustSd(values) {
  return mad(values);
}

export function regionStats(vol, voxel, { radiusMm = REGION_RADIUS_MM } = {}) {
  const [nx, ny, nz] = vol.size;
  const sp = vol.spacing;
  const at = reader(vol);
  const c = voxel.map((v) => Math.round(v));
  if (c.some((v, a) => v < 0 || v >= vol.size[a])) throw new Error("The point is outside the scan.");
  const inside = (x, y, z, r) => ((x - c[0]) * sp[0]) ** 2 + ((y - c[1]) * sp[1]) ** 2 + ((z - c[2]) * sp[2]) ** 2 <= r * r;
  const seedReach = sp.map((s) => Math.max(1, Math.ceil(SEED_RADIUS_MM / s)));
  const seed = [];
  for (let z = Math.max(0, c[2] - seedReach[2]); z <= Math.min(nz - 1, c[2] + seedReach[2]); z++)
    for (let y = Math.max(0, c[1] - seedReach[1]); y <= Math.min(ny - 1, c[1] + seedReach[1]); y++)
      for (let x = Math.max(0, c[0] - seedReach[0]); x <= Math.min(nx - 1, c[0] + seedReach[0]); x++)
        if (inside(x, y, z, Math.max(SEED_RADIUS_MM, ...sp))) seed.push(at(x + nx * (y + ny * z)));
  const seedMedian = median(seed);
  // A floor on the band keeps a perfectly flat seed (clipped or synthetic) from stopping the growth.
  const spread = Math.max(robustSd(seed), 1e-3 * Math.abs(seedMedian), 1e-6);
  const low = seedMedian - 3 * spread;
  const high = seedMedian + 3 * spread;
  const start = c[0] + nx * (c[1] + ny * c[2]);
  if (at(start) < low || at(start) > high) {
    throw new Error("The point is on an edge between tissues. Move it into the middle of a uniform area.");
  }
  const seen = new Set([start]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % nx;
    const y = Math.floor(i / nx) % ny;
    const z = Math.floor(i / (nx * ny));
    const steps = [[x - 1, y, z], [x + 1, y, z], [x, y - 1, z], [x, y + 1, z], [x, y, z - 1], [x, y, z + 1]];
    for (const [a, b, d] of steps) {
      if (a < 0 || b < 0 || d < 0 || a >= nx || b >= ny || d >= nz || !inside(a, b, d, radiusMm)) continue;
      const j = a + nx * (b + ny * d);
      if (seen.has(j)) continue;
      seen.add(j);
      const v = at(j);
      if (v >= low && v <= high) queue.push(j);
    }
  }
  if (queue.length < MIN_REGION_VOXELS) {
    throw new Error("The uniform area around this point is too small to measure. Move it into a larger uniform area.");
  }
  const values = queue.map(at);
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / values.length;
  let sq = 0;
  for (const v of values) sq += (v - mean) ** 2;
  return {
    voxel: c,
    median: median(values),
    noise_sd: robustSd(values),
    mean,
    sd: Math.sqrt(sq / Math.max(1, values.length - 1)),
    voxels: queue,
    count: values.length,
    volume_ml: (values.length * sp[0] * sp[1] * sp[2]) / 1000,
    radius_mm: radiusMm,
    band: [low, high],
  };
}

// SNR is the signal over the noise in the signal region, and CNR is the signal minus the
// background over that same noise, as on the coronary CT angiography page (aorta and fat).
export function contrastMetrics(signal, background) {
  const out = {};
  if (signal) out.snr = signal.noise_sd > 0 ? signal.median / signal.noise_sd : NaN;
  if (signal && background) out.cnr = signal.noise_sd > 0 ? (signal.median - background.median) / signal.noise_sd : NaN;
  return out;
}
