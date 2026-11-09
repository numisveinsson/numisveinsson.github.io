---
layout: page
title: Try SeqSeg
permalink: /tools/seqseg/
description: Trace a coronary artery from a single seed, right in your browser.
nav: true
nav_order: 3.5
_styles: |
  .seqseg { display: grid; gap: 1.25rem; }
  .seqseg-notice { border-left: 3px solid var(--global-theme-color); padding: 0.5rem 0 0.5rem 1rem; color: var(--global-text-color-light); font-size: 0.95rem; }
  .seqseg-notice p { margin: 0 0 0.35rem; }
  .seqseg-notice p:last-child { margin-bottom: 0; }
  .seqseg-drop { display: block; border: 1.5px dashed var(--global-divider-color); border-radius: 10px; padding: 1.5rem; text-align: center; cursor: pointer; }
  .seqseg-drop:hover, .seqseg-drop.is-over, .seqseg-drop:focus-within { border-color: var(--global-theme-color); }
  .seqseg-drop input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .seqseg-drop small { display: block; color: var(--global-text-color-light); }
  .seqseg-viewer { position: relative; background: #000; border-radius: 10px; overflow: hidden; aspect-ratio: 4 / 3; max-height: 75vh; width: 100%; }
  .seqseg-viewer canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .seqseg-panel { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
  .seqseg-group { display: grid; gap: 0.5rem; align-content: start; min-width: 0; }
  .seqseg-group h2 { font-size: 1.05rem; margin: 0; }
  .seqseg-group label { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; font-size: 0.95rem; margin: 0; }
  .seqseg-group input[type="number"], .seqseg-group select { width: 6rem; padding: 0.15rem 0.35rem; border: 1px solid var(--global-divider-color); border-radius: 6px; background: var(--global-card-bg-color); color: var(--global-text-color); }
  .seqseg-group p { margin: 0; font-size: 0.9rem; color: var(--global-text-color-light); }
  .seqseg-coord { font-variant-numeric: tabular-nums; font-size: 0.85rem; color: var(--global-text-color-light); min-height: 1.3em; overflow-wrap: anywhere; }
  .seqseg button, .seqseg-link { font: inherit; font-size: 0.95rem; padding: 0.35rem 0.75rem; border-radius: 6px; border: 1px solid var(--global-divider-color); background: var(--global-card-bg-color); color: var(--global-text-color); cursor: pointer; text-align: center; }
  .seqseg button:hover:not(:disabled), .seqseg-link:hover { border-color: var(--global-theme-color); color: var(--global-theme-color); }
  .seqseg button:disabled { opacity: 0.5; cursor: not-allowed; }
  .seqseg button.seqseg-primary { background: var(--global-theme-color); border-color: var(--global-theme-color); color: #fff; }
  .seqseg button.seqseg-primary:hover:not(:disabled) { background: var(--global-hover-color); color: #fff; }
  .seqseg-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .seqseg-status { margin: 0; }
  .seqseg-status:empty { display: none; }
  .seqseg-status.is-error { color: var(--global-danger-block-title); }
  .seqseg + .seqseg-credit { margin-top: 1.5rem; }
  .seqseg [hidden] { display: none !important; }
  .seqseg-example { margin: -0.5rem 0 0; text-align: center; color: var(--global-text-color-light); }
  .seqseg-credit { margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--global-text-color-light); }
---

<div class="seqseg" id="seqseg" data-model="{{ '/assets/models/seqseg_coronary.onnx' | relative_url }}" data-example="{{ '/assets/data/seqseg_example.nii.gz' | relative_url }}" data-worker="{{ '/assets/js/seqseg-worker.js' | relative_url }}?v=2">
  <div class="seqseg-notice">
    <p>This research demo is not for clinical use and has not been validated for diagnosis or treatment.</p>
  </div>

  <label class="seqseg-drop" id="seqseg-drop">
    <input type="file" id="seqseg-file" accept=".nii,.gz,.mha,.nrrd">
    <strong>Choose a coronary CT angiography scan</strong>
    <small>Or drop it here. NIfTI, MHA or NRRD.</small>
  </label>

  <p class="seqseg-example">No scan? <button type="button" id="seqseg-example">Try an example scan</button></p>

  <p class="seqseg-status" id="seqseg-load-status" role="status"></p>

  <div class="seqseg-viewer" id="seqseg-viewer" hidden>
    <canvas id="seqseg-canvas" aria-label="CT scan viewer. Click a slice to move the crosshair."></canvas>
  </div>

  <div class="seqseg-panel" id="seqseg-panel" hidden>
    <div class="seqseg-group">
      <h2>1. Place the seed</h2>
      <p>Click a slice to move the crosshair onto the vessel, then set each point.</p>
      <button type="button" id="seqseg-set-start">Set start point</button>
      <div class="seqseg-coord" id="seqseg-start-text">Start: not set</div>
      <button type="button" id="seqseg-set-direction">Set direction point</button>
      <div class="seqseg-coord" id="seqseg-direction-text">Direction: not set</div>
    </div>
    <div class="seqseg-group">
      <h2>2. Settings</h2>
      <label><span>Vessel radius (<span id="seqseg-radius-unit">mm</span>)</span>
        <input type="number" id="seqseg-radius" min="0.5" max="10" step="0.1" value="2">
      </label>
      <label>Steps
        <input type="number" id="seqseg-steps" min="1" max="150" step="1" value="40">
      </label>
      <label>Image units
        <select id="seqseg-unit">
          <option value="mm">mm</option>
          <option value="cm">cm</option>
        </select>
      </label>
    </div>
    <div class="seqseg-group">
      <h2>3. Run</h2>
      <button type="button" class="seqseg-primary" id="seqseg-run" disabled>Trace vessel</button>
      <button type="button" id="seqseg-stop" hidden>Stop</button>
      <p class="seqseg-status" id="seqseg-status" role="status"></p>
    </div>
    <div class="seqseg-group" id="seqseg-result" hidden>
      <h2>Result</h2>
      <p id="seqseg-summary"></p>
      <div class="seqseg-row">
        <button type="button" id="seqseg-toggle-view">Show 3D</button>
        <button type="button" id="seqseg-toggle-ct" hidden>Hide CT</button>
      </div>
      <div class="seqseg-row">
        <a class="seqseg-link" id="seqseg-download-mask">Mask (.nii.gz)</a>
      </div>
    </div>
  </div>
</div>

<p class="seqseg-credit">The trace runs on your computer, and this tool does not upload your scan. The page does load code from outside services, and the site uses Google Analytics, so please do not use it with identifiable patient data.</p>
<p class="seqseg-credit">This is a browser version of <a href="https://github.com/numisveinsson/SeqSeg">SeqSeg</a> and is still being validated. Its results can differ from the Python version, and it can occasionally follow the wrong vessel.</p>
<p class="seqseg-credit">Example scan: cropped from case 0066_H_CORO_H of the <a href="https://www.vascularmodel.com">Vascular Model Repository</a> (Wilson, Ortiz and Johnson, J. Med. Devices 7(4), 2013), provided for research and development use. See its <a href="{{ '/assets/data/seqseg_example_LICENSE.txt' | relative_url }}">license</a>. The data was provided in whole or in part with Federal funds from the National Library of Medicine under Grant No. R01LM013120, and the National Heart, Lung, and Blood Institute, National Institutes of Health, Department of Health and Human Services, under Contract No. HHSN268201100035C.</p>
<p class="seqseg-credit">Model weights: <a href="https://doi.org/10.5281/zenodo.23813298">SeqSeg nnU-Net weights, CT coronary segmentation</a> (CC BY 4.0). Method: <a href="https://doi.org/10.1007/s10439-024-03611-z">Sveinsson Cepero and Shadden, Annals of Biomedical Engineering, 2024</a>. Built on <a href="https://github.com/MIC-DKFZ/nnUNet">nnU-Net</a>, <a href="https://github.com/niivue/niivue">NiiVue</a> and <a href="https://onnxruntime.ai">ONNX Runtime</a>.</p>

<div id="seqseg-tracer" data-src="{{ '/assets/js/seqseg-tracer.js' | relative_url }}?v=2" hidden></div>
<script type="module" src="{{ '/assets/js/seqseg-tool.js' | relative_url }}"></script>
