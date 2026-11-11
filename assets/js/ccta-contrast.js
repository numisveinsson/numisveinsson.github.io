const NIIVUE_URL = "https://cdn.jsdelivr.net/npm/@niivue/niivue@0.69.0/dist/index.js";
const MM_PER_UNIT = { mm: 1, cm: 10 };
const LABEL_AORTA = 2;
const LABEL_CLICK = 3;
const LABEL_FAT = 4;
const LABEL_LINE = 5;
const LABEL_CALCIUM = 6;
const MARKER_RADIUS_MM = 1.2;
const LINE_RADIUS_MM = 0.5;
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const AUTOTABLE_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
const ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";
const SEED_RADIUS_MM = 2; // sizes only the first prediction box
const STEPS_PER_TREE = { left: 80, right: 40 }; // the left tree has two main branches
const STEPS_PER_BRANCH = 40; // so one branch cannot use a whole tree's steps
const VESSEL_ORDER = ["LM", "LAD", "LCx", "RCA"];
const SEED_KINDS = ["left", "leftNext", "right", "rightNext"];
const SEED_TEXT = { left: "Left start", leftNext: "Left direction", right: "Right start", rightNext: "Right direction" };
// Aortic root of the example scan (Vascular Model Repository 0066_H_CORO_H), in RAS and the image's unit (cm).
const EXAMPLE_AORTA = [25.88, 4.88, -14.5];
// Epicardial fat beside the proximal LAD of the same scan.
const EXAMPLE_FAT = [21.58, 4.847, -12.6975];
// Proximal left coronary of the same scan. The crop cuts close to the right coronary.
const EXAMPLE_LEFT = [23.3975, 3.4162, -13.6975];
const EXAMPLE_LEFT_NEXT = [23.1268, 3.5709, -13.4975];
// Every aortic root ROI in the CAS-X test set was at least 4 mL, so a smaller one is
// probably a smaller vessel or a chamber edge, not the aorta.
const MIN_ROI_ML = 3;
// The same check for a 2D region: about a 7 mm wide disc after the 3 mm margin.
const MIN_ROI_MM2 = 40;
const MIN_LUMEN_HU = 150;
const MIN_FAT_ML = 0.005;
const MIN_FAT_MM2 = 3;
// Radii for the aortic ROI size check; the measurement itself uses 12 mm.
const SWEEP_RADII_MM = [4, 6, 8, 10, 12, 14, 16, 18, 20];
const ROI_RADIUS_MM = 12;
const PLANE_TEXT = { "3d": "3D", axial: "2D axial", coronal: "2D coronal", sagittal: "2D sagittal" };
const MAX_FAT_HU = -50;
// At 1 mm or more between slices, partial volume along the slice axis lowers small-vessel HU.
const THICK_SLICE_MM = 1;
// Display windows as [level, width] in HU.
const WINDOWS = { vessels: [350, 900], soft: [40, 400], fat: [-100, 300], calcium: [500, 2000] };

const root = document.getElementById("snr");
const el = (name) => document.getElementById(`snr-${name}`);
const reference = JSON.parse(document.getElementById("snr-reference").textContent);
const corePromise = import(root.dataset.core);

let nv;
let SLICE_TYPE;
let scan;
let volume = null; // the scan in LPS mm, built once per scan and unit
// Each measured region is { n, report, click, warnings, plane }. Several can be measured,
// and the values used downstream are their mean, kept in `aorta` and `fat` as { report, warnings, count }.
let aortaRois = [];
let fatRois = [];
let aorta = null;
let fat = null;
let sweep = null; // { n, plane, rows } for the latest aortic region
let example = false;
let seeds = { left: null, leftNext: null, right: null, rightNext: null }; // RAS, image unit
let coronary = null; // { vessels, profiles, summary }
let tracing = false;
let worker = null;
let stopTrace = null;

function setStatus(message, isError = false) {
  el("status").textContent = message;
  el("status").classList.toggle("is-error", isError);
}

function setLoadStatus(message, isError = false) {
  el("load-status").textContent = message;
  el("load-status").classList.toggle("is-error", isError);
}

function columnLength(affine, column) {
  return Math.hypot(affine[0][column], affine[1][column], affine[2][column]);
}

// The metrics work in millimetres and LPS. NiiVue gives an RAS affine in the image's unit.
function toMetricVolume(source, unit) {
  const { hdr, img } = source;
  const scale = MM_PER_UNIT[unit];
  const size = hdr.dims.slice(1, 4);
  const lps = hdr.affine.slice(0, 3).map((row, r) => row.map((value, c) => (r < 2 ? -value : value) * (c === 3 ? scale : 1)));
  const lengths = [0, 1, 2].map((c) => Math.hypot(lps[0][c], lps[1][c], lps[2][c]));
  const direction = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) direction.push(lps[r][c] / lengths[c]);
  const slope = hdr.scl_slope || 1;
  const inter = hdr.scl_inter || 0;
  const data = new Float32Array(img.length);
  for (let i = 0; i < img.length; i++) data[i] = img[i] * slope + inter;
  return { size, spacing: lengths.map((value) => value * scale), origin: [lps[0][3], lps[1][3], lps[2][3]], direction, data };
}

const unitScale = () => MM_PER_UNIT[el("unit").value];
const rasToLps = (p) => [-p[0] * unitScale(), -p[1] * unitScale(), p[2] * unitScale()];
const lpsToRas = (p) => [-p[0] / unitScale(), -p[1] / unitScale(), p[2] / unitScale()];

function lpsOfIndex(vol, n) {
  const [nx, ny] = vol.size;
  const z = Math.floor(n / (nx * ny));
  const y = Math.floor((n - z * nx * ny) / nx);
  const x = n - nx * (y + ny * z);
  const { direction: d, spacing: s, origin: o } = vol;
  const a = x * s[0];
  const b = y * s[1];
  const c = z * s[2];
  return [o[0] + d[0] * a + d[1] * b + d[2] * c, o[1] + d[3] * a + d[4] * b + d[5] * c, o[2] + d[6] * a + d[7] * b + d[8] * c];
}

// Draws into NiiVue's drawing layer, which is indexed in RAS voxel order.
function drawVoxel(ras) {
  const dims = nv.back.dimsRAS;
  const frac = nv.mm2frac(ras);
  const v = [0, 1, 2].map((axis) => Math.round(frac[axis] * dims[axis + 1] - 0.5));
  if (v.some((value, axis) => value < 0 || value >= dims[axis + 1])) return null;
  return v[0] + v[1] * dims[1] + v[2] * dims[1] * dims[2];
}

function drawMarker(bitmap, click, label = LABEL_CLICK, radiusMm = MARKER_RADIUS_MM) {
  const dims = nv.back.dimsRAS;
  const spacing = nv.back.pixDimsRAS;
  const frac = nv.mm2frac(click);
  const centre = [0, 1, 2].map((axis) => Math.round(frac[axis] * dims[axis + 1] - 0.5));
  const reach = [1, 2, 3].map((axis) => Math.max(Math.ceil(radiusMm / unitScale() / spacing[axis]), 1));
  for (let z = -reach[2]; z <= reach[2]; z++) {
    for (let y = -reach[1]; y <= reach[1]; y++) {
      for (let x = -reach[0]; x <= reach[0]; x++) {
        if ((x / reach[0]) ** 2 + (y / reach[1]) ** 2 + (z / reach[2]) ** 2 > 1) continue;
        const [i, j, k] = [centre[0] + x, centre[1] + y, centre[2] + z];
        if (i < 0 || j < 0 || k < 0 || i >= dims[1] || j >= dims[2] || k >= dims[3]) continue;
        bitmap[i + j * dims[1] + k * dims[1] * dims[2]] = label;
      }
    }
  }
}

// Redraws the regions, traced centrelines and click markers.
function redraw() {
  const bitmap = nv.drawBitmap;
  bitmap.fill(0);
  for (const [rois, label] of [[aortaRois, LABEL_AORTA], [fatRois, LABEL_FAT]]) {
    for (const roi of rois) {
      for (const n of roi.report.voxels) {
        const at = drawVoxel(lpsToRas(lpsOfIndex(volume, n)));
        if (at !== null) bitmap[at] = label;
      }
    }
  }
  if (coronary?.profiles) {
    for (const profile of Object.values(coronary.profiles)) {
      profile.points.forEach((p, i) => drawMarker(bitmap, lpsToRas(p), profile.calcified[i] ? LABEL_CALCIUM : LABEL_LINE, LINE_RADIUS_MM));
    }
  }
  for (const roi of [...aortaRois, ...fatRois]) drawMarker(bitmap, roi.click);
  for (const kind of SEED_KINDS) if (seeds[kind]) drawMarker(bitmap, seeds[kind]);
  nv.refreshDrawing(true);
}

// Share of the CAS-X test scans below this value.
function rank(values, value) {
  let below = 0;
  for (const v of values) if (v < value) below += 1;
  return Math.round((100 * below) / values.length);
}

const describe = (values, value) => `Above ${rank(values, value)}% of CAS-X scans`;

function aortaWarnings(report) {
  const warnings = [];
  if (report.source === "fixed_ball") {
    warnings.push("The lumen could not be outlined here, so this is a plain 8 mm sphere around the point.");
  } else if (report.area_mm2 !== undefined ? report.area_mm2 < MIN_ROI_MM2 : report.roi_ml < MIN_ROI_ML) {
    warnings.push("The bright region found here is too small for the aortic root.");
  }
  if (report.median_hu < MIN_LUMEN_HU) warnings.push("This is low for a contrast-filled aorta.");
  return warnings;
}

function fatWarnings(report) {
  const warnings = [];
  if (report.area_mm2 !== undefined ? report.area_mm2 < MIN_FAT_MM2 : report.roi_ml < MIN_FAT_ML) warnings.push("The fat region here is very small.");
  if (report.median_hu > MAX_FAT_HU) warnings.push("This is high for fat, so heart muscle or vessel wall may be mixed in.");
  return warnings;
}

function refreshChips() {
  const aortaChip = el("chip-aorta");
  const regions = (count) => (count > 1 ? `${count} ROIs · ` : "");
  aortaChip.textContent = aorta ? `${regions(aorta.count)}${Math.round(aorta.report.median_hu)} HU · SNR ${aorta.report.snr.toFixed(1)}` : "not measured";
  aortaChip.classList.toggle("is-done", Boolean(aorta) && !aorta.warnings.length);
  aortaChip.classList.toggle("is-warning", Boolean(aorta?.warnings.length));
  const fatChip = el("chip-fat");
  fatChip.textContent = fat ? `${regions(fat.count)}${String(Math.round(fat.report.median_hu)).replace("-", "−")} HU${aorta ? ` · CNR ${cnr().toFixed(1)}` : ""}` : "optional, for CNR";
  fatChip.classList.toggle("is-done", Boolean(fat) && !fat.warnings.length);
  fatChip.classList.toggle("is-warning", Boolean(fat?.warnings.length));
  el("run-aorta").textContent = aortaRois.length ? "Add aortic ROI" : "Measure aorta";
  el("run-fat").textContent = fatRois.length ? "Add fat ROI" : "Measure fat";
  el("clear-aorta").hidden = !aortaRois.length;
  el("clear-fat").hidden = !fatRois.length;
}

const sizeRatio = (r, ml, mm2) => (r.area_mm2 !== undefined ? r.area_mm2 / mm2 : r.roi_ml / ml);
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const roiName = (kind, roi) => `${kind === "aorta" ? "Aorta" : "Fat"} ${roi.n}`;

// Mean of the regions' values. The region smallest for its limit stands in for the size checks.
function combine() {
  aorta = null;
  fat = null;
  if (aortaRois.length) {
    const reports = aortaRois.map((r) => r.report);
    const median_hu = mean(reports.map((r) => r.median_hu));
    const noise_sd = mean(reports.map((r) => r.noise_sd));
    const tightest = reports.reduce((a, b) => (sizeRatio(b, MIN_ROI_ML, MIN_ROI_MM2) < sizeRatio(a, MIN_ROI_ML, MIN_ROI_MM2) ? b : a));
    const report = { median_hu, noise_sd, snr: noise_sd ? median_hu / noise_sd : NaN, roi_ml: tightest.roi_ml, source: reports.some((r) => r.source === "fixed_ball") ? "fixed_ball" : "region_growing" };
    if (tightest.area_mm2 !== undefined) report.area_mm2 = tightest.area_mm2;
    const several = aortaRois.length > 1;
    aorta = { report, count: aortaRois.length, warnings: aortaRois.flatMap((r) => r.warnings.map((w) => (several ? `${roiName("aorta", r)}: ${w}` : w))) };
  }
  if (fatRois.length) {
    const several = fatRois.length > 1;
    fat = {
      report: { median_hu: mean(fatRois.map((r) => r.report.median_hu)) },
      count: fatRois.length,
      warnings: fatRois.flatMap((r) => r.warnings.map((w) => (several ? `${roiName("fat", r)}: ${w}` : w))),
    };
  }
}

const roiSize = (report) => (report.area_mm2 !== undefined ? `${Math.round(report.area_mm2)} mm²` : report.roi_ml >= 0.1 ? `${report.roi_ml.toFixed(1)} mL` : `${Math.round(report.roi_ml * 1000)} mm³`);

function showRois() {
  const rows = [];
  const cell = (tag, text, attrs = {}) => Object.assign(document.createElement(tag), { textContent: text }, attrs);
  for (const [kind, rois] of [["aorta", aortaRois], ["fat", fatRois]]) {
    for (const roi of rois) {
      const r = roi.report;
      const tr = document.createElement("tr");
      const name = cell("th", roiName(kind, roi), { scope: "row" });
      if (roi.warnings.length) name.append(Object.assign(document.createElement("span"), { className: "snr-ref snr-flag", textContent: "check", title: roi.warnings.join(" ") }));
      const remove = cell("button", "×", { type: "button", className: "snr-remove", title: `Remove ${roiName(kind, roi)}` });
      remove.setAttribute("aria-label", `Remove ${roiName(kind, roi)}`);
      remove.addEventListener("click", () => removeRoi(kind, roi));
      const removeCell = document.createElement("td");
      removeCell.append(remove);
      tr.append(
        name,
        cell("td", PLANE_TEXT[roi.plane]),
        cell("td", roiSize(r)),
        cell("td", `${String(Math.round(r.median_hu)).replace("-", "−")}`),
        cell("td", r.noise_sd.toFixed(1)),
        cell("td", kind === "aorta" ? r.snr.toFixed(1) : "–"),
        removeCell
      );
      rows.push(tr);
    }
  }
  el("roi-rows").replaceChildren(...rows);
}

async function removeRoi(kind, roi) {
  if (kind === "aorta") aortaRois = aortaRois.filter((r) => r !== roi);
  else fatRois = fatRois.filter((r) => r !== roi);
  if (kind === "aorta" && sweep?.n === roi.n) sweep = null;
  await afterRoisChanged();
}

async function clearRois(kind) {
  if (kind === "aorta") {
    aortaRois = [];
    sweep = null;
  } else fatRois = [];
  await afterRoisChanged();
}

// Vessel values are relative to the aorta and fat, so they follow any change of region.
async function afterRoisChanged() {
  combine();
  if (coronary?.vessels) {
    if (aorta) measureCoronaries(await corePromise);
    else el("coronary-result").hidden = true;
  }
  redraw();
  showResults();
  refreshTraceButton();
}

function showResults() {
  refreshChips();
  const rows = { aorta: Boolean(aorta), fat: Boolean(fat), cnr: Boolean(aorta && fat) };
  document.querySelectorAll("[data-snr-row]").forEach((row) => (row.hidden = !rows[row.dataset.snrRow]));
  const notes = [];
  const problems = [];
  if (aorta) {
    const { report, warnings } = aorta;
    const trusted = !warnings.length;
    el("hu").textContent = `${Math.round(report.median_hu)} HU`;
    el("noise").textContent = `${report.noise_sd.toFixed(1)} HU`;
    el("snr").textContent = report.snr.toFixed(1);
    // The CAS-X comparison was measured with one 3D region, so it is shown only for those.
    const comparable = trusted && aortaRois.every((r) => r.plane === "3d");
    el("hu-ref").textContent = comparable ? describe(reference.median_hu, report.median_hu) : "";
    el("noise-ref").textContent = comparable ? describe(reference.noise_sd, report.noise_sd) : "";
    el("snr-ref").textContent = comparable ? describe(reference.snr, report.snr) : "";
    notes.push(aorta.count > 1 ? `Aorta: the mean of ${aorta.count} regions, in red.` : `Aorta: ${roiSize(aortaRois[0].report)} of lumen, in red.`);
    if (!trusted) problems.push(`${warnings.join(" ")} Check that the aortic point is inside the aortic root.`);
  }
  if (fat) {
    const { report, warnings } = fat;
    el("fat").textContent = `${String(Math.round(report.median_hu)).replace("-", "−")} HU`;
    notes.push(fat.count > 1 ? `Fat: the mean of ${fat.count} regions, in blue.` : `Fat: ${roiSize(fatRois[0].report)}, in blue.`);
    if (warnings.length) problems.push(`${warnings.join(" ")} Try a larger patch of fat.`);
  }
  if (rows.cnr) el("cnr").textContent = cnr().toFixed(1);
  el("summary").textContent = [...problems, ...notes].join(" ");
  el("summary").classList.toggle("is-error", problems.length > 0);
  showRois();
  showSweep();
  el("result").hidden = !aorta && !fat;
}

function cnr() {
  return (aorta.report.median_hu - fat.report.median_hu) / aorta.report.noise_sd;
}

async function measure(kind, rasPoint) {
  el("run-aorta").disabled = true;
  el("run-fat").disabled = true;
  setStatus("Measuring...");
  await new Promise((resolve) => setTimeout(resolve));
  try {
    const core = await corePromise;
    volume ??= toMetricVolume(scan, el("unit").value);
    core.checkImage(volume);
    const mode = el("roi-mode").value;
    const options = mode === "3d" ? {} : { plane: mode };
    if (kind === "aorta") {
      const report = core.aortaMetrics(volume, rasToLps(rasPoint), options);
      if (!Number.isFinite(report.snr)) throw new core.InvalidImage("The noise could not be measured at this point. Try a point inside the aortic root.");
      const roi = { n: aortaRois.length ? Math.max(...aortaRois.map((r) => r.n)) + 1 : 1, report, click: rasPoint, warnings: aortaWarnings(report), plane: mode };
      aortaRois.push(roi);
      sweep = { n: roi.n, plane: mode, rows: core.aortaRoiSweep(volume, rasToLps(rasPoint), SWEEP_RADII_MM, options) };
    } else {
      const report = core.fatMetrics(volume, rasToLps(rasPoint), options);
      if (!report) throw new Error(`There is no fat within 3 mm of this point${mode === "3d" ? "" : " in this slice"}. Move the crosshair into fat, which looks almost black here, and measure again.`);
      fatRois.push({ n: fatRois.length ? Math.max(...fatRois.map((r) => r.n)) + 1 : 1, report, click: rasPoint, warnings: fatWarnings(report), plane: mode });
    }
    await afterRoisChanged();
    setStatus("");
    return true;
  } catch (error) {
    setStatus(error.message || "The measurement failed.", true);
    return false;
  } finally {
    el("run-aorta").disabled = false;
    el("run-fat").disabled = false;
    refreshTraceButton();
  }
}

function report() {
  const out = {};
  if (scan) out.scan = { ...scanGeometry(), thick_slices: thickSlices() };
  const regionOf = (roi, centreKey) => {
    const r = roi.report;
    const out = { region: roi.n, type: PLANE_TEXT[roi.plane], point_lps_mm: rasToLps(roi.click), [centreKey]: r.center, median_hu: r.median_hu, noise_sd_hu: r.noise_sd };
    if (r.snr !== undefined) Object.assign(out, { snr: r.snr, roi_source: r.source });
    if (r.area_mm2 !== undefined) out.area_mm2 = r.area_mm2;
    else out.volume_ml = r.roi_ml;
    out.warnings = roi.warnings;
    return out;
  };
  if (aorta) {
    const r = aorta.report;
    out.aorta = { median_hu: r.median_hu, noise_sd_hu: r.noise_sd, snr: r.snr, combined: aorta.count > 1 ? "mean over regions" : "single region", regions: aortaRois.map((roi) => regionOf(roi, "lumen_center_lps_mm")), warnings: aorta.warnings };
    if (sweep) out.aorta.roi_size_check = { region: sweep.n, type: PLANE_TEXT[sweep.plane], used_radius_mm: ROI_RADIUS_MM, rows: sweep.rows };
  }
  if (fat) {
    out.fat = { median_hu: fat.report.median_hu, combined: fat.count > 1 ? "mean over regions" : "single region", regions: fatRois.map((roi) => regionOf(roi, "fat_center_lps_mm")), warnings: fat.warnings };
  }
  if (aorta && fat) out.cnr = { value: cnr(), definition: "(aortic lumen HU - fat HU) / aortic noise SD" };
  if (coronary?.summary) {
    out.coronaries = {
      seeds_lps_mm: Object.fromEntries(SEED_KINDS.map((k) => [k, seeds[k] && rasToLps(seeds[k])])),
      steps_per_tree: STEPS_PER_TREE,
      max_steps_per_branch: STEPS_PER_BRANCH,
      definitions: {
        hu_ratio: "lumen HU / aortic HU",
        snr: "lumen HU / aortic noise SD",
        cnr: "(lumen HU - median perivascular fat HU) / aortic noise SD",
        bands: "0-40, 40-80 and 80+ mm from the vessel origin",
        score: "per band 0.4 CNR + 0.3 noise + 0.3 lumen, each on a 0-1 ramp (aortic noise 45 to 20 HU; CNR 10 to 20, 8 to 16, 5 to 12 for proximal, mid, distal; lumen 150 to 250 HU, the SCCT 2016 target, with no upper limit); vessel = band-weighted mean (0.4, 0.35, 0.25); scan = 0.6 weakest vessel + 0.4 mean. Provisional.",
        flags: "a band may be non-diagnostic (after the CAD-RADS 2.0 N modifier) for lumen below 150 HU, CNR below its band's floor, at least half its length calcified, or a focal HU dip; any flag, an unassessed vessel or aortic noise above 45 HU sends the scan to manual review",
        calcium: "voxels within 1.5 mm of the centreline above max(aortic HU, running median of lumen HU over 20 mm) + 4 aortic noise SD",
      },
      vessels: coronary.summary,
      quality: coronary.quality,
    };
  }
  return out;
}

function moveCrosshair(point) {
  nv.scene.crosshairPos = nv.mm2frac(point);
  nv.drawScene();
}

// Voxel size in mm and image size, from the header and the chosen unit.
function scanGeometry() {
  const spacing = [0, 1, 2].map((c) => columnLength(scan.hdr.affine, c) * unitScale());
  return { size: scan.hdr.dims.slice(1, 4), spacing_mm: spacing, slice_spacing_mm: Math.max(...spacing) };
}

const thickSlices = () => scan && scanGeometry().slice_spacing_mm >= THICK_SLICE_MM - 1e-6;

function showScanInfo() {
  const { size, spacing_mm: spacing, slice_spacing_mm: slice } = scanGeometry();
  el("scan-info").textContent = `Scan: ${size.join(" × ")} voxels of ${spacing.map((v) => v.toFixed(2)).join(" × ")} mm`;
  const warning = el("scan-warning");
  warning.hidden = !thickSlices();
  warning.textContent = `Slices are ${slice.toFixed(2)} mm apart. At 1 mm or more, small vessels read darker than they are, so the vessel HU, CNR and score are less reliable. Thin reconstructions of 0.5 to 0.75 mm are recommended.`;
}

function applyWindow(level, width) {
  if (!scan || !Number.isFinite(level) || !Number.isFinite(width) || width <= 0) return;
  scan.cal_min = level - width / 2;
  scan.cal_max = level + width / 2;
  nv.updateGLVolume();
}

function setWindowPreset(name) {
  el("window-preset").value = name;
  if (!WINDOWS[name]) return;
  const [level, width] = WINDOWS[name];
  el("window-level").value = String(level);
  el("window-width").value = String(width);
  applyWindow(level, width);
}

// A shift-drag (or a right or middle drag) on the image changes the window: dragging up
// raises the level and dragging right widens the window. A plain click or drag moves the
// crosshair as before. Touch keeps Niivue's crosshair drag.
const LEVEL_HU_PER_PX = 2;
const WIDTH_HU_PER_PX = 4;

function setUpWindowDrag(DRAG_MODE) {
  nv.opts.mouseEventConfig = {
    leftButton: { primary: DRAG_MODE.crosshair, withShift: DRAG_MODE.none },
    rightButton: DRAG_MODE.none,
    centerButton: DRAG_MODE.none,
  };
  let press = null;
  el("canvas").addEventListener("mousedown", (event) => {
    const windowing = event.button === 0 ? event.shiftKey : true;
    press = scan && windowing
      ? { x: event.clientX, y: event.clientY, level: (scan.cal_min + scan.cal_max) / 2, width: scan.cal_max - scan.cal_min }
      : null;
  });
  window.addEventListener("mousemove", (event) => {
    if (!press) return;
    const level = Math.round(press.level - (event.clientY - press.y) * LEVEL_HU_PER_PX);
    const width = Math.max(Math.round(press.width + (event.clientX - press.x) * WIDTH_HU_PER_PX), 1);
    el("window-preset").value = "custom";
    el("window-level").value = String(level);
    el("window-width").value = String(width);
    applyWindow(level, width);
  });
  window.addEventListener("mouseup", () => {
    press = null;
  });
}

function crosshairWorld() {
  const mm = nv.frac2mm(nv.scene.crosshairPos);
  return [mm[0], mm[1], mm[2]];
}

async function loadScan(file) {
  try {
    setLoadStatus("Loading the scan...");
    el("viewer").hidden = false;
    if (!nv) {
      const niivue = await import(NIIVUE_URL);
      SLICE_TYPE = niivue.SLICE_TYPE;
      nv = new niivue.Niivue({ backColor: [0, 0, 0, 1], crosshairColor: [1, 0.85, 0.2, 1], crosshairWidth: 1, isResizeCanvas: true, isRadiologicalConvention: true, sagittalNoseLeft: true });
      await nv.attachToCanvas(el("canvas"));
      nv.opts.multiplanarShowRender = 0;
      setUpWindowDrag(niivue.DRAG_MODE);
    }
    scan = null;
    volume = null;
    aortaRois = [];
    fatRois = [];
    sweep = null;
    combine();
    example = false;
    resetCoronary(true);
    refreshChips();
    el("result").hidden = true;
    nv.closeDrawing();
    await nv.loadVolumes([]);
    await nv.loadFromFile(file);
    scan = nv.volumes[0];
    if (scan.hdr.dims[0] > 3 && scan.hdr.dims[4] > 1) {
      throw Object.assign(new Error("Please use a single 3D volume."), { isScanError: true });
    }
    nv.setSliceType(SLICE_TYPE.MULTIPLANAR);
    nv.createEmptyDrawing();
    nv.setDrawColormap({
      R: [0, 0, 230, 255, 40, 60, 255],
      G: [0, 0, 60, 215, 170, 220, 140],
      B: [0, 0, 60, 0, 255, 90, 0],
      A: [0, 255, 140, 255, 160, 255, 255],
      labels: ["", "", "Aorta", "Point", "Fat", "Centreline", "Calcium"],
    });
    nv.setDrawOpacity(0.6);
    setWindowPreset("vessels");
    const spacing = Math.min(columnLength(scan.hdr.affine, 0), columnLength(scan.hdr.affine, 1));
    el("unit").value = spacing < 0.15 ? "cm" : "mm";
    showScanInfo();
    el("panel").hidden = false;
    el("coronary").hidden = false;
    setStatus("");
    setLoadStatus("");
  } catch (error) {
    scan = null;
    el("viewer").hidden = true;
    el("panel").hidden = true;
    el("coronary").hidden = true;
    const message = error.isScanError ? error.message : "This file could not be opened. Please use a NIfTI, MHA, NRRD or DICOM scan.";
    setLoadStatus(message, true);
  }
}

async function loadExample() {
  el("example").disabled = true;
  setLoadStatus("Downloading the example scan (19 MB)...");
  try {
    const response = await fetch(root.dataset.example);
    if (!response.ok) throw new Error("Download failed.");
    await loadScan(new File([await response.blob()], "example.nii.gz"));
    if (!scan) return;
    example = true;
    moveCrosshair(EXAMPLE_AORTA);
    setStatus("Example ready. The crosshair is in the aortic root. Press Measure aorta.");
  } catch {
    setLoadStatus("The example scan could not be loaded. Please try again.", true);
  } finally {
    el("example").disabled = false;
  }
}

// DICOM files are converted to NIfTI in the browser with dcm2niix (WebAssembly), then
// loaded like any other scan. A folder may hold several series; the largest is shown first.
const VOLUME_FILE = /\.(nii|nii\.gz|mha|mhd|nrrd|nhdr)$/i;
// dcm2niix exit codes that still leave usable output: 0 done, 8 some files failed, 10 incomplete volumes.
const DICOM_USABLE_EXITS = [0, 8, 10];

// Runs dcm2niix in its own worker. The worker's file system keeps its folders after a run,
// so each conversion gets a fresh one.
async function runDcm2niix(files, args) {
  const { Dcm2niix } = await import(new URL(root.dataset.dcm2niix, location.href).href);
  const converter = new Dcm2niix();
  await converter.init();
  try {
    return await new Promise((resolve, reject) => {
      converter.worker.onmessage = ({ data }) => {
        if (data.type === "error") reject(new Error(data.message || "dcm2niix failed"));
        else if (DICOM_USABLE_EXITS.includes(data.exitCode)) resolve(data.convertedFiles);
        else reject(new Error(`dcm2niix exit code ${data.exitCode}`));
      };
      converter.worker.postMessage({ fileList: converter.conformFileList(files), cmd: args });
    });
  } finally {
    converter.worker.terminate();
  }
}

async function convertDicom(files) {
  setLoadStatus(`Converting ${files.length} DICOM file${files.length > 1 ? "s" : ""}...`);
  el("series-row").hidden = true;
  try {
    // No BIDS sidecar, no compression, skip localizers, and name files by series number only.
    const converted = await runDcm2niix(files, ["-b", "n", "-z", "n", "-i", "y", "-f", "series_%s"]);
    const volumes = converted.filter((f) => /\.nii$/i.test(f.name)).sort((a, b) => b.size - a.size);
    if (!volumes.length) throw new Error("No image series was found in these DICOM files.");
    const select = el("series");
    select.replaceChildren(...volumes.map((f, i) => Object.assign(document.createElement("option"), { value: String(i), textContent: `${f.name.replace(/\.nii$/i, "").replace(/_/g, " ")} (${(f.size / 1e6).toFixed(0)} MB)` })));
    select.onchange = () => loadScan(volumes[Number(select.value)]);
    el("series-row").hidden = volumes.length < 2;
    await loadScan(volumes[0]);
  } catch (error) {
    setLoadStatus(error.message?.startsWith("No image series") ? error.message : "These DICOM files could not be converted. Please check they are one CT series.", true);
  }
}

function openFiles(files) {
  if (!files.length) return;
  if (files.length === 1 && VOLUME_FILE.test(files[0].name)) {
    el("series-row").hidden = true;
    loadScan(files[0]);
  } else convertDicom(files);
}

// Files from a dropped folder, with their relative paths, which dcm2niix uses to group series.
async function droppedFiles(transfer) {
  const entries = [...transfer.items].map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.some((entry) => entry.isDirectory)) return [...transfer.files];
  const out = [];
  const walk = async (entry, path) => {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      file._webkitRelativePath = `${path}${file.name}`;
      out.push(file);
      return;
    }
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await walk(child, `${path}${entry.name}/`);
    }
  };
  for (const entry of entries) await walk(entry, "");
  return out;
}

el("file").addEventListener("change", (event) => openFiles([...event.target.files]));
el("folder").addEventListener("click", () => el("folder-input").click());
el("folder-input").addEventListener("change", (event) => openFiles([...event.target.files]));
const drop = el("drop");
["dragenter", "dragover"].forEach((name) =>
  drop.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.add("is-over");
  })
);
["dragleave", "drop"].forEach((name) =>
  drop.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.remove("is-over");
  })
);
drop.addEventListener("drop", async (event) => openFiles(await droppedFiles(event.dataTransfer)));
el("example").addEventListener("click", loadExample);
el("window-preset").addEventListener("change", (event) => setWindowPreset(event.target.value));
for (const name of ["window-level", "window-width"]) {
  el(name).addEventListener("input", () => {
    el("window-preset").value = "custom";
    applyWindow(Number(el("window-level").value), Number(el("window-width").value));
  });
}
el("run-aorta").addEventListener("click", async () => {
  const done = await measure("aorta", crosshairWorld());
  // In the example, lead on to the fat point once the aorta is done.
  if (done && example && !fatRois.length) {
    moveCrosshair(EXAMPLE_FAT);
    setStatus("The crosshair is now in epicardial fat beside the left anterior descending artery. Press Measure fat.");
  }
});
el("run-fat").addEventListener("click", async () => {
  const done = await measure("fat", crosshairWorld());
  if (done && example && !seeds.left) {
    setSeed("left", EXAMPLE_LEFT);
    setSeed("leftNext", EXAMPLE_LEFT_NEXT);
    setStatus("");
    setTraceStatus("The left coronary points are set. The example scan is cropped close to the right coronary, so only the left is traced. Press Trace and measure.");
  }
});
el("clear-aorta").addEventListener("click", () => clearRois("aorta"));
el("clear-fat").addEventListener("click", () => clearRois("fat"));
el("unit").addEventListener("change", () => {
  if (scan) showScanInfo();
  volume = null;
  aortaRois = [];
  fatRois = [];
  sweep = null;
  combine();
  resetCoronary(true);
  refreshChips();
  if (nv) redraw();
  el("result").hidden = true;
});
el("copy").addEventListener("click", async () => {
  if (!aorta && !fat) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(report(), null, 2));
    setStatus("Copied.");
  } catch {
    setStatus("The browser did not allow copying.", true);
  }
});

// Coronary tracing. SeqSeg runs in a worker, one tree at a time, so each tree gets its own
// step budget. The measurements then follow src/iqa_tool: a lumen sample every millimetre
// along the main vessels, with calcium flagged from the aortic HU and noise.

let backend = "";
const TABLE_VESSELS = ["LAD", "LCx", "RCA"];
const BAND_LABELS = { proximal: "0–40 mm", mid: "40–80 mm", distal: "80+ mm" };
const SVG_NS = "http://www.w3.org/2000/svg";

function setTraceStatus(message, isError = false) {
  el("trace-status").textContent = message;
  el("trace-status").classList.toggle("is-error", isError);
}

// The coronaries with both points set. Either can be traced alone.
const readyTrees = () => ["left", "right"].filter((kind) => seeds[kind] && seeds[`${kind}Next`]);

function refreshTraceButton() {
  const ready = readyTrees().length > 0;
  el("trace").disabled = tracing || !ready || !aorta;
  el("trace-hint").textContent = !aorta
    ? "Measure the aorta first, since the vessel values are relative to it."
    : ready
      ? ""
      : "Set the start and direction of at least one coronary.";
}

// The toolbar shows each coronary's points as ticks on its buttons and a short state label.
function refreshSeedState() {
  for (const kind of SEED_KINDS) {
    el(`set-${kind}`).classList.toggle("is-set", Boolean(seeds[kind]));
    el(`set-${kind}`).title = seeds[kind] ? `${SEED_TEXT[kind]}: ${seeds[kind].map((v) => v.toFixed(1)).join(", ")} ${el("unit").value}` : "";
  }
  for (const side of ["left", "right"]) {
    const count = [seeds[side], seeds[`${side}Next`]].filter(Boolean).length;
    const chip = el(`chip-${side}`);
    chip.textContent = count === 2 ? "✓ ready to trace" : count === 1 ? (seeds[side] ? "set the direction" : "set the start") : "not set";
    chip.classList.toggle("is-done", count === 2);
  }
}

function resetCoronary(clearSeeds) {
  stopTrace?.();
  coronary = null;
  if (clearSeeds) {
    seeds = { left: null, leftNext: null, right: null, rightNext: null };
    refreshSeedState();
  }
  el("coronary-result").hidden = true;
  setTraceStatus("");
  refreshTraceButton();
}

function setSeed(kind, point = crosshairWorld()) {
  seeds[kind] = point;
  refreshSeedState();
  if (coronary) resetCoronary(false);
  redraw();
  refreshTraceButton();
}

const MODEL_TIMEOUT_MS = 150000; // the worker may first spend up to a minute testing WebGPU

function traceInWorker(message, onStep, onLoaded) {
  return new Promise((resolve, reject) => {
    worker ??= new Worker(root.dataset.worker, { type: "module" });
    // A stalled model download would otherwise leave the page waiting with no message.
    const timer = setTimeout(() => fail(new Error("The model did not load. Check the connection, reload the page and try again.")), MODEL_TIMEOUT_MS);
    const fail = (error) => {
      clearTimeout(timer);
      worker?.terminate();
      worker = null;
      stopTrace = null;
      reject(error);
    };
    stopTrace = () => fail(new Error("Stopped."));
    worker.onmessage = ({ data }) => {
      if (data.type === "backend") {
        clearTimeout(timer);
        backend = data.backend;
        onLoaded?.();
      }
      else if (data.type === "step") onStep();
      else if (data.type === "done") {
        clearTimeout(timer);
        stopTrace = null;
        resolve(data);
      } else if (data.type === "error") fail(new Error(data.message));
    };
    worker.onerror = () => fail(new Error("The trace could not start in this browser."));
    worker.postMessage(message, [message.volume.data.buffer]);
  });
}

// Runs of consecutive calcified millimetres, as [start, end].
function runs(flags) {
  const out = [];
  for (let i = 0; i < flags.length; i++) {
    if (!flags[i]) continue;
    let j = i;
    while (j + 1 < flags.length && flags[j + 1]) j += 1;
    out.push([i, j]);
    i = j;
  }
  return out;
}

function measureCoronaries(core) {
  const a = aorta.report;
  coronary.profiles = {};
  coronary.summary = [];
  for (const vessel of coronary.vessels) {
    const profile = core.vesselProfile(volume, vessel, a);
    coronary.profiles[vessel.name] = profile;
    const fats = profile.fat.filter(Number.isFinite);
    const lost = core.isLost(vessel.points);
    const dips = core.findFocalDips(profile);
    const quality = vessel.name === "LM" ? null : core.vesselQuality(vessel.name, profile, a, lost, dips);
    coronary.summary.push({
      name: vessel.name,
      length_mm: vessel.length_mm,
      perivascular_fat_hu: fats.length ? core.percentile(fats, 50) : null,
      score: quality?.score ?? null,
      coverage: quality?.coverage ?? null,
      review: quality?.review ?? null,
      reasons: quality?.reasons ?? [],
      bands: quality?.bands ?? [],
      calcium_segments_mm: runs(profile.calcified),
      focal_dips: dips,
      calcified_mm: profile.calcified.filter(Boolean).length,
      trace_may_have_left_vessel: lost,
      per_mm: {
        point_lps_mm: profile.points.map((p) => p.map((v) => Math.round(v * 100) / 100)),
        lumen_hu: profile.lumen.map((v) => (Number.isFinite(v) ? Math.round(v) : null)),
        calcified: profile.calcified,
      },
    });
  }
  const expected = TABLE_VESSELS.filter((name) => coronary.traced.includes(name === "RCA" ? "right" : "left"));
  coronary.quality = core.scanQuality(a, coronary.summary.filter((v) => v.name !== "LM"), expected);
  showCoronary();
}

const fmt = (value, digits) => (value === null || value === undefined || !Number.isFinite(value) ? "–" : value.toFixed(digits));

function showCoronary() {
  const byName = Object.fromEntries(coronary.summary.map((v) => [v.name, v]));
  const rows = [];
  const cell = (tag, text, attrs = {}) => Object.assign(document.createElement(tag), { textContent: text }, attrs);
  const expected = TABLE_VESSELS.filter((name) => coronary.traced.includes(name === "RCA" ? "right" : "left"));
  for (const name of expected) {
    const v = byName[name];
    if (!v) {
      const tr = document.createElement("tr");
      tr.className = "snr-vessel-end";
      tr.append(cell("th", name, { scope: "row" }), cell("td", "Not found", { colSpan: 6 }));
      rows.push(tr);
      continue;
    }
    const bands = v.bands.length ? v.bands : [{ band: "whole vessel", note: "trace may have left the vessel" }];
    bands.forEach((b, k) => {
      const tr = document.createElement("tr");
      if (k === 0) {
        const head = cell("th", name, { scope: "row", rowSpan: bands.length });
        const detail = `${Math.round(v.length_mm)} mm traced. Score ${v.score === null ? "–" : v.score.toFixed(2)}`;
        head.append(Object.assign(document.createElement("span"), { className: "snr-ref", textContent: detail }));
        tr.append(head);
      }
      const labelCell = cell("td", BAND_LABELS[b.band] ?? b.band);
      if (b.flags?.length) {
        labelCell.append(Object.assign(document.createElement("span"), { className: "snr-ref snr-flag", textContent: "may be non-diagnostic", title: b.flags.join("; ") }));
      }
      if (b.median_hu === null || b.median_hu === undefined) {
        tr.append(labelCell, cell("td", b.note || "–", { colSpan: 5, className: "snr-band-note" }));
      } else {
        tr.append(
          labelCell,
          cell("td", String(Math.round(b.median_hu))),
          cell("td", fmt(b.hu_ratio, 2)),
          cell("td", fmt(b.snr, 1)),
          cell("td", fmt(b.cnr, 1)),
          cell("td", fmt(b.score, 2))
        );
      }
      if (k === bands.length - 1) tr.className = "snr-vessel-end";
      rows.push(tr);
    });
  }
  el("vessel-rows").replaceChildren(...rows);
  const q = coronary.quality;
  el("quality-score").textContent = q.score === null ? "–" : q.score.toFixed(2);
  el("quality-status").textContent = { pass: "Pass", "manual review": "Manual review", "cannot score": "Cannot score" }[q.status];
  el("quality-status").dataset.status = q.status;
  const qualityNotes = [...q.reasons];
  if (coronary.traced.length === 1) qualityNotes.unshift(`Scored from the ${coronary.traced[0]} coronary only.`);
  if (thickSlices()) qualityNotes.unshift(`Slices are ${scanGeometry().slice_spacing_mm.toFixed(2)} mm apart, so small-vessel values read low.`);
  el("quality-reasons").replaceChildren(...qualityNotes.map((text) => Object.assign(document.createElement("li"), { textContent: text })));

  const calcium = [];
  const notes = [];
  for (const name of VESSEL_ORDER) {
    const v = byName[name];
    if (!v) continue;
    const segments = v.calcium_segments_mm.map(([a, b]) => (a === b ? `${a} mm` : `${a}–${b} mm`));
    calcium.push(`${name}: ${segments.length ? segments.join(", ") : "none"}`);
    if (v.trace_may_have_left_vessel) notes.push(`The ${name} trace curls back on itself, so it may have left the vessel.`);
  }
  const missing = expected.filter((name) => !byName[name]);
  if (missing.length) {
    notes.push(`${missing.join(" and ")} not found within the step limit. SeqSeg may have spent them on other branches, or the start point may be off the vessel.`);
  }
  el("calcium").textContent = `Calcium, by distance from the origin: ${calcium.join("; ")}.`;
  el("coronary-notes").textContent = notes.join(" ");
  el("coronary-notes").hidden = !notes.length;
  el("charts").replaceChildren(...TABLE_VESSELS.filter((name) => coronary.profiles[name]).map((name) => profileChart(name, coronary.profiles[name], byName[name])));
  el("coronary-result").hidden = false;
}

function svg(name, attributes = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  parent?.append(node);
  return node;
}

// Lumen HU along one vessel, with the aortic HU dashed, thirds marked and calcium as ticks.
function profileChart(name, profile, summary) {
  const a = aorta.report;
  const fatHu = summary.perivascular_fat_hu;
  const figure = document.createElement("figure");
  figure.className = "snr-chart";
  figure.append(Object.assign(document.createElement("figcaption"), { textContent: `${name} lumen HU` }));
  const [width, height, left, right, top, bottom] = [640, 170, 44, 10, 8, 24];
  const lumen = profile.lumen;
  const n = lumen.length;
  const xMax = Math.max(n - 1, 1);
  const finite = lumen.filter(Number.isFinite);
  const yMax = Math.ceil(Math.max(a.median_hu, ...finite) / 100) * 100 + 50;
  const yMin = Math.min(0, ...finite);
  const x = (v) => left + (v / xMax) * (width - left - right);
  const y = (v) => top + (1 - (v - yMin) / (yMax - yMin)) * (height - top - bottom);
  const chart = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${name} lumen attenuation by distance from the origin` }, figure);
  const step = yMax > 600 ? 200 : 100;
  for (let tick = 0; tick <= yMax; tick += step) {
    svg("line", { x1: left, x2: width - right, y1: y(tick), y2: y(tick), class: "grid" }, chart);
    svg("text", { x: left - 6, y: y(tick) + 4, "text-anchor": "end" }, chart).textContent = String(tick);
  }
  const xStep = xMax > 80 ? 20 : 10;
  for (let tick = 0; tick <= xMax; tick += xStep) {
    const anchor = tick === 0 ? "start" : x(tick) > width - right - 24 ? "end" : "middle";
    svg("text", { x: x(tick), y: height - 6, "text-anchor": anchor }, chart).textContent = `${tick} mm`;
  }
  [40, 80].filter((at) => at < n).forEach((at) => {
    svg("line", { x1: x(at), x2: x(at), y1: top, y2: height - bottom, class: "third" }, chart);
  });
  svg("line", { x1: left, x2: width - right, y1: y(a.median_hu), y2: y(a.median_hu), class: "aorta" }, chart);
  svg("text", { x: width - right, y: y(a.median_hu) - 4, "text-anchor": "end", class: "aorta-label" }, chart).textContent = "aorta";
  let path = "";
  let drawing = false;
  lumen.forEach((value, i) => {
    if (!Number.isFinite(value)) {
      drawing = false;
      return;
    }
    path += `${drawing ? "L" : "M"}${x(i).toFixed(1)} ${y(value).toFixed(1)}`;
    drawing = true;
  });
  svg("path", { d: path, class: "lumen" }, chart);
  profile.calcified.forEach((isCalcified, i) => {
    if (isCalcified) svg("line", { x1: x(i), x2: x(i), y1: height - bottom - 8, y2: height - bottom, class: "calcium" }, chart);
  });

  const cursor = svg("line", { y1: top, y2: height - bottom, class: "cursor", visibility: "hidden" }, chart);
  const dot = svg("circle", { r: 4, class: "dot", visibility: "hidden" }, chart);
  const tip = Object.assign(document.createElement("div"), { className: "snr-tip", hidden: true });
  figure.append(tip);
  const hide = () => {
    cursor.setAttribute("visibility", "hidden");
    dot.setAttribute("visibility", "hidden");
    tip.hidden = true;
  };
  chart.addEventListener("pointermove", (event) => {
    const box = chart.getBoundingClientRect();
    const scale = width / box.width;
    const i = Math.round(((event.clientX - box.left) * scale - left) / ((width - left - right) / xMax));
    const value = lumen[i];
    if (i < 0 || i >= n || !Number.isFinite(value)) return hide();
    cursor.setAttribute("x1", x(i));
    cursor.setAttribute("x2", x(i));
    cursor.setAttribute("visibility", "visible");
    dot.setAttribute("cx", x(i));
    dot.setAttribute("cy", y(value));
    dot.setAttribute("visibility", "visible");
    const parts = [
      `${i} mm: ${Math.round(value)} HU`,
      `ratio ${(value / a.median_hu).toFixed(2)}`,
      `SNR ${(value / a.noise_sd).toFixed(1)}`,
    ];
    if (fatHu !== null) parts.push(`CNR ${((value - fatHu) / a.noise_sd).toFixed(1)}`);
    tip.textContent = parts.join(", ") + (profile.calcified[i] ? ". Calcium here" : "");
    tip.hidden = false;
    const place = Math.min(x(i) / scale + 8, box.width - tip.offsetWidth);
    tip.style.left = `${Math.max(place, 0)}px`;
  });
  chart.addEventListener("pointerleave", hide);
  return figure;
}

// How the aortic median HU and noise change with the ROI radius, for the latest region.
function showSweep() {
  const rows = sweep?.rows.filter((r) => r.median_hu !== null) ?? [];
  const box = el("sweep");
  if (!aorta || !sweep || rows.length < 2) {
    box.hidden = true;
    return;
  }
  const span = (key) => [Math.min(...rows.map((r) => r[key])), Math.max(...rows.map((r) => r[key]))];
  const [huLow, huHigh] = span("median_hu");
  const sizeText = (size) => (sweep.plane === "3d" ? `${size.toFixed(1)} mL` : `${Math.round(size)} mm²`);
  const [noiseLow, noiseHigh] = span("noise_sd");
  el("sweep-title").textContent = `ROI size check, ${roiName("aorta", sweep)} (${PLANE_TEXT[sweep.plane]})`;
  el("sweep-summary").textContent =
    `From ${rows[0].radius_mm} to ${rows.at(-1).radius_mm} mm, the median ranges over ${Math.round(huHigh - huLow)} HU (${Math.round(huLow)} to ${Math.round(huHigh)}) ` +
    `and the noise over ${(noiseHigh - noiseLow).toFixed(1)} HU (${noiseLow.toFixed(1)} to ${noiseHigh.toFixed(1)}). The measurement uses ${ROI_RADIUS_MM} mm. ` +
    `The region holds ${sizeText(rows[0].size)} at ${rows[0].radius_mm} mm and ${sizeText(rows.at(-1).size)} at ${rows.at(-1).radius_mm} mm; it keeps 3 mm from the wall, so it stops growing once it fills the lumen.`;
  el("sweep-charts").replaceChildren(miniChart("Median HU", rows, "median_hu", 0), miniChart("Noise, HU", rows, "noise_sd", 1));
  box.hidden = false;
}

function niceStep(span) {
  const raw = span / 3 || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * power).find((v) => v >= raw);
}

// A small line chart of one value against ROI radius, with the radius in use marked.
function miniChart(title, rows, key, digits) {
  const figure = Object.assign(document.createElement("figure"), { className: "snr-chart snr-mini" });
  figure.append(Object.assign(document.createElement("figcaption"), { textContent: title }));
  const [width, height, left, right, top, bottom] = [320, 150, 40, 10, 10, 24];
  const values = rows.map((r) => r[key]);
  const step = niceStep(Math.max(...values) - Math.min(...values));
  const yMin = Math.floor(Math.min(...values) / step) * step - (Math.max(...values) === Math.min(...values) ? step : 0);
  const yMax = Math.ceil(Math.max(...values) / step) * step + (Math.max(...values) === Math.min(...values) ? step : 0);
  const xMin = rows[0].radius_mm;
  const xMax = rows.at(-1).radius_mm;
  const x = (v) => left + ((v - xMin) / (xMax - xMin)) * (width - left - right);
  const y = (v) => top + (1 - (v - yMin) / (yMax - yMin || 1)) * (height - top - bottom);
  const chart = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${title} by aortic ROI radius` }, figure);
  for (let tick = yMin; tick <= yMax + 1e-9; tick += step) {
    svg("line", { x1: left, x2: width - right, y1: y(tick), y2: y(tick), class: "grid" }, chart);
    svg("text", { x: left - 6, y: y(tick) + 4, "text-anchor": "end" }, chart).textContent = tick.toFixed(step < 1 ? 1 : 0);
  }
  for (const r of rows) {
    if (r.radius_mm % 4) continue;
    const anchor = r.radius_mm === xMax ? "end" : r.radius_mm === xMin ? "start" : "middle";
    svg("text", { x: x(r.radius_mm), y: height - 6, "text-anchor": anchor }, chart).textContent = `${r.radius_mm} mm`;
  }
  if (ROI_RADIUS_MM >= xMin && ROI_RADIUS_MM <= xMax) svg("line", { x1: x(ROI_RADIUS_MM), x2: x(ROI_RADIUS_MM), y1: top, y2: height - bottom, class: "aorta" }, chart);
  svg("path", { d: rows.map((r, i) => `${i ? "L" : "M"}${x(r.radius_mm).toFixed(1)} ${y(r[key]).toFixed(1)}`).join(""), class: "lumen" }, chart);
  for (const r of rows) svg("circle", { cx: x(r.radius_mm), cy: y(r[key]), r: 4, class: "dot" }, chart);
  const tip = Object.assign(document.createElement("div"), { className: "snr-tip", hidden: true });
  figure.append(tip);
  chart.addEventListener("pointermove", (event) => {
    const box = chart.getBoundingClientRect();
    const scale = width / box.width;
    const at = (event.clientX - box.left) * scale;
    const r = rows.reduce((a, b) => (Math.abs(x(b.radius_mm) - at) < Math.abs(x(a.radius_mm) - at) ? b : a));
    const size = sweep.plane === "3d" ? `${r.size.toFixed(1)} mL` : `${Math.round(r.size)} mm²`;
    tip.textContent = `${r.radius_mm} mm: ${r[key].toFixed(digits)} HU, ${size}`;
    tip.hidden = false;
    tip.style.left = `${Math.max(Math.min(x(r.radius_mm) / scale + 8, box.width - tip.offsetWidth), 0)}px`;
  });
  chart.addEventListener("pointerleave", () => (tip.hidden = true));
  return figure;
}

async function traceCoronaries() {
  tracing = true;
  refreshTraceButton();
  el("stop").hidden = false;
  coronary = null;
  el("coronary-result").hidden = true;
  redraw();
  const absolute = (url) => new URL(url, location.href).href;
  const began = performance.now();
  try {
    const core = await corePromise;
    volume ??= toMetricVolume(scan, el("unit").value);
    const lines = [];
    const traced = readyTrees();
    for (const kind of traced) {
      const label = `${kind} coronary`;
      let done = 0;
      setTraceStatus("Loading the model...");
      const result = await traceInWorker(
        {
          volume: { ...volume, data: volume.data.slice() },
          seed: { start: rasToLps(seeds[kind]), direction: rasToLps(seeds[`${kind}Next`]), radius: SEED_RADIUS_MM },
          steps: STEPS_PER_TREE[kind],
          maxStepsBranch: STEPS_PER_BRANCH,
          useGpu: Boolean(navigator.gpu),
          ortBase: ORT_BASE,
          modelUrl: absolute(root.dataset.model),
          tracerUrl: absolute(root.dataset.tracer),
        },
        () => {
          done += 1;
          setTraceStatus(`Tracing the ${label} with ${backend}: step ${done} of up to ${STEPS_PER_TREE[kind]}`);
        },
        () => setTraceStatus(`Model loaded with ${backend}. Running the first step of the ${label}...`)
      );
      lines.push(...result.lines);
    }
    if (!lines.length) throw new Error("No vessel was found. Move the points onto the coronary origins and try again.");
    setTraceStatus("Measuring...");
    await new Promise((resolve) => setTimeout(resolve));
    const sides = {
      right: traced.includes("right") ? rasToLps(seeds.right) : null,
      left: traced.includes("left") ? [rasToLps(seeds.left)] : [],
    };
    coronary = { traced, vessels: core.extractMainVessels(lines, [], sides) };
    measureCoronaries(core);
    redraw();
    setTraceStatus(`Finished in ${Math.round((performance.now() - began) / 1000)} seconds with ${backend}.`);
  } catch (error) {
    coronary = null;
    setTraceStatus(error.message || "The trace failed.", true);
  } finally {
    tracing = false;
    el("stop").hidden = true;
    refreshTraceButton();
  }
}

// Reports. Both exports are built from report(), so they hold the same values as the JSON.

// Problems worth reading first, in plain sentences.
function findings() {
  const out = [];
  if (thickSlices()) out.push(`Slices are ${scanGeometry().slice_spacing_mm.toFixed(2)} mm apart, so small-vessel values read low.`);
  if (aorta?.warnings.length) out.push(...aorta.warnings.map((w) => `Aorta: ${w}`));
  if (fat?.warnings.length) out.push(...fat.warnings.map((w) => `Fat: ${w}`));
  if (coronary?.quality) {
    const q = coronary.quality;
    out.push(`Quality score ${q.score === null ? "not available" : q.score.toFixed(2)}: ${q.status}.`);
    out.push(...q.reasons);
    for (const v of coronary.summary) {
      if (v.calcium_segments_mm.length) out.push(`${v.name}: calcium at ${v.calcium_segments_mm.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ")} mm.`);
    }
  }
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const round = (value, digits = 1) => (value === null || value === undefined || !Number.isFinite(value) ? "" : Number(value.toFixed(digits)));

// One long table: section, item, measure, value, unit.
function csvReport() {
  const r = report();
  const rows = [["section", "item", "measure", "value", "unit"]];
  const add = (...row) => rows.push(row);
  if (r.scan) {
    add("scan", "", "size", r.scan.size.join(" x "), "voxels");
    add("scan", "", "voxel spacing", r.scan.spacing_mm.map((v) => v.toFixed(3)).join(" x "), "mm");
    add("scan", "", "thick slices (1 mm or more)", r.scan.thick_slices ? "yes" : "no", "");
  }
  for (const [kind, data] of [["aorta", r.aorta], ["fat", r.fat]]) {
    if (!data) continue;
    add(kind, "combined", "median", round(data.median_hu, 1), "HU");
    if (kind === "aorta") {
      add(kind, "combined", "noise (robust SD)", round(data.noise_sd_hu, 2), "HU");
      add(kind, "combined", "SNR", round(data.snr, 2), "");
    }
    add(kind, "combined", "regions", data.regions.length, "");
    for (const g of data.regions) {
      const item = `${kind} ${g.region} (${g.type})`;
      add(kind, item, "median", round(g.median_hu, 1), "HU");
      add(kind, item, "noise (robust SD)", round(g.noise_sd_hu, 2), "HU");
      if (g.snr !== undefined) add(kind, item, "SNR", round(g.snr, 2), "");
      if (g.area_mm2 !== undefined) add(kind, item, "area", round(g.area_mm2, 1), "mm2");
      else add(kind, item, "volume", round(g.volume_ml, 3), "mL");
      add(kind, item, "point (LPS)", g.point_lps_mm.map((v) => v.toFixed(1)).join(" "), "mm");
      for (const w of g.warnings) add(kind, item, "warning", w, "");
    }
  }
  if (r.cnr) add("cnr", "", "CNR", round(r.cnr.value, 2), "");
  for (const row of r.aorta?.roi_size_check?.rows ?? []) {
    const item = `aorta ${r.aorta.roi_size_check.region} radius ${row.radius_mm} mm`;
    add("roi size check", item, "median", round(row.median_hu, 1), "HU");
    add("roi size check", item, "noise (robust SD)", round(row.noise_sd, 2), "HU");
  }
  if (r.coronaries) {
    const q = r.coronaries.quality;
    add("quality", "scan", "score", round(q.score, 3), "0-1");
    add("quality", "scan", "status", q.status, "");
    for (const reason of q.reasons) add("quality", "scan", "reason", reason, "");
    for (const v of r.coronaries.vessels) {
      add("vessel", v.name, "length", round(v.length_mm, 1), "mm");
      if (v.name !== "LM") add("vessel", v.name, "score", round(v.score, 3), "0-1");
      add("vessel", v.name, "perivascular fat", round(v.perivascular_fat_hu, 1), "HU");
      add("vessel", v.name, "calcified length", v.calcified_mm, "mm");
      for (const [a, b] of v.calcium_segments_mm) add("vessel", v.name, "calcium", `${a}-${b}`, "mm from origin");
      for (const d of v.focal_dips) add("vessel", v.name, "focal HU dip", `${d.start_mm}-${d.end_mm}`, "mm from origin");
      for (const b of v.bands) {
        const item = `${v.name} ${BAND_LABELS[b.band] ?? b.band}`.replace("–", "-");
        if (b.median_hu !== null) {
          add("segment", item, "median lumen", round(b.median_hu, 1), "HU");
          add("segment", item, "ratio to aorta", round(b.hu_ratio, 3), "");
          add("segment", item, "SNR", round(b.snr, 2), "");
          add("segment", item, "CNR", round(b.cnr, 2), "");
          add("segment", item, "score", round(b.score, 3), "0-1");
        }
        if (b.note) add("segment", item, "note", b.note, "");
        for (const f of b.flags) add("segment", item, "flag", f, "");
      }
      v.per_mm.lumen_hu.forEach((hu, i) => add("profile", v.name, `lumen at ${i} mm`, hu ?? "", v.per_mm.calcified[i] ? "HU, calcium" : "HU"));
    }
  }
  const cellText = (value) => {
    const text = String(value ?? "").replace(/−/g, "-");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cellText).join(",")).join("\n");
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const tag = Object.assign(document.createElement("script"), { src: url, onload: resolve, onerror: () => reject(new Error(`Could not load ${url}`)) });
    document.head.append(tag);
  });
}

// An inline chart as a PNG, with the page's colours written into it.
async function chartImage(chart, scale = 2) {
  const copy = chart.cloneNode(true);
  const source = [chart, ...chart.querySelectorAll("*")];
  [copy, ...copy.querySelectorAll("*")].forEach((node, i) => {
    const style = getComputedStyle(source[i]);
    for (const key of ["fill", "stroke", "stroke-width", "stroke-dasharray", "font-size", "font-family", "visibility"]) node.style.setProperty(key, style.getPropertyValue(key));
  });
  const [, , width, height] = chart.getAttribute("viewBox").split(" ").map(Number);
  copy.setAttribute("width", width);
  copy.setAttribute("height", height);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }));
  try {
    const image = await new Promise((resolve, reject) => Object.assign(new Image(), { onload() { resolve(this); }, onerror: reject, src: url }));
    const canvas = Object.assign(document.createElement("canvas"), { width: width * scale, height: height * scale });
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/png"), ratio: height / width };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The viewer as it is now, with the regions and centrelines drawn.
function viewerImage() {
  nv.drawScene();
  const canvas = el("canvas");
  return { data: canvas.toDataURL("image/jpeg", 0.9), ratio: canvas.height / canvas.width };
}

// Helvetica in jsPDF has no minus sign or "at least" sign.
const pdfText = (text) => String(text).replace(/−/g, "-").replace(/≥/g, ">=").replace(/–/g, "-");

async function pdfReport() {
  if (!window.jspdf) await loadScript(JSPDF_URL);
  if (!window.jspdf.jsPDF.API.autoTable) await loadScript(AUTOTABLE_URL);
  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
  const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight(), margin: 40 };
  const textWidth = page.width - 2 * page.margin;
  let y = page.margin;
  const room = (needed) => {
    if (y + needed > page.height - page.margin) {
      doc.addPage();
      y = page.margin;
    }
  };
  const heading = (text) => {
    room(40);
    y += 8;
    doc.setFont("helvetica", "bold").setFontSize(12).text(pdfText(text), page.margin, y);
    y += 16;
  };
  const paragraph = (text, size = 9.5) => {
    doc.setFont("helvetica", "normal").setFontSize(size);
    for (const line of doc.splitTextToSize(pdfText(text), textWidth)) {
      room(size * 1.4);
      doc.text(line, page.margin, y);
      y += size * 1.35;
    }
  };
  const table = (head, body) => {
    doc.autoTable({ head: [head.map(pdfText)], body: body.map((row) => row.map((c) => pdfText(c ?? ""))), startY: y, margin: { left: page.margin, right: page.margin }, styles: { fontSize: 8.5, cellPadding: 3 }, headStyles: { fillColor: [235, 235, 235], textColor: 20 }, theme: "grid" });
    y = doc.lastAutoTable.finalY + 10;
  };
  const image = (picture, width = textWidth) => {
    const height = width * picture.ratio;
    room(height + 6);
    doc.addImage(picture.data, picture.data.startsWith("data:image/png") ? "PNG" : "JPEG", page.margin, y, width, height, undefined, "FAST");
    y += height + 8;
  };

  const r = report();
  doc.setFont("helvetica", "bold").setFontSize(16).text("CCTA Quality Assessment", page.margin, y);
  y += 16;
  paragraph(`Report made ${new Date().toLocaleString()} with the browser tool at ${location.origin}${location.pathname}. Research tool, not for clinical use; the quality score is provisional.`, 8.5);
  if (r.scan) paragraph(`Scan: ${r.scan.size.join(" x ")} voxels of ${r.scan.spacing_mm.map((v) => v.toFixed(2)).join(" x ")} mm.`);

  heading("Findings");
  const found = findings();
  paragraph(found.length ? found.map((f) => `- ${f}`).join("\n") : "No problems found in the measured regions.");

  if (scan) {
    heading("Viewer");
    image(viewerImage(), textWidth * 0.8);
    paragraph("Red: aortic regions. Blue: fat regions. Green: traced centrelines. Orange: calcium.", 8);
  }

  if (r.aorta || r.fat) {
    heading("Aorta and fat");
    const body = [];
    if (r.aorta) body.push(["Lumen attenuation", `${Math.round(r.aorta.median_hu)} HU`], ["Noise (robust SD)", `${r.aorta.noise_sd_hu.toFixed(1)} HU`], ["SNR", r.aorta.snr.toFixed(1)]);
    if (r.fat) body.push(["Fat attenuation", `${Math.round(r.fat.median_hu)} HU`]);
    if (r.cnr) body.push(["CNR (lumen minus fat, over aortic noise)", r.cnr.value.toFixed(1)]);
    table(["Measure", "Value"], body);
    const regions = [];
    for (const [kind, data] of [["Aorta", r.aorta], ["Fat", r.fat]]) {
      for (const g of data?.regions ?? []) {
        regions.push([`${kind} ${g.region}`, g.type, g.area_mm2 !== undefined ? `${Math.round(g.area_mm2)} mm2` : `${g.volume_ml.toFixed(kind === "Fat" ? 3 : 1)} mL`, String(Math.round(g.median_hu)), g.noise_sd_hu.toFixed(1), g.snr === undefined ? "" : g.snr.toFixed(1), g.warnings.join(" ")]);
      }
    }
    table(["Region", "Type", "Size", "HU", "Noise", "SNR", "Warnings"], regions);
    if ((r.aorta?.regions.length ?? 0) > 1 || (r.fat?.regions.length ?? 0) > 1) paragraph("With several regions, the values above are their mean.", 8.5);
  }

  if (r.aorta?.roi_size_check && !el("sweep").hidden) {
    heading(el("sweep-title").textContent);
    for (const figure of el("sweep-charts").querySelectorAll("figure")) {
      paragraph(figure.querySelector("figcaption").textContent, 8.5);
      image(await chartImage(figure.querySelector("svg")), textWidth / 2);
    }
    paragraph(el("sweep-summary").textContent, 8.5);
  }

  if (r.coronaries) {
    const q = r.coronaries.quality;
    heading("Coronary arteries");
    paragraph(`Quality score: ${q.score === null ? "not available" : q.score.toFixed(2)} (${q.status}).`, 10.5);
    const rows = [];
    for (const v of r.coronaries.vessels.filter((v) => v.name !== "LM")) {
      for (const b of v.bands) {
        rows.push([v.name, (BAND_LABELS[b.band] ?? b.band), b.median_hu === null ? "" : String(Math.round(b.median_hu)), fmt(b.hu_ratio, 2), fmt(b.snr, 1), fmt(b.cnr, 1), fmt(b.score, 2), [b.note, ...b.flags].filter(Boolean).join("; ")]);
      }
    }
    table(["Vessel", "Segment", "HU", "Ratio", "SNR", "CNR", "Score", "Notes"], rows);
    paragraph(el("calcium").textContent, 9);
    for (const chart of el("charts").querySelectorAll("svg")) {
      paragraph(chart.getAttribute("aria-label"), 8.5);
      image(await chartImage(chart));
    }
  }

  heading("Methods");
  paragraph("Aortic regions: the contrast-filled lumen near the click, grown from it, keeping voxels at least 3 mm from the wall and within 12 mm of the lumen centre (in the slice for 2D regions). Noise is the robust SD (1.4826 x median absolute deviation). Fat: the connected patch of -190 to -30 HU within 5 mm, trimmed by 1 mm. CNR = (lumen HU - fat HU) / aortic noise. Coronary values are sampled every millimetre along SeqSeg centrelines. Segment score = 0.4 CNR part + 0.3 noise part + 0.3 lumen part; scan score = 0.6 weakest vessel + 0.4 mean. Thresholds are provisional.", 8);
  doc.save(`ccta-quality-${today()}.pdf`);
}

el("export-csv").addEventListener("click", () => {
  if (!aorta && !fat) return;
  download(new Blob([csvReport()], { type: "text/csv" }), `ccta-quality-${today()}.csv`);
  setStatus("CSV saved.");
});
el("export-pdf").addEventListener("click", async () => {
  if (!aorta && !fat) return;
  el("export-pdf").disabled = true;
  setStatus("Making the PDF...");
  try {
    await pdfReport();
    setStatus("PDF saved.");
  } catch (error) {
    setStatus(`The PDF could not be made: ${error.message}`, true);
  } finally {
    el("export-pdf").disabled = false;
  }
});

SEED_KINDS.forEach((kind) => el(`set-${kind}`).addEventListener("click", () => setSeed(kind)));
el("trace").addEventListener("click", traceCoronaries);
el("stop").addEventListener("click", () => stopTrace?.());
refreshTraceButton();

