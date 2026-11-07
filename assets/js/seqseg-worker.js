// Runs a SeqSeg trace off the page's main thread, so the page stays responsive.
let ort;
let session;
let backend = "";

async function ensureModel({ ortBase, modelUrl, useGpu }) {
  if (session) return;
  const gpu = useGpu && Boolean(self.navigator.gpu);
  ort = await import(`${ortBase}${gpu ? "ort.webgpu.bundle.min.mjs" : "ort.wasm.min.mjs"}`);
  ort.env.wasm.wasmPaths = ortBase;
  ort.env.wasm.numThreads = 1;
  if (gpu) {
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

self.onmessage = async ({ data }) => {
  try {
    await ensureModel(data);
    self.postMessage({ type: "backend", backend });
    const { trace } = await import(data.tracerUrl);
    const result = await trace(ort, session, data.volume, data.seed, data.steps, (event) => {
      if (!event.stopped) self.postMessage({ type: "step" });
    });
    self.postMessage({ type: "done", seg: result.seg, steps: result.steps.length }, [result.seg.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", message: (error && error.message) || "The trace failed." });
  }
};
