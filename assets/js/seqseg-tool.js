const NIIVUE_URL = "https://cdn.jsdelivr.net/npm/@niivue/niivue@0.69.0/dist/index.js";
const ORT_VERSION = "1.31.1";
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MM_PER_UNIT = { mm: 1, cm: 10 };
const MARKER_RADIUS_MM = 1.2;
const LABEL_START = 2;
const LABEL_DIRECTION = 3;
// Proximal LAD of Vascular Model Repository case 0066_H_CORO_H, in RAS and the image's unit (cm).
const EXAMPLE = { start: [22.1179, 4.4681, -13.3285], direction: [21.8028, 4.8759, -13.3774], radius: 0.18 };

const root = document.getElementById("seqseg");
const modelUrl = root.dataset.model;
const el = (name) => document.getElementById(`seqseg-${name}`);

let nv;
let SLICE_TYPE;
let scan;
let start = null;
let direction = null;
let busy = false;
let ort;
let session;
let backend = "";
let maskUrl = null;
let radiusUnit = "mm";
let overlay = null;
let showing3d = false;
let ctHidden = false;

function setStatus(message, isError = false) {
  el("status").textContent = message;
  el("status").classList.toggle("is-error", isError);
}

function setLoadStatus(message, isError = false) {
  el("load-status").textContent = message;
  el("load-status").classList.toggle("is-error", isError);
}

// The radius box uses the image's unit, and keeps the same physical size when the unit changes.
function syncRadiusUnit() {
  const unit = el("unit").value;
  const input = el("radius");
  const value = (Number(input.value) * MM_PER_UNIT[radiusUnit]) / MM_PER_UNIT[unit];
  input.min = String(0.5 / MM_PER_UNIT[unit]);
  input.max = String(10 / MM_PER_UNIT[unit]);
  input.step = String(0.1 / MM_PER_UNIT[unit]);
  input.value = String(Number(value.toFixed(3)));
  el("radius-unit").textContent = unit;
  radiusUnit = unit;
}

function refreshRunButton() {
  el("run").disabled = busy || !start || !direction;
}

function formatPoint(point, unit) {
  return point.map((value) => value.toFixed(2)).join(", ") + ` ${unit}`;
}

function worldToVoxel(point, inverse) {
  return [0, 1, 2].map((row) => inverse[row][0] * point[0] + inverse[row][1] * point[1] + inverse[row][2] * point[2] + inverse[row][3]);
}

function invertAffine(m) {
  const [a, b, c] = m;
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const r = [
    [(b[1] * c[2] - b[2] * c[1]) / det, (a[2] * c[1] - a[1] * c[2]) / det, (a[1] * b[2] - a[2] * b[1]) / det],
    [(b[2] * c[0] - b[0] * c[2]) / det, (a[0] * c[2] - a[2] * c[0]) / det, (a[2] * b[0] - a[0] * b[2]) / det],
    [(b[0] * c[1] - b[1] * c[0]) / det, (a[1] * c[0] - a[0] * c[1]) / det, (a[0] * b[1] - a[1] * b[0]) / det],
  ];
  return r.map((row, i) => [...row, -(row[0] * a[3] + row[1] * b[3] + row[2] * c[3])]);
}

function columnLength(affine, column) {
  return Math.hypot(affine[0][column], affine[1][column], affine[2][column]);
}

// Builds a NIfTI-1 file from scratch for the result mask (uint8, RAS affine).
function encodeMask(data, size, affine) {
  const header = new ArrayBuffer(352);
  const view = new DataView(header);
  view.setInt32(0, 348, true);
  [3, size[0], size[1], size[2], 1, 1, 1, 1].forEach((value, i) => view.setInt16(40 + i * 2, value, true));
  view.setInt16(70, 2, true);
  view.setInt16(72, 8, true);
  [1, columnLength(affine, 0), columnLength(affine, 1), columnLength(affine, 2), 1, 0, 0, 0].forEach((value, i) =>
    view.setFloat32(76 + i * 4, value, true)
  );
  view.setFloat32(108, 352, true);
  view.setFloat32(112, 1, true);
  view.setInt16(254, 2, true);
  affine.slice(0, 3).forEach((row, r) => row.forEach((value, c) => view.setFloat32(280 + r * 16 + c * 4, value, true)));
  [0x6e, 0x2b, 0x31, 0].forEach((value, i) => view.setUint8(344 + i, value));
  return new Blob([header, data]);
}

// Crops the mask to its bounding box so that it stays small.
function cropMask(seg, size, affine) {
  const low = [Infinity, Infinity, Infinity];
  const high = [-1, -1, -1];
  for (let z = 0, n = 0; z < size[2]; z++) {
    for (let y = 0; y < size[1]; y++) {
      for (let x = 0; x < size[0]; x++, n++) {
        if (!seg[n]) continue;
        [x, y, z].forEach((value, axis) => {
          low[axis] = Math.min(low[axis], value);
          high[axis] = Math.max(high[axis], value);
        });
      }
    }
  }
  if (high[0] < 0) return null;
  const from = low.map((value) => Math.max(value - 2, 0));
  const dims = high.map((value, axis) => Math.min(value + 3, size[axis]) - from[axis]);
  const data = new Uint8Array(dims[0] * dims[1] * dims[2]);
  for (let z = 0, n = 0; z < dims[2]; z++) {
    for (let y = 0; y < dims[1]; y++, n += dims[0]) {
      const offset = from[0] + size[0] * (y + from[1] + size[1] * (z + from[2]));
      data.set(seg.subarray(offset, offset + dims[0]), n);
    }
  }
  const moved = affine.map((row) => [row[0], row[1], row[2], row[0] * from[0] + row[1] * from[1] + row[2] * from[2] + row[3]]);
  return { data, dims, affine: moved };
}

function gzip(blob) {
  return new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).blob();
}

// The tracer works in millimetres and LPS, as SeqSeg does. NiiVue gives an RAS affine.
function toTracerVolume(volume, unit) {
  const { hdr, img } = volume;
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
  return {
    size,
    spacing: lengths.map((value) => value * scale),
    origin: [lps[0][3], lps[1][3], lps[2][3]],
    direction,
    data,
  };
}

function markPoint(point, label) {
  const dims = nv.back.dimsRAS;
  const spacing = nv.back.pixDimsRAS;
  const bitmap = nv.drawBitmap;
  bitmap.forEach((value, i) => {
    if (value === label) bitmap[i] = 0;
  });
  const frac = nv.mm2frac(point);
  const centre = [0, 1, 2].map((axis) => Math.round(frac[axis] * dims[axis + 1] - 0.5));
  const unitScale = MM_PER_UNIT[el("unit").value];
  const reach = [1, 2, 3].map((axis) => Math.max(Math.ceil(MARKER_RADIUS_MM / unitScale / spacing[axis]), 1));
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
  nv.refreshDrawing(true);
}

function crosshairWorld() {
  const mm = nv.frac2mm(nv.scene.crosshairPos);
  return [mm[0], mm[1], mm[2]];
}

function setPoint(kind, point = crosshairWorld()) {
  const unit = el("unit").value;
  if (kind === "start") {
    start = point;
    el("start-text").textContent = `Start: ${formatPoint(point, unit)}`;
    markPoint(point, LABEL_START);
  } else {
    direction = point;
    el("direction-text").textContent = `Direction: ${formatPoint(point, unit)}`;
    markPoint(point, LABEL_DIRECTION);
  }
  refreshRunButton();
}

function setView(use3d) {
  showing3d = use3d;
  if (!use3d) setCtHidden(false);
  nv.setSliceType(use3d ? SLICE_TYPE.RENDER : SLICE_TYPE.MULTIPLANAR);
  el("toggle-view").textContent = use3d ? "Show slices" : "Show 3D";
  el("toggle-ct").hidden = !use3d;
}

function setCtHidden(hidden) {
  ctHidden = hidden;
  nv.setOpacity(0, hidden ? 0 : 1);
  el("toggle-ct").textContent = hidden ? "Show CT" : "Hide CT";
}

function clearResult() {
  if (overlay) nv.removeVolume(overlay);
  overlay = null;
  el("result").hidden = true;
  if (nv && scan) setView(false);
}

async function ensureModel() {
  if (session) return;
  setStatus("Loading the model...");
  const useGpu = Boolean(navigator.gpu);
  ort = await import(`${ORT_BASE}${useGpu ? "ort.webgpu.bundle.min.mjs" : "ort.wasm.min.mjs"}`);
  ort.env.wasm.wasmPaths = ORT_BASE;
  ort.env.wasm.numThreads = 1;
  if (useGpu) {
    try {
      session = await ort.InferenceSession.create(modelUrl, { executionProviders: ["webgpu"] });
      backend = "WebGPU";
      return;
    } catch {
      session = null;
    }
  }
  session = await ort.InferenceSession.create(modelUrl, { executionProviders: ["wasm"] });
  backend = "CPU";
}

async function run() {
  busy = true;
  refreshRunButton();
  clearResult();
  try {
    await ensureModel();
    const unit = el("unit").value;
    const scale = MM_PER_UNIT[unit];
    const lps = (point) => [-point[0] * scale, -point[1] * scale, point[2] * scale];
    const seed = { start: lps(start), direction: lps(direction), radius: Number(el("radius").value) * scale };
    const steps = Number(el("steps").value);
    const volume = toTracerVolume(scan, unit);
    const began = performance.now();
    let done = 0;
    setStatus(`Tracing with ${backend}...`);
    await new Promise((resolve) => setTimeout(resolve));
    const { trace } = await import(el("tracer").dataset.src);
    const result = await trace(ort, session, volume, seed, steps, (event) => {
      if (!event.stopped) {
        done += 1;
        setStatus(`Tracing with ${backend}: step ${done} of ${steps}`);
      }
    });
    const seconds = (performance.now() - began) / 1000;
    const mask = cropMask(result.seg, volume.size, scan.hdr.affine);
    if (!mask) throw new Error("No vessel was found from this seed. Try moving the points or changing the radius.");
    maskUrl = URL.createObjectURL(await gzip(encodeMask(mask.data, mask.dims, mask.affine)));
    overlay = await nv.addVolumeFromUrl({ url: maskUrl, name: "mask.nii.gz", colormap: "green", opacity: 0.55 });
    el("download-mask").href = maskUrl;
    el("download-mask").download = "seqseg_mask.nii.gz";
    const voxels = result.seg.reduce((sum, value) => sum + value, 0);
    const millilitres = (voxels * volume.spacing[0] * volume.spacing[1] * volume.spacing[2]) / 1000;
    el("summary").textContent = `${result.steps.length} steps, ${millilitres.toFixed(2)} mL.`;
    el("result").hidden = false;
    setStatus(`Finished in ${seconds.toFixed(1)} seconds with ${backend}.`);
  } catch (error) {
    setStatus(error.message || "The trace failed.", true);
  } finally {
    busy = false;
    refreshRunButton();
  }
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
    clearResult();
    scan = null;
    nv.closeDrawing();
    await nv.loadVolumes([]);
    await nv.loadFromFile(file);
    scan = nv.volumes[0];
    if (scan.hdr.dims[0] > 3 && scan.hdr.dims[4] > 1) {
      throw Object.assign(new Error("Please use a single 3D volume."), { isScanError: true });
    }
    nv.setSliceType(SLICE_TYPE.MULTIPLANAR);
    nv.createEmptyDrawing();
    nv.setDrawOpacity(0.9);
    scan.cal_min = -100;
    scan.cal_max = 800;
    nv.updateGLVolume();

    start = null;
    direction = null;
    showing3d = false;
    ctHidden = false;
    el("start-text").textContent = "Start: not set";
    el("direction-text").textContent = "Direction: not set";
    const spacing = Math.min(columnLength(scan.hdr.affine, 0), columnLength(scan.hdr.affine, 1));
    el("unit").value = spacing < 0.15 ? "cm" : "mm";
    syncRadiusUnit();
    el("panel").hidden = false;
    setStatus("");
    setLoadStatus("");
    refreshRunButton();
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
    await loadScan(new File([await response.blob()], "seqseg_example.nii.gz"));
    if (!scan) return;
    el("radius").value = String(EXAMPLE.radius);
    setPoint("start", EXAMPLE.start);
    setPoint("direction", EXAMPLE.direction);
    nv.scene.crosshairPos = nv.mm2frac(EXAMPLE.start);
    nv.drawScene();
    setStatus("Example ready. The seed is on the left anterior descending artery. Press Trace vessel.");
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
el("set-start").addEventListener("click", () => setPoint("start"));
el("set-direction").addEventListener("click", () => setPoint("direction"));
el("example").addEventListener("click", loadExample);
el("run").addEventListener("click", run);
el("unit").addEventListener("change", syncRadiusUnit);
el("toggle-view").addEventListener("click", () => setView(!showing3d));
el("toggle-ct").addEventListener("click", () => setCtHidden(!ctHidden));
