const NIIVUE_URL = "https://cdn.jsdelivr.net/npm/@niivue/niivue@0.69.0/dist/index.js";
const MM_PER_UNIT = { mm: 1, cm: 10 };
const WINDOWS = {
  ct: { soft: ["Soft tissue", 40, 400], lung: ["Lung", -600, 1500], bone: ["Bone", 400, 1800], vessels: ["Vessels", 350, 900] },
  mr: { auto: ["Automatic"] },
};
const ICONS = { pass: "✓", warn: "!", fail: "✕", skip: "–" };
const KIND_TEXT = { ct: "CT", mr: "MRI" };
const LABELS = { signal: 1, background: 2 };
// RAS points in the example scan's own unit (cm): the aortic root and epicardial fat.
const EXAMPLE_POINTS = { signal: [25.88, 4.88, -14.5], background: [21.58, 4.847, -12.6975] };

const root = document.getElementById("sc");
const el = (name) => document.getElementById(`sc-${name}`);
const corePromise = import(root.dataset.core);

let nv;
let SLICE_TYPE;
let scan = null;
let fileName = "";
let report = null;
let running = 0;
let regions = { signal: null, background: null }; // { voxel, stats }
let example = false;

function setLoadStatus(message, isError = false) {
  el("load-status").textContent = message;
  el("load-status").classList.toggle("is-error", isError);
}

function setStatus(message, isError = false) {
  el("status").textContent = message;
  el("status").classList.toggle("is-error", isError);
}

const columnLength = (affine, c) => Math.hypot(affine[0][c], affine[1][c], affine[2][c]);
const unitScale = () => MM_PER_UNIT[el("unit").value];

function volumeOf(source) {
  const { hdr, img } = source;
  return {
    size: hdr.dims.slice(1, 4).map((d) => Math.max(1, d)),
    spacing: [0, 1, 2].map((c) => columnLength(hdr.affine, c) * unitScale()),
    data: img,
    slope: hdr.scl_slope || 1,
    inter: hdr.scl_slope ? hdr.scl_inter || 0 : 0,
    direction: [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => hdr.affine[r][c] / (columnLength(hdr.affine, c) || 1))),
  };
}

// The header affine maps voxel indices to RAS in the image's own unit, which NiiVue uses.
function voxelToRas(voxel) {
  const a = scan.hdr.affine;
  return [0, 1, 2].map((r) => a[r][0] * voxel[0] + a[r][1] * voxel[1] + a[r][2] * voxel[2] + a[r][3]);
}

function rasToVoxel(ras) {
  const a = scan.hdr.affine;
  const m = [0, 1, 2].map((r) => [a[r][0], a[r][1], a[r][2]]);
  const b = [0, 1, 2].map((r) => ras[r] - a[r][3]);
  const det = (q) => q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) - q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) + q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0]);
  const d = det(m);
  // Cramer's rule: replace each column by b in turn.
  return [0, 1, 2].map((c) => det(m.map((row, r) => row.map((v, k) => (k === c ? b[r] : v)))) / d);
}

function moveCrosshair(ras) {
  nv.scene.crosshairPos = nv.mm2frac(ras);
  nv.drawScene();
}

function jumpTo(voxel) {
  moveCrosshair(voxelToRas(voxel));
  el("viewer").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

const crosshairVoxel = () => rasToVoxel(nv.frac2mm(nv.scene.crosshairPos));

// Index into NiiVue's drawing layer, which is in RAS voxel order.
function drawIndex(ras) {
  const dims = nv.back.dimsRAS;
  const frac = nv.mm2frac(ras);
  const v = [0, 1, 2].map((axis) => Math.round(frac[axis] * dims[axis + 1] - 0.5));
  if (v.some((value, axis) => value < 0 || value >= dims[axis + 1])) return null;
  return v[0] + v[1] * dims[1] + v[2] * dims[1] * dims[2];
}

function redraw() {
  const bitmap = nv.drawBitmap;
  if (!bitmap) return;
  bitmap.fill(0);
  const [nx, ny] = scan.hdr.dims.slice(1, 3);
  for (const kind of Object.keys(regions)) {
    if (!regions[kind]) continue;
    for (const i of regions[kind].stats.voxels) {
      const at = drawIndex(voxelToRas([i % nx, Math.floor(i / nx) % ny, Math.floor(i / (nx * ny))]));
      if (at !== null) bitmap[at] = LABELS[kind];
    }
  }
  nv.refreshDrawing(true);
}

function fillWindows(kind) {
  const select = el("window");
  select.replaceChildren(...Object.entries(WINDOWS[kind]).map(([value, [label]]) => new Option(label, value)));
  applyWindow();
}

function applyWindow() {
  if (!scan) return;
  const kind = report ? report.modality : "ct";
  const preset = WINDOWS[kind][el("window").value];
  if (preset && preset.length === 3) {
    scan.cal_min = preset[1] - preset[2] / 2;
    scan.cal_max = preset[1] + preset[2] / 2;
  } else {
    scan.cal_min = scan.robust_min ?? scan.global_min;
    scan.cal_max = scan.robust_max ?? scan.global_max;
  }
  nv.updateGLVolume();
}

function checkItem(check) {
  const item = document.createElement("li");
  item.className = "sc-check";
  item.dataset.status = check.status;
  const icon = document.createElement("span");
  icon.className = "sc-icon";
  icon.textContent = ICONS[check.status];
  icon.setAttribute("aria-label", check.status === "skip" ? "not checked" : check.status);
  const name = document.createElement("span");
  name.className = "sc-name";
  name.textContent = check.name;
  const value = document.createElement("span");
  value.className = "sc-value";
  value.textContent = check.value;
  const detail = document.createElement("p");
  detail.className = "sc-detail";
  detail.textContent = check.detail;
  if (check.at) {
    const show = document.createElement("button");
    show.type = "button";
    show.textContent = "Show";
    show.addEventListener("click", () => jumpTo(check.at));
    detail.append(show);
  }
  item.append(icon, name, value, detail);
  return item;
}

function showReport() {
  const { verdict, modality, guessed } = report;
  el("verdict").dataset.level = verdict.level;
  el("verdict-label").textContent = verdict.label;
  el("verdict-kind").textContent = `${KIND_TEXT[modality]} checks${guessed ? ", detected from the values" : ""}`;
  el("verdict-summary").textContent = verdict.summary;
  el("checks").replaceChildren(...report.checks.map(checkItem));
  el("result").hidden = false;
}

function setRoiStatus(message, isError = false) {
  el("roi-status").textContent = message;
  el("roi-status").classList.toggle("is-error", isError);
}

const valueUnit = () => (report?.modality === "ct" ? " HU" : "");
const show = (v, digits = 0) => (Number.isFinite(v) ? v.toFixed(digits).replace("-", "−") : "–");

function showRegions(core) {
  const { signal, background } = regions;
  const unit = valueUnit();
  for (const kind of ["signal", "background"]) {
    const r = regions[kind];
    el(`chip-${kind}`).textContent = r ? `${show(r.stats.median)}${unit} ± ${show(r.stats.noise_sd, 1)}, ${show(r.stats.volume_ml, 2)} mL` : "not set";
  }
  const metrics = core.contrastMetrics(signal?.stats, background?.stats);
  const rows = { signal: Boolean(signal), background: Boolean(background), both: Boolean(signal && background) };
  document.querySelectorAll("[data-roi-row]").forEach((row) => (row.hidden = !rows[row.dataset.roiRow]));
  if (signal) {
    el("signal").textContent = `${show(signal.stats.median)}${unit}`;
    el("noise").textContent = `${show(signal.stats.noise_sd, 1)}${unit}`;
    el("snr").textContent = show(metrics.snr, 1);
  }
  if (background) {
    el("background").textContent = `${show(background.stats.median)}${unit}`;
    el("background-noise").textContent = `${show(background.stats.noise_sd, 1)}${unit}`;
  }
  if (rows.both) el("cnr").textContent = show(metrics.cnr, 1);
  el("roi-table").hidden = !signal && !background;
  redraw();
}

const radiusMm = () => Number(el("radius").value);

async function setRegion(kind, voxel = crosshairVoxel()) {
  if (!scan) return;
  const core = await corePromise;
  try {
    regions[kind] = { voxel, stats: core.regionStats(volumeOf(scan), voxel, { radiusMm: radiusMm() }) };
    setRoiStatus("");
  } catch (error) {
    setRoiStatus(error.message || "The region could not be measured here.", true);
    return false;
  }
  showRegions(core);
  return true;
}

// Units and radius change the regions, so measure them again from the same points.
async function remeasureRegions() {
  const core = await corePromise;
  for (const kind of Object.keys(regions)) {
    if (!regions[kind]) continue;
    try {
      regions[kind].stats = core.regionStats(volumeOf(scan), regions[kind].voxel, { radiusMm: radiusMm() });
    } catch {
      regions[kind] = null;
    }
  }
  showRegions(core);
}

async function check() {
  if (!scan) return;
  const run = ++running;
  el("result").hidden = true;
  setStatus("");
  try {
    const core = await corePromise;
    const choice = el("modality").value;
    const result = await core.runChecks(volumeOf(scan), {
      modality: choice === "auto" ? null : choice,
      onProgress: (message) => run === running && setLoadStatus(`${message}...`),
    });
    if (run !== running) return;
    const kindChanged = !report || report.modality !== result.modality;
    report = result;
    if (kindChanged) fillWindows(report.modality);
    showReport();
    await remeasureRegions();
    el("roi").hidden = false;
    setLoadStatus("");
  } catch (error) {
    if (run !== running) return;
    console.error(error);
    setLoadStatus("The checks could not run on this scan.", true);
  }
}

async function loadScan(file, name = file.name) {
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
    report = null;
    example = false;
    regions = { signal: null, background: null };
    el("result").hidden = true;
    el("roi").hidden = true;
    el("roi-table").hidden = true;
    setRoiStatus("");
    nv.closeDrawing();
    await nv.loadVolumes([]);
    await nv.loadFromFile(file);
    scan = nv.volumes[0];
    if (scan.hdr.dims[0] > 3 && scan.hdr.dims[4] > 1) {
      throw Object.assign(new Error("Please use a single 3D volume, not a time series."), { isScanError: true });
    }
    nv.setSliceType(SLICE_TYPE.MULTIPLANAR);
    nv.createEmptyDrawing();
    nv.setDrawColormap({
      R: [0, 230, 40],
      G: [0, 60, 170],
      B: [0, 60, 255],
      A: [0, 255, 255],
      labels: ["", "Signal", "Background"],
    });
    nv.setDrawOpacity(0.5);
    const spacing = Math.min(columnLength(scan.hdr.affine, 0), columnLength(scan.hdr.affine, 1));
    el("unit").value = spacing < 0.15 ? "cm" : "mm";
    el("modality").value = "auto";
    fileName = name;
    el("file-name").textContent = name;
    el("bar").hidden = false;
    await check();
  } catch (error) {
    scan = null;
    el("viewer").hidden = true;
    el("bar").hidden = true;
    el("result").hidden = true;
    el("roi").hidden = true;
    setLoadStatus(error.isScanError ? error.message : "This file could not be opened. Please use a NIfTI, MHA or NRRD scan.", true);
  }
}

async function loadExample() {
  el("example").disabled = true;
  setLoadStatus("Downloading the example scan (19 MB)...");
  try {
    const response = await fetch(root.dataset.example);
    if (!response.ok) throw new Error("Download failed.");
    await loadScan(new File([await response.blob()], "example.nii.gz"), "Example: coronary CT angiogram, cropped around the heart");
    if (!scan) return;
    example = true;
    moveCrosshair(EXAMPLE_POINTS.signal);
    setRoiStatus("For contrast, the crosshair is in the aortic root. Press Set signal.");
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
el("modality").addEventListener("change", check);
el("unit").addEventListener("change", check);
el("radius").addEventListener("change", () => scan && remeasureRegions());
el("set-signal").addEventListener("click", async () => {
  const done = await setRegion("signal");
  if (done && example && !regions.background) {
    moveCrosshair(EXAMPLE_POINTS.background);
    setRoiStatus("The crosshair is now in epicardial fat. Press Set background.");
  }
});
el("set-background").addEventListener("click", () => setRegion("background"));
el("window").addEventListener("change", applyWindow);
el("copy").addEventListener("click", async () => {
  if (!report) return;
  const { checks, ...rest } = report;
  const core = await corePromise;
  const region = (r) => r && { voxel: r.voxel, median: r.stats.median, noise_sd: r.stats.noise_sd, mean: r.stats.mean, sd: r.stats.sd, volume_ml: r.stats.volume_ml, radius_mm: r.stats.radius_mm };
  const out = {
    file: fileName,
    ...rest,
    checks: checks.map(({ id, name, status, value, detail, numbers }) => ({ id, name, status, value, detail, ...numbers })),
    signal: region(regions.signal),
    background: region(regions.background),
    ...core.contrastMetrics(regions.signal?.stats, regions.background?.stats),
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
    setStatus("Copied.");
  } catch {
    setStatus("The browser did not allow copying.", true);
  }
});
