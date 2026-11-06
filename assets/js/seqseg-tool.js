const NIIVUE_URL = "https://cdn.jsdelivr.net/npm/@niivue/niivue@0.69.0/dist/index.js";
const CROP_SIZE_MM = 80;
const MM_PER_UNIT = { mm: 1, cm: 10 };
const POLL_MS = 1500;
const MARKER_RADIUS_MM = 1.2;
const LABEL_START = 2;
const LABEL_DIRECTION = 3;

const root = document.getElementById("seqseg");
const apiUrl = root.dataset.api.replace(/\/$/, "");
const el = (name) => document.getElementById(`seqseg-${name}`);

let nv;
let SLICE_TYPE;
let scan;
let start = null;
let direction = null;
let busy = false;
let currentJob = null;
let overlay = null;
let mesh = null;
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

// Copies the voxels around the seed into a new array, in the file's voxel order.
function cropAroundSeed(volume, seed, unit) {
  const { hdr, img } = volume;
  const dims = hdr.dims.slice(1, 4);
  const affine = hdr.affine;
  const centre = worldToVoxel(seed, invertAffine(affine));
  const halfWidth = CROP_SIZE_MM / 2 / MM_PER_UNIT[unit];
  const low = [];
  const size = [];
  for (let axis = 0; axis < 3; axis++) {
    const half = Math.ceil(halfWidth / columnLength(affine, axis));
    const from = Math.max(Math.round(centre[axis]) - half, 0);
    const to = Math.min(Math.round(centre[axis]) + half, dims[axis]);
    low.push(from);
    size.push(to - from);
  }
  const cropped = new img.constructor(size[0] * size[1] * size[2]);
  let target = 0;
  for (let z = 0; z < size[2]; z++) {
    for (let y = 0; y < size[1]; y++) {
      const offset = low[0] + (y + low[1]) * dims[0] + (z + low[2]) * dims[0] * dims[1];
      cropped.set(img.subarray(offset, offset + size[0]), target);
      target += size[0];
    }
  }
  const croppedAffine = affine.map((row) => [row[0], row[1], row[2], row[0] * low[0] + row[1] * low[1] + row[2] * low[2] + row[3]]);
  return { data: cropped, size, affine: croppedAffine };
}

// Builds a NIfTI-1 file from scratch so that no header field of the original scan is sent.
function encodeNifti(crop, volume) {
  const { data, size, affine } = crop;
  const { hdr } = volume;
  const header = new ArrayBuffer(352);
  const view = new DataView(header);
  view.setInt32(0, 348, true);
  [3, size[0], size[1], size[2], 1, 1, 1, 1].forEach((value, i) => view.setInt16(40 + i * 2, value, true));
  view.setInt16(70, hdr.datatypeCode, true);
  view.setInt16(72, data.BYTES_PER_ELEMENT * 8, true);
  [1, columnLength(affine, 0), columnLength(affine, 1), columnLength(affine, 2), 1, 0, 0, 0].forEach((value, i) =>
    view.setFloat32(76 + i * 4, value, true)
  );
  view.setFloat32(108, 352, true);
  view.setFloat32(112, hdr.scl_slope || 1, true);
  view.setFloat32(116, hdr.scl_inter || 0, true);
  view.setInt16(254, 2, true);
  affine.slice(0, 3).forEach((row, r) => row.forEach((value, c) => view.setFloat32(280 + r * 16 + c * 4, value, true)));
  [0x6e, 0x2b, 0x31, 0].forEach((value, i) => view.setUint8(344 + i, value));
  return new Blob([header, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)]);
}

function gzip(blob) {
  return new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).blob();
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

function setPoint(kind) {
  const point = crosshairWorld();
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
  if (mesh) nv.removeMesh(mesh);
  overlay = null;
  mesh = null;
  el("result").hidden = true;
  if (nv && scan) setView(false);
}

async function apiError(response) {
  try {
    return (await response.json()).detail || `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

async function waitForJob(id) {
  for (;;) {
    const response = await fetch(`${apiUrl}/api/jobs/${id}`);
    if (!response.ok) throw new Error(await apiError(response));
    const job = await response.json();
    if (job.status === "done") return job;
    if (job.status === "failed") throw new Error(job.error || "The run failed.");
    setStatus(job.status === "queued" ? "Waiting for the server..." : "Tracing the vessel...");
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

async function showResult(id, job) {
  const base = `${apiUrl}/api/jobs/${id}`;
  overlay = await nv.addVolumeFromUrl({ url: `${base}/mask.nii.gz`, name: "mask.nii.gz", colormap: "green", opacity: 0.55 });
  mesh = await nv.addMeshFromUrl({ url: `${base}/mesh.stl`, name: "mesh.stl", rgba255: [64, 220, 120, 255] });
  el("download-mask").href = `${base}/mask.nii.gz`;
  el("download-mesh").href = `${base}/mesh.vtp`;
  const millilitres = (job.volume * MM_PER_UNIT[job.unit] ** 3) / 1000;
  el("summary").textContent = `${job.steps} steps, ${millilitres.toFixed(2)} mL. Downloads expire in 15 minutes.`;
  el("result").hidden = false;
}

async function run() {
  busy = true;
  refreshRunButton();
  clearResult();
  if (currentJob) {
    fetch(`${apiUrl}/api/jobs/${currentJob}`, { method: "DELETE" }).catch(() => {});
    currentJob = null;
  }
  try {
    const unit = el("unit").value;
    setStatus("Preparing the cropped region...");
    const crop = cropAroundSeed(scan, start, unit);
    const image = await gzip(encodeNifti(crop, scan));
    const seed = { start, direction, radius: Number(el("radius").value) / MM_PER_UNIT[unit] };
    const form = new FormData();
    form.append("image", image, "crop.nii.gz");
    form.append("seed", JSON.stringify(seed));
    form.append("steps", el("steps").value);
    form.append("unit", unit);

    setStatus(`Uploading ${(image.size / 1e6).toFixed(1)} MB...`);
    const response = await fetch(`${apiUrl}/api/jobs`, { method: "POST", body: form });
    if (!response.ok) throw new Error(await apiError(response));
    const { id } = await response.json();
    currentJob = id;
    const job = await waitForJob(id);
    await showResult(id, job);
    const seconds = job.finished - job.started;
    setStatus(`Finished in ${seconds.toFixed(0)} seconds.`);
  } catch (error) {
    const offline = error instanceof TypeError;
    setStatus(offline ? "The SeqSeg server could not be reached. Please try again later." : error.message, true);
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
el("run").addEventListener("click", run);
el("toggle-view").addEventListener("click", () => setView(!showing3d));
el("toggle-ct").addEventListener("click", () => setCtHidden(!ctHidden));
window.addEventListener("pagehide", () => {
  if (currentJob) fetch(`${apiUrl}/api/jobs/${currentJob}`, { method: "DELETE", keepalive: true }).catch(() => {});
});
