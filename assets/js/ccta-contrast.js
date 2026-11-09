const NIIVUE_URL = "https://cdn.jsdelivr.net/npm/@niivue/niivue@0.69.0/dist/index.js";
const MM_PER_UNIT = { mm: 1, cm: 10 };
const LABEL_AORTA = 2;
const LABEL_CLICK = 3;
const LABEL_FAT = 4;
const MARKER_RADIUS_MM = 1.2;
// Aortic root of the example scan (Vascular Model Repository 0066_H_CORO_H), in RAS and the image's unit (cm).
const EXAMPLE_AORTA = [25.88, 4.88, -14.5];
// Epicardial fat beside the proximal LAD of the same scan.
const EXAMPLE_FAT = [21.58, 4.847, -12.6975];
// Every aortic root ROI in the CAS-X test set was at least 4 mL, so a smaller one is
// probably a smaller vessel or a chamber edge, not the aorta.
const MIN_ROI_ML = 3;
const MIN_LUMEN_HU = 150;
const MIN_FAT_ML = 0.005;
const MAX_FAT_HU = -50;

const root = document.getElementById("snr");
const el = (name) => document.getElementById(`snr-${name}`);
const reference = JSON.parse(document.getElementById("snr-reference").textContent);
const corePromise = import(root.dataset.core);

let nv;
let SLICE_TYPE;
let scan;
let volume = null; // the scan in LPS mm, built once per scan and unit
let aorta = null; // { report, click, warnings }
let fat = null;
let example = false;

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

function drawMarker(bitmap, click) {
  const dims = nv.back.dimsRAS;
  const spacing = nv.back.pixDimsRAS;
  const frac = nv.mm2frac(click);
  const centre = [0, 1, 2].map((axis) => Math.round(frac[axis] * dims[axis + 1] - 0.5));
  const reach = [1, 2, 3].map((axis) => Math.max(Math.ceil(MARKER_RADIUS_MM / unitScale() / spacing[axis]), 1));
  for (let z = -reach[2]; z <= reach[2]; z++) {
    for (let y = -reach[1]; y <= reach[1]; y++) {
      for (let x = -reach[0]; x <= reach[0]; x++) {
        if ((x / reach[0]) ** 2 + (y / reach[1]) ** 2 + (z / reach[2]) ** 2 > 1) continue;
        const [i, j, k] = [centre[0] + x, centre[1] + y, centre[2] + z];
        if (i < 0 || j < 0 || k < 0 || i >= dims[1] || j >= dims[2] || k >= dims[3]) continue;
        bitmap[i + j * dims[1] + k * dims[1] * dims[2]] = LABEL_CLICK;
      }
    }
  }
}

// Redraws both regions and their click markers.
function redraw() {
  const bitmap = nv.drawBitmap;
  bitmap.fill(0);
  for (const [measured, label] of [[aorta, LABEL_AORTA], [fat, LABEL_FAT]]) {
    if (!measured) continue;
    for (const n of measured.report.voxels) {
      const at = drawVoxel(lpsToRas(lpsOfIndex(volume, n)));
      if (at !== null) bitmap[at] = label;
    }
  }
  for (const measured of [aorta, fat]) if (measured) drawMarker(bitmap, measured.click);
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
  } else if (report.roi_ml < MIN_ROI_ML) {
    warnings.push("The bright region found here is too small for the aortic root.");
  }
  if (report.median_hu < MIN_LUMEN_HU) warnings.push("This is low for a contrast-filled aorta.");
  return warnings;
}

function fatWarnings(report) {
  const warnings = [];
  if (report.roi_ml < MIN_FAT_ML) warnings.push("The fat region here is very small.");
  if (report.median_hu > MAX_FAT_HU) warnings.push("This is high for fat, so heart muscle or vessel wall may be mixed in.");
  return warnings;
}

function showResults() {
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
    el("hu-ref").textContent = trusted ? describe(reference.median_hu, report.median_hu) : "";
    el("noise-ref").textContent = trusted ? describe(reference.noise_sd, report.noise_sd) : "";
    el("snr-ref").textContent = trusted ? describe(reference.snr, report.snr) : "";
    notes.push(`Aorta: ${report.roi_ml.toFixed(1)} mL of lumen, in red.`);
    if (!trusted) problems.push(`${warnings.join(" ")} Check that the aortic point is inside the aortic root.`);
  }
  if (fat) {
    const { report, warnings } = fat;
    el("fat").textContent = `${Math.round(report.median_hu)} HU`;
    notes.push(`Fat: ${Math.round(report.roi_ml * 1000)} mm³, in blue.`);
    if (warnings.length) problems.push(`${warnings.join(" ")} Try a larger patch of fat.`);
  }
  if (rows.cnr) el("cnr").textContent = cnr().toFixed(1);
  el("summary").textContent = [...problems, ...notes].join(" ");
  el("summary").classList.toggle("is-error", problems.length > 0);
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
    if (kind === "aorta") {
      const report = core.aortaMetrics(volume, rasToLps(rasPoint));
      if (!Number.isFinite(report.snr)) throw new core.InvalidImage("The noise could not be measured at this point. Try a point inside the aortic root.");
      aorta = { report, click: rasPoint, warnings: aortaWarnings(report) };
    } else {
      const report = core.fatMetrics(volume, rasToLps(rasPoint));
      if (!report) throw new Error("There is no fat within 3 mm of this point. Move the crosshair into fat, which looks almost black here, and measure again.");
      fat = { report, click: rasPoint, warnings: fatWarnings(report) };
    }
    redraw();
    showResults();
    setStatus("");
    return true;
  } catch (error) {
    setStatus(error.message || "The measurement failed.", true);
    return false;
  } finally {
    el("run-aorta").disabled = false;
    el("run-fat").disabled = false;
  }
}

function report() {
  const out = {};
  if (aorta) {
    const r = aorta.report;
    out.aorta = { point_lps_mm: rasToLps(aorta.click), lumen_center_lps_mm: r.center, median_hu: r.median_hu, noise_sd_hu: r.noise_sd, snr: r.snr, roi_ml: r.roi_ml, roi_source: r.source, warnings: aorta.warnings };
  }
  if (fat) {
    const r = fat.report;
    out.fat = { point_lps_mm: rasToLps(fat.click), fat_center_lps_mm: r.center, median_hu: r.median_hu, noise_sd_hu: r.noise_sd, roi_mm3: r.roi_ml * 1000, warnings: fat.warnings };
  }
  if (aorta && fat) out.cnr = { value: cnr(), definition: "(aortic lumen HU - fat HU) / aortic noise SD" };
  return out;
}

function moveCrosshair(point) {
  nv.scene.crosshairPos = nv.mm2frac(point);
  nv.drawScene();
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
      nv = new niivue.Niivue({ backColor: [0, 0, 0, 1], crosshairColor: [1, 0.85, 0.2, 1], crosshairWidth: 1, isResizeCanvas: true });
      await nv.attachToCanvas(el("canvas"));
      nv.opts.multiplanarShowRender = 0;
    }
    scan = null;
    volume = null;
    aorta = null;
    fat = null;
    example = false;
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
      R: [0, 0, 230, 255, 40],
      G: [0, 0, 60, 215, 170],
      B: [0, 0, 60, 0, 255],
      A: [0, 255, 140, 255, 160],
      labels: ["", "", "Aorta", "Point", "Fat"],
    });
    nv.setDrawOpacity(0.6);
    scan.cal_min = -100;
    scan.cal_max = 800;
    nv.updateGLVolume();
    const spacing = Math.min(columnLength(scan.hdr.affine, 0), columnLength(scan.hdr.affine, 1));
    el("unit").value = spacing < 0.15 ? "cm" : "mm";
    el("panel").hidden = false;
    setStatus("");
    setLoadStatus("");
  } catch (error) {
    scan = null;
    el("viewer").hidden = true;
    el("panel").hidden = true;
    const message = error.isScanError ? error.message : "This file could not be opened. Please use a NIfTI, MHA or NRRD scan.";
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
    setStatus("Example ready. The crosshair is in the aortic root. Press Measure aorta here.");
  } catch {
    setLoadStatus("The example scan could not be loaded. Please try again.", true);
  } finally {
    el("example").disabled = false;
  }
}

el("file").addEventListener("change", (event) => {
  if (event.target.files[0]) loadScan(event.target.files[0]);
});
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
drop.addEventListener("drop", (event) => {
  if (event.dataTransfer.files[0]) loadScan(event.dataTransfer.files[0]);
});
el("example").addEventListener("click", loadExample);
el("run-aorta").addEventListener("click", async () => {
  const done = await measure("aorta", crosshairWorld());
  // In the example, lead on to the fat point once the aorta is done.
  if (done && example && !fat) {
    moveCrosshair(EXAMPLE_FAT);
    setStatus("The crosshair is now in epicardial fat beside the left anterior descending artery. Press Measure fat here.");
  }
});
el("run-fat").addEventListener("click", () => measure("fat", crosshairWorld()));
el("unit").addEventListener("change", () => {
  volume = null;
  aorta = null;
  fat = null;
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
