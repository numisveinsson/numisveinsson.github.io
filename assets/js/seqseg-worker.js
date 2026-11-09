// Runs a SeqSeg trace off the page's main thread, so the page stays responsive.
let ort;
let session;
let backend = "";
let defaultBranchSteps;

// Safari can stall without an error while creating a WebGPU session or running it in a
// worker. So WebGPU must load and run one test batch, of the shape the tracer uses, in
// time; otherwise the trace falls back to the CPU.
const GPU_TIMEOUT_MS = 20000;
const TEST_SHAPE = [32, 1, 10, 12, 12];

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms))]);
}

async function tryWebGpu(modelUrl) {
  const gpuSession = await withTimeout(ort.InferenceSession.create(modelUrl, { executionProviders: ["webgpu"] }), GPU_TIMEOUT_MS);
  const size = TEST_SHAPE.reduce((a, b) => a * b, 1);
  const out = (await withTimeout(gpuSession.run({ x: new ort.Tensor("float32", new Float32Array(size), TEST_SHAPE) }), GPU_TIMEOUT_MS)).y;
  const data = out.data ?? (await withTimeout(out.getData(), GPU_TIMEOUT_MS));
  if (!data.length || !Number.isFinite(data[0])) throw new Error("bad output");
  return gpuSession;
}

async function ensureModel({ ortBase, modelUrl, useGpu }) {
  if (session) return;
  const gpu = useGpu && Boolean(self.navigator.gpu);
  ort = await import(`${ortBase}${gpu ? "ort.webgpu.bundle.min.mjs" : "ort.wasm.min.mjs"}`);
  ort.env.wasm.wasmPaths = ortBase;
  ort.env.wasm.numThreads = 1;
  if (gpu) {
    try {
      session = await tryWebGpu(modelUrl);
      backend = "WebGPU";
      return;
    } catch {
      // A hung WebGPU call may block this runtime, so the CPU gets a separate one.
      session = null;
      ort = await import(`${ortBase}ort.wasm.min.mjs`);
      ort.env.wasm.wasmPaths = ortBase;
      ort.env.wasm.numThreads = 1;
    }
  }
  session = await ort.InferenceSession.create(modelUrl, { executionProviders: ["wasm"] });
  backend = "CPU";
}

self.onmessage = async ({ data }) => {
  try {
    await ensureModel(data);
    self.postMessage({ type: "backend", backend });
    const { trace, CONFIG } = await import(data.tracerUrl);
    // An optional per-branch step limit. The default is restored when none is given, since
    // the module stays loaded between traces.
    defaultBranchSteps ??= CONFIG.maxStepsBranch;
    CONFIG.maxStepsBranch = data.maxStepsBranch ?? defaultBranchSteps;
    const result = await trace(ort, session, data.volume, data.seed, data.steps, (event) => {
      if (!event.stopped) self.postMessage({ type: "step" });
    });
    // Each step as a line from where it started to where it ended, as [x, y, z, radius] in LPS mm.
    const lines = result.steps.map((st) => [[...st.old, st.oldR], [...st.point, st.radius]]);
    self.postMessage({ type: "done", seg: result.seg, steps: result.steps.length, lines }, [result.seg.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", message: (error && error.message) || "The trace failed." });
  }
};
